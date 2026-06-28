import { queryDb, executeDb, hashPassword, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const users = await queryDb(
      env,
      "SELECT id, nombre, username, email, rol, activo FROM usuarios ORDER BY nombre ASC"
    );
    return jsonResponse(users);
  } catch (err) {
    return errorResponse(`Error al obtener colaboradores: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const nombre = data.nombre;
    const username = data.username;
    const email = data.email;
    const password = data.password;
    const rol = data.rol;

    if (!nombre || !username || !email || !password || !rol) {
      return errorResponse("Faltan datos obligatorios.", 400);
    }

    const pwdHash = await hashPassword(password);
    const userId = await executeDb(
      env,
      "INSERT INTO usuarios (nombre, username, email, password_hash, rol, activo) VALUES (?, ?, ?, ?, ?, 1)",
      [nombre, username, email, pwdHash, rol]
    );

    return jsonResponse({
      exito: true,
      id: userId,
      mensaje: "Colaborador registrado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al registrar colaborador: ${err.message}`, 400);
  }
}
