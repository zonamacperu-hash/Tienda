import { executeDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestPut(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    // Run as a batch transaction in Cloudflare D1
    await env.DB.batch([
      env.DB.prepare("UPDATE ventas SET estado = 'Anulada' WHERE id = ?").bind(id),
      env.DB.prepare("DELETE FROM cuentas_por_cobrar WHERE venta_id = ?").bind(id),
      env.DB.prepare("DELETE FROM venta_pagos WHERE venta_id = ?").bind(id)
    ]);
    
    // SQLite trigger trg_venta_anulada will automatically restore stock and free physical series to 'Disponible'.
    return jsonResponse({
      exito: true,
      mensaje: "Venta Anulada con éxito. Stock y series físicas liberados."
    });
  } catch (err) {
    return errorResponse(`Error al anular venta: ${err.message}`, 400);
  }
}
