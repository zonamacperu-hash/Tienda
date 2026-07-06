import { queryDb, jsonResponse, errorResponse } from "../../_db.js";

export async function onRequestGet(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    // Accounts receivable (sales)
    const porCobrar = await queryDb(
      env,
      `SELECT c.*, v.serie_comprobante || '-' || v.correlativo_comprobante as documento, v.fecha_venta as fecha, v.moneda as moneda
       FROM cuentas_por_cobrar c
       JOIN ventas v ON c.venta_id = v.id
       WHERE c.cliente_id = ?
       ORDER BY c.fecha_vencimiento ASC`,
      [id]
    );

    // Accounts payable (purchases)
    const porPagar = await queryDb(
      env,
      `SELECT p.*, c.serie_comprobante || '-' || c.correlativo_comprobante as documento, c.fecha_compra as fecha, c.moneda as moneda
       FROM cuentas_por_pagar p
       JOIN compras c ON p.compra_id = c.id
       WHERE p.proveedor_id = ?
       ORDER BY p.fecha_vencimiento ASC`,
      [id]
    );

    return jsonResponse({
      por_cobrar: porCobrar,
      por_pagar: porPagar
    });
  } catch (err) {
    return errorResponse(`Error al obtener estado de cuenta: ${err.message}`, 500);
  }
}
