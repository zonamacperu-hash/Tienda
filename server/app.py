import os
import sys
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import check_password_hash

# Asegurar que el directorio raíz esté en el path para importar módulos internos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from server.database import query_db, execute_db, transaction
from server.sales_processor import procesar_venta_transaccional

app = Flask(__name__, static_folder='../static', static_url_path='')
CORS(app)  # Habilitar CORS para desarrollo local

# Configuración de carpeta para subida de logotipo
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'static', 'storage')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# Limitar el tamaño máximo de archivo a subir a 5 Megabytes (evita Asset Too Large y ataques de denegación de servicio)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"exito": False, "mensaje": "El archivo es demasiado grande. El límite de tamaño es de 5 MB."}), 413

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

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg'}

@app.route('/api/config/logo', methods=['POST', 'DELETE'])
def config_logo():
    if request.method == 'POST':
        if 'logo' not in request.files:
            return jsonify({"exito": False, "mensaje": "No se subió ningún archivo."}), 400
            
        file = request.files['logo']
        if file.filename == '':
            return jsonify({"exito": False, "mensaje": "Nombre de archivo no válido."}), 400
            
        if file and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"logo_{int(time.time())}.{ext}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            # Obtener y borrar logotipo anterior si existe
            config = query_db("SELECT logo_path FROM configuracion_sistema LIMIT 1", one=True)
            if config and config['logo_path']:
                old_filename = os.path.basename(config['logo_path'])
                old_filepath = os.path.join(app.config['UPLOAD_FOLDER'], old_filename)
                if os.path.exists(old_filepath):
                    try:
                        os.remove(old_filepath)
                    except Exception as e:
                        print(f"Error al remover logotipo anterior: {e}")
            
            # Guardar el nuevo archivo
            file.save(filepath)
            
            # Actualizar base de datos
            logo_relative_path = f"/storage/{filename}"
            if config:
                execute_db("UPDATE configuracion_sistema SET logo_path = ? WHERE id = (SELECT id FROM configuracion_sistema LIMIT 1)", (logo_relative_path,))
            else:
                execute_db("INSERT INTO configuracion_sistema (empresa_nombre, empresa_ruc, logo_path) VALUES ('Empresa por defecto', '00000000000', ?)", (logo_relative_path,))
                
            return jsonify({
                "exito": True,
                "mensaje": "Logotipo actualizado con éxito.",
                "logo_path": logo_relative_path
            })
        else:
            return jsonify({"exito": False, "mensaje": "Formato de archivo no permitido. Solo se aceptan JPG, JPEG y PNG."}), 400
            
    elif request.method == 'DELETE':
        config = query_db("SELECT logo_path FROM configuracion_sistema LIMIT 1", one=True)
        if config and config['logo_path']:
            filename = os.path.basename(config['logo_path'])
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except Exception as e:
                    print(f"Error al eliminar logotipo físico: {e}")
                    
            execute_db("UPDATE configuracion_sistema SET logo_path = NULL WHERE id = (SELECT id FROM configuracion_sistema LIMIT 1)")
            return jsonify({"exito": True, "mensaje": "Logotipo eliminado con éxito."})
        else:
            return jsonify({"exito": False, "mensaje": "No hay ningún logotipo configurado."}), 400


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
                    categoria_id, nombre, descripcion, maneja_series, stock_minimo, stock_actual, precio_base, precio_mayorista, precio_final, moneda, detalles_tecnicos
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
                """,
                (
                    data.get('categoria_id'),
                    data.get('nombre'),
                    data.get('descripcion', ''),
                    1 if data.get('maneja_series') else 0,
                    data.get('stock_minimo', 0),
                    data.get('precio_base', 0.0),
                    data.get('precio_mayorista', 0.0),
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
                    precio_base = ?, precio_mayorista = ?, precio_final = ?, moneda = ?, detalles_tecnicos = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    data.get('categoria_id'),
                    data.get('nombre'),
                    data.get('descripcion', ''),
                    data.get('stock_minimo', 0),
                    data.get('precio_base', 0.0),
                    data.get('precio_mayorista', 0.0),
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
        SELECT c.*, v.serie_comprobante || '-' || v.correlativo_comprobante as documento, v.fecha_venta as fecha, v.moneda as moneda
        FROM cuentas_por_cobrar c
        JOIN ventas v ON c.venta_id = v.id
        WHERE c.cliente_id = ? AND v.estado != 'Anulada'
        ORDER BY c.fecha_vencimiento ASC
    """, [id])
    
    # Cuentas por pagar (compras)
    por_pagar = query_db("""
        SELECT p.*, c.serie_comprobante || '-' || c.correlativo_comprobante as documento, c.fecha_compra as fecha, c.moneda as moneda
        FROM cuentas_por_pagar p
        JOIN compras c ON p.compra_id = c.id
        WHERE p.proveedor_id = ? AND c.estado != 'Anulada'
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
            
        with transaction() as cursor:
            cursor.execute("UPDATE compras SET estado = 'Anulada' WHERE id = ?", (id,))
            cursor.execute("DELETE FROM cuentas_por_pagar WHERE compra_id = ?", (id,))
        
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
        with transaction() as cursor:
            cursor.execute("UPDATE ventas SET estado = 'Anulada' WHERE id = ?", (id,))
            cursor.execute("DELETE FROM cuentas_por_cobrar WHERE venta_id = ?", (id,))
            cursor.execute("DELETE FROM venta_pagos WHERE venta_id = ?", (id,))
        
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
                
                # Registrar el método de pago del abono en venta_pagos
                venta = cursor.execute("SELECT moneda FROM ventas WHERE id = ?", (ref_id,)).fetchone()
                moneda = venta[0] if venta else 'PEN'
                metodo_pago = data.get('metodo_pago', 'Efectivo')
                if metodo_pago not in ('Efectivo', 'Transferencia', 'Yape/Plin', 'Tarjeta'):
                    raise ValueError(f"Método de pago '{metodo_pago}' no es válido.")
                
                cursor.execute(
                    "INSERT INTO venta_pagos (venta_id, metodo_pago, monto, moneda) VALUES (?, ?, ?, ?)",
                    (ref_id, metodo_pago, monto_abono, moneda)
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
# MÓDULO: PRÉSTAMOS / SALIDAS TEMPORALES INTERTIENDAS
# ==============================================================================
@app.route('/api/prestamos', methods=['GET'])
def get_prestamos():
    prestamos = query_db("""
        SELECT p.*, a.nombre_razon_social as tienda_destino_nombre, u.nombre as usuario_nombre
        FROM prestamos_intertienda p
        JOIN actores a ON p.tienda_destino_id = a.id
        JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.fecha_prestamo DESC
    """)
    for p in prestamos:
        # Obtener detalles
        detalles = query_db("""
            SELECT pd.*, prod.nombre as producto_nombre, prod.maneja_series, prod.precio_base, prod.precio_mayorista, prod.precio_final, prod.moneda
            FROM prestamo_detalles pd
            JOIN productos prod ON pd.producto_id = prod.id
            WHERE pd.prestamo_id = ?
        """, [p['id']])
        
        for d in detalles:
            # Obtener series asociadas a este préstamo
            series = query_db("""
                SELECT id, numero_serie, estado, detalles_individuales
                FROM producto_series
                WHERE prestamo_id = ? AND producto_id = ?
            """, [p['id'], d['producto_id']])
            d['series'] = series
            
        p['items'] = detalles
    return jsonify(prestamos)

@app.route('/api/prestamos', methods=['POST'])
def registrar_prestamo():
    data = request.json
    tienda_destino_id = data.get('tienda_destino_id')
    usuario_id = data.get('usuario_id')
    observaciones = data.get('observaciones', '')
    items = data.get('items', [])
    
    if not tienda_destino_id or not usuario_id or not items:
        return jsonify({"exito": False, "mensaje": "Faltan datos obligatorios."}), 400
        
    try:
        with transaction() as cursor:
            # 1. Crear cabecera de préstamo
            cursor.execute("""
                INSERT INTO prestamos_intertienda (tienda_destino_id, usuario_id, observaciones, estado)
                VALUES (?, ?, ?, 'Pendiente')
            """, (tienda_destino_id, usuario_id, observaciones))
            prestamo_id = cursor.lastrowid
            
            # 2. Procesar cada detalle
            for item in items:
                producto_id = item.get('producto_id')
                cantidad = int(item.get('cantidad', 0))
                
                # Obtener info del producto
                prod = cursor.execute(
                    "SELECT maneja_series, stock_actual, nombre FROM productos WHERE id = ?",
                    (producto_id,)
                ).fetchone()
                
                if not prod:
                    raise ValueError(f"El producto con ID {producto_id} no existe.")
                    
                maneja_series = prod[0]
                stock_actual = prod[1]
                prod_name = prod[2]
                
                if stock_actual < cantidad:
                    raise ValueError(f"Stock insuficiente para el producto '{prod_name}'. Stock actual: {stock_actual}, Solicitado: {cantidad}")
                    
                # Insertar detalle
                tipo_precio = item.get('tipo_precio', 'Final')
                precio_manual = float(item.get('precio_manual', 0.0))
                cursor.execute("""
                    INSERT INTO prestamo_detalles (prestamo_id, producto_id, cantidad, tipo_precio, precio_manual)
                    VALUES (?, ?, ?, ?, ?)
                """, (prestamo_id, producto_id, cantidad, tipo_precio, precio_manual))
                
                # Descontar stock
                cursor.execute(
                    "UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?",
                    (cantidad, producto_id)
                )
                
                # Si maneja series, verificar y actualizar estado de las series enviadas
                if maneja_series == 1:
                    series_enviadas = item.get('series', [])
                    if len(series_enviadas) != cantidad:
                        raise ValueError(f"Debe enviar exactamente {cantidad} series para el producto '{prod_name}'.")
                        
                    for sn in series_enviadas:
                        # Validar disponibilidad
                        serie = cursor.execute(
                            "SELECT id FROM producto_series WHERE producto_id = ? AND numero_serie = ? AND estado = 'Disponible'",
                            (producto_id, sn)
                        ).fetchone()
                        
                        if not serie:
                            raise ValueError(f"La serie '{sn}' del producto '{prod_name}' no está disponible.")
                            
                        # Actualizar estado de la serie a 'Prestado' y vincular al préstamo
                        cursor.execute("""
                            UPDATE producto_series
                            SET estado = 'Prestado', prestamo_id = ?
                            WHERE id = ?
                        """, (prestamo_id, serie[0]))
                        
        return jsonify({"exito": True, "prestamo_id": prestamo_id, "mensaje": "Préstamo registrado correctamente."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/prestamos/<int:id>/return', methods=['POST'])
def process_return(id):
    data = request.json
    series_devueltas = data.get('series', []) # Array de strings (números de serie)
    tradicionales = data.get('productos_tradicionales', []) # Array de dicts {"producto_id": X, "cantidad": Y}
    
    if not series_devueltas and not tradicionales:
        return jsonify({"exito": False, "mensaje": "Debe especificar al menos un ítem para devolver."}), 400
        
    try:
        with transaction() as cursor:
            # Validar existencia del préstamo
            prestamo = cursor.execute(
                "SELECT id, estado FROM prestamos_intertienda WHERE id = ?",
                (id,)
            ).fetchone()
            
            if not prestamo:
                raise ValueError(f"El préstamo con ID {id} no existe.")
                
            # 1. Procesar series devueltas
            for sn in series_devueltas:
                # Buscar la serie
                serie = cursor.execute("""
                    SELECT id, producto_id, estado
                    FROM producto_series
                    WHERE prestamo_id = ? AND numero_serie = ? AND estado = 'Prestado'
                """, (id, sn)).fetchone()
                
                if not serie:
                    raise ValueError(f"La serie '{sn}' no pertenece a este préstamo o no está en estado 'Prestado'.")
                    
                serie_id, producto_id, estado = serie
                
                # Cambiar serie a Disponible y desvincular préstamo
                cursor.execute("""
                    UPDATE producto_series
                    SET estado = 'Disponible', prestamo_id = NULL
                    WHERE id = ?
                """, (serie_id,))
                
                # Incrementar stock del producto
                cursor.execute("""
                    UPDATE productos
                    SET stock_actual = stock_actual + 1
                    WHERE id = ?
                """, (producto_id,))
                
            # 2. Procesar tradicionales devueltos
            for t in tradicionales:
                prod_id = t.get('producto_id')
                cant_ret = int(t.get('cantidad', 0))
                
                if cant_ret <= 0:
                    continue
                    
                # Validar que pertenezca al detalle del préstamo
                det = cursor.execute("""
                    SELECT id FROM prestamo_detalles
                    WHERE prestamo_id = ? AND producto_id = ?
                """, (id, prod_id)).fetchone()
                
                if not det:
                    raise ValueError(f"El producto con ID {prod_id} no pertenece a este préstamo.")
                    
                # Incrementar stock del producto
                cursor.execute("""
                    UPDATE productos
                    SET stock_actual = stock_actual + ?
                    WHERE id = ?
                """, (cant_ret, prod_id))
                
            # 3. Actualizar estado general del préstamo
            # Contar cuántas series de este préstamo siguen en estado 'Prestado'
            pendientes = cursor.execute("""
                SELECT COUNT(*) FROM producto_series
                WHERE prestamo_id = ? AND estado = 'Prestado'
            """, (id,)).fetchone()[0]
            
            if pendientes == 0:
                cursor.execute("""
                    UPDATE prestamos_intertienda
                    SET estado = 'Devuelto'
                    WHERE id = ?
                """, (id,))
            else:
                cursor.execute("""
                    UPDATE prestamos_intertienda
                    SET estado = 'Devuelto Parcial'
                    WHERE id = ?
                """, (id,))
                
        return jsonify({"exito": True, "mensaje": "Devolución procesada con éxito. Stock de almacén restaurado."})
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
# MÓDULO: SERVICIO TÉCNICO Y REPARACIONES
# ==============================================================================

@app.route('/api/soporte/ordenes', methods=['GET', 'POST'])
def soporte_ordenes():
    if request.method == 'GET':
        query = """
            SELECT o.*, 
                   COALESCE(a.nombre_razon_social, o.cliente_nombre_manual) as cliente_nombre,
                   a.documento_identidad as cliente_documento,
                   a.telefono as cliente_telefono,
                   ps.numero_serie as producto_serie_codigo
            FROM ordenes_servicio o
            LEFT JOIN actores a ON o.cliente_id = a.id
            LEFT JOIN producto_series ps ON o.producto_serie_id = ps.id
            ORDER BY o.fecha_ingreso DESC
        """
        ordenes = query_db(query)
        return jsonify(ordenes)
        
    elif request.method == 'POST':
        data = request.json
        cliente_id = data.get('cliente_id')
        cliente_nombre_manual = (data.get('cliente_nombre_manual') or '').strip()
        producto_serie_id = data.get('producto_serie_id')
        equipo_marca_modelo = (data.get('equipo_marca_modelo') or '').strip()
        numero_serie_externo = (data.get('numero_serie_externo') or '').strip()
        problema_reportado = (data.get('problema_reportado') or '').strip()
        costo_servicio = float(data.get('costo_servicio', 0.00))
        
        if not equipo_marca_modelo or not problema_reportado:
            return jsonify({"exito": False, "mensaje": "Faltan datos obligatorios (Equipo y Falla Reportada)."}), 400
            
        if not cliente_id and not cliente_nombre_manual:
            return jsonify({"exito": False, "mensaje": "Debe registrar un cliente o escribir un nombre para comprador/cliente manual."}), 400
            
        try:
            orden_id = execute_db(
                """
                INSERT INTO ordenes_servicio (
                    cliente_id, producto_serie_id, equipo_marca_modelo, numero_serie_externo,
                    problema_reportado, estado, costo_servicio, total_pagar, cliente_nombre_manual
                ) VALUES (?, ?, ?, ?, ?, 'Recibido', ?, ?, ?)
                """,
                (
                    cliente_id if cliente_id else None,
                    producto_serie_id if producto_serie_id else None,
                    equipo_marca_modelo,
                    numero_serie_externo if numero_serie_externo else None,
                    problema_reportado,
                    costo_servicio,
                    costo_servicio,
                    cliente_nombre_manual if not cliente_id else None
                )
            )
            return jsonify({"exito": True, "id": orden_id, "mensaje": "Orden de servicio creada con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/soporte/ordenes/<int:id>', methods=['GET', 'PUT'])
def soporte_orden_detalle(id):
    if request.method == 'GET':
        query_orden = """
            SELECT o.*, 
                   COALESCE(a.nombre_razon_social, o.cliente_nombre_manual) as cliente_nombre,
                   a.documento_identidad as cliente_documento,
                   a.telefono as cliente_telefono,
                   a.direccion as cliente_direccion,
                   a.email as cliente_email,
                   ps.numero_serie as producto_serie_codigo,
                   ps.venta_id as serie_venta_id
            FROM ordenes_servicio o
            LEFT JOIN actores a ON o.cliente_id = a.id
            LEFT JOIN producto_series ps ON o.producto_serie_id = ps.id
            WHERE o.id = ?
        """
        orden = query_db(query_orden, [id], one=True)
        if not orden:
            return jsonify({"exito": False, "mensaje": "Orden de servicio no encontrada."}), 404
            
        repuestos = query_db(
            """
            SELECT r.*, p.nombre as producto_nombre
            FROM orden_servicio_repuestos r
            JOIN productos p ON r.producto_id = p.id
            WHERE r.orden_servicio_id = ?
            """,
            [id]
        )
        
        return jsonify({
            "exito": True,
            "orden": orden,
            "repuestos": repuestos
        })
        
    elif request.method == 'PUT':
        data = request.json
        diagnostico = data.get('diagnostico_tecnico')
        estado = data.get('estado')
        costo_servicio = float(data.get('costo_servicio', 0.00))
        garantia_servicio_meses = int(data.get('garantia_servicio_meses', 0))
        
        if estado not in ('Recibido', 'En Diagnostico', 'Reparado', 'No Reparable', 'Entregado'):
            return jsonify({"exito": False, "mensaje": "Estado inválido."}), 400
            
        try:
            with transaction() as cursor:
                # Obtener costo de los repuestos cargados
                total_repuestos = cursor.execute(
                    "SELECT SUM(cantidad * precio_aplicado) FROM orden_servicio_repuestos WHERE orden_servicio_id = ?",
                    (id,)
                ).fetchone()[0] or 0.00
                
                nuevo_total = total_repuestos + costo_servicio
                
                cursor.execute(
                    """
                    UPDATE ordenes_servicio
                    SET diagnostico_tecnico = ?, estado = ?, costo_servicio = ?, 
                        garantia_servicio_meses = ?, total_pagar = ?
                    WHERE id = ?
                    """,
                    (diagnostico, estado, costo_servicio, garantia_servicio_meses, nuevo_total, id)
                )
            return jsonify({"exito": True, "mensaje": "Orden de servicio actualizada con éxito."})
        except Exception as e:
            return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/soporte/ordenes/<int:id>/repuestos', methods=['POST'])
def soporte_agregar_repuesto(id):
    data = request.json
    producto_id = data.get('producto_id')
    cantidad = int(data.get('cantidad', 1))
    precio_aplicado = float(data.get('precio_aplicado', 0.00))
    
    if not producto_id or cantidad <= 0:
        return jsonify({"exito": False, "mensaje": "Faltan datos válidos del repuesto."}), 400
        
    try:
        with transaction() as cursor:
            # 1. Validar producto y stock
            producto = cursor.execute(
                "SELECT stock_actual, nombre FROM productos WHERE id = ?", 
                (producto_id,)
            ).fetchone()
            if not producto:
                raise ValueError("Producto repuesto no encontrado.")
            
            stock_actual = producto[0]
            if stock_actual < cantidad:
                raise ValueError(f"Stock insuficiente para '{producto[1]}'. Disponible: {stock_actual}, Solicitado: {cantidad}")
                
            # 2. Insertar en la tabla de repuestos
            cursor.execute(
                """
                INSERT INTO orden_servicio_repuestos (orden_servicio_id, producto_id, cantidad, precio_aplicado)
                VALUES (?, ?, ?, ?)
                """,
                (id, producto_id, cantidad, precio_aplicado)
            )
            # El trigger `trg_soporte_repuesto_insert` descontará el stock automáticamente
            
            # 3. Recalcular total_pagar en ordenes_servicio
            orden = cursor.execute("SELECT costo_servicio FROM ordenes_servicio WHERE id = ?", (id,)).fetchone()
            costo_servicio = orden[0] if orden else 0.00
            
            total_repuestos = cursor.execute(
                "SELECT SUM(cantidad * precio_aplicado) FROM orden_servicio_repuestos WHERE orden_servicio_id = ?",
                (id,)
            ).fetchone()[0] or 0.00
            
            nuevo_total = total_repuestos + costo_servicio
            cursor.execute("UPDATE ordenes_servicio SET total_pagar = ? WHERE id = ?", (nuevo_total, id))
            
        return jsonify({"exito": True, "mensaje": "Repuesto agregado e inventario descontado con éxito."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/soporte/ordenes/<int:id>/repuestos/<int:repuesto_id>', methods=['DELETE'])
def soporte_eliminar_repuesto(id, repuesto_id):
    try:
        with transaction() as cursor:
            # 1. Eliminar repuesto
            cursor.execute(
                "DELETE FROM orden_servicio_repuestos WHERE id = ? AND orden_servicio_id = ?", 
                (repuesto_id, id)
            )
            # El trigger `trg_soporte_repuesto_delete` repondrá el stock automáticamente
            
            # 2. Recalcular total_pagar en ordenes_servicio
            orden = cursor.execute("SELECT costo_servicio FROM ordenes_servicio WHERE id = ?", (id,)).fetchone()
            costo_servicio = orden[0] if orden else 0.00
            
            total_repuestos = cursor.execute(
                "SELECT SUM(cantidad * precio_aplicado) FROM orden_servicio_repuestos WHERE orden_servicio_id = ?",
                (id,)
            ).fetchone()[0] or 0.00
            
            nuevo_total = total_repuestos + costo_servicio
            cursor.execute("UPDATE ordenes_servicio SET total_pagar = ? WHERE id = ?", (nuevo_total, id))
            
        return jsonify({"exito": True, "mensaje": "Repuesto eliminado e inventario reabastecido."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400

@app.route('/api/soporte/ordenes/<int:id>/entregar', methods=['PUT'])
def soporte_entregar_equipo(id):
    data = request.json
    metodo_pago = data.get('metodo_pago')
    garantia_servicio_meses = int(data.get('garantia_servicio_meses', 0))
    diagnostico_tecnico = (data.get('diagnostico_tecnico') or '').strip()
    costo_servicio = float(data.get('costo_servicio', 0.00))
    
    if not metodo_pago:
        return jsonify({"exito": False, "mensaje": "Debe especificar un método de pago."}), 400
        
    try:
        with transaction() as cursor:
            # 1. Obtener total a pagar
            total_repuestos = cursor.execute(
                "SELECT SUM(cantidad * precio_aplicado) FROM orden_servicio_repuestos WHERE orden_servicio_id = ?",
                (id,)
            ).fetchone()[0] or 0.00
            
            nuevo_total = total_repuestos + costo_servicio
            
            # 2. Actualizar estado de la orden a Entregado y completar campos
            cursor.execute(
                """
                UPDATE ordenes_servicio
                SET estado = 'Entregado',
                    fecha_entrega = datetime('now', 'localtime'),
                    metodo_pago = ?,
                    garantia_servicio_meses = ?,
                    diagnostico_tecnico = ?,
                    costo_servicio = ?,
                    total_pagar = ?
                WHERE id = ?
                """,
                (metodo_pago, garantia_servicio_meses, diagnostico_tecnico, costo_servicio, nuevo_total, id)
            )
            
        return jsonify({"exito": True, "mensaje": "Equipo entregado con éxito."})
    except Exception as e:
        return jsonify({"exito": False, "mensaje": f"Error: {str(e)}"}), 400


# ==============================================================================
# INICIALIZACIÓN DEL SERVIDOR
# ==============================================================================
if __name__ == '__main__':
    # Habilitar modo desarrollo y levantar en el puerto 5000
    app.run(host='0.0.0.0', port=5000, debug=True)

