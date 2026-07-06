/* ==============================================================================
   MÓDULO: CLIENTES, PROVEEDORES Y CUENTAS POR COBRAR/PAGAR
   ============================================================================== */

let globalActores = [];

async function renderActores(container) {
    container.innerHTML = `
        <div style="display: flex; gap: 24px; margin-bottom: 24px; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btn-nuevo-actor">
                <i data-lucide="user-plus"></i> Registrar Cliente / Proveedor
            </button>
        </div>

        <div class="card" style="flex-grow: 1;">
            <div class="table-actions">
                <div class="search-box">
                    <i data-lucide="search" class="search-icon" style="width:16px;"></i>
                    <input type="text" class="form-input" id="actores-search" placeholder="Buscar por DNI/RUC o Nombre...">
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <label class="form-label" style="margin-bottom:0;">Tipo:</label>
                    <select class="form-select" id="filter-actor-tipo" style="width:180px;">
                        <option value="">Todos</option>
                        <option value="Cliente">Clientes</option>
                        <option value="Proveedor">Proveedores</option>
                        <option value="Ambos">Ambos</option>
                    </select>
                </div>
            </div>

            <div class="table-container">
                <table class="data-table" id="tabla-actores">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Tipo</th>
                            <th>Nombre o Razón Social</th>
                            <th>Documento</th>
                            <th>Teléfono</th>
                            <th>Email</th>
                            <th>Dirección</th>
                            <th style="text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="lista-actores-body">
                        <tr>
                            <td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">
                                Cargando catálogo de actores...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Cargar Datos
    await cargarActores();

    // Eventos
    document.getElementById('actores-search').addEventListener('input', filtrarActores);
    document.getElementById('filter-actor-tipo').addEventListener('change', filtrarActores);
    document.getElementById('btn-nuevo-actor').addEventListener('click', () => abrirModalActor());

    lucide.createIcons();
}

async function cargarActores() {
    try {
        const res = await fetch(`${API_URL}/api/actores`);
        globalActores = await res.json();
        renderTablaActores(globalActores);
    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo obtener la lista de actores.", "danger");
    }
}

function renderTablaActores(actores) {
    const tbody = document.getElementById('lista-actores-body');
    if (!tbody) return;

    if (actores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">No se encontraron clientes o proveedores registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = actores.map(a => {
        const tipoBadgeClass = {
            'Cliente': 'badge-success',
            'Proveedor': 'badge-warning',
            'Ambos': 'badge-info'
        }[a.tipo] || 'badge-secondary';

        return `
            <tr>
                <td>${a.id}</td>
                <td><span class="badge ${tipoBadgeClass}">${a.tipo}</span></td>
                <td style="font-weight:600;">${a.nombre_razon_social}</td>
                <td style="font-family:monospace; font-weight:600;">${a.tipo_documento}: ${a.documento_identidad}</td>
                <td>${a.telefono || '-'}</td>
                <td style="font-size:0.85rem; color:var(--text-muted);">${a.email || '-'}</td>
                <td style="font-size:0.85rem; color:var(--text-muted); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.direccion || '-'}</td>
                <td style="text-align:center;">
                    <div style="display:flex; justify-content:center; gap:8px;">
                        <button class="btn btn-secondary btn-icon" style="color:var(--color-info); border-color:rgba(6,182,212,0.15);" onclick="verCuentasActor(${a.id}, '${a.nombre_razon_social.replace(/'/g, "\\'")}', '${a.tipo}')" title="Estado de Cuenta"><i data-lucide="file-text" style="width:16px;"></i></button>
                        <button class="btn btn-secondary btn-icon" onclick="abrirModalActor(${a.id})" title="Editar"><i data-lucide="edit-3" style="width:16px;"></i></button>
                        <button class="btn btn-secondary btn-icon" style="color:var(--color-danger); border-color:rgba(239,68,68,0.15);" onclick="eliminarActor(${a.id})" title="Eliminar"><i data-lucide="trash-2" style="width:16px;"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

function filtrarActores() {
    const query = document.getElementById('actores-search').value.toLowerCase();
    const tipo = document.getElementById('filter-actor-tipo').value;

    const filtrados = globalActores.filter(a => {
        const matchesQuery = a.nombre_razon_social.toLowerCase().includes(query) || a.documento_identidad.includes(query);
        const matchesTipo = tipo === "" || a.tipo === tipo || a.tipo === 'Ambos';
        return matchesQuery && matchesTipo;
    });

    renderTablaActores(filtrados);
}

/* ==============================================================================
   FORMULARIO CREACIÓN / EDICIÓN DE ACTORES
   ============================================================================== */
function abrirModalActor(actorId = null) {
    const actor = actorId ? globalActores.find(a => a.id === actorId) : null;
    const isEdit = !!actor;

    const titulo = isEdit ? `Editar Datos: ${actor.nombre_razon_social}` : "Registrar Cliente / Proveedor";

    const bodyHtml = `
        <form id="form-actor-modal">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="actor-tipo">Tipo de Registro</label>
                    <select class="form-select" id="actor-tipo" required>
                        <option value="Cliente" ${isEdit && actor.tipo === 'Cliente' ? 'selected' : ''}>Cliente</option>
                        <option value="Proveedor" ${isEdit && actor.tipo === 'Proveedor' ? 'selected' : ''}>Proveedor</option>
                        <option value="Ambos" ${isEdit && actor.tipo === 'Ambos' ? 'selected' : ''}>Ambos (Cliente & Proveedor)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="actor-tipo-doc">Tipo Documento</label>
                    <select class="form-select" id="actor-tipo-doc" required>
                        <option value="DNI" ${isEdit && actor.tipo_documento === 'DNI' ? 'selected' : ''}>DNI (Persona Natural)</option>
                        <option value="RUC" ${isEdit && actor.tipo_documento === 'RUC' ? 'selected' : ''}>RUC (Empresa)</option>
                        <option value="CE" ${isEdit && actor.tipo_documento === 'CE' ? 'selected' : ''}>C.E.</option>
                        <option value="Pasaporte" ${isEdit && actor.tipo_documento === 'Pasaporte' ? 'selected' : ''}>Pasaporte</option>
                    </select>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label class="form-label" for="actor-nombre">Nombres / Razón Social</label>
                    <input type="text" class="form-input" id="actor-nombre" value="${isEdit ? actor.nombre_razon_social : ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="actor-documento">Nro. Identidad</label>
                    <input type="text" class="form-input" id="actor-documento" value="${isEdit ? actor.documento_identidad : ''}" required>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="actor-telefono">Teléfono</label>
                    <input type="text" class="form-input" id="actor-telefono" value="${isEdit ? actor.telefono || '' : ''}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="actor-email">Email</label>
                    <input type="email" class="form-input" id="actor-email" value="${isEdit ? actor.email || '' : ''}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label" for="actor-direccion">Dirección Física</label>
                <input type="text" class="form-input" id="actor-direccion" value="${isEdit ? actor.direccion || '' : ''}">
            </div>
        </form>
    `;

    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal('global-modal')">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-actor">${isEdit ? 'Guardar Cambios' : 'Registrar Actor'}</button>
    `;

    setupGlobalModal(titulo, bodyHtml, footerHtml);

    document.getElementById('btn-guardar-actor').addEventListener('click', async () => {
        const form = document.getElementById('form-actor-modal');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            tipo: document.getElementById('actor-tipo').value,
            nombre_razon_social: document.getElementById('actor-nombre').value.trim(),
            tipo_documento: document.getElementById('actor-tipo-doc').value,
            documento_identidad: document.getElementById('actor-documento').value.trim(),
            telefono: document.getElementById('actor-telefono').value.trim(),
            email: document.getElementById('actor-email').value.trim(),
            direccion: document.getElementById('actor-direccion').value.trim()
        };

        const url = isEdit ? `${API_URL}/api/actores/${actorId}` : `${API_URL}/api/actores`;
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.exito) {
                closeModal('global-modal');
                mostrarToast(data.mensaje, "success");
                await cargarActores();
            } else {
                mostrarToast(data.mensaje, "danger");
            }
        } catch (err) {
            console.error(err);
            mostrarToast("Error del servidor.", "danger");
        }
    });
}

async function eliminarActor(actorId) {
    if (!confirm("¿Está seguro de eliminar esta entidad? No se permitirá si contiene transacciones comerciales (ventas o compras).")) return;
    try {
        const res = await fetch(`${API_URL}/api/actores/${actorId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            await cargarActores();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
    }
}

/* ==============================================================================
   VISUALIZAR ESTADO DE CUENTAS (CRÉDITOS Y COBROS)
   ============================================================================== */
async function verCuentasActor(actorId, actorNombre, actorTipo) {
    try {
        const res = await fetch(`${API_URL}/api/actores/${actorId}/estado-cuenta`);
        const data = await res.json();

        const esCliente = actorTipo === 'Cliente' || actorTipo === 'Ambos';
        const esProveedor = actorTipo === 'Proveedor' || actorTipo === 'Ambos';

        let htmlCobrar = '';
        if (esCliente) {
            const deudas = data.por_cobrar;
            htmlCobrar = `
                <div style="font-weight:700; font-size:0.9rem; margin-top:12px; margin-bottom:8px; color:var(--color-primary);">
                    Cuentas por Cobrar (Ventas al Crédito)
                </div>
                ${deudas.length === 0 
                    ? '<div class="empty-list-message">No tiene deudas pendientes como cliente.</div>'
                    : `
                        <div class="table-container" style="max-height:160px; overflow-y:auto; margin-bottom:16px;">
                            <table class="data-table" style="font-size:0.8rem;">
                                <thead>
                                    <tr>
                                        <th>Doc</th>
                                        <th>Vencimiento</th>
                                        <th style="text-align:right;">Monto</th>
                                        <th style="text-align:right;">Pagado</th>
                                        <th style="text-align:right;">Saldo</th>
                                        <th>Estado</th>
                                        <th style="text-align:center;">Abonar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${deudas.map(d => {
                                        const saldo = d.monto_total - d.monto_pagado;
                                        const isPagado = d.estado === 'Pagado';
                                        const badg = isPagado ? 'badge-success' : 'badge-danger';
                                        
                                        const btnAbonar = !isPagado 
                                            ? `<button class="btn btn-success" style="padding:4px 8px; font-size:0.75rem;" onclick="abrirModalAbono('cobrar', ${d.venta_id}, ${saldo}, ${actorId}, '${actorNombre.replace(/'/g, "\\'")}', '${d.moneda || 'PEN'}')">Abonar</button>`
                                            : '-';
                                            
                                        return `
                                            <tr>
                                                <td style="font-weight:600;">${d.documento}</td>
                                                <td>${d.fecha_vencimiento}</td>
                                                <td style="text-align:right;">${formatCurrency(d.monto_total, d.moneda || 'PEN')}</td>
                                                <td style="text-align:right; color:var(--color-success);">${formatCurrency(d.monto_pagado, d.moneda || 'PEN')}</td>
                                                <td style="text-align:right; font-weight:700; color:var(--color-warning);">${formatCurrency(saldo, d.moneda || 'PEN')}</td>
                                                <td><span class="badge ${badg}">${d.estado}</span></td>
                                                <td style="text-align:center;">${btnAbonar}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `
                }
            `;
        }

        let htmlPagar = '';
        if (esProveedor) {
            const deudas = data.por_pagar;
            htmlPagar = `
                <div style="font-weight:700; font-size:0.9rem; margin-top:12px; margin-bottom:8px; color:var(--color-warning);">
                    Cuentas por Pagar (Compras al Crédito)
                </div>
                ${deudas.length === 0 
                    ? '<div class="empty-list-message">No tenemos deudas pendientes con este proveedor.</div>'
                    : `
                        <div class="table-container" style="max-height:160px; overflow-y:auto; margin-bottom:16px;">
                            <table class="data-table" style="font-size:0.8rem;">
                                <thead>
                                    <tr>
                                        <th>Doc</th>
                                        <th>Vencimiento</th>
                                        <th style="text-align:right;">Monto</th>
                                        <th style="text-align:right;">Pagado</th>
                                        <th style="text-align:right;">Saldo</th>
                                        <th>Estado</th>
                                        <th style="text-align:center;">Abonar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${deudas.map(d => {
                                        const saldo = d.monto_total - d.monto_pagado;
                                        const isPagado = d.estado === 'Pagado';
                                        const badg = isPagado ? 'badge-success' : 'badge-danger';
                                        
                                        const btnAbonar = !isPagado 
                                            ? `<button class="btn btn-success" style="padding:4px 8px; font-size:0.75rem;" onclick="abrirModalAbono('pagar', ${d.compra_id}, ${saldo}, ${actorId}, '${actorNombre.replace(/'/g, "\\'")}', '${d.moneda || 'PEN'}')">Registrar Pago</button>`
                                            : '-';
                                            
                                        return `
                                            <tr>
                                                <td style="font-weight:600;">${d.documento}</td>
                                                <td>${d.fecha_vencimiento}</td>
                                                <td style="text-align:right;">${formatCurrency(d.monto_total, d.moneda || 'PEN')}</td>
                                                <td style="text-align:right; color:var(--color-success);">${formatCurrency(d.monto_pagado, d.moneda || 'PEN')}</td>
                                                <td style="text-align:right; font-weight:700; color:var(--color-warning);">${formatCurrency(saldo, d.moneda || 'PEN')}</td>
                                                <td><span class="badge ${badg}">${d.estado}</span></td>
                                                <td style="text-align:center;">${btnAbonar}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `
                }
            `;
        }

        const bodyHtml = `
            <div style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted);">
                Detalle consolidado de créditos otorgados o deudas pendientes.
            </div>
            ${htmlCobrar}
            ${htmlPagar}
        `;

        const footerHtml = `<button class="btn btn-primary" onclick="closeModal('global-modal')">Cerrar</button>`;
        
        setupGlobalModal(`Cuentas de: ${actorNombre}`, bodyHtml, footerHtml);

    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo obtener el estado de cuenta.", "danger");
    }
}

/* ==============================================================================
   REGISTRAR ABONO (AMORTIZACIÓN DE DEUDA)
   ============================================================================== */
function abrirModalAbono(tipo, referenciaId, saldoDeuda, actorId, actorNombre, moneda = 'PEN') {
    closeModal('global-modal'); // Cerrar modal de estado de cuentas previo
    
    const titulo = tipo === 'cobrar' 
        ? `Registrar Cobro: ${actorNombre}` 
        : `Registrar Pago a Proveedor: ${actorNombre}`;

    const labelDeuda = tipo === 'cobrar' ? 'Monto Cobrado' : 'Monto Pagado';

    const bodyHtml = `
        <form id="form-abono-modal">
            <div style="background-color:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); padding:12px; border-radius:6px; margin-bottom:16px; font-size:0.85rem;">
                Deuda pendiente de cobro: <strong>${formatCurrency(saldoDeuda, moneda)}</strong>
            </div>
            <div class="form-group">
                <label class="form-label" for="abono-monto">${labelDeuda}</label>
                <div style="display: flex; align-items: stretch; border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden; background-color: rgba(0,0,0,0.2);">
                    <span style="display: flex; align-items: center; padding: 0 10px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); user-select: none;">${moneda === 'USD' ? '$' : 'S/'}</span>
                    <input type="number" step="0.01" min="0.01" max="${saldoDeuda + 0.01}" class="pos-pago-input" id="abono-monto" value="${saldoDeuda.toFixed(2)}" required style="flex-grow: 1; text-align: right; background: none; border: none; outline: none; padding: 8px 12px; font-size: 0.95rem; font-weight: 700; color: var(--text-main);">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="abono-metodo-pago">Método de Pago</label>
                <select class="form-select" id="abono-metodo-pago" required>
                    <option value="Efectivo" selected>Efectivo</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Yape/Plin">Yape / Plin</option>
                    <option value="Tarjeta">Tarjeta</option>
                </select>
            </div>
        </form>
    `;

    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal('global-modal'); setTimeout(() => verCuentasActor(${actorId}, '${actorNombre.replace(/'/g, "\\'")}', '${tipo === 'cobrar' ? 'Cliente' : 'Proveedor'}'), 200)">Volver</button>
        <button class="btn btn-success" id="btn-procesar-abono">Guardar Abono</button>
    `;

    setTimeout(() => {
        setupGlobalModal(titulo, bodyHtml, footerHtml);
        
        document.getElementById('btn-procesar-abono').addEventListener('click', async () => {
            const form = document.getElementById('form-abono-modal');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const payload = {
                tipo: tipo,
                referencia_id: referenciaId,
                monto_abono: parseFloat(document.getElementById('abono-monto').value),
                metodo_pago: document.getElementById('abono-metodo-pago').value
            };

            try {
                const res = await fetch(`${API_URL}/api/abonos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();

                if (data.exito) {
                    closeModal('global-modal');
                    mostrarToast(data.mensaje, "success");
                    // Reabrir el estado de cuentas refrescado
                    if (vistaActiva === 'cuentas') {
                        setTimeout(() => renderCuentas(document.getElementById('main-view')), 200);
                    } else {
                        setTimeout(() => verCuentasActor(actorId, actorNombre, tipo === 'cobrar' ? 'Cliente' : 'Proveedor'), 200);
                    }
                } else {
                    mostrarToast(data.mensaje, "danger");
                }
            } catch (err) {
                console.error(err);
            }
        });
    }, 250);
}

/* ==============================================================================
   VISTA GLOBAL: CUENTAS Y CRÉDITOS CONSOLIDADOS
   ============================================================================== */
async function renderCuentas(container) {
    container.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start;">
            
            <!-- Cuentas por Cobrar (Clientes) -->
            <div class="card">
                <div class="card-title">
                    <span>Créditos Otorgados (Cuentas por Cobrar)</span>
                    <i data-lucide="arrow-down-left" style="color:var(--color-success); width:20px;"></i>
                </div>
                <div class="table-container" style="max-height: 480px; overflow-y: auto;">
                    <table class="data-table" style="font-size:0.85rem;">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Vence</th>
                                <th style="text-align:right;">Total</th>
                                <th style="text-align:right;">Saldo</th>
                                <th>Estado</th>
                                <th style="text-align:center;">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="global-cuentas-cobrar-body">
                            <tr>
                                <td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">Cargando cobros...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Cuentas por Pagar (Proveedores) -->
            <div class="card">
                <div class="card-title">
                    <span>Deudas con Proveedores (Cuentas por Pagar)</span>
                    <i data-lucide="arrow-up-right" style="color:var(--color-danger); width:20px;"></i>
                </div>
                <div class="table-container" style="max-height: 480px; overflow-y: auto;">
                    <table class="data-table" style="font-size:0.85rem;">
                        <thead>
                            <tr>
                                <th>Proveedor</th>
                                <th>Vence</th>
                                <th style="text-align:right;">Total</th>
                                <th style="text-align:right;">Saldo</th>
                                <th>Estado</th>
                                <th style="text-align:center;">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="global-cuentas-pagar-body">
                            <tr>
                                <td colspan="6" style="text-align:center; padding:16px; color:var(--text-muted);">Cargando pagos...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    `;

    // Cargar datos globales de cuentas
    await cargarCuentasGlobales();
    lucide.createIcons();
}

async function cargarCuentasGlobales() {
    try {
        const res = await fetch(`${API_URL}/api/actores`);
        const actores = await res.json();
        
        let cobrosHtml = '';
        let pagosHtml = '';

        for (const actor of actores) {
            const resCuenta = await fetch(`${API_URL}/api/actores/${actor.id}/estado-cuenta`);
            const cuenta = await resCuenta.json();

            // Cobrar
            cuenta.por_cobrar.forEach(d => {
                const saldo = d.monto_total - d.monto_pagado;
                const isPagado = d.estado === 'Pagado';
                const badg = isPagado ? 'badge-success' : 'badge-danger';
                
                const btnAbonar = !isPagado 
                    ? `<button class="btn btn-success" style="padding:4px 8px; font-size:0.75rem;" onclick="abrirModalAbono('cobrar', ${d.venta_id}, ${saldo}, ${actor.id}, '${actor.nombre_razon_social.replace(/'/g, "\\'")}', '${d.moneda || 'PEN'}')">Abonar</button>`
                    : '-';

                cobrosHtml += `
                    <tr>
                        <td style="font-weight:600;">${actor.nombre_razon_social}</td>
                        <td>${d.fecha_vencimiento}</td>
                        <td style="text-align:right;">${formatCurrency(d.monto_total, d.moneda || 'PEN')}</td>
                        <td style="text-align:right; font-weight:700; color:var(--color-warning);">${formatCurrency(saldo, d.moneda || 'PEN')}</td>
                        <td><span class="badge ${badg}">${d.estado}</span></td>
                        <td style="text-align:center;">${btnAbonar}</td>
                    </tr>
                `;
            });

            // Pagar
            cuenta.por_pagar.forEach(d => {
                const saldo = d.monto_total - d.monto_pagado;
                const isPagado = d.estado === 'Pagado';
                const badg = isPagado ? 'badge-success' : 'badge-danger';
                
                const btnAbonar = !isPagado 
                    ? `<button class="btn btn-success" style="padding:4px 8px; font-size:0.75rem;" onclick="abrirModalAbono('pagar', ${d.compra_id}, ${saldo}, ${actor.id}, '${actor.nombre_razon_social.replace(/'/g, "\\'")}', '${d.moneda || 'PEN'}')">Pagar</button>`
                    : '-';

                pagosHtml += `
                    <tr>
                        <td style="font-weight:600;">${actor.nombre_razon_social}</td>
                        <td>${d.fecha_vencimiento}</td>
                        <td style="text-align:right;">${formatCurrency(d.monto_total, d.moneda || 'PEN')}</td>
                        <td style="text-align:right; font-weight:700; color:var(--color-warning);">${formatCurrency(saldo, d.moneda || 'PEN')}</td>
                        <td><span class="badge ${badg}">${d.estado}</span></td>
                        <td style="text-align:center;">${btnAbonar}</td>
                    </tr>
                `;
            });
        }

        const tbodyCobrar = document.getElementById('global-cuentas-cobrar-body');
        const tbodyPagar = document.getElementById('global-cuentas-pagar-body');

        if (tbodyCobrar) {
            tbodyCobrar.innerHTML = cobrosHtml || '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No hay créditos por cobrar en el sistema.</td></tr>';
        }
        if (tbodyPagar) {
            tbodyPagar.innerHTML = pagosHtml || '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No hay cuentas pendientes por pagar.</td></tr>';
        }

    } catch (err) {
        console.error(err);
        mostrarToast("Fallo al obtener balance de deudas consolidado.", "danger");
    }
}

