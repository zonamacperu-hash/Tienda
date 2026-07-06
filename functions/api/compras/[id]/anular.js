import { queryDb, executeDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestPut(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    // Validar si alguna de las series ingresadas ya fue vendida
    const seriesVendidas = await queryDb(
      env,
      "SELECT COUNT(*) as count FROM producto_series WHERE compra_id = ? AND estado != 'Disponible'",
      [id],
      true
    );

    if (seriesVendidas && seriesVendidas.count > 0) {
      return errorResponse(
        "No se puede anular la compra. Algunas de las series ingresadas ya han sido vendidas o movilizadas.",
        400
      );
    }

    // Run as a batch transaction in Cloudflare D1
    await env.DB.batch([
      env.DB.prepare("UPDATE compras SET estado = 'Anulada' WHERE id = ?").bind(id),
      env.DB.prepare("DELETE FROM cuentas_por_pagar WHERE compra_id = ?").bind(id)
    ]);
    
    // SQLite trigger trg_compra_anulada will automatically subtract stock and delete the entered series.
    return jsonResponse({
      exito: true,
      mensaje: "Compra anulada con éxito. Stock e inventario revertidos."
    });
  } catch (err) {
    return errorResponse(`Error al anular compra: ${err.message}`, 400);
  }
}
