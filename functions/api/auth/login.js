import { queryDb, verifyPassword, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const username = (data.username || "").trim();
    const password = data.password;

    if (!username || !password) {
      return errorResponse("Faltan credenciales", 400);
    }

    const user = await queryDb(
      env,
      "SELECT * FROM usuarios WHERE username = ? AND activo = 1",
      [username],
      true
    );

    if (user && (await verifyPassword(password, user.password_hash))) {
      return jsonResponse({
        exito: true,
        usuario: {
          id: user.id,
          nombre: user.nombre,
          username: user.username,
          email: user.email,
          rol: user.rol
        }
      });
    }

    return errorResponse("Usuario o contraseña incorrectos", 401);
  } catch (err) {
    return errorResponse(`Error en el servidor: ${err.message}`, 500);
  }
}
