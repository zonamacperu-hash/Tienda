import { executeDb, queryDb, jsonResponse, errorResponse } from "../../../_db.js";

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const data = await request.json();
    const metodo_pago = data.metodo_pago;
    const garantia_servicio_meses = parseInt(data.garantia_servicio_meses || 0, 10);
    const diagnostico_tecnico = (data.diagnostico_tecnico || "").trim();
    const costo_servicio = parseFloat(data.costo_servicio || 0.00);

    if (!metodo_pago) {
      return errorResponse("Debe especificar un método de pago.", 400);
    }

    const statements = [];

    // Hacemos el cálculo en el batch
    statements.push(
      env.DB.prepare(`
        UPDATE ordenes_servicio
        SET estado = 'Entregado',
            fecha_entrega = datetime('now', 'localtime'),
            metodo_pago = ?,
            garantia_servicio_meses = ?,
            diagnostico_tecnico = ?,
            costo_servicio = ?,
            total_pagar = (
              ? + 
              (SELECT COALESCE(SUM(cantidad * precio_aplicado), 0) FROM orden_servicio_repuestos WHERE orden_servicio_id = ?)
            )
        WHERE id = ?
      `).bind(
        metodo_pago,
        garantia_servicio_meses,
        diagnostico_tecnico,
        costo_servicio,
        costo_servicio,
        id,
        id
      )
    );

    await env.DB.batch(statements);

    return jsonResponse({
      exito: true,
      mensaje: "Equipo entregado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al entregar equipo: ${err.message}`, 400);
  }
}
