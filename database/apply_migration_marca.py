import sqlite3
import os

# Determinar ruta absoluta a la base de datos
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'db.sqlite'))

def apply_migration():
    print(f"Abriendo conexión a la base de datos en: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print(f"ERROR: No se encontró la base de datos en {DB_PATH}.")
        return False
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        # Añadir la columna 'marca'
        cursor.execute("ALTER TABLE productos ADD COLUMN marca TEXT DEFAULT '';")
        conn.commit()
        print("Migración completada con éxito: Columna 'marca' agregada a la tabla 'productos'.")
        return True
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
            print("Aviso: La columna 'marca' ya existe en la tabla 'productos'.")
            return True
        else:
            print(f"Error al aplicar migración: {str(e)}")
            return False
    finally:
        conn.close()

if __name__ == '__main__':
    apply_migration()
