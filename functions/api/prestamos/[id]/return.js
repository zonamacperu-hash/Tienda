import { queryDb, executeDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestPost(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const data = await request.json();
    const series_devueltas = data.series || []; // Array strings
    const tradicionales = data.productos_tradicionales || []; // Array dicts

    if (series_devueltas.length === 0 && tradicionales.length === 0) {
      return errorResponse("Debe especificar al menos un ítem para devolver.", 400);
    }

    // Validar préstamo
    const prestamo = await queryDb(env, "SELECT id, estado FROM prestamos_intertienda WHERE id = ?", [id], true);
    if (!prestamo) {
      return errorResponse(`El préstamo con ID ${id} no existe.`, 400);
    }

    const statements = [];

    // 1. Procesar series devueltas
    for (const sn of series_devueltas) {
      const serie = await queryDb(
        env,
        `SELECT id, producto_id, estado
         FROM producto_series
         WHERE prestamo_id = ? AND numero_serie = ? AND estado = 'Prestado'`,
        [id, sn],
        true
      );

      if (!serie) {
        return errorResponse(`La serie '${sn}' no pertenece a este préstamo o no está prestada.`, 400);
      }

      // Devolver a disponible y sumar stock
      statements.push(
        env.DB.prepare("UPDATE producto_series SET estado = 'Disponible', prestamo_id = NULL WHERE id = ?").bind(serie.id)
      );
      statements.push(
        env.DB.prepare("UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = ?").bind(serie.producto_id)
      );
    }

    // 2. Procesar tradicionales
    for (const t of tradicionales) {
      const prod_id = t.producto_id;
      const cant_ret = parseInt(t.cantidad || 0, 10);
      if (cant_ret <= 0) continue;

      const det = await queryDb(
        env,
        "SELECT id FROM prestamo_detalles WHERE prestamo_id = ? AND producto_id = ?",
        [id, prod_id],
        true
      );

      if (!det) {
        return errorResponse(`El producto con ID ${prod_id} no pertenece a este préstamo.`, 400);
      }

      // Sumar stock
      statements.push(
        env.DB.prepare("UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?").bind(cant_ret, prod_id)
      );
    }

    // 3. Evaluar estado general final del préstamo en la DB
    // Se ejecuta al final del batch
    statements.push(
      env.DB.prepare(`
        UPDATE prestamos_intertienda
        SET estado = CASE
          WHEN (SELECT COUNT(*) FROM producto_series WHERE prestamo_id = ? AND estado = 'Prestado') = 0
          THEN 'Devuelto'
          ELSE 'Devuelto Parcial'
        END
        WHERE id = ?
      `).bind(id, id)
    );

    await env.DB.batch(statements);

    return jsonResponse({
      exito: true,
      mensaje: "Devolución procesada con éxito. Stock de almacén restaurado."
    });
  } catch (err) {
    return errorResponse(`Error al procesar devolución: ${err.message}`, 400);
  }
}
