import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), 'db.sqlite')

def apply_migration():
    print(f"Aplicando migración Fase 3 a la base de datos en: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("ERROR: La base de datos db.sqlite no existe. Inicie la app con run.sh primero.")
        return False
        
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = OFF;") # Apagar llaves foráneas para reestructurar
    cursor = conn.cursor()
    
    try:
        cursor.execute("BEGIN TRANSACTION;")
        
        # 1. Validar si la migración ya fue aplicada (validando si la columna cliente_nombre_manual existe en ventas)
        cursor.execute("PRAGMA table_info(ventas)")
        columns = [c[1] for c in cursor.fetchall()]
        
        if "cliente_nombre_manual" in columns:
            print("La columna 'cliente_nombre_manual' ya existe. Saltando migración estructural de ventas.")
        else:
            print("Reestructurando tabla 'ventas' para permitir cliente_id NULL y añadir cliente_nombre_manual...")
            
            # A. Crear tabla temporal
            cursor.execute("""
                CREATE TABLE ventas_temp (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cliente_id INTEGER REFERENCES actores(id) ON DELETE RESTRICT,
                    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
                    tipo_comprobante TEXT NOT NULL CHECK (tipo_comprobante IN ('Factura', 'Boleta', 'Guia de Remision', 'Ticket')),
                    serie_comprobante TEXT NOT NULL,
                    correlativo_comprobante TEXT NOT NULL,
                    fecha_venta TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    moneda TEXT NOT NULL CHECK (moneda IN ('PEN', 'USD')),
                    tipo_cambio REAL NOT NULL CHECK (tipo_cambio > 0),
                    metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('Contado', 'Credito')),
                    fecha_vencimiento TEXT,
                    subtotal REAL NOT NULL DEFAULT 0.00,
                    igv REAL NOT NULL DEFAULT 0.00,
                    total REAL NOT NULL DEFAULT 0.00,
                    estado TEXT DEFAULT 'Completada' NOT NULL CHECK (estado IN ('Completada', 'Anulada')),
                    observaciones TEXT,
                    cliente_nombre_manual TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            """)
            
            # B. Copiar datos históricos
            cursor.execute("""
                INSERT INTO ventas_temp (
                    id, cliente_id, usuario_id, tipo_comprobante, serie_comprobante, correlativo_comprobante,
                    fecha_venta, moneda, tipo_cambio, metodo_pago, fecha_vencimiento, subtotal, igv, total, estado, observaciones, created_at
                )
                SELECT 
                    id, cliente_id, usuario_id, tipo_comprobante, serie_comprobante, correlativo_comprobante,
                    fecha_venta, moneda, tipo_cambio, metodo_pago, fecha_vencimiento, subtotal, igv, total, estado, observaciones, created_at
                FROM ventas;
            """)
            
            # C. Eliminar tabla original y renombrar
            cursor.execute("DROP TABLE ventas;")
            cursor.execute("ALTER TABLE ventas_temp RENAME TO ventas;")
            
            # D. Recrear índices y triggers de la tabla ventas
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);")
            cursor.execute("""
                CREATE TRIGGER IF NOT EXISTS trg_venta_anulada
                AFTER UPDATE OF estado ON ventas
                WHEN NEW.estado = 'Anulada' AND OLD.estado != 'Anulada'
                BEGIN
                    UPDATE productos
                    SET stock_actual = stock_actual + (
                        SELECT COALESCE(SUM(vd.cantidad), 0)
                        FROM venta_detalles vd
                        WHERE vd.venta_id = NEW.id AND vd.producto_id = productos.id
                    )
                    WHERE id IN (SELECT producto_id FROM venta_detalles WHERE venta_id = NEW.id);

                    UPDATE producto_series
                    SET estado = 'Disponible', venta_id = NULL
                    WHERE venta_id = NEW.id;
                END;
            """)
            print("Tabla 'ventas' reestructurada con éxito.")

        # 2. Validar y añadir columna 'detalles_tecnicos' a 'productos'
        cursor.execute("PRAGMA table_info(productos)")
        columns_prod = [c[1] for c in cursor.fetchall()]
        if "detalles_tecnicos" not in columns_prod:
            print("Añadiendo columna 'detalles_tecnicos' a tabla 'productos'...")
            cursor.execute("ALTER TABLE productos ADD COLUMN detalles_tecnicos TEXT;")
        else:
            print("La columna 'detalles_tecnicos' ya existe en 'productos'.")

        # 3. Validar y añadir columna 'detalles_individuales' a 'producto_series'
        cursor.execute("PRAGMA table_info(producto_series)")
        columns_series = [c[1] for c in cursor.fetchall()]
        if "detalles_individuales" not in columns_series:
            print("Añadiendo columna 'detalles_individuales' a tabla 'producto_series'...")
            cursor.execute("ALTER TABLE producto_series ADD COLUMN detalles_individuales TEXT;")
        else:
            print("La columna 'detalles_individuales' ya existe en 'producto_series'.")

        conn.commit()
        print("Migración aplicada exitosamente.")
        conn.close()
        return True
        
    except Exception as e:
        conn.rollback()
        conn.close()
        print(f"Error crítico al aplicar la migración: {e}")
        return False

if __name__ == '__main__':
    apply_migration()
