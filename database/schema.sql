-- ==============================================================================
-- SCRIPT DE BASE DE DATOS: ERP / POS (Inventarios, Series, Compras y Ventas)
-- Motor Recomendado: PostgreSQL (o compatible con modificaciones menores en MySQL)
-- ==============================================================================

-- Habilitar extensión para UUIDs si se prefiere (opcional, aquí usaremos SERIAL/BIGSERIAL para simplicidad y rendimiento local)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TABLA: configuracion_sistema
-- Almacena los parámetros generales de la empresa y la tasa de cambio activa.
-- -----------------------------------------------------------------------------
CREATE TABLE configuracion_sistema (
    id SERIAL PRIMARY KEY,
    empresa_nombre VARCHAR(150) NOT NULL,
    empresa_ruc VARCHAR(11) NOT NULL UNIQUE,
    empresa_direccion TEXT,
    empresa_telefono VARCHAR(20),
    empresa_email VARCHAR(100),
    moneda_defecto VARCHAR(3) DEFAULT 'PEN', -- 'PEN' o 'USD'
    tipo_cambio_actual DECIMAL(10, 4) NOT NULL DEFAULT 3.7500, -- Tipo de cambio del día (PEN por 1 USD)
    logo_path VARCHAR(255), -- Ruta del logotipo de la empresa
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. TABLA: usuarios
-- Gestión de accesos y roles del sistema.
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('Administrador', 'Vendedor', 'Almacenero')),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. TABLA: categorias
-- Agrupamiento lógico de los productos.
-- -----------------------------------------------------------------------------
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 4. TABLA: productos
-- Catálogo de productos.
-- -----------------------------------------------------------------------------
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    categoria_id INT REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    maneja_series BOOLEAN DEFAULT FALSE NOT NULL,
    stock_minimo INT DEFAULT 0 CHECK (stock_minimo >= 0),
    stock_actual INT DEFAULT 0 CHECK (stock_actual >= 0), -- Stock físico consolidado (calculado o actualizado por triggers)
    precio_base DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (precio_base >= 0), -- Costo / Mayorista
    precio_final DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (precio_final >= 0), -- Precio al cliente final
    moneda VARCHAR(3) DEFAULT 'PEN' CHECK (moneda IN ('PEN', 'USD')), -- Moneda base del producto
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 5. TABLA: actores (Clientes & Proveedores)
-- Módulo unificado para personas naturales/jurídicas externas.
-- -----------------------------------------------------------------------------
CREATE TABLE actores (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('Cliente', 'Proveedor', 'Ambos')),
    nombre_razon_social VARCHAR(200) NOT NULL,
    tipo_documento VARCHAR(10) NOT NULL CHECK (tipo_documento IN ('DNI', 'RUC', 'CE', 'Pasaporte')),
    documento_identidad VARCHAR(20) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 6. TABLA: compras
-- Cabecera de transacciones de abastecimiento.
-- -----------------------------------------------------------------------------
CREATE TABLE compras (
    id SERIAL PRIMARY KEY,
    proveedor_id INT NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_comprobante VARCHAR(20) NOT NULL CHECK (tipo_comprobante IN ('Factura', 'Boleta', 'Guia de Remision', 'Nota de Credito', 'Nota de Compra')),
    serie_comprobante VARCHAR(10) NOT NULL,
    correlativo_comprobante VARCHAR(20) NOT NULL,
    fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    moneda VARCHAR(3) NOT NULL CHECK (moneda IN ('PEN', 'USD')),
    tipo_cambio DECIMAL(10, 4) NOT NULL CHECK (tipo_cambio > 0), -- Tipo de cambio del momento exacto de la compra
    metodo_pago VARCHAR(15) NOT NULL CHECK (metodo_pago IN ('Contado', 'Credito')),
    fecha_vencimiento DATE, -- Obligatorio si es Crédito
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    igv DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Impuesto (ej. 18% en Perú)
    total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(15) DEFAULT 'Completada' NOT NULL CHECK (estado IN ('Completada', 'Anulada')),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 7. TABLA: compra_detalles
-- Detalle de transacciones de abastecimiento.
-- -----------------------------------------------------------------------------
CREATE TABLE compra_detalles (
    id SERIAL PRIMARY KEY,
    compra_id INT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12, 2) NOT NULL CHECK (precio_unitario >= 0), -- En la moneda original de la compra
    subtotal DECIMAL(12, 2) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 8. TABLA: ventas
-- Cabecera de transacciones de salida / POS.
-- -----------------------------------------------------------------------------
CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    cliente_id INT NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_comprobante VARCHAR(20) NOT NULL CHECK (tipo_comprobante IN ('Factura', 'Boleta', 'Guia de Remision', 'Ticket', 'Nota de Venta')),
    serie_comprobante VARCHAR(10) NOT NULL,
    correlativo_comprobante VARCHAR(20) NOT NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    moneda VARCHAR(3) NOT NULL CHECK (moneda IN ('PEN', 'USD')),
    tipo_cambio DECIMAL(10, 4) NOT NULL CHECK (tipo_cambio > 0), -- Tipo de cambio congelado en la venta
    condicion_pago VARCHAR(15) NOT NULL CHECK (condicion_pago IN ('Contado', 'Credito')),
    fecha_vencimiento DATE, -- Obligatorio si es Crédito
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    igv DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    estado VARCHAR(15) DEFAULT 'Completada' NOT NULL CHECK (estado IN ('Completada', 'Anulada')),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 9. TABLA: venta_detalles
-- Detalle de transacciones de salida / POS.
-- -----------------------------------------------------------------------------
CREATE TABLE venta_detalles (
    id SERIAL PRIMARY KEY,
    venta_id INT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    tipo_precio VARCHAR(15) NOT NULL CHECK (tipo_precio IN ('Base', 'Final', 'Manual')),
    precio_unitario DECIMAL(12, 2) NOT NULL CHECK (precio_unitario >= 0), -- En la moneda original de la venta
    meses_garantia INT DEFAULT 0 CHECK (meses_garantia >= 0), -- Meses de garantía otorgados
    subtotal DECIMAL(12, 2) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 9b. TABLA: venta_pagos
-- Detalle de pagos combinados para ventas al contado.
-- -----------------------------------------------------------------------------
CREATE TABLE venta_pagos (
    id SERIAL PRIMARY KEY,
    venta_id INT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('Efectivo', 'Transferencia', 'Yape/Plin', 'Tarjeta')),
    monto DECIMAL(12, 2) NOT NULL CHECK (monto >= 0),
    moneda VARCHAR(3) NOT NULL CHECK (moneda IN ('PEN', 'USD'))
);

-- -----------------------------------------------------------------------------
-- 10. TABLA: producto_series
-- Gestión física individualizada (Trazabilidad estricta por números de serie).
-- -----------------------------------------------------------------------------
CREATE TABLE producto_series (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    numero_serie VARCHAR(100) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Disponible' CHECK (estado IN ('Disponible', 'Vendido', 'En Garantia', 'Devuelto')),
    compra_id INT REFERENCES compras(id) ON DELETE RESTRICT, -- Documento de entrada
    venta_id INT REFERENCES ventas(id) ON DELETE SET NULL,     -- Documento de salida
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_producto_serie UNIQUE (producto_id, numero_serie) -- Un número de serie es único por producto
);

-- -----------------------------------------------------------------------------
-- 11. TABLA: historial_tipo_cambio
-- Registro de cambios históricos del TC para auditoría y visualización.
-- -----------------------------------------------------------------------------
CREATE TABLE historial_tipo_cambio (
    id SERIAL PRIMARY KEY,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL UNIQUE,
    tipo_cambio DECIMAL(10, 4) NOT NULL,
    usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 12. TABLA: cuentas_por_cobrar / cuentas_por_pagar (Opcional, Estados de Cuenta)
-- Permite controlar los créditos otorgados y recibidos de actores.
-- -----------------------------------------------------------------------------
CREATE TABLE cuentas_por_cobrar (
    id SERIAL PRIMARY KEY,
    venta_id INT REFERENCES ventas(id) ON DELETE CASCADE,
    cliente_id INT NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
    monto_total DECIMAL(12, 2) NOT NULL,
    monto_pagado DECIMAL(12, 2) DEFAULT 0.00 NOT NULL,
    saldo DECIMAL(12, 2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(15) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Pagado', 'Vencido')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cuentas_por_pagar (
    id SERIAL PRIMARY KEY,
    compra_id INT REFERENCES compras(id) ON DELETE CASCADE,
    proveedor_id INT NOT NULL REFERENCES actores(id) ON DELETE RESTRICT,
    monto_total DECIMAL(12, 2) NOT NULL,
    monto_pagado DECIMAL(12, 2) DEFAULT 0.00 NOT NULL,
    saldo DECIMAL(12, 2) GENERATED ALWAYS AS (monto_total - monto_pagado) STORED,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(15) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Pagado', 'Vencido')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- ÍNDICES DE RENDIMIENTO (OPTIMIZACIÓN)
-- ==============================================================================
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_producto_series_numero ON producto_series(numero_serie);
CREATE INDEX idx_producto_series_estado ON producto_series(producto_id, estado);
CREATE INDEX idx_actores_documento ON actores(documento_identidad);
CREATE INDEX idx_compras_proveedor ON compras(proveedor_id);
CREATE INDEX idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX idx_compra_detalles_compra ON compra_detalles(compra_id);
CREATE INDEX idx_venta_detalles_venta ON venta_detalles(venta_id);
CREATE INDEX idx_venta_pagos_venta ON venta_pagos(venta_id);

-- ==============================================================================
-- TRIGGERS Y FUNCIONES DE AUTOMATIZACIÓN (CONTROL DE STOCK)
-- ==============================================================================

-- Función para actualizar stock de productos tras una COMPRA
CREATE OR REPLACE FUNCTION fn_actualizar_stock_compra()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE productos
    SET stock_actual = stock_actual + NEW.cantidad
    WHERE id = NEW.producto_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compra_detalle_insert
AFTER INSERT ON compra_detalles
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_stock_compra();

-- Función para actualizar stock de productos tras una VENTA
CREATE OR REPLACE FUNCTION fn_actualizar_stock_venta()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar si hay stock físico suficiente (para productos que no manejan series)
    IF (SELECT stock_actual FROM productos WHERE id = NEW.producto_id) < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto con ID %', NEW.producto_id;
    END IF;

    UPDATE productos
    SET stock_actual = stock_actual - NEW.cantidad
    WHERE id = NEW.producto_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venta_detalle_insert
AFTER INSERT ON venta_detalles
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_stock_venta();

-- Función para revertir stock en caso de ANULACIÓN de Venta
CREATE OR REPLACE FUNCTION fn_revertir_stock_venta_anulada()
RETURNS TRIGGER AS $$
DECLARE
    r_detalle RECORD;
BEGIN
    IF NEW.estado = 'Anulada' AND OLD.estado != 'Anulada' THEN
        -- Iterar por los detalles para devolver stock
        FOR r_detalle IN SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = NEW.id LOOP
            UPDATE productos
            SET stock_actual = stock_actual + r_detalle.cantidad
            WHERE id = r_detalle.producto_id;
        END LOOP;

        -- Devolver series a 'Disponible'
        UPDATE producto_series
        SET estado = 'Disponible', venta_id = NULL
        WHERE venta_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_venta_anulada
AFTER UPDATE ON ventas
FOR EACH ROW
EXECUTE FUNCTION fn_revertir_stock_venta_anulada();
