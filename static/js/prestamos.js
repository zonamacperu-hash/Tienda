/* ==============================================================================
   MÓDULO: PRÉSTAMOS / SALIDAS TEMPORALES INTERTIENDAS
   ============================================================================== */

let prestamosLista = [];
let prestamoProductosDisponibles = [];
let prestamoClientesDisponibles = [];

// Formulario de Préstamos: selección temporal de series
let prestamoSeriesSeleccionadas = [];
let prestamoProductoActivoManejaSeries = false;
let prestamoProductoActivoId = null;

async function renderPrestamos(container) {
    // 1. Cargar datos necesarios
    await Promise.all([
        obtenerPrestamos(),
        cargarProductosPrestamo(),
        cargarClientesPrestamo()
    ]);

    // 2. Renderizar Estructura de la Vista (Diseño Premium Glassmorphism)
    container.innerHTML = `
        <div class="view-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <h2 class="view-title" style="margin:0;">Préstamos Intertiendas</h2>
            <button class="btn btn-primary" onclick="abrirModalRegistrarPrestamo()">
                <i data-lucide="plus-circle" style="width:18px; height:18px; display:inline-block; vertical-align:middle; margin-right:6px;"></i>Registrar Nueva Salida
            </button>
        </div>

        <div style="display:flex; flex-direction:column; gap:24px;">
            <!-- Préstamos Pendientes -->
            <div class="card" style="padding:24px;">
                <h3 style="font-size:1.1rem; font-weight:700; color:var(--color-warning); border-bottom:1px solid var(--border-color); padding-bottom:10px; margin-top:0; margin-bottom:20px; display:flex; align-items:center; gap:8px;">
                    <i data-lucide="clock" style="width:20px; height:20px;"></i>Préstamos Pendientes
                </h3>
                <div style="overflow-x:auto;">
                    <table class="table" style="width:100%;">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tienda Destino</th>
                                <th>Fecha Envío</th>
                                <th>Items / Series</th>
                                <th>Estado</th>
                                <th style="text-align:center;">Acciones de Control</th>
                            </tr>
                        </thead>
                        <tbody id="prestamos-pendientes-body">
                            <!-- Filas inyectadas -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Historial de Préstamos Cerrados -->
            <div class="card" style="padding:24px;">
                <h3 style="font-size:1.1rem; font-weight:700; color:var(--color-success); border-bottom:1px solid var(--border-color); padding-bottom:10px; margin-top:0; margin-bottom:20px; display:flex; align-items:center; gap:8px;">
                    <i data-lucide="archive" style="width:20px; height:20px;"></i>Historial de Préstamos Cerrados
                </h3>
                <div style="overflow-x:auto;">
                    <table class="table" style="width:100%;">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tienda Destino</th>
                                <th>Fecha Envío</th>
                                <th>Items / Series</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody id="prestamos-historial-body">
                            <!-- Filas inyectadas -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();
    renderTablasPrestamos();
}

/* ==============================================================================
   GESTION DE DATOS
   ============================================================================== */
async function obtenerPrestamos() {
    try {
        const res = await fetch(`${API_URL}/api/prestamos`);
        prestamosLista = await res.json();
    } catch (err) {
        console.error(err);
        mostrarToast("Error al cargar listado de préstamos.", "danger");
    }
}

async function cargarProductosPrestamo() {
    try {
        const res = await fetch(`${API_URL}/api/productos`);
        const prods = await res.json();
        // Mostrar productos que tengan stock físico disponible
        prestamoProductosDisponibles = prods.filter(p => p.stock_actual > 0);
    } catch (err) {
        console.error(err);
    }
}

async function cargarClientesPrestamo() {
    try {
        const res = await fetch(`${API_URL}/api/actores?tipo=Cliente`);
        prestamoClientesDisponibles = await res.json();
    } catch (err) {
        console.error(err);
    }
}

/* ==============================================================================
   RENDERIZADO DE TABLAS
   ============================================================================== */
function renderTablasPrestamos() {
    const tbodyPendientes = document.getElementById('prestamos-pendientes-body');
    const tbodyHistorial = document.getElementById('prestamos-historial-body');

    const pendientes = prestamosLista.filter(p => p.estado === 'Pendiente' || p.estado === 'Devuelto Parcial');
    const historial = prestamosLista.filter(p => p.estado !== 'Pendiente' && p.estado !== 'Devuelto Parcial');

    // 1. Pendientes
    if (pendientes.length === 0) {
        tbodyPendientes.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No hay préstamos pendientes de cobro o retorno.</td></tr>`;
    } else {
        tbodyPendientes.innerHTML = pendientes.map(p => {
            const itemsHtml = p.items.map(item => {
                const seriesBadge = item.series && item.series.length > 0
                    ? `<div style="font-family:monospace; font-size:0.75rem; color:var(--color-primary); margin-top:2px;">S/N: ${item.series.map(s => `<span class="badge ${s.estado === 'Prestado' ? 'badge-warning' : 'badge-success'}">${s.numero_serie} (${s.estado})</span>`).join(' ')}</div>`
                    : '';
                return `<div>• <strong>${item.producto_nombre}</strong> x ${item.cantidad} U. ${seriesBadge}</div>`;
            }).join('');

            const estadoClass = p.estado === 'Devuelto Parcial' ? 'badge-warning' : 'badge-danger';

            return `
                <tr>
                    <td>${p.id}</td>
                    <td style="font-weight:600;">${p.tienda_destino_nombre}</td>
                    <td style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(p.fecha_prestamo)}</td>
                    <td>${itemsHtml}</td>
                    <td><span class="badge ${estadoClass}">${p.estado}</span></td>
                    <td style="text-align:center;">
                        <div style="display:flex; justify-content:center; gap:8px;">
                            <button class="btn btn-primary btn-sm" onclick="convertirPrestamoAVenta(${p.id})" style="font-size:0.75rem; padding:6px 10px;">
                                <i data-lucide="shopping-cart" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>Convertir en Venta
                            </button>
                            <button class="btn btn-success btn-sm" onclick="abrirDevolucionModal(${p.id})" style="font-size:0.75rem; padding:6px 10px; border-color:var(--color-success); background-color:transparent; color:var(--color-success);">
                                <i data-lucide="arrow-down-left" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>Retorno Equipo
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 2. Historial
    if (historial.length === 0) {
        tbodyHistorial.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No hay préstamos cerrados en el historial.</td></tr>`;
    } else {
        tbodyHistorial.innerHTML = historial.map(p => {
            const itemsHtml = p.items.map(item => {
                const seriesBadge = item.series && item.series.length > 0
                    ? `<div style="font-family:monospace; font-size:0.75rem; color:var(--color-primary); margin-top:2px;">S/N: ${item.series.map(s => `<span class="badge ${s.estado === 'Vendido' || s.estado === 'En Garantia' ? 'badge-success' : 'badge-secondary'}">${s.numero_serie} (${s.estado})</span>`).join(' ')}</div>`
                    : '';
                return `<div>• <strong>${item.producto_nombre}</strong> x ${item.cantidad} U. ${seriesBadge}</div>`;
            }).join('');

            const estadoClass = p.estado === 'Convertido en Venta' ? 'badge-success' : 'badge-secondary';

            return `
                <tr>
                    <td>${p.id}</td>
                    <td style="font-weight:600;">${p.tienda_destino_nombre}</td>
                    <td style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(p.fecha_prestamo)}</td>
                    <td>${itemsHtml}</td>
                    <td><span class="badge ${estadoClass}">${p.estado}</span></td>
                </tr>
            `;
        }).join('');
    }

    lucide.createIcons();
}

/* ==============================================================================
   LOGICA DEL FORMULARIO Y SELECTOR DE SERIES
   ============================================================================== */
function abrirModalRegistrarPrestamo() {
    prestamoSeriesSeleccionadas = [];
    prestamoProductoActivoManejaSeries = false;
    prestamoProductoActivoId = null;

    const bodyHtml = `
        <form id="form-registrar-prestamo" style="display:flex; flex-direction:column; gap:16px;">
            <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="prestamo-tienda">Tienda Aliada (Socio Comercial)</label>
                <select class="form-select" id="prestamo-tienda" required style="width:100%;">
                    <option value="">Seleccione Tienda Destino...</option>
                    ${prestamoClientesDisponibles.map(c => `
                        <option value="${c.id}">${c.nombre_razon_social} (${c.documento_identidad})</option>
                    `).join('')}
                </select>
            </div>

            <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="prestamo-producto">Producto a Enviar</label>
                <select class="form-select" id="prestamo-producto" required style="width:100%;">
                    <option value="">Seleccione Producto...</option>
                    ${prestamoProductosDisponibles.map(p => `
                        <option value="${p.id}" data-series="${p.maneja_series}" data-stock="${p.stock_actual}" data-moneda="${p.moneda || 'PEN'}">
                            ${p.nombre} (Stock: ${p.stock_actual})
                        </option>
                    `).join('')}
                </select>
            </div>

            <div class="form-grid-2">
                <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" for="prestamo-cantidad">Cantidad a Prestar</label>
                    <input type="number" min="1" class="form-input" id="prestamo-cantidad" value="1" required style="width:100%;">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label class="form-label" for="prestamo-tipo-precio">Seleccionar Precio</label>
                    <select class="form-select" id="prestamo-tipo-precio" required style="width:100%;">
                        <option value="Final">Público</option>
                        <option value="Base">Mayorista</option>
                        <option value="Manual">Manual</option>
                    </select>
                </div>
            </div>

            <div class="form-group" id="prestamo-precio-manual-group" style="display:none; margin-bottom:0;">
                <label class="form-label" for="prestamo-precio-manual">Precio Manual (S/)</label>
                <input type="number" step="0.01" min="0" class="form-input" id="prestamo-precio-manual" value="0.00" style="width:100%;">
            </div>

            <!-- Selector de series físicas (Sólo si maneja_series = 1) -->
            <div id="prestamo-series-section" style="display:none; flex-direction:column; gap:8px; background:rgba(0,0,0,0.15); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <span style="font-size:0.8rem; font-weight:600; color:var(--color-warning);">Seleccione Números de Serie:</span>
                <div id="prestamo-series-count" style="font-size:0.75rem; color:var(--text-muted);">
                    Seleccionadas: <span id="prestamo-series-sel-qty" style="color:var(--color-success); font-weight:bold;">0</span> de <span id="prestamo-series-req-qty" style="font-weight:bold;">1</span>
                </div>
                <div class="series-grid" id="prestamo-series-container" style="display:flex; flex-wrap:wrap; gap:6px; max-height:120px; overflow-y:auto; padding:2px;">
                    <!-- Chips inyectados -->
                </div>
            </div>

            <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="prestamo-observaciones">Observaciones / Motivo</label>
                <textarea class="form-textarea" id="prestamo-observaciones" placeholder="Ej: Préstamo para exhibición por 5 días..." style="width:100%; height:70px; resize:none;"></textarea>
            </div>
        </form>
    `;

    const footerHtml = `
        <button class="btn btn-outline" onclick="closeModal('global-modal')">Cancelar</button>
        <button class="btn btn-primary" id="btn-confirmar-prestamo-modal">Confirmar Salida Temporal</button>
    `;

    setupGlobalModal("Registrar Nueva Salida", bodyHtml, footerHtml);
    inicializarEventosPrestamos();
}

function inicializarEventosPrestamos() {
    const selectProd = document.getElementById('prestamo-producto');
    const inputCant = document.getElementById('prestamo-cantidad');
    const selectTipoPrecio = document.getElementById('prestamo-tipo-precio');
    const groupPrecioManual = document.getElementById('prestamo-precio-manual-group');

    if (selectProd) {
        selectProd.addEventListener('change', async (e) => {
            const selectedOpt = e.target.options[e.target.selectedIndex];
            if (!selectedOpt || e.target.value === "") {
                document.getElementById('prestamo-series-section').style.display = 'none';
                prestamoProductoActivoManejaSeries = false;
                prestamoProductoActivoId = null;
                return;
            }

            prestamoProductoActivoId = parseInt(e.target.value);
            prestamoProductoActivoManejaSeries = selectedOpt.getAttribute('data-series') === '1';

            // Actualizar símbolo de moneda en el campo manual
            const moneda = selectedOpt.getAttribute('data-moneda') || 'PEN';
            const symbol = moneda === 'USD' ? '$' : 'S/';
            const labelPrecioManual = document.querySelector('label[for="prestamo-precio-manual"]');
            if (labelPrecioManual) {
                labelPrecioManual.textContent = `Precio Manual (${symbol})`;
            }

            if (prestamoProductoActivoManejaSeries) {
                document.getElementById('prestamo-series-section').style.display = 'flex';
                prestamoSeriesSeleccionadas = [];
                actualizarContadoresSeriesForm();
                await cargarSeriesDisponiblesForm(prestamoProductoActivoId);
            } else {
                document.getElementById('prestamo-series-section').style.display = 'none';
            }
        });
    }

    if (inputCant) {
        inputCant.addEventListener('input', () => {
            actualizarContadoresSeriesForm();
        });
    }

    if (selectTipoPrecio && groupPrecioManual) {
        selectTipoPrecio.addEventListener('change', (e) => {
            if (e.target.value === 'Manual') {
                groupPrecioManual.style.display = 'flex';
            } else {
                groupPrecioManual.style.display = 'none';
            }
        });
    }

    // Registrar préstamo submit
    const form = document.getElementById('form-registrar-prestamo');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tiendaDestinoId = parseInt(document.getElementById('prestamo-tienda').value);
            const productoId = parseInt(document.getElementById('prestamo-producto').value);
            const cantidad = parseInt(document.getElementById('prestamo-cantidad').value);
            const observaciones = document.getElementById('prestamo-observaciones').value.trim();
            const tipoPrecio = document.getElementById('prestamo-tipo-precio').value;
            const precioManual = tipoPrecio === 'Manual' ? parseFloat(document.getElementById('prestamo-precio-manual').value || 0) : 0.00;

            if (prestamoProductoActivoManejaSeries && prestamoSeriesSeleccionadas.length !== cantidad) {
                mostrarToast(`Debe seleccionar exactamente ${cantidad} series físicas para el préstamo.`, "warning");
                return;
            }

            const payload = {
                tienda_destino_id: tiendaDestinoId,
                usuario_id: usuarioActivo.id,
                observaciones: observaciones,
                items: [
                    {
                        producto_id: productoId,
                        cantidad: cantidad,
                        tipo_precio: tipoPrecio,
                        precio_manual: precioManual,
                        series: prestamoProductoActivoManejaSeries ? prestamoSeriesSeleccionadas : []
                    }
                ]
            };

            try {
                const res = await fetch(`${API_URL}/api/prestamos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.exito) {
                    mostrarToast(data.mensaje, "success");
                    closeModal('global-modal');
                    // Recargar vista
                    await renderPrestamos(document.getElementById('main-view'));
                } else {
                    mostrarToast(data.mensaje, "danger");
                }
            } catch (err) {
                console.error(err);
                mostrarToast("Error de conexión al guardar préstamo.", "danger");
            }
        });
    }

    const btnConfirm = document.getElementById('btn-confirmar-prestamo-modal');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            const form = document.getElementById('form-registrar-prestamo');
            if (form) {
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        });
    }
}

async function cargarSeriesDisponiblesForm(productoId) {
    const container = document.getElementById('prestamo-series-container');
    container.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">Cargando series físicas...</span>`;
    
    try {
        const res = await fetch(`${API_URL}/api/productos/${productoId}/series`);
        const series = await res.json();
        
        const disponibles = series.filter(s => s.estado === 'Disponible');

        if (disponibles.length === 0) {
            container.innerHTML = `<span style="font-size:0.75rem; color:var(--color-danger);">No hay números de serie en estado 'Disponible' para este producto.</span>`;
            return;
        }

        container.innerHTML = disponibles.map(s => {
            const isSelected = prestamoSeriesSeleccionadas.includes(s.numero_serie);
            const activeClass = isSelected ? 'selected' : '';
            return `
                <div class="serie-chip ${activeClass}" onclick="toggleSerieFormSeleccion('${s.numero_serie}')" style="cursor:pointer; font-size:0.75rem; font-family:monospace; padding:4px 8px; border:1px solid var(--border-color); border-radius:var(--radius-sm); user-select:none; background: rgba(255,255,255,0.02);">
                    ${s.numero_serie}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = `<span style="font-size:0.75rem; color:var(--color-danger);">Error al cargar series.</span>`;
    }
}

window.toggleSerieFormSeleccion = function(numeroSerie) {
    const cantidadRequerida = parseInt(document.getElementById('prestamo-cantidad').value) || 1;
    const index = prestamoSeriesSeleccionadas.indexOf(numeroSerie);

    if (index > -1) {
        prestamoSeriesSeleccionadas.splice(index, 1);
    } else {
        if (prestamoSeriesSeleccionadas.length < cantidadRequerida) {
            prestamoSeriesSeleccionadas.push(numeroSerie);
        } else {
            mostrarToast(`Ya seleccionó la cantidad máxima de ${cantidadRequerida} series.`, "warning");
            return;
        }
    }

    actualizarContadoresSeriesForm();
    
    // Actualizar clase del chip visualmente
    const chips = document.querySelectorAll('#prestamo-series-container .serie-chip');
    chips.forEach(chip => {
        if (chip.textContent.trim() === numeroSerie) {
            chip.classList.toggle('selected');
        }
    });
};

function actualizarContadoresSeriesForm() {
    const qty = parseInt(document.getElementById('prestamo-cantidad').value) || 1;
    const labelSel = document.getElementById('prestamo-series-sel-qty');
    const labelReq = document.getElementById('prestamo-series-req-qty');
    
    if (labelSel) labelSel.textContent = prestamoSeriesSeleccionadas.length;
    if (labelReq) labelReq.textContent = qty;
}

/* ==============================================================================
   CONVERSIÓN DE PRÉSTAMO A VENTA (INTEGRACIÓN POS)
   ============================================================================== */
window.convertirPrestamoAVenta = async function(prestamoId) {
    const prestamo = prestamosLista.find(p => p.id === prestamoId);
    if (!prestamo) return;

    if (!confirm(`¿Está seguro de facturar el préstamo ID ${prestamoId} a ${prestamo.tienda_destino_nombre}?`)) {
        return;
    }

    try {
        // 1. Establecer el ID de préstamo activo para la venta
        conversionPrestamoId = prestamoId;

        // 2. Mapear los productos a carritoPOS
        carritoPOS = prestamo.items.map(item => {
            const seriesSeleccionadas = item.series
                ? item.series.filter(s => s.estado === 'Prestado').map(s => s.numero_serie)
                : [];
                
            return {
                producto_id: item.producto_id,
                nombre: item.producto_nombre,
                cantidad: item.cantidad,
                maneja_series: item.maneja_series,
                precio_base: item.precio_base,
                precio_mayorista: item.precio_mayorista,
                precio_final: item.precio_final,
                moneda: item.moneda || 'PEN',
                series_seleccionadas: seriesSeleccionadas,
                tipo_precio: 'Final',
                precio_manual: item.precio_final,
                meses_garantia: 0
            };
        });

        // 3. Cambiar a la pestaña POS
        const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
        menuItems.forEach(i => {
            i.classList.remove('active');
            if (i.getAttribute('data-view') === 'pos') {
                i.classList.add('active');
            }
        });

        // 4. Renderizar POS e inicializar checkout
        await irAVista('pos');

        // Pre-seleccionar la tienda en el combo de clientes
        const clientSelect = document.getElementById('pos-cliente');
        if (clientSelect) {
            clientSelect.value = prestamo.tienda_destino_id;
        }

        // Abrir el modal checkout directamente
        abrirCheckoutModal();

    } catch (err) {
        console.error(err);
        mostrarToast("Ocurrió un error al cargar los datos del préstamo en el POS.", "danger");
    }
};

/* ==============================================================================
   MODAL DE RETORNO/DEVOLUCIÓN DE EQUIPOS
   ============================================================================== */
let activeDevolucionPrestamoId = null;

window.abrirDevolucionModal = function(prestamoId) {
    const prestamo = prestamosLista.find(p => p.id === prestamoId);
    if (!prestamo) return;

    activeDevolucionPrestamoId = prestamoId;

    document.getElementById('devolucion-modal-store-name').textContent = prestamo.tienda_destino_nombre;
    const container = document.getElementById('devolucion-selection-container');
    
    // Obtener series prestadas de este préstamo (en estado 'Prestado')
    let seriesPrestadas = [];
    prestamo.items.forEach(item => {
        if (item.series) {
            item.series.forEach(s => {
                if (s.estado === 'Prestado') {
                    seriesPrestadas.push({
                        numero_serie: s.numero_serie,
                        producto_nombre: item.producto_nombre
                    });
                }
            });
        }
    });

    if (seriesPrestadas.length === 0) {
        // Si no tiene series (producto tradicional), mostramos campos para ingresar cantidades devueltas
        container.innerHTML = prestamo.items.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="font-weight:600; font-size:0.85rem;">${item.producto_nombre}</span>
                <input type="number" min="0" max="${item.cantidad}" class="form-input tradicional-devolucion-input" data-prod-id="${item.producto_id}" value="${item.cantidad}" style="width:70px; height:32px; padding:0 8px; text-align:right;">
            </div>
        `).join('');
    } else {
        // Mostrar checkboxes de cada serie prestada
        container.innerHTML = seriesPrestadas.map(s => `
            <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <input type="checkbox" class="devolucion-serie-checkbox" value="${s.numero_serie}" id="chk-dev-sn-${s.numero_serie}" style="width:18px; height:18px; cursor:pointer;" checked>
                <label for="chk-dev-sn-${s.numero_serie}" style="cursor:pointer; font-size:0.85rem; font-family:monospace; color:var(--text-main); flex-grow:1;">
                    ${s.numero_serie} <span style="font-size:0.75rem; color:var(--text-muted); font-family:'Inter'; margin-left:6px;">(${s.producto_nombre})</span>
                </label>
            </div>
        `).join('');
    }

    openModal('prestamo-devolucion-modal');
};

// Evento confirmar devolución de almacén
document.getElementById('prestamo-devolucion-confirm-btn').addEventListener('click', async () => {
    if (!activeDevolucionPrestamoId) return;

    const seriesCheckboxes = document.querySelectorAll('.devolucion-serie-checkbox');
    const tradicionalesInputs = document.querySelectorAll('.tradicional-devolucion-input');
    
    const seriesADevolver = [];
    const tradicionalesADevolver = [];

    // 1. Recopilar series
    seriesCheckboxes.forEach(chk => {
        if (chk.checked) {
            seriesADevolver.push(chk.value);
        }
    });

    // 2. Recopilar tradicionales
    tradicionalesInputs.forEach(input => {
        const prodId = parseInt(input.getAttribute('data-prod-id'));
        const cant = parseInt(input.value) || 0;
        if (cant > 0) {
            tradicionalesADevolver.push({
                producto_id: prodId,
                cantidad: cant
            });
        }
    });

    if (seriesADevolver.length === 0 && tradicionalesADevolver.length === 0) {
        mostrarToast("Debe marcar al menos un equipo o cantidad para registrar el retorno.", "warning");
        return;
    }

    const payload = {
        series: seriesADevolver,
        productos_tradicionales: tradicionalesADevolver
    };

    try {
        const res = await fetch(`${API_URL}/api/prestamos/${activeDevolucionPrestamoId}/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            closeModal('prestamo-devolucion-modal');
            
            // Recargar vista
            await renderPrestamos(document.getElementById('main-view'));
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error de conexión al procesar el retorno.", "danger");
    }
});
