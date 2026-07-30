/* ==============================================================================
   MÓDULO: RESUMEN DE MOVIMIENTOS DE PRODUCTOS (KÁRDEX DE INVENTARIO)
   ============================================================================== */

let globalMovimientos = [];
let listadoProductosKardex = [];
let listadoClientesKardex = [];

async function renderMovimientos(container) {
    container.innerHTML = `
        <div class="card" style="margin-bottom: 24px;">
            <div class="card-title">Filtros Avanzados de Búsqueda</div>
            <form id="form-filtros-movimientos" onsubmit="event.preventDefault(); filtrarMovimientosKardex();" style="display:flex; flex-direction:column; gap:16px;">
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
                    <!-- Rango de Fechas -->
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.75rem;">Fecha de Inicio</label>
                        <input type="date" class="form-input" id="filtro-mov-fecha-inicio" style="padding:8px 12px; font-size:0.85rem;">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.75rem;">Fecha de Fin</label>
                        <input type="date" class="form-input" id="filtro-mov-fecha-fin" style="padding:8px 12px; font-size:0.85rem;">
                    </div>
                    
                    <!-- Categoría -->
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.75rem;">Categoría</label>
                        <select class="form-select" id="filtro-mov-categoria" style="padding:8px 12px; font-size:0.85rem;">
                            <option value="">Todas las Categorías</option>
                        </select>
                    </div>

                    <!-- Usuario / Operador -->
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.75rem;">Operador / Usuario</label>
                        <select class="form-select" id="filtro-mov-usuario" style="padding:8px 12px; font-size:0.85rem;">
                            <option value="">Todos los Usuarios</option>
                        </select>
                    </div>

                    <!-- Producto Autocomplete -->
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.75rem;">Producto</label>
                        <input type="text" list="productos-mov-datalist" class="form-input" id="filtro-mov-producto-input" placeholder="Buscar producto..." style="padding:8px 12px; font-size:0.85rem;">
                        <datalist id="productos-mov-datalist"></datalist>
                    </div>

                    <!-- Cliente Autocomplete -->
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.75rem;">Filtrar por Cliente / Comprador</label>
                        <input type="text" list="clientes-mov-datalist" class="form-input" id="filtro-mov-cliente-input" placeholder="Buscar cliente o comprador..." style="padding:8px 12px; font-size:0.85rem;">
                        <datalist id="clientes-mov-datalist"></datalist>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; align-items: flex-end;">
                    <!-- Tipo de Movimiento -->
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.75rem;">Tipo de Movimiento</label>
                        <select class="form-select" id="filtro-mov-tipo" style="padding:8px 12px; font-size:0.85rem;">
                            <option value="Todos" selected>Todos los Movimientos</option>
                            <option value="Entrada">Solo Entradas (Compras)</option>
                            <option value="Salida">Solo Salidas (Ventas)</option>
                        </select>
                    </div>

                    <!-- Número de Serie -->
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label" style="font-size:0.75rem;">Número de Serie</label>
                        <input type="text" class="form-input" id="filtro-mov-serie" placeholder="Ej: SN-ASUS-..." style="font-family:monospace; padding:8px 12px; font-size:0.85rem;">
                    </div>

                    <!-- Botones de Acción -->
                    <div style="display:flex; gap:10px; grid-column: span 2; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" onclick="limpiarFiltrosMovimientos()" style="height:40px;">
                            <i data-lucide="rotate-ccw" style="width:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Limpiar
                        </button>
                        <button type="submit" class="btn btn-primary" style="height:40px;">
                            <i data-lucide="filter" style="width:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Filtrar
                        </button>
                    </div>
                </div>
            </form>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
            <div style="font-size:0.9rem; color:var(--text-muted);">
                Mostrando <strong id="kardex-count" style="color:var(--color-primary);">0</strong> registro(s) en kárdex.
            </div>
            <div style="display:flex; gap:12px;">
                <button class="btn btn-secondary" onclick="exportarKardexPDF()">
                    <i data-lucide="file-text" style="width:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Exportar PDF
                </button>
                <button class="btn btn-success" onclick="exportarKardexExcel()">
                    <i data-lucide="download" style="width:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Exportar Excel
                </button>
            </div>
        </div>

        <!-- Tabla Kárdex -->
        <div class="card">
            <div class="table-container">
                <table class="data-table" id="tabla-kardex">
                    <thead>
                        <tr>
                            <th>Fecha y Hora</th>
                            <th>Flujo</th>
                            <th>Producto (Categoría)</th>
                            <th>Número de Serie</th>
                            <th style="text-align:right;">Cant.</th>
                            <th>Documento Asociado</th>
                            <th>Actor Involucrado</th>
                            <th>Usuario / Operador</th>
                            <th style="text-align:right;">P. Unitario</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-kardex-body">
                        <tr>
                            <td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">
                                Cargando movimientos del kárdex...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    lucide.createIcons();

    // Cargar listas y buscar iniciales
    await inicializarFiltrosKardex();
    await filtrarMovimientosKardex();
}

async function inicializarFiltrosKardex() {
    try {
        // Cargar Categorías
        const resCats = await fetch(`${API_URL}/api/categorias`);
        const cats = await resCats.json();
        const catSelect = document.getElementById('filtro-mov-categoria');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Todas las Categorías</option>' +
                cats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }

        // Cargar Usuarios
        const resUsers = await fetch(`${API_URL}/api/usuarios`);
        const users = await resUsers.json();
        const userSelect = document.getElementById('filtro-mov-usuario');
        if (userSelect) {
            userSelect.innerHTML = '<option value="">Todos los Usuarios</option>' +
                users.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
        }

        // Cargar Productos para Autocomplete
        const resProds = await fetch(`${API_URL}/api/productos`);
        listadoProductosKardex = await resProds.json();
        const dl = document.getElementById('productos-mov-datalist');
        if (dl) {
            dl.innerHTML = listadoProductosKardex.map(p => `
                <option value="${p.nombre}"></option>
            `).join('');
        }

        // Cargar Clientes para Autocomplete
        const resClientes = await fetch(`${API_URL}/api/actores?tipo=Cliente`);
        listadoClientesKardex = await resClientes.json();
        const dlClientes = document.getElementById('clientes-mov-datalist');
        if (dlClientes) {
            dlClientes.innerHTML = listadoClientesKardex.map(c => `
                <option value="${c.nombre_razon_social}"></option>
            `).join('');
        }
    } catch (err) {
        console.error("Error al inicializar filtros de Kárdex:", err);
    }
}

async function filtrarMovimientosKardex() {
    const tbody = document.getElementById('tabla-kardex-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">Filtrando movimientos...</td></tr>';

    const fInicio = document.getElementById('filtro-mov-fecha-inicio').value;
    const fFin = document.getElementById('filtro-mov-fecha-fin').value;
    const catId = document.getElementById('filtro-mov-categoria').value;
    const prodInput = document.getElementById('filtro-mov-producto-input').value.trim();
    const clienteInput = document.getElementById('filtro-mov-cliente-input').value.trim();
    const tipo = document.getElementById('filtro-mov-tipo').value;
    const serie = document.getElementById('filtro-mov-serie').value.trim();
    const usuarioId = document.getElementById('filtro-mov-usuario').value;

    // Obtener producto ID a partir del input autocomplete
    let prodId = '';
    if (prodInput) {
        const prod = listadoProductosKardex.find(p => p.nombre.toLowerCase() === prodInput.toLowerCase());
        if (prod) {
            prodId = prod.id;
        } else {
            // Si el texto no coincide con ningún producto, forzar a no retornar resultados
            prodId = '-1';
        }
    }

    // Obtener cliente ID o texto a buscar
    let clienteFiltroVal = '';
    if (clienteInput) {
        const cli = listadoClientesKardex.find(c => c.nombre_razon_social.toLowerCase() === clienteInput.toLowerCase());
        if (cli) {
            clienteFiltroVal = cli.id;
        } else {
            clienteFiltroVal = clienteInput;
        }
    }

    // Armar URL con params
    const queryParams = new URLSearchParams();
    if (fInicio) queryParams.append('fecha_inicio', fInicio);
    if (fFin) queryParams.append('fecha_fin', fFin);
    if (catId) queryParams.append('categoria_id', catId);
    if (prodId) queryParams.append('producto_id', prodId);
    if (clienteFiltroVal) queryParams.append('cliente_filtro', clienteFiltroVal);
    if (tipo) queryParams.append('tipo_movimiento', tipo);
    if (serie) queryParams.append('numero_serie', serie);
    if (usuarioId) queryParams.append('usuario_id', usuarioId);

    try {
        const res = await fetch(`${API_URL}/api/inventario/movimientos?${queryParams.toString()}`);
        globalMovimientos = await res.json();
        
        const countSpan = document.getElementById('kardex-count');
        if (countSpan) countSpan.textContent = globalMovimientos.length;
        renderTablaKardex(globalMovimientos);
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--color-danger);">Error de conexión al servidor local.</td></tr>';
    }
}

function renderTablaKardex(movimientos) {
    const tbody = document.getElementById('tabla-kardex-body');
    if (!tbody) return;

    if (movimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:32px; color:var(--text-muted);">No se encontraron movimientos registrados con los filtros aplicados.</td></tr>';
        return;
    }

    tbody.innerHTML = movimientos.map(m => {
        // Formato de badges premium opacos/pasteles con texto brillante
        let badgeHtml = '';
        if (m.tipo_movimiento === 'Entrada') {
            badgeHtml = `<span class="badge" style="background-color: rgba(16, 185, 129, 0.12); color: #10b981; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.75rem; padding: 4px 8px;">Compra (+)</span>`;
        } else {
            badgeHtml = `<span class="badge" style="background-color: rgba(239, 68, 68, 0.12); color: #ef4444; font-weight: 700; border: 1px solid rgba(239, 68, 68, 0.2); font-size: 0.75rem; padding: 4px 8px;">Venta (-)</span>`;
        }

        const formattedSerie = m.numero_serie 
            ? `<code style="font-family: monospace; font-weight: 700; color: var(--color-info);">${m.numero_serie}</code>`
            : '<span style="color: var(--text-muted); font-style: italic; font-size: 0.8rem;">General</span>';

        return `
            <tr>
                <td style="font-size:0.8rem; color:var(--text-muted);">${formatFecha(m.fecha)}</td>
                <td>${badgeHtml}</td>
                <td>
                    <div style="font-weight:600;">${m.producto_nombre}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${m.categoria_nombre || 'Sin categoría'}</div>
                </td>
                <td>${formattedSerie}</td>
                <td style="text-align:right; font-weight:700;">${m.cantidad} U.</td>
                <td style="font-family:monospace; font-weight:600;">${m.documento}</td>
                <td style="font-weight:600; font-size:0.85rem;">${m.actor_nombre || 'Invitado/Genérico'}</td>
                <td style="font-weight:600; font-size:0.85rem; color:var(--text-muted);">${m.usuario_nombre || 'Sistema'}</td>
                <td style="text-align:right; font-weight:700; color: var(--text-main);">${formatCurrency(m.precio_unitario, m.moneda)}</td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

function limpiarFiltrosMovimientos() {
    document.getElementById('filtro-mov-fecha-inicio').value = '';
    document.getElementById('filtro-mov-fecha-fin').value = '';
    document.getElementById('filtro-mov-categoria').value = '';
    document.getElementById('filtro-mov-producto-input').value = '';
    document.getElementById('filtro-mov-cliente-input').value = '';
    document.getElementById('filtro-mov-tipo').value = 'Todos';
    document.getElementById('filtro-mov-serie').value = '';
    document.getElementById('filtro-mov-usuario').value = '';
    filtrarMovimientosKardex();
}

/* ==============================================================================
   EXPORTACIÓN DE KÁRDEX (EXCEL Y PDF)
   ============================================================================== */
function exportarKardexExcel() {
    if (globalMovimientos.length === 0) {
        mostrarToast("No hay registros en el kárdex para exportar.", "warning");
        return;
    }

    try {
        const dataExport = globalMovimientos.map(m => ({
            "Fecha y Hora": formatFecha(m.fecha),
            "Flujo": m.tipo_movimiento === 'Entrada' ? "Compra (Entrada)" : "Venta (Salida)",
            "Producto": m.producto_nombre,
            "Categoría": m.categoria_nombre || "Sin Categoría",
            "Número de Serie": m.numero_serie || "N/A",
            "Cantidad": m.cantidad,
            "Comprobante": m.documento,
            "Actor (Proveedor/Cliente)": m.actor_nombre || "Público General",
            "Moneda": m.moneda,
            "Precio Unitario": m.precio_unitario,
            "Total Afectado": m.precio_unitario * m.cantidad
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataExport);

        // Ajustar anchos
        const max_len = [18, 16, 32, 24, 18, 10, 20, 28, 8, 16, 16];
        ws['!cols'] = max_len.map(w => ({ wch: w }));

        XLSX.utils.book_append_sheet(wb, ws, "Kárdex de Movimientos");
        XLSX.writeFile(wb, `Kardex_Movimientos_${new Date().toISOString().slice(0,10)}.xlsx`);
        
        mostrarToast("Kárdex exportado a Excel de manera profesional.", "success");
    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo exportar a Excel.", "danger");
    }
}

async function exportarKardexPDF() {
    if (globalMovimientos.length === 0) {
        mostrarToast("No hay registros en el kárdex para exportar.", "warning");
        return;
    }

    try {
        const resConfig = await fetch(`${API_URL}/api/config`);
        const config = await resConfig.json();

        const printContainer = document.createElement('div');
        printContainer.style.padding = '24px';
        printContainer.style.backgroundColor = 'white';
        printContainer.style.color = '#1f2937';
        printContainer.style.fontFamily = "'Inter', sans-serif";
        printContainer.style.fontSize = '10px';
        printContainer.style.lineHeight = '1.4';

        printContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #6366f1; padding-bottom:12px; margin-bottom:16px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${config.logo_path ? `<img src="${API_URL}${config.logo_path}" style="height:40px; width:40px; object-fit:contain; border-radius:4px;" alt="Logo" />` : ''}
                    <div>
                        <h1 style="font-size:16px; font-weight:800; color:#6366f1; margin:0;">${config.empresa_nombre}</h1>
                        <p style="margin:2px 0 0; color:#4b5563; font-size:9px;">Reporte de Control de Inventario - Kárdex de Movimientos</p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <p style="margin:0; font-weight:700; font-size:10px;">Fecha: ${new Date().toLocaleDateString()}</p>
                    <p style="margin:2px 0 0; color:#9ca3af; font-size:8px;">Sistema ERP/POS Local</p>
                </div>
            </div>

            <table style="width:100%; border-collapse:collapse; text-align:left; margin-bottom:16px; font-size:9px;">
                <thead>
                    <tr style="background-color:#6366f1; color:white;">
                        <th style="padding:6px; font-weight:600;">Fecha</th>
                        <th style="padding:6px; font-weight:600;">Mov.</th>
                        <th style="padding:6px; font-weight:600;">Producto (Categoría)</th>
                        <th style="padding:6px; font-weight:600;">N° Serie</th>
                        <th style="padding:6px; font-weight:600; text-align:right; width:40px;">Cant.</th>
                        <th style="padding:6px; font-weight:600;">Documento</th>
                        <th style="padding:6px; font-weight:600;">Actor</th>
                        <th style="padding:6px; font-weight:600;">Usuario / Operador</th>
                        <th style="padding:6px; font-weight:600; text-align:right; width:70px;">P. Unitario</th>
                    </tr>
                </thead>
                <tbody>
                    ${globalMovimientos.map(m => {
                        const isEntrada = m.tipo_movimiento === 'Entrada';
                        const badgeColorStyle = isEntrada 
                            ? 'background-color:#e6f4ea; color:#137333; font-weight:700; padding:2px 4px; border-radius:3px;' 
                            : 'background-color:#fce8e6; color:#c5221f; font-weight:700; padding:2px 4px; border-radius:3px;';
                        const flowText = isEntrada ? 'Compra (+)' : 'Venta (-)';

                        return `
                            <tr style="border-bottom:1px solid #f3f4f6;">
                                <td style="padding:6px; color:#4b5563;">${formatFecha(m.fecha).substring(0, 10)}</td>
                                <td style="padding:6px;"><span style="${badgeColorStyle}">${flowText}</span></td>
                                <td style="padding:6px;">
                                    <div style="font-weight:700;">${m.producto_nombre}</div>
                                    <div style="font-size:8px; color:#9ca3af;">${m.categoria_nombre || 'Sin categoría'}</div>
                                </td>
                                <td style="padding:6px; font-family:monospace;">${m.numero_serie || 'N/A'}</td>
                                <td style="padding:6px; text-align:right; font-weight:700;">${m.cantidad}</td>
                                <td style="padding:6px; font-family:monospace;">${m.documento}</td>
                                <td style="padding:6px;">${m.actor_nombre || 'Público General'}</td>
                                <td style="padding:6px; color:#4b5563;">${m.usuario_nombre || 'Sistema'}</td>
                                <td style="padding:6px; text-align:right; font-weight:700;">${formatCurrency(m.precio_unitario, m.moneda)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div style="margin-top:24px; border-top:1px solid #e5e7eb; padding-top:12px; text-align:center; color:#9ca3af; font-size:8px;">
                <p style="margin:0;">Documento generado electrónicamente en base a movimientos del sistema.</p>
            </div>
        `;

        const opt = {
            margin:       8,
            filename:     `Kardex_Movimientos_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2.5, 
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        // Crear el Wrapper Temporal con posicionamiento absoluto detrás de pantalla
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.left = '0';
        wrapper.style.top = `${window.scrollY}px`; // Alinear con el scroll actual del usuario
        wrapper.style.height = 'auto';
        wrapper.style.overflow = 'visible';
        wrapper.style.zIndex = '-9999';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.width = '1000px'; // Ancho de seguridad de 1000px para A4 Landscape

        printContainer.style.width = '1000px';
        printContainer.style.backgroundColor = 'white';
        printContainer.style.color = '#1f2937';

        wrapper.appendChild(printContainer);
        document.body.appendChild(wrapper);
        
        try {
            // Esperar 300ms para que el navegador complete el layout y renderizado
            await new Promise(resolve => setTimeout(resolve, 300));
            // Generar descarga PDF de forma asíncrona
            await html2pdf().set(opt).from(printContainer).save();
        } finally {
            document.body.removeChild(wrapper);
        }
        
        mostrarToast("PDF de Kárdex generado de forma profesional.", "success");
    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo generar el reporte PDF.", "danger");
    }
}
