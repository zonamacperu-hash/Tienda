import { queryDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestGet(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const pagos = await queryDb(env, "SELECT * FROM venta_pagos WHERE venta_id = ?", [id]);
    return jsonResponse(pagos);
  } catch (err) {
    return errorResponse(`Error al obtener pagos de la venta: ${err.message}`, 500);
  }
}
