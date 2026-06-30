import { queryDb, executeDb, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const data = await request.json();
    const moneda = data.moneda || 'PEN';
    if (!['PEN', 'USD'].includes(moneda)) {
      return errorResponse("Moneda inválida. Debe ser PEN o USD.", 400);
    }
    if (!data.nombre || !data.categoria_id) {
      return errorResponse("Faltan campos obligatorios (nombre, categoria_id).", 400);
    }

    await executeDb(
      env,
      `UPDATE productos 
       SET categoria_id = ?, nombre = ?, descripcion = ?, stock_minimo = ?,
           precio_base = ?, precio_mayorista = ?, precio_final = ?, moneda = ?, detalles_tecnicos = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.categoria_id,
        data.nombre,
        data.descripcion || "",
        data.stock_minimo || 0,
        data.precio_base || 0.0,
        data.precio_mayorista || 0.0,
        data.precio_final || 0.0,
        moneda,
        data.detalles_tecnicos || "",
        id
      ]
    );

    return jsonResponse({
      exito: true,
      mensaje: "Producto actualizado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al actualizar producto: ${err.message}`, 400);
  }
}

export async function onRequestDelete(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const detCompras = await queryDb(
      env,
      "SELECT COUNT(*) as count FROM compra_detalles WHERE producto_id = ?",
      [id],
      true
    );
    const detVentas = await queryDb(
      env,
      "SELECT COUNT(*) as count FROM venta_detalles WHERE producto_id = ?",
      [id],
      true
    );

    if ((detCompras && detCompras.count > 0) || (detVentas && detVentas.count > 0)) {
      return errorResponse("No se puede eliminar un producto con historial de compras o ventas.", 400);
    }

    // Delete associated physical series and then the product itself
    await executeDb(env, "DELETE FROM producto_series WHERE producto_id = ?", [id]);
    await executeDb(env, "DELETE FROM productos WHERE id = ?", [id]);

    return jsonResponse({
      exito: true,
      mensaje: "Producto eliminado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al eliminar producto: ${err.message}`, 400);
  }
}
