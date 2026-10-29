import { queryDb, executeDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestPost(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    // Asegurar que existan las columnas de seguimiento en prestamo_detalles
    try {
      await env.DB.prepare("ALTER TABLE prestamo_detalles ADD COLUMN cantidad_devuelta INTEGER DEFAULT 0").run();
    } catch (_) {}
    try {
      await env.DB.prepare("ALTER TABLE prestamo_detalles ADD COLUMN cantidad_vendida INTEGER DEFAULT 0").run();
    } catch (_) {}

    const data = await request.json();
    const series_devueltas = data.series || []; // Array strings
    const tradicionales = data.productos_tradicionales || []; // Array dicts: [{producto_id, cantidad}]

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
        "SELECT id, cantidad, COALESCE(cantidad_devuelta, 0) as cantidad_devuelta, COALESCE(cantidad_vendida, 0) as cantidad_vendida FROM prestamo_detalles WHERE prestamo_id = ? AND producto_id = ?",
        [id, prod_id],
        true
      );

      if (!det) {
        return errorResponse(`El producto con ID ${prod_id} no pertenece a este préstamo.`, 400);
      }

      const pendienteActual = det.cantidad - det.cantidad_devuelta - det.cantidad_vendida;
      if (cant_ret > pendienteActual) {
        return errorResponse(`No puede devolver más de la cantidad pendiente (${pendienteActual}) para el producto ID ${prod_id}.`, 400);
      }

      // Sumar stock
      statements.push(
        env.DB.prepare("UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?").bind(cant_ret, prod_id)
      );

      // Registrar cantidad devuelta
      statements.push(
        env.DB.prepare("UPDATE prestamo_detalles SET cantidad_devuelta = COALESCE(cantidad_devuelta, 0) + ? WHERE id = ?").bind(cant_ret, det.id)
      );
    }

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    // 3. Evaluar estado general final del préstamo en la DB
    const seriesPendientesRow = await queryDb(
      env,
      "SELECT COUNT(*) as cnt FROM producto_series WHERE prestamo_id = ? AND estado = 'Prestado'",
      [id],
      true
    );
    const numSeriesPendientes = seriesPendientesRow ? (seriesPendientesRow.cnt || 0) : 0;

    const tradicionalesPendientesRows = await queryDb(
      env,
      `SELECT (pd.cantidad - COALESCE(pd.cantidad_devuelta, 0) - COALESCE(pd.cantidad_vendida, 0)) as pendiente
       FROM prestamo_detalles pd
       JOIN productos p ON pd.producto_id = p.id
       WHERE pd.prestamo_id = ? AND p.maneja_series = 0`,
      [id]
    );

    let tradPendientes = 0;
    if (tradicionalesPendientesRows && tradicionalesPendientesRows.length > 0) {
      for (const row of tradicionalesPendientesRows) {
        if (row.pendiente > 0) {
          tradPendientes += row.pendiente;
        }
      }
    }

    const nuevoEstado = (numSeriesPendientes === 0 && tradPendientes === 0) ? 'Devuelto' : 'Devuelto Parcial';

    await executeDb(env, "UPDATE prestamos_intertienda SET estado = ? WHERE id = ?", [nuevoEstado, id]);

    return jsonResponse({
      exito: true,
      estado: nuevoEstado,
      mensaje: nuevoEstado === 'Devuelto'
        ? "Devolución completada en su totalidad. Stock de almacén restaurado."
        : "Devolución parcial procesada con éxito. El préstamo continúa activo con los ítems pendientes."
    });
  } catch (err) {
    return errorResponse(`Error al procesar devolución: ${err.message}`, 400);
  }
}
