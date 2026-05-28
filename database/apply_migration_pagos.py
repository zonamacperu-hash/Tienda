import sqlite3
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'db.sqlite'))

def apply_migration():
    print(f"Abriendo conexión a la base de datos en: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Check if metodo_pago column exists in ventas table
        cursor.execute("PRAGMA table_info(ventas)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'metodo_pago' in columns and 'condicion_pago' not in columns:
            print("Renombrando columna 'metodo_pago' a 'condicion_pago' en la tabla 'ventas'...")
            cursor.execute("ALTER TABLE ventas RENAME COLUMN metodo_pago TO condicion_pago")
            conn.commit()
            print("Columna renombrada con éxito.")
        else:
            print("Columna 'condicion_pago' ya existe o no se requiere renombrar.")

        # Create table venta_pagos if not exists
        print("Creando tabla 'venta_pagos'...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS venta_pagos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
                metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('Efectivo', 'Transferencia', 'Yape/Plin', 'Tarjeta')),
                monto REAL NOT NULL CHECK (monto >= 0),
                moneda TEXT NOT NULL CHECK (moneda IN ('PEN', 'USD'))
            )
        """)
        
        # Create index if not exists
        print("Creando índice 'idx_venta_pagos_venta'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta ON venta_pagos(venta_id)")
        
        conn.commit()
        print("Migración completada con éxito.")
    except Exception as e:
        print(f"Error al aplicar migración: {str(e)}")
        conn.rollback()
        raise e
    finally:
        conn.close()

if __name__ == '__main__':
    apply_migration()
