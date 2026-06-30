import { queryDb, executeDb, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const query = `
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ORDER BY p.nombre ASC
    `;
    const prods = await queryDb(env, query);
    return jsonResponse(prods);
  } catch (err) {
    return errorResponse(`Error al obtener productos: ${err.message}`, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const moneda = data.moneda || 'PEN';
    if (!['PEN', 'USD'].includes(moneda)) {
      return errorResponse("Moneda inválida. Debe ser PEN o USD.", 400);
    }
    if (!data.nombre || !data.categoria_id) {
      return errorResponse("Faltan campos obligatorios (nombre, categoria_id).", 400);
    }

    const prodId = await executeDb(
      env,
      `INSERT INTO productos (
         categoria_id, nombre, descripcion, maneja_series, stock_minimo, stock_actual, precio_base, precio_mayorista, precio_final, moneda, detalles_tecnicos
       ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        data.categoria_id,
        data.nombre,
        data.descripcion || "",
        data.maneja_series ? 1 : 0,
        data.stock_minimo || 0,
        data.precio_base || 0.0,
        data.precio_mayorista || 0.0,
        data.precio_final || 0.0,
        moneda,
        data.detalles_tecnicos || ""
      ]
    );

    return jsonResponse({
      exito: true,
      id: prodId,
      mensaje: "Producto registrado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al crear producto: ${err.message}`, 400);
  }
}
