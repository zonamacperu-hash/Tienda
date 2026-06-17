/* ==============================================================================
   MÓDULO: SERVICIO TÉCNICO Y REPARACIONES (SOPORTE)
   ============================================================================== */

let ordenesSoporte = [];
let actoresClientes = [];
let productosSeriesCatalog = [];
let repuestosDisponibles = [];

// Función Principal para Renderizar la Vista de Soporte Técnico
async function renderSoporte(container) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:24px;">
            
            <!-- 1. Tarjetas Resumen (Colores Pasteles Opacos con Texto Brillante) -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4" id="soporte-summary-cards">
                <!-- Inyectado dinámicamente -->
            </div>

            <!-- 2. Barra de Control (Búsqueda y Creación) -->
            <div class="card" style="padding: 16px 20px;">
                <div class="table-actions" style="margin-bottom:0;">
                    <div class="search-box">
                        <i data-lucide="search" class="search-icon" style="width:16px;"></i>
                        <input type="text" class="form-input" id="soporte-search-input" placeholder="Buscar por cliente, equipo o serie...">
                    </div>
                    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                        <select class="form-select" id="soporte-filter-estado" style="height:40px; padding:0 14px; font-size:0.85rem;">
                            <option value="">Todos los Estados</option>
                            <option value="Recibido">Recibido</option>
                            <option value="En Diagnostico">En Diagnóstico</option>
                            <option value="Reparado">Reparado</option>
                            <option value="No Reparable">No Reparable</option>
                            <option value="Entregado">Entregado</option>
                        </select>
                        <button class="btn btn-primary" onclick="abrirCrearOrdenModal()">
                            <i data-lucide="plus" style="width:16px;"></i> Nueva Orden de Servicio
                        </button>
                    </div>
                </div>
            </div>

            <!-- 3. Tabla de Ordenes de Servicio -->
            <div class="card" style="padding:0; overflow:hidden;">
                <div class="card-title" style="padding:20px 24px 0; margin-bottom:12px;">Ordenes de Servicio Recientes</div>
                <div class="table-container" style="border:none; border-radius:0;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Orden #</th>
                                <th>Cliente</th>
                                <th>Equipo / Modelo</th>
                                <th>Número de Serie</th>
                                <th>Ingreso</th>
                                <th>Entrega</th>
                                <th style="text-align:right;">Mano Obra</th>
                                <th style="text-align:right;">Total</th>
                                <th>Estado</th>
                                <th style="text-align:center; width:140px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="soporte-tabla-body">
                            <tr>
                                <td colspan="10" style="text-align:center; padding:32px; color:var(--text-muted);">Cargando ordenes de servicio...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Cargar Catálogos Iniciales
    await cargarCatálogosSoporte();
    await cargarOrdenesSoporte();

    // Enlazar Eventos de Filtro
    document.getElementById('soporte-search-input').addEventListener('input', filtrarOrdenesSoporte);
    document.getElementById('soporte-filter-estado').addEventListener('change', filtrarOrdenesSoporte);

    lucide.createIcons();
}

// Carga catálogos auxiliares (clientes, productos para repuestos, etc.)
async function cargarCatálogosSoporte() {
    try {
        // Clientes
        const resClientes = await fetch(`${API_URL}/api/actores?tipo=Cliente`);
        actoresClientes = await resClientes.json();

        // Productos de la tienda
        const resProds = await fetch(`${API_URL}/api/productos`);
        const prods = await resProds.json();
        productosSeriesCatalog = prods.filter(p => p.maneja_series === 1);
        repuestosDisponibles = prods;
    } catch (err) {
        console.error("Error al cargar catálogos de soporte:", err);
    }
}

// Obtiene las órdenes de soporte del servidor
async function cargarOrdenesSoporte() {
    const tbody = document.getElementById('soporte-tabla-body');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/api/soporte/ordenes`);
        ordenesSoporte = await res.json();
        
        actualizarTableroMetricas();
        renderTablaOrdenesSoporte(ordenesSoporte);
    } catch (err) {
        console.error("Error al cargar órdenes de soporte:", err);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:20px; color:var(--color-danger);">Error de conexión con el servidor.</td></tr>`;
    }
}

// Renderiza la lista de ordenes en la tabla
function renderTablaOrdenesSoporte(ordenes) {
    const tbody = document.getElementById('soporte-tabla-body');
    if (!tbody) return;

    if (ordenes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:32px; color:var(--text-muted);">No se encontraron órdenes de servicio.</td></tr>`;
        return;
    }

    tbody.innerHTML = ordenes.map(o => {
        let serialToShow = o.numero_serie_externo || '';
        if (o.producto_serie_codigo) {
            serialToShow = `<span class="badge badge-info" style="font-family:monospace; text-transform:none; font-size:0.75rem;" title="Serie Tienda">${o.producto_serie_codigo}</span>`;
        } else if (!serialToShow) {
            serialToShow = `<span style="color:var(--text-muted); font-style:italic;">Sin Serie</span>`;
        }

        let badgeEstado = '';
        if (o.estado === 'Recibido') badgeEstado = '<span class="badge badge-info">Recibido</span>';
        else if (o.estado === 'En Diagnostico') badgeEstado = '<span class="badge badge-warning">En Diagnóstico</span>';
        else if (o.estado === 'Reparado') badgeEstado = '<span class="badge badge-success">Reparado</span>';
        else if (o.estado === 'No Reparable') badgeEstado = '<span class="badge badge-danger">No Reparable</span>';
        else if (o.estado === 'Entregado') badgeEstado = '<span class="badge" style="background-color:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--text-muted);">Entregado</span>';

        const btnEntrega = o.estado === 'Reparado' || o.estado === 'No Reparable'
            ? `<button class="btn btn-secondary btn-icon" style="color:var(--color-success); border-color:rgba(16,185,129,0.15); height:28px; width:28px;" onclick="abrirEntregarOrdenModal(${o.id})" title="Entregar"><i data-lucide="check" style="width:14px;"></i></button>`
            : '';

        const btnDetalle = `<button class="btn btn-secondary btn-icon" style="height:28px; width:28px;" onclick="abrirDetallesOrdenModal(${o.id})" title="Ver Detalles/Diagnóstico"><i data-lucide="eye" style="width:14px;"></i></button>`;

        const btnPDF = o.estado === 'Entregado'
            ? `<button class="btn btn-secondary btn-icon" style="color:var(--color-info); border-color:rgba(6,182,212,0.15); height:28px; width:28px;" onclick="imprimirOrdenSalidaPDF(${o.id})" title="Imprimir Hoja de Salida"><i data-lucide="printer" style="width:14px;"></i></button>`
            : `<button class="btn btn-secondary btn-icon" style="height:28px; width:28px;" onclick="imprimirOrdenIngresoPDF(${o.id})" title="Imprimir Hoja de Ingreso"><i data-lucide="printer" style="width:14px;"></i></button>`;

        return `
            <tr>
                <td style="font-weight:700;">#${String(o.id).padStart(5, '0')}</td>
                <td style="font-weight:600;">${o.cliente_nombre}</td>
                <td>${o.equipo_marca_modelo}</td>
                <td>${serialToShow}</td>
                <td style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(o.fecha_ingreso)}</td>
                <td style="font-size:0.75rem; color:var(--text-muted);">${o.fecha_entrega ? formatFecha(o.fecha_entrega) : '<span style="color:var(--text-muted); font-style:italic;">Pendiente</span>'}</td>
                <td style="text-align:right;">${formatCurrency(o.costo_servicio, 'PEN')}</td>
                <td style="text-align:right; font-weight:700; color:var(--color-primary);">${formatCurrency(o.total_pagar, 'PEN')}</td>
                <td>${badgeEstado}</td>
                <td style="text-align:center;">
                    <div style="display:flex; justify-content:center; gap:6px;">
                        ${btnDetalle}
                        ${btnEntrega}
                        ${btnPDF}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

// Filtra órdenes basadas en texto de búsqueda y estado seleccionado
function filtrarOrdenesSoporte() {
    const query = document.getElementById('soporte-search-input').value.toLowerCase();
    const filterEstado = document.getElementById('soporte-filter-estado').value;

    const filtrados = ordenesSoporte.filter(o => {
        const matchesSearch = o.cliente_nombre.toLowerCase().includes(query) || 
                              o.equipo_marca_modelo.toLowerCase().includes(query) || 
                              (o.numero_serie_externo && o.numero_serie_externo.toLowerCase().includes(query)) ||
                              (o.producto_serie_codigo && o.producto_serie_codigo.toLowerCase().includes(query));
        const matchesEstado = filterEstado === '' || o.estado === filterEstado;
        return matchesSearch && matchesEstado;
    });

    renderTablaOrdenesSoporte(filtrados);
}

// Actualiza las tarjetas resumen de métricas
function actualizarTableroMetricas() {
    const summaryCards = document.getElementById('soporte-summary-cards');
    if (!summaryCards) return;

    const conteos = {
        'Recibido': 0,
        'En Diagnostico': 0,
        'Reparado': 0,
        'No Reparable': 0,
        'Entregado': 0
    };

    ordenesSoporte.forEach(o => {
        if (conteos.hasOwnProperty(o.estado)) {
            conteos[o.estado]++;
        }
    });

    summaryCards.innerHTML = `
        <!-- Recibido: Indigo -->
        <div class="rounded-lg p-5 flex flex-col justify-between shadow-md" style="background-color: rgba(99, 102, 241, 0.08); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Recibidos</span>
                <i data-lucide="wrench" style="width:20px; height:20px;"></i>
            </div>
            <div style="font-size:1.8rem; font-weight:800; margin-top:12px; color:#a5b4fc;">${conteos['Recibido']}</div>
        </div>

        <!-- En Diagnóstico: Amber -->
        <div class="rounded-lg p-5 flex flex-col justify-between shadow-md" style="background-color: rgba(245, 158, 11, 0.08); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">En Diagnóstico</span>
                <i data-lucide="scan" style="width:20px; height:20px;"></i>
            </div>
            <div style="font-size:1.8rem; font-weight:800; margin-top:12px; color:#fde047;">${conteos['En Diagnostico']}</div>
        </div>

        <!-- Reparado: Emerald -->
        <div class="rounded-lg p-5 flex flex-col justify-between shadow-md" style="background-color: rgba(16, 185, 129, 0.08); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Reparados</span>
                <i data-lucide="check-circle" style="width:20px; height:20px;"></i>
            </div>
            <div style="font-size:1.8rem; font-weight:800; margin-top:12px; color:#6ee7b7;">${conteos['Reparado']}</div>
        </div>

        <!-- No Reparable: Rose -->
        <div class="rounded-lg p-5 flex flex-col justify-between shadow-md" style="background-color: rgba(244, 63, 94, 0.08); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">No Reparables</span>
                <i data-lucide="alert-triangle" style="width:20px; height:20px;"></i>
            </div>
            <div style="font-size:1.8rem; font-weight:800; margin-top:12px; color:#fca5a5;">${conteos['No Reparable']}</div>
        </div>

        <!-- Entregado: Slate -->
        <div class="rounded-lg p-5 flex flex-col justify-between shadow-md" style="background-color: rgba(100, 116, 139, 0.08); color: #cbd5e1; border: 1px solid rgba(100, 116, 139, 0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Entregados</span>
                <i data-lucide="archive" style="width:20px; height:20px;"></i>
            </div>
            <div style="font-size:1.8rem; font-weight:800; margin-top:12px; color:#f1f5f9;">${conteos['Entregado']}</div>
        </div>
    `;

    lucide.createIcons();
}

// Modal: Nueva Orden de Servicio
function abrirCrearOrdenModal() {
    const clientesHtml = actoresClientes.map(c => `
        <option value="${c.id}">${c.nombre_razon_social} (${c.tipo_documento}: ${c.documento_identidad})</option>
    `).join('');

    const productosHtml = productosSeriesCatalog.map(p => `
        <option value="${p.id}">${p.nombre}</option>
    `).join('');

    const bodyHtml = `
        <form id="form-crear-orden" style="display:flex; flex-direction:column; gap:16px;">
            <!-- Cliente -->
            <div style="background-color:rgba(255,255,255,0.02); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="soporte-cliente-manual-toggle" style="cursor:pointer; width:16px; height:16px;">
                <label for="soporte-cliente-manual-toggle" style="font-size:0.85rem; font-weight:600; cursor:pointer;">Cliente Invitado (Registro Manual)</label>
            </div>

            <div class="form-group" id="soporte-cliente-select-group">
                <label class="form-label">Cliente Registrado</label>
                <select class="form-select" id="soporte-cliente-select" required>
                    <option value="" disabled selected>Seleccione el cliente...</option>
                    ${clientesHtml}
                </select>
            </div>

            <div class="form-group" id="soporte-cliente-manual-group" style="display:none;">
                <label class="form-label">Nombre del Cliente</label>
                <input type="text" class="form-input" id="soporte-cliente-nombre-manual" placeholder="Nombre completo del cliente...">
            </div>

            <!-- Trazabilidad / Procedencia del Equipo -->
            <div style="background-color:rgba(255,255,255,0.02); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color); display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="soporte-comprado-tienda" style="cursor:pointer; width:16px; height:16px;">
                <label for="soporte-comprado-tienda" style="font-size:0.85rem; font-weight:600; cursor:pointer;">Equipo adquirido en esta tienda (Garantía Oficial)</label>
            </div>

            <!-- Si fue comprado en la tienda -->
            <div id="soporte-tienda-fields" style="display:none; flex-direction:column; gap:16px;">
                <div class="form-group">
                    <label class="form-label">Producto del Inventario</label>
                    <select class="form-select" id="soporte-producto-tienda-select">
                        <option value="" selected>Seleccione el producto...</option>
                        ${productosHtml}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Número de Serie Registrado</label>
                    <select class="form-select" id="soporte-serie-tienda-select">
                        <option value="" selected>Seleccione primero el producto...</option>
                    </select>
                </div>
            </div>

            <!-- Campos Generales del Equipo -->
            <div class="form-group" id="soporte-marca-modelo-group">
                <label class="form-label">Marca y Modelo del Equipo</label>
                <input type="text" class="form-input" id="soporte-marca-modelo" placeholder="Ej: Asus Zenbook UX425, iPhone 13 Pro..." required>
            </div>

            <div class="form-group" id="soporte-serie-externa-group">
                <label class="form-label">Número de Serie del Equipo</label>
                <input type="text" class="form-input" id="soporte-serie-externa" placeholder="Ingrese número de serie del fabricante...">
            </div>

            <div class="form-group">
                <label class="form-label">Falla / Problema Reportado</label>
                <textarea class="form-textarea" id="soporte-problema-reportado" placeholder="Describa el problema detalladamente..." required style="height:100px;"></textarea>
            </div>

            <div class="form-group">
                <label class="form-label">Costo Estimado de Mano de Obra (S/)</label>
                <input type="number" step="0.01" min="0" class="form-input" id="soporte-costo-estimado" value="0.00" required>
            </div>
        </form>
    `;

    const footerHtml = `
        <button type="button" class="btn btn-secondary" onclick="closeModal('global-modal')">Cancelar</button>
        <button type="button" class="btn btn-primary" onclick="guardarNuevaOrdenSoporte()">Registrar Ingreso</button>
    `;

    setupGlobalModal("Registrar Ingreso de Equipo", bodyHtml, footerHtml);

    // Enlazar Eventos del Formulario
    const toggleManual = document.getElementById('soporte-cliente-manual-toggle');
    toggleManual.onchange = (e) => {
        const selectGroup = document.getElementById('soporte-cliente-select-group');
        const select = document.getElementById('soporte-cliente-select');
        const manualGroup = document.getElementById('soporte-cliente-manual-group');
        const manualInput = document.getElementById('soporte-cliente-nombre-manual');

        if (e.target.checked) {
            selectGroup.style.display = 'none';
            select.removeAttribute('required');
            manualGroup.style.display = 'block';
            manualInput.setAttribute('required', 'true');
        } else {
            selectGroup.style.display = 'block';
            select.setAttribute('required', 'true');
            manualGroup.style.display = 'none';
            manualInput.removeAttribute('required');
        }
    };

    const toggleTienda = document.getElementById('soporte-comprado-tienda');
    toggleTienda.onchange = (e) => {
        const tiendaFields = document.getElementById('soporte-tienda-fields');
        const marcaModelo = document.getElementById('soporte-marca-modelo');
        const serieExterna = document.getElementById('soporte-serie-externa');

        if (e.target.checked) {
            tiendaFields.style.display = 'flex';
            // Marca y modelo se bloquearán/autocompletarán al seleccionar la serie
            marcaModelo.setAttribute('readonly', 'true');
            serieExterna.style.display = 'none';
        } else {
            tiendaFields.style.display = 'none';
            marcaModelo.removeAttribute('readonly');
            marcaModelo.value = '';
            serieExterna.style.display = 'flex';
            serieExterna.value = '';
        }
    };

    // Al seleccionar producto de tienda, cargar sus series vendidas
    const prodSelect = document.getElementById('soporte-producto-tienda-select');
    prodSelect.onchange = async (e) => {
        const prodId = e.target.value;
        const serieSelect = document.getElementById('soporte-serie-tienda-select');
        serieSelect.innerHTML = '<option value="">Cargando series...</option>';

        if (!prodId) {
            serieSelect.innerHTML = '<option value="">Seleccione primero el producto...</option>';
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/productos/${prodId}/series`);
            const series = await res.json();
            
            // Filtrar series vendidas
            const seriesVendidas = series.filter(s => s.estado === 'Vendido' || s.estado === 'En Garantia');

            if (seriesVendidas.length === 0) {
                serieSelect.innerHTML = '<option value="">No hay series vendidas de este producto.</option>';
            } else {
                serieSelect.innerHTML = '<option value="" disabled selected>Seleccione la serie del equipo...</option>' +
                    seriesVendidas.map(s => `<option value="${s.id}" data-serie="${s.numero_serie}">${s.numero_serie} (${s.estado})</option>`).join('');
            }
        } catch (err) {
            console.error(err);
            serieSelect.innerHTML = '<option value="">Error al cargar series.</option>';
        }
    };

    // Al seleccionar la serie, autocompletar la marca y modelo
    const serieSelect = document.getElementById('soporte-serie-tienda-select');
    serieSelect.onchange = (e) => {
        const option = e.target.options[e.target.selectedIndex];
        const prodName = prodSelect.options[prodSelect.selectedIndex].text;
        const marcaModelo = document.getElementById('soporte-marca-modelo');
        marcaModelo.value = prodName;
    };
}

// Acción: Guardar Nueva Orden de Soporte
async function guardarNuevaOrdenSoporte() {
    const form = document.getElementById('form-crear-orden');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const isManual = document.getElementById('soporte-cliente-manual-toggle').checked;
    const isTienda = document.getElementById('soporte-comprado-tienda').checked;

    if (isTienda) {
        const serieVal = document.getElementById('soporte-serie-tienda-select').value;
        if (!serieVal) {
            mostrarToast("Debe seleccionar una serie válida del equipo comprado en tienda.", "warning");
            return;
        }
    }

    const payload = {
        cliente_id: isManual ? null : parseInt(document.getElementById('soporte-cliente-select').value),
        cliente_nombre_manual: isManual ? document.getElementById('soporte-cliente-nombre-manual').value.trim() : null,
        producto_serie_id: isTienda ? parseInt(document.getElementById('soporte-serie-tienda-select').value) : null,
        equipo_marca_modelo: document.getElementById('soporte-marca-modelo').value.trim(),
        numero_serie_externo: isTienda ? null : document.getElementById('soporte-serie-externa').value.trim(),
        problema_reportado: document.getElementById('soporte-problema-reportado').value.trim(),
        costo_servicio: parseFloat(document.getElementById('soporte-costo-estimado').value) || 0.00
    };

    try {
        const res = await fetch(`${API_URL}/api/soporte/ordenes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, 'success');
            closeModal('global-modal');
            await cargarOrdenesSoporte();
            
            // Imprimir cargo de ingreso
            imprimirOrdenIngresoPDF(data.id);
        } else {
            mostrarToast(data.mensaje, 'danger');
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error al guardar la orden de soporte.", 'danger');
    }
}

// Modal: Detalles, Repuestos e Informe Técnico de la Orden
let activeOrdenIdDetail = null;

async function abrirDetallesOrdenModal(ordenId) {
    activeOrdenIdDetail = ordenId;
    try {
        const res = await fetch(`${API_URL}/api/soporte/ordenes/${ordenId}`);
        const data = await res.json();

        if (!data.exito) {
            mostrarToast(data.mensaje, 'danger');
            return;
        }

        const o = data.orden;
        const repuestos = data.repuestos;

        let serialToShow = o.numero_serie_externo || '';
        if (o.producto_serie_codigo) {
            serialToShow = `${o.producto_serie_codigo} <span style="font-size:0.75rem; padding:2px 6px; background-color:#dbeafe; color:#1e40af; border-radius:4px; font-weight:700; margin-left:6px;">Garantía Tienda</span>`;
        } else if (!serialToShow) {
            serialToShow = '<span style="color:var(--text-muted); font-style:italic;">Sin número de serie</span>';
        }

        // Dropdown de productos disponibles para repuestos
        const repuestoOptionsHtml = repuestosDisponibles.map(p => `
            <option value="${p.id}" data-precio="${p.precio_final}">${p.nombre} (Stock: ${p.stock_actual} U.)</option>
        `).join('');

        const bodyHtml = `
            <div style="display:flex; flex-direction:column; gap:20px;">
                
                <!-- Datos del Cliente y Falla -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; background-color:rgba(255,255,255,0.02); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-color); font-size:0.85rem;">
                    <div>
                        <strong style="color:var(--color-primary);">INFORMACIÓN DE INGRESO</strong>
                        <p style="margin:8px 0 0;"><strong>Cliente:</strong> ${o.cliente_nombre}</p>
                        <p style="margin:4px 0 0;"><strong>Equipo:</strong> ${o.equipo_marca_modelo}</p>
                        <p style="margin:4px 0 0;"><strong>S/N:</strong> ${serialToShow}</p>
                        <p style="margin:4px 0 0;"><strong>Ingreso:</strong> ${formatFecha(o.fecha_ingreso)}</p>
                    </div>
                    <div>
                        <strong style="color:var(--color-warning);">FALLA REPORTADA</strong>
                        <p style="margin:8px 0 0; font-style:italic; color:var(--text-muted); line-height:1.4;">"${o.problema_reportado}"</p>
                    </div>
                </div>

                <!-- Formulario de Diagnóstico del Técnico -->
                <form id="form-diagnostico-soporte" style="display:flex; flex-direction:column; gap:12px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Estado de la Reparación</label>
                            <select class="form-select" id="soporte-edit-estado" ${o.estado === 'Entregado' ? 'disabled' : ''}>
                                <option value="Recibido" ${o.estado === 'Recibido' ? 'selected' : ''}>Recibido</option>
                                <option value="En Diagnostico" ${o.estado === 'En Diagnostico' ? 'selected' : ''}>En Diagnóstico</option>
                                <option value="Reparado" ${o.estado === 'Reparado' ? 'selected' : ''}>Reparado</option>
                                <option value="No Reparable" ${o.estado === 'No Reparable' ? 'selected' : ''}>No Reparable</option>
                                <option value="Entregado" ${o.estado === 'Entregado' ? 'selected' : ''} disabled>Entregado (Solo vía Checkout)</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Mano de Obra / Servicio (S/)</label>
                            <input type="number" step="0.01" min="0" class="form-input" id="soporte-edit-costo" value="${o.costo_servicio.toFixed(2)}" ${o.estado === 'Entregado' ? 'readonly' : ''}>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Informe de Diagnóstico Técnico</label>
                        <textarea class="form-textarea" id="soporte-edit-diagnostico" placeholder="Redacte el diagnóstico de la falla y solución aplicada..." style="height:80px;" ${o.estado === 'Entregado' ? 'readonly' : ''}>${o.diagnostico_tecnico || ''}</textarea>
                    </div>
                </form>

                <!-- Panel de Repuestos Utilizados -->
                <div style="border-top:1px dashed var(--border-color); padding-top:16px;">
                    <strong style="font-size:0.9rem; display:block; margin-bottom:12px;">REPUESTOS UTILIZADOS DE NUESTRO INVENTARIO</strong>
                    
                    <!-- Formulario agregar repuesto -->
                    ${o.estado !== 'Entregado' ? `
                    <div style="display:grid; grid-template-columns:2fr 1fr 1fr auto; gap:10px; align-items:end; margin-bottom:14px; background-color:rgba(0,0,0,0.1); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                        <div class="form-group" style="margin-bottom:0; gap:4px;">
                            <label class="form-label" style="font-size:0.75rem;">Repuesto</label>
                            <select class="form-select" id="soporte-repuesto-select" style="height:32px; padding:0 8px; font-size:0.8rem;">
                                <option value="" selected>Seleccione repuesto...</option>
                                ${repuestoOptionsHtml}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:0; gap:4px;">
                            <label class="form-label" style="font-size:0.75rem;">Cant.</label>
                            <input type="number" min="1" value="1" class="form-input" id="soporte-repuesto-cantidad" style="height:32px; padding:4px 8px; font-size:0.8rem;">
                        </div>
                        <div class="form-group" style="margin-bottom:0; gap:4px;">
                            <label class="form-label" style="font-size:0.75rem;">Precio (S/)</label>
                            <input type="number" step="0.01" class="form-input" id="soporte-repuesto-precio" style="height:32px; padding:4px 8px; font-size:0.8rem;">
                        </div>
                        <button class="btn btn-primary" onclick="agregarRepuestoOrden()" style="height:32px; padding:0 12px; font-size:0.8rem; border-radius:var(--radius-sm);">
                            Agregar
                        </button>
                    </div>
                    ` : ''}

                    <!-- Lista de repuestos cargados -->
                    <div class="table-container" style="background-color:rgba(0,0,0,0.15);">
                        <table class="data-table" style="font-size:0.8rem;">
                            <thead>
                                <tr style="background-color:rgba(0,0,0,0.3);">
                                    <th style="padding:8px 12px;">Producto Repuesto</th>
                                    <th style="padding:8px 12px; text-align:center; width:60px;">Cant.</th>
                                    <th style="padding:8px 12px; text-align:right; width:80px;">Precio Unit.</th>
                                    <th style="padding:8px 12px; text-align:right; width:90px;">Subtotal</th>
                                    ${o.estado !== 'Entregado' ? '<th style="padding:8px 12px; text-align:center; width:40px;"></th>' : ''}
                                </tr>
                            </thead>
                            <tbody id="soporte-repuestos-cargados-body">
                                <!-- Inyectado dinámicamente -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Monto Total General -->
                <div style="display:flex; justify-content:flex-end; align-items:center; gap:16px; border-top:1px solid var(--border-color); padding-top:14px; font-size:1.05rem;">
                    <span style="color:var(--text-muted); font-weight:600;">Total Reparación a Cobrar:</span>
                    <strong id="soporte-total-general-reparacion" style="color:var(--color-success); font-size:1.25rem;">S/ 0.00</strong>
                </div>
            </div>
        `;

        const btnSaveDiagnostico = o.estado !== 'Entregado'
            ? `<button type="button" class="btn btn-primary" onclick="guardarDiagnosticoOrden()">Guardar Cambios</button>`
            : '';

        const footerHtml = `
            <button type="button" class="btn btn-secondary" onclick="closeModal('global-modal')">Cerrar</button>
            ${btnSaveDiagnostico}
        `;

        setupGlobalModal(`Orden de Servicio #${String(o.id).padStart(5, '0')} [${o.estado}]`, bodyHtml, footerHtml);

        // Lógica de autocompletar precio de repuesto seleccionado
        const repSelect = document.getElementById('soporte-repuesto-select');
        const repPrecio = document.getElementById('soporte-repuesto-precio');
        if (repSelect && repPrecio) {
            repSelect.onchange = (e) => {
                const opt = e.target.options[e.target.selectedIndex];
                const price = parseFloat(opt.getAttribute('data-precio')) || 0.00;
                repPrecio.value = price.toFixed(2);
            };
        }

        renderListaRepuestosOrden(repuestos, o.costo_servicio, o.estado !== 'Entregado');

    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo cargar la información de la orden.", 'danger');
    }
}

// Renderiza los repuestos en la tabla interna del modal de diagnóstico
function renderListaRepuestosOrden(repuestos, costoManoObra, editable) {
    const tbody = document.getElementById('soporte-repuestos-cargados-body');
    const totalEl = document.getElementById('soporte-total-general-reparacion');
    if (!tbody) return;

    let totalRepuestos = 0.00;

    if (repuestos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${editable ? 5 : 4}" style="text-align:center; padding:12px; color:var(--text-muted); font-style:italic;">No se han agregado repuestos para esta reparación.</td></tr>`;
    } else {
        tbody.innerHTML = repuestos.map(r => {
            const sub = r.cantidad * r.precio_aplicado;
            totalRepuestos += sub;

            const btnDelete = editable 
                ? `<td style="padding:6px 12px; text-align:center;"><button class="btn btn-danger btn-icon" style="height:22px; width:22px; border-radius:3px;" onclick="eliminarRepuestoOrden(${r.id})"><i data-lucide="trash-2" style="width:12px;"></i></button></td>`
                : '';

            return `
                <tr>
                    <td style="padding:8px 12px; font-weight:600;">${r.producto_nombre}</td>
                    <td style="padding:8px 12px; text-align:center;">${r.cantidad} U.</td>
                    <td style="padding:8px 12px; text-align:right;">S/ ${r.precio_aplicado.toFixed(2)}</td>
                    <td style="padding:8px 12px; text-align:right; font-weight:700; color:var(--text-main);">S/ ${sub.toFixed(2)}</td>
                    ${btnDelete}
                </tr>
            `;
        }).join('');
    }

    const totalGeneral = totalRepuestos + parseFloat(costoManoObra);
    if (totalEl) {
        totalEl.textContent = `S/ ${totalGeneral.toFixed(2)}`;
    }
    lucide.createIcons();
}

// Acción: Agregar Repuesto a la Orden
async function agregarRepuestoOrden() {
    const prodId = document.getElementById('soporte-repuesto-select').value;
    const qty = parseInt(document.getElementById('soporte-repuesto-cantidad').value) || 0;
    const price = parseFloat(document.getElementById('soporte-repuesto-precio').value) || 0.00;

    if (!prodId || qty <= 0 || price < 0) {
        mostrarToast("Seleccione un repuesto y configure cantidad y precio válidos.", "warning");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/soporte/ordenes/${activeOrdenIdDetail}/repuestos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ producto_id: parseInt(prodId), cantidad: qty, precio_aplicado: price })
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            
            // Recargar detalles y repuestos
            const resDet = await fetch(`${API_URL}/api/soporte/ordenes/${activeOrdenIdDetail}`);
            const updated = await resDet.json();
            
            const cost = parseFloat(document.getElementById('soporte-edit-costo').value) || 0.00;
            renderListaRepuestosOrden(updated.repuestos, cost, true);
            await cargarOrdenesSoporte();
            await cargarCatálogosSoporte(); // Recargar stock del catálogo de repuestos
            
            // Re-render select para actualizar stock visual en dropdown
            const repOptionsHtml = repuestosDisponibles.map(p => `
                <option value="${p.id}" data-precio="${p.precio_final}">${p.nombre} (Stock: ${p.stock_actual} U.)</option>
            `).join('');
            document.getElementById('soporte-repuesto-select').innerHTML = '<option value="" selected>Seleccione repuesto...</option>' + repOptionsHtml;
            document.getElementById('soporte-repuesto-cantidad').value = 1;
            document.getElementById('soporte-repuesto-precio').value = '';
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error al asociar el repuesto.", "danger");
    }
}

// Acción: Eliminar Repuesto de la Orden
async function eliminarRepuestoOrden(repuestoId) {
    if (!confirm("¿Está seguro de remover este repuesto de la reparación? El stock volverá al inventario.")) return;

    try {
        const res = await fetch(`${API_URL}/api/soporte/ordenes/${activeOrdenIdDetail}/repuestos/${repuestoId}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            
            const resDet = await fetch(`${API_URL}/api/soporte/ordenes/${activeOrdenIdDetail}`);
            const updated = await resDet.json();
            
            const cost = parseFloat(document.getElementById('soporte-edit-costo').value) || 0.00;
            renderListaRepuestosOrden(updated.repuestos, cost, true);
            await cargarOrdenesSoporte();
            await cargarCatálogosSoporte();
            
            const repOptionsHtml = repuestosDisponibles.map(p => `
                <option value="${p.id}" data-precio="${p.precio_final}">${p.nombre} (Stock: ${p.stock_actual} U.)</option>
            `).join('');
            document.getElementById('soporte-repuesto-select').innerHTML = '<option value="" selected>Seleccione repuesto...</option>' + repOptionsHtml;
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error al remover repuesto.", "danger");
    }
}

// Acción: Guardar Diagnóstico y Mano de Obra
async function guardarDiagnosticoOrden() {
    const estado = document.getElementById('soporte-edit-estado').value;
    const costo = parseFloat(document.getElementById('soporte-edit-costo').value) || 0.00;
    const diag = document.getElementById('soporte-edit-diagnostico').value.trim();

    if (costo < 0) {
        mostrarToast("El costo del servicio no puede ser menor a cero.", "warning");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/soporte/ordenes/${activeOrdenIdDetail}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estado: estado,
                costo_servicio: costo,
                diagnostico_tecnico: diag,
                garantia_servicio_meses: 0 // Se configura obligatoriamente al entregar
            })
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            closeModal('global-modal');
            await cargarOrdenesSoporte();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error de conexión al guardar diagnóstico.", "danger");
    }
}

// Modal: Procesar Entrega de Equipo y Garantía
let activeOrdenIdEntrega = null;

async function abrirEntregarOrdenModal(ordenId) {
    activeOrdenIdEntrega = ordenId;
    try {
        const res = await fetch(`${API_URL}/api/soporte/ordenes/${ordenId}`);
        const data = await res.json();

        if (!data.exito) {
            mostrarToast(data.mensaje, 'danger');
            return;
        }

        const o = data.orden;

        const bodyHtml = `
            <form id="form-entrega-soporte" style="display:flex; flex-direction:column; gap:16px;">
                <div style="background-color:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.15); padding:14px; border-radius:var(--radius-sm); font-size:0.85rem;">
                    <strong>Resumen Contable de Reparación:</strong>
                    <div style="display:flex; justify-content:space-between; margin-top:8px; color:var(--text-muted);">
                        <span>Costo Mano de Obra:</span>
                        <span>S/ ${o.costo_servicio.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:4px; color:var(--text-muted);">
                        <span>Costo Repuestos:</span>
                        <span>S/ ${(o.total_pagar - o.costo_servicio).toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:6px; border-top:1px dashed var(--border-color); padding-top:6px; font-weight:700; color:var(--text-main); font-size:1rem;">
                        <span>Total General a Cobrar:</span>
                        <span style="color:var(--color-success);">S/ ${o.total_pagar.toFixed(2)}</span>
                    </div>
                </div>

                <input type="hidden" id="soporte-entrega-costo" value="${o.costo_servicio}">
                <input type="hidden" id="soporte-entrega-diagnostico" value="${o.diagnostico_tecnico || ''}">

                <div class="form-group">
                    <label class="form-label">Meses de Garantía del Servicio (Requerido)</label>
                    <input type="number" min="0" value="3" class="form-input" id="soporte-entrega-garantia" placeholder="Ingrese meses de garantía otorgados..." required>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Por ejemplo, 3 meses por cambio de repuestos mecánicos o electrónicos.</p>
                </div>

                <div class="form-group">
                    <label class="form-label">Método de Pago</label>
                    <select class="form-select" id="soporte-entrega-metodo" required>
                        <option value="" disabled selected>Seleccione método de pago...</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta">Tarjeta de Crédito / Débito</option>
                        <option value="Transferencia">Transferencia Bancaria</option>
                        <option value="Yape/Plin">Yape / Plin</option>
                    </select>
                </div>
            </form>
        `;

        const footerHtml = `
            <button type="button" class="btn btn-secondary" onclick="closeModal('global-modal')">Cancelar</button>
            <button type="button" class="btn btn-success" onclick="procesarEntregaYFacturacion()">Confirmar Entrega y Cobro</button>
        `;

        setupGlobalModal(`Entregar Equipo de Orden #${String(o.id).padStart(5, '0')}`, bodyHtml, footerHtml);

    } catch (err) {
        console.error(err);
        mostrarToast("Error al cargar datos para entrega.", "danger");
    }
}

// Acción: Confirmar Entrega y Emitir Comprobante de Garantía
async function procesarEntregaYFacturacion() {
    const form = document.getElementById('form-entrega-soporte');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const mesesGarantia = parseInt(document.getElementById('soporte-entrega-garantia').value);
    const metodoPago = document.getElementById('soporte-entrega-metodo').value;
    const diag = document.getElementById('soporte-entrega-diagnostico').value;
    const cost = parseFloat(document.getElementById('soporte-entrega-costo').value) || 0.00;

    if (isNaN(mesesGarantia) || mesesGarantia < 0) {
        mostrarToast("Ingrese un número válido de meses de garantía.", "warning");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/soporte/ordenes/${activeOrdenIdEntrega}/entregar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                metodo_pago: metodoPago,
                garantia_servicio_meses: mesesGarantia,
                diagnostico_tecnico: diag,
                costo_servicio: cost
            })
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast("Reparación entregada y cerrada correctamente.", "success");
            closeModal('global-modal');
            await cargarOrdenesSoporte();

            // Imprimir hoja de salida / certificado de garantía
            imprimirOrdenSalidaPDF(activeOrdenIdEntrega);
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error al procesar la entrega.", "danger");
    }
}

// ==============================================================================
// MÓDULO DE REPORTES PDF (html2pdf.js)
// ==============================================================================

// 1. Hoja de Ingreso (A4 formal de recepción)
async function imprimirOrdenIngresoPDF(ordenId) {
    try {
        const resConfig = await fetch(`${API_URL}/api/config`);
        const config = await resConfig.json();

        const resOrden = await fetch(`${API_URL}/api/soporte/ordenes/${ordenId}`);
        const data = await resOrden.json();
        
        if (!data.exito) {
            mostrarToast(data.mensaje, "danger");
            return;
        }

        const o = data.orden;

        const printContainer = document.createElement('div');
        printContainer.style.padding = '32px';
        printContainer.style.backgroundColor = 'white';
        printContainer.style.color = '#1f2937';
        printContainer.style.fontFamily = "'Inter', sans-serif";
        printContainer.style.fontSize = '12px';
        printContainer.style.lineHeight = '1.6';

        printContainer.innerHTML = `
            <div style="display:flex; justify-content:between; align-items:flex-start; border-bottom:2px solid #e5e7eb; padding-bottom:16px; margin-bottom:24px;">
                <div style="flex:1;">
                    <h1 style="font-size:20px; font-weight:800; color:#4f46e5; margin:0 0 8px;">${config.empresa_nombre}</h1>
                    <p style="margin:0; color:#4b5563;">RUC: ${config.empresa_ruc}</p>
                    <p style="margin:2px 0 0; color:#4b5563;">Dirección: ${config.empresa_direccion || 'No especificada'}</p>
                    <p style="margin:2px 0 0; color:#4b5563;">Teléfono: ${config.empresa_telefono || ''}</p>
                </div>
                <div style="border:2px solid #4f46e5; padding:16px; border-radius:8px; text-align:center; min-width:200px; background-color:#faf5ff;">
                    <h2 style="font-size:12px; margin:0 0 4px; font-weight:800; color:#4f46e5; text-transform:uppercase;">Cargo de Recepción</h2>
                    <p style="font-size:14px; font-weight:800; margin:0; color:#1f2937;">ORDEN DE SERVICIO</p>
                    <p style="font-size:18px; font-weight:700; margin:4px 0 0; font-family:monospace; color:#4f46e5;">#${String(o.id).padStart(5, '0')}</p>
                </div>
            </div>

            <div style="margin-bottom:24px;">
                <h3 style="font-size:12px; text-transform:uppercase; color:#4f46e5; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin:0 0 10px;">1. Datos del Cliente</h3>
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <tr>
                        <td style="padding:4px 0; width:120px; color:#6b7280; font-weight:600;">Nombre/Razón:</td>
                        <td style="padding:4px 0; font-weight:700;">${o.cliente_nombre}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0; color:#6b7280; font-weight:600;">Documento:</td>
                        <td style="padding:4px 0;">${o.cliente_documento || 'No registrado'}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0; color:#6b7280; font-weight:600;">Teléfono:</td>
                        <td style="padding:4px 0;">${o.cliente_telefono || 'No registrado'}</td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom:24px;">
                <h3 style="font-size:12px; text-transform:uppercase; color:#4f46e5; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin:0 0 10px;">2. Información del Equipo</h3>
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <tr>
                        <td style="padding:4px 0; width:120px; color:#6b7280; font-weight:600;">Marca / Modelo:</td>
                        <td style="padding:4px 0; font-weight:700; font-size:13px;">${o.equipo_marca_modelo}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0; color:#6b7280; font-weight:600;">Número de Serie:</td>
                        <td style="padding:4px 0; font-family:monospace; font-weight:700;">${o.producto_serie_codigo || o.numero_serie_externo || 'Sin Serie'}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0; color:#6b7280; font-weight:600;">Garantía Comercial:</td>
                        <td style="padding:4px 0;">${o.producto_serie_id ? '<span style="color:#059669; font-weight:600;">Vigente (Comprado en Tienda)</span>' : 'Externa'}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 0; color:#6b7280; font-weight:600;">Fecha de Ingreso:</td>
                        <td style="padding:4px 0; font-weight:600;">${formatFecha(o.fecha_ingreso)}</td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom:24px; background-color:#f9fafb; border:1px solid #e5e7eb; padding:16px; border-radius:6px;">
                <h3 style="font-size:11px; text-transform:uppercase; color:#d97706; margin:0 0 8px; font-weight:700;">3. Falla o Falla Reportada por el Cliente</h3>
                <p style="margin:0; font-style:italic; font-size:12px; color:#374151; line-height:1.5;">"${o.problema_reportado}"</p>
            </div>

            <div style="margin-bottom:32px; display:flex; justify-content:flex-end;">
                <div style="width:250px; border:1px solid #e5e7eb; border-radius:6px; padding:12px; background-color:#fafafa;">
                    <div style="display:flex; justify-content:space-between; padding:4px 0;">
                        <span style="color:#6b7280;">Costo Mano Obra Est.</span>
                        <span style="font-weight:700;">S/ ${o.costo_servicio.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px dashed #e5e7eb; margin-top:4px; font-size:13px; font-weight:800; color:#4f46e5;">
                        <span>Total Presupuestado</span>
                        <span>S/ ${o.total_pagar.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top:80px; display:grid; grid-template-columns:1fr 1fr; gap:64px; text-align:center;">
                <div>
                    <div style="border-top:1px solid #9ca3af; width:180px; margin:0 auto; padding-top:6px;">Firma del Cliente</div>
                </div>
                <div>
                    <div style="border-top:1px solid #9ca3af; width:180px; margin:0 auto; padding-top:6px;">Firma del Técnico / Recibido</div>
                </div>
            </div>

            <div style="margin-top:60px; border-top:1px solid #e5e7eb; padding-top:16px; text-align:center; color:#9ca3af; font-size:10px; line-height:1.4;">
                <p style="margin:0;">Al firmar este documento, el cliente acepta los términos y condiciones del servicio técnico.</p>
                <p style="margin:2px 0 0;">Los presupuestos de diagnóstico tienen validez de 15 días calendario.</p>
            </div>
        `;

        const opt = {
            margin:       10,
            filename:     `OrdenIngreso_Soporte_${String(o.id).padStart(5, '0')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(printContainer).save();
    } catch (err) {
        console.error(err);
        mostrarToast("Error al exportar PDF de ingreso.", "danger");
    }
}

// 2. Hoja de Salida (Certificado de garantía del servicio)
async function imprimirOrdenSalidaPDF(ordenId) {
    try {
        const resConfig = await fetch(`${API_URL}/api/config`);
        const config = await resConfig.json();

        const resDetail = await fetch(`${API_URL}/api/soporte/ordenes/${ordenId}`);
        const data = await resDetail.json();
        
        if (!data.exito) {
            mostrarToast(data.mensaje, "danger");
            return;
        }

        const o = data.orden;
        const repuestos = data.repuestos;

        // Calcular costo total repuestos
        const totalRepuestos = repuestos.reduce((acc, r) => acc + (r.cantidad * r.precio_aplicado), 0);

        // Vencimiento de garantía
        const fechaEntrega = new Date(o.fecha_entrega || Date.now());
        fechaEntrega.setMonth(fechaEntrega.getMonth() + o.garantia_servicio_meses);
        const garantiaVenceStr = fechaEntrega.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });

        const printContainer = document.createElement('div');
        printContainer.style.padding = '32px';
        printContainer.style.backgroundColor = 'white';
        printContainer.style.color = '#1f2937';
        printContainer.style.fontFamily = "'Inter', sans-serif";
        printContainer.style.fontSize = '12px';
        printContainer.style.lineHeight = '1.6';

        printContainer.innerHTML = `
            <div style="display:flex; justify-content:between; align-items:flex-start; border-bottom:2px solid #e5e7eb; padding-bottom:16px; margin-bottom:20px;">
                <div style="flex:1;">
                    <h1 style="font-size:20px; font-weight:800; color:#059669; margin:0 0 8px;">${config.empresa_nombre}</h1>
                    <p style="margin:0; color:#4b5563;">RUC: ${config.empresa_ruc}</p>
                    <p style="margin:2px 0 0; color:#4b5563;">Dirección: ${config.empresa_direccion || 'No especificada'}</p>
                    <p style="margin:2px 0 0; color:#4b5563;">Teléfono: ${config.empresa_telefono || ''}</p>
                </div>
                <div style="border:2px solid #059669; padding:16px; border-radius:8px; text-align:center; min-width:200px; background-color:#ecfdf5;">
                    <h2 style="font-size:12px; margin:0 0 4px; font-weight:800; color:#059669; text-transform:uppercase;">Constancia de Entrega</h2>
                    <p style="font-size:13px; font-weight:800; margin:0; color:#1f2937;">GARANTÍA DE SERVICIO</p>
                    <p style="font-size:18px; font-weight:700; margin:4px 0 0; font-family:monospace; color:#059669;">#${String(o.id).padStart(5, '0')}</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; background-color:#f9fafb; padding:12px; border-radius:6px; border:1px solid #e5e7eb;">
                <div>
                    <h3 style="font-size:10px; text-transform:uppercase; color:#9ca3af; margin:0 0 4px; font-weight:700;">Datos del Propietario</h3>
                    <p style="margin:0; font-weight:700; font-size:12px;">${o.cliente_nombre}</p>
                    <p style="margin:2px 0 0; color:#4b5563;">Doc: ${o.cliente_documento || 'No registrado'}</p>
                    <p style="margin:2px 0 0; color:#4b5563;">Método de Pago: <strong>${o.metodo_pago || 'No registrado'}</strong></p>
                </div>
                <div>
                    <h3 style="font-size:10px; text-transform:uppercase; color:#9ca3af; margin:0 0 4px; font-weight:700;">Datos del Servicio</h3>
                    <p style="margin:0;">Ingreso: <strong>${formatFecha(o.fecha_ingreso)}</strong></p>
                    <p style="margin:2px 0 0;">Entrega: <strong>${formatFecha(o.fecha_entrega)}</strong></p>
                    <p style="margin:2px 0 0; color:#059669; font-weight:700;">Garantía: ${o.garantia_servicio_meses} meses (Vence: ${garantiaVenceStr})</p>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <h3 style="font-size:11px; text-transform:uppercase; color:#059669; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin:0 0 8px;">Especificaciones del Equipo</h3>
                <p style="margin:0;">Equipo / Modelo: <strong style="font-size:13px;">${o.equipo_marca_modelo}</strong></p>
                <p style="margin:2px 0 0;">S/N: <strong style="font-family:monospace;">${o.producto_serie_codigo || o.numero_serie_externo || 'Sin Serie'}</strong></p>
            </div>

            <div style="margin-bottom:20px; background-color:#fcfdfa; border:1px solid #f1f5e9; padding:12px; border-radius:6px;">
                <h3 style="font-size:10px; text-transform:uppercase; color:#059669; margin:0 0 6px; font-weight:700;">Diagnóstico Técnico Final y Solución Aplicada</h3>
                <p style="margin:0; font-size:12px; color:#374151; line-height:1.5;">${o.diagnostico_tecnico || 'Equipo verificado y reparado con éxito.'}</p>
            </div>

            <div style="margin-bottom:24px;">
                <h3 style="font-size:11px; text-transform:uppercase; color:#059669; border-bottom:1px solid #e5e7eb; padding-bottom:4px; margin:0 0 8px;">Detalle de Costos y Repuestos</h3>
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:11px;">
                    <thead>
                        <tr style="background-color:#059669; color:white;">
                            <th style="padding:6px 10px; font-weight:600;">Detalle / Concepto</th>
                            <th style="padding:6px 10px; text-align:center; width:60px;">Cant.</th>
                            <th style="padding:6px 10px; text-align:right; width:90px;">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding:8px 10px; border-bottom:1px solid #e5e7eb; font-weight:600;">Servicio de Mano de Obra y Calibración</td>
                            <td style="padding:8px 10px; border-bottom:1px solid #e5e7eb; text-align:center;">1 U.</td>
                            <td style="padding:8px 10px; border-bottom:1px solid #e5e7eb; text-align:right;">S/ ${o.costo_servicio.toFixed(2)}</td>
                        </tr>
                        ${repuestos.map(r => `
                            <tr>
                                <td style="padding:8px 10px; border-bottom:1px solid #e5e7eb;">Repuesto: ${r.producto_nombre}</td>
                                <td style="padding:8px 10px; border-bottom:1px solid #e5e7eb; text-align:center;">${r.cantidad} U.</td>
                                <td style="padding:8px 10px; border-bottom:1px solid #e5e7eb; text-align:right;">S/ ${(r.cantidad * r.precio_aplicado).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="display:flex; justify-content:flex-end; margin-bottom:40px;">
                <div style="width:250px;">
                    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;">Mano de Obra</span>
                        <span style="font-weight:700;">S/ ${o.costo_servicio.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;">Repuestos Utilizados</span>
                        <span style="font-weight:700;">S/ ${totalRepuestos.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:14px; font-weight:800; color:#059669;">
                        <span>Total Pagado</span>
                        <span>S/ ${o.total_pagar.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div style="border-top:1px solid #e5e7eb; padding-top:16px; text-align:center; color:#9ca3af; font-size:10px; line-height:1.4;">
                <p style="margin:0;">Esta constancia acredita que el equipo fue entregado a satisfacción del cliente.</p>
                <p style="margin:2px 0 0; color:#059669; font-weight:700;">La garantía cubre defectos de fabricación en los componentes reemplazados hasta el ${garantiaVenceStr}.</p>
            </div>
        `;

        const opt = {
            margin:       10,
            filename:     `OrdenSalida_Garantia_${String(o.id).padStart(5, '0')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(printContainer).save();
    } catch (err) {
        console.error(err);
        mostrarToast("Error al exportar PDF de garantía.", "danger");
    }
}
