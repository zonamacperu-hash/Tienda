import os
import unittest
import sqlite3
import shutil
from werkzeug.security import generate_password_hash

# Configurar ruta a base de datos de prueba
TEST_DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'db_test.sqlite')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'database', 'schema_sqlite.sql')

# Sobrescribir temporalmente la ruta de base de datos en los módulos del backend
os.environ['TESTING'] = 'True'
import server.database
server.database.DB_PATH = TEST_DB_PATH

from server.database import query_db, execute_db, transaction
from server.sales_processor import procesar_venta_transaccional

class TestERPPOSLogic(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Asegurar directorio de base de datos
        os.makedirs(os.path.dirname(TEST_DB_PATH), exist_ok=True)

    def setUp(self):
        # 1. Eliminar base de datos de prueba previa si existe
        if os.path.exists(TEST_DB_PATH):
            os.remove(TEST_DB_PATH)
            
        # 2. Inicializar base de datos de prueba desde el esquema
        with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
            
        conn = sqlite3.connect(TEST_DB_PATH)
        conn.executescript(schema_sql)
        conn.commit()
        
        # 3. Insertar datos base necesarios
        cursor = conn.cursor()
        
        # Configuración
        cursor.execute("""
            INSERT INTO configuracion_sistema (empresa_nombre, empresa_ruc, tipo_cambio_actual)
            VALUES ('Empresa Test', '20123456789', 3.7500)
        """)
        
        # Secuencias
        cursor.executemany("""
            INSERT INTO secuencias_comprobante (tipo, serie, correlativo_actual)
            VALUES (?, ?, ?)
        """, [
            ("Factura", "F001", 0),
            ("Boleta", "B001", 0),
            ("Ticket", "T001", 0),
            ("Nota de Venta", "NV01", 0),
            ("Nota de Compra", "NC01", 0)
        ])
        
        # Usuarios (Admin y Vendedor)
        cursor.execute("""
            INSERT INTO usuarios (nombre, username, email, password_hash, rol, activo)
            VALUES (?, ?, ?, ?, ?, 1)
        """, ("Admin", "admin", "admin@test.com", generate_password_hash("admin123", method='pbkdf2:sha256'), "Administrador"))
        
        cursor.execute("""
            INSERT INTO usuarios (nombre, username, email, password_hash, rol, activo)
            VALUES (?, ?, ?, ?, ?, 1)
        """, ("Vendedor", "vendedor", "vendedor@test.com", generate_password_hash("vendedor123", method='pbkdf2:sha256'), "Vendedor"))
        
        # Categoría
        cursor.execute("INSERT INTO categorias (nombre) VALUES ('Tecnologia')")
        
        # Productos (ID 1: Con Series, ID 2: Tradicional sin series)
        # Asus Zenbook a S/ 4000.00 venta
        cursor.execute("""
            INSERT INTO productos (categoria_id, nombre, maneja_series, stock_minimo, stock_actual, precio_base, precio_final)
            VALUES (1, 'Laptop Asus', 1, 2, 0, 3000.00, 4000.00)
        """)
        # Mouse Logitech a S/ 100.00 venta
        cursor.execute("""
            INSERT INTO productos (categoria_id, nombre, maneja_series, stock_minimo, stock_actual, precio_base, precio_final)
            VALUES (1, 'Mouse Logitech', 0, 5, 0, 60.00, 100.00)
        """)
        
        # Actores
        cursor.execute("""
            INSERT INTO actores (tipo, nombre_razon_social, tipo_documento, documento_identidad)
            VALUES ('Cliente', 'Cliente Prueba DNI', 'DNI', '77777777')
        """)
        cursor.execute("""
            INSERT INTO actores (tipo, nombre_razon_social, tipo_documento, documento_identidad)
            VALUES ('Proveedor', 'Mayorista Prueba RUC', 'RUC', '20111111111')
        """)
        
        conn.commit()
        conn.close()

    def tearDown(self):
        # Limpiar base de datos de pruebas tras finalizar
        if os.path.exists(TEST_DB_PATH):
            try:
                os.remove(TEST_DB_PATH)
            except PermissionError:
                pass

    def test_01_compra_abastecimiento(self):
        """Valida que el registro de compras aumente stock e ingrese series físicas correctamente."""
        # Simular compra de 3 Laptops Asus (con series) y 10 Mouses Logitech (tradicional) en moneda PEN
        compra_payload = {
            "proveedor_id": 2,
            "usuario_id": 1,
            "tipo_comprobante": "Factura",
            "serie_comprobante": "F001",
            "correlativo_comprobante": "00000001",
            "moneda": "PEN",
            "tipo_cambio": 3.75,
            "metodo_pago": "Contado",
            "items": [
                {
                    "producto_id": 1,
                    "cantidad": 3,
                    "precio_unitario": 3000.00,
                    "series": ["SN-ASUS-01", "SN-ASUS-02", "SN-ASUS-03"]
                },
                {
                    "producto_id": 2,
                    "cantidad": 10,
                    "precio_unitario": 60.00,
                    "series": []
                }
            ]
        }
        
        # Realizar inserción de compra simulada (replica lógica del backend)
        with transaction() as cursor:
            cursor.execute("""
                INSERT INTO compras (proveedor_id, usuario_id, tipo_comprobante, serie_comprobante, correlativo_comprobante, moneda, tipo_cambio, metodo_pago, total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (2, 1, "Factura", "F001", "00000001", "PEN", 3.75, "Contado", 9600.00))
            compra_id = cursor.lastrowid
            
            for item in compra_payload['items']:
                cursor.execute("""
                    INSERT INTO compra_detalles (compra_id, producto_id, cantidad, precio_unitario, subtotal)
                    VALUES (?, ?, ?, ?, ?)
                """, (compra_id, item['producto_id'], item['cantidad'], item['precio_unitario'], item['precio_unitario'] * item['cantidad']))
                
                if item['series']:
                    for sn in item['series']:
                        cursor.execute("""
                            INSERT INTO producto_series (producto_id, numero_serie, estado, compra_id)
                            VALUES (?, ?, 'Disponible', ?)
                        """, (item['producto_id'], sn, compra_id))
        
        # Verificar stock consolidado (Triggers de SQLite activos)
        prod_asus = query_db("SELECT stock_actual, maneja_series FROM productos WHERE id = 1", one=True)
        prod_mouse = query_db("SELECT stock_actual, maneja_series FROM productos WHERE id = 2", one=True)
        
        self.assertEqual(prod_asus['stock_actual'], 3)
        self.assertEqual(prod_mouse['stock_actual'], 10)
        
        # Verificar que las series de la Asus estén en producto_series como Disponible
        series = query_db("SELECT * FROM producto_series WHERE producto_id = 1")
        self.assertEqual(len(series), 3)
        self.assertTrue(all(s['estado'] == 'Disponible' for s in series))

    def test_02_venta_errores_validaciones(self):
        """Valida que ventas fallidas no alteren stocks ni estados por rollback."""
        # 1. Cargar stock previo
        execute_db("UPDATE productos SET stock_actual = 3 WHERE id = 1")
        execute_db("INSERT INTO producto_series (producto_id, numero_serie, estado) VALUES (1, 'SN-01', 'Disponible')")
        execute_db("INSERT INTO producto_series (producto_id, numero_serie, estado) VALUES (1, 'SN-02', 'Disponible')")
        execute_db("INSERT INTO producto_series (producto_id, numero_serie, estado) VALUES (1, 'SN-03', 'Disponible')")
          # A. Intentar vender Asus (maneja series) sin seleccionar series físicas
        venta_err_1 = {
            "cliente_id": 1,
            "usuario_id": 2, # Vendedor
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 8000.00}],
            "items": [
                {
                    "producto_id": 1,
                    "cantidad": 2,
                    "tipo_precio": "Final",
                    "series_seleccionadas": [] # Vacío!
                }
            ]
        }
        
        with self.assertRaises(ValueError):
            procesar_venta_transaccional(venta_err_1)
            
        # B. Intentar vender Asus seleccionando una serie que no está Disponible (SN-99)
        venta_err_2 = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 4000.00}],
            "items": [
                {
                    "producto_id": 1,
                    "cantidad": 1,
                    "tipo_precio": "Final",
                    "series_seleccionadas": ["SN-99"] # No existe
                }
            ]
        }
        with self.assertRaises(ValueError):
            procesar_venta_transaccional(venta_err_2)
 
        # C. Intentar vender producto tradicional con stock insuficiente
        venta_err_3 = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 5000.00}],
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 50, # Solo hay 0 en stock
                    "tipo_precio": "Final"
                }
            ]
        }
        with self.assertRaises(ValueError):
            procesar_venta_transaccional(venta_err_3)

        # Verificar que el stock sigue intacto
        prod_1 = query_db("SELECT stock_actual FROM productos WHERE id = 1", one=True)
        self.assertEqual(prod_1['stock_actual'], 3)

    def test_03_venta_exitosa_y_anulacion(self):
        """Valida que una venta correcta reduzca stock y que su anulación restaure todo exitosamente."""
        # 1. Cargar stock inicial
        execute_db("UPDATE productos SET stock_actual = 3 WHERE id = 1")
        execute_db("UPDATE productos SET stock_actual = 10 WHERE id = 2")
        execute_db("INSERT INTO producto_series (producto_id, numero_serie, estado) VALUES (1, 'SN-A', 'Disponible')")
        execute_db("INSERT INTO producto_series (producto_id, numero_serie, estado) VALUES (1, 'SN-B', 'Disponible')")
        execute_db("INSERT INTO producto_series (producto_id, numero_serie, estado) VALUES (1, 'SN-C', 'Disponible')")
        
        # Venta de: 1 Laptop Asus (Serie SN-B, meses_garantia=12, S/ 4000)
        # y 2 Mouses Logitech (S/ 100 x 2 = S/ 200). Total S/ 4200.00. Pago Crédito.
        venta_payload = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Credito",
            "fecha_vencimiento": "2026-06-25",
            "items": [
                {
                    "producto_id": 1,
                    "cantidad": 1,
                    "tipo_precio": "Final",
                    "series_seleccionadas": ["SN-B"],
                    "meses_garantia": 12
                },
                {
                    "producto_id": 2,
                    "cantidad": 2,
                    "tipo_precio": "Final"
                }
            ]
        }
        
        # Procesar Venta
        res = procesar_venta_transaccional(venta_payload)
        self.assertTrue(res['exito'])
        venta_id = res['venta_id']
        
        # Verificar Stocks reducidos
        prod_1 = query_db("SELECT stock_actual FROM productos WHERE id = 1", one=True)
        prod_2 = query_db("SELECT stock_actual FROM productos WHERE id = 2", one=True)
        self.assertEqual(prod_1['stock_actual'], 2)
        self.assertEqual(prod_2['stock_actual'], 8)
        
        # Verificar estado de las series físicas
        serie_a = query_db("SELECT estado, venta_id FROM producto_series WHERE numero_serie = 'SN-A'", one=True)
        serie_b = query_db("SELECT estado, venta_id FROM producto_series WHERE numero_serie = 'SN-B'", one=True)
        
        self.assertEqual(serie_a['estado'], 'Disponible')
        self.assertEqual(serie_b['estado'], 'En Garantia') # Pasa a 'En Garantia' por meses_garantia > 0
        self.assertEqual(serie_b['venta_id'], venta_id)
        
        # Verificar que se creó la cuenta por cobrar
        cxc = query_db("SELECT * FROM cuentas_por_cobrar WHERE venta_id = ?", [venta_id], one=True)
        self.assertIsNotNone(cxc)
        self.assertEqual(cxc['monto_total'], 4200.00)
        self.assertEqual(cxc['estado'], 'Pendiente')
        
        # -------------------------------------------------------------
        # PROBAR ANULACIÓN DE LA VENTA
        # -------------------------------------------------------------
        execute_db("UPDATE ventas SET estado = 'Anulada' WHERE id = ?", [venta_id])
        # El trigger trg_venta_anulada debe restaurar todo
        
        # Verificar Stocks restaurados
        prod_1_r = query_db("SELECT stock_actual FROM productos WHERE id = 1", one=True)
        prod_2_r = query_db("SELECT stock_actual FROM productos WHERE id = 2", one=True)
        self.assertEqual(prod_1_r['stock_actual'], 3)
        self.assertEqual(prod_2_r['stock_actual'], 10)
        
        # Verificar series físicas liberadas
        serie_b_r = query_db("SELECT estado, venta_id FROM producto_series WHERE numero_serie = 'SN-B'", one=True)
        self.assertEqual(serie_b_r['estado'], 'Disponible')
        self.assertIsNone(serie_b_r['venta_id'])

    def test_04_tipo_cambio_conversion(self):
        """Valida que la venta en USD convierta los precios y subtotales en base al TC congelado."""
        # 1. Cargar stock
        execute_db("UPDATE productos SET stock_actual = 10 WHERE id = 2") # Mouse Logitech (S/ 100 venta)
        
        # Venta en USD (TC = 3.75). Mouse debe costar 100 / 3.75 = $ 26.6667
        # Vendemos 1 Mouse Logitech en USD. Total en USD = $ 26.67
        venta_usd = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "USD",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 26.67}],
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ]
        }
        
        res = procesar_venta_transaccional(venta_usd)
        self.assertTrue(res['exito'])
        venta_id = res['venta_id']
        
        venta = query_db("SELECT total, tipo_cambio FROM ventas WHERE id = ?", [venta_id], one=True)
        self.assertAlmostEqual(venta['total'], 26.67, places=2)
        self.assertEqual(venta['tipo_cambio'], 3.7500)

    def test_05_venta_comprador_invitado(self):
        """Valida las reglas e inserción para compras de comprador invitado (Guest Checkout)."""
        # 1. Stock
        execute_db("UPDATE productos SET stock_actual = 5 WHERE id = 2") # Mouse Logitech

        # A. Venta exitosa con Boleta a un Comprador Invitado
        venta_ok = {
            "cliente_id": None, # Comprador Invitado
            "cliente_nombre_manual": "Carlos Pérez",
            "usuario_id": 2,
            "tipo_comprobante": "Boleta",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ]
        }
        res = procesar_venta_transaccional(venta_ok)
        self.assertTrue(res['exito'])
        venta_id = res['venta_id']

        # Verificar que se guardó correctamente cliente_nombre_manual y cliente_id es NULL
        v = query_db("SELECT cliente_id, cliente_nombre_manual, total FROM ventas WHERE id = ?", [venta_id], one=True)
        self.assertIsNone(v['cliente_id'])
        self.assertEqual(v['cliente_nombre_manual'], "Carlos Pérez")
        self.assertEqual(v['total'], 100.00)

        # B. Debe fallar si es Factura con comprador invitado (SUNAT RUC required)
        venta_err_factura = {
            "cliente_id": None,
            "cliente_nombre_manual": "Carlos Pérez",
            "usuario_id": 2,
            "tipo_comprobante": "Factura",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ]
        }
        with self.assertRaises(ValueError) as ctx:
            procesar_venta_transaccional(venta_err_factura)
        self.assertIn("facturas requieren obligatoriamente", str(ctx.exception).lower())

        # C. Debe fallar si es Crédito con comprador invitado
        venta_err_credito = {
            "cliente_id": None,
            "cliente_nombre_manual": "Carlos Pérez",
            "usuario_id": 2,
            "tipo_comprobante": "Boleta",
            "moneda": "PEN",
            "condicion_pago": "Credito",
            "fecha_vencimiento": "2026-06-25",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ]
        }
        with self.assertRaises(ValueError) as ctx:
            procesar_venta_transaccional(venta_err_credito)
        self.assertIn("ventas al crédito requieren obligatoriamente", str(ctx.exception).lower())

        # D. Debe fallar si cliente_nombre_manual está vacío
        venta_err_nombre = {
            "cliente_id": None,
            "cliente_nombre_manual": "   ",
            "usuario_id": 2,
            "tipo_comprobante": "Boleta",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ]
        }
        with self.assertRaises(ValueError) as ctx:
            procesar_venta_transaccional(venta_err_nombre)
        self.assertIn("ingresar el nombre del comprador", str(ctx.exception).lower())

    def test_06_movimientos_kardex(self):
        """Valida que la consulta unificada de kárdex (UNION ALL) retorne correctamente el historial de compras y ventas."""
        # 1. Limpiar e inicializar datos de prueba
        execute_db("DELETE FROM compra_detalles")
        execute_db("DELETE FROM compras")
        execute_db("DELETE FROM venta_detalles")
        execute_db("DELETE FROM ventas")
        execute_db("DELETE FROM producto_series")
        execute_db("UPDATE productos SET stock_actual = 0")

        # 2. Registrar una Compra (Entrada) de:
        # - 2 Laptops Asus (con series: SN-KARDEX-01, SN-KARDEX-02)
        # - 5 Mouses Logitech (tradicional)
        with transaction() as cursor:
            cursor.execute("""
                INSERT INTO compras (id, proveedor_id, usuario_id, tipo_comprobante, serie_comprobante, correlativo_comprobante, moneda, tipo_cambio, metodo_pago, total, fecha_compra)
                VALUES (10, 2, 1, 'Factura', 'F001', '00000010', 'PEN', 3.75, 'Contado', 8300.00, '2026-05-26 10:00:00')
            """)
            cursor.execute("""
                INSERT INTO compra_detalles (compra_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (10, 1, 2, 3000.00, 6000.00)
            """)
            cursor.execute("""
                INSERT INTO compra_detalles (compra_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (10, 2, 5, 60.00, 300.00)
            """)
            cursor.execute("""
                INSERT INTO producto_series (producto_id, numero_serie, estado, compra_id)
                VALUES (1, 'SN-KARDEX-01', 'Disponible', 10)
            """)
            cursor.execute("""
                INSERT INTO producto_series (producto_id, numero_serie, estado, compra_id)
                VALUES (1, 'SN-KARDEX-02', 'Disponible', 10)
            """)
        
        # 3. Registrar una Venta (Salida) de:
        # - 1 Laptop Asus (Serie SN-KARDEX-01)
        # - 2 Mouses Logitech
        venta_payload = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Boleta",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 4200.00}],
            "items": [
                {
                    "producto_id": 1,
                    "cantidad": 1,
                    "tipo_precio": "Final",
                    "series_seleccionadas": ["SN-KARDEX-01"]
                },
                {
                    "producto_id": 2,
                    "cantidad": 2,
                    "tipo_precio": "Final"
                }
            ]
        }
        res = procesar_venta_transaccional(venta_payload)
        self.assertTrue(res['exito'])
        venta_id = res['venta_id']
        
        # Forzar fecha de la venta para orden cronológico estable
        execute_db("UPDATE ventas SET fecha_venta = '2026-05-26 11:00:00' WHERE id = ?", [venta_id])
        execute_db("UPDATE producto_series SET venta_id = ? WHERE numero_serie = 'SN-KARDEX-01'", [venta_id])

        # 4. Consultar movimientos unificados usando la consulta lógica del Kárdex
        # Probamos primero la consulta global (Todos los movimientos)
        sql_compras = """
            SELECT 
                c.fecha_compra AS fecha,
                'Entrada' AS tipo_movimiento,
                p.id AS producto_id,
                p.nombre AS producto_nombre,
                cd.cantidad AS cantidad,
                c.tipo_comprobante || ' ' || c.serie_comprobante || '-' || c.correlativo_comprobante AS documento,
                ps.numero_serie AS numero_serie
            FROM compra_detalles cd
            JOIN compras c ON cd.compra_id = c.id
            JOIN productos p ON cd.producto_id = p.id
            LEFT JOIN producto_series ps ON p.maneja_series = 1 AND ps.compra_id = c.id AND ps.producto_id = p.id
            WHERE c.estado = 'Completada'
        """
        sql_ventas = """
            SELECT 
                v.fecha_venta AS fecha,
                'Salida' AS tipo_movimiento,
                p.id AS producto_id,
                p.nombre AS producto_nombre,
                vd.cantidad AS cantidad,
                v.tipo_comprobante || ' ' || v.serie_comprobante || '-' || v.correlativo_comprobante AS documento,
                ps.numero_serie AS numero_serie
            FROM venta_detalles vd
            JOIN ventas v ON vd.venta_id = v.id
            JOIN productos p ON vd.producto_id = p.id
            LEFT JOIN producto_series ps ON p.maneja_series = 1 AND ps.venta_id = v.id AND ps.producto_id = p.id
            WHERE v.estado = 'Completada'
        """
        
        # UNION de movimientos
        movs = query_db(f"SELECT * FROM ({sql_compras} UNION ALL {sql_ventas}) ORDER BY fecha ASC, producto_id ASC, numero_serie ASC")
        
        # Deben haber:
        # - 2 filas de compras de Laptop Asus (unrolled, Qty 1 cada una, series SN-KARDEX-01 y SN-KARDEX-02)
        # - 1 fila de compra de Mouse Logitech (Qty 5, sin serie)
        # - 1 fila de venta de Laptop Asus (Qty 1, serie SN-KARDEX-01)
        # - 1 fila de venta de Mouse Logitech (Qty 2, sin serie)
        # Total = 5 movimientos
        self.assertEqual(len(movs), 5)
        
        # Validar primer movimiento (Entrada Asus Laptop con serie SN-KARDEX-01)
        m1 = movs[0]
        self.assertEqual(m1['tipo_movimiento'], 'Entrada')
        self.assertEqual(m1['producto_nombre'], 'Laptop Asus')
        self.assertEqual(m1['numero_serie'], 'SN-KARDEX-01')
        
        # Validar tercer movimiento (Entrada Mouse Logitech Qty 5)
        m3 = movs[2]
        self.assertEqual(m3['tipo_movimiento'], 'Entrada')
        self.assertEqual(m3['producto_nombre'], 'Mouse Logitech')
        self.assertEqual(m3['numero_serie'], None)
        
        # Validar cuarto movimiento (Salida Asus Laptop con serie SN-KARDEX-01)
        m4 = movs[3]
        self.assertEqual(m4['tipo_movimiento'], 'Salida')
        self.assertEqual(m4['producto_nombre'], 'Laptop Asus')
        self.assertEqual(m4['numero_serie'], 'SN-KARDEX-01')

        # 5. Probar filtro por serie específico (SN-KARDEX-02)
        filtered_compras = query_db(sql_compras + " AND ps.numero_serie = 'SN-KARDEX-02'")
        filtered_ventas = query_db(sql_ventas + " AND ps.numero_serie = 'SN-KARDEX-02'")
        total_filtered = filtered_compras + filtered_ventas
        self.assertEqual(len(total_filtered), 1)
        self.assertEqual(total_filtered[0]['tipo_movimiento'], 'Entrada')
        self.assertEqual(total_filtered[0]['numero_serie'], 'SN-KARDEX-02')

    def test_07_moneda_base_producto(self):
        """Valida que los productos guarden y respeten su moneda base (PEN/USD)."""
        # 1. Verificar que los productos creados en setUp tienen por defecto moneda 'PEN'
        prod_asus = query_db("SELECT moneda FROM productos WHERE id = 1", one=True)
        self.assertEqual(prod_asus['moneda'], 'PEN')

        # 2. Insertar un producto nuevo con moneda 'USD'
        execute_db("""
            INSERT INTO productos (categoria_id, nombre, maneja_series, stock_minimo, stock_actual, precio_base, precio_final, moneda)
            VALUES (1, 'Macbook Air', 1, 1, 0, 1000.00, 1500.00, 'USD')
        """)
        prod_mac = query_db("SELECT moneda, precio_base, precio_final FROM productos WHERE nombre = 'Macbook Air'", one=True)
        self.assertEqual(prod_mac['moneda'], 'USD')
        self.assertEqual(prod_mac['precio_base'], 1000.00)
        self.assertEqual(prod_mac['precio_final'], 1500.00)

        # 3. Intentar insertar un producto con moneda inválida 'EUR' (debe fallar por CHECK constraint de SQLite)
        with self.assertRaises(sqlite3.IntegrityError):
            execute_db("""
                INSERT INTO productos (categoria_id, nombre, maneja_series, stock_minimo, stock_actual, precio_base, precio_final, moneda)
                VALUES (1, 'Teclado Mecánico', 0, 2, 0, 50.00, 80.00, 'EUR')
            """)

    def test_08_pagos_combinados(self):
        """Valida las reglas de pagos combinados, verificación de sumas, desglose y cálculo de vuelto."""
        # 1. Cargar stock
        execute_db("UPDATE productos SET stock_actual = 10 WHERE id = 2") # Mouse Logitech (S/ 100 venta)
        
        # A. Venta con pago exacto dividido (S/ 50 Tarjeta, S/ 50 Yape/Plin)
        venta_payload_1 = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ],
            "pagos": [
                {"metodo_pago": "Tarjeta", "monto": 50.00},
                {"metodo_pago": "Yape/Plin", "monto": 50.00}
            ]
        }
        res_1 = procesar_venta_transaccional(venta_payload_1)
        self.assertTrue(res_1['exito'])
        venta_id_1 = res_1['venta_id']
        
        # Verificar que se crearon los registros en venta_pagos
        pagos_db_1 = query_db("SELECT metodo_pago, monto FROM venta_pagos WHERE venta_id = ? ORDER BY metodo_pago", [venta_id_1])
        self.assertEqual(len(pagos_db_1), 2)
        self.assertEqual(pagos_db_1[0]['metodo_pago'], 'Tarjeta')
        self.assertEqual(pagos_db_1[0]['monto'], 50.00)
        self.assertEqual(pagos_db_1[1]['metodo_pago'], 'Yape/Plin')
        self.assertEqual(pagos_db_1[1]['monto'], 50.00)
        
        # B. Venta con sobrepago en Efectivo (S/ 120 pagados en total, S/ 100 Efectivo, S/ 20 Tarjeta. Total de venta S/ 100)
        # El vuelto es S/ 20, por lo que el pago final en Efectivo debe ajustarse a S/ 80.
        venta_payload_2 = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ],
            "pagos": [
                {"metodo_pago": "Efectivo", "monto": 100.00},
                {"metodo_pago": "Tarjeta", "monto": 20.00}
            ]
        }
        res_2 = procesar_venta_transaccional(venta_payload_2)
        self.assertTrue(res_2['exito'])
        venta_id_2 = res_2['venta_id']
        
        # El vuelto de S/ 20 se descuenta de Efectivo (100 - 20 = 80)
        pagos_db_2 = query_db("SELECT metodo_pago, monto FROM venta_pagos WHERE venta_id = ? ORDER BY metodo_pago", [venta_id_2])
        self.assertEqual(len(pagos_db_2), 2)
        self.assertEqual(pagos_db_2[0]['metodo_pago'], 'Efectivo')
        self.assertEqual(pagos_db_2[0]['monto'], 80.00)
        self.assertEqual(pagos_db_2[1]['metodo_pago'], 'Tarjeta')
        self.assertEqual(pagos_db_2[1]['monto'], 20.00)
        
        # C. Debe fallar si el total pagado es menor al total de la venta (S/ 90 vs S/ 100)
        venta_err_monto = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ],
            "pagos": [
                {"metodo_pago": "Efectivo", "monto": 50.00},
                {"metodo_pago": "Tarjeta", "monto": 40.00}
            ]
        }
        with self.assertRaises(ValueError) as ctx:
            procesar_venta_transaccional(venta_err_monto)
        self.assertIn("menor que el total de la venta", str(ctx.exception).lower())
        
        # D. Debe fallar si hay sobrepago pero no se incluye Efectivo para dar vuelto
        venta_err_vuelto = {
            "cliente_id": 1,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 1,
                    "tipo_precio": "Final"
                }
            ],
            "pagos": [
                {"metodo_pago": "Tarjeta", "monto": 120.00}
            ]
        }
        with self.assertRaises(ValueError) as ctx_v:
            procesar_venta_transaccional(venta_err_vuelto)
        self.assertIn("no se ha especificado pago en efectivo para entregar el vuelto", str(ctx_v.exception).lower())

    def test_09_igv_por_tipo_comprobante_y_ruc_validacion(self):
        """Valida que Facturas exijan RUC válido, calculen IGV desglosado y Boleta/Ticket no desglosen IGV."""
        # 1. Crear clientes para prueba
        # Cliente con RUC válido (20123456789)
        execute_db("INSERT INTO actores (tipo, nombre_razon_social, tipo_documento, documento_identidad) VALUES ('Cliente', 'Empresa RUC Valido', 'RUC', '20123456789')")
        ruc_valido_id = query_db("SELECT id FROM actores WHERE documento_identidad = '20123456789'", one=True)['id']
        
        # Cliente con RUC inválido (inicia con 30)
        execute_db("INSERT INTO actores (tipo, nombre_razon_social, tipo_documento, documento_identidad) VALUES ('Cliente', 'Empresa RUC Invalido 1', 'RUC', '30123456789')")
        ruc_invalido_1_id = query_db("SELECT id FROM actores WHERE documento_identidad = '30123456789'", one=True)['id']
        
        # Cliente con RUC de longitud inválida (10 dígitos)
        execute_db("INSERT INTO actores (tipo, nombre_razon_social, tipo_documento, documento_identidad) VALUES ('Cliente', 'Empresa RUC Invalido 2', 'RUC', '2012345678')")
        ruc_invalido_2_id = query_db("SELECT id FROM actores WHERE documento_identidad = '2012345678'", one=True)['id']
        
        # Cliente con DNI
        dni_id = query_db("SELECT id FROM actores WHERE documento_identidad = '77777777'", one=True)['id']
        
        # 2. Cargar stock para productos
        execute_db("UPDATE productos SET stock_actual = 10 WHERE id = 2") # Mouse Logitech (S/ 100)
        
        # A. Venta de Factura a un comprador manual (Invitado) -> Debe fallar
        venta_factura_invitado = {
            "cliente_id": None,
            "cliente_nombre_manual": "Invitado Factura",
            "usuario_id": 2,
            "tipo_comprobante": "Factura",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [{"producto_id": 2, "cantidad": 1, "tipo_precio": "Final"}]
        }
        with self.assertRaises(ValueError) as ctx:
            procesar_venta_transaccional(venta_factura_invitado)
        self.assertIn("facturas requieren obligatoriamente", str(ctx.exception).lower())
        
        # B. Venta de Factura a un cliente con DNI -> Debe fallar
        venta_factura_dni = {
            "cliente_id": dni_id,
            "usuario_id": 2,
            "tipo_comprobante": "Factura",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [{"producto_id": 2, "cantidad": 1, "tipo_precio": "Final"}]
        }
        with self.assertRaises(ValueError) as ctx:
            procesar_venta_transaccional(venta_factura_dni)
        self.assertIn("no cuenta con ruc", str(ctx.exception).lower())
        
        # C. Venta de Factura a un cliente con RUC inválido (inicia con 30) -> Debe fallar
        venta_factura_ruc_inv_1 = {
            "cliente_id": ruc_invalido_1_id,
            "usuario_id": 2,
            "tipo_comprobante": "Factura",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [{"producto_id": 2, "cantidad": 1, "tipo_precio": "Final"}]
        }
        with self.assertRaises(ValueError) as ctx:
            procesar_venta_transaccional(venta_factura_ruc_inv_1)
        self.assertIn("ruc del cliente registrado no es válido", str(ctx.exception).lower())
        
        # D. Venta de Factura a un cliente con RUC inválido (longitud = 10) -> Debe fallar
        venta_factura_ruc_inv_2 = {
            "cliente_id": ruc_invalido_2_id,
            "usuario_id": 2,
            "tipo_comprobante": "Factura",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [{"producto_id": 2, "cantidad": 1, "tipo_precio": "Final"}]
        }
        with self.assertRaises(ValueError) as ctx:
            procesar_venta_transaccional(venta_factura_ruc_inv_2)
        self.assertIn("ruc del cliente registrado no es válido", str(ctx.exception).lower())
        
        # E. Venta de Factura exitosa a un cliente con RUC válido -> Debe pasar y calcular IGV desglosado
        venta_factura_ok = {
            "cliente_id": ruc_valido_id,
            "usuario_id": 2,
            "tipo_comprobante": "Factura",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [{"producto_id": 2, "cantidad": 1, "tipo_precio": "Final"}]
        }
        res_factura = procesar_venta_transaccional(venta_factura_ok)
        self.assertTrue(res_factura['exito'])
        v_factura = query_db("SELECT subtotal, igv, total FROM ventas WHERE id = ?", [res_factura['venta_id']], one=True)
        self.assertAlmostEqual(v_factura['total'], 100.00, places=2)
        self.assertAlmostEqual(v_factura['subtotal'], 100.00 / 1.18, places=2)
        self.assertAlmostEqual(v_factura['igv'], 100.00 - (100.00 / 1.18), places=2)
        
        # F. Venta de Boleta exitosa a un cliente con RUC válido -> Debe pasar y tener IGV = 0.00 y Subtotal = Total
        venta_boleta_ok = {
            "cliente_id": ruc_valido_id,
            "usuario_id": 2,
            "tipo_comprobante": "Boleta",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [{"producto_id": 2, "cantidad": 1, "tipo_precio": "Final"}]
        }
        res_boleta = procesar_venta_transaccional(venta_boleta_ok)
        self.assertTrue(res_boleta['exito'])
        v_boleta = query_db("SELECT subtotal, igv, total FROM ventas WHERE id = ?", [res_boleta['venta_id']], one=True)
        self.assertAlmostEqual(v_boleta['total'], 100.00, places=2)
        self.assertAlmostEqual(v_boleta['subtotal'], 100.00, places=2)
        self.assertAlmostEqual(v_boleta['igv'], 0.00, places=2)
        
        # G. Venta de Ticket exitosa -> Debe pasar y tener IGV = 0.00 y Subtotal = Total
        venta_ticket_ok = {
            "cliente_id": ruc_valido_id,
            "usuario_id": 2,
            "tipo_comprobante": "Ticket",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [{"producto_id": 2, "cantidad": 1, "tipo_precio": "Final"}]
        }
        res_ticket = procesar_venta_transaccional(venta_ticket_ok)
        self.assertTrue(res_ticket['exito'])
        v_ticket = query_db("SELECT subtotal, igv, total FROM ventas WHERE id = ?", [res_ticket['venta_id']], one=True)
        self.assertAlmostEqual(v_ticket['total'], 100.00, places=2)
        self.assertAlmostEqual(v_ticket['subtotal'], 100.00, places=2)
        self.assertAlmostEqual(v_ticket['igv'], 0.00, places=2)

        # H. Venta de Nota de Venta exitosa -> Debe pasar, no exigir RUC ni cliente registrado, y tener IGV = 0.00 y Subtotal = Total (100.00)
        venta_notaventa_ok = {
            "cliente_id": None,
            "cliente_nombre_manual": "Comprador Nota Venta",
            "usuario_id": 2,
            "tipo_comprobante": "Nota de Venta",
            "moneda": "PEN",
            "condicion_pago": "Contado",
            "pagos": [{"metodo_pago": "Efectivo", "monto": 100.00}],
            "items": [{"producto_id": 2, "cantidad": 1, "tipo_precio": "Final"}]
        }
        res_notaventa = procesar_venta_transaccional(venta_notaventa_ok)
        self.assertTrue(res_notaventa['exito'])
        self.assertEqual(res_notaventa['comprobante'], "NV01-00000001")
        v_notaventa = query_db("SELECT subtotal, igv, total FROM ventas WHERE id = ?", [res_notaventa['venta_id']], one=True)
        self.assertAlmostEqual(v_notaventa['total'], 100.00, places=2)
        self.assertAlmostEqual(v_notaventa['subtotal'], 100.00, places=2)
        self.assertAlmostEqual(v_notaventa['igv'], 0.00, places=2)

    def test_10_compras_igv_y_ruc_validacion(self):
        """Valida que la creación de compras mediante API exija RUC de proveedor para Facturas y calcule IGV condicionalmente."""
        from server.app import app
        client = app.test_client()
        
        # 1. Crear proveedores para prueba
        # Proveedor con RUC válido (20444444444)
        execute_db("INSERT INTO actores (tipo, nombre_razon_social, tipo_documento, documento_identidad) VALUES ('Proveedor', 'Distribuidora RUC Valido', 'RUC', '20444444444')")
        ruc_valido_id = query_db("SELECT id FROM actores WHERE documento_identidad = '20444444444'", one=True)['id']
        
        # Proveedor con DNI
        execute_db("INSERT INTO actores (tipo, nombre_razon_social, tipo_documento, documento_identidad) VALUES ('Proveedor', 'Persona DNI', 'DNI', '44444444')")
        dni_id = query_db("SELECT id FROM actores WHERE documento_identidad = '44444444'", one=True)['id']
        
        # A. Compra de Factura a un proveedor con DNI -> Debe fallar
        compra_err_dni = {
            "proveedor_id": dni_id,
            "usuario_id": 1,
            "tipo_comprobante": "Factura",
            "serie_comprobante": "F001",
            "correlativo_comprobante": "00000002",
            "moneda": "PEN",
            "tipo_cambio": 3.75,
            "metodo_pago": "Contado",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 5,
                    "precio_unitario": 50.00
                }
            ]
        }
        res = client.post('/api/compras', json=compra_err_dni)
        self.assertEqual(res.status_code, 400)
        self.assertIn("exigen ruc obligatoriamente", res.get_json()['mensaje'].lower())
        
        # B. Compra de Factura a un proveedor con RUC válido -> Debe ser exitosa y desglosar 18% IGV (5 * 50 = 250 total)
        compra_factura_ok = {
            "proveedor_id": ruc_valido_id,
            "usuario_id": 1,
            "tipo_comprobante": "Factura",
            "serie_comprobante": "F001",
            "correlativo_comprobante": "00000003",
            "moneda": "PEN",
            "tipo_cambio": 3.75,
            "metodo_pago": "Contado",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 5,
                    "precio_unitario": 50.00
                }
            ]
        }
        res2 = client.post('/api/compras', json=compra_factura_ok)
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertTrue(data2['exito'])
        compra_id_2 = data2['compra_id']
        
        db_compra_2 = query_db("SELECT subtotal, igv, total FROM compras WHERE id = ?", [compra_id_2], one=True)
        self.assertAlmostEqual(db_compra_2['total'], 250.00, places=2)
        self.assertAlmostEqual(db_compra_2['subtotal'], 250.00 / 1.18, places=2)
        self.assertAlmostEqual(db_compra_2['igv'], 250.00 - (250.00 / 1.18), places=2)
        
        # C. Compra de Boleta a un proveedor con DNI -> Debe ser exitosa y tener IGV = 0.00 y Subtotal = Total (5 * 50 = 250 total)
        compra_boleta_ok = {
            "proveedor_id": dni_id,
            "usuario_id": 1,
            "tipo_comprobante": "Boleta",
            "serie_comprobante": "B001",
            "correlativo_comprobante": "00000004",
            "moneda": "PEN",
            "tipo_cambio": 3.75,
            "metodo_pago": "Contado",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 5,
                    "precio_unitario": 50.00
                }
            ]
        }
        res3 = client.post('/api/compras', json=compra_boleta_ok)
        self.assertEqual(res3.status_code, 200)
        data3 = res3.get_json()
        self.assertTrue(data3['exito'])
        compra_id_3 = data3['compra_id']
        
        db_compra_3 = query_db("SELECT subtotal, igv, total FROM compras WHERE id = ?", [compra_id_3], one=True)
        self.assertAlmostEqual(db_compra_3['total'], 250.00, places=2)
        self.assertAlmostEqual(db_compra_3['subtotal'], 250.00, places=2)
        self.assertAlmostEqual(db_compra_3['igv'], 0.00, places=2)

        # D. Compra de Nota de Compra a un proveedor con DNI -> Debe ser exitosa, tener IGV = 0.00 y Subtotal = Total (5 * 50 = 250 total)
        compra_notacompra_ok = {
            "proveedor_id": dni_id,
            "usuario_id": 1,
            "tipo_comprobante": "Nota de Compra",
            "serie_comprobante": "NC01",
            "correlativo_comprobante": "00000005",
            "moneda": "PEN",
            "tipo_cambio": 3.75,
            "metodo_pago": "Contado",
            "items": [
                {
                    "producto_id": 2,
                    "cantidad": 5,
                    "precio_unitario": 50.00
                }
            ]
        }
        res4 = client.post('/api/compras', json=compra_notacompra_ok)
        self.assertEqual(res4.status_code, 200)
        data4 = res4.get_json()
        self.assertTrue(data4['exito'])
        compra_id_4 = data4['compra_id']
        
        db_compra_4 = query_db("SELECT subtotal, igv, total FROM compras WHERE id = ?", [compra_id_4], one=True)
        self.assertAlmostEqual(db_compra_4['total'], 250.00, places=2)
        self.assertAlmostEqual(db_compra_4['subtotal'], 250.00, places=2)
        self.assertAlmostEqual(db_compra_4['igv'], 0.00, places=2)

if __name__ == '__main__':
    unittest.main()
