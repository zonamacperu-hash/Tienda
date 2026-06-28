export async function queryDb(env, sql, args = [], one = false) {
  const stmt = env.DB.prepare(sql).bind(...args);
  const { results } = await stmt.all();
  if (one) {
    return results[0] || null;
  }
  return results;
}

export async function executeDb(env, sql, args = []) {
  const stmt = env.DB.prepare(sql).bind(...args);
  const result = await stmt.run();
  return result.meta.last_row_id || null;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ exito: false, mensaje: message }, status);
}

// Password Verification using native Web Crypto API (matches pbkdf2:sha256:1000000$salt$hash format)
export async function verifyPassword(password, passwordHash) {
  const parts = passwordHash.split('$');
  if (parts.length !== 3) {
    return false;
  }
  const algoParts = parts[0].split(':');
  if (algoParts[0] !== 'pbkdf2' || algoParts[1] !== 'sha256') {
    return false;
  }
  const iterations = parseInt(algoParts[2], 10);
  const salt = parts[1];
  const expectedHex = parts[2];
  
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = encoder.encode(salt);
  
  try {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      passwordBytes,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    
    const keyLengthBits = expectedHex.length * 4;
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: iterations,
        hash: "SHA-256"
      },
      baseKey,
      keyLengthBits
    );
    
    const derivedHex = Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    return derivedHex === expectedHex;
  } catch (err) {
    console.error("Password verification error:", err);
    return false;
  }
}

// Password Hashing using native Web Crypto API
export async function hashPassword(password) {
  const saltLength = 16;
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let salt = '';
  for (let i = 0; i < saltLength; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = encoder.encode(salt);
  const iterations = 1000000;
  
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
    256 // 32 bytes
  );
  
  const derivedHex = Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return `pbkdf2:sha256:${iterations}$${salt}$${derivedHex}`;
}
