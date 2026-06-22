import sqlite3
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'db.sqlite'))

def apply_migration():
    print(f"Abriendo conexión a la base de datos en: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    # Desactivar temporalmente foreign keys para poder recrear la tabla con seguridad
    conn.execute("PRAGMA foreign_keys = OFF;")
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")
        
        # 1. Crear tabla prestamos_intertienda
        print("Creando tabla 'prestamos_intertienda' si no existe...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prestamos_intertienda (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tienda_destino_id INTEGER NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
                fecha_prestamo TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Convertido en Venta', 'Devuelto', 'Devuelto Parcial')),
                observaciones TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 2. Crear tabla prestamo_detalles
        print("Creando tabla 'prestamo_detalles' si no existe...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prestamo_detalles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prestamo_id INTEGER NOT NULL REFERENCES prestamos_intertienda(id) ON DELETE CASCADE,
                producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
                cantidad INTEGER NOT NULL CHECK (cantidad > 0)
            )
        """)

        # 3. Crear índices para préstamos
        print("Creando índices para el módulo de préstamos...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_prestamos_intertienda_tienda ON prestamos_intertienda(tienda_destino_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_prestamo_detalles_prestamo ON prestamo_detalles(prestamo_id)")

        # 4. Modificar tabla producto_series si no se ha hecho
        cursor.execute("PRAGMA table_info(producto_series)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'prestamo_id' not in columns:
            print("Recreando tabla 'producto_series' para incluir 'prestamo_id' y actualizar restricciones...")
            # Renombrar tabla actual
            cursor.execute("ALTER TABLE producto_series RENAME TO producto_series_old")
            
            # Crear nueva tabla con check actualizado y prestamo_id
            cursor.execute("""
                CREATE TABLE producto_series (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
                    numero_serie TEXT NOT NULL,
                    estado TEXT NOT NULL DEFAULT 'Disponible' CHECK (estado IN ('Disponible', 'Vendido', 'En Garantia', 'Devuelto', 'Prestado')),
                    compra_id INTEGER REFERENCES compras(id) ON DELETE RESTRICT,
                    venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
                    prestamo_id INTEGER REFERENCES prestamos_intertienda(id) ON DELETE SET NULL,
                    detalles_individuales TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_producto_serie UNIQUE (producto_id, numero_serie)
                )
            """)
            
            # Migrar datos
            cursor.execute("""
                INSERT INTO producto_series (id, producto_id, numero_serie, estado, compra_id, venta_id, detalles_individuales, created_at, updated_at)
                SELECT id, producto_id, numero_serie, estado, compra_id, venta_id, detalles_individuales, created_at, updated_at
                FROM producto_series_old
            """)
            
            # Eliminar tabla antigua
            cursor.execute("DROP TABLE producto_series_old")
            
            # Recrear índices de producto_series
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_producto_series_numero ON producto_series(numero_serie)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_producto_series_estado ON producto_series(producto_id, estado)")
            
            print("Tabla 'producto_series' recreada y migrada con éxito.")
        else:
            print("La tabla 'producto_series' ya cuenta con la columna 'prestamo_id'.")

        cursor.execute("COMMIT;")
        print("Migración completada con éxito.")
    except Exception as e:
        print(f"Error al aplicar migración: {str(e)}")
        cursor.execute("ROLLBACK;")
        raise e
    finally:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.close()

if __name__ == '__main__':
    apply_migration()
