import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'db.sqlite'))

def get_db_connection():
    """Establece una conexión a la base de datos SQLite con llaves foráneas habilitadas."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def query_db(query, args=(), one=False):
    """Ejecuta una consulta SELECT y retorna los resultados como diccionarios."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(query, args)
        rv = cursor.fetchall()
        conn.close()
        # Convertir sqlite3.Row a diccionarios regulares de Python
        results = [dict(ix) for ix in rv]
        return (results[0] if results else None) if one else results
    except Exception as e:
        conn.close()
        raise e

def execute_db(query, args=()):
    """Ejecuta un comando INSERT/UPDATE/DELETE y retorna el ID del último registro insertado."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(query, args)
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return last_id
    except Exception as e:
        conn.close()
        raise e

@contextmanager
def transaction():
    """Administrador de contexto para ejecutar múltiples operaciones dentro de una transacción única."""
    conn = get_db_connection()
    conn.isolation_level = None  # Permite control manual de transacciones
    cursor = conn.cursor()
    try:
        cursor.execute("BEGIN TRANSACTION;")
        yield cursor
        cursor.execute("COMMIT;")
    except Exception as e:
        cursor.execute("ROLLBACK;")
        raise e
    finally:
        conn.close()
