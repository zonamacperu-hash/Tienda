import { queryDb, executeDb, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const prestamos = await queryDb(
      env,
      `SELECT p.*, a.nombre_razon_social as tienda_destino_nombre, u.nombre as usuario_nombre
       FROM prestamos_intertienda p
       JOIN actores a ON p.tienda_destino_id = a.id
       JOIN usuarios u ON p.usuario_id = u.id
       ORDER BY p.fecha_prestamo DESC`
    );

    for (const p of prestamos) {
      // Obtener detalles del préstamo
      const detalles = await queryDb(
        env,
        `SELECT pd.*, prod.nombre as producto_nombre, prod.maneja_series, prod.precio_base, prod.precio_final, prod.moneda
         FROM prestamo_detalles pd
         JOIN productos prod ON pd.producto_id = prod.id
         WHERE pd.prestamo_id = ?`,
        [p.id]
      );

      for (const d of detalles) {
        // Obtener series asociadas
        const series = await queryDb(
          env,
          `SELECT id, numero_serie, estado, detalles_individuales
           FROM producto_series
           WHERE prestamo_id = ? AND producto_id = ?`,
          [p.id, d.producto_id]
        );
        d.series = series;
      }
      p.items = detalles;
    }

    return jsonResponse(prestamos);
  } catch (err) {
    return errorResponse(`Error al obtener préstamos: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const tienda_destino_id = data.tienda_destino_id;
    const usuario_id = data.usuario_id;
    const observaciones = data.observaciones || "";
    const items = data.items || [];

    if (!tienda_destino_id || !usuario_id || items.length === 0) {
      return errorResponse("Faltan datos obligatorios para registrar el préstamo.", 400);
    }

    const statements = [];

    // 1. Crear cabecera préstamo
    statements.push(
      env.DB.prepare(`
        INSERT INTO prestamos_intertienda (tienda_destino_id, usuario_id, observaciones, estado)
        VALUES (?, ?, ?, 'Pendiente')
      `).bind(tienda_destino_id, usuario_id, observaciones)
    );

    // 2. Procesar detalles y validar en JS primero
    for (const item of items) {
      const producto_id = item.producto_id;
      const cantidad = parseInt(item.cantidad, 10);

      // Obtener producto info
      const prod = await queryDb(env, "SELECT maneja_series, stock_actual, nombre FROM productos WHERE id = ?", [producto_id], true);
      if (!prod) {
        return errorResponse(`El producto con ID ${producto_id} no existe.`, 400);
      }

      if (prod.stock_actual < cantidad) {
        return errorResponse(`Stock insuficiente para el producto '${prod.nombre}'. Stock actual: ${prod.stock_actual}, Solicitado: ${cantidad}`, 400);
      }

      // Insert detalle
      statements.push(
        env.DB.prepare(`
          INSERT INTO prestamo_detalles (prestamo_id, producto_id, cantidad)
          VALUES (last_insert_rowid(), ?, ?)
        `).bind(producto_id, cantidad)
      );

      // Descontar stock
      statements.push(
        env.DB.prepare("UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?").bind(cantidad, producto_id)
      );

      // Si maneja series, verificar y actualizar
      if (prod.maneja_series === 1) {
        const seriesEnviadas = item.series || [];
        if (seriesEnviadas.length !== cantidad) {
          return errorResponse(`Debe enviar exactamente ${cantidad} series para el producto '${prod.nombre}'.`, 400);
        }

        for (const sn of seriesEnviadas) {
          const serie = await queryDb(
            env,
            "SELECT id FROM producto_series WHERE producto_id = ? AND numero_serie = ? AND estado = 'Disponible'",
            [producto_id, sn],
            true
          );
          if (!serie) {
            return errorResponse(`La serie '${sn}' del producto '${prod.nombre}' no está disponible.`, 400);
          }

          statements.push(
            env.DB.prepare(`
              UPDATE producto_series
              SET estado = 'Prestado', prestamo_id = last_insert_rowid()
              WHERE id = ?
            `).bind(serie.id)
          );
        }
      }
    }

    const batchResult = await env.DB.batch(statements);
    const prestamo_id = batchResult[0].meta.last_row_id;

    return jsonResponse({
      exito: true,
      prestamo_id,
      mensaje: "Préstamo registrado correctamente."
    });
  } catch (err) {
    return errorResponse(`Error al registrar préstamo: ${err.message}`, 400);
  }
}
