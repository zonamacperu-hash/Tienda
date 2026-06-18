/**
 * ==============================================================================
 * MOCK BACKEND PARA DESPLIEGUES ESTÁTICOS (NETLIFY / CLOUDFLARE PAGES)
 * Intercepta peticiones fetch a la API local y las procesa usando LocalStorage.
 * ==============================================================================
 */

(function() {
    // 1. Detección de entorno: se activa automáticamente si no estamos en localhost/127.0.0.1
    // o si el usuario fuerza el modo mock usando ?mock=true en la URL o una clave en LocalStorage.
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('mock')) {
        localStorage.setItem('force_mock', 'true');
    }
    if (urlParams.has('nomock')) {
        localStorage.removeItem('force_mock');
    }

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isMockActive = !isLocalhost || localStorage.getItem('force_mock') === 'true';

    if (!isMockActive) {
        return; // Ejecución normal: el backend Flask real responderá
    }

    console.warn("⚠️ MOCK BACKEND ACTIVO: Interceptando todas las llamadas API en LocalStorage.");

    // ==============================================================================
    // 2. MOTOR DE BASE DE DATOS LOCALSTORAGE (MICRO-ORM)
    // ==============================================================================
    const db = {
        get: (table) => {
            const data = localStorage.getItem(`db_${table}`);
            return data ? JSON.parse(data) : [];
        },
        set: (table, data) => {
            localStorage.setItem(`db_${table}`, JSON.stringify(data));
        },
        insert: (table, row) => {
            const rows = db.get(table);
            const maxId = rows.reduce((max, r) => (r.id > max ? r.id : max), 0);
            row.id = maxId + 1;
            row.created_at = new Date().toISOString();
            row.updated_at = new Date().toISOString();
            rows.push(row);
            db.set(table, rows);
            return row.id;
        },
        update: (table, id, updates) => {
            const rows = db.get(table);
            const idx = rows.findIndex(r => r.id === Number(id));
            if (idx !== -1) {
                rows[idx] = { ...rows[idx], ...updates, updated_at: new Date().toISOString() };
                db.set(table, rows);
                return true;
            }
            return false;
        },
        delete: (table, id) => {
            const rows = db.get(table);
            const filtered = rows.filter(r => r.id !== Number(id));
            db.set(table, filtered);
            return true;
        }
    };

    // ==============================================================================
    // 3. INICIALIZACIÓN DE SEMILLAS (SEED DATA)
    // ==============================================================================
    function initDatabaseSeeds() {
        if (localStorage.getItem('db_usuarios')) return; // Ya inicializada

        console.log("🌱 Inicializando base de datos local (Mock Seeds) en LocalStorage...");

        // Configuración Inicial
        db.set('configuracion', [{
            id: 1,
            empresa_nombre: "TecnoPerú Soluciones S.A.C.",
            empresa_ruc: "20608765432",
            empresa_direccion: "Av. Garcilaso de la Vega 1236, Lima",
            empresa_telefono: "+51 987 654 321",
            empresa_email: "contacto@tecnoperu.com",
            moneda_defecto: "PEN",
            tipo_cambio_actual: 3.7500,
            logo_path: null
        }]);

        // Usuarios semilla
        db.set('usuarios', [
            { id: 1, nombre: "Administrador ERP", username: "admin", email: "admin@tecnoperu.com", password_hash: "admin123", rol: "Administrador", activo: 1 },
            { id: 2, nombre: "Vendedor POS", username: "vendedor", email: "vendedor@tecnoperu.com", password_hash: "vendedor123", rol: "Vendedor", activo: 1 },
            { id: 3, nombre: "Almacenero ERP", username: "almacen", email: "almacen@tecnoperu.com", password_hash: "almacen123", rol: "Almacenero", activo: 1 }
        ]);

        // Secuencias de comprobante
        db.set('secuencias_comprobante', [
            { id: 1, tipo: "Factura", serie: "F001", correlativo_actual: 0 },
            { id: 2, tipo: "Boleta", serie: "B001", correlativo_actual: 0 },
            { id: 3, tipo: "Guia de Remision", serie: "G001", correlativo_actual: 0 },
            { id: 4, tipo: "Ticket", serie: "T001", correlativo_actual: 0 },
            { id: 5, tipo: "Nota de Venta", serie: "NV01", correlativo_actual: 0 },
            { id: 6, tipo: "Nota de Compra", serie: "NC01", correlativo_actual: 0 }
        ]);

        // Historial Tipo Cambio
        db.set('historial_tipo_cambio', [
            { id: 1, fecha: new Date().toISOString().split('T')[0], tipo_cambio: 3.7500, usuario_id: 1, usuario_nombre: "Administrador ERP" }
        ]);

        // Categorías
        db.set('categorias', []);

        // Productos
        db.set('productos', []);

        // Actores (Clientes y Proveedores)
        db.set('actores', []);

        // Números de serie físicos disponibles
        db.set('producto_series', []);

        // Tablas vacías de compras, ventas, detalles, abonos
        db.set('compras', []);
        db.set('compra_detalles', []);
        db.set('ventas', []);
        db.set('venta_detalles', []);
        db.set('venta_pagos', []);
        db.set('cuentas_por_cobrar', []);
        db.set('cuentas_por_pagar', []);
    }

    initDatabaseSeeds();

    // ==============================================================================
    // 4. FUNCIONES AUXILIARES PARA RESPUESTAS HTTP
    // ==============================================================================
    function jsonResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status: status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    function getLoggedInUser() {
        const sessionStr = localStorage.getItem('erp_session');
        return sessionStr ? JSON.parse(sessionStr) : null;
    }

    // ==============================================================================
    // 5. INTERCEPTOR WINDOW.FETCH
    // ==============================================================================
    const originalFetch = window.fetch;
    window.fetch = async function(resource, options = {}) {
        let url = typeof resource === 'string' ? resource : resource.url;

        // Comprobamos si es una petición a la API
        if (url.includes('/api/')) {
            // Añadir retardo artificial de red para simular carga real (100ms - 200ms)
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
            
            try {
                return await handleMockRequest(url, options);
            } catch (error) {
                console.error("❌ Error en Mock API:", error);
                return jsonResponse({
                    exito: false,
                    mensaje: error.message || "Error interno del mock backend."
                }, 400);
            }
        }

        // Si no es API, realizar fetch original
        return originalFetch.apply(this, arguments);
    };

    // ==============================================================================
    // 6. ENRUTADOR Y MÁNAGER DE LLAMADAS API
    // ==============================================================================
    async function handleMockRequest(url, options) {
        const method = (options.method || 'GET').toUpperCase();
        const parsedUrl = new URL(url, window.location.origin);
        const path = parsedUrl.pathname;
        
        console.log(`[Mock API Request] ${method} ${path}`, options.body ? JSON.parse(typeof options.body === 'string' ? options.body : '{}') : '');

        // --- AUTENTICACIÓN ---
        if (path.endsWith('/api/auth/login') && method === 'POST') {
            const data = JSON.parse(options.body);
            const users = db.get('usuarios');
            const user = users.find(u => u.username.toLowerCase() === data.username.toLowerCase().trim() && u.activo === 1);
            
            const isCorrect = user && (
                user.password_hash === data.password ||
                (user.username === 'admin' && data.password === 'admin123') ||
                (user.username === 'vendedor' && data.password === 'vendedor123') ||
                (user.username === 'almacen' && data.password === 'almacen123')
            );
            
            if (isCorrect) {
                return jsonResponse({
                    exito: true,
                    usuario: {
                        id: user.id,
                        nombre: user.nombre,
                        username: user.username,
                        email: user.email,
                        rol: user.rol
                    }
                });
            }
            return jsonResponse({ exito: false, mensaje: "Usuario o contraseña incorrectos" }, 401);
        }

        if (path.endsWith('/api/auth/logout') && method === 'POST') {
            return jsonResponse({ exito: true, mensaje: "Sesión cerrada correctamente." });
        }

        if (path.endsWith('/api/config/reset') && method === 'POST') {
            const keys = Object.keys(localStorage);
            keys.forEach(k => {
                if (k.startsWith('db_') && k !== 'db_usuarios' && k !== 'db_configuracion' && k !== 'db_secuencias_comprobante') {
                    localStorage.removeItem(k);
                }
            });
            // Re-ejecutar inicialización de semillas si es necesario
            initDatabaseSeeds();
            return jsonResponse({ exito: true, mensaje: "Base de datos simulada restablecida con éxito (sistema limpio)." });
        }

        // --- CONFIGURACIÓN ---
        if (path.endsWith('/api/config')) {
            if (method === 'GET') {
                const configs = db.get('configuracion');
                return jsonResponse(configs[0] || {});
            }
            
            if (method === 'PUT') {
                const data = JSON.parse(options.body);
                const configs = db.get('configuracion');
                const config = configs[0] || {};
                
                const nuevo_tc = parseFloat(data.tipo_cambio_actual || 3.7500);
                const tc_anterior = parseFloat(config.tipo_cambio_actual || 3.7500);
                
                const updatedConfig = {
                    ...config,
                    empresa_nombre: data.empresa_nombre,
                    empresa_ruc: data.empresa_ruc,
                    empresa_direccion: data.empresa_direccion,
                    empresa_telefono: data.empresa_telefono,
                    empresa_email: data.empresa_email,
                    moneda_defecto: data.moneda_defecto || 'PEN',
                    tipo_cambio_actual: nuevo_tc,
                    updated_at: new Date().toISOString()
                };
                db.set('configuracion', [updatedConfig]);
                
                if (nuevo_tc !== tc_anterior) {
                    const activeUser = getLoggedInUser() || { id: 1, nombre: "Administrador ERP" };
                    const historial = db.get('historial_tipo_cambio');
                    historial.unshift({
                        id: historial.length + 1,
                        fecha: new Date().toISOString().split('T')[0],
                        tipo_cambio: nuevo_tc,
                        usuario_id: activeUser.id,
                        usuario_nombre: activeUser.nombre
                    });
                    db.set('historial_tipo_cambio', historial);
                }
                
                return jsonResponse({ exito: true, mensaje: "Configuración actualizada con éxito." });
            }
        }

        // --- SUBIR LOGO DE EMPRESA (Soporte Base64) ---
        if (path.endsWith('/api/config/logo') && method === 'POST') {
            const formData = options.body;
            const logoFile = formData.get('logo');
            
            if (!logoFile || logoFile.size === 0) {
                return jsonResponse({ exito: false, mensaje: "No se subió ningún archivo de logotipo." }, 400);
            }
            
            // Validar tipo
            const ext = logoFile.name.split('.').pop().toLowerCase();
            if (!['png', 'jpg', 'jpeg'].includes(ext)) {
                return jsonResponse({ exito: false, mensaje: "Formato no permitido. Solo se aceptan imágenes PNG, JPG y JPEG." }, 400);
            }
            
            // Validar tamaño (máximo 2 MB)
            if (logoFile.size > 2 * 1024 * 1024) {
                return jsonResponse({ exito: false, mensaje: "El archivo excede el tamaño máximo permitido de 2 MB." }, 400);
            }
            
            // Leer como Base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(logoFile);
            });
            const base64Url = await base64Promise;
            
            const configs = db.get('configuracion');
            if (configs.length > 0) {
                configs[0].logo_path = base64Url;
                db.set('configuracion', configs);
            }
            
            return jsonResponse({
                exito: true,
                logo_path: base64Url,
                mensaje: "Logotipo subido y optimizado con éxito."
            });
        }

        if (path.endsWith('/api/config/logo') && method === 'DELETE') {
            const configs = db.get('configuracion');
            if (configs.length > 0) {
                configs[0].logo_path = null;
                db.set('configuracion', configs);
            }
            return jsonResponse({ exito: true, mensaje: "Logotipo eliminado con éxito." });
        }

        // --- CATEGORÍAS ---
        if (path.endsWith('/api/categorias')) {
            if (method === 'GET') {
                const cats = db.get('categorias');
                cats.sort((a, b) => a.nombre.localeCompare(b.nombre));
                return jsonResponse(cats);
            }
            
            if (method === 'POST') {
                const data = JSON.parse(options.body);
                const catId = db.insert('categorias', {
                    nombre: data.nombre,
                    descripcion: data.descripcion || ''
                });
                return jsonResponse({ exito: true, id: catId, mensaje: "Categoría creada con éxito." });
            }
        }

        // PUT/DELETE Categorías
        if (path.includes('/api/categorias/') && !path.endsWith('/api/categorias')) {
            const parts = path.split('/');
            const catId = Number(parts[parts.length - 1]);
            
            if (method === 'PUT') {
                const data = JSON.parse(options.body);
                db.update('categorias', catId, {
                    nombre: data.nombre,
                    descripcion: data.descripcion || ''
                });
                return jsonResponse({ exito: true, mensaje: "Categoría actualizada con éxito." });
            }
            
            if (method === 'DELETE') {
                const prods = db.get('productos');
                const hasProds = prods.some(p => p.categoria_id === catId);
                if (hasProds) {
                    return jsonResponse({ exito: false, mensaje: "No se puede eliminar una categoría que contiene productos vinculados." }, 400);
                }
                db.delete('categorias', catId);
                return jsonResponse({ exito: true, mensaje: "Categoría eliminada con éxito." });
            }
        }

        // --- PRODUCTOS ---
        if (path.endsWith('/api/productos')) {
            if (method === 'GET') {
                const prods = db.get('productos');
                const cats = db.get('categorias');
                const result = prods.map(p => {
                    const cat = cats.find(c => c.id === p.categoria_id);
                    return {
                        ...p,
                        categoria_nombre: cat ? cat.nombre : 'Sin Categoría'
                    };
                });
                result.sort((a, b) => a.nombre.localeCompare(b.nombre));
                return jsonResponse(result);
            }
            
            if (method === 'POST') {
                const data = JSON.parse(options.body);
                const prodId = db.insert('productos', {
                    categoria_id: Number(data.categoria_id),
                    nombre: data.nombre,
                    descripcion: data.descripcion || '',
                    maneja_series: data.maneja_series ? 1 : 0,
                    stock_minimo: parseInt(data.stock_minimo || 0),
                    stock_actual: 0,
                    precio_base: parseFloat(data.precio_base || 0.0),
                    precio_final: parseFloat(data.precio_final || 0.0),
                    moneda: data.moneda || 'PEN',
                    detalles_tecnicos: data.detalles_tecnicos || ''
                });
                return jsonResponse({ exito: true, id: prodId, mensaje: "Producto registrado con éxito." });
            }
        }

        // Series por Producto
        if (path.match(/\/api\/productos\/\d+\/series/)) {
            const parts = path.split('/');
            const prodId = Number(parts[parts.length - 2]);
            const series = db.get('producto_series').filter(s => s.producto_id === prodId);
            series.sort((a, b) => a.numero_serie.localeCompare(b.numero_serie));
            return jsonResponse(series);
        }

        // PUT/DELETE Producto
        if (path.match(/\/api\/productos\/\d+$/)) {
            const parts = path.split('/');
            const prodId = Number(parts[parts.length - 1]);
            
            if (method === 'PUT') {
                const data = JSON.parse(options.body);
                db.update('productos', prodId, {
                    categoria_id: Number(data.categoria_id),
                    nombre: data.nombre,
                    descripcion: data.descripcion || '',
                    stock_minimo: parseInt(data.stock_minimo || 0),
                    precio_base: parseFloat(data.precio_base || 0.0),
                    precio_final: parseFloat(data.precio_final || 0.0),
                    moneda: data.moneda || 'PEN',
                    detalles_tecnicos: data.detalles_tecnicos || ''
                });
                return jsonResponse({ exito: true, mensaje: "Producto actualizado con éxito." });
            }
            
            if (method === 'DELETE') {
                const comprasDet = db.get('compra_detalles');
                const ventasDet = db.get('venta_detalles');
                const hasHistory = comprasDet.some(cd => cd.producto_id === prodId) || ventasDet.some(vd => vd.producto_id === prodId);
                
                if (hasHistory) {
                    return jsonResponse({ exito: false, mensaje: "No se puede eliminar un producto con historial de compras o ventas." }, 400);
                }
                
                const series = db.get('producto_series');
                db.set('producto_series', series.filter(s => s.producto_id !== prodId));
                db.delete('productos', prodId);
                return jsonResponse({ exito: true, mensaje: "Producto eliminado con éxito." });
            }
        }

        // --- ACTORES ---
        if (path.endsWith('/api/actores')) {
            if (method === 'GET') {
                const tipo = parsedUrl.searchParams.get('tipo');
                let actors = db.get('actores');
                if (tipo) {
                    actors = actors.filter(a => a.tipo === tipo || a.tipo === 'Ambos');
                }
                actors.sort((a, b) => a.nombre_razon_social.localeCompare(b.nombre_razon_social));
                return jsonResponse(actors);
            }
            
            if (method === 'POST') {
                const data = JSON.parse(options.body);
                const actorId = db.insert('actores', {
                    tipo: data.tipo,
                    nombre_razon_social: data.nombre_razon_social,
                    tipo_documento: data.tipo_documento,
                    documento_identidad: data.documento_identidad,
                    telefono: data.telefono || '',
                    email: data.email || '',
                    direccion: data.direccion || ''
                });
                return jsonResponse({ exito: true, id: actorId, mensaje: "Actor registrado con éxito." });
            }
        }

        if (path.match(/\/api\/actores\/\d+\/estado-cuenta/)) {
            const parts = path.split('/');
            const actorId = Number(parts[parts.length - 2]);
            
            const por_cobrar = db.get('cuentas_por_cobrar').filter(c => c.cliente_id === actorId);
            const por_pagar = db.get('cuentas_por_pagar').filter(p => p.proveedor_id === actorId);
            
            const ventas = db.get('ventas');
            const compras = db.get('compras');
            
            por_cobrar.forEach(c => {
                const v = ventas.find(x => x.id === c.venta_id);
                c.documento = v ? `${v.serie_comprobante}-${v.correlativo_comprobante}` : '';
                c.fecha = v ? v.fecha_venta : '';
            });
            
            por_pagar.forEach(p => {
                const c = compras.find(x => x.id === p.compra_id);
                p.documento = c ? `${c.serie_comprobante}-${c.correlativo_comprobante}` : '';
                p.fecha = c ? c.fecha_compra : '';
            });
            
            return jsonResponse({ por_cobrar, por_pagar });
        }

        if (path.match(/\/api\/actores\/\d+$/)) {
            const parts = path.split('/');
            const actorId = Number(parts[parts.length - 1]);
            
            if (method === 'PUT') {
                const data = JSON.parse(options.body);
                db.update('actores', actorId, {
                    tipo: data.tipo,
                    nombre_razon_social: data.nombre_razon_social,
                    tipo_documento: data.tipo_documento,
                    documento_identidad: data.documento_identidad,
                    telefono: data.telefono || '',
                    email: data.email || '',
                    direccion: data.direccion || ''
                });
                return jsonResponse({ exito: true, mensaje: "Datos actualizados con éxito." });
            }
            
            if (method === 'DELETE') {
                const compras = db.get('compras');
                const ventas = db.get('ventas');
                const hasHistory = compras.some(c => c.proveedor_id === actorId) || ventas.some(v => v.cliente_id === actorId);
                
                if (hasHistory) {
                    return jsonResponse({ exito: false, mensaje: "No se puede eliminar un cliente/proveedor con historial de transacciones." }, 400);
                }
                db.delete('actores', actorId);
                return jsonResponse({ exito: true, mensaje: "Actor eliminado con éxito." });
            }
        }

        // --- COMPRAS ---
        if (path.endsWith('/api/compras')) {
            if (method === 'GET') {
                const compras = db.get('compras');
                const actors = db.get('actores');
                const users = db.get('usuarios');
                const result = compras.map(c => {
                    const p = actors.find(a => a.id === c.proveedor_id);
                    const u = users.find(x => x.id === c.usuario_id);
                    return {
                        ...c,
                        proveedor_nombre: p ? p.nombre_razon_social : '',
                        usuario_nombre: u ? u.nombre : ''
                    };
                });
                result.sort((a, b) => new Date(b.fecha_compra) - new Date(a.fecha_compra));
                return jsonResponse(result);
            }
            
            if (method === 'POST') {
                const data = JSON.parse(options.body);
                const activeUser = getLoggedInUser() || { id: 1, nombre: "Administrador ERP" };
                
                const proveedor_id = Number(data.proveedor_id);
                const tipo_comprobante = data.tipo_comprobante;
                
                const prov = db.get('actores').find(a => a.id === proveedor_id);
                if (!prov) throw new Error("El proveedor seleccionado no es válido o no existe.");
                
                if (tipo_comprobante === "Factura") {
                    if (prov.tipo_documento !== "RUC") {
                        throw new Error(`El proveedor seleccionado no cuenta con RUC (tipo registrado: ${prov.tipo_documento}). Las facturas exigen RUC obligatoriamente.`);
                    }
                    const doc_num = (prov.documento_identidad || "").trim();
                    if (doc_num.length !== 11 || !doc_num.startsWith("10") && !doc_num.startsWith("20") || isNaN(doc_num)) {
                        throw new Error("El RUC del proveedor registrado no es válido. Debe tener 11 dígitos numéricos y comenzar con 10 o 20.");
                    }
                }
                
                let total_calculado = 0.0;
                for (const item of data.items) {
                    total_calculado += parseFloat(item.precio_unitario) * parseInt(item.cantidad);
                }
                
                let subtotal, igv;
                if (tipo_comprobante === "Factura") {
                    subtotal = total_calculado / 1.18;
                    igv = total_calculado - subtotal;
                } else {
                    subtotal = total_calculado;
                    igv = 0.00;
                }
                
                const total = total_calculado;
                const tc = parseFloat(data.tipo_cambio || 3.7500);
                
                const compra_id = db.insert('compras', {
                    proveedor_id,
                    usuario_id: activeUser.id,
                    tipo_comprobante,
                    serie_comprobante: data.serie_comprobante,
                    correlativo_comprobante: data.correlativo_comprobante,
                    fecha_compra: new Date().toISOString(),
                    moneda: data.moneda,
                    tipo_cambio: tc,
                    metodo_pago: data.metodo_pago,
                    fecha_vencimiento: data.metodo_pago === 'Credito' ? data.fecha_vencimiento : null,
                    subtotal,
                    igv,
                    total,
                    estado: 'Completada',
                    observaciones: data.observaciones || ''
                });
                
                // Detalles y series
                const prods = db.get('productos');
                const series = db.get('producto_series');
                const compDets = db.get('compra_detalles');
                
                for (const item of data.items) {
                    const prodId = Number(item.producto_id);
                    const qty = parseInt(item.cantidad);
                    const precio_un = parseFloat(item.precio_unitario);
                    
                    compDets.push({
                        id: compDets.length + 1,
                        compra_id,
                        producto_id: prodId,
                        cantidad: qty,
                        precio_unitario: precio_un,
                        subtotal: qty * precio_un
                    });
                    
                    const pIdx = prods.findIndex(p => p.id === prodId);
                    if (pIdx !== -1) {
                        prods[pIdx].stock_actual += qty;
                        
                        if (prods[pIdx].maneja_series === 1) {
                            const itemSeries = item.series || [];
                            if (itemSeries.length !== qty) {
                                throw new Error(`Debe registrar exactamente ${qty} series para el producto seleccionado.`);
                            }
                            itemSeries.forEach(s => {
                                const sNum = typeof s === 'object' ? s.numero_serie : s;
                                const det_ind = typeof s === 'object' ? s.detalles_individuales : '';
                                series.push({
                                    id: series.reduce((max, x) => x.id > max ? x.id : max, 0) + 1,
                                    producto_id: prodId,
                                    numero_serie: sNum,
                                    estado: 'Disponible',
                                    compra_id,
                                    venta_id: null,
                                    detalles_individuales: det_ind
                                });
                            });
                        }
                    }
                }
                
                db.set('productos', prods);
                db.set('producto_series', series);
                db.set('compra_detalles', compDets);
                
                if (data.metodo_pago === 'Credito') {
                    if (!data.fecha_vencimiento) throw new Error("Debe ingresar una fecha de vencimiento válida para compras al crédito.");
                    db.insert('cuentas_por_pagar', {
                        compra_id,
                        proveedor_id,
                        monto_total: total,
                        monto_pagado: 0.00,
                        fecha_vencimiento: data.fecha_vencimiento,
                        estado: 'Pendiente'
                    });
                }
                
                return jsonResponse({ exito: true, compra_id, mensaje: "Compra registrada y stock actualizado con éxito." });
            }
        }

        if (path.match(/\/api\/compras\/\d+\/anular$/)) {
            const parts = path.split('/');
            const compraId = Number(parts[parts.length - 2]);
            
            const series = db.get('producto_series');
            const hasSold = series.some(s => s.compra_id === compraId && s.estado !== 'Disponible');
            if (hasSold) {
                return jsonResponse({ exito: false, mensaje: "No se puede anular la compra. Algunas de las series ingresadas ya han sido vendidas o movilizadas." }, 400);
            }
            
            const compras = db.get('compras');
            const cIdx = compras.findIndex(c => c.id === compraId);
            if (cIdx !== -1) {
                compras[cIdx].estado = 'Anulada';
                db.set('compras', compras);
                
                const prods = db.get('productos');
                const compDets = db.get('compra_detalles').filter(cd => cd.compra_id === compraId);
                
                compDets.forEach(cd => {
                    const pIdx = prods.findIndex(p => p.id === cd.producto_id);
                    if (pIdx !== -1) {
                        prods[pIdx].stock_actual = Math.max(0, prods[pIdx].stock_actual - cd.cantidad);
                    }
                });
                db.set('productos', prods);
                db.set('producto_series', series.filter(s => s.compra_id !== compraId));
            }
            return jsonResponse({ exito: true, mensaje: "Compra anulada con éxito. Stock e inventario revertidos." });
        }

        // --- VENTAS (POS) ---
        if (path.endsWith('/api/ventas')) {
            if (method === 'GET') {
                const ventas = db.get('ventas');
                const actors = db.get('actores');
                const users = db.get('usuarios');
                const result = ventas.map(v => {
                    const cli = actors.find(a => a.id === v.cliente_id);
                    const user = users.find(u => u.id === v.usuario_id);
                    return {
                        ...v,
                        cliente_nombre: cli ? cli.nombre_razon_social : (v.cliente_nombre_manual || ''),
                        usuario_nombre: user ? user.nombre : '',
                        metodo_pago: v.condicion_pago
                    };
                });
                result.sort((a, b) => new Date(b.fecha_venta) - new Date(a.fecha_venta));
                return jsonResponse(result);
            }
            
            if (method === 'POST') {
                const data = JSON.parse(options.body);
                const activeUser = getLoggedInUser() || { id: 1, nombre: "Vendedor POS", rol: "Vendedor" };
                const usuario_id = activeUser.id;
                
                const configs = db.get('configuracion');
                const config = configs[0] || {};
                const tipo_cambio = parseFloat(config.tipo_cambio_actual || 3.7500);
                
                let cliente_id = data.cliente_id;
                let cliente_nombre_manual = null;
                const tipo_comprobante = data.tipo_comprobante;
                
                if (cliente_id === null || cliente_id === undefined || cliente_id === 0 || cliente_id === "" || cliente_id === "0" || cliente_id === "None") {
                    cliente_id = null;
                    cliente_nombre_manual = (data.cliente_nombre_manual || "").trim();
                    if (!cliente_nombre_manual) {
                        throw new Error("Debe ingresar el nombre del comprador para el registro manual (Comprador Invitado).");
                    }
                    if (tipo_comprobante === "Factura") {
                        throw new Error("Las facturas requieren obligatoriamente un cliente registrado con RUC.");
                    }
                    if (data.condicion_pago === "Credito") {
                        throw new Error("Las ventas al crédito requieren obligatoriamente un cliente registrado para control de cuentas por cobrar.");
                    }
                } else {
                    cliente_id = Number(cliente_id);
                    const cli = db.get('actores').find(a => a.id === cliente_id);
                    if (!cli) throw new Error(`El cliente con ID ${cliente_id} no existe o no es un cliente válido.`);
                    
                    if (tipo_comprobante === "Factura") {
                        if (cli.tipo_documento !== "RUC") {
                            throw new Error(`El cliente seleccionado no cuenta con RUC (tipo registrado: ${cli.tipo_documento}). Las facturas exigen RUC obligatoriamente.`);
                        }
                        const doc_num = (cli.documento_identidad || "").trim();
                        if (doc_num.length !== 11 || !doc_num.startsWith("10") && !doc_num.startsWith("20") || isNaN(doc_num)) {
                            throw new Error("El RUC del cliente registrado no es válido. Debe tener 11 dígitos numéricos y comenzar con 10 o 20.");
                        }
                    }
                }
                
                const users = db.get('usuarios');
                const user = users.find(u => u.id === usuario_id);
                if (!user || user.activo === 0) throw new Error("El usuario/vendedor no está activo en el sistema.");
                const usuario_rol = user.rol;
                
                let venta_subtotal = 0.00;
                const detalles_a_insertar = [];
                const series_a_actualizar = [];
                
                const prods = db.get('productos');
                const series = db.get('producto_series');
                
                for (const item of data.items) {
                    const prodId = Number(item.producto_id);
                    const qty = parseInt(item.cantidad);
                    const tipo_precio = item.tipo_precio;
                    const meses_garantia = parseInt(item.meses_garantia || 0);
                    
                    const prod = prods.find(p => p.id === prodId);
                    if (!prod) throw new Error(`El producto con ID ${prodId} no existe.`);
                    
                    if (prod.maneja_series === 1) {
                        const seriesEnviadas = item.series_seleccionadas || [];
                        if (seriesEnviadas.length !== qty) {
                            throw new Error(`Debe seleccionar exactamente {qty} número(s) de serie para el producto '${prod.nombre}'.`);
                        }
                        for (const sn of seriesEnviadas) {
                            const sFisica = series.find(s => s.producto_id === prodId && s.numero_serie === sn && s.estado === 'Disponible');
                            if (!sFisica) {
                                throw new Error(`La serie '${sn}' del producto '${prod.nombre}' no está disponible o ya fue vendida.`);
                            }
                            series_a_actualizar.push({
                                id: sFisica.id,
                                meses_garantia
                            });
                        }
                    } else {
                        if (prod.stock_actual < qty) {
                            throw new Error(`Stock insuficiente para el producto '${prod.nombre}'. Disponible: ${prod.stock_actual}, Solicitado: ${qty}`);
                        }
                    }
                    
                    let precio_unitario_base = 0.00;
                    if (tipo_precio === "Base") {
                        precio_unitario_base = prod.precio_base;
                    } else if (tipo_precio === "Final") {
                        precio_unitario_base = prod.precio_final;
                    } else if (tipo_precio === "Manual") {
                        const precio_manual = parseFloat(item.precio_manual || 0.0);
                        if (usuario_rol !== "Administrador" && precio_manual !== prod.precio_final) {
                            throw new Error(`No tiene permisos de administrador para alterar el precio de venta del producto '${prod.nombre}' de manera manual.`);
                        }
                        precio_unitario_base = precio_manual;
                    } else {
                        throw new Error(`Tipo de precio '${tipo_precio}' no es válido.`);
                    }
                    
                    let precio_unitario_trans = precio_unitario_base;
                    if (data.moneda === "USD") {
                        precio_unitario_trans = precio_unitario_base / tipo_cambio;
                    }
                    const item_sub = precio_unitario_trans * qty;
                    venta_subtotal += item_sub;
                    
                    detalles_a_insertar.push({
                        producto_id: prodId,
                        cantidad: qty,
                        tipo_precio,
                        precio_unitario: precio_unitario_trans,
                        meses_garantia,
                        subtotal: item_sub
                    });
                }
                
                const venta_total = venta_subtotal;
                let subtotal_sin_igv, venta_igv;
                if (tipo_comprobante === "Factura") {
                    subtotal_sin_igv = venta_total / 1.18;
                    venta_igv = venta_total - subtotal_sin_igv;
                } else {
                    subtotal_sin_igv = venta_total;
                    venta_igv = 0.00;
                }
                
                // Serie y correlativo
                const secuencias = db.get('secuencias_comprobante');
                const seq = secuencias.find(s => s.tipo === tipo_comprobante);
                if (!seq) throw new Error(`No se ha configurado una serie/correlativo para el comprobante tipo '${tipo_comprobante}'.`);
                
                const serie_comprobante = seq.serie;
                const nuevo_correlativo = seq.correlativo_actual + 1;
                seq.correlativo_actual = nuevo_correlativo;
                db.set('secuencias_comprobante', secuencias);
                
                const correlativo_str = String(nuevo_correlativo).padStart(8, '0');
                
                const venta_id = db.insert('ventas', {
                    cliente_id,
                    usuario_id,
                    tipo_comprobante,
                    serie_comprobante,
                    correlativo_comprobante: correlativo_str,
                    fecha_venta: new Date().toISOString(),
                    moneda: data.moneda,
                    tipo_cambio,
                    condicion_pago: data.condicion_pago,
                    fecha_vencimiento: data.condicion_pago === 'Credito' ? data.fecha_vencimiento : null,
                    subtotal: subtotal_sin_igv,
                    igv: venta_igv,
                    total: venta_total,
                    estado: 'Completada',
                    observaciones: data.observaciones || '',
                    cliente_nombre_manual
                });
                
                // Detalles y stock
                const ventaDets = db.get('venta_detalles');
                for (const det of detalles_a_insertar) {
                    ventaDets.push({
                        id: ventaDets.length + 1,
                        venta_id,
                        producto_id: det.producto_id,
                        cantidad: det.cantidad,
                        tipo_precio: det.tipo_precio,
                        precio_unitario: det.precio_unitario,
                        meses_garantia: det.meses_garantia,
                        subtotal: det.subtotal
                    });
                    
                    const pIdx = prods.findIndex(p => p.id === det.producto_id);
                    if (pIdx !== -1) {
                        prods[pIdx].stock_actual = Math.max(0, prods[pIdx].stock_actual - det.cantidad);
                    }
                }
                
                db.set('productos', prods);
                db.set('venta_detalles', ventaDets);
                
                // Actualizar series
                for (const s of series_a_actualizar) {
                    const sIdx = series.findIndex(x => x.id === s.id);
                    if (sIdx !== -1) {
                        series[sIdx].estado = s.meses_garantia > 0 ? 'En Garantia' : 'Vendido';
                        series[sIdx].venta_id = venta_id;
                    }
                }
                db.set('producto_series', series);
                
                // Cobros / Créditos
                if (data.condicion_pago === "Credito") {
                    if (!data.fecha_vencimiento) throw new Error("Debe ingresar una fecha de vencimiento válida para ventas al crédito.");
                    db.insert('cuentas_por_cobrar', {
                        venta_id,
                        cliente_id,
                        monto_total: venta_total,
                        monto_pagado: 0.00,
                        fecha_vencimiento: data.fecha_vencimiento,
                        estado: 'Pendiente'
                    });
                } else {
                    const pagos = data.pagos || [];
                    if (pagos.length === 0) throw new Error("Debe ingresar al menos un método de pago para ventas al contado.");
                    
                    let total_pago = 0.0;
                    for (const p of pagos) {
                        total_pago += parseFloat(p.monto || 0.0);
                    }
                    if (total_pago < venta_total - 0.005) {
                        throw new Error(`El monto total pagado (${total_pago.toFixed(2)}) es menor que el total de la venta (${venta_total.toFixed(2)}).`);
                    }
                    
                    const ventaPagos = db.get('venta_pagos');
                    for (const p of pagos) {
                        const monto = parseFloat(p.monto || 0.0);
                        if (monto > 0) {
                            ventaPagos.push({
                                id: ventaPagos.length + 1,
                                venta_id,
                                metodo_pago: p.metodo_pago,
                                monto,
                                moneda: data.moneda
                            });
                        }
                    }
                    db.set('venta_pagos', ventaPagos);
                }
                
                return jsonResponse({
                    exito: true,
                    venta_id,
                    comprobante: `${serie_comprobante}-${correlativo_str}`,
                    total: venta_total
                });
            }
        }

        if (path.match(/\/api\/ventas\/\d+\/pagos$/)) {
            const parts = path.split('/');
            const ventaId = Number(parts[parts.length - 2]);
            const pagos = db.get('venta_pagos').filter(p => p.venta_id === ventaId);
            return jsonResponse(pagos);
        }

        if (path.match(/\/api\/ventas\/\d+\/detalles$/)) {
            const parts = path.split('/');
            const ventaId = Number(parts[parts.length - 2]);
            
            const details = db.get('venta_detalles').filter(d => d.venta_id === ventaId);
            const prods = db.get('productos');
            const series = db.get('producto_series');
            
            const result = details.map(d => {
                const prod = prods.find(p => p.id === d.producto_id);
                const sVendidas = series.filter(s => s.venta_id === ventaId && s.producto_id === d.producto_id).map(s => s.numero_serie);
                return {
                    ...d,
                    producto_nombre: prod ? prod.nombre : '',
                    maneja_series: prod ? prod.maneja_series : 0,
                    series_vendidas: sVendidas
                };
            });
            return jsonResponse(result);
        }

        if (path.match(/\/api\/ventas\/\d+\/anular$/)) {
            const parts = path.split('/');
            const ventaId = Number(parts[parts.length - 2]);
            
            const ventas = db.get('ventas');
            const vIdx = ventas.findIndex(v => v.id === ventaId);
            if (vIdx !== -1) {
                ventas[vIdx].estado = 'Anulada';
                db.set('ventas', ventas);
                
                const prods = db.get('productos');
                const details = db.get('venta_detalles').filter(d => d.venta_id === ventaId);
                details.forEach(d => {
                    const pIdx = prods.findIndex(p => p.id === d.producto_id);
                    if (pIdx !== -1) {
                        prods[pIdx].stock_actual += d.cantidad;
                    }
                });
                db.set('productos', prods);
                
                const series = db.get('producto_series');
                series.forEach(s => {
                    if (s.venta_id === ventaId) {
                        s.estado = 'Disponible';
                        s.venta_id = null;
                    }
                });
                db.set('producto_series', series);
            }
            return jsonResponse({ exito: true, mensaje: "Venta anulada con éxito. Stock y series físicas liberados." });
        }

        // --- ABONOS ---
        if (path.endsWith('/api/abonos') && method === 'POST') {
            const data = JSON.parse(options.body);
            const ref_id = Number(data.referencia_id);
            const monto_abono = parseFloat(data.monto_abono || 0.0);
            
            if (monto_abono <= 0) throw new Error("El monto del abono debe ser mayor a cero.");
            
            if (data.tipo === 'cobrar') {
                const cobrars = db.get('cuentas_por_cobrar');
                const idx = cobrars.findIndex(c => c.venta_id === ref_id);
                if (idx === -1) throw new Error("No se encontró una cuenta por cobrar pendiente para esta venta.");
                
                const cuenta = cobrars[idx];
                const nuevo_pagado = cuenta.monto_pagado + monto_abono;
                if (nuevo_pagado > cuenta.monto_total + 0.01) {
                    throw new Error(`El abono excede el saldo pendiente. Saldo actual: ${(cuenta.monto_total - cuenta.monto_pagado).toFixed(2)}`);
                }
                
                cuenta.monto_pagado = nuevo_pagado;
                cuenta.estado = Math.abs(nuevo_pagado - cuenta.monto_total) < 0.01 || nuevo_pagado >= cuenta.monto_total ? 'Pagado' : 'Pendiente';
                db.set('cuentas_por_cobrar', cobrars);
                
            } else if (data.tipo === 'pagar') {
                const pagars = db.get('cuentas_por_pagar');
                const idx = pagars.findIndex(c => c.compra_id === ref_id);
                if (idx === -1) throw new Error("No se encontró una cuenta por pagar pendiente para esta compra.");
                
                const cuenta = pagars[idx];
                const nuevo_pagado = cuenta.monto_pagado + monto_abono;
                if (nuevo_pagado > cuenta.monto_total + 0.01) {
                    throw new Error(`El abono excede el saldo pendiente. Saldo actual: ${(cuenta.monto_total - cuenta.monto_pagado).toFixed(2)}`);
                }
                
                cuenta.monto_pagado = nuevo_pagado;
                cuenta.estado = Math.abs(nuevo_pagado - cuenta.monto_total) < 0.01 || nuevo_pagado >= cuenta.monto_total ? 'Pagado' : 'Pendiente';
                db.set('cuentas_por_pagar', pagars);
            } else {
                throw new Error("Tipo de abono inválido.");
            }
            
            return jsonResponse({ exito: true, mensaje: "Abono registrado con éxito." });
        }

        // --- MOVIMIENTOS DE KÁRDEX ---
        if (path.endsWith('/api/inventario/movimientos') && method === 'GET') {
            const fecha_inicio = parsedUrl.searchParams.get('fecha_inicio');
            const fecha_fin = parsedUrl.searchParams.get('fecha_fin');
            const categoria_id = parsedUrl.searchParams.get('categoria_id');
            const producto_id = parsedUrl.searchParams.get('producto_id');
            const tipo_movimiento = parsedUrl.searchParams.get('tipo_movimiento') || 'Todos';
            const numero_serie = parsedUrl.searchParams.get('numero_serie');
            const cliente_filtro = parsedUrl.searchParams.get('cliente_filtro');
            const usuario_id_filtro = parsedUrl.searchParams.get('usuario_id');
            
            const prods = db.get('productos');
            const cats = db.get('categorias');
            const actors = db.get('actores');
            const users = db.get('usuarios');
            const series = db.get('producto_series');
            
            const movimientos = [];
            
            // Compras (Entradas)
            if (tipo_movimiento === 'Todos' || tipo_movimiento === 'Entrada') {
                const compras = db.get('compras').filter(c => c.estado === 'Completada');
                const compraDets = db.get('compra_detalles');
                
                compras.forEach(c => {
                    const cDets = compraDets.filter(cd => cd.compra_id === c.id);
                    cDets.forEach(cd => {
                        const prod = prods.find(p => p.id === cd.producto_id);
                        if (!prod) return;
                        const cat = cats.find(ct => ct.id === prod.categoria_id);
                        const prov = actors.find(a => a.id === c.proveedor_id);
                        const user = users.find(u => u.id === c.usuario_id);
                        
                        if (prod.maneja_series === 1) {
                            const cSeries = series.filter(s => s.compra_id === c.id && s.producto_id === prod.id);
                            cSeries.forEach(s => {
                                movimientos.push({
                                    fecha: c.fecha_compra,
                                    tipo_movimiento: 'Entrada',
                                    producto_id: prod.id,
                                    producto_nombre: prod.nombre,
                                    maneja_series: 1,
                                    categoria_id: cat ? cat.id : null,
                                    categoria_nombre: cat ? cat.nombre : '',
                                    cantidad: 1,
                                    documento: `${c.tipo_comprobante} ${c.serie_comprobante}-${c.correlativo_comprobante}`,
                                    actor_nombre: prov ? prov.nombre_razon_social : '',
                                    moneda: c.moneda,
                                    precio_unitario: cd.precio_unitario,
                                    numero_serie: s.numero_serie,
                                    usuario_nombre: user ? user.nombre : '',
                                    usuario_id: c.usuario_id
                                });
                            });
                        } else {
                            movimientos.push({
                                fecha: c.fecha_compra,
                                tipo_movimiento: 'Entrada',
                                producto_id: prod.id,
                                producto_nombre: prod.nombre,
                                maneja_series: 0,
                                categoria_id: cat ? cat.id : null,
                                categoria_nombre: cat ? cat.nombre : '',
                                cantidad: cd.cantidad,
                                documento: `${c.tipo_comprobante} ${c.serie_comprobante}-${c.correlativo_comprobante}`,
                                actor_nombre: prov ? prov.nombre_razon_social : '',
                                moneda: c.moneda,
                                precio_unitario: cd.precio_unitario,
                                numero_serie: null,
                                usuario_nombre: user ? user.nombre : '',
                                usuario_id: c.usuario_id
                            });
                        }
                    });
                });
            }
            
            // Ventas (Salidas)
            if (tipo_movimiento === 'Todos' || tipo_movimiento === 'Salida') {
                const ventas = db.get('ventas').filter(v => v.estado === 'Completada');
                const ventaDets = db.get('venta_detalles');
                
                ventas.forEach(v => {
                    const vDets = ventaDets.filter(vd => vd.venta_id === v.id);
                    vDets.forEach(vd => {
                        const prod = prods.find(p => p.id === vd.producto_id);
                        if (!prod) return;
                        const cat = cats.find(ct => ct.id === prod.categoria_id);
                        const cli = actors.find(a => a.id === v.cliente_id);
                        const user = users.find(u => u.id === v.usuario_id);
                        
                        if (prod.maneja_series === 1) {
                            const vSeries = series.filter(s => s.venta_id === v.id && s.producto_id === prod.id);
                            vSeries.forEach(s => {
                                movimientos.push({
                                    fecha: v.fecha_venta,
                                    tipo_movimiento: 'Salida',
                                    producto_id: prod.id,
                                    producto_nombre: prod.nombre,
                                    maneja_series: 1,
                                    categoria_id: cat ? cat.id : null,
                                    categoria_nombre: cat ? cat.nombre : '',
                                    cantidad: 1,
                                    documento: `${v.tipo_comprobante} ${v.serie_comprobante}-${v.correlativo_comprobante}`,
                                    actor_nombre: cli ? cli.nombre_razon_social : (v.cliente_nombre_manual || ''),
                                    moneda: v.moneda,
                                    precio_unitario: vd.precio_unitario,
                                    numero_serie: s.numero_serie,
                                    usuario_nombre: user ? user.nombre : '',
                                    usuario_id: v.usuario_id
                                });
                            });
                        } else {
                            movimientos.push({
                                fecha: v.fecha_venta,
                                tipo_movimiento: 'Salida',
                                producto_id: prod.id,
                                producto_nombre: prod.nombre,
                                maneja_series: 0,
                                categoria_id: cat ? cat.id : null,
                                categoria_nombre: cat ? cat.nombre : '',
                                cantidad: vd.cantidad,
                                documento: `${v.tipo_comprobante} ${v.serie_comprobante}-${v.correlativo_comprobante}`,
                                actor_nombre: cli ? cli.nombre_razon_social : (v.cliente_nombre_manual || ''),
                                moneda: v.moneda,
                                precio_unitario: vd.precio_unitario,
                                numero_serie: null,
                                usuario_nombre: user ? user.nombre : '',
                                usuario_id: v.usuario_id
                            });
                        }
                    });
                });
            }
            
            // Filtrados
            let filtered = movimientos;
            if (fecha_inicio) {
                filtered = filtered.filter(m => m.fecha.split('T')[0] >= fecha_inicio);
            }
            if (fecha_fin) {
                filtered = filtered.filter(m => m.fecha.split('T')[0] <= fecha_fin);
            }
            if (categoria_id && categoria_id !== '') {
                filtered = filtered.filter(m => m.categoria_id === Number(categoria_id));
            }
            if (producto_id && producto_id !== '') {
                filtered = filtered.filter(m => m.producto_id === Number(producto_id));
            }
            if (numero_serie && numero_serie !== '') {
                filtered = filtered.filter(m => m.numero_serie && m.numero_serie.toLowerCase().includes(numero_serie.toLowerCase()));
            }
            if (cliente_filtro && cliente_filtro !== '') {
                filtered = filtered.filter(m => m.actor_nombre && m.actor_nombre.toLowerCase().includes(cliente_filtro.toLowerCase()));
            }
            if (usuario_id_filtro && usuario_id_filtro !== '' && usuario_id_filtro !== 'Todos') {
                filtered = filtered.filter(m => m.usuario_id === Number(usuario_id_filtro));
            }
            
            filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            return jsonResponse(filtered);
        }

        // --- DASHBOARD STATS ---
        if (path.endsWith('/api/dashboard/stats') && method === 'GET') {
            const todayStr = new Date().toISOString().split('T')[0];
            const currentMonthStr = new Date().toISOString().substring(0, 7);
            
            const ventas = db.get('ventas').filter(v => v.estado === 'Completada');
            const compras = db.get('compras').filter(c => c.estado === 'Completada');
            const actors = db.get('actores');
            const prods = db.get('productos');
            const cats = db.get('categorias');
            const ventaDets = db.get('venta_detalles');
            
            // 1. Ventas de hoy
            const res_ventas = { PEN: 0.0, USD: 0.0 };
            ventas.forEach(v => {
                if (v.fecha_venta.split('T')[0] === todayStr) {
                    res_ventas[v.moneda] += parseFloat(v.total);
                }
            });
            
            // 2. Compras del mes
            const res_compras_mes = { PEN: 0.0, USD: 0.0 };
            compras.forEach(c => {
                if (c.fecha_compra.substring(0, 7) === currentMonthStr) {
                    res_compras_mes[c.moneda] += parseFloat(c.total);
                }
            });
            
            // 3. Clientes Activos
            const clientes_activos = actors.filter(a => a.tipo === 'Cliente' || a.tipo === 'Ambos').length;
            
            // 4. Bajo stock
            const bajo_stock = prods.filter(p => p.stock_actual <= p.stock_minimo).sort((a,b) => a.stock_actual - b.stock_actual);
            
            // 5. Histórico gráfico
            const monthlyGroup = {};
            ventas.forEach(v => {
                const mes = v.fecha_venta.substring(0, 7);
                const key = `${mes}_${v.moneda}`;
                if (!monthlyGroup[key]) {
                    monthlyGroup[key] = { mes, total: 0.0, moneda: v.moneda };
                }
                monthlyGroup[key].total += parseFloat(v.total);
            });
            const grafico_ventas = Object.values(monthlyGroup).sort((a,b) => b.mes.localeCompare(a.mes)).slice(0, 12);
            
            // 6. Utilidades
            const res_utilidad = { PEN: 0.0, USD: 0.0 };
            const utilGroup = { PEN: { total_cobrado: 0.0, costo_total: 0.0 }, USD: { total_cobrado: 0.0, costo_total: 0.0 } };
            
            ventaDets.forEach(vd => {
                const sale = ventas.find(v => v.id === vd.venta_id);
                if (sale) {
                    const prod = prods.find(p => p.id === vd.producto_id);
                    if (prod) {
                        const tcFactor = sale.moneda === 'USD' ? parseFloat(sale.tipo_cambio || 3.7500) : 1.0;
                        utilGroup[sale.moneda].total_cobrado += parseFloat(vd.subtotal);
                        utilGroup[sale.moneda].costo_total += (parseInt(vd.cantidad) * parseFloat(prod.precio_base)) / tcFactor;
                    }
                }
            });
            res_utilidad.PEN = Math.round((utilGroup.PEN.total_cobrado - utilGroup.PEN.costo_total) * 100) / 100;
            res_utilidad.USD = Math.round((utilGroup.USD.total_cobrado - utilGroup.USD.costo_total) * 100) / 100;
            
            // 7. Ventas recientes
            const ventas_recientes = db.get('ventas').map(v => {
                const cli = actors.find(a => a.id === v.cliente_id);
                return {
                    id: v.id,
                    cliente_nombre: cli ? cli.nombre_razon_social : (v.cliente_nombre_manual || ''),
                    documento: `${v.tipo_comprobante} ${v.serie_comprobante}-${v.correlativo_comprobante}`,
                    total: v.total,
                    moneda: v.moneda,
                    fecha_venta: v.fecha_venta,
                    estado: v.estado
                };
            }).sort((a,b) => new Date(b.fecha_venta) - new Date(a.fecha_venta)).slice(0, 5);
            
            // 8. Categorías más vendidas
            const catSales = {};
            ventaDets.forEach(vd => {
                const sale = ventas.find(v => v.id === vd.venta_id);
                if (sale) {
                    const prod = prods.find(p => p.id === vd.producto_id);
                    if (prod) {
                        const cat = cats.find(c => c.id === prod.categoria_id);
                        if (cat) {
                            catSales[cat.nombre] = (catSales[cat.nombre] || 0) + parseInt(vd.cantidad);
                        }
                    }
                }
            });
            const categorias_vendidas = Object.entries(catSales).map(([categoria, total_vendido]) => ({
                categoria,
                total_vendido
            })).sort((a,b) => b.total_vendido - a.total_vendido).slice(0, 5);
            
            return jsonResponse({
                ventas_hoy: res_ventas,
                compras_mes: res_compras_mes,
                clientes_activos,
                bajo_stock,
                grafico_ventas,
                utilidades: res_utilidad,
                ventas_recientes,
                categorias_vendidas
            });
        }

        // --- USUARIOS ---
        if (path.endsWith('/api/usuarios')) {
            if (method === 'GET') {
                const users = db.get('usuarios').map(u => ({
                    id: u.id,
                    nombre: u.nombre,
                    username: u.username,
                    email: u.email,
                    rol: u.rol,
                    activo: u.activo
                }));
                users.sort((a,b) => a.nombre.localeCompare(b.nombre));
                return jsonResponse(users);
            }
            
            if (method === 'POST') {
                const data = JSON.parse(options.body);
                if (!data.nombre || !data.username || !data.email || !data.password || !data.rol) {
                    return jsonResponse({ exito: false, mensaje: "Faltan datos obligatorios." }, 400);
                }
                const userId = db.insert('usuarios', {
                    nombre: data.nombre,
                    username: data.username,
                    email: data.email,
                    password_hash: data.password,
                    rol: data.rol,
                    activo: 1
                });
                return jsonResponse({ exito: true, id: userId, mensaje: "Colaborador registrado con éxito." });
            }
        }

        if (path.match(/\/api\/usuarios\/\d+\/estado$/)) {
            const parts = path.split('/');
            const userId = Number(parts[parts.length - 2]);
            const data = JSON.parse(options.body);
            const activo = data.activo ? 1 : 0;
            db.update('usuarios', userId, { activo });
            return jsonResponse({ exito: true, mensaje: "Estado del colaborador actualizado." });
        }

        // --- T.C. HISTORIAL ---
        if (path.endsWith('/api/config/tc-historial') && method === 'GET') {
            return jsonResponse(db.get('historial_tipo_cambio').slice(0, 15));
        }

        // Fallback default
        return jsonResponse({ exito: false, mensaje: `Ruta mock no implementada: ${method} ${path}` }, 404);
    }
})();
