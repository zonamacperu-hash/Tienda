import { queryDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestGet(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const series = await queryDb(
      env,
      "SELECT * FROM producto_series WHERE producto_id = ? ORDER BY numero_serie ASC",
      [id]
    );
    return jsonResponse(series);
  } catch (err) {
    return errorResponse(`Error al obtener series del producto: ${err.message}`, 500);
  }
}
