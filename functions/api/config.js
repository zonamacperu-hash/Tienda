import { queryDb, executeDb, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const config = await queryDb(env, "SELECT * FROM configuracion_sistema LIMIT 1", [], true);
    return jsonResponse(config || {});
  } catch (err) {
    return errorResponse(`Error al obtener configuración: ${err.message}`, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const usuario_id = data.usuario_id || 1;
    const nuevo_tc = parseFloat(data.tipo_cambio_actual || 3.7500);

    const configExistente = await queryDb(env, "SELECT * FROM configuracion_sistema LIMIT 1", [], true);

    if (configExistente) {
      const tcAnterior = parseFloat(configExistente.tipo_cambio_actual);

      await executeDb(
        env,
        `UPDATE configuracion_sistema
         SET empresa_nombre = ?, empresa_ruc = ?, empresa_direccion = ?,
             empresa_telefono = ?, empresa_email = ?, moneda_defecto = ?,
             tipo_cambio_actual = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.empresa_nombre,
          data.empresa_ruc,
          data.empresa_direccion,
          data.empresa_telefono,
          data.empresa_email,
          data.moneda_defecto || 'PEN',
          nuevo_tc,
          configExistente.id
        ]
      );

      if (nuevo_tc !== tcAnterior) {
        await executeDb(
          env,
          "INSERT OR REPLACE INTO historial_tipo_cambio (fecha, tipo_cambio, usuario_id) VALUES (date('now'), ?, ?)",
          [nuevo_tc, usuario_id]
        );
      }
    } else {
      await executeDb(
        env,
        `INSERT INTO configuracion_sistema (
           empresa_nombre, empresa_ruc, empresa_direccion, empresa_telefono,
           empresa_email, moneda_defecto, tipo_cambio_actual
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.empresa_nombre,
          data.empresa_ruc,
          data.empresa_direccion,
          data.empresa_telefono,
          data.empresa_email,
          data.moneda_defecto || 'PEN',
          nuevo_tc
        ]
      );

      await executeDb(
        env,
        "INSERT OR REPLACE INTO historial_tipo_cambio (fecha, tipo_cambio, usuario_id) VALUES (date('now'), ?, ?)",
        [nuevo_tc, usuario_id]
      );
    }

    return jsonResponse({ exito: true, mensaje: "Configuración actualizada con éxito." });
  } catch (err) {
    return errorResponse(`Error al actualizar configuración: ${err.message}`, 500);
  }
}
