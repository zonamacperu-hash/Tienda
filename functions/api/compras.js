import { queryDb, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const query = `
      SELECT c.*, a.nombre_razon_social as proveedor_nombre, u.nombre as usuario_nombre
      FROM compras c
      JOIN actores a ON c.proveedor_id = a.id
      JOIN usuarios u ON c.usuario_id = u.id
      ORDER BY c.fecha_compra DESC
    `;
    const comprasList = await queryDb(env, query);
    return jsonResponse(comprasList);
  } catch (err) {
    return errorResponse(`Error al obtener compras: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const proveedor_id = data.proveedor_id;
    const tipo_comprobante = data.tipo_comprobante;
    const usuario_id = data.usuario_id;
    const items = data.items || [];
    const metodo_pago = data.metodo_pago;
    const fecha_vencimiento = data.fecha_vencimiento;
    const serie_comprobante = data.serie_comprobante;
    const correlativo_comprobante = data.correlativo_comprobante;
    const moneda = data.moneda || "PEN";
    const tc = parseFloat(data.tipo_cambio || 3.7500);
    const observaciones = data.observaciones || "";

    if (!proveedor_id || !tipo_comprobante || !usuario_id || items.length === 0 || !metodo_pago || !serie_comprobante || !correlativo_comprobante) {
      return errorResponse("Faltan datos obligatorios para registrar la compra.", 400);
    }

    // Validar proveedor
    const proveedor = await queryDb(
      env,
      "SELECT id, nombre_razon_social, tipo_documento, documento_identidad FROM actores WHERE id = ? AND (tipo = 'Proveedor' OR tipo = 'Ambos')",
      [proveedor_id],
      true
    );
    if (!proveedor) {
      return errorResponse("El proveedor seleccionado no es válido o no existe.", 400);
    }

    if (tipo_comprobante === "Factura") {
      const docTipo = proveedor.tipo_documento;
      const docNum = (proveedor.documento_identidad || "").trim();
      if (docTipo !== "RUC") {
        return errorResponse(`El proveedor seleccionado no cuenta con RUC (tipo registrado: ${docTipo}). Las facturas exigen RUC obligatoriamente.`, 400);
      }
      if (docNum.length !== 11 || !docNum.startsWith("10") && !docNum.startsWith("20") || isNaN(docNum)) {
        return errorResponse("El RUC del proveedor registrado no es válido. Debe tener 11 dígitos numéricos y comenzar con 10 o 20.", 400);
      }
    }

    // Calcular totales
    let totalCalculado = 0.0;
    for (const item of items) {
      const qty = parseInt(item.cantidad, 10);
      const precioUn = parseFloat(item.precio_unitario);
      totalCalculado += precioUn * qty;
    }

    let subtotal, igv;
    if (tipo_comprobante === "Factura") {
      subtotal = totalCalculado / 1.18;
      igv = totalCalculado - subtotal;
    } else {
      subtotal = totalCalculado;
      igv = 0.00;
    }
    const total = totalCalculado;

    // Verificar si los productos manejan series y validar stock
    const statements = [];

    // 1. Insert cabecera compra
    statements.push(
      env.DB.prepare(`
        INSERT INTO compras (
          proveedor_id, usuario_id, tipo_comprobante, serie_comprobante, correlativo_comprobante,
          fecha_compra, moneda, tipo_cambio, metodo_pago, fecha_vencimiento, subtotal, igv, total, estado, observaciones
        ) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?, 'Completada', ?)
      `).bind(
        proveedor_id,
        usuario_id,
        tipo_comprobante,
        serie_comprobante,
        correlativo_comprobante,
        moneda,
        tc,
        metodo_pago,
        metodo_pago === "Credito" ? fecha_vencimiento : null,
        subtotal,
        igv,
        total,
        observaciones
      )
    );

    // 2. Detalles e ingresar Series
    for (const item of items) {
      const prod_id = item.producto_id;
      const qty = parseInt(item.cantidad, 10);
      const precio_un = parseFloat(item.precio_unitario);
      const item_sub = precio_un * qty;

      statements.push(
        env.DB.prepare(`
          INSERT INTO compra_detalles (compra_id, producto_id, cantidad, precio_unitario, subtotal)
          VALUES ((SELECT MAX(id) FROM compras), ?, ?, ?, ?)
        `).bind(prod_id, qty, precio_un, item_sub)
      );

      const producto = await queryDb(env, "SELECT maneja_series, nombre FROM productos WHERE id = ?", [prod_id], true);
      if (producto && producto.maneja_series === 1) {
        const series = item.series || [];
        if (series.length !== qty) {
          return errorResponse(`Debe registrar exactamente ${qty} series para el producto '${producto.nombre}'.`, 400);
        }

        for (const s_item of series) {
          let sn, det_ind;
          if (typeof s_item === "object" && s_item !== null) {
            sn = s_item.numero_serie;
            det_ind = s_item.detalles_individuales || "";
          } else {
            sn = s_item;
            det_ind = "";
          }

          statements.push(
            env.DB.prepare(`
              INSERT INTO producto_series (producto_id, numero_serie, estado, compra_id, detalles_individuales)
              VALUES (?, ?, 'Disponible', (SELECT MAX(id) FROM compras), ?)
            `).bind(prod_id, sn, det_ind)
          );
        }
      }
    }

    // 3. Registrar Cuenta por Pagar si es a Crédito
    if (metodo_pago === "Credito") {
      if (!fecha_vencimiento) {
        return errorResponse("Debe ingresar una fecha de vencimiento válida para compras al crédito.", 400);
      }
      statements.push(
        env.DB.prepare(`
          INSERT INTO cuentas_por_pagar (compra_id, proveedor_id, monto_total, monto_pagado, fecha_vencimiento, estado)
          VALUES ((SELECT MAX(id) FROM compras), ?, ?, 0.00, ?, 'Pendiente')
        `).bind(proveedor_id, total, fecha_vencimiento)
      );
    }

    // Executar batch transaccional
    const batchResult = await env.DB.batch(statements);
    
    // Obtener la ID del último insert ejecutado en el batch (la cabecera de la compra)
    // El primer statement es la inserción de compras
    const compra_id = batchResult[0].meta.last_row_id;

    return jsonResponse({
      exito: true,
      compra_id,
      mensaje: "Compra registrada y stock actualizado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al registrar compra: ${err.message}`, 400);
  }
}
