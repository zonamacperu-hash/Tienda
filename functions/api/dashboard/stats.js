import { queryDb, jsonResponse, errorResponse } from "../_db.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    // 1. Ventas del día (en PEN y USD)
    const ventasHoy = await queryDb(
      env,
      `SELECT COALESCE(SUM(total), 0) as total_ventas, moneda
       FROM ventas
       WHERE date(fecha_venta) = date('now') AND estado = 'Completada'
       GROUP BY moneda`
    );

    // 2. Compras del MES (PEN y USD)
    const comprasMes = await queryDb(
      env,
      `SELECT COALESCE(SUM(total), 0) as total_compras, moneda
       FROM compras
       WHERE strftime('%Y-%m', fecha_compra) = strftime('%Y-%m', 'now') AND estado = 'Completada'
       GROUP BY moneda`
    );

    // 3. Cantidad de Clientes Activos
    const clientesActivos = await queryDb(
      env,
      `SELECT COUNT(*) as total
       FROM actores
       WHERE (tipo = 'Cliente' OR tipo = 'Ambos')`,
      [],
      true
    );

    // 4. Productos bajo stock mínimo
    const bajoStock = await queryDb(
      env,
      `SELECT id, nombre, stock_actual, stock_minimo, maneja_series
       FROM productos
       WHERE stock_actual <= stock_minimo
       ORDER BY stock_actual ASC`
    );

    // 5. Ventas mensuales de los últimos 6 meses (para el gráfico de tendencia)
    const graficoVentas = await queryDb(
      env,
      `SELECT strftime('%Y-%m', fecha_venta) as mes, SUM(total) as total, moneda
       FROM ventas
       WHERE estado = 'Completada'
       GROUP BY mes, moneda
       ORDER BY mes DESC
       LIMIT 12`
    );

    // 6. Cálculo de Utilidades (Ventas precio cobrado vs precio base/costo de productos)
    const utilidadQuery = `
      SELECT 
        v.moneda,
        SUM(vd.subtotal) as total_cobrado,
        SUM(vd.cantidad * p.precio_base / (CASE WHEN v.moneda = 'USD' THEN v.tipo_cambio ELSE 1.0 END)) as costo_total
      FROM venta_detalles vd
      JOIN ventas v ON vd.venta_id = v.id
      JOIN productos p ON vd.producto_id = p.id
      WHERE v.estado = 'Completada'
      GROUP BY v.moneda
    `;
    const utilidades = await queryDb(env, utilidadQuery);

    // 7. Últimas 5 ventas realizadas
    const ventasRecientes = await queryDb(
      env,
      `SELECT v.id, COALESCE(a.nombre_razon_social, v.cliente_nombre_manual) as cliente_nombre, 
              v.tipo_comprobante || ' ' || v.serie_comprobante || '-' || v.correlativo_comprobante as documento, 
              v.total, v.moneda, v.fecha_venta, v.estado
       FROM ventas v
       LEFT JOIN actores a ON v.cliente_id = a.id
       ORDER BY v.fecha_venta DESC
       LIMIT 5`
    );

    // 8. Categorías más vendidas (para el gráfico Donut)
    const categoriasVendidas = await queryDb(
      env,
      `SELECT c.nombre as categoria, SUM(vd.cantidad) as total_vendido
       FROM venta_detalles vd
       JOIN productos p ON vd.producto_id = p.id
       JOIN categorias c ON p.categoria_id = c.id
       JOIN ventas v ON vd.venta_id = v.id
       WHERE v.estado = 'Completada'
       GROUP BY c.nombre
       ORDER BY total_vendido DESC
       LIMIT 5`
    );

    const resVentas = { PEN: 0.0, USD: 0.0 };
    for (const v of ventasHoy) {
      resVentas[v.moneda] = parseFloat(v.total_ventas);
    }

    const resComprasMes = { PEN: 0.0, USD: 0.0 };
    for (const c of comprasMes) {
      resComprasMes[c.moneda] = parseFloat(c.total_compras);
    }

    const resUtilidad = { PEN: 0.0, USD: 0.0 };
    for (const ut of utilidades) {
      const moneda = ut.moneda;
      const ganancia = parseFloat(ut.total_cobrado) - parseFloat(ut.costo_total);
      resUtilidad[moneda] = Math.round(ganancia * 100) / 100;
    }

    return jsonResponse({
      ventas_hoy: resVentas,
      compras_mes: resComprasMes,
      clientes_activos: clientesActivos ? clientesActivos.total : 0,
      bajo_stock: bajoStock,
      grafico_ventas: graficoVentas,
      utilidades: resUtilidad,
      ventas_recientes: ventasRecientes,
      categorias_vendidas: categoriasVendidas
    });
  } catch (err) {
    return errorResponse(`Error al obtener estadísticas del dashboard: ${err.message}`, 500);
  }
}
