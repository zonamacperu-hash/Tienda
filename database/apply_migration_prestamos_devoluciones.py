import sqlite3
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'db.sqlite'))

def apply_migration():
    print(f"Abriendo conexión a la base de datos en: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE prestamo_detalles ADD COLUMN cantidad_devuelta INTEGER DEFAULT 0")
        print("Columna 'cantidad_devuelta' agregada a prestamo_detalles.")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("Aviso: 'cantidad_devuelta' ya existe en 'prestamo_detalles'.")
        else:
            print(f"Error con cantidad_devuelta: {e}")

    try:
        cursor.execute("ALTER TABLE prestamo_detalles ADD COLUMN cantidad_vendida INTEGER DEFAULT 0")
        print("Columna 'cantidad_vendida' agregada a prestamo_detalles.")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("Aviso: 'cantidad_vendida' ya existe en 'prestamo_detalles'.")
        else:
            print(f"Error con cantidad_vendida: {e}")

    conn.commit()
    conn.close()
    print("Migración de préstamos finalizada con éxito.")

if __name__ == '__main__':
    apply_migration()
