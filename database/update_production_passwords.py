#!/usr/bin/env python3
import os
import sqlite3
import getpass
from werkzeug.security import generate_password_hash

# Ruta de la base de datos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'db.sqlite')

def get_db_connection():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"No se encontró la base de datos en: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def update_user(cursor, role_name, default_username):
    print(f"\n--- Configurando Credenciales para el Rol: {role_name} ---")
    
    # Obtener el usuario actual
    cursor.execute("SELECT id, username, nombre FROM usuarios WHERE rol = ?", (role_name,))
    user = cursor.fetchone()
    
    if not user:
        print(f"Advertencia: No se encontró ningún usuario con el rol '{role_name}' en la base de datos.")
        return False
        
    print(f"Usuario actual: {user['nombre']} (username: '{user['username']}')")
    
    # 1. Solicitar nuevo username (opcional, ENTER mantiene el actual)
    new_username = input(f"Ingrese nuevo nombre de usuario [{user['username']}]: ").strip()
    if not new_username:
        new_username = user['username']
        
    # 2. Solicitar nueva contraseña de forma oculta
    while True:
        password = getpass.getpass("Ingrese nueva contraseña segura (no se mostrará en pantalla): ")
        if not password:
            print("Error: La contraseña no puede estar vacía.")
            continue
        confirm = getpass.getpass("Confirme la contraseña: ")
        if password != confirm:
            print("Error: Las contraseñas no coinciden. Intente de nuevo.")
            continue
        break
        
    # 3. Generar hash de contraseña con algoritmo compatible pbkdf2:sha256
    password_hash = generate_password_hash(password, method='pbkdf2:sha256')
    
    # 4. Actualizar en la base de datos
    cursor.execute("""
        UPDATE usuarios
        SET username = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (new_username, password_hash, user['id']))
    
    print(f"¡Credenciales actualizadas con éxito para {user['nombre']}!")
    return True

def main():
    print("======================================================================")
    print("      UTILITARIO DE ACTUALIZACIÓN DE CREDENCIALES DE PRODUCCIÓN       ")
    print("======================================================================")
    print(f"Base de datos objetivo: {DB_PATH}")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Iniciar transacción
        cursor.execute("BEGIN TRANSACTION;")
        
        # Actualizar cada uno de los tres roles principales
        success_admin = update_user(cursor, "Administrador", "admin")
        success_almacen = update_user(cursor, "Almacenero", "almacen")
        success_vendedor = update_user(cursor, "Vendedor", "vendedor")
        
        if success_admin or success_almacen or success_vendedor:
            conn.commit()
            print("\n======================================================================")
            print("¡CAMBIOS GUARDADOS CORRECTAMENTE EN LA BASE DE DATOS!")
            print("======================================================================")
        else:
            conn.rollback()
            print("\nNo se realizaron cambios en la base de datos.")
            
        conn.close()
    except Exception as e:
        print(f"\nERROR: Ocurrió un fallo durante la actualización: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
            conn.close()

if __name__ == '__main__':
    main()
