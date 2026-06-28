import { queryDb, executeDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestGet(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const queryOrden = `
      SELECT o.*, 
             COALESCE(a.nombre_razon_social, o.cliente_nombre_manual) as cliente_nombre,
             a.documento_identidad as cliente_documento,
             a.telefono as cliente_telefono,
             a.direccion as cliente_direccion,
             a.email as cliente_email,
             ps.numero_serie as producto_serie_codigo,
             ps.venta_id as serie_venta_id
      FROM ordenes_servicio o
      LEFT JOIN actores a ON o.cliente_id = a.id
      LEFT JOIN producto_series ps ON o.producto_serie_id = ps.id
      WHERE o.id = ?
    `;
    const orden = await queryDb(env, queryOrden, [id], true);
    if (!orden) {
      return errorResponse("Orden de servicio no encontrada.", 404);
    }

    const repuestos = await queryDb(
      env,
      `SELECT r.*, p.nombre as producto_nombre
       FROM orden_servicio_repuestos r
       JOIN productos p ON r.producto_id = p.id
       WHERE r.orden_servicio_id = ?`,
      [id]
    );

    return jsonResponse({
      exito: true,
      orden,
      repuestos
    });
  } catch (err) {
    return errorResponse(`Error al obtener orden de soporte: ${err.message}`, 500);
  }
}

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const data = await request.json();
    const diagnostico = data.diagnostico_tecnico;
    const estado = data.estado;
    const costo_servicio = parseFloat(data.costo_servicio || 0.00);
    const garantia_servicio_meses = parseInt(data.garantia_servicio_meses || 0, 10);

    if (!["Recibido", "En Diagnostico", "Reparado", "No Reparable", "Entregado"].includes(estado)) {
      return errorResponse("Estado inválido.", 400);
    }

    // Obtener costo de los repuestos cargados
    const repuestosSum = await queryDb(
      env,
      "SELECT SUM(cantidad * precio_aplicado) as sum FROM orden_servicio_repuestos WHERE orden_servicio_id = ?",
      [id],
      true
    );
    const totalRepuestos = parseFloat(repuestosSum?.sum || 0.00);
    const nuevoTotal = totalRepuestos + costo_servicio;

    await executeDb(
      env,
      `UPDATE ordenes_servicio
       SET diagnostico_tecnico = ?, estado = ?, costo_servicio = ?, 
           garantia_servicio_meses = ?, total_pagar = ?
       WHERE id = ?`,
      [diagnostico, estado, costo_servicio, garantia_servicio_meses, nuevoTotal, id]
    );

    return jsonResponse({
      exito: true,
      mensaje: "Orden de servicio actualizada con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al actualizar orden de soporte: ${err.message}`, 400);
  }
}
