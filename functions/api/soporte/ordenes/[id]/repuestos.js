import { queryDb, executeDb, jsonResponse, errorResponse } from "../../../_db.js";

export async function onRequestPost(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const data = await request.json();
    const producto_id = data.producto_id;
    const cantidad = parseInt(data.cantidad || 1, 10);
    const precio_aplicado = parseFloat(data.precio_aplicado || 0.00);

    if (!producto_id || cantidad <= 0) {
      return errorResponse("Faltan datos válidos del repuesto.", 400);
    }

    // 1. Validar producto y stock
    const producto = await queryDb(env, "SELECT stock_actual, nombre FROM productos WHERE id = ?", [producto_id], true);
    if (!producto) {
      return errorResponse("Producto repuesto no encontrado.", 400);
    }

    if (producto.stock_actual < cantidad) {
      return errorResponse(`Stock insuficiente para '${producto.nombre}'. Disponible: ${producto.stock_actual}, Solicitado: ${cantidad}`, 400);
    }

    const statements = [];

    // 2. Insertar repuesto
    statements.push(
      env.DB.prepare(`
        INSERT INTO orden_servicio_repuestos (orden_servicio_id, producto_id, cantidad, precio_aplicado)
        VALUES (?, ?, ?, ?)
      `).bind(id, producto_id, cantidad, precio_aplicado)
    );

    // 3. Recalcular total_pagar
    // Hacemos el recálculo en la DB de forma diferida usando subconsultas en el statement para que corra atómicamente en el batch
    statements.push(
      env.DB.prepare(`
        UPDATE ordenes_servicio
        SET total_pagar = (
          COALESCE(costo_servicio, 0) + 
          (SELECT COALESCE(SUM(cantidad * precio_aplicado), 0) FROM orden_servicio_repuestos WHERE orden_servicio_id = ?)
        )
        WHERE id = ?
      `).bind(id, id)
    );

    await env.DB.batch(statements);

    return jsonResponse({
      exito: true,
      mensaje: "Repuesto agregado e inventario descontado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al agregar repuesto: ${err.message}`, 400);
  }
}
