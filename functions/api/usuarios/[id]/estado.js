import { executeDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const data = await request.json();
    const activo = data.activo ? 1 : 0;

    await executeDb(env, "UPDATE usuarios SET activo = ? WHERE id = ?", [activo, id]);
    return jsonResponse({
      exito: true,
      mensaje: "Estado del colaborador actualizado."
    });
  } catch (err) {
    return errorResponse(`Error al actualizar estado: ${err.message}`, 400);
  }
}
