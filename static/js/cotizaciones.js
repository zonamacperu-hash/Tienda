/* ==============================================================================
   MÓDULO: COTIZACIONES (Generador de Proformas y Cotizaciones en PDF)
   ============================================================================== */

let itemsCotizacion = [];
let clientesCotizacion = [];
let productosCotizacion = [];
let cotizacionEdicionId = null;

// Inicializador de la vista
async function renderCotizaciones(container) {
    container.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- COLUMNA IZQUIERDA: Configuración y Datos (Lg: 5 cols) -->
            <div class="lg:col-span-5 flex flex-col gap-6">
                <!-- Tarjeta 1: Datos del Cliente -->
                <div class="card">
                    <h3 class="card-title text-primary flex items-center gap-2">
                        <i data-lucide="user"></i> Información del Cliente
                    </h3>
                    
                    <div style="display:flex; align-items:center; gap:10px; background-color: rgba(255,255,255,0.02); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 14px;">
                        <input type="checkbox" id="cot-cliente-manual-toggle" style="cursor:pointer; width:16px; height:16px; accent-color:var(--color-primary);">
                        <label for="cot-cliente-manual-toggle" style="font-size:0.85rem; font-weight:600; cursor:pointer; user-select:none; color:var(--text-main);">Ingreso manual (No registrado)</label>
                    </div>

                    <!-- Selector Clientes Registrados -->
                    <div class="form-group" id="cot-cliente-select-group">
                        <label class="form-label">Seleccionar Cliente</label>
                        <select class="form-select w-full" id="cot-cliente-select"></select>
                    </div>

                    <!-- Datos manuales (Oculto por defecto) -->
                    <div id="cot-cliente-manual-group" class="hidden flex flex-col gap-4">
                        <div class="form-group">
                            <label class="form-label">Nombre / Razón Social</label>
                            <input type="text" class="form-input w-full" id="cot-cliente-nombre" placeholder="Ej: Juan Pérez o Tech SAC">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label class="form-label">Tipo Documento</label>
                                <select class="form-select w-full" id="cot-cliente-tipo-doc">
                                    <option value="DNI">DNI</option>
                                    <option value="RUC">RUC</option>
                                    <option value="CE">Carnet Ext.</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Nro Documento</label>
                                <input type="text" class="form-input w-full" id="cot-cliente-nro-doc" placeholder="12345678">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Dirección</label>
                            <input type="text" class="form-input w-full" id="cot-cliente-direccion" placeholder="Av. Principal 123">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label class="form-label">Teléfono</label>
                                <input type="text" class="form-input w-full" id="cot-cliente-telefono" placeholder="987654321">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-input w-full" id="cot-cliente-email" placeholder="cliente@correo.com">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tarjeta 2: Agregar Producto / Concepto -->
                <div class="card">
                    <h3 class="card-title text-success flex items-center gap-2">
                        <i data-lucide="package-plus"></i> Agregar Ítem a la Cotización
                    </h3>
                    
                    <div class="form-group">
                        <label class="form-label">Buscar / Seleccionar Producto</label>
                        <select class="form-select w-full" id="cot-producto-select">
                            <option value="">-- Seleccionar Producto --</option>
                        </select>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Cantidad</label>
                            <input type="number" min="1" class="form-input w-full" id="cot-item-cantidad" value="1">
                        </div>
                        <!-- PRECIO MANUAL: Totalmente editable -->
                        <div class="form-group">
                            <label class="form-label" id="cot-precio-label">Precio Unitario (S/)</label>
                            <input type="number" step="0.01" min="0" class="form-input w-full font-bold" id="cot-item-precio" value="0.00">
                            <span class="text-xs text-gray-400" id="cot-precio-sugerido-label">Precio sugerido catálogo</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Descuento (%)</label>
                            <input type="number" min="0" max="100" class="form-input w-full" id="cot-item-descuento" value="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Garantía (Meses)</label>
                            <input type="number" min="0" class="form-input w-full" id="cot-item-garantia" value="0">
                        </div>
                    </div>

                    <button class="btn btn-success w-full mt-2 py-3" id="btn-cot-agregar-item">
                        <i data-lucide="plus-circle" style="width:18px; display:inline-block; vertical-align:middle; margin-right:6px;"></i>Agregar Ítem
                    </button>
                </div>

                <!-- Tarjeta 3: Configuración de la Proforma -->
                <div class="card">
                    <h3 class="card-title text-info flex items-center gap-2">
                        <i data-lucide="sliders"></i> Parámetros de Oferta
                    </h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Moneda</label>
                            <select class="form-select w-full" id="cot-moneda">
                                <option value="PEN" selected>Soles (PEN)</option>
                                <option value="USD">Dólares (USD)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Validez (Días)</label>
                            <input type="number" min="1" class="form-input w-full" id="cot-validez" value="7">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Tiempo Entrega</label>
                            <input type="text" class="form-input w-full" id="cot-entrega" value="Inmediata">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Forma de Pago</label>
                            <input type="text" class="form-input w-full" id="cot-forma-pago" value="Contado contra entrega">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notas / Términos de Cotización</label>
                        <textarea class="form-textarea w-full" id="cot-notas" style="height:60px; min-height:60px; resize:none;" placeholder="Ej: Precios válidos salvo venta previa. Depósitos a cuenta BCP Nro..."></textarea>
                    </div>
                </div>
            </div>

            <!-- COLUMNA DERECHA: Resumen de Cotización (Lg: 7 cols) -->
            <div class="lg:col-span-7 flex flex-col gap-6">
                <div class="card flex-grow flex flex-col">
                    <div class="flex justify-between items-center mb-4 pb-2 border-b" style="border-color:var(--border-color);">
                        <h3 class="card-title text-primary flex items-center gap-2 m-0">
                            <i data-lucide="file-spreadsheet"></i> Detalle de Cotización
                        </h3>
                        <button class="btn btn-secondary text-danger border-red-500 py-1 px-3 text-xs" id="btn-cot-limpiar" title="Borrar todo">
                            <i data-lucide="trash-2" style="width:12px; margin-right:4px;"></i> Limpiar
                        </button>
                    </div>

                    <!-- Tabla de items cargados -->
                    <div class="table-container flex-grow" style="min-height: 250px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Descripción</th>
                                    <th style="text-align:center; width:60px;">Cant.</th>
                                    <th style="text-align:right; width:90px;">P. Unit</th>
                                    <th style="text-align:right; width:70px;">Desc.</th>
                                    <th style="text-align:center; width:70px;">Garant.</th>
                                    <th style="text-align:right; width:90px;">Total</th>
                                    <th style="text-align:center; width:50px;"></th>
                                </tr>
                            </thead>
                            <tbody id="cot-items-body">
                                <tr>
                                    <td colspan="7" style="text-align:center; padding:48px; color:var(--text-muted);">
                                        No hay productos agregados en esta cotización.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Panel de Totales y Generar -->
                    <div class="mt-6 pt-4 border-t" style="border-color:var(--border-color);">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div>
                                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
                                    <input type="checkbox" id="cot-desglosar-igv" checked style="cursor:pointer; width:16px; height:16px; accent-color:var(--color-primary);">
                                    <label for="cot-desglosar-igv" style="font-size:0.85rem; font-weight:600; cursor:pointer; user-select:none;">Desglosar IGV (18.00%)</label>
                                </div>
                                <span class="text-xs text-gray-400">Si se desglosa el IGV, el total se calculará como Base + IGV. Caso contrario, los precios se mostrarán como netos directos.</span>
                            </div>
                            
                            <div class="flex flex-col gap-2">
                                <div class="flex justify-between items-center text-sm">
                                    <span style="color: var(--text-muted);" id="cot-label-subtotal">Subtotal:</span>
                                    <span class="font-bold" id="cot-val-subtotal">S/ 0.00</span>
                                </div>
                                <div class="flex justify-between items-center text-sm" id="cot-row-igv">
                                    <span style="color: var(--text-muted);">IGV (18%):</span>
                                    <span class="font-bold" id="cot-val-igv">S/ 0.00</span>
                                </div>
                                <div class="flex justify-between items-center text-lg font-extrabold border-t pt-2" style="border-color:var(--border-color); color:var(--color-primary);">
                                    <span>Importe Total:</span>
                                    <span id="cot-val-total">S/ 0.00</span>
                                </div>
                            </div>
                        </div>

                        <div class="mt-6 flex gap-4">
                            <button class="btn btn-primary flex-grow py-3 text-base flex justify-center items-center gap-2" id="btn-cot-descargar-pdf">
                                <i data-lucide="file-down" style="width:20px; height:20px;"></i> Generar PDF de Cotización
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- SECCIÓN: Historial Local de Cotizaciones (LocalStorage) -->
        <div class="card mt-8">
            <h3 class="card-title text-info flex items-center gap-2 mb-4 pb-2 border-b" style="border-color:var(--border-color);">
                <i data-lucide="history"></i> Cotizaciones Recientes (Sesión Local)
            </h3>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nro. Cotización</th>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Moneda</th>
                            <th style="text-align:right;">Total</th>
                            <th>Validez</th>
                            <th style="text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="cot-historial-body">
                        <tr>
                            <td colspan="7" style="text-align:center; padding:16px; color:var(--text-muted);">
                                No hay cotizaciones registradas localmente.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Cargar datos asíncronos
    await cargarDatosClientes();
    await cargarDatosProductos();

    // Registrar Eventos de la Interfaz
    registrarEventosCotizacion();

    // Renderizar cotización activa e historial
    renderTablaItemsCotizacion();
    renderHistorialCotizaciones();

    lucide.createIcons();
}

// Cargar actores de tipo Cliente
async function cargarDatosClientes() {
    try {
        const res = await fetch(`${API_URL}/api/actores?tipo=Cliente`);
        clientesCotizacion = await res.json();
        
        const select = document.getElementById('cot-cliente-select');
        if (select) {
            select.innerHTML = clientesCotizacion.map(c => `
                <option value="${c.id}">${c.nombre_razon_social} (${c.tipo_documento}: ${c.documento_identidad || 'Sin Doc.'})</option>
            `).join('');
        }
    } catch (err) {
        console.error("Error al cargar clientes para cotizaciones:", err);
    }
}

// Cargar productos del inventario
async function cargarDatosProductos() {
    try {
        const res = await fetch(`${API_URL}/api/productos`);
        productosCotizacion = await res.json();
        
        const select = document.getElementById('cot-producto-select');
        if (select) {
            select.innerHTML = '<option value="">-- Seleccionar Producto --</option>' + 
                productosCotizacion.map(p => `
                    <option value="${p.id}">${p.nombre} (Stock: ${p.stock_actual} | ${p.moneda || 'PEN'} ${p.precio_final.toFixed(2)})</option>
                `).join('');
        }
    } catch (err) {
        console.error("Error al cargar productos para cotizaciones:", err);
    }
}

// Configurar los listeners de eventos
function registrarEventosCotizacion() {
    const toggleManual = document.getElementById('cot-cliente-manual-toggle');
    const selectGroup = document.getElementById('cot-cliente-select-group');
    const manualGroup = document.getElementById('cot-cliente-manual-group');
    
    // Toggle manual/registrado
    if (toggleManual) {
        toggleManual.addEventListener('change', () => {
            if (toggleManual.checked) {
                selectGroup.classList.add('hidden');
                manualGroup.classList.remove('hidden');
            } else {
                selectGroup.classList.remove('hidden');
                manualGroup.classList.add('hidden');
            }
        });
    }

    // Al seleccionar un producto, cargar su precio de catálogo
    const prodSelect = document.getElementById('cot-producto-select');
    const precioInput = document.getElementById('cot-item-precio');
    const precioLabel = document.getElementById('cot-precio-label');
    
    if (prodSelect && precioInput) {
        prodSelect.addEventListener('change', () => {
            const prodId = parseInt(prodSelect.value);
            const prod = productosCotizacion.find(p => p.id === prodId);
            if (prod) {
                precioInput.value = prod.precio_final.toFixed(2);
                precioLabel.textContent = `Precio Unitario (${prod.moneda || 'PEN'})`;
            } else {
                precioInput.value = "0.00";
                precioLabel.textContent = `Precio Unitario (S/)`;
            }
        });
    }

    // Cambiar la etiqueta de la moneda en la proforma
    const monedaSelect = document.getElementById('cot-moneda');
    if (monedaSelect) {
        monedaSelect.addEventListener('change', () => {
            const sym = monedaSelect.value === 'USD' ? '$' : 'S/';
            document.getElementById('cot-precio-label').textContent = `Precio Unitario (${monedaSelect.value})`;
            renderTablaItemsCotizacion();
        });
    }

    // Checkbox de IGV
    const desglosarCheckbox = document.getElementById('cot-desglosar-igv');
    if (desglosarCheckbox) {
        desglosarCheckbox.addEventListener('change', () => {
            const rowIgv = document.getElementById('cot-row-igv');
            if (desglosarCheckbox.checked) {
                rowIgv.style.display = 'flex';
                document.getElementById('cot-label-subtotal').textContent = 'Subtotal Neto:';
            } else {
                rowIgv.style.display = 'none';
                document.getElementById('cot-label-subtotal').textContent = 'Subtotal:';
            }
            actualizarTotalesCotizacion();
        });
    }

    // Agregar Item
    document.getElementById('btn-cot-agregar-item').addEventListener('click', agregarItemACotizacion);

    // Limpiar Todo
    document.getElementById('btn-cot-limpiar').addEventListener('click', () => {
        if (confirm("¿Seguro de vaciar los items cotizados?")) {
            itemsCotizacion = [];
            renderTablaItemsCotizacion();
            mostrarToast("Cotización vaciada.", "info");
        }
    });

    // Descargar PDF
    document.getElementById('btn-cot-descargar-pdf').addEventListener('click', generarPDFCotizacion);
}

// Agregar item
function agregarItemACotizacion() {
    const prodSelect = document.getElementById('cot-producto-select');
    const prodId = parseInt(prodSelect.value);
    const qtyInput = document.getElementById('cot-item-cantidad');
    const cant = parseInt(qtyInput.value);
    const precioInput = document.getElementById('cot-item-precio');
    const precio = parseFloat(precioInput.value);
    const descInput = document.getElementById('cot-item-descuento');
    const desc = parseFloat(descInput.value) || 0;
    const garInput = document.getElementById('cot-item-garantia');
    const gar = parseInt(garInput.value) || 0;

    if (!prodId) {
        mostrarToast("Debe seleccionar un producto.", "warning");
        prodSelect.focus();
        return;
    }
    if (isNaN(cant) || cant <= 0) {
        mostrarToast("La cantidad debe ser mayor a cero.", "warning");
        qtyInput.focus();
        return;
    }
    if (isNaN(precio) || precio < 0) {
        mostrarToast("El precio no puede ser negativo.", "warning");
        precioInput.focus();
        return;
    }

    const prod = productosCotizacion.find(p => p.id === prodId);
    
    // Verificar si ya existe en la cotización
    const indexExistente = itemsCotizacion.findIndex(item => item.producto_id === prodId);
    if (indexExistente > -1) {
        // Si ya existe, actualizamos cantidad y precio manual
        itemsCotizacion[indexExistente].cantidad += cant;
        itemsCotizacion[indexExistente].precio_cotizado = precio; // Sobrescribir con el precio manual
        itemsCotizacion[indexExistente].descuento = desc;
        itemsCotizacion[indexExistente].meses_garantia = gar;
    } else {
        itemsCotizacion.push({
            producto_id: prod.id,
            nombre: prod.nombre,
            detalles_tecnicos: prod.detalles_tecnicos || '',
            moneda_origen: prod.moneda || 'PEN',
            precio_catalogo: prod.precio_final,
            precio_cotizado: precio, // Guardar el precio manual ingresado
            cantidad: cant,
            descuento: desc,
            meses_garantia: gar
        });
    }

    // Resetear form de item
    prodSelect.value = "";
    qtyInput.value = "1";
    precioInput.value = "0.00";
    descInput.value = "0";
    garInput.value = "0";
    document.getElementById('cot-precio-label').textContent = 'Precio Unitario (S/)';

    renderTablaItemsCotizacion();
    mostrarToast("Producto agregado a la proforma.", "success");
}

// Eliminar un item de la cotización activa
function eliminarItemCotizacion(prodId) {
    itemsCotizacion = itemsCotizacion.filter(item => item.producto_id !== prodId);
    renderTablaItemsCotizacion();
}

// Modificar cantidad directamente en la tabla
function modificarCantidadItemCotizacion(prodId, nuevaCant) {
    const cant = parseInt(nuevaCant);
    if (isNaN(cant) || cant <= 0) return;
    const item = itemsCotizacion.find(i => i.producto_id === prodId);
    if (item) {
        item.cantidad = cant;
        actualizarTotalesCotizacion();
    }
}

// Modificar precio directamente en la tabla (Precio Manual Directo)
function modificarPrecioItemCotizacion(prodId, nuevoPrecio) {
    const precio = parseFloat(nuevoPrecio);
    if (isNaN(precio) || precio < 0) return;
    const item = itemsCotizacion.find(i => i.producto_id === prodId);
    if (item) {
        item.precio_cotizado = precio;
        actualizarTotalesCotizacion();
    }
}

// Renderizar la tabla de ítems de la cotización actual
function renderTablaItemsCotizacion() {
    const tbody = document.getElementById('cot-items-body');
    if (!tbody) return;

    if (itemsCotizacion.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:48px; color:var(--text-muted);">
                    No hay productos agregados en esta cotización.
                </td>
            </tr>
        `;
        actualizarTotalesCotizacion();
        return;
    }

    const cotMoneda = document.getElementById('cot-moneda').value;

    tbody.innerHTML = itemsCotizacion.map(item => {
        // Conversión de moneda si el producto tiene diferente moneda a la cotización
        let precioRef = item.precio_cotizado;
        if (item.moneda_origen !== cotMoneda) {
            if (cotMoneda === 'USD' && item.moneda_origen === 'PEN') {
                precioRef = item.precio_cotizado / tipoCambioActual;
            } else if (cotMoneda === 'PEN' && item.moneda_origen === 'USD') {
                precioRef = item.precio_cotizado * tipoCambioActual;
            }
        }

        const descuentoMonto = precioRef * (item.descuento / 100);
        const precioConDesc = precioRef - descuentoMonto;
        const subtotal = precioConDesc * item.cantidad;

        const labelGarantia = item.meses_garantia > 0 
            ? `<span class="badge badge-info" style="font-size:0.75rem;">${item.meses_garantia} meses</span>`
            : `<span style="font-size:0.75rem; color:var(--text-muted);">Sin G.</span>`;

        return `
            <tr>
                <td>
                    <div style="font-weight:600;">${item.nombre}</div>
                    ${item.detalles_tecnicos ? `<div style="font-size:0.75rem; color:var(--text-muted); line-height:1.2;">${item.detalles_tecnicos}</div>` : ''}
                </td>
                <td style="text-align:center;">
                    <input type="number" min="1" class="form-input" style="width:60px; text-align:center; padding:4px;" value="${item.cantidad}" onchange="modificarCantidadItemCotizacion(${item.producto_id}, this.value)">
                </td>
                <td style="text-align:right; font-weight:600;">
                    <div style="display:flex; align-items:center; justify-content:flex-end;">
                        <span style="font-size:0.8rem; color:var(--text-muted); margin-right:4px;">${cotMoneda === 'USD' ? '$' : 'S/'}</span>
                        <input type="number" step="0.01" min="0" class="form-input font-bold" style="width:80px; text-align:right; padding:4px;" value="${precioRef.toFixed(2)}" onchange="modificarPrecioItemCotizacion(${item.producto_id}, this.value)">
                    </div>
                </td>
                <td style="text-align:right; color:var(--color-warning); font-size:0.85rem;">${item.descuento}%</td>
                <td style="text-align:center;">${labelGarantia}</td>
                <td style="text-align:right; font-weight:700; color:var(--color-success);">${formatCurrency(subtotal, cotMoneda)}</td>
                <td style="text-align:center;">
                    <button class="btn btn-secondary btn-icon" style="color:var(--color-danger); border-color:rgba(239,68,68,0.15); height:26px; width:26px;" onclick="eliminarItemCotizacion(${item.producto_id})" title="Remover"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
    actualizarTotalesCotizacion();
}

// Calcular y pintar totales consolidados
function actualizarTotalesCotizacion() {
    const desglosar = document.getElementById('cot-desglosar-igv').checked;
    const cotMoneda = document.getElementById('cot-moneda').value;

    let totalConsolidado = 0.0;
    itemsCotizacion.forEach(item => {
        let precioRef = item.precio_cotizado;
        if (item.moneda_origen !== cotMoneda) {
            if (cotMoneda === 'USD' && item.moneda_origen === 'PEN') {
                precioRef = item.precio_cotizado / tipoCambioActual;
            } else if (cotMoneda === 'PEN' && item.moneda_origen === 'USD') {
                precioRef = item.precio_cotizado * tipoCambioActual;
            }
        }
        const descMonto = precioRef * (item.descuento / 100);
        const precioConDesc = precioRef - descMonto;
        totalConsolidado += precioConDesc * item.cantidad;
    });

    let subtotal = 0.0;
    let igv = 0.0;
    let total = totalConsolidado;

    if (desglosar) {
        subtotal = totalConsolidado / 1.18;
        igv = totalConsolidado - subtotal;
    } else {
        subtotal = totalConsolidado;
        igv = 0.0;
    }

    document.getElementById('cot-val-subtotal').textContent = formatCurrency(subtotal, cotMoneda);
    document.getElementById('cot-val-igv').textContent = formatCurrency(igv, cotMoneda);
    document.getElementById('cot-val-total').textContent = formatCurrency(total, cotMoneda);
}

// Obtener datos del cliente ingresados en la vista
function obtenerDatosCliente() {
    const isManual = document.getElementById('cot-cliente-manual-toggle').checked;
    if (isManual) {
        const nombre = document.getElementById('cot-cliente-nombre').value.trim();
        if (!nombre) {
            mostrarToast("Ingrese el nombre del cliente manual.", "warning");
            document.getElementById('cot-cliente-nombre').focus();
            return null;
        }
        return {
            nombre: nombre,
            documento_tipo: document.getElementById('cot-cliente-tipo-doc').value,
            documento_identidad: document.getElementById('cot-cliente-nro-doc').value.trim() || 'Sin documento',
            direccion: document.getElementById('cot-cliente-direccion').value.trim() || 'No especificada',
            telefono: document.getElementById('cot-cliente-telefono').value.trim() || '',
            email: document.getElementById('cot-cliente-email').value.trim() || ''
        };
    } else {
        const clienteIdVal = document.getElementById('cot-cliente-select').value;
        const clienteObj = clientesCotizacion.find(c => c.id == clienteIdVal);
        if (!clienteObj) {
            mostrarToast("Seleccione un cliente registrado.", "warning");
            return null;
        }
        return {
            nombre: clienteObj.nombre_razon_social,
            documento_tipo: clienteObj.tipo_documento,
            documento_identidad: clienteObj.documento_identidad || 'Sin documento',
            direccion: clienteObj.direccion || 'No especificada',
            telefono: clienteObj.telefono || '',
            email: clienteObj.email || ''
        };
    }
}

// Generar proforma en PDF
async function generarPDFCotizacion() {
    if (itemsCotizacion.length === 0) {
        mostrarToast("Agregue al menos un producto para cotizar.", "warning");
        return;
    }

    const cliente = obtenerDatosCliente();
    if (!cliente) return; // Validación falló

    try {
        // Cargar logo e info de la empresa
        const resConfig = await fetch(`${API_URL}/api/config`);
        const config = await resConfig.json();

        // Convertir el logo a Base64 para evitar problemas de CORS y bloqueos de html2canvas
        let logoBase64 = null;
        if (config.logo_path) {
            logoBase64 = await imageToBase64(`${API_URL}${config.logo_path}`);
        }

        const cotMoneda = document.getElementById('cot-moneda').value;
        const validez = parseInt(document.getElementById('cot-validez').value) || 7;
        const entrega = document.getElementById('cot-entrega').value.trim();
        const formaPago = document.getElementById('cot-forma-pago').value.trim();
        const notas = document.getElementById('cot-notas').value.trim();
        const desglosar = document.getElementById('cot-desglosar-igv').checked;

        // Generar Nro correlativo ficticio local para la proforma
        const correlativo = 'COT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900) + 100);

        // Calcular importes finales
        let subtotalTotal = 0.0;
        itemsCotizacion.forEach(item => {
            let precioRef = item.precio_cotizado;
            if (item.moneda_origen !== cotMoneda) {
                if (cotMoneda === 'USD' && item.moneda_origen === 'PEN') {
                    precioRef = item.precio_cotizado / tipoCambioActual;
                } else if (cotMoneda === 'PEN' && item.moneda_origen === 'USD') {
                    precioRef = item.precio_cotizado * tipoCambioActual;
                }
            }
            const descMonto = precioRef * (item.descuento / 100);
            const precioConDesc = precioRef - descMonto;
            subtotalTotal += precioConDesc * item.cantidad;
        });

        let subtotalNeto = 0.0;
        let igv = 0.0;
        let total = subtotalTotal;

        if (desglosar) {
            subtotalNeto = subtotalTotal / 1.18;
            igv = subtotalTotal - subtotalNeto;
        } else {
            subtotalNeto = subtotalTotal;
            igv = 0.0;
        }

        // Crear contenedor HTML para imprimir
        const printContainer = document.createElement('div');
        printContainer.style.padding = '32px';
        printContainer.style.backgroundColor = 'white';
        printContainer.style.color = '#1f2937';
        printContainer.style.fontFamily = "'Inter', sans-serif";
        printContainer.style.fontSize = '12px';
        printContainer.style.lineHeight = '1.6';

        // Estilos e imagen de cabecera
        let logoHtml = `<div style="width: 54px; height: 54px; border-radius: 6px; background-color: #4f46e5; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800;">${config.empresa_nombre ? config.empresa_nombre.substring(0, 2).toUpperCase() : 'EG'}</div>`;
        if (logoBase64) {
            logoHtml = `<img src="${logoBase64}" style="width: auto; height: 56px; max-width: 180px; object-fit: contain;" />`;
        }

        printContainer.innerHTML = `
            <!-- Encabezado con Logo y Datos de la Empresa -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px;">
                <div style="flex: 1;">
                    <div style="margin-bottom: 8px;">${logoHtml}</div>
                    <h1 style="font-size: 18px; font-weight: 800; color: #1e1b4b; margin: 0 0 4px;">${config.empresa_nombre || 'Negocio Local'}</h1>
                    <p style="margin: 0; color: #4b5563; font-size: 11px;">RUC: ${config.empresa_ruc || '00000000000'}</p>
                    <p style="margin: 2px 0 0; color: #4b5563; font-size: 11px;">Dirección: ${config.empresa_direccion || 'Dirección local'}</p>
                    <p style="margin: 2px 0 0; color: #4b5563; font-size: 11px;">Teléfono: ${config.empresa_telefono || ''} ${config.empresa_email ? `| Email: ${config.empresa_email}` : ''}</p>
                </div>
                <div style="border: 2px solid #4f46e5; padding: 18px 24px; border-radius: 8px; text-align: center; min-width: 200px; background-color: #faf5ff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <h2 style="font-size: 14px; margin: 0 0 4px; font-weight: 800; color: #4f46e5; letter-spacing: 0.5px;">COTIZACIÓN</h2>
                    <p style="font-size: 16px; font-weight: 700; margin: 0 0 6px; font-family: monospace; color: #1f2937;">${correlativo}</p>
                    <p style="font-size: 10px; margin: 0; color: #6b7280; font-weight: 600;">Fecha: ${new Date().toLocaleDateString('es-PE')}</p>
                </div>
            </div>

            <!-- Bloque de Información del Cliente e Información de Oferta -->
            <div style="display: flex; gap: 24px; margin-bottom: 28px;">
                <div style="flex: 1.2; background-color: #f9fafb; padding: 14px 18px; border-radius: 6px; border: 1px solid #f3f4f6;">
                    <h3 style="font-size: 10px; text-transform: uppercase; color: #4f46e5; font-weight: 800; margin: 0 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; letter-spacing: 0.5px;">Información del Cliente</h3>
                    <p style="margin: 0; font-size: 13px; font-weight: 700; color: #111827;">${cliente.nombre}</p>
                    <p style="margin: 4px 0 0; color: #4b5563;">${cliente.documento_tipo}: <strong>${cliente.documento_identidad}</strong></p>
                    <p style="margin: 4px 0 0; color: #4b5563;">Dirección: ${cliente.direccion}</p>
                    ${cliente.telefono ? `<p style="margin: 2px 0 0; color: #4b5563;">Teléfono: ${cliente.telefono}</p>` : ''}
                    ${cliente.email ? `<p style="margin: 2px 0 0; color: #4b5563;">Email: ${cliente.email}</p>` : ''}
                </div>
                <div style="flex: 0.8; background-color: #f9fafb; padding: 14px 18px; border-radius: 6px; border: 1px solid #f3f4f6;">
                    <h3 style="font-size: 10px; text-transform: uppercase; color: #4f46e5; font-weight: 800; margin: 0 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; letter-spacing: 0.5px;">Condiciones Comerciales</h3>
                    <p style="margin: 0; color: #4b5563;">Validez: <strong>${validez} días</strong></p>
                    <p style="margin: 4px 0 0; color: #4b5563;">Moneda: <strong>${cotMoneda === 'USD' ? 'Dólares Americanos (USD)' : 'Nuevos Soles (PEN)'}</strong></p>
                    <p style="margin: 4px 0 0; color: #4b5563;">Tiempo Entrega: <strong>${entrega}</strong></p>
                    <p style="margin: 4px 0 0; color: #4b5563;">Forma de Pago: <strong>${formaPago}</strong></p>
                </div>
            </div>

            <!-- Tabla de Ítems -->
            <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 24px; font-size: 11px;">
                <thead>
                    <tr style="background-color: #4f46e5; color: white;">
                        <th style="padding: 10px 12px; font-weight: 700; border-top-left-radius: 4px; border-bottom-left-radius: 4px;">Ítem / Descripción</th>
                        <th style="padding: 10px 6px; font-weight: 700; text-align: center; width: 60px;">Cant.</th>
                        <th style="padding: 10px 12px; font-weight: 700; text-align: right; width: 100px;">P. Unit (${cotMoneda})</th>
                        <th style="padding: 10px 6px; font-weight: 700; text-align: center; width: 80px;">Desc.</th>
                        <th style="padding: 10px 10px; font-weight: 700; text-align: center; width: 80px;">Garantía</th>
                        <th style="padding: 10px 12px; font-weight: 700; text-align: right; width: 100px; border-top-right-radius: 4px; border-bottom-right-radius: 4px;">Total (${cotMoneda})</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsCotizacion.map((item, idx) => {
                        let precioRef = item.precio_cotizado;
                        if (item.moneda_origen !== cotMoneda) {
                            if (cotMoneda === 'USD' && item.moneda_origen === 'PEN') {
                                precioRef = item.precio_cotizado / tipoCambioActual;
                            } else if (cotMoneda === 'PEN' && item.moneda_origen === 'USD') {
                                precioRef = item.precio_cotizado * tipoCambioActual;
                            }
                        }

                        const descMonto = precioRef * (item.descuento / 100);
                        const precioFinal = precioRef - descMonto;
                        const sub = precioFinal * item.cantidad;

                        return `
                            <tr style="border-bottom: 1px solid #e5e7eb; background-color: ${idx % 2 === 0 ? 'white' : '#fcfcfd'};">
                                <td style="padding: 10px 12px; vertical-align: top;">
                                    <div style="font-weight: 700; color: #111827;">${item.nombre}</div>
                                    ${item.detalles_tecnicos ? `<div style="font-size: 9px; color: #6b7280; margin-top: 2px; line-height: 1.3;">${item.detalles_tecnicos}</div>` : ''}
                                </td>
                                <td style="padding: 10px 6px; text-align: center; font-weight: 600; vertical-align: top;">${item.cantidad}</td>
                                <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size:11px; vertical-align: top;">${precioRef.toFixed(2)}</td>
                                <td style="padding: 10px 6px; text-align: center; color: #b45309; font-weight: 600; vertical-align: top;">${item.descuento > 0 ? `${item.descuento}%` : '-'}</td>
                                <td style="padding: 10px 10px; text-align: center; vertical-align: top;">${item.meses_garantia > 0 ? `${item.meses_garantia} meses` : 'Sin garantía'}</td>
                                <td style="padding: 10px 12px; text-align: right; font-weight: 700; font-family: monospace; font-size:11px; vertical-align: top;">${sub.toFixed(2)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <!-- Tabla de Sumatorias e Información Adicional -->
            <div style="display: flex; gap: 24px; font-size: 11px;">
                <!-- Notas y Cuentas Bancarias -->
                <div style="flex: 1.1;">
                    ${notas ? `
                        <div style="background-color: #fafafa; padding: 10px 14px; border-radius: 4px; border: 1px solid #e5e7eb; margin-bottom: 12px;">
                            <strong style="color: #4f46e5; text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 4px;">Términos y Observaciones:</strong>
                            <p style="margin: 0; white-space: pre-line; line-height: 1.4; color: #4b5563; font-size: 10px;">${notas}</p>
                        </div>
                    ` : ''}
                </div>

                <!-- Totales Consolidados -->
                <div style="flex: 0.9; display: flex; flex-direction: column; gap: 4px; align-self: flex-start;">
                    ${desglosar ? `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
                            <span style="color: #6b7280;">Subtotal Neto (Sin IGV)</span>
                            <span style="font-weight: 700; font-family: monospace;">${formatCurrency(subtotalNeto, cotMoneda)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
                            <span style="color: #6b7280;">IGV Gravado (18.00%)</span>
                            <span style="font-weight: 700; font-family: monospace;">${formatCurrency(igv, cotMoneda)}</span>
                        </div>
                    ` : `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f3f4f6;">
                            <span style="color: #6b7280;">Subtotal Neto</span>
                            <span style="font-weight: 700; font-family: monospace;">${formatCurrency(total, cotMoneda)}</span>
                        </div>
                    `}
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; font-weight: 800; color: #4f46e5; border-top: 1px solid #e5e7eb;">
                        <span>Importe Total</span>
                        <span style="font-family: monospace;">${formatCurrency(total, cotMoneda)}</span>
                    </div>
                </div>
            </div>

            <!-- Firmas y Cierre -->
            <div style="margin-top: 60px; text-align: center;">
                <div style="display: flex; justify-content: space-around; margin-bottom: 30px;">
                    <div style="width: 180px; border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 10px; color: #4b5563;">
                        <strong>Elaborado por</strong><br>
                        ${usuarioActivo.nombre}
                    </div>
                    <div style="width: 180px; border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 10px; color: #4b5563;">
                        <strong>Aceptado por el Cliente</strong><br>
                        Firma y Sello
                    </div>
                </div>
                <p style="margin: 0; color: #9ca3af; font-size: 9px;">Esta proforma tiene carácter comercial y no constituye un comprobante de pago electrónico obligatorio.</p>
                <p style="margin: 4px 0 0; color: #4f46e5; font-weight: 700; font-size: 10px;">¡Gracias por confiar en nosotros!</p>
            </div>
        `;

        // Opciones de html2pdf
        const opt = {
            margin:       10,
            filename:     `${correlativo}.pdf`,
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
        printContainer.style.zIndex = '1';
        document.body.appendChild(printContainer);
        
        try {
            // Generar descarga PDF de forma asíncrona
            await html2pdf().set(opt).from(printContainer).save();
        } finally {
            printContainer.remove();
        }
        
        mostrarToast("PDF de Cotización descargado con éxito.", "success");

        // Guardar en Historial local
        guardarCotizacionEnHistorial(correlativo, cliente.nombre, cotMoneda, total, validez);
        
    } catch (err) {
        console.error("Fallo al exportar PDF de Cotización:", err);
        mostrarToast("No se pudo generar la cotización en PDF.", "danger");
    }
}

// Guardar cotización en LocalStorage
function guardarCotizacionEnHistorial(nro, cliente, moneda, total, validez) {
    try {
        const historial = JSON.parse(localStorage.getItem('cotizaciones_historial') || '[]');
        
        historial.unshift({
            nro: nro,
            fecha: new Date().toLocaleString('es-PE'),
            cliente: cliente,
            moneda: moneda,
            total: total,
            validez: validez,
            items: [...itemsCotizacion] // Clonamos los items por si se quiere volver a consultar
        });

        // Limitar historial local a 20 registros
        if (historial.length > 20) {
            historial.pop();
        }

        localStorage.setItem('cotizaciones_historial', JSON.stringify(historial));
        renderHistorialCotizaciones();
    } catch (err) {
        console.error("Error al persistir historial de cotizaciones:", err);
    }
}

// Cargar y mostrar historial de localStorage
function renderHistorialCotizaciones() {
    const tbody = document.getElementById('cot-historial-body');
    if (!tbody) return;

    try {
        const historial = JSON.parse(localStorage.getItem('cotizaciones_historial') || '[]');
        
        if (historial.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:16px; color:var(--text-muted);">
                        No hay cotizaciones registradas localmente en esta sesión.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = historial.map(c => {
            return `
                <tr>
                    <td style="font-family:monospace; font-weight:700; color:var(--color-primary);">${c.nro}</td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${c.fecha}</td>
                    <td style="font-weight:600;">${c.cliente}</td>
                    <td><span class="badge badge-info" style="font-size:0.75rem;">${c.moneda}</span></td>
                    <td style="text-align:right; font-weight:700; color:var(--color-success);">${formatCurrency(c.total, c.moneda)}</td>
                    <td>${c.validez} días</td>
                    <td style="text-align:center;">
                        <div style="display:flex; justify-content:center; gap:8px;">
                            <button class="btn btn-secondary btn-icon" style="height:28px; width:28px;" onclick="cargarCotizacionLocal('${c.nro}')" title="Cargar/Editar en mesa"><i data-lucide="edit-2" style="width:14px; height:14px;"></i></button>
                            <button class="btn btn-secondary btn-icon" style="color:var(--color-danger); border-color:rgba(239,68,68,0.15); height:28px; width:28px;" onclick="eliminarCotizacionLocal('${c.nro}')" title="Eliminar"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        console.error("Error al renderizar historial local:", err);
    }
}

// Cargar una cotización previa de nuevo en la mesa de trabajo
function cargarCotizacionLocal(nro) {
    try {
        const historial = JSON.parse(localStorage.getItem('cotizaciones_historial') || '[]');
        const cot = historial.find(c => c.nro === nro);
        
        if (cot) {
            itemsCotizacion = [...cot.items];
            
            // Establecer campos de la proforma
            document.getElementById('cot-moneda').value = cot.moneda;
            document.getElementById('cot-validez').value = cot.validez;
            
            // Forzar el trigger de cambio de moneda para actualizar símbolos de inputs
            const event = new Event('change');
            document.getElementById('cot-moneda').dispatchEvent(event);
            
            // Cargar datos del cliente manual
            const toggleManual = document.getElementById('cot-cliente-manual-toggle');
            toggleManual.checked = true;
            toggleManual.dispatchEvent(event);
            document.getElementById('cot-cliente-nombre').value = cot.cliente;

            renderTablaItemsCotizacion();
            mostrarToast(`Cotización ${nro} cargada con éxito en la mesa de trabajo.`, "success");
        }
    } catch (err) {
        console.error("Error al cargar cotización local:", err);
        mostrarToast("No se pudo cargar la cotización.", "danger");
    }
}

// Eliminar cotización del historial de localStorage
function eliminarCotizacionLocal(nro) {
    if (!confirm(`¿Desea eliminar la cotización ${nro} del historial de esta sesión?`)) return;

    try {
        let historial = JSON.parse(localStorage.getItem('cotizaciones_historial') || '[]');
        historial = historial.filter(c => c.nro !== nro);
        localStorage.setItem('cotizaciones_historial', JSON.stringify(historial));
        
        renderHistorialCotizaciones();
        mostrarToast(`Cotización ${nro} eliminada del historial.`, "info");
    } catch (err) {
        console.error("Error al eliminar cotización local:", err);
    }
}
