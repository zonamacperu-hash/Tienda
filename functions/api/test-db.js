import { queryDb, jsonResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const configCount = await queryDb(env, "SELECT COUNT(*) as count FROM configuracion_sistema");
    const users = await queryDb(env, "SELECT id, nombre, username, rol, activo, SUBSTR(password_hash, 1, 30) as hash_preview FROM usuarios");
    
    return jsonResponse({
      exito: true,
      configCount,
      users
    });
  } catch (err) {
    return jsonResponse({
      exito: false,
      error: err.message
    });
  }
}
