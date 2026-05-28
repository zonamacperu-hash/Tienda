import os
import sqlite3
from .database import transaction, query_db

def procesar_venta_transaccional(datos_venta):
    """
    Procesa una venta multi-producto de manera transaccional y robusta.
    
    Estructura esperada de datos_venta:
    {
        "cliente_id": int,
        "usuario_id": int,
        "tipo_comprobante": str ("Factura" | "Boleta" | "Ticket" | "Guia de Remision"),
        "moneda": str ("PEN" | "USD"),
        "condicion_pago": str ("Contado" | "Credito"),
        "fecha_vencimiento": str (YYYY-MM-DD, opcional),
        "observaciones": str (opcional),
        "items": [
            {
                "producto_id": int,
                "cantidad": int,
                "tipo_precio": str ("Base" | "Final" | "Manual"),
                "precio_manual": float (opcional),
                "series_seleccionadas": list[str] (opcional),
                "meses_garantia": int
            }
        ]
    }
    """
    
    # 1. Obtener Tipo de Cambio (TC) actual del sistema
    config = query_db("SELECT tipo_cambio_actual FROM configuracion_sistema LIMIT 1", one=True)
    if not config:
        raise ValueError("No se ha configurado el sistema ni el tipo de cambio del día.")
    tipo_cambio = float(config['tipo_cambio_actual'])

    # 2. Iniciar Transacción utilizando el context manager
    with transaction() as cursor:
        
        # Validar Cliente
        cliente_id = datos_venta.get('cliente_id')
        cliente_nombre_manual = None
        tipo_comprobante = datos_venta.get('tipo_comprobante')

        if cliente_id in (None, 0, "", "0", "None"):
            cliente_id = None
            cliente_nombre_manual = datos_venta.get('cliente_nombre_manual', '').strip()
            if not cliente_nombre_manual:
                raise ValueError("Debe ingresar el nombre del comprador para el registro manual (Comprador Invitado).")
            if tipo_comprobante == "Factura":
                raise ValueError("Las facturas requieren obligatoriamente un cliente registrado con RUC.")
            if datos_venta.get('condicion_pago') == "Credito":
                raise ValueError("Las ventas al crédito requieren obligatoriamente un cliente registrado para control de cuentas por cobrar.")
        else:
            cliente = cursor.execute(
                "SELECT id, nombre_razon_social, tipo_documento, documento_identidad FROM actores WHERE id = ? AND (tipo = 'Cliente' OR tipo = 'Ambos')", 
                (cliente_id,)
            ).fetchone()
            if not cliente:
                raise ValueError(f"El cliente con ID {cliente_id} no existe o no es un cliente válido.")
            
            # Validar RUC para Facturas
            if tipo_comprobante == "Factura":
                doc_tipo = cliente[2]
                doc_num = (cliente[3] or "").strip()
                if doc_tipo != "RUC":
                    raise ValueError(f"El cliente seleccionado no cuenta con RUC (tipo registrado: {doc_tipo}). Las facturas exigen RUC obligatoriamente.")
                if len(doc_num) != 11 or not doc_num.startswith(("10", "20")) or not doc_num.isdigit():
                    raise ValueError("El RUC del cliente registrado no es válido. Debe tener 11 dígitos numéricos y comenzar con 10 o 20.")

        # Validar Usuario/Vendedor
        usuario = cursor.execute(
            "SELECT id, nombre, rol, activo FROM usuarios WHERE id = ?", 
            (datos_venta['usuario_id'],)
        ).fetchone()
        if not usuario or usuario[3] == 0:  # usuario[3] es 'activo'
            raise ValueError("El usuario/vendedor no está activo en el sistema.")
        
        usuario_rol = usuario[2] # 'rol'

        venta_subtotal = 0.00
        detalles_a_insertar = []
        series_a_actualizar = []

        # 3. Iterar y procesar cada ítem del carrito
        for item in datos_venta['items']:
            producto_id = item['producto_id']
            cantidad = int(item['cantidad'])
            tipo_precio = item['tipo_precio']
            meses_garantia = int(item.get('meses_garantia', 0))
            
            # Consultar y bloquear producto (SQLite no bloquea filas individuales con FOR UPDATE, 
            # pero la transacción atómica a nivel de conexión asegura exclusión mutua durante el COMMIT).
            producto = cursor.execute(
                "SELECT id, nombre, maneja_series, stock_actual, precio_base, precio_final FROM productos WHERE id = ?",
                (producto_id,)
            ).fetchone()
            
            if not producto:
                raise ValueError(f"El producto con ID {producto_id} no existe.")
            
            prod_id, prod_nombre, prod_maneja_series, prod_stock, prod_precio_base, prod_precio_final = producto

            # A. VALIDAR NÚMEROS DE SERIE
            if prod_maneja_series == 1:
                series_enviadas = item.get('series_seleccionadas', [])
                if len(series_enviadas) != cantidad:
                    raise ValueError(
                        f"Debe seleccionar exactamente {cantidad} número(s) de serie para el producto '{prod_nombre}'."
                    )

                for numero_serie in series_enviadas:
                    # Validar si la serie física existe y está disponible
                    serie_fisica = cursor.execute(
                        "SELECT id FROM producto_series WHERE producto_id = ? AND numero_serie = ? AND estado = 'Disponible'",
                        (prod_id, numero_serie)
                    ).fetchone()

                    if not serie_fisica:
                        raise ValueError(
                            f"La serie '{numero_serie}' del producto '{prod_nombre}' no está disponible o ya fue vendida."
                        )

                    # Registrar serie para actualizar su estado al final
                    series_a_actualizar.append({
                        "serie_id": serie_fisica[0],
                        "meses_garantia": meses_garantia
                    })
            else:
                # Validar stock para productos que no manejan series
                if prod_stock < cantidad:
                    raise ValueError(
                        f"Stock insuficiente para el producto '{prod_nombre}'. Disponible: {prod_stock}, Solicitado: {cantidad}"
                    )

            # B. VALIDAR Y CALCULAR PRECIO UNITARIO
            precio_unitario_base_moneda_original = 0.00
            
            if tipo_precio == "Base":
                precio_unitario_base_moneda_original = prod_precio_base
            elif tipo_precio == "Final":
                precio_unitario_base_moneda_original = prod_precio_final
            elif tipo_precio == "Manual":
                # Restringir precio manual solo a Administrador
                precio_manual = float(item.get('precio_manual', 0.0))
                if usuario_rol != "Administrador" and precio_manual != prod_precio_final:
                    raise ValueError(f"No tiene permisos de administrador para alterar el precio de venta del producto '{prod_nombre}' de manera manual.")
                precio_unitario_base_moneda_original = precio_manual
            else:
                raise ValueError(f"Tipo de precio '{tipo_precio}' no es válido.")

            # CONVERSIÓN DE TIPO DE CAMBIO
            # Asumimos que los precios del catálogo en la base de datos están almacenados en SOLES (PEN).
            # Si la transacción es en DÓLARES (USD), dividimos el precio entre el TC del día.
            precio_unitario_transaccion = precio_unitario_base_moneda_original
            if datos_venta['moneda'] == "USD":
                precio_unitario_transaccion = precio_unitario_base_moneda_original / tipo_cambio

            item_subtotal = precio_unitario_transaccion * cantidad
            venta_subtotal += item_subtotal

            detalles_a_insertar.append({
                "producto_id": prod_id,
                "cantidad": cantidad,
                "tipo_precio": tipo_precio,
                "precio_unitario": precio_unitario_transaccion,
                "meses_garantia": meses_garantia,
                "subtotal": item_subtotal
            })

        # 4. CALCULAR IMPUESTOS (IGV 18% incluido en el total)
        venta_total = venta_subtotal
        if tipo_comprobante == "Factura":
            subtotal_sin_igv = venta_total / 1.18
            venta_igv = venta_total - subtotal_sin_igv
        else:
            # Boleta o Ticket
            subtotal_sin_igv = venta_total
            venta_igv = 0.00

        # 5. OBTENER Y ACTUALIZAR EL CORRELATIVO DEL COMPROBANTE
        tipo_comprobante = datos_venta['tipo_comprobante']
        secuencia = cursor.execute(
            "SELECT serie, correlativo_actual FROM secuencias_comprobante WHERE tipo = ?",
            (tipo_comprobante,)
        ).fetchone()
        
        if not secuencia:
            raise ValueError(f"No se ha configurado una serie/correlativo para el comprobante tipo '{tipo_comprobante}'.")
        
        serie_comprobante, correlativo_actual = secuencia
        nuevo_correlativo = correlativo_actual + 1
        correlativo_str = str(nuevo_correlativo).zfill(8)

        # Actualizar secuencia
        cursor.execute(
            "UPDATE secuencias_comprobante SET correlativo_actual = ? WHERE tipo = ?",
            (nuevo_correlativo, tipo_comprobante)
        )

        # 6. REGISTRAR CABECERA DE LA VENTA
        cursor.execute(
            """
            INSERT INTO ventas (
                cliente_id, usuario_id, tipo_comprobante, serie_comprobante, correlativo_comprobante,
                moneda, tipo_cambio, condicion_pago, fecha_vencimiento, subtotal, igv, total, estado, observaciones, cliente_nombre_manual
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completada', ?, ?)
            """,
            (
                cliente_id,
                datos_venta['usuario_id'],
                tipo_comprobante,
                serie_comprobante,
                correlativo_str,
                datos_venta['moneda'],
                tipo_cambio,
                datos_venta['condicion_pago'],
                datos_venta.get('fecha_vencimiento') if datos_venta['condicion_pago'] == "Credito" else None,
                subtotal_sin_igv,
                venta_igv,
                venta_total,
                datos_venta.get('observaciones', ''),
                cliente_nombre_manual
            )
        )
        venta_id = cursor.lastrowid

        # 7. REGISTRAR DETALLES DE LA VENTA
        for det in detalles_a_insertar:
            cursor.execute(
                """
                INSERT INTO venta_detalles (
                    venta_id, producto_id, cantidad, tipo_precio, precio_unitario, meses_garantia, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    venta_id,
                    det['producto_id'],
                    det['cantidad'],
                    det['tipo_precio'],
                    det['precio_unitario'],
                    det['meses_garantia'],
                    det['subtotal']
                )
            )
            # El trigger `trg_venta_detalle_insert` en la BD SQLite descontará el stock_actual 
            # de los productos tradicionales automáticamente aquí.

        # 8. ACTUALIZAR ESTADO DE LAS SERIES FÍSICAS
        for s in series_a_actualizar:
            nuevo_estado = 'En Garantia' if s['meses_garantia'] > 0 else 'Vendido'
            cursor.execute(
                "UPDATE producto_series SET estado = ?, venta_id = ? WHERE id = ?",
                (nuevo_estado, venta_id, s['serie_id'])
            )

        # 9. GESTIONAR CRÉDITOS O PAGOS COMBINADOS
        condicion_pago = datos_venta.get('condicion_pago', 'Contado')
        if condicion_pago == "Credito":
            fecha_vencimiento = datos_venta.get('fecha_vencimiento')
            if not fecha_vencimiento:
                raise ValueError("Debe ingresar una fecha de vencimiento válida para ventas al crédito.")
            
            cursor.execute(
                """
                INSERT INTO cuentas_por_cobrar (
                    venta_id, cliente_id, monto_total, monto_pagado, fecha_vencimiento, estado
                ) VALUES (?, ?, ?, 0.00, ?, 'Pendiente')
                """,
                (venta_id, cliente_id, venta_total, fecha_vencimiento)
            )
        elif condicion_pago == "Contado":
            pagos = datos_venta.get('pagos', [])
            if not pagos:
                raise ValueError("Debe ingresar al menos un método de pago para ventas al contado.")
                
            total_pago = 0.0
            for p in pagos:
                metodo = p.get('metodo_pago')
                monto = float(p.get('monto', 0.0))
                if metodo not in ('Efectivo', 'Transferencia', 'Yape/Plin', 'Tarjeta'):
                    raise ValueError(f"Método de pago '{metodo}' no es válido.")
                if monto < 0:
                    raise ValueError("El monto de pago no puede ser menor a cero.")
                total_pago += monto
                
            if total_pago < venta_total - 0.005:
                raise ValueError(f"El monto total pagado ({total_pago:.2f}) es menor que el total de la venta ({venta_total:.2f}).")
                
            exceso = total_pago - venta_total
            if exceso > 0.005:
                pago_efectivo = next((p for p in pagos if p.get('metodo_pago') == 'Efectivo'), None)
                if not pago_efectivo:
                    raise ValueError("El pago total excede el monto de la venta, pero no se ha especificado pago en Efectivo para entregar el vuelto.")
                
                efectivo_monto = float(pago_efectivo.get('monto', 0.0))
                if efectivo_monto < exceso:
                    raise ValueError(f"El vuelto a entregar ({exceso:.2f}) supera el monto pagado en Efectivo ({efectivo_monto:.2f}).")
                
                pago_efectivo['monto'] = efectivo_monto - exceso
                
            for p in pagos:
                metodo = p.get('metodo_pago')
                monto = round(float(p.get('monto', 0.0)), 2)
                if monto > 0:
                    cursor.execute(
                        """
                        INSERT INTO venta_pagos (venta_id, metodo_pago, monto, moneda)
                        VALUES (?, ?, ?, ?)
                        """,
                        (venta_id, metodo, monto, datos_venta['moneda'])
                    )

        return {
            "exito": True,
            "venta_id": venta_id,
            "comprobante": f"{serie_comprobante}-{correlativo_str}",
            "total": venta_total
        }
