import { queryDb, verifyPassword, jsonResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const testHash = "pbkdf2:sha256:1000000$V5TyWCO1CQbXuBOH$ad11d792785395148665676f5c7bd4c48fdcac23a9bbca61bb471365c7dc8a8a";
    let verificationResult = null;
    let verificationError = null;

    try {
      verificationResult = await verifyPassword("admin123", testHash);
    } catch (err) {
      verificationError = { message: err.message, stack: err.stack };
    }

    const users = await queryDb(env, "SELECT id, nombre, username, rol, activo, SUBSTR(password_hash, 1, 30) as hash_preview FROM usuarios");

    return jsonResponse({
      exito: true,
      test: {
        password: "admin123",
        hash: testHash,
        result: verificationResult,
        error: verificationError
      },
      users
    });
  } catch (err) {
    return jsonResponse({
      exito: false,
      error: err.message
    });
  }
}
