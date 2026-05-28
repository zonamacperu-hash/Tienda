import os
import sqlite3
from werkzeug.security import generate_password_hash

DB_PATH = os.path.join(os.path.dirname(__file__), 'db.sqlite')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema_sqlite.sql')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    print("Inicializando base de datos SQLite...")
    
    # 1. Leer esquema SQL
    if not os.path.exists(SCHEMA_PATH):
        print(f"ERROR: No se encontró el archivo de esquema en {SCHEMA_PATH}")
        return False
        
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        schema_sql = f.read()

    # 2. Ejecutar esquema SQL
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(schema_sql)
        conn.commit()
        print("Esquema creado con éxito.")
    except Exception as e:
        print(f"Error al ejecutar el esquema SQL: {e}")
        conn.close()
        return False

    # 3. Insertar datos semilla si la base de datos está vacía
    cursor = conn.cursor()
    
    # Validar si ya hay usuarios
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    if cursor.fetchone()[0] == 0:
        print("Insertando datos semilla...")
        
        # 3.1. Insertar configuración por defecto
        cursor.execute("""
            INSERT INTO configuracion_sistema (
                empresa_nombre, empresa_ruc, empresa_direccion, empresa_telefono, empresa_email, moneda_defecto, tipo_cambio_actual
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "TecnoPerú Soluciones S.A.C.",
            "20608765432",
            "Av. Garcilaso de la Vega 1236, Lima",
            "+51 987 654 321",
            "contacto@tecnoperu.com",
            "PEN",
            3.7500
        ))
        
        # 3.2. Insertar usuarios semilla (Admin, Vendedor, Almacenero)
        admin_user = os.environ.get('ERP_ADMIN_USER', 'admin')
        admin_pass = os.environ.get('ERP_ADMIN_PASS', 'admin123')
        
        vendedor_user = os.environ.get('ERP_VENDEDOR_USER', 'vendedor')
        vendedor_pass = os.environ.get('ERP_VENDEDOR_PASS', 'vendedor123')
        
        almacen_user = os.environ.get('ERP_ALMACEN_USER', 'almacen')
        almacen_pass = os.environ.get('ERP_ALMACEN_PASS', 'almacen123')

        usuarios_semilla = [
            ("Administrador ERP", admin_user, "admin@tecnoperu.com", generate_password_hash(admin_pass, method='pbkdf2:sha256'), "Administrador"),
            ("Vendedor POS", vendedor_user, "vendedor@tecnoperu.com", generate_password_hash(vendedor_pass, method='pbkdf2:sha256'), "Vendedor"),
            ("Almacenero ERP", almacen_user, "almacen@tecnoperu.com", generate_password_hash(almacen_pass, method='pbkdf2:sha256'), "Almacenero")
        ]
        cursor.executemany("""
            INSERT INTO usuarios (nombre, username, email, password_hash, rol, activo)
            VALUES (?, ?, ?, ?, ?, 1)
        """, usuarios_semilla)

        # 3.3. Insertar secuencias de comprobante para el POS
        secuencias = [
            ("Factura", "F001", 0),
            ("Boleta", "B001", 0),
            ("Guia de Remision", "G001", 0),
            ("Ticket", "T001", 0)
        ]
        cursor.executemany("""
            INSERT INTO secuencias_comprobante (tipo, serie, correlativo_actual)
            VALUES (?, ?, ?)
        """, secuencias)

        # 3.4. Insertar tipo de cambio inicial en el historial
        cursor.execute("""
            INSERT INTO historial_tipo_cambio (fecha, tipo_cambio, usuario_id)
            VALUES (date('now'), 3.7500, 1)
        """)

        # 3.5. Insertar categorías iniciales
        categorias = [
            ("Laptops & Computadoras", "Equipos portátiles y de escritorio de última generación."),
            ("Accesorios de Tecnología", "Teclados, mouses, monitores, adaptadores y componentes.")
        ]
        cursor.executemany("""
            INSERT INTO categorias (nombre, descripcion)
            VALUES (?, ?)
        """, categorias)

        # 3.6. Insertar productos de prueba
        # Producto 1: Maneja series (Laptop Asus)
        # Producto 2: No maneja series (Mouse Inalámbrico Logitech)
        productos = [
            (1, "Laptop ASUS Zenbook 14 OLED", "Procesador Intel Core i7, 16GB RAM, 512GB SSD", 1, 3, 0, 3200.00, 3950.00),
            (2, "Mouse Inalámbrico Logitech M280", "Mouse ergonómico con receptor USB de alta precisión", 0, 5, 20, 45.00, 69.90)
        ]
        cursor.executemany("""
            INSERT INTO productos (categoria_id, nombre, descripcion, maneja_series, stock_minimo, stock_actual, precio_base, precio_final)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, productos)

        # 3.7. Insertar actores iniciales (Clientes y Proveedores)
        actores = [
            ("Cliente", "Cliente General POS", "DNI", "00000000", "000000000", "cliente_general@gmail.com", "Lima, Perú"),
            ("Cliente", "Inversiones Rímac S.A.C.", "RUC", "20509876543", "+51 912 345 678", "compras@rimac.com", "San Isidro, Lima"),
            ("Proveedor", "Mayorista Tecnológico del Perú S.A.", "RUC", "20108765432", "+51 988 777 666", "ventas@mayoristatec.com.pe", "Miraflores, Lima")
        ]
        cursor.executemany("""
            INSERT INTO actores (tipo, nombre_razon_social, tipo_documento, documento_identidad, telefono, email, direccion)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, actores)

        # 3.8. Registrar stock de series de prueba para la Laptop Asus (id=1)
        # Ingresadas por una compra inicial simulada o de forma directa
        series = [
            (1, "SN-ASUS-98765123", "Disponible", None, None),
            (1, "SN-ASUS-98765124", "Disponible", None, None),
            (1, "SN-ASUS-98765125", "Disponible", None, None)
        ]
        cursor.executemany("""
            INSERT INTO producto_series (producto_id, numero_serie, estado, compra_id, venta_id)
            VALUES (?, ?, ?, ?, ?)
        """, series)
        
        # Como ingresamos 3 series físicas, actualizamos el stock del producto 1 a 3
        cursor.execute("UPDATE productos SET stock_actual = 3 WHERE id = 1")

        conn.commit()
        print("Datos semilla inicializados con éxito.")
    else:
        print("La base de datos ya contiene registros. Saltando semillas.")
        
    conn.close()
    return True

if __name__ == '__main__':
    # Asegurar que el directorio de la base de datos exista
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    init_db()
