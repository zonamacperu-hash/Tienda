/* ==============================================================================
   MÓDULO: INVENTARIO (Gestión de Productos, Categorías y Números de Serie)
   ============================================================================== */

let globalProductos = [];
let globalCategorias = [];

async function renderInventario(container) {
    container.innerHTML = `
        <div style="display: flex; gap: 24px; margin-bottom: 24px; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btn-nuevo-producto">
                <i data-lucide="plus-circle"></i> Nuevo Producto
            </button>
            <button class="btn btn-secondary" id="btn-gestion-categorias">
                <i data-lucide="folder"></i> Gestionar Categorías
            </button>
            <button class="btn btn-success" id="btn-exportar-inventario">
                <i data-lucide="download"></i> Exportar a Excel
            </button>
        </div>

        <div class="card" style="flex-grow: 1;">
            <div class="table-actions">
                <div class="search-box">
                    <i data-lucide="search" class="search-icon" style="width:16px;"></i>
                    <input type="text" class="form-input" id="inventario-search" placeholder="Buscar por nombre o descripción...">
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <label class="form-label" style="margin-bottom:0;">Categoría:</label>
                    <select class="form-select" id="filter-categoria" style="width:200px;">
                        <option value="">Todas</option>
                    </select>
                </div>
            </div>

            <div class="table-container">
                <table class="data-table" id="tabla-productos">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Categoría</th>
                            <th>Nombre</th>
                            <th>Series</th>
                            <th style="text-align:right;">Stock Min.</th>
                            <th style="text-align:right;">Stock Act.</th>
                            <th style="text-align:right;">Precio Costo</th>
                            <th style="text-align:right;">Precio Venta</th>
                            <th style="text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="lista-productos-body">
                        <tr>
                            <td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">
                                Cargando catálogo de productos...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Cargar datos
    await cargarProductos();
    await cargarCategorias();

    // Eventos
    document.getElementById('inventario-search').addEventListener('input', filtrarProductos);
    document.getElementById('filter-categoria').addEventListener('change', filtrarProductos);
    document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto());
    document.getElementById('btn-gestion-categorias').addEventListener('click', () => abrirModalCategorias());
    document.getElementById('btn-exportar-inventario').addEventListener('click', exportarInventarioExcel);
    
    lucide.createIcons();
}

async function cargarProductos() {
    try {
        const res = await fetch(`${API_URL}/api/productos`);
        globalProductos = await res.json();
        renderTablaProductos(globalProductos);
    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo obtener la lista de productos.", "danger");
    }
}

async function cargarCategorias() {
    try {
        const res = await fetch(`${API_URL}/api/categorias`);
        globalCategorias = await res.json();
        
        // Cargar opciones de filtro
        const filterSelect = document.getElementById('filter-categoria');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Todas</option>' + 
                globalCategorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }
    } catch (err) {
        console.error(err);
    }
}

function renderTablaProductos(productos) {
    const tbody = document.getElementById('lista-productos-body');
    if (!tbody) return;

    if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">No se encontraron productos registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = productos.map(p => {
        const manejaSeriesBadge = p.maneja_series === 1 
            ? '<span class="badge badge-info" style="cursor:pointer;" onclick="verSeriesProducto(' + p.id + ', \'' + p.nombre.replace(/'/g, "\\'") + '\')">Con Series <i data-lucide="eye" style="width:12px; height:12px; margin-left:4px;"></i></span>' 
            : '<span class="badge badge-secondary">Tradicional</span>';

        const stockAlerta = p.stock_actual <= p.stock_minimo 
            ? `<span class="badge badge-danger" style="font-weight:700;">${p.stock_actual} U.</span>` 
            : `<span class="badge badge-success">${p.stock_actual} U.</span>`;

        return `
            <tr>
                <td>${p.id}</td>
                <td style="font-size:0.8rem; color:var(--text-muted);">${p.categoria_nombre || 'Sin categoría'}</td>
                <td style="font-weight:600;">${p.nombre}</td>
                <td>${manejaSeriesBadge}</td>
                <td style="text-align:right;">${p.stock_minimo}</td>
                <td style="text-align:right;">${stockAlerta}</td>
                <td style="text-align:right; font-weight:600;">${formatCurrency(p.precio_base, p.moneda || 'PEN')}</td>
                <td style="text-align:right; font-weight:700; color:var(--color-success);">${formatCurrency(p.precio_final, p.moneda || 'PEN')}</td>
                <td style="text-align:center;">
                    <div style="display:flex; justify-content:center; gap:8px;">
                        <button class="btn btn-secondary btn-icon" onclick="abrirModalProducto(${p.id})" title="Editar"><i data-lucide="edit-3" style="width:16px;"></i></button>
                        <button class="btn btn-secondary btn-icon" style="color:var(--color-danger); border-color:rgba(239,68,68,0.15);" onclick="eliminarProducto(${p.id})" title="Eliminar"><i data-lucide="trash-2" style="width:16px;"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
}

function filtrarProductos() {
    const query = document.getElementById('inventario-search').value.toLowerCase();
    const catId = document.getElementById('filter-categoria').value;

    const filtrados = globalProductos.filter(p => {
        const matchesQuery = p.nombre.toLowerCase().includes(query) || (p.descripcion && p.descripcion.toLowerCase().includes(query));
        const matchesCat = catId === "" || p.categoria_id === parseInt(catId);
        return matchesQuery && matchesCat;
    });

    renderTablaProductos(filtrados);
}

/* ==============================================================================
   FORMULARIO CREACIÓN / EDICIÓN DE PRODUCTOS
   ============================================================================== */
function abrirModalProducto(productoId = null) {
    const prod = productoId ? globalProductos.find(p => p.id === productoId) : null;
    const isEdit = !!prod;

    const titulo = isEdit ? `Editar Producto: ${prod.nombre}` : "Registrar Nuevo Producto";
    
    const optionsCategorias = globalCategorias.map(c => `
        <option value="${c.id}" ${isEdit && prod.categoria_id === c.id ? 'selected' : ''}>${c.nombre}</option>
    `).join('');

    const bodyHtml = `
        <form id="form-producto-modal">
            <div class="form-group">
                <label class="form-label" for="prod-nombre">Nombre del Producto</label>
                <input type="text" class="form-input" id="prod-nombre" value="${isEdit ? prod.nombre : ''}" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="prod-categoria">Categoría</label>
                <select class="form-select" id="prod-categoria" required>
                    <option value="" disabled selected>Seleccione categoría</option>
                    ${optionsCategorias}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="prod-descripcion">Descripción / Notas</label>
                <textarea class="form-textarea" id="prod-descripcion" style="height:60px; min-height:60px;">${isEdit ? prod.descripcion || '' : ''}</textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label" for="prod-moneda">Moneda Base</label>
                <select class="form-select" id="prod-moneda" required>
                    <option value="PEN" ${isEdit && prod.moneda === 'PEN' ? 'selected' : (!isEdit ? 'selected' : '')}>Soles (PEN)</option>
                    <option value="USD" ${isEdit && prod.moneda === 'USD' ? 'selected' : ''}>Dólares (USD)</option>
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="prod-precio-costo">Precio Costo / Mayorista (S/)</label>
                    <input type="number" step="0.01" min="0" class="form-input" id="prod-precio-costo" value="${isEdit ? prod.precio_base : 0.00}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="prod-precio-venta">Precio Cliente Final (S/)</label>
                    <input type="number" step="0.01" min="0" class="form-input" id="prod-precio-venta" value="${isEdit ? prod.precio_final : 0.00}" required>
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="prod-stock-minimo">Stock Mínimo Alerta</label>
                    <input type="number" min="0" class="form-input" id="prod-stock-minimo" value="${isEdit ? prod.stock_minimo : 5}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="prod-maneja-series">Tipo de Control</label>
                    <select class="form-select" id="prod-maneja-series" ${isEdit ? 'disabled' : ''}>
                        <option value="0" ${isEdit && prod.maneja_series === 0 ? 'selected' : ''}>Tradicional (Por unidades numéricas)</option>
                        <option value="1" ${isEdit && prod.maneja_series === 1 ? 'selected' : ''}>Trazable por Números de Serie</option>
                    </select>
                    ${isEdit ? '<span style="font-size:0.75rem; color:var(--text-muted);">El tipo de control no puede cambiarse tras crearse.</span>' : ''}
                </div>
            </div>
        </form>
    `;

    const footerHtml = `
        <button class="btn btn-secondary" onclick="closeModal('global-modal')">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-producto">${isEdit ? 'Guardar Cambios' : 'Registrar Producto'}</button>
    `;

    setupGlobalModal(titulo, bodyHtml, footerHtml);

    // Evento para actualizar dinámicamente los prefijos de moneda (S/ o $)
    const selectMoneda = document.getElementById('prod-moneda');
    const labelCosto = document.querySelector('label[for="prod-precio-costo"]');
    const labelVenta = document.querySelector('label[for="prod-precio-venta"]');
    if (selectMoneda && labelCosto && labelVenta) {
        const updateLabels = () => {
            const symbol = selectMoneda.value === 'USD' ? '$' : 'S/';
            labelCosto.textContent = `Precio Costo / Mayorista (${symbol})`;
            labelVenta.textContent = `Precio Cliente Final (${symbol})`;
        };
        selectMoneda.addEventListener('change', updateLabels);
        updateLabels();
    }

    // Evento Guardar
    document.getElementById('btn-guardar-producto').addEventListener('click', async () => {
        const form = document.getElementById('form-producto-modal');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const payload = {
            nombre: document.getElementById('prod-nombre').value,
            categoria_id: parseInt(document.getElementById('prod-categoria').value),
            descripcion: document.getElementById('prod-descripcion').value,
            precio_base: parseFloat(document.getElementById('prod-precio-costo').value),
            precio_final: parseFloat(document.getElementById('prod-precio-venta').value),
            moneda: document.getElementById('prod-moneda').value,
            stock_minimo: parseInt(document.getElementById('prod-stock-minimo').value),
            maneja_series: parseInt(document.getElementById('prod-maneja-series').value) === 1
        };

        const url = isEdit ? `${API_URL}/api/productos/${productoId}` : `${API_URL}/api/productos`;
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
                await cargarProductos();
            } else {
                mostrarToast(data.mensaje, "danger");
            }
        } catch (err) {
            console.error(err);
            mostrarToast("Error en el servidor local.", "danger");
        }
    });
}

async function eliminarProducto(productoId) {
    if (!confirm("¿Está seguro de eliminar este producto? Se eliminarán todas las series vacías asociadas. No se permitirá la eliminación si tiene un historial de ventas o compras.")) return;

    try {
        const res = await fetch(`${API_URL}/api/productos/${productoId}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            await cargarProductos();
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Error de conexión al servidor.", "danger");
    }
}

/* ==============================================================================
   VISUALIZAR DETALLE DE SERIES FÍSICAS DE UN PRODUCTO
   ============================================================================== */
async function verSeriesProducto(productoId, productoNombre) {
    try {
        const res = await fetch(`${API_URL}/api/productos/${productoId}/series`);
        const series = await res.json();

        const badgeColores = {
            'Disponible': 'badge-success',
            'Vendido': 'badge-danger',
            'En Garantia': 'badge-info',
            'Devuelto': 'badge-warning'
        };

        const listaSeriesHtml = series.length === 0 
            ? '<div class="empty-list-message">No se han registrado series físicas para este producto. Realiza una compra para cargarlas.</div>'
            : `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Número de Serie</th>
                                <th>Detalle Físico / Estado</th>
                                <th>Estado</th>
                                <th>F. Registro</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${series.map(s => `
                                <tr>
                                    <td style="font-family:monospace; font-weight:600; font-size:0.95rem;">${s.numero_serie}</td>
                                    <td style="font-size:0.8rem; max-width:220px; word-break:break-word;">${s.detalles_individuales || '<span style="color:var(--text-muted); font-style:italic;">Sin detalles</span>'}</td>
                                    <td><span class="badge ${badgeColores[s.estado] || 'badge-secondary'}">${s.estado}</span></td>
                                    <td style="font-size:0.75rem; color:var(--text-muted);">${formatFecha(s.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

        const bodyHtml = `
            <div style="margin-bottom:16px; font-size:0.85rem; color:var(--text-muted);">
                Mostrando la trazabilidad física individualizada del producto seleccionado.
            </div>
            ${listaSeriesHtml}
        `;

        const footerHtml = `<button class="btn btn-primary" onclick="closeModal('global-modal')">Cerrar</button>`;
        
        setupGlobalModal(`Series de: ${productoNombre}`, bodyHtml, footerHtml);

    } catch (err) {
        console.error(err);
        mostrarToast("No se pudieron consultar las series del producto.", "danger");
    }
}

/* ==============================================================================
   MÓDULO INTERNO: GESTIÓN DE CATEGORÍAS
   ============================================================================== */
async function abrirModalCategorias() {
    await cargarCategorias(); // Recargar últimas
    
    const bodyHtml = `
        <div style="display:flex; gap:16px; margin-bottom:20px; align-items:flex-end;">
            <div class="form-group" style="flex-grow:1; margin-bottom:0;">
                <label class="form-label" for="cat-nuevo-nombre">Nueva Categoría</label>
                <input type="text" class="form-input" id="cat-nuevo-nombre" placeholder="Nombre de categoría" required>
            </div>
            <button class="btn btn-primary" id="btn-agregar-categoria" style="height:42px;">Agregar</button>
        </div>

        <div class="table-container" style="max-height: 250px; overflow-y: auto;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Categoría</th>
                        <th style="text-align:center;">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${globalCategorias.map(c => `
                        <tr>
                            <td style="font-weight:600;">${c.nombre}</td>
                            <td style="text-align:center;">
                                <button class="btn btn-secondary btn-icon" style="color:var(--color-danger); border-color:rgba(239,68,68,0.15); height:28px; width:28px;" onclick="eliminarCategoria(${c.id})" title="Eliminar"><i data-lucide="trash-2" style="width:12px;"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    const footerHtml = `<button class="btn btn-secondary" onclick="closeModal('global-modal')">Listo</button>`;
    
    setupGlobalModal("Gestionar Categorías", bodyHtml, footerHtml);

    // Evento Agregar
    document.getElementById('btn-agregar-categoria').addEventListener('click', async () => {
        const nombreInput = document.getElementById('cat-nuevo-nombre');
        const nombre = nombreInput.value.trim();
        if (!nombre) {
            nombreInput.focus();
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/categorias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre })
            });
            const data = await res.json();
            
            if (data.exito) {
                mostrarToast(data.mensaje, "success");
                await cargarCategorias();
                closeModal('global-modal');
                // Reabrir para refrescar la lista
                setTimeout(() => abrirModalCategorias(), 200);
            } else {
                mostrarToast(data.mensaje, "danger");
            }
        } catch (err) {
            console.error(err);
        }
    });
}

async function eliminarCategoria(catId) {
    if (!confirm("¿Seguro de eliminar esta categoría? No se puede eliminar si contiene productos asociados.")) return;
    try {
        const res = await fetch(`${API_URL}/api/categorias/${catId}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.exito) {
            mostrarToast(data.mensaje, "success");
            await cargarCategorias();
            closeModal('global-modal');
            setTimeout(() => abrirModalCategorias(), 200);
        } else {
            mostrarToast(data.mensaje, "danger");
        }
    } catch (err) {
        console.error(err);
    }
}

/* ==============================================================================
   EXPORTAR INVENTARIO A FORMATO EXCEL
   ============================================================================== */
function exportarInventarioExcel() {
    if (globalProductos.length === 0) {
        mostrarToast("No hay productos en inventario para exportar.", "warning");
        return;
    }

    try {
        const dataExport = globalProductos.map(p => ({
            "ID Producto": p.id,
            "Categoría": p.categoria_nombre || "Sin Categoría",
            "Nombre del Ítem": p.nombre,
            "Descripción": p.descripcion || "",
            "Trazabilidad": p.maneja_series === 1 ? "Control de Series" : "Numérico",
            "Stock Mínimo": p.stock_minimo,
            "Stock Actual": p.stock_actual,
            "Moneda Base": p.moneda || "PEN",
            "Precio Costo": p.precio_base,
            "Precio Venta": p.precio_final,
            "Valor de Almacén": p.precio_base * p.stock_actual
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataExport);

        // Ajustar anchos de columnas
        const max_len = [12, 24, 32, 32, 16, 12, 12, 12, 16, 16, 20];
        ws['!cols'] = max_len.map(w => ({ wch: w }));

        XLSX.utils.book_append_sheet(wb, ws, "Inventario de Stock");
        XLSX.writeFile(wb, `Reporte_Inventario_${new Date().toISOString().slice(0,10)}.xlsx`);
        
        mostrarToast("Reporte Excel exportado de forma limpia y profesional.", "success");
    } catch (err) {
        console.error(err);
        mostrarToast("Fallo al exportar reporte Excel.", "danger");
    }
}
