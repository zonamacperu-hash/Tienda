import os
import re
from contextlib import contextmanager

# Detect database configuration from environment variables
DB_TYPE = os.getenv('DB_TYPE', 'sqlite').lower()
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'db.sqlite'))

def translate_sql_sqlite_to_mysql(sql):
    # 1. Replace placeholders ? with %s
    sql = sql.replace('?', '%s')
    
    # 2. Replace common SQLite date/time functions
    sql = re.sub(r"(?i)strftime\s*\(\s*'%Y-%m'\s*,\s*'now'\s*\)", "DATE_FORMAT(NOW(), '%Y-%m')", sql)
    sql = re.sub(r"(?i)strftime\s*\(\s*'%Y-%m'\s*,\s*([^)]+)\)", r"DATE_FORMAT(\1, '%Y-%m')", sql)
    sql = re.sub(r"(?i)date\s*\(\s*'now'\s*,\s*'localtime'\s*\)", "CURDATE()", sql)
    sql = re.sub(r"(?i)date\s*\(\s*'now'\s*\)", "CURDATE()", sql)
    sql = re.sub(r"(?i)datetime\s*\(\s*'now'\s*,\s*'localtime'\s*\)", "NOW()", sql)
    sql = re.sub(r"(?i)datetime\s*\(\s*'now'\s*\)", "NOW()", sql)
    
    # Replace CURRENT_TIMESTAMP
    sql = sql.replace("CURRENT_TIMESTAMP", "NOW()")
    
    return sql

class MySQLRow:
    """Row wrapper that provides both string and integer key lookup to mimic sqlite3.Row."""
    def __init__(self, data_tuple, column_names):
        self._data = data_tuple
        self._fields = column_names
        self._field_map = {name.lower(): idx for idx, name in enumerate(column_names)}

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._data[key]
        elif isinstance(key, str):
            idx = self._field_map.get(key.lower())
            if idx is not None:
                return self._data[idx]
            raise KeyError(key)
        raise TypeError("Indices must be integers or strings")

    def keys(self):
        return self._fields

    def values(self):
        return self._data

    def __iter__(self):
        return iter(self._data)

    def __repr__(self):
        return str(dict(self))

class SafeCursorWrapper:
    """Cursor wrapper that translates SQLite queries to MySQL query syntax dynamically."""
    def __init__(self, cursor, is_mysql=False):
        self.cursor = cursor
        self.is_mysql = is_mysql

    def execute(self, query, args=None):
        if self.is_mysql:
            query = translate_sql_sqlite_to_mysql(query)
            if args is not None:
                if isinstance(args, dict):
                    pass
                elif not isinstance(args, (list, tuple)):
                    args = (args,)
        
        if args is None:
            self.cursor.execute(query)
        else:
            self.cursor.execute(query, args)
        return self

    def _wrap_row(self, row):
        if row is None:
            return None
        if self.is_mysql and self.cursor.description:
            column_names = [desc[0] for desc in self.cursor.description]
            return MySQLRow(row, column_names)
        return row

    def fetchone(self):
        row = self.cursor.fetchone()
        return self._wrap_row(row)

    def fetchall(self):
        rows = self.cursor.fetchall()
        if self.is_mysql:
            return [self._wrap_row(r) for r in rows]
        return rows

    @property
    def lastrowid(self):
        return self.cursor.lastrowid

    def __iter__(self):
        while True:
            row = self.fetchone()
            if row is None:
                break
            yield row

    def __getattr__(self, name):
        return getattr(self.cursor, name)

def get_db_connection():
    global DB_TYPE, DB_PATH
    if DB_TYPE == 'mysql':
        import pymysql
        conn = pymysql.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 3306)),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'tienda'),
            autocommit=True
        )
        # Enable PIPES_AS_CONCAT mode so that SQLite '||' concatenation works out of the box
        with conn.cursor() as cursor:
            cursor.execute("SET SESSION sql_mode='PIPES_AS_CONCAT,NO_ENGINE_SUBSTITUTION'")
        return conn
    else:
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

def query_db(query, args=(), one=False):
    conn = get_db_connection()
    cursor = conn.cursor()
    wrapped_cursor = SafeCursorWrapper(cursor, is_mysql=(DB_TYPE == 'mysql'))
    try:
        wrapped_cursor.execute(query, args)
        rv = wrapped_cursor.fetchall()
        conn.close()
        results = [dict(ix) for ix in rv]
        return (results[0] if results else None) if one else results
    except Exception as e:
        conn.close()
        raise e

def execute_db(query, args=()):
    conn = get_db_connection()
    cursor = conn.cursor()
    wrapped_cursor = SafeCursorWrapper(cursor, is_mysql=(DB_TYPE == 'mysql'))
    try:
        wrapped_cursor.execute(query, args)
        if DB_TYPE != 'mysql':
            conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return last_id
    except Exception as e:
        if DB_TYPE != 'mysql':
            conn.rollback()
        conn.close()
        raise e

@contextmanager
def transaction():
    conn = get_db_connection()
    is_mysql = (DB_TYPE == 'mysql')
    if is_mysql:
        conn.autocommit(False)
    else:
        conn.isolation_level = None
    
    cursor = conn.cursor()
    wrapped_cursor = SafeCursorWrapper(cursor, is_mysql=is_mysql)
    try:
        if is_mysql:
            cursor.execute("START TRANSACTION;")
        else:
            cursor.execute("BEGIN TRANSACTION;")
        
        yield wrapped_cursor
        
        if is_mysql:
            conn.commit()
        else:
            cursor.execute("COMMIT;")
    except Exception as e:
        if is_mysql:
            conn.rollback()
        else:
            cursor.execute("ROLLBACK;")
        raise e
    finally:
        conn.close()
