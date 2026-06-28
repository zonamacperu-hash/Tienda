import { queryDb, executeDb, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const formData = await request.formData();
    const file = formData.get("logo");

    if (!file || typeof file === "string" || file.size === 0) {
      return errorResponse("No se subió ningún archivo o archivo vacío.", 400);
    }

    const filename = file.name || "";
    const ext = filename.split(".").pop().toLowerCase();
    if (!["png", "jpg", "jpeg"].includes(ext)) {
      return errorResponse("Formato de archivo no permitido. Solo se aceptan JPG, JPEG y PNG.", 400);
    }

    // Convert file to Base64 Data URL
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Efficient chunked encoding to avoid call stack limits on large images
    let binary = "";
    const len = uint8Array.byteLength;
    const chunk = 8192;
    for (let i = 0; i < len; i += chunk) {
      binary += String.fromCharCode.apply(null, uint8Array.subarray(i, i + chunk));
    }
    const base64String = btoa(binary);
    const mimeType = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;
    const logoDataUrl = `data:${mimeType};base64,${base64String}`;

    const config = await queryDb(env, "SELECT id FROM configuracion_sistema LIMIT 1", [], true);

    if (config) {
      await executeDb(
        env,
        "UPDATE configuracion_sistema SET logo_path = ? WHERE id = ?",
        [logoDataUrl, config.id]
      );
    } else {
      await executeDb(
        env,
        "INSERT INTO configuracion_sistema (empresa_nombre, empresa_ruc, logo_path) VALUES ('Empresa por defecto', '00000000000', ?)",
        [logoDataUrl]
      );
    }

    return jsonResponse({
      exito: true,
      mensaje: "Logotipo actualizado con éxito.",
      logo_path: logoDataUrl
    });
  } catch (err) {
    return errorResponse(`Error al subir logotipo: ${err.message}`, 500);
  }
}

export async function onRequestDelete(context) {
  const { env } = context;
  try {
    await executeDb(
      env,
      "UPDATE configuracion_sistema SET logo_path = NULL WHERE id = (SELECT id FROM configuracion_sistema LIMIT 1)"
    );
    return jsonResponse({
      exito: true,
      mensaje: "Logotipo eliminado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al eliminar logotipo: ${err.message}`, 500);
  }
}
