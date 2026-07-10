/* ==============================================================================
   MÓDULO: PUNTO DE VENTA (POS) Y PROCESADOR DE TRANSACCIONES
   ============================================================================== */

let carritoPOS = [];
let conversionPrestamoId = null;
let clientesDisponibles = [];
let productosCatalogo = [];
let categoriasCatalogo = [];
let categoriaPOSActiva = '';

async function renderPOS(container) {
    container.innerHTML = `
        <div class="pos-layout">
            <!-- 1. Catálogo de Productos (Izquierda) -->
            <div class="pos-catalog">
                <div class="pos-search-bar">
                    <div class="search-box" style="max-width:none;">
                        <i data-lucide="search" class="search-icon" style="width:16px;"></i>
                        <input type="text" class="form-input" id="pos-search-input" placeholder="Buscar por código, nombre o descripción...">
                    </div>
                </div>
                
                <!-- Pestañas de categorías -->
                <div class="category-tabs" id="pos-category-tabs">
                    <div class="category-tab active" onclick="filtrarCategoriaPOS('')">Todas</div>
                </div>

                <!-- Grid de productos -->
                <div class="products-grid" id="pos-products-grid">
                    <div style="grid-column: 1/-1; text-align:center; padding:48px; color:var(--text-muted);">
                        Cargando catálogo del POS...
                    </div>
                </div>
            </div>

            <!-- 2. Carrito de Ventas y Cobro (Derecha) -->
            <div class="pos-cart-panel">
                <div class="cart-header">
                    <span>Carrito de Ventas</span>
                    <button class="clear-cart" onclick="limpiarCarritoPOS()">Limpiar</button>
                </div>

                <!-- Items del Carrito -->
                <div class="cart-items" id="pos-cart-items">
                    <div class="empty-list-message" style="margin-top:32px;">El carrito de ventas está vacío.</div>
                </div>

                <!-- Resumen y Cobro -->
                <div class="cart-summary">
                    <div class="summary-row">
                        <span>Subtotal Neto</span>
                        <span id="pos-resumen-subtotal">S/ 0.00</span>
                    </div>
                    <div class="summary-row">
                        <span>IGV (18%)</span>
                        <span id="pos-resumen-igv">S/ 0.00</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total a Cobrar</span>
                        <span id="pos-resumen-total">S/ 0.00</span>
                    </div>
                    
                    <button class="btn btn-success checkout-btn" onclick="abrirCheckoutModal()" style="width: 100%; padding: 12px; font-size: 1rem; margin-top: 8px;">
                        <i data-lucide="credit-card"></i> Proceder al Pago
                    </button>
                </div>
            </div>
        </div>

        <!-- 3. Historial de Ventas del POS -->
        <div class="card" style="margin-top:24px;">
            <div class="card-title">Historial de Ventas (POS local)</div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID Venta</th>
                            <th>Cliente</th>
                            <th>Comprobante</th>
                            <th>Fecha</th>
                            <th>Moneda</th>
                            <th style="text-align:right;">Subtotal</th>
                            <th style="text-align:right;">IGV</th>
                            <th style="text-align:right;">Total Cobrado</th>
                            <th>Estado</th>
                            <th style="text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="historial-ventas-body">
                        <tr>
                            <td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);">Cargando historial de ventas...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Cargar Catálogos
    await inicializarCatalogosPOS();
    cargarHistorialVentas();

    // Eventos
    document.getElementById('pos-search-input').addEventListener('input', filtrarCatalogoPOS);
    inicializarEventosModalPOS();

    lucide.createIcons();
}

async function inicializarCatalogosPOS() {
    try {
        // 1. Clientes
        const resClientes = await fetch(`${API_URL}/api/actores?tipo=Cliente`);
        clientesDisponibles = await resClientes.json();
        
        const clientSelect = document.getElementById('pos-cliente');
        clientSelect.innerHTML = clientesDisponibles.map(c => `
            <option value="${c.id}">${c.nombre_razon_social} (${c.tipo_documento}: ${c.documento_identidad})</option>
        `).join('');

        // 2. Categorías
        const resCats = await fetch(`${API_URL}/api/categorias`);
        categoriasCatalogo = await resCats.json();
        
        const tabsContainer = document.getElementById('pos-category-tabs');
        tabsContainer.innerHTML = '<div class="category-tab active" id="tab-cat-all" onclick="filtrarCategoriaPOS(\'\')">Todas</div>' + 
            categoriasCatalogo.map(c => `<div class="category-tab" id="tab-cat-${c.id}" onclick="filtrarCategoriaPOS(${c.id})">${c.nombre}</div>`).join('');

        // 3. Productos
        const resProds = await fetch(`${API_URL}/api/productos`);
        productosCatalogo = await resProds.json();
        renderCatalogoProductosPOS(productosCatalogo);

    } catch (err) {
        console.error(err);
    }
}

function renderCatalogoProductosPOS(productos) {
    const grid = document.getElementById('pos-products-grid');
    if (!grid) return;

    if (productos.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:48px; color:var(--text-muted);">No hay productos disponibles para este filtro.</div>';
        return;
    }

    grid.innerHTML = productos.map(p => {
        const cantEnCarrito = carritoPOS.reduce((acc, item) => item.producto_id === p.id ? acc + item.cantidad : acc, 0);
        const stockDisponible = p.stock_actual - cantEnCarrito;
        const outOfStockClass = stockDisponible <= 0 ? 'out-of-stock' : '';
        const badgeSeries = p.maneja_series === 1 
            ? '<span class="badge badge-info product-pos-badge">Series</span>' 
            : '';

        const clickHandler = stockDisponible > 0 
            ? `onclick="agregarAlCarritoPOS(${p.id})"` 
            : 'onclick="mostrarToast(\'Producto sin stock físico disponible\', \'warning\')"';

        return `
            <div class="product-pos-card ${outOfStockClass}" ${clickHandler}>
                <div>
                    <div class="product-pos-name">${p.nombre}</div>
                    ${p.marca ? `<div style="font-size:0.75rem; color:var(--color-text-muted); margin-bottom:4px; font-weight:500;">${p.marca}</div>` : ''}
                    <div class="product-pos-stock">Stock: ${stockDisponible} U.</div>
                </div>
                <div class="product-pos-footer">
                    <div class="product-pos-price">${formatCurrency(p.precio_final, p.moneda || 'PEN')}</div>
                    ${badgeSeries}
                </div>
            </div>
        `;
    }).join('');
}

function filtrarCategoriaPOS(catId) {
    categoriaPOSActiva = catId;
    
    // Actualizar tabs visuales
    const tabs = document.querySelectorAll('.category-tabs .category-tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    if (catId === '') {
        document.getElementById('tab-cat-all').classList.add('active');
    } else {
        document.getElementById(`tab-cat-${catId}`).classList.add('active');
    }

    aplicarFiltrosCatalogo();
}

function filtrarCatalogoPOS() {
    aplicarFiltrosCatalogo();
}

function aplicarFiltrosCatalogo() {
    const searchInput = document.getElementById('pos-search-input');
    if (!searchInput) return;
    const query = searchInput.value.toLowerCase();
    
    const filtrados = productosCatalogo.filter(p => {
        const matchesQuery = p.nombre.toLowerCase().includes(query) || 
                             (p.descripcion && p.descripcion.toLowerCase().includes(query)) ||
                             (p.marca && p.marca.toLowerCase().includes(query));
        const matchesCat = categoriaPOSActiva === '' || p.categoria_id === parseInt(categoriaPOSActiva);
        return matchesQuery && matchesCat;
    });

    renderCatalogoProductosPOS(filtrados);
}

/* ==============================================================================
   LÓGICA DEL CARRITO DEL POS
   ============================================================================== */
function agregarAlCarritoPOS(productoId) {
    const prod = productosCatalogo.find(p => p.id === productoId);
    if (!prod) return;

    // Buscar si ya está en el carrito
    let itemCarrito = carritoPOS.find(item => item.producto_id === productoId);

    if (itemCarrito) {
        if (itemCarrito.cantidad < prod.stock_actual) {
            itemCarrito.cantidad++;
            // Si maneja series, al incrementar la cantidad debemos forzar a seleccionar otra serie
            if (prod.maneja_series === 1) {
                // Limpiamos la selección de series previa de este ítem para forzar a re-seleccionar
                itemCarrito.series_seleccionadas = [];
            }
            mostrarToast(`Cantidad incrementada para '${prod.nombre}'`, 'info');
        } else {
            mostrarToast("No hay más stock físico en almacén.", "warning");
            return;
        }
    } else {
        itemCarrito = {
            producto_id: prod.id,
            nombre: prod.nombre,
            cantidad: 1,
            tipo_precio: 'Final', // Precio por defecto
            es_precio_manual: false,
            precio_manual: prod.precio_final,
            precio_manual_raw: '',
            precio_base: prod.precio_base,
            precio_mayorista: prod.precio_mayorista,
            precio_final: prod.precio_final,
            moneda: prod.moneda || 'PEN',
            maneja_series: prod.maneja_series,
            series_seleccionadas: [],
            meses_garantia: 12 // Garantía estándar por defecto
        };
        carritoPOS.push(itemCarrito);
        mostrarToast(`'${prod.nombre}' añadido al carrito`, 'success');
    }

    renderCarritoPOS();

    // Si maneja series, abrir el selector de series inmediatamente
    if (prod.maneja_series === 1) {
        const index = carritoPOS.indexOf(itemCarrito);
        if (index !== -1) {
            abrirSelectorSeriesPOS(index);
        }
    }
}

function renderCarritoPOS() {
    const container = document.getElementById('pos-cart-items');
    if (!container) return;

    if (carritoPOS.length === 0) {
        container.innerHTML = '<div class="empty-list-message" style="margin-top:32px;">El carrito de ventas está vacío.</div>';
        actualizarTotalesPOS();
        return;
    }

    const monedaSelect = document.getElementById('pos-moneda');
    const monedaVenta = monedaSelect ? monedaSelect.value : 'PEN';

    container.innerHTML = carritoPOS.map((item, index) => {
        let precioOrigen = item.precio_final;
        if (item.tipo_precio === 'Base') precioOrigen = item.precio_mayorista;
        else if (item.tipo_precio === 'Manual') precioOrigen = item.precio_manual;

        // Convertir precio si la moneda de la transacción difiere de la del producto
        let precioTransaccion = precioOrigen;
        const monedaProd = item.moneda || 'PEN';
        if (monedaProd !== monedaVenta) {
            if (monedaVenta === 'USD' && monedaProd === 'PEN') {
                precioTransaccion = precioOrigen / tipoCambioActual;
            } else if (monedaVenta === 'PEN' && monedaProd === 'USD') {
                precioTransaccion = precioOrigen * tipoCambioActual;
            }
        }

        const subtotalTransaccion = precioTransaccion * item.cantidad;

        const isManual = item.tipo_precio === 'Manual';
        const inputBg = isManual ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255,255,255,0.02)';
        const inputBorder = isManual ? '1px solid var(--color-primary)' : '1px solid var(--border-color)';
        const inputColor = isManual ? 'var(--text-main)' : 'var(--text-muted)';
        const inputCursor = isManual ? 'text' : 'not-allowed';
        const inputVal = isManual && item.precio_manual_raw !== undefined && item.precio_manual_raw !== '' 
            ? item.precio_manual_raw 
            : precioTransaccion.toFixed(2);

        // Control de selección de series para productos trazables
        let seriesControlHtml = '';
        if (item.maneja_series === 1) {
            const seriesSeleccionadasCount = item.series_seleccionadas.length;
            const tieneSeriesCompletas = seriesSeleccionadasCount === item.cantidad;
            const btnColorClass = tieneSeriesCompletas ? 'badge-success' : 'badge-danger';
            
            seriesControlHtml = `
                <div class="cart-item-meta">
                    <button class="series-select-btn" onclick="abrirSelectorSeriesPOS(${index})">
                        <span><i data-lucide="scan" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Series (${seriesSeleccionadasCount}/${item.cantidad})</span>
                        <span class="badge ${btnColorClass}">${tieneSeriesCompletas ? 'Completado' : 'Requerido'}</span>
                    </button>
                    ${seriesSeleccionadasCount > 0 ? `
                        <div style="font-size:0.75rem; color:var(--color-info); margin-top:4px;">
                            Seleccionados: ${item.series_seleccionadas.map(s => `<code style="font-weight:600;">${s}</code>`).join(', ')}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        return `
            <div class="cart-item">
                <div class="cart-item-header">
                    <div class="cart-item-name">${item.nombre}</div>
                    <button class="remove-cart-item" onclick="removerItemCarritoPOS(${index})">&times;</button>
                </div>
                
                <div class="cart-item-controls">
                    <!-- Control Cantidad -->
                    <div class="quantity-control">
                        <button class="quantity-btn" onclick="modificarCantidadPOS(${index}, -1)">-</button>
                        <div class="quantity-value">${item.cantidad}</div>
                        <button class="quantity-btn" onclick="modificarCantidadPOS(${index}, 1)">+</button>
                    </div>

                    <!-- Tipo de Precio -->
                    <select class="price-type-select" onchange="cambiarTipoPrecioPOS(${index}, this.value)">
                        <option value="Final" ${item.tipo_precio === 'Final' ? 'selected' : ''}>Público</option>
                        <option value="Base" ${item.tipo_precio === 'Base' ? 'selected' : ''}>Mayorista</option>
                        <option value="Manual" ${item.tipo_precio === 'Manual' ? 'selected' : ''}>Manual</option>
                    </select>

                    <!-- Precio Unitario -->
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span class="form-label" style="font-size:0.75rem;">${monedaVenta === 'USD' ? '$' : 'S/'}</span>
                        <input type="number" step="0.01" class="form-input pos-cart-price-input" 
                               style="padding:4px 6px; font-size:0.8rem; width:75px; height:28px; text-align:right; background:${inputBg}; border:${inputBorder}; color:${inputColor}; cursor:${inputCursor}; transition: all var(--transition-fast);" 
                               value="${inputVal}" 
                               ${!isManual ? 'readonly' : ''} 
                               oninput="actualizarPrecioManualRawPOS(${index}, this.value)"
                               onblur="finalizarPrecioManualPOS(${index}, this.value)"
                               onkeydown="if(event.key === 'Enter') { finalizarPrecioManualPOS(${index}, this.value); event.preventDefault(); }">
                    </div>

                    <!-- Subtotal Ítem -->
                    <div class="cart-item-subtotal" id="pos-item-subtotal-${index}">
                        ${formatCurrency(subtotalTransaccion, monedaVenta)}
                    </div>
                </div>

                <!-- Garantía (Meses) -->
                <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                    <span class="form-label" style="font-size:0.75rem;">Garantía (Meses):</span>
                    <input type="number" min="0" class="form-input" style="padding:4px 8px; font-size:0.8rem; width:65px; height:28px;" value="${item.meses_garantia}" onchange="cambiarGarantiaPOS(${index}, this.value)">
                </div>

                <!-- Control de Series -->
                ${seriesControlHtml}
            </div>
        `;
    }).join('');

    actualizarTotalesPOS();
    lucide.createIcons();
    aplicarFiltrosCatalogo();
}

function modificarCantidadPOS(index, delta) {
    const item = carritoPOS[index];
    const prod = productosCatalogo.find(p => p.id === item.producto_id);

    const nuevaCant = item.cantidad + delta;
    if (nuevaCant <= 0) {
        removerItemCarritoPOS(index);
    } else if (nuevaCant <= prod.stock_actual) {
        item.cantidad = nuevaCant;
        if (item.maneja_series === 1) {
            // Reiniciar selección al cambiar cantidad para evitar inconsistencias
            item.series_seleccionadas = [];
        }
        renderCarritoPOS();
        // Si incrementamos y maneja series, abrir el selector de series
        if (delta > 0 && item.maneja_series === 1) {
            abrirSelectorSeriesPOS(index);
        }
    } else {
        mostrarToast("No hay más unidades físicas disponibles en almacén.", "warning");
    }
}

function removerItemCarritoPOS(index) {
    carritoPOS.splice(index, 1);
    renderCarritoPOS();
}

function limpiarCarritoPOS() {
    carritoPOS = [];
    conversionPrestamoId = null;
    renderCarritoPOS();
}

function cambiarTipoPrecioPOS(index, tipo) {
    const item = carritoPOS[index];
    
    if (tipo === 'Manual' && usuarioActivo.rol !== 'Administrador') {
        mostrarToast("Permisos insuficientes para modificar precios de forma manual.", "danger");
        renderCarritoPOS(); // Revierte el select
        return;
    }

    item.tipo_precio = tipo;
    if (tipo === 'Manual') {
        item.es_precio_manual = true;
        // Pre-cargar el precio raw con el precio de visualización en la moneda actual
        const monedaSelect = document.getElementById('pos-moneda');
        const monedaVenta = monedaSelect ? monedaSelect.value : 'PEN';
        let displayPrice = item.precio_final;
        if (item.moneda !== monedaVenta) {
            if (monedaVenta === 'USD') displayPrice = item.precio_final / tipoCambioActual;
            else displayPrice = item.precio_final * tipoCambioActual;
        }
        item.precio_manual = item.precio_final;
        item.precio_manual_raw = displayPrice.toFixed(2);
    } else {
        item.es_precio_manual = false;
        item.precio_manual_raw = '';
    }
    renderCarritoPOS();
}

function actualizarPrecioManualRawPOS(index, rawValue) {
    const item = carritoPOS[index];
    item.precio_manual_raw = rawValue;
    
    let val = parseFloat(rawValue);
    if (isNaN(val) || val < 0) {
        val = 0;
    }
    
    const monedaSelect = document.getElementById('pos-moneda');
    const monedaVenta = monedaSelect ? monedaSelect.value : 'PEN';
    const subtotalTransaccion = val * item.cantidad;
    
    const subtotalEl = document.getElementById(`pos-item-subtotal-${index}`);
    if (subtotalEl) {
        subtotalEl.textContent = formatCurrency(subtotalTransaccion, monedaVenta);
    }
    
    actualizarTotalesPOS();
}

function finalizarPrecioManualPOS(index, value) {
    const item = carritoPOS[index];
    let val = parseFloat(value);
    if (isNaN(val) || val < 0) {
        val = 0;
    }
    
    const monedaSelect = document.getElementById('pos-moneda');
    const monedaVenta = monedaSelect ? monedaSelect.value : 'PEN';
    const monedaProd = item.moneda || 'PEN';
    
    if (monedaProd !== monedaVenta) {
        if (monedaProd === 'PEN' && monedaVenta === 'USD') {
            item.precio_manual = val * tipoCambioActual;
        } else if (monedaProd === 'USD' && monedaVenta === 'PEN') {
            item.precio_manual = val / tipoCambioActual;
        }
    } else {
        item.precio_manual = val;
    }
    
    item.precio_manual_raw = val.toFixed(2);
    renderCarritoPOS();
}

function cambiarGarantiaPOS(index, meses) {
    const item = carritoPOS[index];
    const val = parseInt(meses);
    if (val >= 0) {
        item.meses_garantia = val;
    }
}

function actualizarTotalesPOS() {
    const monedaVenta = document.getElementById('pos-moneda').value;

    let subtotalTotal = 0.0;
    carritoPOS.forEach(item => {
        let precio = item.precio_final;
        if (item.tipo_precio === 'Base') precio = item.precio_mayorista;
        else if (item.tipo_precio === 'Manual') precio = item.precio_manual;

        const monedaProd = item.moneda || 'PEN';
        if (monedaProd !== monedaVenta) {
            if (monedaVenta === 'USD' && monedaProd === 'PEN') {
                precio = precio / tipoCambioActual;
            } else if (monedaVenta === 'PEN' && monedaProd === 'USD') {
                precio = precio * tipoCambioActual;
            }
        }
        subtotalTotal += precio * item.cantidad;
    });

    const total = subtotalTotal;
    const subtotalNeto = total / 1.18;
    const igv = total - subtotalNeto;

    document.getElementById('pos-resumen-subtotal').textContent = formatCurrency(subtotalNeto, monedaVenta);
    document.getElementById('pos-resumen-igv').textContent = formatCurrency(igv, monedaVenta);
    document.getElementById('pos-resumen-total').textContent = formatCurrency(total, monedaVenta);

    // Auto-completar efectivo si otros campos están vacíos
    const transferencia = parseFloat(document.getElementById('pago-monto-transferencia')?.value) || 0;
    const yape = parseFloat(document.getElementById('pago-monto-yape')?.value) || 0;
    const tarjeta = parseFloat(document.getElementById('pago-monto-tarjeta')?.value) || 0;
    
    if (transferencia === 0 && yape === 0 && tarjeta === 0) {
        const inputEfectivo = document.getElementById('pago-monto-efectivo');
        if (inputEfectivo) {
            inputEfectivo.value = total.toFixed(2);
        }
    }
    validarPagosCombinados();
}

/* ==============================================================================
   DIÁLOGO DE SELECCIÓN DE NÚMEROS DE SERIE FÍSICOS
   ============================================================================== */
let itemIndexSeriesEnSeleccion = null;
let seriesTemporalesSeleccionadas = [];

async function abrirSelectorSeriesPOS(index) {
    itemIndexSeriesEnSeleccion = index;
    const item = carritoPOS[index];
    if (!item) {
        console.error(`Error: Elemento de carrito en index ${index} no existe.`);
        mostrarToast("El producto ya no se encuentra en el carrito de compras.", "danger");
        return;
    }
    seriesTemporalesSeleccionadas = [...item.series_seleccionadas];

    document.getElementById('series-modal-prod-name').textContent = item.nombre;
    document.getElementById('series-modal-req-qty').textContent = item.cantidad;
    actualizarContadorSeriesModal();

    // Obtener series físicas del servidor
    try {
        const res = await fetch(`${API_URL}/api/productos/${item.producto_id}/series`);
        const series = await res.json();

        // Filtrar solo las disponibles para vender
        const seriesDisponibles = series.filter(s => s.estado === 'Disponible');
        const container = document.getElementById('series-selection-container');

        if (seriesDisponibles.length === 0) {
            container.innerHTML = '<div class="empty-list-message" style="grid-column:1/-1;">No hay números de serie físicos con estado "Disponible" para este producto en almacén.</div>';
        } else {
            renderChipsSeries(seriesDisponibles, item.producto_id);
        }

        // Buscador de series en el modal
        document.getElementById('series-search').oninput = (e) => {
            const query = e.target.value.toLowerCase();
            const filtrados = seriesDisponibles.filter(s => s.numero_serie.toLowerCase().includes(query));
            renderChipsSeries(filtrados, item.producto_id);
        };

        openModal('series-modal');

        // Confirmar Guardar Selección
        const saveBtn = document.getElementById('series-modal-save-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const currentItem = carritoPOS.find(i => i.producto_id === item.producto_id);
                if (!currentItem) {
                    mostrarToast("El producto ya no está en el carrito.", "danger");
                    closeModal('series-modal');
                    return;
                }
                if (seriesTemporalesSeleccionadas.length !== currentItem.cantidad) {
                    mostrarToast(`Debe seleccionar exactamente ${currentItem.cantidad} series físicas.`, "warning");
                    return;
                }
                currentItem.series_seleccionadas = [...seriesTemporalesSeleccionadas];
                closeModal('series-modal');
                renderCarritoPOS();
                mostrarToast("Series físicas vinculadas con éxito.", "success");
            };
        } else {
            console.error("Error: No se encontró el botón 'series-modal-save-btn' en el DOM.");
        }

    } catch (err) {
        console.error("Error al abrir el selector de series:", err);
        mostrarToast("Fallo al obtener series disponibles.", "danger");
    }
}

function renderChipsSeries(series, productoId) {
    const container = document.getElementById('series-selection-container');
    container.innerHTML = series.map(s => {
        const isSel = seriesTemporalesSeleccionadas.includes(s.numero_serie);
        const selClass = isSel ? 'selected' : '';
        return `
            <div class="serie-chip ${selClass}" onclick="toggleSerieChipSeleccion(${productoId}, '${s.numero_serie}')">
                ${s.numero_serie}
            </div>
        `;
    }).join('');
}

function toggleSerieChipSeleccion(productoId, numeroSerie) {
    try {
        const item = carritoPOS.find(i => i.producto_id === productoId);
        if (!item) {
            console.error(`Error: Producto con ID ${productoId} no encontrado en el carrito.`);
            mostrarToast("El producto ya no se encuentra en el carrito de compras.", "danger");
            return;
        }

        const index = seriesTemporalesSeleccionadas.indexOf(numeroSerie);

        if (index > -1) {
            seriesTemporalesSeleccionadas.splice(index, 1);
        } else {
            if (seriesTemporalesSeleccionadas.length < item.cantidad) {
                seriesTemporalesSeleccionadas.push(numeroSerie);
            } else {
                mostrarToast(`Ya seleccionó la cantidad requerida de ${item.cantidad} unidades.`, "warning");
                return;
            }
        }

        actualizarContadorSeriesModal();
        
        // Refrescar clases del chip de forma inmediata sin re-renderizar todo
        const chips = document.querySelectorAll('.series-grid .serie-chip');
        let chipEncontrado = false;
        chips.forEach(chip => {
            const text = chip.textContent.trim();
            if (text === numeroSerie) {
                chip.classList.toggle('selected');
                chipEncontrado = true;
            }
        });

        if (!chipEncontrado) {
            console.error(`Error: Serie ${numeroSerie} no encontrada en la interfaz.`);
            mostrarToast("La serie seleccionada no está disponible en la lista visual.", "warning");
        }
    } catch (err) {
        console.error("Error al seleccionar serie:", err);
        mostrarToast("Ocurrió un error inesperado al seleccionar la serie.", "danger");
    }
}

function actualizarContadorSeriesModal() {
    document.getElementById('series-modal-sel-qty').textContent = seriesTemporalesSeleccionadas.length;
}

/* ==============================================================================
   PROCESAMIENTO FINAL DEL COBRO POS
   ============================================================================== */
async function procesarCobroPOS() {
    if (carritoPOS.length === 0) {
        mostrarToast("Agregue productos al carrito antes de cobrar.", "warning");
        return;
    }

    // Validar si todos los productos con series tienen sus series físicas vinculadas
    for (const item of carritoPOS) {
        if (item.maneja_series === 1 && item.series_seleccionadas.length !== item.cantidad) {
            mostrarToast(`Debe seleccionar las series para el producto: '${item.nombre}'.`, "warning");
            return;
        }
    }

    // Validar RUC para Facturas
    if (!validarClienteRUC()) {
        return;
    }

    // Validar precios manuales no vacíos ni menores/iguales a cero
    for (const item of carritoPOS) {
        if (item.tipo_precio === 'Manual') {
            const pVal = parseFloat(item.precio_manual);
            if (isNaN(pVal) || pVal <= 0) {
                mostrarToast(`Debe ingresar un precio manual válido y mayor a cero para el producto: '${item.nombre}'.`, "warning");
                return;
            }
        }
    }

    const form = document.getElementById('form-pos-checkout');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const isManual = document.getElementById('pos-cliente-manual-toggle').checked;
    const clienteIdVal = document.getElementById('pos-cliente').value;

    const condicionPago = document.getElementById('pos-condicion-pago').value;
    const pagos = [];
    let montoAdelanto = 0.0;
    let metodoPagoAdelanto = 'Efectivo';

    if (condicionPago === 'Contado') {
        const efectivo = parseFloat(document.getElementById('pago-monto-efectivo').value) || 0;
        const transferencia = parseFloat(document.getElementById('pago-monto-transferencia').value) || 0;
        const yape = parseFloat(document.getElementById('pago-monto-yape').value) || 0;
        const tarjeta = parseFloat(document.getElementById('pago-monto-tarjeta').value) || 0;
        
        if (efectivo > 0) pagos.push({ metodo_pago: 'Efectivo', monto: efectivo });
        if (transferencia > 0) pagos.push({ metodo_pago: 'Transferencia', monto: transferencia });
        if (yape > 0) pagos.push({ metodo_pago: 'Yape/Plin', monto: yape });
        if (tarjeta > 0) pagos.push({ metodo_pago: 'Tarjeta', monto: tarjeta });
    } else if (condicionPago === 'Credito') {
        const totalVenta = obtenerTotalCarrito();
        montoAdelanto = parseFloat(document.getElementById('pos-credito-adelanto').value) || 0.0;
        metodoPagoAdelanto = document.getElementById('pos-credito-metodo-adelanto').value;
        
        if (montoAdelanto < 0) {
            mostrarToast("El monto del adelanto no puede ser negativo.", "warning");
            return;
        }
        if (montoAdelanto > totalVenta + 0.005) {
            const monedaVal = document.getElementById('pos-moneda').value;
            mostrarToast(`El adelanto (${formatCurrency(montoAdelanto, monedaVal)}) no puede ser mayor que el total de la venta (${formatCurrency(totalVenta, monedaVal)}).`, "warning");
            return;
        }
    }

    const payload = {
        cliente_id: isManual ? null : parseInt(clienteIdVal),
        cliente_nombre_manual: isManual ? document.getElementById('pos-cliente-nombre-manual').value.trim() : null,
        usuario_id: usuarioActivo.id,
        tipo_comprobante: document.getElementById('pos-tipo-comprobante').value,
        moneda: document.getElementById('pos-moneda').value,
        condicion_pago: condicionPago,
        fecha_vencimiento: document.getElementById('pos-fecha-vencimiento').value || null,
        monto_adelanto: montoAdelanto,
        metodo_pago_adelanto: metodoPagoAdelanto,
        observaciones: document.getElementById('pos-observaciones').value.trim(),
        items: carritoPOS,
        pagos: pagos,
        prestamo_id: conversionPrestamoId
    };

    try {
        const res = await fetch(`${API_URL}/api/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            
            // Recargar catálogo por reducción de stock
            const resProds = await fetch(`${API_URL}/api/productos`);
            productosCatalogo = await resProds.json();
            
            // Generar Comprobante PDF de inmediato
            imprimirComprobantePDF(data.venta_id);

            // Cerrar el modal
            cerrarCheckoutModal();

            // Resetear
            limpiarCarritoPOS();
            form.reset();
            conversionPrestamoId = null;
            
            document.getElementById('pago-monto-efectivo').value = "0.00";
            document.getElementById('pago-monto-transferencia').value = "0.00";
            document.getElementById('pago-monto-yape').value = "0.00";
            document.getElementById('pago-monto-tarjeta').value = "0.00";
            
            // Resetear adelantos de crédito
            const adelantoInput = document.getElementById('pos-credito-adelanto');
            if (adelantoInput) adelantoInput.value = "0.00";
            const adelantoMetodo = document.getElementById('pos-credito-metodo-adelanto');
            if (adelantoMetodo) adelantoMetodo.value = "Efectivo";
            const adelantoWrapper = document.getElementById('pos-credito-adelanto-wrapper');
            if (adelantoWrapper) adelantoWrapper.style.display = 'none';

            // Resetear visualmente el toggle de comprador invitado
            const toggleManual = document.getElementById('pos-cliente-manual-toggle');
            toggleManual.checked = false;
            document.getElementById('pos-cliente-select-group').style.display = 'block';
            document.getElementById('pos-cliente').setAttribute('required', 'true');
            document.getElementById('pos-cliente-manual-group').style.display = 'none';
            document.getElementById('pos-cliente-nombre-manual').removeAttribute('required');
            
            const selectComprobante = document.getElementById('pos-tipo-comprobante');
            const facturaOpt = selectComprobante.querySelector('option[value="Factura"]');
            if (facturaOpt) facturaOpt.disabled = false;
            
            const selectPago = document.getElementById('pos-condicion-pago');
            const creditoOpt = selectPago.querySelector('option[value="Credito"]');
            if (creditoOpt) creditoOpt.disabled = false;

            document.getElementById('pos-vencimiento-wrapper').style.display = 'none';
            await cargarHistorialVentas();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error de comunicación con el servidor.", "danger");
    }
}

async function cargarHistorialVentas() {
    const tbody = document.getElementById('historial-ventas-body');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/api/ventas`);
        const ventas = await res.json();

        if (ventas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);">No hay ventas procesadas hoy en este POS.</td></tr>';
            return;
        }

        tbody.innerHTML = ventas.map(v => {
            const estadoBadge = v.estado === 'Completada' 
                ? '<span class="badge badge-success">Completada</span>'
                : '<span class="badge badge-danger">Anulada</span>';
                
            const btnAnular = v.estado === 'Completada'
                ? `<button class="btn btn-secondary btn-icon" style="color:var(--color-danger); border-color:rgba(239,68,68,0.15); height:28px; width:28px;" onclick="anularVenta(${v.id})" title="Anular"><i data-lucide="x-circle" style="width:14px;"></i></button>`
                : '';

            return `
                <tr>
                    <td>${v.id}</td>
                    <td style="font-weight:600;">${v.cliente_nombre}</td>
                    <td style="font-family:monospace; font-weight:600;">${v.tipo_comprobante} ${v.serie_comprobante}-${v.correlativo_comprobante}</td>
                    <td style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(v.fecha_venta)}</td>
                    <td style="font-weight:700;">${v.moneda}</td>
                    <td style="text-align:right;">${formatCurrency(v.subtotal, v.moneda)}</td>
                    <td style="text-align:right;">${formatCurrency(v.igv, v.moneda)}</td>
                    <td style="text-align:right; font-weight:700; color:var(--color-success);">${formatCurrency(v.total, v.moneda)}</td>
                    <td>${estadoBadge}</td>
                    <td style="text-align:center;">
                        <div style="display:flex; justify-content:center; gap:8px;">
                            <button class="btn btn-secondary btn-icon" style="height:28px; width:28px;" onclick="imprimirComprobantePDF(${v.id})" title="Imprimir Comprobante"><i data-lucide="printer" style="width:14px;"></i></button>
                            ${btnAnular}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

async function anularVenta(ventaId) {
    if (!confirm("¿Está seguro de ANULAR esta venta? Esta acción devolverá las series físicas a 'Disponible' e incrementará el stock correspondiente.")) return;

    try {
        const res = await fetch(`${API_URL}/api/ventas/${ventaId}/anular`, { method: 'PUT' });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            
            // Recargar catálogo
            const resProds = await fetch(`${API_URL}/api/productos`);
            productosCatalogo = await resProds.json();
            aplicarFiltrosCatalogo();

            await cargarHistorialVentas();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
    }
}

/* ==============================================================================
   GENERADOR DE COMPROBANTES PDF CON DISEÑO PREMIUM
   ============================================================================== */
async function imprimirComprobantePDF(ventaId) {
    try {
        // Obtener datos del sistema, la venta y sus detalles
        const resConfig = await fetch(`${API_URL}/api/config`);
        const config = await resConfig.json();

        const resVentas = await fetch(`${API_URL}/api/ventas`);
        const ventas = await resVentas.json();
        const venta = ventas.find(v => v.id === ventaId);

        const resDets = await fetch(`${API_URL}/api/ventas/${ventaId}/detalles`);
        const detalles = await resDets.json();

        // Obtener desglose de pagos para ventas al contado
        let pagosHtml = '';
        if (venta.condicion_pago === 'Contado') {
            try {
                const resPagos = await fetch(`${API_URL}/api/ventas/${ventaId}/pagos`);
                const pagos = await resPagos.json();
                if (pagos && pagos.length > 0) {
                    pagosHtml = `<div style="margin-top:4px; font-size:10px; color:#4b5563;">
                        <strong>Desglose de Pagos:</strong>
                        ${pagos.map(p => `<div style="margin-left:8px; font-family:monospace;">• ${p.metodo_pago}: ${formatCurrency(p.monto, venta.moneda)}</div>`).join('')}
                    </div>`;
                }
            } catch (err) {
                console.error("Error al obtener desglose de pagos:", err);
            }
        }

        const esNotaVenta = venta.tipo_comprobante === 'Nota de Venta';
        // Forzar formato A4 para todos los comprobantes (Factura, Boleta, Nota de Venta) ya que se imprime en A4 tradicional
        const esTicketOTermico = false;
        
        const tituloComprobante = esNotaVenta ? 'NOTA DE VENTA' : `${venta.tipo_comprobante} Electronica`;
        const pieRepresentacion = esNotaVenta 
            ? `Representación impresa de la ${venta.tipo_comprobante} local.`
            : `Representación impresa de la ${venta.tipo_comprobante} Electrónica local.`;

        // Crear plantilla HTML en memoria para la impresión
        const printContainer = document.createElement('div');
        printContainer.style.padding = esTicketOTermico ? '12px 8px' : '32px';
        printContainer.style.backgroundColor = 'white';
        printContainer.style.color = '#1f2937';
        printContainer.style.fontFamily = "'Inter', sans-serif";
        printContainer.style.fontSize = esTicketOTermico ? '10px' : '12px';
        printContainer.style.lineHeight = '1.5';
        if (esTicketOTermico) {
            printContainer.style.width = '72mm';
        }

        printContainer.innerHTML = `
            <div style="${esTicketOTermico ? 'text-align:center; border-bottom:1px dashed #e5e7eb; padding-bottom:12px; margin-bottom:12px;' : 'display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #e5e7eb; padding-bottom:16px; margin-bottom:20px;'}">
                <div style="${esTicketOTermico ? 'margin-bottom:10px;' : 'flex:1;'}">
                    <h1 style="font-size:${esTicketOTermico ? '15px' : '20px'}; font-weight:800; color:#4f46e5; margin:0 0 6px;">${config.empresa_nombre}</h1>
                    <p style="margin:0; color:#4b5563; font-size:${esTicketOTermico ? '10px' : '12px'};">RUC: ${config.empresa_ruc}</p>
                    <p style="margin:2px 0 0; color:#4b5563; font-size:${esTicketOTermico ? '10px' : '12px'};">Dirección: ${config.empresa_direccion || 'No especificada'}</p>
                    <p style="margin:2px 0 0; color:#4b5563; font-size:${esTicketOTermico ? '10px' : '12px'};">Teléfono: ${config.empresa_telefono || ''}</p>
                </div>
                <div style="${esTicketOTermico ? 'border:1px solid #4f46e5; padding:8px; border-radius:6px; display:inline-block; background-color:#faf5ff; min-width:140px;' : 'border:2px solid #4f46e5; padding:16px; border-radius:8px; text-align:center; min-width:180px; background-color:#faf5ff;'}">
                    <h2 style="font-size:${esTicketOTermico ? '11px' : '14px'}; margin:0 0 2px; font-weight:800; color:#4f46e5; text-transform:uppercase;">${tituloComprobante}</h2>
                    <p style="font-size:${esTicketOTermico ? '13px' : '16px'}; font-weight:700; margin:0; font-family:monospace;">${venta.serie_comprobante}-${venta.correlativo_comprobante}</p>
                </div>
            </div>

            <div style="${esTicketOTermico ? 'display:block; margin-bottom:16px; background-color:#f9fafb; padding:10px; border-radius:6px; border:1px solid #f3f4f6; font-size:10px;' : 'display:flex; gap:16px; margin-bottom:24px; background-color:#f9fafb; padding:12px; border-radius:6px; border:1px solid #f3f4f6;'}">
                <div style="${esTicketOTermico ? 'margin-bottom:8px; border-bottom:1px dashed #e5e7eb; padding-bottom:6px;' : 'flex:1;'}">
                    <h3 style="font-size:${esTicketOTermico ? '9px' : '11px'}; text-transform:uppercase; color:#9ca3af; margin:0 0 4px;">Datos del Adquiriente</h3>
                    <p style="margin:0; font-weight:700;">${venta.cliente_nombre}</p>
                    <p style="margin:2px 0 0; color:#4b5563;">Condición de Pago: <strong>${venta.condicion_pago}</strong></p>
                    ${pagosHtml}
                    ${venta.condicion_pago === 'Credito' ? `<p style="margin:2px 0 0; color:#ef4444; font-weight:600;">Vencimiento: ${venta.fecha_vencimiento}</p>` : ''}
                    ${venta.observaciones ? `<p style="margin:6px 0 0; font-size:9px; color:#4b5563; font-style:italic; line-height:1.2;"><strong>Obs:</strong> ${venta.observaciones}</p>` : ''}
                </div>
                <div style="${esTicketOTermico ? '' : 'flex:1;'}">
                    <h3 style="font-size:${esTicketOTermico ? '9px' : '11px'}; text-transform:uppercase; color:#9ca3af; margin:0 0 4px;">Información del Comprobante</h3>
                    <p style="margin:0;">Fecha de Emisión: <strong>${formatFecha(venta.fecha_venta)}</strong></p>
                    <p style="margin:2px 0 0;">Moneda de Operación: <strong>${venta.moneda}</strong></p>
                    ${venta.moneda === 'USD' ? `<p style="margin:2px 0 0; color:#d97706;">Tipo Cambio Fijo: S/ ${venta.tipo_cambio.toFixed(4)}</p>` : ''}
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse; text-align:left; margin-bottom:16px; font-size:${esTicketOTermico ? '10px' : '12px'};">
                <thead>
                    <tr style="background-color:#4f46e5; color:white;">
                        <th style="padding:${esTicketOTermico ? '6px 4px' : '10px'}; font-weight:600; font-size:${esTicketOTermico ? '9px' : '11px'};">Descripción / Garantía</th>
                        <th style="padding:${esTicketOTermico ? '6px 4px' : '10px'}; font-weight:600; font-size:${esTicketOTermico ? '9px' : '11px'}; text-align:center; width:${esTicketOTermico ? '40px' : '80px'};">Cant.</th>
                        <th style="padding:${esTicketOTermico ? '6px 4px' : '10px'}; font-weight:600; font-size:${esTicketOTermico ? '9px' : '11px'}; text-align:right; width:${esTicketOTermico ? '60px' : '100px'};">P. Unit</th>
                        <th style="padding:${esTicketOTermico ? '6px 4px' : '10px'}; font-weight:600; font-size:${esTicketOTermico ? '9px' : '11px'}; text-align:right; width:${esTicketOTermico ? '70px' : '100px'};">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${detalles.map(d => {
                        const seriesText = d.series_vendidas.length > 0 
                            ? `<div style="font-size:8px; color:#4f46e5; font-family:monospace; margin-top:2px;">S/N: ${d.series_vendidas.join(', ')}</div>` 
                            : '';
                        const garantiaText = d.meses_garantia > 0 
                            ? `<span style="font-size:8px; background-color:#e0f2fe; color:#0369a1; padding:1px 3px; border-radius:2px; font-weight:600; margin-left:4px;">Garantía: ${d.meses_garantia} m</span>`
                            : '<span style="font-size:8px; background-color:#f3f4f6; color:#6b7280; padding:1px 3px; border-radius:2px; margin-left:4px;">Sin gar.</span>';

                        return `
                            <tr style="border-bottom:1px solid #e5e7eb;">
                                <td style="padding:${esTicketOTermico ? '6px 4px' : '10px'};">
                                    <div style="font-weight:700;">${d.producto_nombre} ${garantiaText}</div>
                                    ${seriesText}
                                </td>
                                <td style="padding:${esTicketOTermico ? '6px 4px' : '10px'}; text-align:center;">${d.cantidad} U.</td>
                                <td style="padding:${esTicketOTermico ? '6px 4px' : '10px'}; text-align:right;">${formatCurrency(d.precio_unitario, venta.moneda)}</td>
                                <td style="padding:${esTicketOTermico ? '6px 4px' : '10px'}; text-align:right; font-weight:700;">${formatCurrency(d.subtotal, venta.moneda)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div style="display:flex; justify-content:flex-end; font-size:${esTicketOTermico ? '11px' : '12px'};">
                <div style="width:${esTicketOTermico ? '100%' : '250px'};">
                    ${venta.tipo_comprobante === 'Factura' ? `
                    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;">Subtotal Neto (Sin IGV)</span>
                        <span style="font-weight:700;">${formatCurrency(venta.subtotal, venta.moneda)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;">IGV Gravado (18.00%)</span>
                        <span style="font-weight:700;">${formatCurrency(venta.igv, venta.moneda)}</span>
                    </div>
                    ` : `
                    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;">Subtotal</span>
                        <span style="font-weight:700;">${formatCurrency(venta.total, venta.moneda)}</span>
                    </div>
                    `}
                    <div style="display:flex; justify-content:space-between; padding:8px 0; font-size:${esTicketOTermico ? '13px' : '14px'}; font-weight:800; color:#4f46e5;">
                        <span>Importe Total</span>
                        <span>${formatCurrency(venta.total, venta.moneda)}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top:${esTicketOTermico ? '20px' : '40px'}; border-top:1px solid #e5e7eb; padding-top:12px; text-align:center; color:#9ca3af; font-size:${esTicketOTermico ? '9px' : '10px'};">
                <p style="margin:0;">${pieRepresentacion}</p>
                <p style="margin:4px 0 0;">¡Gracias por su preferencia!</p>
            </div>
        `;

        const opt = {
            margin:       10,
            filename:     `Comprobante_${venta.serie_comprobante}-${venta.correlativo_comprobante}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 718
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        printContainer.style.width = '718px';
        printContainer.style.position = 'absolute';
        printContainer.style.left = '0';
        printContainer.style.top = '0';
        printContainer.style.zIndex = '99999';
        printContainer.style.background = 'white';
        document.body.appendChild(printContainer);
        
        // Guardar la posición de scroll actual y desplazar al inicio para evitar capturas desplazadas
        const originalScrollY = window.scrollY;
        const originalScrollX = window.scrollX;
        window.scrollTo(0, 0);
        
        try {
            // Esperar 150ms para que el navegador complete el layout y renderizado del nuevo elemento en el DOM
            await new Promise(resolve => setTimeout(resolve, 150));
            // Generar descarga PDF de forma asíncrona
            await html2pdf().set(opt).from(printContainer).save();
        } finally {
            printContainer.remove();
            // Restaurar la posición de scroll original
            window.scrollTo(originalScrollX, originalScrollY);
        }
        
        mostrarToast("Comprobante generado e impreso en PDF con éxito.", "success");

     } catch (err) {
         console.error(err);
         mostrarToast("No se pudo generar el comprobante PDF.", "danger");
     }
}

function validarPagosCombinados() {
    const condicionPagoSelect = document.getElementById('pos-condicion-pago');
    if (!condicionPagoSelect) return true;
    
    const condicionPago = condicionPagoSelect.value;
    const checkoutBtn = document.querySelector('#pos-checkout-modal .checkout-btn');
    const container = document.getElementById('pos-pagos-combinados-container');
    
    if (condicionPago === 'Credito') {
        if (container) container.style.display = 'none';
        if (checkoutBtn) checkoutBtn.removeAttribute('disabled');
        return true;
    }
    
    if (container) container.style.display = 'flex';
    
    const totalVenta = obtenerTotalCarrito();
    const monedaVenta = document.getElementById('pos-moneda').value;
    
    const efectivo = parseFloat(document.getElementById('pago-monto-efectivo').value) || 0;
    const transferencia = parseFloat(document.getElementById('pago-monto-transferencia').value) || 0;
    const yape = parseFloat(document.getElementById('pago-monto-yape').value) || 0;
    const tarjeta = parseFloat(document.getElementById('pago-monto-tarjeta').value) || 0;
    
    const totalPagado = efectivo + transferencia + yape + tarjeta;
    
    const labelTotal = document.getElementById('pos-pago-total-ingresado');
    if (labelTotal) labelTotal.textContent = formatCurrency(totalPagado, monedaVenta);
    
    const difRow = document.getElementById('pos-pago-diferencia-row');
    const difLabel = document.getElementById('pos-pago-diferencia-label');
    const difMonto = document.getElementById('pos-pago-diferencia-monto');
    const alerta = document.getElementById('pos-pago-alerta');
    
    const diferencia = totalVenta - totalPagado;
    
    if (diferencia > 0.005) {
        // Falta pagar
        if (difMonto) {
            difMonto.textContent = formatCurrency(diferencia, monedaVenta);
            difMonto.className = 'font-bold text-rose-500';
        }
        if (difLabel) difLabel.textContent = 'Falta ingresar:';
        if (alerta) alerta.style.display = 'block';
        if (checkoutBtn) checkoutBtn.setAttribute('disabled', 'true');
        return false;
    } else {
        // Pago completo o vuelto
        const vuelto = totalPagado - totalVenta;
        if (vuelto > 0.005) {
            if (difMonto) {
                difMonto.textContent = formatCurrency(vuelto, monedaVenta);
                difMonto.className = 'font-bold text-emerald-400';
            }
            if (difLabel) difLabel.textContent = 'Cambio / Vuelto:';
        } else {
            if (difMonto) {
                difMonto.textContent = formatCurrency(0, monedaVenta);
                difMonto.className = 'font-bold text-sky-400';
            }
            if (difLabel) difLabel.textContent = 'Pago exacto';
        }
        if (alerta) alerta.style.display = 'none';
        if (checkoutBtn) checkoutBtn.removeAttribute('disabled');
        return true;
    }
}

function completarMontoRestante(metodo) {
    const totalVenta = obtenerTotalCarrito();
    
    const efectivo = metodo === 'efectivo' ? 0 : (parseFloat(document.getElementById('pago-monto-efectivo').value) || 0);
    const transferencia = metodo === 'transferencia' ? 0 : (parseFloat(document.getElementById('pago-monto-transferencia').value) || 0);
    const yape = metodo === 'yape' ? 0 : (parseFloat(document.getElementById('pago-monto-yape').value) || 0);
    const tarjeta = metodo === 'tarjeta' ? 0 : (parseFloat(document.getElementById('pago-monto-tarjeta').value) || 0);
    
    const ingresado = efectivo + transferencia + yape + tarjeta;
    const restante = totalVenta - ingresado;
    
    const input = document.getElementById(`pago-monto-${metodo}`);
    if (input) {
        input.value = Math.max(0, restante).toFixed(2);
    }
    
    validarPagosCombinados();
}

function obtenerTotalCarrito() {
    const monedaSelect = document.getElementById('pos-moneda');
    const monedaVenta = monedaSelect ? monedaSelect.value : 'PEN';
    let subtotalTotal = 0.0;
    carritoPOS.forEach(item => {
        let precio = item.precio_final;
        if (item.tipo_precio === 'Base') precio = item.precio_mayorista;
        else if (item.tipo_precio === 'Manual') precio = item.precio_manual;

        const monedaProd = item.moneda || 'PEN';
        if (monedaProd !== monedaVenta) {
            if (monedaVenta === 'USD' && monedaProd === 'PEN') {
                precio = precio / tipoCambioActual;
            } else if (monedaVenta === 'PEN' && monedaProd === 'USD') {
                precio = precio * tipoCambioActual;
            }
        }
        subtotalTotal += precio * item.cantidad;
    });
    return subtotalTotal;
}

function inicializarEventosModalPOS() {
    if (window.posModalListenersBound) return;
    
    // 1. Condición de pago change listener
    const condPagoSelect = document.getElementById('pos-condicion-pago');
    if (condPagoSelect) {
        condPagoSelect.addEventListener('change', (e) => {
            const wrapper = document.getElementById('pos-vencimiento-wrapper');
            const input = document.getElementById('pos-fecha-vencimiento');
            const adelantoWrapper = document.getElementById('pos-credito-adelanto-wrapper');
            if (e.target.value === 'Credito') {
                if (wrapper) wrapper.style.display = 'block';
                if (input) input.setAttribute('required', 'true');
                if (adelantoWrapper) adelantoWrapper.style.display = 'grid';
            } else {
                if (wrapper) wrapper.style.display = 'none';
                if (input) input.removeAttribute('required');
                if (adelantoWrapper) adelantoWrapper.style.display = 'none';
            }
            validarPagosCombinados();
        });
    }

    // 2. Moneda change listener
    const monedaSelect = document.getElementById('pos-moneda');
    if (monedaSelect) {
        monedaSelect.addEventListener('change', (e) => {
            // Actualizar símbolos de moneda en inputs de pago combinados
            const simbolo = e.target.value === 'USD' ? '$' : 'S/';
            document.querySelectorAll('.pos-pago-moneda-simbolo').forEach(el => {
                el.textContent = simbolo;
            });
            renderCarritoPOS();
            // Actualizar total venta en el modal
            const totalVenta = obtenerTotalCarrito();
            const labelTotalVenta = document.getElementById('pos-pago-modal-total-venta');
            if (labelTotalVenta) labelTotalVenta.textContent = formatCurrency(totalVenta, e.target.value);
            validarPagosCombinados();
        });
    }

    // 3. Eventos de inputs de pagos combinados
    const pInputs = ['pago-monto-efectivo', 'pago-monto-transferencia', 'pago-monto-yape', 'pago-monto-tarjeta'];
    pInputs.forEach(id => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
            inputEl.addEventListener('input', validarPagosCombinados);
        }
    });

    // 4. Eventos del Comprador Invitado
    const toggleManual = document.getElementById('pos-cliente-manual-toggle');
    const selectGroup = document.getElementById('pos-cliente-select-group');
    const selectCliente = document.getElementById('pos-cliente');
    const manualGroup = document.getElementById('pos-cliente-manual-group');
    const inputManual = document.getElementById('pos-cliente-nombre-manual');
    const selectComprobante = document.getElementById('pos-tipo-comprobante');
    const selectPago = document.getElementById('pos-condicion-pago');
    const vencimientoWrapper = document.getElementById('pos-vencimiento-wrapper');
    const inputVencimiento = document.getElementById('pos-fecha-vencimiento');
    const adelantoWrapper = document.getElementById('pos-credito-adelanto-wrapper');

    if (toggleManual) {
        toggleManual.addEventListener('change', () => {
            if (toggleManual.checked) {
                if (selectGroup) selectGroup.style.display = 'none';
                if (selectCliente) selectCliente.removeAttribute('required');
                if (manualGroup) manualGroup.style.display = 'block';
                if (inputManual) inputManual.setAttribute('required', 'true');
                
                // Normativa SUNAT: Factura requiere obligatoriamente cliente registrado con RUC.
                const facturaOpt = selectComprobante.querySelector('option[value="Factura"]');
                if (facturaOpt) facturaOpt.disabled = true;
                if (selectComprobante.value === 'Factura') {
                    selectComprobante.value = 'Boleta';
                    mostrarToast("Para comprobante 'Factura' se requiere un cliente registrado con RUC. Seleccionado 'Boleta'.", "info");
                }
                
                // Créditos requieren cliente registrado
                const creditoOpt = selectPago.querySelector('option[value="Credito"]');
                if (creditoOpt) creditoOpt.disabled = true;
                if (selectPago.value === 'Credito') {
                    selectPago.value = 'Contado';
                    if (vencimientoWrapper) vencimientoWrapper.style.display = 'none';
                    if (inputVencimiento) inputVencimiento.removeAttribute('required');
                    if (adelantoWrapper) adelantoWrapper.style.display = 'none';
                    mostrarToast("Las ventas al crédito requieren un cliente registrado. Seleccionado 'Contado'.", "info");
                }
            } else {
                if (selectGroup) selectGroup.style.display = 'block';
                if (selectCliente) selectCliente.setAttribute('required', 'true');
                if (manualGroup) manualGroup.style.display = 'none';
                if (inputManual) inputManual.removeAttribute('required');
                
                const facturaOpt = selectComprobante.querySelector('option[value="Factura"]');
                if (facturaOpt) facturaOpt.disabled = false;
                
                const creditoOpt = selectPago.querySelector('option[value="Credito"]');
                if (creditoOpt) creditoOpt.disabled = false;
            }
        });
    }

    // 5. Tipo de comprobante change listener y RUC validation
    if (selectComprobante) {
        selectComprobante.addEventListener('change', () => {
            const isManual = document.getElementById('pos-cliente-manual-toggle').checked;
            if (selectComprobante.value === 'Factura') {
                if (isManual) {
                    const toggleManual = document.getElementById('pos-cliente-manual-toggle');
                    if (toggleManual) {
                        toggleManual.checked = false;
                        // Disparar evento para restaurar UI
                        toggleManual.dispatchEvent(new Event('change'));
                    }
                    mostrarToast("Para comprobante 'Factura' se requiere un cliente registrado con RUC. Modo Comprador Invitado desactivado.", "warning");
                }
                validarClienteRUC();
            }
            actualizarTotalesCheckoutModal();
        });
    }

    // 6. Cliente change listener
    if (selectCliente) {
        selectCliente.addEventListener('change', () => {
            if (selectComprobante && selectComprobante.value === 'Factura') {
                validarClienteRUC();
            }
        });
    }

    window.posModalListenersBound = true;
}

function validarClienteRUC() {
    const tipoComprobante = document.getElementById('pos-tipo-comprobante').value;
    if (tipoComprobante !== 'Factura') return true;

    const isManual = document.getElementById('pos-cliente-manual-toggle').checked;
    if (isManual) {
        mostrarToast("No se permite emitir Facturas a Compradores Invitados.", "danger");
        return false;
    }

    const clienteIdVal = document.getElementById('pos-cliente').value;
    const cliente = clientesDisponibles.find(c => c.id == clienteIdVal);
    if (!cliente) {
        mostrarToast("Debe seleccionar un cliente para emitir la factura.", "danger");
        return false;
    }

    const docTipo = cliente.tipo_documento;
    const docNum = (cliente.documento_identidad || '').trim();

    if (docTipo !== 'RUC') {
        mostrarToast(`El cliente seleccionado no tiene RUC (tipo actual: ${docTipo}). Las facturas exigen RUC obligatoriamente.`, "danger");
        return false;
    }

    if (docNum.length !== 11 || !/^(10|20)/.test(docNum) || !/^\d+$/.test(docNum)) {
        mostrarToast("El RUC del cliente debe tener 11 dígitos y comenzar con 10 o 20.", "danger");
        return false;
    }

    return true;
}

function actualizarTotalesCheckoutModal() {
    const tipoComprobante = document.getElementById('pos-tipo-comprobante').value;
    const totalVenta = obtenerTotalCarrito();
    const monedaVenta = document.getElementById('pos-moneda').value;

    const subtotalRow = document.getElementById('pos-pago-modal-subtotal-row');
    const subtotalLabel = document.getElementById('pos-pago-modal-subtotal-label');
    const subtotalMonto = document.getElementById('pos-pago-modal-subtotal');
    const igvRow = document.getElementById('pos-pago-modal-igv-row');
    const igvMonto = document.getElementById('pos-pago-modal-igv');
    const labelTotalVenta = document.getElementById('pos-pago-modal-total-venta');

    if (tipoComprobante === 'Factura') {
        const subtotalNeto = totalVenta / 1.18;
        const igv = totalVenta - subtotalNeto;

        if (subtotalRow) subtotalRow.style.display = 'flex';
        if (subtotalLabel) subtotalLabel.textContent = 'Subtotal Neto:';
        if (subtotalMonto) subtotalMonto.textContent = formatCurrency(subtotalNeto, monedaVenta);

        if (igvRow) igvRow.style.display = 'flex';
        if (igvMonto) igvMonto.textContent = formatCurrency(igv, monedaVenta);
    } else {
        // Boleta o Ticket
        if (subtotalRow) subtotalRow.style.display = 'flex';
        if (subtotalLabel) subtotalLabel.textContent = 'Subtotal:';
        if (subtotalMonto) subtotalMonto.textContent = formatCurrency(totalVenta, monedaVenta);

        if (igvRow) igvRow.style.display = 'none';
        if (igvMonto) igvMonto.textContent = formatCurrency(0, monedaVenta);
    }

    if (labelTotalVenta) {
        labelTotalVenta.textContent = formatCurrency(totalVenta, monedaVenta);
    }
}

function abrirCheckoutModal() {
    if (carritoPOS.length === 0) {
        mostrarToast("Agregue productos al carrito antes de cobrar.", "warning");
        return;
    }

    // Validar si todos los productos con series tienen sus series físicas vinculadas
    for (const item of carritoPOS) {
        if (item.maneja_series === 1 && item.series_seleccionadas.length !== item.cantidad) {
            mostrarToast(`Debe seleccionar las series para el producto: '${item.nombre}'.`, "warning");
            return;
        }
    }

    // Resetear formulario a estado inicial limpio
    const condPagoSelect = document.getElementById('pos-condicion-pago');
    if (condPagoSelect) condPagoSelect.value = 'Contado';
    
    const vencimientoWrapper = document.getElementById('pos-vencimiento-wrapper');
    if (vencimientoWrapper) vencimientoWrapper.style.display = 'none';
    
    const inputVencimiento = document.getElementById('pos-fecha-vencimiento');
    if (inputVencimiento) {
        inputVencimiento.removeAttribute('required');
        inputVencimiento.value = '';
    }
    
    const inputEfectivo = document.getElementById('pago-monto-efectivo');
    if (inputEfectivo) inputEfectivo.value = '0.00';
    
    const inputTransferencia = document.getElementById('pago-monto-transferencia');
    if (inputTransferencia) inputTransferencia.value = '0.00';
    
    const inputYape = document.getElementById('pago-monto-yape');
    if (inputYape) inputYape.value = '0.00';
    
    const inputTarjeta = document.getElementById('pago-monto-tarjeta');
    if (inputTarjeta) inputTarjeta.value = '0.00';
    
    const inputObservaciones = document.getElementById('pos-observaciones');
    if (inputObservaciones) inputObservaciones.value = '';

    // Mostrar/ocultar sección de items del préstamo
    const pSec = document.getElementById('checkout-prestamo-items-section');
    if (pSec) {
        if (conversionPrestamoId) {
            pSec.style.display = 'flex';
            renderCheckoutPrestamoItems();
        } else {
            pSec.style.display = 'none';
        }
    }

    // Actualizar totales y desglose del modal
    actualizarTotalesCheckoutModal();

    const totalVenta = obtenerTotalCarrito();

    // Auto-completar efectivo si otros campos están vacíos/en cero
    const transferencia = parseFloat(document.getElementById('pago-monto-transferencia').value) || 0;
    const yape = parseFloat(document.getElementById('pago-monto-yape').value) || 0;
    const tarjeta = parseFloat(document.getElementById('pago-monto-tarjeta').value) || 0;
    
    if (transferencia === 0 && yape === 0 && tarjeta === 0) {
        if (inputEfectivo) {
            inputEfectivo.value = totalVenta.toFixed(2);
        }
    }

    // Validar pagos combinados para actualizar el estado del botón y del total ingresado
    validarPagosCombinados();

    openModal('pos-checkout-modal');
}

function cerrarCheckoutModal() {
    closeModal('pos-checkout-modal');
    const pSec = document.getElementById('checkout-prestamo-items-section');
    if (pSec) pSec.style.display = 'none';
}

function renderCheckoutPrestamoItems() {
    const container = document.getElementById('checkout-prestamo-items-list');
    if (!container) return;
    
    container.innerHTML = carritoPOS.map((item, idx) => {
        const seriesText = item.series_seleccionadas && item.series_seleccionadas.length > 0
            ? `<div style="font-size:0.75rem; font-family:monospace; color:var(--color-primary); margin-top:2px;">S/N: ${item.series_seleccionadas.join(', ')}</div>`
            : '';
            
        const priceFinalFormatted = formatCurrency(item.precio_final, item.moneda || 'PEN');
        const priceBaseFormatted = formatCurrency(item.precio_mayorista, item.moneda || 'PEN');
        
        return `
            <div class="checkout-item-row" style="display:flex; flex-direction:column; gap:6px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
                <div style="font-weight:600; font-size:0.85rem; color:var(--text-main);">${item.nombre} x ${item.cantidad} U. ${seriesText}</div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <select class="form-select" style="height:32px; font-size:0.8rem; padding:0 8px; flex-grow:1;" onchange="cambiarPrecioItemCheckout(${idx}, this.value)">
                        <option value="Final" ${item.tipo_precio === 'Final' ? 'selected' : ''}>P. Final (${priceFinalFormatted})</option>
                        <option value="Base" ${item.tipo_precio === 'Base' ? 'selected' : ''}>P. Mayorista (${priceBaseFormatted})</option>
                        <option value="Manual" ${item.tipo_precio === 'Manual' ? 'selected' : ''}>P. Manual</option>
                    </select>
                    <input type="number" step="0.01" min="0" id="checkout-manual-price-input-${idx}" class="form-input" style="height:32px; width:100px; font-size:0.8rem; padding:0 8px; text-align:right; display: ${item.tipo_precio === 'Manual' ? 'block' : 'none'};" placeholder="Precio..." value="${item.precio_manual || ''}" oninput="actualizarPrecioManualItemCheckout(${idx}, this.value)">
                </div>
            </div>
        `;
    }).join('');
}

window.cambiarPrecioItemCheckout = function(idx, tipoPrecio) {
    const item = carritoPOS[idx];
    if (!item) return;
    item.tipo_precio = tipoPrecio;
    
    const inputManual = document.getElementById(`checkout-manual-price-input-${idx}`);
    if (inputManual) {
        if (tipoPrecio === 'Manual') {
            inputManual.style.display = 'block';
            item.precio_manual = item.precio_final;
            inputManual.value = item.precio_final;
        } else {
            inputManual.style.display = 'none';
        }
    }
    
    actualizarTotalesCheckoutModal();
    validarPagosCombinados();
};

window.actualizarPrecioManualItemCheckout = function(idx, valor) {
    const item = carritoPOS[idx];
    if (!item) return;
    item.precio_manual = parseFloat(valor) || 0.0;
    
    actualizarTotalesCheckoutModal();
    validarPagosCombinados();
};
