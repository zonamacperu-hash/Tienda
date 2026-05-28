/* ==============================================================================
   MÓDULO: COMPRAS (Abastecimiento de Mercadería y Registro de Series)
   ============================================================================== */

let carritoCompra = [];
let proveedoresDisponibles = [];
let productosDisponibles = [];

async function renderCompras(container) {
    container.innerHTML = `
        <div class="pos-layout">
            <!-- Panel Izquierdo: Formularios de Transacción y Productos -->
            <div class="pos-catalog" style="overflow-y:auto; padding-right:8px;">
                <div class="card">
                    <div class="card-title">Datos del Abastecimiento</div>
                    <form id="form-compra-cabecera">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Proveedor</label>
                                <select class="form-select" id="compra-proveedor" required>
                                    <option value="" disabled selected>Seleccione Proveedor</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Comprobante</label>
                                <select class="form-select" id="compra-tipo-comprobante" required>
                                    <option value="Factura" selected>Factura</option>
                                    <option value="Boleta">Boleta</option>
                                    <option value="Guia de Remision">Guía de Remisión</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Serie</label>
                                <input type="text" class="form-input" id="compra-serie" placeholder="Ej: F001" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Correlativo</label>
                                <input type="text" class="form-input" id="compra-correlativo" placeholder="Ej: 000123" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Moneda</label>
                                <select class="form-select" id="compra-moneda" required>
                                    <option value="PEN" selected>Soles (PEN)</option>
                                    <option value="USD">Dólares (USD)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Tipo de Cambio Utilizado</label>
                                <input type="number" step="0.0001" class="form-input" id="compra-tc" value="${tipoCambioActual}" required>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Método de Pago</label>
                                <select class="form-select" id="compra-metodo-pago" required>
                                    <option value="Contado" selected>Contado</option>
                                    <option value="Credito">Crédito</option>
                                </select>
                            </div>
                            <div class="form-group" id="compra-vencimiento-wrapper" style="display:none;">
                                <label class="form-label">Fecha Vencimiento</label>
                                <input type="date" class="form-input" id="compra-fecha-vencimiento">
                            </div>
                        </div>
                    </form>
                </div>

                <div class="card" style="margin-top:16px;">
                    <div class="card-title">Añadir Ítem al Abastecimiento</div>
                    <div class="form-row" style="align-items:flex-end;">
                        <div class="form-group" style="flex:2;">
                            <label class="form-label">Seleccionar Producto</label>
                            <select class="form-select" id="compra-select-producto">
                                <option value="" disabled selected>Seleccione Producto</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Cantidad</label>
                            <input type="number" min="1" class="form-input" id="compra-cantidad" value="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Costo Unitario (Moneda Base S/)</label>
                            <input type="number" step="0.01" min="0" class="form-input" id="compra-costo-unitario" value="0.00">
                        </div>
                        <div class="form-group" style="margin-bottom:20px;">
                            <button class="btn btn-primary" id="btn-compra-agregar-item" type="button">Añadir</button>
                        </div>
                    </div>
                    
                    <!-- Contenedor dinámico de captura de series físicas para compras -->
                    <div id="compra-series-capture-container" style="display:none; border-top:1px dashed var(--border-color); padding-top:16px; margin-top:12px;">
                        <div style="font-weight:700; font-size:0.85rem; color:var(--color-info); margin-bottom:10px;">
                            Captura de Números de Serie Únicos (Requerido para este producto)
                        </div>
                        <div id="compra-series-inputs-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px;">
                            <!-- Los inputs se cargan dinámicamente -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Panel Derecho: Detalle del Carrito de Abastecimiento -->
            <div class="pos-cart-panel">
                <div class="cart-header">
                    <span>Lista de Ítems</span>
                    <button class="clear-cart" id="btn-compra-limpiar-lista">Limpiar Todo</button>
                </div>

                <div class="cart-items" id="compra-carrito-items">
                    <div class="empty-list-message" style="margin-top:32px;">Agregue productos al abastecimiento.</div>
                </div>

                <div class="cart-summary">
                    <div class="summary-row" id="compra-subtotal-row">
                        <span id="compra-subtotal-label">Subtotal Neto</span>
                        <span id="compra-resumen-subtotal">S/ 0.00</span>
                    </div>
                    <div class="summary-row" id="compra-igv-row">
                        <span>IGV (18%)</span>
                        <span id="compra-resumen-igv">S/ 0.00</span>
                    </div>
                    <div class="summary-row total">
                        <span>Total de Compra</span>
                        <span id="compra-resumen-total">S/ 0.00</span>
                    </div>
                    <button class="btn btn-success checkout-btn" id="btn-compra-procesar">
                        <i data-lucide="shield-check"></i> Procesar Abastecimiento
                    </button>
                </div>
            </div>
        </div>

        <!-- Sección de Historial de Compras -->
        <div class="card" style="margin-top:24px;">
            <div class="card-title">Historial de Compras (Últimos ingresos)</div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Proveedor</th>
                            <th>Comprobante</th>
                            <th>Fecha</th>
                            <th>Moneda</th>
                            <th style="text-align:right;">Subtotal</th>
                            <th style="text-align:right;">IGV</th>
                            <th style="text-align:right;">Total</th>
                            <th>Estado</th>
                            <th style="text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="historial-compras-body">
                        <tr>
                            <td colspan="10" style="text-align:center; padding:24px; color:var(--text-muted);">Cargando historial de compras...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Cargar Catálogos
    await inicializarCatalogosCompra();
    cargarHistorialCompras();

    // Eventos
    document.getElementById('compra-metodo-pago').addEventListener('change', (e) => {
        const wrapper = document.getElementById('compra-vencimiento-wrapper');
        const input = document.getElementById('compra-fecha-vencimiento');
        if (e.target.value === 'Credito') {
            wrapper.style.display = 'block';
            input.setAttribute('required', 'true');
        } else {
            wrapper.style.display = 'none';
            input.removeAttribute('required');
        }
    });

    document.getElementById('compra-tipo-comprobante').addEventListener('change', () => {
        validarProveedorRUC();
        actualizarTotalesCompra();
    });
    document.getElementById('compra-proveedor').addEventListener('change', () => {
        validarProveedorRUC();
    });

    document.getElementById('compra-select-producto').addEventListener('change', manejarCambioProductoSeleccionado);
    document.getElementById('compra-cantidad').addEventListener('input', manejarCambioCantidadProducto);
    document.getElementById('btn-compra-agregar-item').addEventListener('click', agregarItemAlCarritoCompra);
    document.getElementById('btn-compra-limpiar-lista').addEventListener('click', limpiarCarritoCompra);
    document.getElementById('btn-compra-procesar').addEventListener('click', procesarAbastecimiento);

    // Eventos de moneda y tipo de cambio
    const selectMonedaCompra = document.getElementById('compra-moneda');
    if (selectMonedaCompra) {
        selectMonedaCompra.addEventListener('change', () => {
            const moneda = selectMonedaCompra.value;
            const symbol = moneda === 'USD' ? '$' : 'S/';
            const inputCosto = document.getElementById('compra-costo-unitario');
            if (inputCosto) {
                const label = inputCosto.previousElementSibling;
                if (label) label.textContent = `Costo Unitario (${symbol})`;
            }
            const prodSelect = document.getElementById('compra-select-producto');
            if (prodSelect && prodSelect.value) {
                manejarCambioProductoSeleccionado({ target: prodSelect });
            }
            renderCarritoCompra();
        });
    }

    const inputTcCompra = document.getElementById('compra-tc');
    if (inputTcCompra) {
        inputTcCompra.addEventListener('input', () => {
            const prodSelect = document.getElementById('compra-select-producto');
            if (prodSelect && prodSelect.value) {
                manejarCambioProductoSeleccionado({ target: prodSelect });
            }
        });
    }

    lucide.createIcons();
}

async function inicializarCatalogosCompra() {
    try {
        // Cargar Proveedores
        const resProv = await fetch(`${API_URL}/api/actores?tipo=Proveedor`);
        proveedoresDisponibles = await resProv.json();
        
        const provSelect = document.getElementById('compra-proveedor');
        provSelect.innerHTML = '<option value="" disabled selected>Seleccione Proveedor</option>' + 
            proveedoresDisponibles.map(p => `<option value="${p.id}">${p.nombre_razon_social} (${p.documento_identidad})</option>`).join('');

        // Cargar Productos
        const resProds = await fetch(`${API_URL}/api/productos`);
        productosDisponibles = await resProds.json();
        
        const prodSelect = document.getElementById('compra-select-producto');
        prodSelect.innerHTML = '<option value="" disabled selected>Seleccione Producto</option>' + 
            productosDisponibles.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');

    } catch (err) {
        console.error(err);
    }
}

function manejarCambioProductoSeleccionado(e) {
    const prodId = parseInt(e.target.value);
    if (!prodId) return;
    const prod = productosDisponibles.find(p => p.id === prodId);
    
    if (prod) {
        // Poner el costo/precio base por defecto con la conversión de moneda
        const tcInput = document.getElementById('compra-tc');
        const tc = tcInput ? parseFloat(tcInput.value) : tipoCambioActual;
        const monedaCompra = document.getElementById('compra-moneda').value;
        const monedaProd = prod.moneda || 'PEN';
        
        let costoSugerido = prod.precio_base;
        if (monedaProd !== monedaCompra) {
            if (monedaCompra === 'USD' && monedaProd === 'PEN') {
                costoSugerido = prod.precio_base / tc;
            } else if (monedaCompra === 'PEN' && monedaProd === 'USD') {
                costoSugerido = prod.precio_base * tc;
            }
        }
        document.getElementById('compra-costo-unitario').value = costoSugerido.toFixed(2);
        manejarCapturaSeries(prod);
    }
}

function manejarCambioCantidadProducto() {
    const prodSelect = document.getElementById('compra-select-producto');
    const prodId = parseInt(prodSelect.value);
    const prod = productosDisponibles.find(p => p.id === prodId);
    if (prod) {
        manejarCapturaSeries(prod);
    }
}

function manejarCapturaSeries(producto) {
    const qty = parseInt(document.getElementById('compra-cantidad').value);
    const container = document.getElementById('compra-series-capture-container');
    const inputsGrid = document.getElementById('compra-series-inputs-grid');
    
    if (producto.maneja_series === 1 && qty > 0) {
        container.style.display = 'block';
        inputsGrid.innerHTML = '';
        inputsGrid.style.display = 'flex';
        inputsGrid.style.flexDirection = 'column';
        inputsGrid.style.gap = '10px';
        
        for (let i = 0; i < qty; i++) {
            inputsGrid.innerHTML += `
                <div style="display:flex; flex-direction:column; gap:4px; padding:10px; border:1px solid var(--border-color); border-radius:6px; background-color:var(--bg-card-hover);">
                    <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted);">Unidad física #${i+1}</div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <div style="flex:1; min-width:140px; margin-bottom:0;" class="form-group">
                            <input type="text" class="form-input compra-serie-input" placeholder="Número de Serie" style="font-family:monospace; padding:6px 10px; font-size:0.85rem;" required>
                        </div>
                        <div style="flex:1.5; min-width:200px; margin-bottom:0;" class="form-group">
                            <input type="text" class="form-input compra-detalle-fisico-input" placeholder="Detalle físico (Opcional)" style="padding:6px 10px; font-size:0.85rem;">
                        </div>
                    </div>
                </div>
            `;
        }
    } else {
        container.style.display = 'none';
        inputsGrid.innerHTML = '';
    }
}

function agregarItemAlCarritoCompra() {
    const prodSelect = document.getElementById('compra-select-producto');
    const prodId = parseInt(prodSelect.value);
    if (!prodId) {
        mostrarToast("Seleccione un producto para añadir.", "warning");
        return;
    }

    const prod = productosDisponibles.find(p => p.id === prodId);
    const qty = parseInt(document.getElementById('compra-cantidad').value);
    const costoUn = parseFloat(document.getElementById('compra-costo-unitario').value);

    if (qty <= 0) {
        mostrarToast("La cantidad debe ser mayor a cero.", "warning");
        return;
    }

    let series = [];
    if (prod.maneja_series === 1) {
        const inputs = document.querySelectorAll('.compra-serie-input');
        const detailInputs = document.querySelectorAll('.compra-detalle-fisico-input');
        let completas = true;
        
        for (let i = 0; i < inputs.length; i++) {
            const sn = inputs[i].value.trim();
            const det = detailInputs[i] ? detailInputs[i].value.trim() : '';
            if (!sn) {
                completas = false;
                inputs[i].focus();
                break;
            } else {
                series.push({
                    numero_serie: sn,
                    detalles_individuales: det
                });
            }
        }

        if (!completas || series.length !== qty) {
            mostrarToast("Debe registrar todos los números de serie.", "warning");
            return;
        }

        // Validar series duplicadas en el mismo ingreso
        const seriesSet = new Set(series.map(s => s.numero_serie));
        if (seriesSet.size !== series.length) {
            mostrarToast("Hay números de serie duplicados en el listado.", "warning");
            return;
        }
    }

    // Agregar al carrito
    carritoCompra.push({
        producto_id: prod.id,
        nombre: prod.nombre,
        cantidad: qty,
        precio_unitario: costoUn,
        maneja_series: prod.maneja_series,
        series: series
    });

    renderCarritoCompra();
    
    // Resetear formulario de ítem
    prodSelect.value = '';
    document.getElementById('compra-cantidad').value = 1;
    document.getElementById('compra-costo-unitario').value = '0.00';
    document.getElementById('compra-series-capture-container').style.display = 'none';
    document.getElementById('compra-series-inputs-grid').innerHTML = '';
}

function renderCarritoCompra() {
    const container = document.getElementById('compra-carrito-items');
    
    if (carritoCompra.length === 0) {
        container.innerHTML = '<div class="empty-list-message" style="margin-top:32px;">Agregue productos al abastecimiento.</div>';
        actualizarTotalesCompra();
        return;
    }

    const monedaCompra = document.getElementById('compra-moneda').value;

    container.innerHTML = carritoCompra.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-header">
                <div class="cart-item-name">${item.nombre}</div>
                <button class="remove-cart-item" onclick="removerItemCarritoCompra(${index})">&times;</button>
            </div>
            <div class="cart-item-controls">
                <div style="font-size:0.8rem; color:var(--text-muted);">
                    Cantidad: <strong>${item.cantidad} U.</strong> | Costo: <strong>${formatCurrency(item.precio_unitario, monedaCompra)}</strong>
                </div>
                <div class="cart-item-subtotal">
                    ${formatCurrency(item.precio_unitario * item.cantidad, monedaCompra)}
                </div>
            </div>
            ${item.maneja_series === 1 ? `
                <div class="cart-item-meta" style="font-size:0.75rem; color:var(--color-info);">
                    Series: ${item.series.map(s => `
                        <div style="margin-top:2px;">
                            <code style="font-weight:600;">${s.numero_serie}</code>
                            ${s.detalles_individuales ? `<span style="color:var(--text-muted); font-style:italic;"> (${s.detalles_individuales})</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');

    actualizarTotalesCompra();
}

function removerItemCarritoCompra(index) {
    carritoCompra.splice(index, 1);
    renderCarritoCompra();
}

function limpiarCarritoCompra() {
    carritoCompra = [];
    renderCarritoCompra();
}

function validarProveedorRUC() {
    const tipoComp = document.getElementById('compra-tipo-comprobante').value;
    const btnProcesar = document.getElementById('btn-compra-procesar');
    
    if (tipoComp === 'Factura') {
        const provIdVal = document.getElementById('compra-proveedor').value;
        if (!provIdVal) {
            if (btnProcesar) btnProcesar.removeAttribute('disabled');
            return true;
        }
        
        const prov = proveedoresDisponibles.find(p => p.id == provIdVal);
        if (!prov) {
            if (btnProcesar) btnProcesar.removeAttribute('disabled');
            return true;
        }
        
        const docTipo = prov.tipo_documento;
        const docNum = (prov.documento_identidad || '').trim();
        
        if (docTipo !== 'RUC' || docNum.length !== 11 || !/^(10|20)/.test(docNum) || !/^\d+$/.test(docNum)) {
            mostrarToast("El proveedor seleccionado no tiene un RUC válido de 11 dígitos que comience con 10 o 20.", "danger");
            if (btnProcesar) btnProcesar.setAttribute('disabled', 'true');
            return false;
        }
    }
    
    if (btnProcesar) btnProcesar.removeAttribute('disabled');
    return true;
}

function actualizarTotalesCompra() {
    const monedaCompra = document.getElementById('compra-moneda').value;
    const subtotal = carritoCompra.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0.0);
    const total = subtotal;
    
    const tipoComp = document.getElementById('compra-tipo-comprobante').value;
    
    const subtotalLabel = document.getElementById('compra-subtotal-label');
    const igvRow = document.getElementById('compra-igv-row');
    
    if (tipoComp === 'Factura') {
        const subtotalNeto = total / 1.18;
        const igv = total - subtotalNeto;
        
        if (subtotalLabel) subtotalLabel.textContent = 'Subtotal Neto';
        if (igvRow) igvRow.style.display = 'flex';
        
        document.getElementById('compra-resumen-subtotal').textContent = formatCurrency(subtotalNeto, monedaCompra);
        document.getElementById('compra-resumen-igv').textContent = formatCurrency(igv, monedaCompra);
    } else {
        // Boleta o Guía de Remisión
        if (subtotalLabel) subtotalLabel.textContent = 'Subtotal';
        if (igvRow) igvRow.style.display = 'none';
        
        document.getElementById('compra-resumen-subtotal').textContent = formatCurrency(total, monedaCompra);
        document.getElementById('compra-resumen-igv').textContent = formatCurrency(0.00, monedaCompra);
    }

    document.getElementById('compra-resumen-total').textContent = formatCurrency(total, monedaCompra);
}

async function procesarAbastecimiento() {
    if (carritoCompra.length === 0) {
        mostrarToast("No hay ítems en la lista de compras.", "warning");
        return;
    }

    const form = document.getElementById('form-compra-cabecera');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (!validarProveedorRUC()) {
        return;
    }

    const subtotal = carritoCompra.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0.0);
    const total = subtotal;
    
    const tipoComp = document.getElementById('compra-tipo-comprobante').value;
    let subtotalNeto, igv;
    if (tipoComp === 'Factura') {
        subtotalNeto = total / 1.18;
        igv = total - subtotalNeto;
    } else {
        subtotalNeto = total;
        igv = 0.00;
    }

    const payload = {
        proveedor_id: parseInt(document.getElementById('compra-proveedor').value),
        usuario_id: usuarioActivo.id,
        tipo_comprobante: tipoComp,
        serie_comprobante: document.getElementById('compra-serie').value.trim(),
        correlativo_comprobante: document.getElementById('compra-correlativo').value.trim(),
        moneda: document.getElementById('compra-moneda').value,
        tipo_cambio: parseFloat(document.getElementById('compra-tc').value),
        metodo_pago: document.getElementById('compra-metodo-pago').value,
        fecha_vencimiento: document.getElementById('compra-fecha-vencimiento').value || null,
        observaciones: "",
        subtotal: subtotalNeto,
        igv: igv,
        total: total,
        items: carritoCompra
    };

    try {
        const res = await fetch(`${API_URL}/api/compras`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            limpiarCarritoCompra();
            form.reset();
            document.getElementById('compra-tc').value = tipoCambioActual;
            document.getElementById('compra-vencimiento-wrapper').style.display = 'none';
            await cargarHistorialCompras();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error de comunicación con el servidor.", "danger");
    }
}

async function cargarHistorialCompras() {
    const tbody = document.getElementById('historial-compras-body');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/api/compras`);
        const compras = await res.json();

        if (compras.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--text-muted);">No hay compras registradas en el sistema.</td></tr>';
            return;
        }

        tbody.innerHTML = compras.map(c => {
            const estadoBadge = c.estado === 'Completada' 
                ? '<span class="badge badge-success">Completada</span>'
                : '<span class="badge badge-danger">Anulada</span>';
                
            const btnAnular = c.estado === 'Completada'
                ? `<button class="btn btn-secondary btn-icon" style="color:var(--color-danger); border-color:rgba(239,68,68,0.15); height:28px; width:28px;" onclick="anularCompra(${c.id})" title="Anular"><i data-lucide="x-circle" style="width:14px;"></i></button>`
                : '';

            return `
                <tr>
                    <td>${c.id}</td>
                    <td style="font-weight:600;">${c.proveedor_nombre}</td>
                    <td style="font-family:monospace; font-weight:600;">${c.tipo_comprobante} ${c.serie_comprobante}-${c.correlativo_comprobante}</td>
                    <td style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(c.fecha_compra)}</td>
                    <td style="font-weight:700;">${c.moneda}</td>
                    <td style="text-align:right;">${formatCurrency(c.subtotal, c.moneda)}</td>
                    <td style="text-align:right;">${formatCurrency(c.igv, c.moneda)}</td>
                    <td style="text-align:right; font-weight:700; color:var(--color-success);">${formatCurrency(c.total, c.moneda)}</td>
                    <td>${estadoBadge}</td>
                    <td style="text-align:center;">${btnAnular}</td>
                </tr>
            `;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        console.error(err);
    }
}

async function anularCompra(compraId) {
    if (!confirm("¿Está seguro de ANULAR esta compra? Esta acción descontará el stock ingresado y eliminará los números de serie correspondientes si no han sido vendidos.")) return;

    try {
        const res = await fetch(`${API_URL}/api/compras/${compraId}/anular`, { method: 'PUT' });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            await cargarHistorialCompras();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
    }
}
