import { executeDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestPut(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    await executeDb(env, "UPDATE ventas SET estado = 'Anulada' WHERE id = ?", [id]);
    
    // SQLite trigger trg_venta_anulada will automatically restore stock and free physical series to 'Disponible'.
    return jsonResponse({
      exito: true,
      mensaje: "Venta anulada con éxito. Stock y series físicas liberados."
    });
  } catch (err) {
    return errorResponse(`Error al anular venta: ${err.message}`, 400);
  }
}
