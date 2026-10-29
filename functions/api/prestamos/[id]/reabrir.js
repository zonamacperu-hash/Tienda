import { queryDb, executeDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestPost(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const prestamo = await queryDb(env, "SELECT id, estado FROM prestamos_intertienda WHERE id = ?", [id], true);
    if (!prestamo) {
      return errorResponse(`El préstamo con ID ${id} no existe.`, 404);
    }

    // Cambiar estado a 'Devuelto Parcial'
    await executeDb(env, "UPDATE prestamos_intertienda SET estado = 'Devuelto Parcial' WHERE id = ?", [id]);

    return jsonResponse({
      exito: true,
      mensaje: `Préstamo #${id} reabierto con éxito. Ahora se encuentra en 'Préstamos Pendientes'.`
    });
  } catch (err) {
    return errorResponse(`Error al reabrir préstamo: ${err.message}`, 500);
  }
}
