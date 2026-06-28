import { queryDb, executeDb, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const query = `
      SELECT o.*, 
             COALESCE(a.nombre_razon_social, o.cliente_nombre_manual) as cliente_nombre,
             a.documento_identidad as cliente_documento,
             a.telefono as cliente_telefono,
             ps.numero_serie as producto_serie_codigo
      FROM ordenes_servicio o
      LEFT JOIN actores a ON o.cliente_id = a.id
      LEFT JOIN producto_series ps ON o.producto_serie_id = ps.id
      ORDER BY o.fecha_ingreso DESC
    `;
    const ordenes = await queryDb(env, query);
    return jsonResponse(ordenes);
  } catch (err) {
    return errorResponse(`Error al obtener ordenes de soporte: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const cliente_id = data.cliente_id;
    const cliente_nombre_manual = (data.cliente_nombre_manual || "").trim();
    const producto_serie_id = data.producto_serie_id;
    const equipo_marca_modelo = (data.equipo_marca_modelo || "").trim();
    const numero_serie_externo = (data.numero_serie_externo || "").trim();
    const problema_reportado = (data.problema_reportado || "").trim();
    const costo_servicio = parseFloat(data.costo_servicio || 0.00);

    if (!equipo_marca_modelo || !problema_reportado) {
      return errorResponse("Faltan datos obligatorios (Equipo y Falla Reportada).", 400);
    }

    if (!cliente_id && !cliente_nombre_manual) {
      return errorResponse("Debe registrar un cliente o escribir un nombre para comprador/cliente manual.", 400);
    }

    const ordenId = await executeDb(
      env,
      `INSERT INTO ordenes_servicio (
         cliente_id, producto_serie_id, equipo_marca_modelo, numero_serie_externo,
         problema_reportado, estado, costo_servicio, total_pagar, cliente_nombre_manual
       ) VALUES (?, ?, ?, ?, ?, 'Recibido', ?, ?, ?)`,
      [
        cliente_id || null,
        producto_serie_id || null,
        equipo_marca_modelo,
        numero_serie_externo || null,
        problema_reportado,
        costo_servicio,
        costo_servicio,
        cliente_id ? null : cliente_nombre_manual
      ]
    );

    return jsonResponse({
      exito: true,
      id: ordenId,
      mensaje: "Orden de servicio creada con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al registrar orden de soporte: ${err.message}`, 400);
  }
}
