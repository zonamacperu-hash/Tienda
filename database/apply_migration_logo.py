import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), 'db.sqlite')

def apply_migration():
    print("Aplicando migración: Agregar columna logo_path...")
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("ALTER TABLE configuracion_sistema ADD COLUMN logo_path TEXT;")
        conn.commit()
        print("Migración aplicada correctamente.")
    except sqlite3.OperationalError as e:
        print(f"Información: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    apply_migration()
