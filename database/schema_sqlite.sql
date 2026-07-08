-- ==============================================================================
-- SCHEMA DE BASE DE DATOS: SQLite (ERP / POS local)
-- Optimizado para SQLite con triggers de control de stock y consistencia
-- ==============================================================================

-- Habilitar llaves foráneas en SQLite (debe ejecutarse en cada conexión)
PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. TABLA: configuracion_sistema
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_nombre TEXT NOT NULL,
    empresa_ruc TEXT NOT NULL UNIQUE,
    empresa_direccion TEXT,
    empresa_telefono TEXT,
    empresa_email TEXT,
    moneda_defecto TEXT DEFAULT 'PEN', -- 'PEN' o 'USD'
    tipo_cambio_actual REAL NOT NULL DEFAULT 3.7500, -- Tipo de cambio del día (Soles por 1 Dólar)
    logo_path TEXT, -- Ruta del logotipo de la empresa
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. TABLA: usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('Administrador', 'Vendedor', 'Almacenero')),
    activo INTEGER DEFAULT 1 CHECK (activo IN (0, 1)), -- 0=Inactivo, 1=Activo
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. TABLA: categorias
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 4. TABLA: productos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    maneja_series INTEGER DEFAULT 0 NOT NULL CHECK (maneja_series IN (0, 1)), -- 0=Falso, 1=Verdadero
    stock_minimo INTEGER DEFAULT 0 CHECK (stock_minimo >= 0),
    stock_actual INTEGER DEFAULT 0 CHECK (stock_actual >= 0),
    precio_base REAL NOT NULL DEFAULT 0.00 CHECK (precio_base >= 0), -- Costo
    precio_mayorista REAL NOT NULL DEFAULT 0.00 CHECK (precio_mayorista >= 0), -- Mayorista
    precio_final REAL NOT NULL DEFAULT 0.00 CHECK (precio_final >= 0), -- Precio al cliente final
    moneda TEXT DEFAULT 'PEN' CHECK (moneda IN ('PEN', 'USD')), -- Moneda base del producto
    detalles_tecnicos TEXT, -- Especificaciones del modelo
    marca TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 5. TABLA: actores (Clientes & Proveedores)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('Cliente', 'Proveedor', 'Ambos')),
    nombre_razon_social TEXT NOT NULL,
    tipo_documento TEXT NOT NULL CHECK (tipo_documento IN ('DNI', 'RUC', 'CE', 'Pasaporte')),
    documento_identidad TEXT NOT NULL UNIQUE,
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 6. TABLA: compras
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_comprobante TEXT NOT NULL CHECK (tipo_comprobante IN ('Factura', 'Boleta', 'Guia de Remision', 'Nota de Credito', 'Nota de Compra')),
    serie_comprobante TEXT NOT NULL,
    correlativo_comprobante TEXT NOT NULL,
    fecha_compra TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    moneda TEXT NOT NULL CHECK (moneda IN ('PEN', 'USD')),
    tipo_cambio REAL NOT NULL CHECK (tipo_cambio > 0),
    metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('Contado', 'Credito')),
    fecha_vencimiento TEXT, -- YYYY-MM-DD
    subtotal REAL NOT NULL DEFAULT 0.00,
    igv REAL NOT NULL DEFAULT 0.00,
    total REAL NOT NULL DEFAULT 0.00,
    estado TEXT DEFAULT 'Completada' NOT NULL CHECK (estado IN ('Completada', 'Anulada')),
    observaciones TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 7. TABLA: compra_detalles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compra_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
    subtotal REAL NOT NULL
);

-- -----------------------------------------------------------------------------
-- 8. TABLA: ventas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER REFERENCES actores(id) ON DELETE RESTRICT, -- Nullable para Comprador Invitado
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_comprobante TEXT NOT NULL CHECK (tipo_comprobante IN ('Factura', 'Boleta', 'Guia de Remision', 'Ticket', 'Nota de Venta')),
    serie_comprobante TEXT NOT NULL,
    correlativo_comprobante TEXT NOT NULL,
    fecha_venta TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    moneda TEXT NOT NULL CHECK (moneda IN ('PEN', 'USD')),
    tipo_cambio REAL NOT NULL CHECK (tipo_cambio > 0),
    condicion_pago TEXT NOT NULL CHECK (condicion_pago IN ('Contado', 'Credito')),
    fecha_vencimiento TEXT, -- YYYY-MM-DD
    subtotal REAL NOT NULL DEFAULT 0.00,
    igv REAL NOT NULL DEFAULT 0.00,
    total REAL NOT NULL DEFAULT 0.00,
    estado TEXT DEFAULT 'Completada' NOT NULL CHECK (estado IN ('Completada', 'Anulada')),
    observaciones TEXT,
    cliente_nombre_manual TEXT, -- Registro manual de comprador invitado
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 9. TABLA: venta_detalles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    tipo_precio TEXT NOT NULL CHECK (tipo_precio IN ('Base', 'Final', 'Manual')),
    precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
    meses_garantia INTEGER DEFAULT 0 CHECK (meses_garantia >= 0),
    subtotal REAL NOT NULL
);

-- -----------------------------------------------------------------------------
-- 9b. TABLA: venta_pagos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta_pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('Efectivo', 'Transferencia', 'Yape/Plin', 'Tarjeta')),
    monto REAL NOT NULL CHECK (monto >= 0),
    moneda TEXT NOT NULL CHECK (moneda IN ('PEN', 'USD'))
);

-- -----------------------------------------------------------------------------
-- 10. TABLA: producto_series
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    numero_serie TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Disponible' CHECK (estado IN ('Disponible', 'Vendido', 'En Garantia', 'Devuelto', 'Prestado')),
    compra_id INTEGER REFERENCES compras(id) ON DELETE RESTRICT,
    venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
    prestamo_id INTEGER REFERENCES prestamos_intertienda(id) ON DELETE SET NULL,
    detalles_individuales TEXT, -- Especificaciones físicas de la unidad
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_producto_serie UNIQUE (producto_id, numero_serie)
);

-- -----------------------------------------------------------------------------
-- 11. TABLA: historial_tipo_cambio
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_tipo_cambio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL UNIQUE DEFAULT (date('now')),
    tipo_cambio REAL NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 12. TABLA: cuentas_por_cobrar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
    monto_total REAL NOT NULL,
    monto_pagado REAL DEFAULT 0.00 NOT NULL,
    fecha_vencimiento TEXT NOT NULL, -- YYYY-MM-DD
    estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Pagado', 'Vencido')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 13. TABLA: cuentas_por_pagar
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id INTEGER REFERENCES compras(id) ON DELETE CASCADE,
    proveedor_id INTEGER NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
    monto_total REAL NOT NULL,
    monto_pagado REAL DEFAULT 0.00 NOT NULL,
    fecha_vencimiento TEXT NOT NULL, -- YYYY-MM-DD
    estado TEXT DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Pagado', 'Vencido')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 14. TABLA: secuencias_comprobante
-- Maneja los correlativos del POS para evitar duplicidad
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secuencias_comprobante (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL UNIQUE CHECK (tipo IN ('Factura', 'Boleta', 'Guia de Remision', 'Ticket', 'Nota de Venta', 'Nota de Compra')),
    serie TEXT NOT NULL,
    correlativo_actual INTEGER NOT NULL DEFAULT 0
);

-- ==============================================================================
-- ÍNDICES DE OPTIMIZACIÓN
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_producto_series_numero ON producto_series(numero_serie);
CREATE INDEX IF NOT EXISTS idx_producto_series_estado ON producto_series(producto_id, estado);
CREATE INDEX IF NOT EXISTS idx_actores_documento ON actores(documento_identidad);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_compra_detalles_compra ON compra_detalles(compra_id);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta ON venta_detalles(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta ON venta_pagos(venta_id);

-- ==============================================================================
-- TRIGGERS DE CONTROL DE STOCK (SQLite)
-- ==============================================================================

-- 1. Incrementar stock al registrar detalle de compra
CREATE TRIGGER IF NOT EXISTS trg_compra_detalle_insert
AFTER INSERT ON compra_detalles
BEGIN
    UPDATE productos
    SET stock_actual = stock_actual + NEW.cantidad
    WHERE id = NEW.producto_id;
END;

-- 2. Restar stock al registrar detalle de venta
CREATE TRIGGER IF NOT EXISTS trg_venta_detalle_insert
AFTER INSERT ON venta_detalles
BEGIN
    UPDATE productos
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.producto_id;
END;

-- 3. Revertir stock y series si una venta es anulada
CREATE TRIGGER IF NOT EXISTS trg_venta_anulada
AFTER UPDATE OF estado ON ventas
WHEN NEW.estado = 'Anulada' AND OLD.estado != 'Anulada'
BEGIN
    -- Devolver stock tradicional
    UPDATE productos
    SET stock_actual = stock_actual + (
        SELECT COALESCE(SUM(vd.cantidad), 0)
        FROM venta_detalles vd
        WHERE vd.venta_id = NEW.id AND vd.producto_id = productos.id
    )
    WHERE id IN (SELECT producto_id FROM venta_detalles WHERE venta_id = NEW.id);

    -- Devolver series a 'Disponible'
    UPDATE producto_series
    SET estado = 'Disponible', venta_id = NULL
    WHERE venta_id = NEW.id;
END;

-- 4. Revertir stock y series si una compra es anulada
CREATE TRIGGER IF NOT EXISTS trg_compra_anulada
AFTER UPDATE OF estado ON compras
WHEN NEW.estado = 'Anulada' AND OLD.estado != 'Anulada'
BEGIN
    -- Reducir stock tradicional
    UPDATE productos
    SET stock_actual = stock_actual - (
        SELECT COALESCE(SUM(cd.cantidad), 0)
        FROM compra_detalles cd
        WHERE cd.compra_id = NEW.id AND cd.producto_id = productos.id
    )
    WHERE id IN (SELECT producto_id FROM compra_detalles WHERE compra_id = NEW.id);

    -- Eliminar series que ingresaron con esta compra
    DELETE FROM producto_series
    WHERE compra_id = NEW.id;
END;

-- ==============================================================================
-- MODULO DE SERVICIO TECNICO Y REPARACIONES
-- ==============================================================================

-- 15. TABLA: ordenes_servicio (Tabla Principal)
CREATE TABLE IF NOT EXISTS ordenes_servicio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER REFERENCES actores(id) ON DELETE RESTRICT,
    producto_serie_id INTEGER REFERENCES producto_series(id) ON DELETE SET NULL,
    equipo_marca_modelo TEXT NOT NULL,
    numero_serie_externo TEXT,
    problema_reportado TEXT NOT NULL,
    diagnostico_tecnico TEXT,
    estado TEXT NOT NULL CHECK (estado IN ('Recibido', 'En Diagnostico', 'Reparado', 'No Reparable', 'Entregado')) DEFAULT 'Recibido',
    fecha_ingreso TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega TEXT,
    garantia_servicio_meses INTEGER DEFAULT 0,
    costo_servicio REAL NOT NULL DEFAULT 0.00,
    total_pagar REAL NOT NULL DEFAULT 0.00,
    metodo_pago TEXT,
    cliente_nombre_manual TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 16. TABLA: orden_servicio_repuestos (Tabla Detalle)
CREATE TABLE IF NOT EXISTS orden_servicio_repuestos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_servicio_id INTEGER NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_aplicado REAL NOT NULL CHECK (precio_aplicado >= 0)
);

-- INDICES DE OPTIMIZACION
CREATE INDEX IF NOT EXISTS idx_ordenes_servicio_cliente ON ordenes_servicio(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_servicio_serie ON ordenes_servicio(producto_serie_id);
CREATE INDEX IF NOT EXISTS idx_orden_servicio_repuestos_orden ON orden_servicio_repuestos(orden_servicio_id);
CREATE INDEX IF NOT EXISTS idx_orden_servicio_repuestos_producto ON orden_servicio_repuestos(producto_id);

-- TRIGGERS DE CONTROL DE INVENTARIO
-- 1. Descontar stock al insertar repuesto en orden de servicio
CREATE TRIGGER IF NOT EXISTS trg_soporte_repuesto_insert
AFTER INSERT ON orden_servicio_repuestos
BEGIN
    UPDATE productos
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.producto_id;
END;

-- 2. Devolver stock al eliminar repuesto de orden de servicio
CREATE TRIGGER IF NOT EXISTS trg_soporte_repuesto_delete
AFTER DELETE ON orden_servicio_repuestos
BEGIN
    UPDATE productos
    SET stock_actual = stock_actual + OLD.cantidad
    WHERE id = OLD.producto_id;
END;

-- 3. Ajustar stock al actualizar cantidad o producto de repuesto
CREATE TRIGGER IF NOT EXISTS trg_soporte_repuesto_update
AFTER UPDATE ON orden_servicio_repuestos
BEGIN
    UPDATE productos
    SET stock_actual = stock_actual + OLD.cantidad
    WHERE id = OLD.producto_id;
    UPDATE productos
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.producto_id;
END;

-- ==============================================================================
-- MODULO DE PRESTAMOS / SALIDAS TEMPORALES INTERTIENDAS
-- ==============================================================================

-- 17. TABLA: prestamos_intertienda (Tabla Principal)
CREATE TABLE IF NOT EXISTS prestamos_intertienda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tienda_destino_id INTEGER NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_prestamo TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Convertido en Venta', 'Devuelto', 'Devuelto Parcial')),
    observaciones TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 18. TABLA: prestamo_detalles (Tabla Detalle)
CREATE TABLE IF NOT EXISTS prestamo_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prestamo_id INTEGER NOT NULL REFERENCES prestamos_intertienda(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    tipo_precio TEXT NOT NULL DEFAULT 'Final' CHECK (tipo_precio IN ('Base', 'Final', 'Manual')),
    precio_manual REAL DEFAULT 0.00 CHECK (precio_manual >= 0)
);

-- INDICES DE OPTIMIZACION
CREATE INDEX IF NOT EXISTS idx_prestamos_intertienda_tienda ON prestamos_intertienda(tienda_destino_id);
CREATE INDEX IF NOT EXISTS idx_prestamo_detalles_prestamo ON prestamo_detalles(prestamo_id);


