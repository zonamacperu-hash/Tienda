import { queryDb, executeDb, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const cats = await queryDb(env, "SELECT * FROM categorias ORDER BY nombre ASC");
    return jsonResponse(cats);
  } catch (err) {
    return errorResponse(`Error al obtener categorías: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    if (!data.nombre) {
      return errorResponse("El nombre de la categoría es obligatorio.", 400);
    }
    const catId = await executeDb(
      env,
      "INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)",
      [data.nombre, data.descripcion || ""]
    );
    return jsonResponse({
      exito: true,
      id: catId,
      mensaje: "Categoría creada con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al crear categoría: ${err.message}`, 400);
  }
}
