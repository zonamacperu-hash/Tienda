import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import check_password_hash
from PIL import Image
import io

# Asegurar que el directorio raíz esté en el path para importar módulos internos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server.database import query_db, execute_db, transaction
from server.sales_processor import procesar_venta_transaccional

app = Flask(__name__, static_folder='../static', static_url_path='')
CORS(app)  # Habilitar CORS para desarrollo local

# ==============================================================================
# ENRUTAMIENTO ESTÁTICO (SPA)
# ==============================================================================
@app.route('/')
def index():
    return app.send_static_file('index.html')

# ==============================================================================
# MÓDULO: AUTENTICACIÓN
# ==============================================================================
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"exito": False, "mensaje": "Faltan credenciales"}), 400
        
    user = query_db("SELECT * FROM usuarios WHERE username = ? AND activo = 1", [username], one=True)
    
    if user and check_password_hash(user['password_hash'], password):
        return jsonify({
            "exito": True,
            "usuario": {
                "id": user['id'],
                "nombre": user['nombre'],
                "username": user['username'],
                "email": user['email'],
                "rol": user['rol']
            }
        })
        
    return jsonify({"exito": False, "mensaje": "Usuario o contraseña incorrectos"}), 401

# ==============================================================================
# MÓDULO: CONFIGURACIÓN Y TIPO DE CAMBIO
# ==============================================================================
@app.route('/api/config', methods=['GET', 'PUT'])
def config_sistema():
    if request.method == 'GET':
        config = query_db("SELECT * FROM configuracion_sistema LIMIT 1", one=True)
        return jsonify(config if config else {})
        
    elif request.method == 'PUT':
        data = request.json
        usuario_id = data.get('usuario_id', 1)  # ID por defecto en caso no se envíe
        
        # Validar configuración existente
        config_existente = query_db("SELECT * FROM configuracion_sistema LIMIT 1", one=True)
        
        nuevo_tc = float(data.get('tipo_cambio_actual', 3.7500))
        
        if config_existente:
            tc_anterior = float(config_existente['tipo_cambio_actual'])
            
            execute_db("""
                UPDATE configuracion_sistema
                SET empresa_nombre = ?, empresa_ruc = ?, empresa_direccion = ?,
                    empresa_telefono = ?, empresa_email = ?, moneda_defecto = ?,
                    tipo_cambio_actual = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                data.get('empresa_nombre'),
                data.get('empresa_ruc'),
                data.get('empresa_direccion'),
                data.get('empresa_telefono'),
                data.get('empresa_email'),
                data.get('moneda_defecto', 'PEN'),
                nuevo_tc,
                config_existente['id']
            ))
            
            # Registrar en el historial de tipo de cambio si cambió
            if nuevo_tc != tc_anterior:
                execute_db("""
                    INSERT OR REPLACE INTO historial_tipo_cambio (fecha, tipo_cambio, usuario_id)
                    VALUES (date('now'), ?, ?)
                """, (nuevo_tc, usuario_id))
        else:
            execute_db("""
                INSERT INTO configuracion_sistema (
                    empresa_nombre, empresa_ruc, empresa_direccion, empresa_telefono,
                    empresa_email, moneda_defecto, tipo_cambio_actual
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('empresa_nombre'),
                data.get('empresa_ruc'),
                data.get('empresa_direccion'),
                data.get('empresa_telefono'),
                data.get('empresa_email'),
                data.get('moneda_defecto', 'PEN'),
                nuevo_tc
            ))
            
            execute_db("""
                INSERT OR REPLACE INTO historial_tipo_cambio (fecha, tipo_cambio, usuario_id)
                VALUES (date('now'), ?, ?)
            """, (nuevo_tc, usuario_id))
            
        return jsonify({"exito": True, "mensaje": "Configuración actualizada con éxito."})

# ==============================================================================
# MÓDULO: CONFIGURACIÓN - LOGOTIPO
# ==============================================================================
@app.route('/api/config/logo', methods=['POST', 'DELETE'])
def gestionar_logo():
    if request.method == 'POST':
        if 'logo' not in request.files:
            return jsonify({"exito": False, "mensaje": "No se subió ningún archivo de logotipo."}), 400
        
        file = request.files['logo']
        if file.filename == '':
            return jsonify({"exito": False, "mensaje": "El nombre de archivo está vacío."}), 400
        
        # Validar tipo de archivo
        extension = os.path.splitext(file.filename)[1].lower()
        if extension not in ['.png', '.jpg', '.jpeg']:
            return jsonify({"exito": False, "mensaje": "Formato no permitido. Solo se aceptan imágenes PNG, JPG y JPEG."}), 400
        
        # Validar tamaño del archivo (máximo 2 MB)
        file.seek(0, os.SEEK_END)
        file_length = file.tell()
        if file_length > 2 * 1024 * 1024:
            return jsonify({"exito": False, "mensaje": "El archivo excede el tamaño máximo permitido de 2 MB."}), 400
        
        # Regresar cursor al principio
        file.seek(0)
        
        try:
            # Procesar con Pillow
            img = Image.open(file.stream)
            # Asegurar canal alfa para transparencia
            img = img.convert("RGBA")
            # Redimensionar usando thumbnail para mantener aspecto y no deformar
            img.thumbnail((300, 300), Image.Resampling.LANCZOS)
            
            # Asegurar directorio de almacenamiento
            storage_dir = os.path.abspath(os.path.join(app.static_folder, 'storage'))
            os.makedirs(storage_dir, exist_ok=True)
            
            save_path = os.path.join(storage_dir, 'logo_empresa.png')
            
            # Guardar como PNG transparente
            img.save(save_path, "PNG")
            
            # Registrar ruta en la base de datos
            logo_rel_path = '/storage/logo_empresa.png'
            execute_db("UPDATE configuracion_sistema SET logo_path = ? WHERE id = (SELECT id FROM configuracion_sistema LIMIT 1)", [logo_rel_path])
            
            return jsonify({
                "exito": True,
                "logo_path": logo_rel_path,
                "mensaje": "Logotipo subido y optimizado con éxito."
            })
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error al procesar la imagen: {str(e)}"}), 500
            
    elif request.method == 'DELETE':
        try:
            # Obtener logo anterior
            config = query_db("SELECT logo_path FROM configuracion_sistema LIMIT 1", one=True)
            if config and config['logo_path']:
                logo_file_path = os.path.abspath(os.path.join(app.static_folder, config['logo_path'].lstrip('/')))
                if os.path.exists(logo_file_path):
                    os.remove(logo_file_path)
            
            # Limpiar en base de datos
            execute_db("UPDATE configuracion_sistema SET logo_path = NULL WHERE id = (SELECT id FROM configuracion_sistema LIMIT 1)")
            return jsonify({"exito": True, "mensaje": "Logotipo eliminado con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error al eliminar el logotipo: {str(e)}"}), 500

# ==============================================================================
# MÓDULO: CATEGORÍAS
# ==============================================================================
@app.route('/api/categorias', methods=['GET', 'POST'])
def categorias():
    if request.method == 'GET':
        cats = query_db("SELECT * FROM categorias ORDER BY nombre ASC")
        return jsonify(cats)
    elif request.method == 'POST':
        data = request.json
        try:
            cat_id = execute_db(
                "INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)",
                [data.get('nombre'), data.get('descripcion', '')]
            )
            return jsonify({"exito": True, "id": cat_id, "mensaje": "Categoría creada con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/categorias/<int:id>', methods=['PUT', 'DELETE'])
def categoria_detalle(id):
    if request.method == 'PUT':
        data = request.json
        try:
            execute_db(
                "UPDATE categorias SET nombre = ?, descripcion = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [data.get('nombre'), data.get('descripcion', ''), id]
            )
            return jsonify({"exito": True, "mensaje": "Categoría actualizada con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400
            
    elif request.method == 'DELETE':
        # Validar si tiene productos
        prod_count = query_db("SELECT COUNT(*) FROM productos WHERE categoria_id = ?", [id], one=True)
        if prod_count and prod_count['COUNT(*)'] > 0:
            return jsonify({"exito": False, "mensaje": "No se puede eliminar una categoría que contiene productos vinculados."}), 400
            
        execute_db("DELETE FROM categorias WHERE id = ?", [id])
        return jsonify({"exito": True, "mensaje": "Categoría eliminada con éxito."})

# ==============================================================================
# MÓDULO: PRODUCTOS & NÚMEROS DE SERIE
# ==============================================================================
@app.route('/api/productos', methods=['GET', 'POST'])
def productos():
    if request.method == 'GET':
        query = """
            SELECT p.*, c.nombre as categoria_nombre 
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ORDER BY p.nombre ASC
        """
        prods = query_db(query)
        return jsonify(prods)
        
    elif request.method == 'POST':
        data = request.json
        moneda = data.get('moneda', 'PEN')
        if moneda not in ('PEN', 'USD'):
            return jsonify({"exito": False, "mensaje": "Moneda inválida. Debe ser PEN o USD."}), 400
        try:
            prod_id = execute_db(
                """
                INSERT INTO productos (
                    categoria_id, nombre, descripcion, maneja_series, stock_minimo, stock_actual, precio_base, precio_final, moneda, detalles_tecnicos
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
                """,
                (
                    data.get('categoria_id'),
                    data.get('nombre'),
                    data.get('descripcion', ''),
                    1 if data.get('maneja_series') else 0,
                    data.get('stock_minimo', 0),
                    data.get('precio_base', 0.0),
                    data.get('precio_final', 0.0),
                    moneda,
                    data.get('detalles_tecnicos', '')
                )
            )
            return jsonify({"exito": True, "id": prod_id, "mensaje": "Producto registrado con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/productos/<int:id>', methods=['PUT', 'DELETE'])
def producto_detalle(id):
    if request.method == 'PUT':
        data = request.json
        moneda = data.get('moneda', 'PEN')
        if moneda not in ('PEN', 'USD'):
            return jsonify({"exito": False, "mensaje": "Moneda inválida. Debe ser PEN o USD."}), 400
        try:
            # Si cambia 'maneja_series' y ya hay transacciones, podría ser peligroso, pero permitiremos actualizar los campos
            execute_db(
                """
                UPDATE productos 
                SET categoria_id = ?, nombre = ?, descripcion = ?, stock_minimo = ?,
                    precio_base = ?, precio_final = ?, moneda = ?, detalles_tecnicos = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    data.get('categoria_id'),
                    data.get('nombre'),
                    data.get('descripcion', ''),
                    data.get('stock_minimo', 0),
                    data.get('precio_base', 0.0),
                    data.get('precio_final', 0.0),
                    moneda,
                    data.get('detalles_tecnicos', ''),
                    id
                )
            )
            return jsonify({"exito": True, "mensaje": "Producto actualizado con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400
            
    elif request.method == 'DELETE':
        # Validar si tiene compras/ventas
        det_compras = query_db("SELECT COUNT(*) FROM compra_detalles WHERE producto_id = ?", [id], one=True)
        det_ventas = query_db("SELECT COUNT(*) FROM venta_detalles WHERE producto_id = ?", [id], one=True)
        
        if (det_compras and det_compras['COUNT(*)'] > 0) or (det_ventas and det_ventas['COUNT(*)'] > 0):
            return jsonify({"exito": False, "mensaje": "No se puede eliminar un producto con historial de compras o ventas."}), 400
            
        # Eliminar series físicas y luego producto
        execute_db("DELETE FROM producto_series WHERE producto_id = ?", [id])
        execute_db("DELETE FROM productos WHERE id = ?", [id])
        return jsonify({"exito": True, "mensaje": "Producto eliminado con éxito."})

@app.route('/api/productos/<int:id>/series', methods=['GET'])
def producto_series(id):
    series = query_db("SELECT * FROM producto_series WHERE producto_id = ? ORDER BY numero_serie ASC", [id])
    return jsonify(series)

@app.route('/api/inventario/movimientos', methods=['GET'])
def get_movimientos_inventario():
    fecha_inicio = request.args.get('fecha_inicio')
    fecha_fin = request.args.get('fecha_fin')
    categoria_id = request.args.get('categoria_id')
    producto_id = request.args.get('producto_id')
    tipo_movimiento = request.args.get('tipo_movimiento', 'Todos')
    numero_serie = request.args.get('numero_serie')
    cliente_filtro = request.args.get('cliente_filtro')

    params_compras = []
    params_ventas = []

    # 1. Filtros de Compras (Entradas)
    where_compras = ["c.estado = 'Completada'"]
    if cliente_filtro:
        where_compras.append("1 = 0")
    if fecha_inicio:
        where_compras.append("date(c.fecha_compra) >= ?")
        params_compras.append(fecha_inicio)
    if fecha_fin:
        where_compras.append("date(c.fecha_compra) <= ?")
        params_compras.append(fecha_fin)
    if categoria_id:
        where_compras.append("p.categoria_id = ?")
        params_compras.append(int(categoria_id))
    if producto_id:
        where_compras.append("p.id = ?")
        params_compras.append(int(producto_id))
    if numero_serie:
        where_compras.append("ps.numero_serie LIKE ?")
        params_compras.append(f"%{numero_serie}%")

    # 2. Filtros de Ventas (Salidas)
    where_ventas = ["v.estado = 'Completada'"]
    if cliente_filtro:
        if cliente_filtro.isdigit():
            where_ventas.append("(v.cliente_id = ? OR act.nombre_razon_social LIKE ? OR v.cliente_nombre_manual LIKE ?)")
            val = int(cliente_filtro)
            txt = f"%{cliente_filtro}%"
            params_ventas.extend([val, txt, txt])
        else:
            where_ventas.append("(act.nombre_razon_social LIKE ? OR v.cliente_nombre_manual LIKE ?)")
            txt = f"%{cliente_filtro}%"
            params_ventas.extend([txt, txt])
    if fecha_inicio:
        where_ventas.append("date(v.fecha_venta) >= ?")
        params_ventas.append(fecha_inicio)
    if fecha_fin:
        where_ventas.append("date(v.fecha_venta) <= ?")
        params_ventas.append(fecha_fin)
    if categoria_id:
        where_ventas.append("p.categoria_id = ?")
        params_ventas.append(int(categoria_id))
    if producto_id:
        where_ventas.append("p.id = ?")
        params_ventas.append(int(producto_id))
    if numero_serie:
        where_ventas.append("ps.numero_serie LIKE ?")
        params_ventas.append(f"%{numero_serie}%")

    # 3. Construir Queries
    query_compras = f"""
        SELECT 
            c.fecha_compra AS fecha,
            'Entrada' AS tipo_movimiento,
            p.id AS producto_id,
            p.nombre AS producto_nombre,
            p.maneja_series AS maneja_series,
            cat.id AS categoria_id,
            cat.nombre AS categoria_nombre,
            CASE WHEN p.maneja_series = 1 THEN 1 ELSE cd.cantidad END AS cantidad,
            c.tipo_comprobante || ' ' || c.serie_comprobante || '-' || c.correlativo_comprobante AS documento,
            a.nombre_razon_social AS actor_nombre,
            c.moneda AS moneda,
            cd.precio_unitario AS precio_unitario,
            CASE WHEN p.maneja_series = 1 THEN ps.numero_serie ELSE NULL END AS numero_serie
        FROM compra_detalles cd
        JOIN compras c ON cd.compra_id = c.id
        JOIN productos p ON cd.producto_id = p.id
        LEFT JOIN categorias cat ON p.categoria_id = cat.id
        LEFT JOIN actores a ON c.proveedor_id = a.id
        LEFT JOIN producto_series ps ON p.maneja_series = 1 AND ps.compra_id = c.id AND ps.producto_id = p.id
        WHERE {" AND ".join(where_compras)}
    """

    query_ventas = f"""
        SELECT 
            v.fecha_venta AS fecha,
            'Salida' AS tipo_movimiento,
            p.id AS producto_id,
            p.nombre AS producto_nombre,
            p.maneja_series AS maneja_series,
            cat.id AS categoria_id,
            cat.nombre AS categoria_nombre,
            CASE WHEN p.maneja_series = 1 THEN 1 ELSE vd.cantidad END AS cantidad,
            v.tipo_comprobante || ' ' || v.serie_comprobante || '-' || v.correlativo_comprobante AS documento,
            COALESCE(act.nombre_razon_social, v.cliente_nombre_manual) AS actor_nombre,
            v.moneda AS moneda,
            vd.precio_unitario AS precio_unitario,
            CASE WHEN p.maneja_series = 1 THEN ps.numero_serie ELSE NULL END AS numero_serie
        FROM venta_detalles vd
        JOIN ventas v ON vd.venta_id = v.id
        JOIN productos p ON vd.producto_id = p.id
        LEFT JOIN categorias cat ON p.categoria_id = cat.id
        LEFT JOIN actores act ON v.cliente_id = act.id
        LEFT JOIN producto_series ps ON p.maneja_series = 1 AND ps.venta_id = v.id AND ps.producto_id = p.id
        WHERE {" AND ".join(where_ventas)}
    """

    # Combinar según tipo de movimiento
    if tipo_movimiento == 'Entrada':
        sql = f"SELECT * FROM ({query_compras}) ORDER BY fecha DESC"
        params = params_compras
    elif tipo_movimiento == 'Salida':
        sql = f"SELECT * FROM ({query_ventas}) ORDER BY fecha DESC"
        params = params_ventas
    else:
        sql = f"SELECT * FROM ({query_compras} UNION ALL {query_ventas}) ORDER BY fecha DESC"
        params = params_compras + params_ventas

    try:
        movimientos = query_db(sql, params)
        return jsonify(movimientos)
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error al consultar kárdex: {str(e)}"}), 400

# ==============================================================================
# MÓDULO: ACTORES (Clientes & Proveedores)
# ==============================================================================
@app.route('/api/actores', methods=['GET', 'POST'])
def actores():
    if request.method == 'GET':
        tipo = request.args.get('tipo')
        if tipo:
            actors = query_db("SELECT * FROM actores WHERE tipo = ? OR tipo = 'Ambos' ORDER BY nombre_razon_social ASC", [tipo])
        else:
            actors = query_db("SELECT * FROM actores ORDER BY nombre_razon_social ASC")
        return jsonify(actors)
        
    elif request.method == 'POST':
        data = request.json
        try:
            actor_id = execute_db(
                """
                INSERT INTO actores (
                    tipo, nombre_razon_social, tipo_documento, documento_identidad, telefono, email, direccion
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    data.get('tipo'),
                    data.get('nombre_razon_social'),
                    data.get('tipo_documento'),
                    data.get('documento_identidad'),
                    data.get('telefono', ''),
                    data.get('email', ''),
                    data.get('direccion', '')
                )
            )
            return jsonify({"exito": True, "id": actor_id, "mensaje": "Actor registrado con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/actores/<int:id>', methods=['PUT', 'DELETE'])
def actor_detalle(id):
    if request.method == 'PUT':
        data = request.json
        try:
            execute_db(
                """
                UPDATE actores
                SET tipo = ?, nombre_razon_social = ?, tipo_documento = ?, 
                    documento_identidad = ?, telefono = ?, email = ?, direccion = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    data.get('tipo'),
                    data.get('nombre_razon_social'),
                    data.get('tipo_documento'),
                    data.get('documento_identidad'),
                    data.get('telefono', ''),
                    data.get('email', ''),
                    data.get('direccion', ''),
                    id
                )
            )
            return jsonify({"exito": True, "mensaje": "Datos actualizados con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400
            
    elif request.method == 'DELETE':
        # Validar vinculación
        compras_count = query_db("SELECT COUNT(*) FROM compras WHERE proveedor_id = ?", [id], one=True)
        ventas_count = query_db("SELECT COUNT(*) FROM ventas WHERE cliente_id = ?", [id], one=True)
        
        if (compras_count and compras_count['COUNT(*)'] > 0) or (ventas_count and ventas_count['COUNT(*)'] > 0):
            return jsonify({"exito": False, "mensaje": "No se puede eliminar un cliente/proveedor con historial de transacciones."}), 400
            
        execute_db("DELETE FROM actores WHERE id = ?", [id])
        return jsonify({"exito": True, "mensaje": "Actor eliminado con éxito."})

@app.route('/api/actores/<int:id>/estado-cuenta', methods=['GET'])
def actor_estado_cuenta(id):
    # Cuentas por cobrar (ventas)
    por_cobrar = query_db("""
        SELECT c.*, v.serie_comprobante || '-' || v.correlativo_comprobante as documento, v.fecha_venta as fecha
        FROM cuentas_por_cobrar c
        JOIN ventas v ON c.venta_id = v.id
        WHERE c.cliente_id = ?
        ORDER BY c.fecha_vencimiento ASC
    """, [id])
    
    # Cuentas por pagar (compras)
    por_pagar = query_db("""
        SELECT p.*, c.serie_comprobante || '-' || c.correlativo_comprobante as documento, c.fecha_compra as fecha
        FROM cuentas_por_pagar p
        JOIN compras c ON p.compra_id = c.id
        WHERE p.proveedor_id = ?
        ORDER BY p.fecha_vencimiento ASC
    """, [id])
    
    return jsonify({
        "por_cobrar": por_cobrar,
        "por_pagar": por_pagar
    })

# ==============================================================================
# MÓDULO: COMPRAS (Abastecimiento Multi-ítem)
# ==============================================================================
@app.route('/api/compras', methods=['GET', 'POST'])
def compras():
    if request.method == 'GET':
        query = """
            SELECT c.*, a.nombre_razon_social as proveedor_nombre, u.nombre as usuario_nombre
            FROM compras c
            JOIN actores a ON c.proveedor_id = a.id
            JOIN usuarios u ON c.usuario_id = u.id
            ORDER BY c.fecha_compra DESC
        """
        compras_list = query_db(query)
        return jsonify(compras_list)
        
    elif request.method == 'POST':
        data = request.json
        try:
            with transaction() as cursor:
                proveedor_id = data.get('proveedor_id')
                tipo_comprobante = data.get('tipo_comprobante')
                
                # Cargar y validar proveedor
                proveedor = cursor.execute(
                    "SELECT id, nombre_razon_social, tipo_documento, documento_identidad FROM actores WHERE id = ? AND (tipo = 'Proveedor' OR tipo = 'Ambos')",
                    (proveedor_id,)
                ).fetchone()
                if not proveedor:
                    raise ValueError("El proveedor seleccionado no es válido o no existe.")
                
                if tipo_comprobante == "Factura":
                    doc_tipo = proveedor[2]
                    doc_num = (proveedor[3] or "").strip()
                    if doc_tipo != "RUC":
                        raise ValueError(f"El proveedor seleccionado no cuenta con RUC (tipo registrado: {doc_tipo}). Las facturas exigen RUC obligatoriamente.")
                    if len(doc_num) != 11 or not doc_num.startswith(("10", "20")) or not doc_num.isdigit():
                        raise ValueError("El RUC del proveedor registrado no es válido. Debe tener 11 dígitos numéricos y comenzar con 10 o 20.")
                
                # Calcular total consolidado de los items
                total_calculado = 0.0
                for item in data.get('items', []):
                    qty = int(item.get('cantidad'))
                    precio_un = float(item.get('precio_unitario'))
                    total_calculado += precio_un * qty
                
                # Asignar subtotal e igv según tipo_comprobante
                if tipo_comprobante == "Factura":
                    subtotal = total_calculado / 1.18
                    igv = total_calculado - subtotal
                else:
                    subtotal = total_calculado
                    igv = 0.00
                total = total_calculado
                
                tc = float(data.get('tipo_cambio', 3.7500))
                
                cursor.execute(
                    """
                    INSERT INTO compras (
                        proveedor_id, usuario_id, tipo_comprobante, serie_comprobante, correlativo_comprobante,
                        fecha_compra, moneda, tipo_cambio, metodo_pago, fecha_vencimiento, subtotal, igv, total, estado, observaciones
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, 'Completada', ?)
                    """,
                    (
                        data.get('proveedor_id'),
                        data.get('usuario_id'),
                        data.get('tipo_comprobante'),
                        data.get('serie_comprobante'),
                        data.get('correlativo_comprobante'),
                        data.get('moneda'),
                        tc,
                        data.get('metodo_pago'),
                        data.get('fecha_vencimiento') if data.get('metodo_pago') == 'Credito' else None,
                        subtotal,
                        igv,
                        total,
                        data.get('observaciones', '')
                    )
                )
                compra_id = cursor.lastrowid
                
                # 2. Insertar Detalles e ingresar Series
                for item in data.get('items', []):
                    prod_id = item.get('producto_id')
                    qty = int(item.get('cantidad'))
                    precio_un = float(item.get('precio_unitario'))
                    item_sub = precio_un * qty
                    
                    cursor.execute(
                        """
                        INSERT INTO compra_detalles (compra_id, producto_id, cantidad, precio_unitario, subtotal)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (compra_id, prod_id, qty, precio_un, item_sub)
                    )
                    
                    # Si el producto maneja series, insertamos los números de serie únicos
                    producto = cursor.execute("SELECT maneja_series FROM productos WHERE id = ?", (prod_id,)).fetchone()
                    if producto and producto[0] == 1:
                        series = item.get('series', [])
                        if len(series) != qty:
                            raise ValueError(f"Debe registrar exactamente {qty} series para el producto seleccionado.")
                            
                        for s_item in series:
                            if isinstance(s_item, dict):
                                sn = s_item.get('numero_serie')
                                det_ind = s_item.get('detalles_individuales', '')
                            else:
                                sn = s_item
                                det_ind = ''
                            
                            cursor.execute(
                                """
                                INSERT INTO producto_series (producto_id, numero_serie, estado, compra_id, detalles_individuales)
                                VALUES (?, ?, 'Disponible', ?, ?)
                                """,
                                (prod_id, sn, compra_id, det_ind)
                            )
                            
                        # Actualizar stock manual del producto con series
                        # (SQLite no tiene triggers complejos para series, así que lo hacemos por trigger SQL para compras normales
                        # pero dado que el trigger de SQLite incrementa productos.stock_actual basado en compra_detalles.cantidad,
                        # ya está automatizado por el trigger `trg_compra_detalle_insert`).
                
                # 3. Registrar Cuenta por Pagar si es a Crédito
                if data.get('metodo_pago') == 'Credito':
                    vencimiento = data.get('fecha_vencimiento')
                    if not vencimiento:
                        raise ValueError("Debe ingresar una fecha de vencimiento válida para compras al crédito.")
                    cursor.execute(
                        """
                        INSERT INTO cuentas_por_pagar (compra_id, proveedor_id, monto_total, monto_pagado, fecha_vencimiento, estado)
                        VALUES (?, ?, ?, 0.00, ?, 'Pendiente')
                        """,
                        (compra_id, data.get('proveedor_id'), total, vencimiento)
                    )
                    
            return jsonify({"exito": True, "compra_id": compra_id, "mensaje": "Compra registrada y stock actualizado con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/compras/<int:id>/anular', methods=['PUT'])
def anular_compra(id):
    try:
        # Validar si alguna de las series ingresadas ya fue vendida
        series_vendidas = query_db(
            "SELECT COUNT(*) FROM producto_series WHERE compra_id = ? AND estado != 'Disponible'",
            [id], one=True
        )
        if series_vendidas and series_vendidas['COUNT(*)'] > 0:
            return jsonify({"exito": False, "mensaje": "No se puede anular la compra. Algunas de las series ingresadas ya han sido vendidas o movilizadas."}), 400
            
        execute_db("UPDATE compras SET estado = 'Anulada' WHERE id = ?", [id])
        # El trigger `trg_compra_anulada` de SQLite restará automáticamente el stock
        # y eliminará las series físicas ingresadas de `producto_series`.
        
        return jsonify({"exito": True, "mensaje": "Compra anulada con éxito. Stock e inventario revertidos."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

# ==============================================================================
# MÓDULO: VENTAS (Punto de Venta / POS)
# ==============================================================================
@app.route('/api/ventas', methods=['GET', 'POST'])
def ventas():
    if request.method == 'GET':
        query = """
            SELECT v.*, COALESCE(a.nombre_razon_social, v.cliente_nombre_manual) as cliente_nombre, u.nombre as usuario_nombre
            FROM ventas v
            LEFT JOIN actores a ON v.cliente_id = a.id
            JOIN usuarios u ON v.usuario_id = u.id
            ORDER BY v.fecha_venta DESC
        """
        ventas_list = query_db(query)
        for v in ventas_list:
            v['metodo_pago'] = v.get('condicion_pago')
        return jsonify(ventas_list)
        
    elif request.method == 'POST':
        data = request.json
        try:
            # Procesar la venta usando el procesador transaccional lógico
            resultado = procesar_venta_transaccional(data)
            return jsonify(resultado)
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/ventas/<int:id>/pagos', methods=['GET'])
def get_venta_pagos(id):
    pagos = query_db("SELECT * FROM venta_pagos WHERE venta_id = ?", [id])
    return jsonify(pagos)

@app.route('/api/ventas/<int:id>/detalles', methods=['GET'])
def venta_detalles(id):
    query = """
        SELECT vd.*, p.nombre as producto_nombre, p.maneja_series
        FROM venta_detalles vd
        JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ?
    """
    detalles = query_db(query, [id])
    
    # Agregar los números de serie vendidos en cada detalle
    for det in detalles:
        if det['maneja_series'] == 1:
            series = query_db(
                "SELECT numero_serie FROM producto_series WHERE venta_id = ? AND producto_id = ?",
                [id, det['producto_id']]
            )
            det['series_vendidas'] = [s['numero_serie'] for s in series]
        else:
            det['series_vendidas'] = []
            
    return jsonify(detalles)

@app.route('/api/ventas/<int:id>/anular', methods=['PUT'])
def anular_venta(id):
    try:
        execute_db("UPDATE ventas SET estado = 'Anulada' WHERE id = ?", [id])
        # El trigger `trg_venta_anulada` de SQLite devolverá automáticamente el stock de los productos
        # tradicionales y liberará las series físicas vendidas pasándolas a estado 'Disponible'.
        
        return jsonify({"exito": True, "mensaje": "Venta anulada con éxito. Stock y series físicas liberados."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

# ==============================================================================
# MÓDULO: GESTIÓN DE ABONOS (Cuentas por Cobrar / Pagar)
# ==============================================================================
@app.route('/api/abonos', methods=['POST'])
def registrar_abono():
    data = request.json
    tipo = data.get('tipo')  # 'cobrar' o 'pagar'
    ref_id = data.get('referencia_id')  # venta_id (para cobrar) o compra_id (para pagar)
    monto_abono = float(data.get('monto_abono', 0.0))
    
    if monto_abono <= 0:
        return jsonify({"exito": False, "mensaje": "El monto del abono debe ser mayor a cero."}), 400
        
    try:
        with transaction() as cursor:
            if tipo == 'cobrar':
                # Cuenta por cobrar
                cuenta = cursor.execute(
                    "SELECT id, monto_total, monto_pagado FROM cuentas_por_cobrar WHERE venta_id = ?", 
                    (ref_id,)
                ).fetchone()
                
                if not cuenta:
                    raise ValueError("No se encontró una cuenta por cobrar pendiente para esta venta.")
                    
                cuenta_id, monto_total, monto_pagado = cuenta
                nuevo_pagado = monto_pagado + monto_abono
                
                if nuevo_pagado > monto_total + 0.01:  # Tolerancia por punto flotante
                    raise ValueError(f"El abono excede el saldo pendiente. Saldo actual: {monto_total - monto_pagado:.2f}")
                    
                nuevo_estado = 'Pagado' if abs(nuevo_pagado - monto_total) < 0.01 or nuevo_pagado >= monto_total else 'Pendiente'
                
                cursor.execute(
                    "UPDATE cuentas_por_cobrar SET monto_pagado = ?, estado = ? WHERE id = ?",
                    (nuevo_pagado, nuevo_estado, cuenta_id)
                )
                
            elif tipo == 'pagar':
                # Cuenta por pagar
                cuenta = cursor.execute(
                    "SELECT id, monto_total, monto_pagado FROM cuentas_por_pagar WHERE compra_id = ?", 
                    (ref_id,)
                ).fetchone()
                
                if not cuenta:
                    raise ValueError("No se encontró una cuenta por pagar pendiente para esta compra.")
                    
                cuenta_id, monto_total, monto_pagado = cuenta
                nuevo_pagado = monto_pagado + monto_abono
                
                if nuevo_pagado > monto_total + 0.01:
                    raise ValueError(f"El abono excede el saldo pendiente. Saldo actual: {monto_total - monto_pagado:.2f}")
                    
                nuevo_estado = 'Pagado' if abs(nuevo_pagado - monto_total) < 0.01 or nuevo_pagado >= monto_total else 'Pendiente'
                
                cursor.execute(
                    "UPDATE cuentas_por_pagar SET monto_pagado = ?, estado = ? WHERE id = ?",
                    (nuevo_pagado, nuevo_estado, cuenta_id)
                )
            else:
                raise ValueError("Tipo de abono inválido.")
                
        return jsonify({"exito": True, "mensaje": "Abono registrado con éxito."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

# ==============================================================================
# MÓDULO: REPORTES Y UTILIDADES (Backend Analytics)
# ==============================================================================
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    # 1. Ventas del día (en PEN y USD)
    ventas_hoy = query_db("""
        SELECT COALESCE(SUM(total), 0) as total_ventas, moneda
        FROM ventas
        WHERE date(fecha_venta) = date('now') AND estado = 'Completada'
        GROUP BY moneda
    """)
    
    # 2. Compras del MES (PEN y USD)
    compras_mes = query_db("""
        SELECT COALESCE(SUM(total), 0) as total_compras, moneda
        FROM compras
        WHERE strftime('%Y-%m', fecha_compra) = strftime('%Y-%m', 'now') AND estado = 'Completada'
        GROUP BY moneda
    """)
    
    # 3. Cantidad de Clientes Activos
    clientes_activos = query_db("""
        SELECT COUNT(*) as total
        FROM actores
        WHERE (tipo = 'Cliente' OR tipo = 'Ambos')
    """, one=True)
    
    # 4. Productos bajo stock mínimo (con marcador de series agotadas)
    bajo_stock = query_db("""
        SELECT id, nombre, stock_actual, stock_minimo, maneja_series
        FROM productos
        WHERE stock_actual <= stock_minimo
        ORDER BY stock_actual ASC
    """)
    
    # 5. Ventas mensuales de los últimos 6 meses (para el gráfico de tendencia)
    grafico_ventas = query_db("""
        SELECT strftime('%Y-%m', fecha_venta) as mes, SUM(total) as total, moneda
        FROM ventas
        WHERE estado = 'Completada'
        GROUP BY mes, moneda
        ORDER BY mes DESC
        LIMIT 12
    """)
    
    # 6. Cálculo de Utilidades (Ventas precio cobrado vs precio base/costo de productos)
    utilidad_query = """
        SELECT 
            v.moneda,
            SUM(vd.subtotal) as total_cobrado,
            SUM(vd.cantidad * p.precio_base / (CASE WHEN v.moneda = 'USD' THEN v.tipo_cambio ELSE 1.0 END)) as costo_total
        FROM venta_detalles vd
        JOIN ventas v ON vd.venta_id = v.id
        JOIN productos p ON vd.producto_id = p.id
        WHERE v.estado = 'Completada'
        GROUP BY v.moneda
    """
    utilidades = query_db(utilidad_query)

    # 7. Últimas 5 ventas realizadas
    ventas_recientes = query_db("""
        SELECT v.id, COALESCE(a.nombre_razon_social, v.cliente_nombre_manual) as cliente_nombre, 
               v.tipo_comprobante || ' ' || v.serie_comprobante || '-' || v.correlativo_comprobante as documento, 
               v.total, v.moneda, v.fecha_venta, v.estado
        FROM ventas v
        LEFT JOIN actores a ON v.cliente_id = a.id
        ORDER BY v.fecha_venta DESC
        LIMIT 5
    """)

    # 8. Categorías más vendidas (para el gráfico Donut)
    categorias_vendidas = query_db("""
        SELECT c.nombre as categoria, SUM(vd.cantidad) as total_vendido
        FROM venta_detalles vd
        JOIN productos p ON vd.producto_id = p.id
        JOIN categorias c ON p.categoria_id = c.id
        JOIN ventas v ON vd.venta_id = v.id
        WHERE v.estado = 'Completada'
        GROUP BY c.nombre
        ORDER BY total_vendido DESC
        LIMIT 5
    """)
    
    res_ventas = {"PEN": 0.0, "USD": 0.0}
    for v in ventas_hoy:
        res_ventas[v['moneda']] = float(v['total_ventas'])
        
    res_compras_mes = {"PEN": 0.0, "USD": 0.0}
    for c in compras_mes:
        res_compras_mes[c['moneda']] = float(c['total_compras'])
        
    res_utilidad = {"PEN": 0.0, "USD": 0.0}
    for ut in utilidades:
        moneda = ut['moneda']
        ganancia = float(ut['total_cobrado']) - float(ut['costo_total'])
        res_utilidad[moneda] = round(ganancia, 2)

    return jsonify({
        "ventas_hoy": res_ventas,
        "compras_mes": res_compras_mes,
        "clientes_activos": clientes_activos['total'] if clientes_activos else 0,
        "bajo_stock": bajo_stock,
        "grafico_ventas": grafico_ventas,
        "utilidades": res_utilidad,
        "ventas_recientes": ventas_recientes,
        "categorias_vendidas": categorias_vendidas
    })

# ==============================================================================
# MÓDULO: GESTIÓN DE COLABORADORES (USUARIOS)
# ==============================================================================
@app.route('/api/usuarios', methods=['GET'])
def get_usuarios():
    users = query_db("SELECT id, nombre, username, email, rol, activo FROM usuarios ORDER BY nombre ASC")
    return jsonify(users)

@app.route('/api/usuarios', methods=['POST'])
def create_usuario():
    data = request.json
    nombre = data.get('nombre')
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    rol = data.get('rol')
    
    if not nombre or not username or not email or not password or not rol:
        return jsonify({"exito": False, "mensaje": "Faltan datos obligatorios."}), 400
        
    try:
        from werkzeug.security import generate_password_hash
        pwd_hash = generate_password_hash(password)
        user_id = execute_db(
            "INSERT INTO usuarios (nombre, username, email, password_hash, rol, activo) VALUES (?, ?, ?, ?, ?, 1)",
            [nombre, username, email, pwd_hash, rol]
        )
        return jsonify({"exito": True, "id": user_id, "mensaje": "Colaborador registrado con éxito."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/usuarios/<int:id>/estado', methods=['PUT'])
def toggle_usuario_estado(id):
    data = request.json
    activo = 1 if data.get('activo') else 0
    try:
        execute_db("UPDATE usuarios SET activo = ? WHERE id = ?", [activo, id])
        return jsonify({"exito": True, "mensaje": "Estado del colaborador actualizado."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/config/tc-historial', methods=['GET'])
def get_tc_historial():
    hist = query_db("""
        SELECT h.*, u.nombre as usuario_nombre
        FROM historial_tipo_cambio h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
        ORDER BY h.fecha DESC
        LIMIT 15
    """)
    return jsonify(hist)

# ==============================================================================
# INICIALIZACIÓN DEL SERVIDOR
# ==============================================================================
if __name__ == '__main__':
    # Habilitar modo desarrollo y levantar en el puerto 5001
    app.run(host='127.0.0.1', port=5001, debug=True)
