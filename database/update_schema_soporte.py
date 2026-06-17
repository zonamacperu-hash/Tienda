import os
import sqlite3

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'db.sqlite'))

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def update_schema():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("Creando tablas para el módulo de Servicio Técnico...")
    
    # 1. Crear tabla ordenes_servicio
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ordenes_servicio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER REFERENCES actores(id) ON DELETE RESTRICT,
        producto_serie_id INTEGER REFERENCES producto_series(id) ON DELETE SET NULL,
        equipo_marca_modelo TEXT NOT NULL,
        numero_serie_externo TEXT,
        problema_reportado TEXT NOT NULL,
        diagnostico_tecnico TEXT,
        estado TEXT NOT NULL CHECK (estado IN ('Recibido', 'En Diagnostico', 'Reparado', 'No Reparable', 'Entregado')) DEFAULT 'Recibido',
        fecha_ingreso TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_entrega TEXT,
        garantia_servicio_meses INTEGER DEFAULT 0,
        costo_servicio REAL NOT NULL DEFAULT 0.00,
        total_pagar REAL NOT NULL DEFAULT 0.00,
        metodo_pago TEXT,
        cliente_nombre_manual TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # 2. Crear tabla orden_servicio_repuestos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orden_servicio_repuestos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_servicio_id INTEGER NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        precio_aplicado REAL NOT NULL CHECK (precio_aplicado >= 0)
    );
    """)
    
    # 3. Crear índices de optimización
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ordenes_servicio_cliente ON ordenes_servicio(cliente_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ordenes_servicio_serie ON ordenes_servicio(producto_serie_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orden_servicio_repuestos_orden ON orden_servicio_repuestos(orden_servicio_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orden_servicio_repuestos_producto ON orden_servicio_repuestos(producto_id);")
    
    # 4. Crear triggers de actualización de inventario
    # Deduct stock when a spare part is added to a technical service order
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS trg_soporte_repuesto_insert
    AFTER INSERT ON orden_servicio_repuestos
    BEGIN
        UPDATE productos
        SET stock_actual = stock_actual - NEW.cantidad
        WHERE id = NEW.producto_id;
    END;
    """)
    
    # Restore stock when a spare part is removed
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS trg_soporte_repuesto_delete
    AFTER DELETE ON orden_servicio_repuestos
    BEGIN
        UPDATE productos
        SET stock_actual = stock_actual + OLD.cantidad
        WHERE id = OLD.producto_id;
    END;
    """)
    
    # Adjust stock when quantity or product is updated
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS trg_soporte_repuesto_update
    AFTER UPDATE ON orden_servicio_repuestos
    BEGIN
        UPDATE productos
        SET stock_actual = stock_actual + OLD.cantidad
        WHERE id = OLD.producto_id;
        UPDATE productos
        SET stock_actual = stock_actual - NEW.cantidad
        WHERE id = NEW.producto_id;
    END;
    """)
    
    conn.commit()
    conn.close()
    print("Tablas y triggers creados exitosamente en la base de datos.")

if __name__ == '__main__':
    update_schema()
