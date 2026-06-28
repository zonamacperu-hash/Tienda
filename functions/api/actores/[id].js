import { queryDb, executeDb, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const data = await request.json();
    if (!data.tipo || !data.nombre_razon_social || !data.tipo_documento || !data.documento_identidad) {
      return errorResponse("Faltan campos obligatorios.", 400);
    }

    await executeDb(
      env,
      `UPDATE actores
       SET tipo = ?, nombre_razon_social = ?, tipo_documento = ?, 
           documento_identidad = ?, telefono = ?, email = ?, direccion = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.tipo,
        data.nombre_razon_social,
        data.tipo_documento,
        data.documento_identidad,
        data.telefono || "",
        data.email || "",
        data.direccion || "",
        id
      ]
    );

    return jsonResponse({
      exito: true,
      mensaje: "Datos actualizados con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al actualizar actor: ${err.message}`, 400);
  }
}

export async function onRequestDelete(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const comprasCount = await queryDb(
      env,
      "SELECT COUNT(*) as count FROM compras WHERE proveedor_id = ?",
      [id],
      true
    );
    const ventasCount = await queryDb(
      env,
      "SELECT COUNT(*) as count FROM ventas WHERE cliente_id = ?",
      [id],
      true
    );

    if ((comprasCount && comprasCount.count > 0) || (ventasCount && ventasCount.count > 0)) {
      return errorResponse("No se puede eliminar un cliente/proveedor con historial de transacciones.", 400);
    }

    await executeDb(env, "DELETE FROM actores WHERE id = ?", [id]);
    return jsonResponse({
      exito: true,
      mensaje: "Actor eliminado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al eliminar actor: ${err.message}`, 400);
  }
}
