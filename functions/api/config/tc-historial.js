import { queryDb, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const hist = await queryDb(
      env,
      `SELECT h.*, u.nombre as usuario_nombre
       FROM historial_tipo_cambio h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       ORDER BY h.created_at DESC`
    );
    return jsonResponse(hist);
  } catch (err) {
    return errorResponse(`Error al obtener historial de tipo de cambio: ${err.message}`, 500);
  }
}
