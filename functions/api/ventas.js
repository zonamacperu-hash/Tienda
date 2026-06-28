import { queryDb, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const query = `
      SELECT v.*, COALESCE(a.nombre_razon_social, v.cliente_nombre_manual) as cliente_nombre, u.nombre as usuario_nombre
      FROM ventas v
      LEFT JOIN actores a ON v.cliente_id = a.id
      JOIN usuarios u ON v.usuario_id = u.id
      ORDER BY v.fecha_venta DESC
    `;
    const ventasList = await queryDb(env, query);
    for (const v of ventasList) {
      v.metodo_pago = v.condicion_pago;
    }
    return jsonResponse(ventasList);
  } catch (err) {
    return errorResponse(`Error al obtener ventas: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const datosVenta = await request.json();
    const prestamo_id = datosVenta.prestamo_id;

    // 1. Obtener Tipo de Cambio actual
    const config = await queryDb(env, "SELECT tipo_cambio_actual FROM configuracion_sistema LIMIT 1", [], true);
    if (!config) {
      return errorResponse("No se ha configurado el sistema ni el tipo de cambio del día.", 400);
    }
    const tipoCambio = parseFloat(config.tipo_cambio_actual);

    // 2. Validar Cliente y Comprobante
    let cliente_id = datosVenta.cliente_id;
    let clienteNombreManual = null;
    const tipoComprobante = datosVenta.tipo_comprobante;

    if (cliente_id === undefined || cliente_id === null || cliente_id === 0 || cliente_id === "" || cliente_id === "0" || cliente_id === "None") {
      cliente_id = null;
      clienteNombreManual = (datosVenta.cliente_nombre_manual || "").trim();
      if (!clienteNombreManual) {
        return errorResponse("Debe ingresar el nombre del comprador para el registro manual (Comprador Invitado).", 400);
      }
      if (tipoComprobante === "Factura") {
        return errorResponse("Las facturas requieren obligatoriamente un cliente registrado con RUC.", 400);
      }
      if (datosVenta.condicion_pago === "Credito") {
        return errorResponse("Las ventas al crédito requieren obligatoriamente un cliente registrado para control de cuentas por cobrar.", 400);
      }
    } else {
      const cliente = await queryDb(
        env,
        "SELECT id, nombre_razon_social, tipo_documento, documento_identidad FROM actores WHERE id = ? AND (tipo = 'Cliente' OR tipo = 'Ambos')",
        [cliente_id],
        true
      );
      if (!cliente) {
        return errorResponse(`El cliente con ID ${cliente_id} no existe o no es un cliente válido.`, 400);
      }
      
      if (tipoComprobante === "Factura") {
        const docTipo = cliente.tipo_documento;
        const docNum = (cliente.documento_identidad || "").trim();
        if (docTipo !== "RUC") {
          return errorResponse(`El cliente seleccionado no cuenta con RUC (tipo registrado: ${docTipo}). Las facturas exigen RUC obligatoriamente.`, 400);
        }
        if (docNum.length !== 11 || !docNum.startsWith("10") && !docNum.startsWith("20") || isNaN(docNum)) {
          return errorResponse("El RUC del cliente registrado no es válido. Debe tener 11 dígitos numéricos y comenzar con 10 o 20.", 400);
        }
      }
    }

    // Validar Usuario/Vendedor
    const usuario = await queryDb(
      env,
      "SELECT id, nombre, rol, activo FROM usuarios WHERE id = ?",
      [datosVenta.usuario_id],
      true
    );
    if (!usuario || usuario.activo === 0) {
      return errorResponse("El usuario/vendedor no está activo en el sistema.", 400);
    }
    const usuarioRol = usuario.rol;

    let ventaSubtotal = 0.00;
    const detallesAInsertar = [];
    const seriesAActualizar = [];
    const statements = [];

    // 3. Iterar y procesar cada ítem del carrito
    for (const item of (datosVenta.items || [])) {
      const producto_id = item.producto_id;
      const cantidad = parseInt(item.cantidad, 10);
      const tipoPrecio = item.tipo_precio;
      const mesesGarantia = parseInt(item.meses_garantia || 0, 10);

      // Si proviene de un préstamo, revertimos temporalmente el descuento de stock previo
      if (prestamo_id) {
        statements.push(
          env.DB.prepare("UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?").bind(cantidad, producto_id)
        );
      }

      // Consultar producto
      const producto = await queryDb(
        env,
        "SELECT id, nombre, maneja_series, stock_actual, precio_base, precio_final FROM productos WHERE id = ?",
        [producto_id],
        true
      );
      if (!producto) {
        return errorResponse(`El producto con ID ${producto_id} no existe.`, 400);
      }

      const prodId = producto.id;
      const prodNombre = producto.nombre;
      const prodManejaSeries = producto.maneja_series;
      const prodStock = producto.stock_actual;
      const prodPrecioBase = producto.precio_base;
      const prodPrecioFinal = producto.precio_final;

      // VALIDAR NÚMEROS DE SERIE
      if (prodManejaSeries === 1) {
        const seriesEnviadas = item.series_seleccionadas || [];
        if (seriesEnviadas.length !== cantidad) {
          return errorResponse(`Debe seleccionar exactamente ${cantidad} número(s) de serie para el producto '${prodNombre}'.`, 400);
        }

        for (const numeroSerie of seriesEnviadas) {
          let querySerie, argsSerie;
          if (prestamo_id) {
            querySerie = "SELECT id FROM producto_series WHERE producto_id = ? AND numero_serie = ? AND estado = 'Prestado' AND prestamo_id = ?";
            argsSerie = [prodId, numeroSerie, prestamo_id];
          } else {
            querySerie = "SELECT id FROM producto_series WHERE producto_id = ? AND numero_serie = ? AND estado = 'Disponible'";
            argsSerie = [prodId, numeroSerie];
          }

          const serieFisica = await queryDb(env, querySerie, argsSerie, true);
          if (!serieFisica) {
            return errorResponse(`La serie '${numeroSerie}' del producto '${prodNombre}' no está disponible o ya fue vendida.`, 400);
          }

          seriesAActualizar.push({
            serie_id: serieFisica.id,
            meses_garantia: mesesGarantia
          });
        }
      } else {
        // Validar stock para productos que no manejan series
        if (prodStock < cantidad) {
          return errorResponse(`Stock insuficiente para el producto '${prodNombre}'. Disponible: ${prodStock}, Solicitado: ${cantidad}`, 400);
        }
      }

      // VALIDAR Y CALCULAR PRECIO UNITARIO
      let precioUnitarioBaseMonedaOriginal = 0.00;
      if (tipoPrecio === "Base") {
        precioUnitarioBaseMonedaOriginal = prodPrecioBase;
      } else if (tipoPrecio === "Final") {
        precioUnitarioBaseMonedaOriginal = prodPrecioFinal;
      } else if (tipoPrecio === "Manual") {
        const precioManual = parseFloat(item.precio_manual || 0.0);
        if (usuarioRol !== "Administrador" && precioManual !== prodPrecioFinal) {
          return errorResponse(`No tiene permisos de administrador para alterar el precio de venta del producto '${prodNombre}' de manera manual.`, 400);
        }
        precioUnitarioBaseMonedaOriginal = precioManual;
      } else {
        return errorResponse(`Tipo de precio '${tipoPrecio}' no es válido.`, 400);
      }

      // Conversión si la venta es en USD
      let precioUnitarioTransaccion = precioUnitarioBaseMonedaOriginal;
      if (datosVenta.moneda === "USD") {
        precioUnitarioTransaccion = precioUnitarioBaseMonedaOriginal / tipoCambio;
      }

      const itemSubtotal = precioUnitarioTransaccion * cantidad;
      ventaSubtotal += itemSubtotal;

      detallesAInsertar.push({
        producto_id: prodId,
        cantidad,
        tipo_precio: tipoPrecio,
        precio_unitario: precioUnitarioTransaccion,
        meses_garantia: mesesGarantia,
        subtotal: itemSubtotal
      });
    }

    // 4. Calcular impuestos (IGV 18%)
    const ventaTotal = ventaSubtotal;
    let subtotalSinIgv, ventaIgv;
    if (tipoComprobante === "Factura") {
      subtotalSinIgv = ventaTotal / 1.18;
      ventaIgv = ventaTotal - subtotalSinIgv;
    } else {
      subtotalSinIgv = ventaTotal;
      ventaIgv = 0.00;
    }

    // 5. Obtener secuencia correlativo
    const secuencia = await queryDb(
      env,
      "SELECT serie, correlativo_actual FROM secuencias_comprobante WHERE tipo = ?",
      [tipoComprobante],
      true
    );
    if (!secuencia) {
      return errorResponse(`No se ha configurado una serie/correlativo para el comprobante tipo '${tipoComprobante}'.`, 400);
    }

    const { serie: serieComprobante, correlativo_actual: correlativoActual } = secuencia;
    const nuevoCorrelativo = correlativoActual + 1;
    const correlativoStr = String(nuevoCorrelativo).padStart(8, "0");

    // Actualizar secuencia
    statements.push(
      env.DB.prepare("UPDATE secuencias_comprobante SET correlativo_actual = ? WHERE tipo = ?").bind(nuevoCorrelativo, tipoComprobante)
    );

    // 6. Registrar Cabecera Venta
    statements.push(
      env.DB.prepare(`
        INSERT INTO ventas (
          cliente_id, usuario_id, tipo_comprobante, serie_comprobante, correlativo_comprobante,
          moneda, tipo_cambio, condicion_pago, fecha_vencimiento, subtotal, igv, total, estado, observaciones, cliente_nombre_manual
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completada', ?, ?)
      `).bind(
        cliente_id,
        datosVenta.usuario_id,
        tipoComprobante,
        serieComprobante,
        correlativoStr,
        datosVenta.moneda,
        tipoCambio,
        datosVenta.condicion_pago,
        datosVenta.condicion_pago === "Credito" ? datosVenta.fecha_vencimiento : null,
        subtotalSinIgv,
        ventaIgv,
        ventaTotal,
        datosVenta.observaciones || "",
        clienteNombreManual
      )
    );

    // 7. Registrar Detalles
    for (const det of detallesAInsertar) {
      statements.push(
        env.DB.prepare(`
          INSERT INTO venta_detalles (
            venta_id, producto_id, cantidad, tipo_precio, precio_unitario, meses_garantia, subtotal
          ) VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?)
        `).bind(
          det.producto_id,
          det.cantidad,
          det.tipo_precio,
          det.precio_unitario,
          det.meses_garantia,
          det.subtotal
        )
      );
    }

    // 8. Actualizar estado de las Series
    for (const s of seriesAActualizar) {
      const nuevoEstado = s.meses_garantia > 0 ? "En Garantia" : "Vendido";
      statements.push(
        env.DB.prepare("UPDATE producto_series SET estado = ?, venta_id = last_insert_rowid() WHERE id = ?").bind(nuevoEstado, s.serie_id)
      );
    }

    // 8b. Si proviene de un préstamo, actualizar el estado del préstamo
    if (prestamo_id) {
      // Nota: D1 ejecuta los statements en orden. Podemos verificar las series en JS antes, o hacer una subconsulta dinámica.
      // Evaluamos las series restantes de préstamo al final
      statements.push(
        env.DB.prepare(`
          UPDATE prestamos_intertienda 
          SET estado = CASE 
            WHEN (SELECT COUNT(*) FROM producto_series WHERE prestamo_id = ? AND estado = 'Prestado') = 0 
            THEN 'Convertido en Venta' 
            ELSE 'Devuelto Parcial' 
          END
          WHERE id = ?
        `).bind(prestamo_id, prestamo_id)
      );
    }

    // 9. Gestionar Crédito o Pagos Contado
    const condicionPago = datosVenta.condicion_pago || "Contado";
    if (condicionPago === "Credito") {
      const fechaVencimiento = datosVenta.fecha_vencimiento;
      if (!fechaVencimiento) {
        return errorResponse("Debe ingresar una fecha de vencimiento válida para ventas al crédito.", 400);
      }
      statements.push(
        env.DB.prepare(`
          INSERT INTO cuentas_por_cobrar (
            venta_id, cliente_id, monto_total, monto_pagado, fecha_vencimiento, estado
          ) VALUES (last_insert_rowid(), ?, ?, 0.00, ?, 'Pendiente')
        `).bind(cliente_id, ventaTotal, fechaVencimiento)
      );
    } else if (condicionPago === "Contado") {
      const pagos = datosVenta.pagos || [];
      if (pagos.length === 0) {
        return errorResponse("Debe ingresar al menos un método de pago para ventas al contado.", 400);
      }

      let totalPago = 0.0;
      for (const p of pagos) {
        const metodo = p.metodo_pago;
        const monto = parseFloat(p.monto || 0.0);
        if (!["Efectivo", "Transferencia", "Yape/Plin", "Tarjeta"].includes(metodo)) {
          return errorResponse(`Método de pago '${metodo}' no es válido.`, 400);
        }
        if (monto < 0) {
          return errorResponse("El monto de pago no puede ser menor a cero.", 400);
        }
        totalPago += monto;
      }

      if (totalPago < ventaTotal - 0.005) {
        return errorResponse(`El monto total pagado (${totalPago.toFixed(2)}) es menor que el total de la venta (${ventaTotal.toFixed(2)}).`, 400);
      }

      const exceso = totalPago - ventaTotal;
      if (exceso > 0.005) {
        const pagoEfectivo = pagos.find(p => p.metodo_pago === "Efectivo");
        if (!pagoEfectivo) {
          return errorResponse("El pago total excede el monto de la venta, pero no se ha especificado pago en Efectivo para entregar el vuelto.", 400);
        }

        const efectivoMonto = parseFloat(pagoEfectivo.monto || 0.0);
        if (efectivoMonto < exceso) {
          return errorResponse(`El vuelto a entregar (${exceso.toFixed(2)}) supera el monto pagado en Efectivo (${efectivoMonto.toFixed(2)}).`, 400);
        }

        pagoEfectivo.monto = efectivoMonto - exceso;
      }

      for (const p of pagos) {
        const metodo = p.metodo_pago;
        const monto = Math.round(parseFloat(p.monto || 0.0) * 100) / 100;
        if (monto > 0) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO venta_pagos (venta_id, metodo_pago, monto, moneda)
              VALUES (last_insert_rowid(), ?, ?, ?)
            `).bind(metodo, monto, datosVenta.moneda)
          );
        }
      }
    }

    // Ejecutar todo de forma atómica en un único batch
    const batchResult = await env.DB.batch(statements);

    // Obtener la ID de la venta creada
    // Dado que el statement de inserción de venta está en la posición 1 (índice 1 de statements)
    // Nota: Si hay prestamo_id, se agrega un UPDATE inicial, desplazando el índice del INSERT de venta.
    const insertVentaIndex = prestamo_id ? 2 : 1;
    const ventaId = batchResult[insertVentaIndex].meta.last_row_id;

    return jsonResponse({
      exito: true,
      venta_id: ventaId,
      comprobante: `${serieComprobante}-${correlativoStr}`,
      total: ventaTotal
    });
  } catch (err) {
    return errorResponse(`Error al registrar venta: ${err.message}`, 400);
  }
}
