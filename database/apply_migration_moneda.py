import sqlite3
import os

# Determinar ruta absoluta a la base de datos
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'db.sqlite'))

def apply_migration():
    print(f"Abriendo conexión a la base de datos en: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Añadir la columna 'moneda' con check constraint y default 'PEN'
        cursor.execute("ALTER TABLE productos ADD COLUMN moneda TEXT DEFAULT 'PEN' CHECK (moneda IN ('PEN', 'USD'))")
        conn.commit()
        print("Migración completada con éxito: Columna 'moneda' agregada a la tabla 'productos'.")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("Aviso: La columna 'moneda' ya existe en la tabla 'productos'.")
        else:
            print(f"Error al aplicar migración: {str(e)}")
            raise e
    finally:
        conn.close()

if __name__ == '__main__':
    apply_migration()
