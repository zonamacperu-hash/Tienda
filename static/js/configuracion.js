/* ==============================================================================
   MÓDULO: CONFIGURACIÓN GENERAL Y PARAMETRIZACIÓN
   ============================================================================== */

let configActual = {};
let usuariosSistema = [];

async function renderConfiguracion(container) {
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:24px; align-items:start;">
            
            <!-- Datos de la Empresa y T.C. -->
            <div class="card">
                <div class="card-title">Datos de la Empresa & Tipo de Cambio</div>
                <form id="form-configuracion-empresa">
                    <div class="form-row">
                        <div class="form-group" style="flex:2;">
                            <label class="form-label" for="config-empresa">Nombre o Razón Social</label>
                            <input type="text" class="form-input" id="config-empresa" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="config-ruc">RUC</label>
                            <input type="text" class="form-input" id="config-ruc" maxlength="11" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" for="config-direccion">Dirección Fiscal</label>
                        <input type="text" class="form-input" id="config-direccion">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="config-telefono">Teléfono</label>
                            <input type="text" class="form-input" id="config-telefono">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="config-email">Email Corporativo</label>
                            <input type="email" class="form-input" id="config-email">
                        </div>
                    </div>

                    <div class="form-row" style="border-top:1px dashed var(--border-color); padding-top:16px; margin-top:12px;">
                        <div class="form-group">
                            <label class="form-label" for="config-moneda">Moneda por Defecto</label>
                            <select class="form-select" id="config-moneda" required>
                                <option value="PEN">Soles (PEN)</option>
                                <option value="USD">Dólares (USD)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="config-tc-diario" style="color:var(--color-warning); font-weight:bold;">Tipo de Cambio del Día (Soles/Dólar)</label>
                            <input type="number" step="0.0001" min="0.01" class="form-input" id="config-tc-diario" required>
                        </div>
                    </div>

                    <div style="margin-top:20px; display:flex; justify-content:flex-end;">
                        <button class="btn btn-primary" type="button" id="btn-guardar-config">
                            <i data-lucide="save"></i> Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>

            <!-- Panel Lateral de Auditoría o Historial -->
            <div class="card" style="height: 100%;">
                <div class="card-title">Historial de Cambio</div>
                <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">
                    Monitoreo de variaciones en la tasa de cambio local de este ERP/POS.
                </div>
                <div class="stock-alerts-list" id="config-tc-history-container" style="max-height: 250px;">
                    <div class="empty-list-message">Sin registros históricos de TC.</div>
                </div>
            </div>

        </div>

        <!-- Módulo de Usuarios y Roles -->
        <div class="card" style="margin-top:24px;">
            <div class="card-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Gestión de Usuarios & Permisos</span>
                <button class="btn btn-primary" id="btn-nuevo-usuario" style="padding:6px 12px; font-size:0.8rem;">
                    <i data-lucide="user-plus"></i> Registrar Colaborador
                </button>
            </div>
            
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre Completo</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Rol / Permisos</th>
                            <th>Estado</th>
                            <th style="text-align:center;">Cambiar Estado</th>
                        </tr>
                    </thead>
                    <tbody id="config-usuarios-tbody">
                        <tr>
                            <td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Cargando colaboradores...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Cargar datos
    await cargarConfiguracion();
    await cargarUsuarios();

    // Eventos
    document.getElementById('btn-guardar-config').addEventListener('click', guardarConfiguracion);
    document.getElementById('btn-nuevo-usuario').addEventListener('click', abrirModalNuevoUsuario);

    lucide.createIcons();
}

async function cargarConfiguracion() {
    try {
        const res = await fetch(`${API_URL}/api/config`);
        configActual = await res.json();
        
        if (configActual) {
            document.getElementById('config-empresa').value = configActual.empresa_nombre || '';
            document.getElementById('config-ruc').value = configActual.empresa_ruc || '';
            document.getElementById('config-direccion').value = configActual.empresa_direccion || '';
            document.getElementById('config-telefono').value = configActual.empresa_telefono || '';
            document.getElementById('config-email').value = configActual.empresa_email || '';
            document.getElementById('config-moneda').value = configActual.moneda_defecto || 'PEN';
            document.getElementById('config-tc-diario').value = configActual.tipo_cambio_actual || 3.7500;
        }

        // Historial de TC
        const resHist = await fetch(`${API_URL}/api/config/tc-historial`);
        const historial = await resHist.json();
        const container = document.getElementById('config-tc-history-container');
        
        if (container) {
            if (historial.length === 0) {
                container.innerHTML = '<div class="empty-list-message">Sin registros históricos de TC.</div>';
            } else {
                container.innerHTML = historial.map(h => `
                    <div class="stock-alert-item" style="border-color:rgba(6,182,212,0.15); background-color:rgba(6,182,212,0.01);">
                        <div class="alert-product-info">
                            <span class="alert-product-name" style="color:var(--color-info);">S/ ${parseFloat(h.tipo_cambio).toFixed(4)} por $1.00</span>
                            <span class="alert-product-limits">Fecha: ${h.fecha}</span>
                        </div>
                        <span style="font-size:0.75rem; color:var(--text-muted);">Admin</span>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error(err);
    }
}

async function guardarConfiguracion() {
    const form = document.getElementById('form-configuracion-empresa');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const payload = {
        empresa_nombre: document.getElementById('config-empresa').value.trim(),
        empresa_ruc: document.getElementById('config-ruc').value.trim(),
        empresa_direccion: document.getElementById('config-direccion').value.trim(),
        empresa_telefono: document.getElementById('config-telefono').value.trim(),
        empresa_email: document.getElementById('config-email').value.trim(),
        moneda_defecto: document.getElementById('config-moneda').value,
        tipo_cambio_actual: parseFloat(document.getElementById('config-tc-diario').value),
        usuario_id: usuarioActivo.id
    };

    try {
        const res = await fetch(`${API_URL}/api/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            // Actualizar tipo de cambio global de forma inmediata en la cabecera
            await obtenerTipoCambioGlobal();
            await cargarConfiguracion();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo guardar la configuración.", "danger");
    }
}

/* ==============================================================================
   GESTIÓN DE COLABORADORES (USUARIOS Y ROLES)
   ============================================================================== */
async function cargarUsuarios() {
    const tbody = document.getElementById('config-usuarios-tbody');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/api/usuarios`);
        usuariosSistema = await res.json();

        if (usuariosSistema.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No hay otros usuarios registrados.</td></tr>';
            return;
        }

        tbody.innerHTML = usuariosSistema.map(u => {
            const isAct = u.activo === 1;
            const badgeClass = isAct ? 'badge-success' : 'badge-danger';
            const estadoTexto = isAct ? 'Activo' : 'Inactivo';
            
            const btnToggle = isAct 
                ? `<button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; color:var(--color-danger); border-color:rgba(239,68,68,0.2);" onclick="toggleUsuarioEstado(${u.id}, 0)">Desactivar</button>`
                : `<button class="btn btn-success" style="padding:4px 8px; font-size:0.75rem;" onclick="toggleUsuarioEstado(${u.id}, 1)">Activar</button>`;

            return `
                <tr>
                    <td>${u.id}</td>
                    <td style="font-weight:600;">${u.nombre}</td>
                    <td style="font-family:monospace; font-weight:600;">${u.username}</td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-info">${u.rol}</span></td>
                    <td><span class="badge ${badgeClass}">${estadoTexto}</span></td>
                    <td style="text-align:center;">${u.id === usuarioActivo.id ? '-' : btnToggle}</td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Módulo de usuarios disponible tras iniciar servidor API.</td></tr>';
    }
}

function abrirModalNuevoUsuario() {
    const bodyHtml = `
        <form id="form-usuario-modal">
            <div class="form-group">
                <label class="form-label" for="usr-nombre">Nombre Completo</label>
                <input type="text" class="form-input" id="usr-nombre" placeholder="Nombre completo" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="usr-email">Correo Electrónico</label>
                <input type="email" class="form-input" id="usr-email" placeholder="colaborador@tecnoperu.com" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="usr-username">Usuario de Acceso</label>
                    <input type="text" class="form-input" id="usr-username" placeholder="Nombre de usuario" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="usr-password">Contraseña inicial</label>
                    <input type="password" class="form-input" id="usr-password" placeholder="Mínimo 6 caracteres" minlength="6" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="usr-rol">Rol / Privilegios</label>
                <select class="form-select" id="usr-rol" required>
                    <option value="Vendedor" selected>Vendedor (POS y clientes)</option>
                    <option value="Almacenero">Almacenero (Inventario y compras)</option>
                    <option value="Administrador">Administrador (Acceso total)</option>
                </select>
            </div>
        </form>
    `;

    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal('global-modal')">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-usuario">Registrar Colaborador</button>
    `;

    setupGlobalModal("Registrar Colaborador", bodyHtml, footerHtml);

    document.getElementById('btn-guardar-usuario').addEventListener('click', async () => {
        const form = document.getElementById('form-usuario-modal');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            nombre: document.getElementById('usr-nombre').value.trim(),
            email: document.getElementById('usr-email').value.trim(),
            username: document.getElementById('usr-username').value.trim(),
            password: document.getElementById('usr-password').value,
            rol: document.getElementById('usr-rol').value
        };

        try {
            const res = await fetch(`${API_URL}/api/usuarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.exito) {
                closeModal('global-modal');
                mostrarToast(data.mensaje, "success");
                await cargarUsuarios();
            } else {
                mostrarToast(data.mensaje, "danger");
            }
        } catch (err) {
            console.error(err);
            mostrarToast("Fallo al crear usuario.", "danger");
        }
    });
}

async function toggleUsuarioEstado(usuarioId, activo) {
    if (!confirm(`¿Está seguro de cambiar el estado de este colaborador a ${activo === 1 ? 'Activo' : 'Inactivo'}?`)) return;

    try {
        const res = await fetch(`${API_URL}/api/usuarios/${usuarioId}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo })
        });
        const data = await res.json();

        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            await cargarUsuarios();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
    }
}
