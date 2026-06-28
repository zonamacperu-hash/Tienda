import { queryDb, verifyPassword, jsonResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const testHash = "pbkdf2:sha256:1000000$V5TyWCO1CQbXuBOH$ad11d792785395148665676f5c7bd4c48fdcac23a9bbca61bb471365c7dc8a8a";
    let verificationResult = null;
    let verificationError = null;
    let derivedHex = null;
    let expectedHex = null;

    try {
      const parts = testHash.split('$');
      const algoParts = parts[0].split(':');
      const iterations = parseInt(algoParts[2], 10);
      const salt = parts[1];
      expectedHex = parts[2];
      
      const encoder = new TextEncoder();
      const passwordBytes = encoder.encode("admin123");
      const saltBytes = encoder.encode(salt);
      
      const baseKey = await crypto.subtle.importKey(
        "raw",
        passwordBytes,
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );
      
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: saltBytes,
          iterations: iterations,
          hash: "SHA-256"
        },
        baseKey,
        expectedHex.length * 4
      );
      
      derivedHex = Array.from(new Uint8Array(derivedBits))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
      verificationResult = (derivedHex === expectedHex);
    } catch (err) {
      verificationError = { message: err.message, stack: err.stack };
    }

    const users = await queryDb(env, "SELECT id, nombre, username, rol, activo, SUBSTR(password_hash, 1, 30) as hash_preview FROM usuarios");

    return jsonResponse({
      exito: true,
      test: {
        password: "admin123",
        hash: testHash,
        expectedHex,
        derivedHex,
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
