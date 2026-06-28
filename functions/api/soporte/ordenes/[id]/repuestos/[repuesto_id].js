import { executeDb, jsonResponse, errorResponse } from "../../../../_db.js";

export async function onRequestDelete(context) {
  const { params, env } = context;
  const id = params.id;
  const repuesto_id = params.repuesto_id;
  try {
    const statements = [];

    // 1. Eliminar repuesto
    statements.push(
      env.DB.prepare("DELETE FROM orden_servicio_repuestos WHERE id = ? AND orden_servicio_id = ?").bind(repuesto_id, id)
    );

    // 2. Recalcular total_pagar
    statements.push(
      env.DB.prepare(`
        UPDATE ordenes_servicio
        SET total_pagar = (
          COALESCE(costo_servicio, 0) + 
          (SELECT COALESCE(SUM(cantidad * precio_aplicado), 0) FROM orden_servicio_repuestos WHERE orden_servicio_id = ?)
        )
        WHERE id = ?
      `).bind(id, id)
    );

    await env.DB.batch(statements);

    return jsonResponse({
      exito: true,
      mensaje: "Repuesto eliminado e inventario reabastecido."
    });
  } catch (err) {
    return errorResponse(`Error al eliminar repuesto: ${err.message}`, 400);
  }
}
