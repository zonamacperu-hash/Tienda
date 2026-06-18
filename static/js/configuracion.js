/* ==============================================================================
   MÓDULO: CONFIGURACIÓN GENERAL Y PARAMETRIZACIÓN
   ============================================================================== */

let configActual = {};
let usuariosSistema = [];

async function renderConfiguracion(container) {
    container.innerHTML = `
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:24px; align-items:start;">
            
            <div style="display:flex; flex-direction:column; gap:24px;">
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
                
                <!-- Logotipo de la Empresa (Carga y Previsualización) -->
                <div class="card">
                    <div class="card-title">Logotipo de la Empresa</div>
                    <div style="display:flex; flex-direction:column; gap:16px;">
                        <div style="font-size:0.8rem; color:var(--text-muted);">
                            Arrastre o seleccione el logotipo oficial del negocio para renderizarlo dinámicamente en la barra lateral y en los reportes PDF. (Formatos: PNG, JPG, JPEG. Máx: 2 MB).
                        </div>
                        <div style="display:flex; gap:24px; align-items:center; flex-wrap:wrap;">
                            <!-- Zona Drop/Preview -->
                            <div id="logo-dropzone" style="flex:1; min-width:240px; height:160px; border:2px dashed var(--border-color); border-radius:var(--radius-md); display:flex; flex-direction:column; justify-content:center; align-items:center; cursor:pointer; position:relative; overflow:hidden; transition: all 0.2s ease;">
                                <input type="file" id="logo-file-input" accept="image/png, image/jpeg, image/jpg" style="display:none;" />
                                <div id="logo-dropzone-prompt" style="text-align:center; padding:16px; pointer-events:none;">
                                    <i data-lucide="image" style="width:36px; height:36px; color:var(--text-muted); margin-bottom:8px;"></i>
                                    <div style="font-size:0.85rem; font-weight:600;">Arrastre su imagen aquí</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">o haga clic para buscar en el disco</div>
                                </div>
                                <img id="logo-preview-img" style="display:none; width:100%; height:100%; object-fit:contain; padding:8px; pointer-events:none;" />
                            </div>
                            
                            <!-- Información y Acciones -->
                            <div style="display:flex; flex-direction:column; gap:14px; flex:1; min-width:200px;">
                                <div style="font-size:0.85rem; background-color:rgba(255,255,255,0.02); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                                    <div style="font-weight:700; margin-bottom:4px;">Estado del Logotipo:</div>
                                    <span id="logo-status-text" style="font-family:monospace; font-weight:bold; color:var(--text-muted);">Sin logotipo</span>
                                </div>
                                <div style="display:flex; gap:10px;">
                                    <button class="btn btn-secondary" type="button" id="btn-remover-logo" style="display:none; padding:8px 14px; font-size:0.8rem; border-color:rgba(239,68,68,0.2); color:var(--color-danger);">
                                        <i data-lucide="trash-2" style="width:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Eliminar
                                    </button>
                                    <button class="btn btn-primary" type="button" id="btn-subir-logo" style="display:none; padding:8px 14px; font-size:0.8rem;">
                                        <i data-lucide="upload" style="width:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Subir Logotipo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Restablecer Sistema -->
                <div class="card" style="border-color: var(--color-danger); background-color: rgba(239, 68, 68, 0.02);">
                    <div class="card-title" style="color: var(--color-danger);">Zona de Peligro</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:16px;">
                        Restablece el sistema por completo. Se eliminarán permanentemente todos los productos, categorías, clientes, proveedores, ventas, compras, movimientos y créditos de la base de datos, dejando el sistema en blanco.
                    </div>
                    <button class="btn btn-danger" type="button" id="btn-reset-sistema" style="background-color: var(--color-danger); border-color: var(--color-danger); color: white;">
                        <i data-lucide="refresh-cw"></i> Restablecer Sistema Completo
                    </button>
                </div>
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
    document.getElementById('btn-reset-sistema').addEventListener('click', restablecerSistemaCompleto);

    // Eventos del Logotipo
    const dropzone = document.getElementById('logo-dropzone');
    const fileInput = document.getElementById('logo-file-input');
    const previewImg = document.getElementById('logo-preview-img');
    const promptDiv = document.getElementById('logo-dropzone-prompt');
    const btnSubir = document.getElementById('btn-subir-logo');
    const btnRemover = document.getElementById('btn-remover-logo');
    const statusText = document.getElementById('logo-status-text');

    if (dropzone) {
        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-primary)';
            dropzone.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.backgroundColor = 'transparent';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--border-color)';
            dropzone.style.backgroundColor = 'transparent';
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleSelectedLogoFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                handleSelectedLogoFile(fileInput.files[0]);
            }
        });
    }

    function handleSelectedLogoFile(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            mostrarToast("Solo se permiten imágenes en formato PNG, JPG o JPEG.", "danger");
            fileInput.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            mostrarToast("El archivo excede el tamaño máximo permitido de 2 MB.", "danger");
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (previewImg) {
                previewImg.src = e.target.result;
                previewImg.style.display = 'block';
            }
            if (promptDiv) promptDiv.style.display = 'none';
            if (btnSubir) btnSubir.style.display = 'inline-flex';
            if (statusText) {
                statusText.textContent = `${file.name} (Listo para subir)`;
                statusText.style.color = 'var(--color-warning)';
            }
        };
        reader.readAsDataURL(file);
    }

    if (btnSubir) {
        btnSubir.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('logo', file);

            try {
                if (statusText) {
                    statusText.textContent = "Subiendo...";
                    statusText.style.color = 'var(--color-warning)';
                }
                const res = await fetch(`${API_URL}/api/config/logo`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                const data = await res.json();
                if (data.exito) {
                    mostrarToast(data.mensaje, "success");
                    if (btnSubir) btnSubir.style.display = 'none';
                    if (btnRemover) btnRemover.style.display = 'inline-flex';
                    if (statusText) {
                        statusText.textContent = "Guardado en servidor";
                        statusText.style.color = 'var(--color-success)';
                    }
                    configActual.logo_path = data.logo_path;
                    if (typeof cargarLogoEmpresa === 'function') {
                        await cargarLogoEmpresa();
                    }
                } else {
                    mostrarToast(data.mensaje, "danger");
                    if (statusText) {
                        statusText.textContent = "Error al subir";
                        statusText.style.color = 'var(--color-danger)';
                    }
                }
            } catch (err) {
                console.error(err);
                mostrarToast("Error de conexión al subir el logotipo.", "danger");
                if (statusText) {
                    statusText.textContent = "Error de conexión";
                    statusText.style.color = 'var(--color-danger)';
                }
            }
        });
    }

    if (btnRemover) {
        btnRemover.addEventListener('click', async () => {
            if (!confirm("¿Está seguro de que desea eliminar el logotipo de la empresa?")) return;

            try {
                const res = await fetch(`${API_URL}/api/config/logo`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (data.exito) {
                    mostrarToast(data.mensaje, "success");
                    if (fileInput) fileInput.value = '';
                    if (previewImg) {
                        previewImg.src = '';
                        previewImg.style.display = 'none';
                    }
                    if (promptDiv) promptDiv.style.display = 'block';
                    if (btnSubir) btnSubir.style.display = 'none';
                    if (btnRemover) btnRemover.style.display = 'none';
                    if (statusText) {
                        statusText.textContent = "Sin logotipo";
                        statusText.style.color = 'var(--text-muted)';
                    }
                    configActual.logo_path = null;
                    if (typeof cargarLogoEmpresa === 'function') {
                        await cargarLogoEmpresa();
                    }
                } else {
                    mostrarToast(data.mensaje, "danger");
                }
            } catch (err) {
                console.error(err);
                mostrarToast("Error de conexión al eliminar el logotipo.", "danger");
            }
        });
    }

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
            
            // Actualizar interfaz del logo
            const previewImg = document.getElementById('logo-preview-img');
            const promptDiv = document.getElementById('logo-dropzone-prompt');
            const btnRemover = document.getElementById('btn-remover-logo');
            const btnSubir = document.getElementById('btn-subir-logo');
            const statusText = document.getElementById('logo-status-text');
            
            if (previewImg && promptDiv && statusText) {
                if (configActual.logo_path) {
                    previewImg.src = `${API_URL}${configActual.logo_path}`;
                    previewImg.style.display = 'block';
                    promptDiv.style.display = 'none';
                    if (btnRemover) btnRemover.style.display = 'inline-flex';
                    if (btnSubir) btnSubir.style.display = 'none';
                    statusText.textContent = "Guardado en servidor";
                    statusText.style.color = 'var(--color-success)';
                } else {
                    previewImg.src = '';
                    previewImg.style.display = 'none';
                    promptDiv.style.display = 'block';
                    if (btnRemover) btnRemover.style.display = 'none';
                    if (btnSubir) btnSubir.style.display = 'none';
                    statusText.textContent = "Sin logotipo";
                    statusText.style.color = 'var(--text-muted)';
                }
            }
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

async function restablecerSistemaCompleto() {
    if (!confirm("⚠️ ADVERTENCIA CRÍTICA:\n\n¿Está seguro de que desea restablecer el sistema por completo?\n\nEsta acción borrará permanentemente todos los productos, categorías, clientes, compras, ventas, kárdex y créditos. No se puede deshacer.")) {
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/config/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        
        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            // Cerrar sesión y recargar para refrescar la app
            localStorage.removeItem('erp_session');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error de conexión al restablecer el sistema.", "danger");
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
