import sqlite3
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'db.sqlite'))

def apply_migration():
    print(f"Abriendo conexión a la base de datos en: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Añadir las columnas a prestamo_detalles
        cursor.execute("ALTER TABLE prestamo_detalles ADD COLUMN tipo_precio TEXT NOT NULL DEFAULT 'Final' CHECK (tipo_precio IN ('Base', 'Final', 'Manual'))")
        cursor.execute("ALTER TABLE prestamo_detalles ADD COLUMN precio_manual REAL DEFAULT 0.00 CHECK (precio_manual >= 0)")
        conn.commit()
        print("Migración completada con éxito: Columnas 'tipo_precio' y 'precio_manual' agregadas a la tabla 'prestamo_detalles'.")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("Aviso: Las columnas ya existen en la tabla 'prestamo_detalles'.")
        else:
            print(f"Error al aplicar migración: {str(e)}")
            raise e
    finally:
        conn.close()

if __name__ == '__main__':
    apply_migration()
