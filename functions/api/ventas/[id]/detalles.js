import { queryDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestGet(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const query = `
      SELECT vd.*, p.nombre as producto_nombre, p.maneja_series
      FROM venta_detalles vd
      JOIN productos p ON vd.producto_id = p.id
      WHERE vd.venta_id = ?
    `;
    const detalles = await queryDb(env, query, [id]);

    for (const det of detalles) {
      if (det.maneja_series === 1) {
        const series = await queryDb(
          env,
          "SELECT numero_serie FROM producto_series WHERE venta_id = ? AND producto_id = ?",
          [id, det.producto_id]
        );
        det.series_vendidas = series.map(s => s.numero_serie);
      } else {
        det.series_vendidas = [];
      }
    }

    return jsonResponse(detalles);
  } catch (err) {
    return errorResponse(`Error al obtener detalles de la venta: ${err.message}`, 500);
  }
}
