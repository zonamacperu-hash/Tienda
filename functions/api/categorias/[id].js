import { queryDb, executeDb, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const data = await request.json();
    if (!data.nombre) {
      return errorResponse("El nombre de la categoría es obligatorio.", 400);
    }
    await executeDb(
      env,
      "UPDATE categorias SET nombre = ?, descripcion = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [data.nombre, data.descripcion || "", id]
    );
    return jsonResponse({
      exito: true,
      mensaje: "Categoría actualizada con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al actualizar categoría: ${err.message}`, 400);
  }
}

export async function onRequestDelete(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    // Validar si tiene productos
    const prodCount = await queryDb(
      env,
      "SELECT COUNT(*) as count FROM productos WHERE categoria_id = ?",
      [id],
      true
    );
    if (prodCount && prodCount.count > 0) {
      return errorResponse("No se puede eliminar una categoría que contiene productos vinculados.", 400);
    }

    await executeDb(env, "DELETE FROM categorias WHERE id = ?", [id]);
    return jsonResponse({
      exito: true,
      mensaje: "Categoría eliminada con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al eliminar categoría: ${err.message}`, 400);
  }
}
