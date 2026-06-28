import { queryDb, executeDb, jsonResponse, errorResponse } from "./_db.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const tipo = data.tipo; // 'cobrar' o 'pagar'
    const ref_id = data.referencia_id; // venta_id (cobrar) o compra_id (pagar)
    const monto_abono = parseFloat(data.monto_abono || 0.0);

    if (monto_abono <= 0) {
      return errorResponse("El monto del abono debe ser mayor a cero.", 400);
    }

    if (tipo === 'cobrar') {
      const cuenta = await queryDb(
        env,
        "SELECT id, monto_total, monto_pagado FROM cuentas_por_cobrar WHERE venta_id = ?",
        [ref_id],
        true
      );
      if (!cuenta) {
        return errorResponse("No se encontró una cuenta por cobrar pendiente para esta venta.", 400);
      }

      const { id: cuenta_id, monto_total, monto_pagado } = cuenta;
      const nuevo_pagado = monto_pagado + monto_abono;

      if (nuevo_pagado > monto_total + 0.01) {
        return errorResponse(`El abono excede el saldo pendiente. Saldo actual: ${(monto_total - monto_pagado).toFixed(2)}`, 400);
      }

      const nuevo_estado = Math.abs(nuevo_pagado - monto_total) < 0.01 || nuevo_pagado >= monto_total ? 'Pagado' : 'Pendiente';

      await executeDb(
        env,
        "UPDATE cuentas_por_cobrar SET monto_pagado = ?, estado = ? WHERE id = ?",
        [nuevo_pagado, nuevo_estado, cuenta_id]
      );
    } else if (tipo === 'pagar') {
      const cuenta = await queryDb(
        env,
        "SELECT id, monto_total, monto_pagado FROM cuentas_por_pagar WHERE compra_id = ?",
        [ref_id],
        true
      );
      if (!cuenta) {
        return errorResponse("No se encontró una cuenta por pagar pendiente para esta compra.", 400);
      }

      const { id: cuenta_id, monto_total, monto_pagado } = cuenta;
      const nuevo_pagado = monto_pagado + monto_abono;

      if (nuevo_pagado > monto_total + 0.01) {
        return errorResponse(`El abono excede el saldo pendiente. Saldo actual: ${(monto_total - monto_pagado).toFixed(2)}`, 400);
      }

      const nuevo_estado = Math.abs(nuevo_pagado - monto_total) < 0.01 || nuevo_pagado >= monto_total ? 'Pagado' : 'Pendiente';

      await executeDb(
        env,
        "UPDATE cuentas_por_pagar SET monto_pagado = ?, estado = ? WHERE id = ?",
        [nuevo_pagado, nuevo_estado, cuenta_id]
      );
    } else {
      return errorResponse("Tipo de abono inválido.", 400);
    }

    return jsonResponse({
      exito: true,
      mensaje: "Abono registrado con éxito."
    });
  } catch (err) {
    return errorResponse(`Error al registrar abono: ${err.message}`, 400);
  }
}
