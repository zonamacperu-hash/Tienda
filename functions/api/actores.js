import { queryDb, executeDb, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const tipo = url.searchParams.get("tipo");
    
    let actors;
    if (tipo) {
      actors = await queryDb(
        env,
        "SELECT * FROM actores WHERE tipo = ? OR tipo = 'Ambos' ORDER BY nombre_razon_social ASC",
        [tipo]
      );
    } else {
      actors = await queryDb(env, "SELECT * FROM actores ORDER BY nombre_razon_social ASC");
    }
    return jsonResponse(actors);
  } catch (err) {
    return errorResponse(`Error al obtener actores: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    if (!data.tipo || !data.nombre_razon_social || !data.tipo_documento || !data.documento_identidad) {
      return errorResponse("Faltan campos obligatorios para registrar el actor.", 400);
    }

    const actorId = await executeDb(
      env,
      `INSERT INTO actores (
         tipo, nombre_razon_social, tipo_documento, documento_identidad, telefono, email, direccion
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.tipo,
        data.nombre_razon_social,
        data.tipo_documento,
        data.documento_identidad,
        data.telefono || "",
        data.email || "",
        data.direccion || ""
      ]
    );

    return jsonResponse({
      exito: true,
      id: actorId,
      mensaje: "Actor registrado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al registrar actor: ${err.message}`, 400);
  }
}
