import { queryDb, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const fecha_inicio = url.searchParams.get("fecha_inicio");
    const fecha_fin = url.searchParams.get("fecha_fin");
    const categoria_id = url.searchParams.get("categoria_id");
    const producto_id = url.searchParams.get("producto_id");
    const tipo_movimiento = url.searchParams.get("tipo_movimiento") || "Todos";
    const numero_serie = url.searchParams.get("numero_serie");
    const cliente_filtro = url.searchParams.get("cliente_filtro");

    const params_compras = [];
    const params_ventas = [];

    // 1. Filtros de Compras (Entradas)
    const where_compras = ["c.estado = 'Completada'"];
    if (cliente_filtro) {
      where_compras.push("1 = 0"); // Las compras no tienen cliente_filtro
    }
    if (fecha_inicio) {
      where_compras.push("date(c.fecha_compra) >= ?");
      params_compras.push(fecha_inicio);
    }
    if (fecha_fin) {
      where_compras.push("date(c.fecha_compra) <= ?");
      params_compras.push(fecha_fin);
    }
    if (categoria_id) {
      where_compras.push("p.categoria_id = ?");
      params_compras.push(parseInt(categoria_id, 10));
    }
    if (producto_id) {
      where_compras.push("p.id = ?");
      params_compras.push(parseInt(producto_id, 10));
    }
    if (numero_serie) {
      where_compras.push("ps.numero_serie LIKE ?");
      params_compras.push(`%${numero_serie}%`);
    }

    // 2. Filtros de Ventas (Salidas)
    const where_ventas = ["v.estado = 'Completada'"];
    if (cliente_filtro) {
      if (!isNaN(cliente_filtro)) {
        where_ventas.push("(v.cliente_id = ? OR act.nombre_razon_social LIKE ? OR v.cliente_nombre_manual LIKE ?)");
        const val = parseInt(cliente_filtro, 10);
        const txt = `%${cliente_filtro}%`;
        params_ventas.push(val, txt, txt);
      } else {
        where_ventas.push("(act.nombre_razon_social LIKE ? OR v.cliente_nombre_manual LIKE ?)");
        const txt = `%${cliente_filtro}%`;
        params_ventas.push(txt, txt);
      }
    }
    if (fecha_inicio) {
      where_ventas.push("date(v.fecha_venta) >= ?");
      params_ventas.push(fecha_inicio);
    }
    if (fecha_fin) {
      where_ventas.push("date(v.fecha_venta) <= ?");
      params_ventas.push(fecha_fin);
    }
    if (categoria_id) {
      where_ventas.push("p.categoria_id = ?");
      params_ventas.push(parseInt(categoria_id, 10));
    }
    if (producto_id) {
      where_ventas.push("p.id = ?");
      params_ventas.push(parseInt(producto_id, 10));
    }
    if (numero_serie) {
      where_ventas.push("ps.numero_serie LIKE ?");
      params_ventas.push(`%${numero_serie}%`);
    }

    // 3. Construir Queries
    const query_compras = `
      SELECT 
        c.fecha_compra AS fecha,
        'Entrada' AS tipo_movimiento,
        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.maneja_series AS maneja_series,
        cat.id AS categoria_id,
        cat.nombre AS categoria_nombre,
        CASE WHEN p.maneja_series = 1 THEN 1 ELSE cd.cantidad END AS cantidad,
        c.tipo_comprobante || ' ' || c.serie_comprobante || '-' || c.correlativo_comprobante AS documento,
        a.nombre_razon_social AS actor_nombre,
        c.moneda AS moneda,
        cd.precio_unitario AS precio_unitario,
        CASE WHEN p.maneja_series = 1 THEN ps.numero_serie ELSE NULL END AS numero_serie
      FROM compra_detalles cd
      JOIN compras c ON cd.compra_id = c.id
      JOIN productos p ON cd.producto_id = p.id
      LEFT JOIN categorias cat ON p.categoria_id = cat.id
      LEFT JOIN actores a ON c.proveedor_id = a.id
      LEFT JOIN producto_series ps ON p.maneja_series = 1 AND ps.compra_id = c.id AND ps.producto_id = p.id
      WHERE ${where_compras.join(" AND ")}
    `;

    const query_ventas = `
      SELECT 
        v.fecha_venta AS fecha,
        'Salida' AS tipo_movimiento,
        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.maneja_series AS maneja_series,
        cat.id AS categoria_id,
        cat.nombre AS categoria_nombre,
        CASE WHEN p.maneja_series = 1 THEN 1 ELSE vd.cantidad END AS cantidad,
        v.tipo_comprobante || ' ' || v.serie_comprobante || '-' || v.correlativo_comprobante AS documento,
        COALESCE(act.nombre_razon_social, v.cliente_nombre_manual) AS actor_nombre,
        v.moneda AS moneda,
        vd.precio_unitario AS precio_unitario,
        CASE WHEN p.maneja_series = 1 THEN ps.numero_serie ELSE NULL END AS numero_serie
      FROM venta_detalles vd
      JOIN ventas v ON vd.venta_id = v.id
      JOIN productos p ON vd.producto_id = p.id
      LEFT JOIN categorias cat ON p.categoria_id = cat.id
      LEFT JOIN actores act ON v.cliente_id = act.id
      LEFT JOIN producto_series ps ON p.maneja_series = 1 AND ps.venta_id = v.id AND ps.producto_id = p.id
      WHERE ${where_ventas.join(" AND ")}
    `;

    let sql;
    let params;
    if (tipo_movimiento === "Entrada") {
      sql = `SELECT * FROM (${query_compras}) ORDER BY fecha DESC`;
      params = params_compras;
    } else if (tipo_movimiento === "Salida") {
      sql = `SELECT * FROM (${query_ventas}) ORDER BY fecha DESC`;
      params = params_ventas;
    } else {
      sql = `SELECT * FROM (${query_compras} UNION ALL ${query_ventas}) ORDER BY fecha DESC`;
      params = params_compras.concat(params_ventas);
    }

    const movimientos = await queryDb(env, sql, params);
    return jsonResponse(movimientos);
  } catch (err) {
    return errorResponse(`Error al consultar kárdex: ${err.message}`, 400);
  }
}
