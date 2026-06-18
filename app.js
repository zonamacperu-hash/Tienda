/* -------------------------------------------------------------
   GLOBAL STATE & INITIAL DATA DEFINITIONS
   ------------------------------------------------------------- */
const STORAGE_KEYS = {
    INVENTORY: 'antigravity_inventory',
    CLIENTS: 'antigravity_clients',
    PROVIDERS: 'antigravity_providers',
    TRANSACTIONS: 'antigravity_transactions'
};

// Realistic Seed Data
const defaultInventory = [
    { 
        sku: "PROD-001", 
        nombre: "Mouse Inalámbrico Pro", 
        categoria: "Accesorios", 
        stock: 15, 
        stockMinimo: 5, 
        precioCompra: 12.50, 
        precioVenta: 25.00,
        requiereSerial: true,
        numSeries: [
            "SN-MSE-001", "SN-MSE-002", "SN-MSE-003", "SN-MSE-004", "SN-MSE-005",
            "SN-MSE-006", "SN-MSE-007", "SN-MSE-008", "SN-MSE-009", "SN-MSE-010",
            "SN-MSE-011", "SN-MSE-012", "SN-MSE-013", "SN-MSE-014", "SN-MSE-015"
        ]
    },
    { 
        sku: "PROD-002", 
        nombre: "Teclado Mecánico RGB", 
        categoria: "Accesorios", 
        stock: 8, 
        stockMinimo: 3, 
        precioCompra: 35.00, 
        precioVenta: 70.00,
        requiereSerial: true,
        numSeries: [
            "SN-KBD-101", "SN-KBD-102", "SN-KBD-103", "SN-KBD-104", 
            "SN-KBD-105", "SN-KBD-106", "SN-KBD-107", "SN-KBD-108"
        ]
    },
    { 
        sku: "PROD-003", 
        nombre: "Monitor UltraWide 29\"", 
        categoria: "Monitores", 
        stock: 2, 
        stockMinimo: 4, 
        precioCompra: 120.00, 
        precioVenta: 220.00,
        requiereSerial: true,
        numSeries: ["SN-MON-501", "SN-MON-502"]
    },
    { 
        sku: "PROD-004", 
        nombre: "Audífonos Noise Cancelling", 
        categoria: "Audio", 
        stock: 12, 
        stockMinimo: 5, 
        precioCompra: 45.00, 
        precioVenta: 89.99,
        requiereSerial: true,
        numSeries: [
            "SN-AUD-801", "SN-AUD-802", "SN-AUD-803", "SN-AUD-804", 
            "SN-AUD-805", "SN-AUD-806", "SN-AUD-807", "SN-AUD-808", 
            "SN-AUD-809", "SN-AUD-810", "SN-AUD-811", "SN-AUD-812"
        ]
    },
    { 
        sku: "PROD-005", 
        nombre: "Cable HDMI 2.1 4K", 
        categoria: "Cables", 
        stock: 25, 
        stockMinimo: 8, 
        precioCompra: 3.20, 
        precioVenta: 10.00,
        requiereSerial: false,
        numSeries: []
    }
];

const defaultClients = [
    { id: 1, nombre: "María Delgado", telefono: "555-0192", email: "maria.delgado@email.com", totalComprado: 345.50 },
    { id: 2, nombre: "Carlos Mendoza", telefono: "555-4831", email: "carlos.mendoza@email.com", totalComprado: 120.00 },
    { id: 3, nombre: "Sofía Ruiz", telefono: "555-8293", email: "sofia.ruiz@email.com", totalComprado: 670.00 }
];

const defaultProviders = [
    { id: 1, nombre: "Distribuidora Tech S.A.", contacto: "Jorge Lin", telefono: "555-3344", productos: "Laptops, Teclados" },
    { id: 2, nombre: "Importaciones Globales", contacto: "Laura Torres", telefono: "555-7788", productos: "Mouse, Audífonos" },
    { id: 3, nombre: "Soluciones de Oficina", contacto: "Pedro Gómez", telefono: "555-1122", productos: "Monitores, Cables" }
];

const defaultTransactions = [
    { id: 1, tipo: "Venta", fecha: "2026-05-20T10:30:00", entidad: "María Delgado", producto: "Mouse Inalámbrico Pro", cantidad: 2, total: 50.00 },
    { id: 2, tipo: "Compra", fecha: "2026-05-20T14:15:00", entidad: "Distribuidora Tech S.A.", producto: "Teclado Mecánico RGB", cantidad: 5, total: 175.00 },
    { id: 3, tipo: "Venta", fecha: "2026-05-21T09:45:00", entidad: "Sofía Ruiz", producto: "Monitor UltraWide 29\"", cantidad: 1, total: 220.00 }
];

// App Memory State
let state = {
    inventory: [],
    clients: [],
    providers: [],
    transactions: []
};
let ventaCarrito = [];

/* -------------------------------------------------------------
   INITIALIZATION & DATA SYNC
   ------------------------------------------------------------- */
function initApp() {
    // Load from LocalStorage or seed defaults (deep cloned)
    state.inventory = loadFromStorage(STORAGE_KEYS.INVENTORY, JSON.parse(JSON.stringify(defaultInventory)));
    state.clients = loadFromStorage(STORAGE_KEYS.CLIENTS, JSON.parse(JSON.stringify(defaultClients)));
    state.providers = loadFromStorage(STORAGE_KEYS.PROVIDERS, JSON.parse(JSON.stringify(defaultProviders)));
    state.transactions = loadFromStorage(STORAGE_KEYS.TRANSACTIONS, JSON.parse(JSON.stringify(defaultTransactions)));

    // Migration: ensure every product has requiresSerial / numSeries if it's one of the seeds, or default to false / []
    let migrated = false;
    state.inventory.forEach(p => {
        if (p.requiereSerial === undefined) {
            const seed = defaultInventory.find(d => d.sku === p.sku);
            if (seed) {
                p.requiereSerial = seed.requiereSerial;
                p.numSeries = seed.numSeries ? [...seed.numSeries] : [];
            } else {
                p.requiereSerial = false;
                p.numSeries = [];
            }
            migrated = true;
        }
    });

    if (migrated) {
        saveAllToStorage();
    }

    // Save states if first initialization
    saveAllToStorage();

    // Hook listeners
    setupNavigation();
    setupClock();
    setupEventListeners();
    
    // Initial Render of everything
    renderAll();
    
    showToast("¡Sistema inicializado correctamente!", "success");
}

function loadFromStorage(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

function saveToStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function saveAllToStorage() {
    saveToStorage(STORAGE_KEYS.INVENTORY, state.inventory);
    saveToStorage(STORAGE_KEYS.CLIENTS, state.clients);
    saveToStorage(STORAGE_KEYS.PROVIDERS, state.providers);
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, state.transactions);
}

/* -------------------------------------------------------------
   ROUTING & NAVIGATION (SPA)
   ------------------------------------------------------------- */
const sectionMetas = {
    'dashboard': { title: 'Dashboard', subtitle: 'Resumen visual e indicadores generales del negocio', class: 'section-dashboard' },
    'inventario': { title: 'Inventario de Productos', subtitle: 'Listado completo de existencias y control de mercancías', class: 'section-inventario' },
    'clientes': { title: 'Gestión de Clientes', subtitle: 'Administración de clientes y su acumulado histórico', class: 'section-ventas' },
    'nueva-venta': { title: 'Registrar Nueva Venta', subtitle: 'Salida de mercadería y facturación directa a clientes', class: 'section-ventas' },
    'proveedores': { title: 'Nuestros Proveedores', subtitle: 'Directorio de abastecimiento de insumos', class: 'section-compras' },
    'nueva-compra': { title: 'Registrar Reabastecimiento', subtitle: 'Ingreso de mercancía por compras al proveedor', class: 'section-compras' },
    'historial': { title: 'Auditoría e Historial', subtitle: 'Log integral de movimientos de compra y venta', class: 'section-historial' },
    'reportes': { title: 'Reportes y Exportación', subtitle: 'Segmentación de datos operativos y descargas en formatos oficiales', class: 'section-reportes' }
};

function setupNavigation() {
    const menuButtons = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.content-section');
    const mainContainer = document.getElementById('main-content-area');
    
    menuButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            
            // Remove active classes
            menuButtons.forEach(item => item.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active-section'));
            
            // Add active classes to selected
            btn.classList.add('active');
            
            const targetSection = document.getElementById(`section-${target}`);
            if (targetSection) {
                targetSection.classList.add('active-section');
            }
            
            // Apply text and layout colors
            const meta = sectionMetas[target] || { title: 'Sistema', subtitle: '', class: 'section-dashboard' };
            document.getElementById('current-section-title').textContent = meta.title;
            document.getElementById('current-section-subtitle').textContent = meta.subtitle;
            
            // Reapply body class to shift backdrop tones
            mainContainer.className = `main-content ${meta.class}`;

            // Specialized render on enter section
            onSectionEnter(target);
        });
    });

    // Special dashboard link click
    document.getElementById('btn-go-to-history').addEventListener('click', () => {
        const historyBtn = document.querySelector('.menu-item[data-target="historial"]');
        if (historyBtn) historyBtn.click();
    });
}

function onSectionEnter(sectionName) {
    if (sectionName === 'dashboard') {
        renderDashboard();
    } else if (sectionName === 'inventario') {
        renderInventario();
    } else if (sectionName === 'clientes') {
        renderClientes();
    } else if (sectionName === 'nueva-venta') {
        setupNuevaVentaView();
    } else if (sectionName === 'proveedores') {
        renderProveedores();
    } else if (sectionName === 'nueva-compra') {
        setupNuevaCompraView();
    } else if (sectionName === 'historial') {
        renderHistorial();
    } else if (sectionName === 'reportes') {
        renderReportes();
    }
}

function renderAll() {
    renderDashboard();
    renderInventario();
    renderClientes();
    renderProveedores();
    renderHistorial();
    
    // Refresh reports if currently active
    const activeBtn = document.querySelector('.menu-item.active');
    if (activeBtn && activeBtn.getAttribute('data-target') === 'reportes') {
        renderReportes();
    }
}

/* -------------------------------------------------------------
   CLOCK SYSTEM
   ------------------------------------------------------------- */
function setupClock() {
    const clockSpan = document.getElementById('current-date-display');
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    };
    
    function tick() {
        const now = new Date();
        clockSpan.textContent = now.toLocaleDateString('es-ES', options);
    }
    
    tick();
    setInterval(tick, 1000);
}

/* -------------------------------------------------------------
   DASHBOARD CALCULATIONS & RENDER
   ------------------------------------------------------------- */
function renderDashboard() {
    // 1. Calculate KPI Metrics
    let totalSalesVal = 0;
    let totalPurchasesVal = 0;
    let salesCount = 0;
    let purchasesCount = 0;

    state.transactions.forEach(t => {
        if (t.tipo === 'Venta') {
            totalSalesVal += t.total;
            salesCount++;
        } else if (t.tipo === 'Compra') {
            totalPurchasesVal += t.total;
            purchasesCount++;
        }
    });

    const netBalance = totalSalesVal - totalPurchasesVal;

    // Count low stock items
    const lowStockItems = state.inventory.filter(p => Number(p.stock) < Number(p.stockMinimo));
    const lowStockCount = lowStockItems.length;

    // Render KPIs to DOM
    document.getElementById('dash-total-sales').textContent = formatCurrency(totalSalesVal);
    document.getElementById('dash-sales-count').textContent = `${salesCount} venta${salesCount !== 1 ? 's' : ''} registrada${salesCount !== 1 ? 's' : ''}`;
    
    document.getElementById('dash-total-purchases').textContent = formatCurrency(totalPurchasesVal);
    document.getElementById('dash-purchases-count').textContent = `${purchasesCount} compra${purchasesCount !== 1 ? 's' : ''} realizada${purchasesCount !== 1 ? 's' : ''}`;
    
    const balanceElem = document.getElementById('dash-net-balance');
    balanceElem.textContent = formatCurrency(netBalance);
    if (netBalance >= 0) {
        balanceElem.className = 'metric-value text-green';
        document.getElementById('dash-balance-percentage').textContent = 'Superávit comercial positivo';
    } else {
        balanceElem.className = 'metric-value text-red';
        document.getElementById('dash-balance-percentage').textContent = 'Déficit comercial (costos altos)';
    }

    const lowStockCountElem = document.getElementById('dash-low-stock-count');
    lowStockCountElem.textContent = lowStockCount;
    if (lowStockCount > 0) {
        lowStockCountElem.className = 'metric-value text-red';
        document.getElementById('dash-low-stock-text').textContent = '¡Necesitan reabastecimiento!';
    } else {
        lowStockCountElem.className = 'metric-value text-green';
        document.getElementById('dash-low-stock-text').textContent = 'Inventario en niveles seguros';
    }

    // 2. Render Low Stock Alerts List
    const alertsContainer = document.getElementById('dash-alerts-list');
    const alertBadgeCount = document.getElementById('alert-badge-count');
    alertBadgeCount.textContent = `${lowStockCount} Producto${lowStockCount !== 1 ? 's' : ''}`;

    if (lowStockCount === 0) {
        alertsContainer.innerHTML = `
            <div class="alert-empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
                </svg>
                <p>No hay alertas. Todos los productos tienen existencias adecuadas.</p>
            </div>
        `;
    } else {
        alertsContainer.innerHTML = lowStockItems.map(p => `
            <div class="alert-item">
                <div class="alert-product-info">
                    <h4>${escapeHTML(p.nombre)}</h4>
                    <span>SKU: ${escapeHTML(p.sku)} • Mínimo sugerido: ${p.stockMinimo} u.</span>
                </div>
                <div class="alert-stock-metrics">
                    <span class="alert-stock-current">${p.stock} unidades</span>
                    <button class="btn btn-orange btn-xs mt-4 btn-quick-reorder" data-sku="${escapeHTML(p.sku)}">Reabastecer</button>
                </div>
            </div>
        `).join('');

        // Wire quick reorder buttons
        alertsContainer.querySelectorAll('.btn-quick-reorder').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sku = e.target.getAttribute('data-sku');
                navigateToSection('nueva-compra', () => {
                    const selector = document.getElementById('compra-producto');
                    selector.value = sku;
                    selector.dispatchEvent(new Event('change'));
                });
            });
        });
    }

    // 3. Render Categories Analytics Charts
    const categoriesContainer = document.getElementById('category-bars-container');
    const categoryTotals = {};
    let totalStock = 0;

    state.inventory.forEach(p => {
        categoryTotals[p.categoria] = (categoryTotals[p.categoria] || 0) + Number(p.stock);
        totalStock += Number(p.stock);
    });

    const categoryEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

    if (categoryEntries.length === 0) {
        categoriesContainer.innerHTML = '<p class="text-center text-muted">Sin datos de categorías en inventario.</p>';
    } else {
        categoriesContainer.innerHTML = categoryEntries.map(([catName, qty]) => {
            const percentage = totalStock > 0 ? ((qty / totalStock) * 100).toFixed(0) : 0;
            return `
                <div class="category-bar-row">
                    <div class="category-bar-label">
                        <span>${escapeHTML(catName)}</span>
                        <span>${qty} u. (${percentage}%)</span>
                    </div>
                    <div class="category-bar-track">
                        <div class="category-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 4. Render Recent Transactions Table (Max 5)
    const recentTransactionsTbody = document.getElementById('dash-recent-transactions-tbody');
    const recent = [...state.transactions].reverse().slice(0, 5);

    if (recent.length === 0) {
        recentTransactionsTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Ningún movimiento registrado.</td></tr>';
    } else {
        recentTransactionsTbody.innerHTML = recent.map(t => `
            <tr>
                <td>
                    <span class="badge ${t.tipo === 'Venta' ? 'badge-success' : 'badge-warning'}">
                        ${t.tipo}
                    </span>
                </td>
                <td>${escapeHTML(t.producto)}</td>
                <td class="text-center">${t.cantidad}</td>
                <td class="text-right font-semibold ${t.tipo === 'Venta' ? 'text-green' : 'text-orange'}">
                    ${t.tipo === 'Venta' ? '+' : '-'}${formatCurrency(t.total)}
                </td>
            </tr>
        `).join('');
    }
}

/* -------------------------------------------------------------
   INVENTARIO MANAGEMENT & TABLE RENDER
   ------------------------------------------------------------- */
function renderInventario() {
    const searchVal = document.getElementById('search-inventario').value.toLowerCase();
    const filterCat = document.getElementById('filter-inventario-categoria').value;
    const tbody = document.getElementById('inventario-tbody');
    
    // Extract distinct categories to populate filter
    const categoriesSet = new Set(state.inventory.map(p => p.categoria));
    const filterSelect = document.getElementById('filter-inventario-categoria');
    const activeFilterVal = filterSelect.value;
    
    // Repopulate category filter options
    filterSelect.innerHTML = '<option value="all">Todas las Categorías</option>' + 
        Array.from(categoriesSet).map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
    filterSelect.value = activeFilterVal; // Keep selected option
    
    // Populate modal datalist for categories suggestions
    document.getElementById('categorias-existentes').innerHTML = 
        Array.from(categoriesSet).map(c => `<option value="${escapeHTML(c)}">`).join('');

    // Filter list
    const filteredProducts = state.inventory.filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(searchVal) || p.sku.toLowerCase().includes(searchVal);
        const matchesCategory = filterCat === 'all' || p.categoria === filterCat;
        return matchesSearch && matchesCategory;
    });

    if (filteredProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No se encontraron productos coincidentes.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredProducts.map(p => {
        const isLow = Number(p.stock) < Number(p.stockMinimo);
        const statusBadge = isLow ? 
            '<span class="badge badge-danger">Stock Bajo</span>' : 
            '<span class="badge badge-success">En Stock</span>';

        let serialsHTML = '';
        if (p.requiereSerial) {
            const serialCount = p.numSeries ? p.numSeries.length : 0;
            if (serialCount > 0) {
                serialsHTML = `
                    <div class="serial-control-wrapper">
                        <button class="btn-toggle-serials" data-sku="${escapeHTML(p.sku)}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
                            Ver S/N (${serialCount})
                        </button>
                        <div class="serial-badge-list" id="serials-${escapeHTML(p.sku)}" style="display: none;">
                            ${p.numSeries.map(s => `<span class="serial-badge-item">${escapeHTML(s)}</span>`).join('')}
                        </div>
                    </div>
                `;
            } else {
                serialsHTML = `
                    <div class="serial-control-wrapper">
                        <span class="text-red font-semibold" style="font-size: 0.7rem; display: block; margin-top: 4px;">⚠️ Sin números de serie</span>
                    </div>
                `;
            }
        }

        return `
            <tr class="${isLow ? 'row-low-stock' : ''}">
                <td class="font-semibold">${escapeHTML(p.sku)}</td>
                <td>
                    <div>${escapeHTML(p.nombre)}</div>
                    ${serialsHTML}
                </td>
                <td><span class="badge badge-info">${escapeHTML(p.categoria)}</span></td>
                <td class="text-center font-semibold ${isLow ? 'text-red' : ''}">${p.stock}</td>
                <td class="text-center">
                    <div class="adjust-group">
                        <button class="btn-icon-adjust btn-adjust-minus" data-sku="${escapeHTML(p.sku)}">-</button>
                        <button class="btn-icon-adjust btn-adjust-plus" data-sku="${escapeHTML(p.sku)}">+</button>
                    </div>
                </td>
                <td>${formatCurrency(p.precioCompra)}</td>
                <td>${formatCurrency(p.precioVenta)}</td>
                <td>${statusBadge}</td>
                <td class="text-right">
                    <button class="btn-action btn-action-edit" data-sku="${escapeHTML(p.sku)}" title="Editar Producto">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button class="btn-action btn-action-delete" data-sku="${escapeHTML(p.sku)}" title="Eliminar Producto">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Event Delegation / Handlers inside list
    tbody.querySelectorAll('.btn-toggle-serials').forEach(btn => {
        btn.addEventListener('click', () => {
            const sku = btn.getAttribute('data-sku');
            const listDiv = document.getElementById(`serials-${sku}`);
            if (listDiv) {
                const isHidden = listDiv.style.display === 'none';
                listDiv.style.display = isHidden ? 'flex' : 'none';
                btn.innerHTML = isHidden ? 
                    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg> Ocultar S/N (${listDiv.childElementCount})` : 
                    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg> Ver S/N (${listDiv.childElementCount})`;
            }
        });
    });

    tbody.querySelectorAll('.btn-adjust-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            adjustStockDirect(btn.getAttribute('data-sku'), -1);
        });
    });

    tbody.querySelectorAll('.btn-adjust-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            adjustStockDirect(btn.getAttribute('data-sku'), 1);
        });
    });

    tbody.querySelectorAll('.btn-action-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            openModalProducto(btn.getAttribute('data-sku'));
        });
    });

    tbody.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteProductDirect(btn.getAttribute('data-sku'));
        });
    });
}

function adjustStockDirect(sku, amount) {
    const product = state.inventory.find(p => p.sku === sku);
    if (!product) return;

    if (product.requiereSerial) {
        if (!product.numSeries) product.numSeries = [];

        if (amount < 0) {
            // Decrement stock: remove last serial number
            if (product.numSeries.length === 0) {
                showToast("No hay números de serie para remover. Stock ya es 0.", "error");
                return;
            }
            const removedSerial = product.numSeries.pop();
            product.stock = product.numSeries.length;
            saveAllToStorage();
            renderAll();
            showToast(`Se removió el número de serie "${removedSerial}". Stock de ${product.nombre} disminuido a ${product.stock}.`, "warning");
        } else {
            // Increment stock: prompt for new serial number
            const newSerial = prompt(`Ingrese el nuevo Número de Serie para "${product.nombre}":`);
            if (newSerial === null) {
                // User cancelled the prompt
                return;
            }
            const trimmedSerial = newSerial.trim();
            if (!trimmedSerial) {
                showToast("El número de serie no puede estar vacío.", "error");
                return;
            }

            // Check duplicate globally
            const dupProduct = state.inventory.find(p => p.numSeries && p.numSeries.includes(trimmedSerial));
            if (dupProduct) {
                showToast(`El número de serie "${trimmedSerial}" ya está registrado en el producto: ${dupProduct.nombre}.`, "error");
                return;
            }

            product.numSeries.push(trimmedSerial);
            product.stock = product.numSeries.length;
            saveAllToStorage();
            renderAll();
            showToast(`Número de serie "${trimmedSerial}" registrado con éxito. Stock de ${product.nombre} aumentado a ${product.stock}.`, "success");
        }
    } else {
        // Bulk product adjust
        const currentVal = Number(product.stock);
        const newVal = currentVal + amount;
        
        if (newVal < 0) {
            showToast("No se admite un stock negativo.", "error");
            return;
        }

        product.stock = newVal;
        saveAllToStorage();
        renderAll();
        
        if (amount > 0) {
            showToast(`Stock de ${product.nombre} aumentado a ${newVal}.`, "success");
        } else {
            showToast(`Stock de ${product.nombre} disminuido a ${newVal}.`, "warning");
        }
    }
}

function deleteProductDirect(sku) {
    const product = state.inventory.find(p => p.sku === sku);
    if (!product) return;

    if (confirm(`¿Estás seguro de eliminar el producto "${product.nombre}" del inventario?`)) {
        state.inventory = state.inventory.filter(p => p.sku !== sku);
        saveAllToStorage();
        renderAll();
        showToast(`Producto "${product.nombre}" eliminado.`, "warning");
    }
}

/* -------------------------------------------------------------
   CLIENTS MANAGEMENT & TABLE RENDER
   ------------------------------------------------------------- */
function renderClientes() {
    const searchVal = document.getElementById('search-clientes').value.toLowerCase();
    const tbody = document.getElementById('clientes-tbody');

    const filteredClients = state.clients.filter(c => 
        c.nombre.toLowerCase().includes(searchVal) || c.email.toLowerCase().includes(searchVal)
    );

    if (filteredClients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Ningún cliente coincide con la búsqueda.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredClients.map(c => `
        <tr>
            <td class="font-semibold">${escapeHTML(c.nombre)}</td>
            <td>${escapeHTML(c.telefono)}</td>
            <td>${escapeHTML(c.email)}</td>
            <td class="text-right font-semibold text-green">${formatCurrency(c.totalComprado)}</td>
            <td class="text-right">
                <button class="btn-action btn-action-edit" data-id="${c.id}" title="Editar Cliente">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button class="btn-action btn-action-delete" data-id="${c.id}" title="Eliminar Cliente">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.btn-action-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            openModalCliente(btn.getAttribute('data-id'));
        });
    });

    tbody.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteClientDirect(btn.getAttribute('data-id'));
        });
    });
}

function deleteClientDirect(id) {
    const client = state.clients.find(c => String(c.id) === String(id));
    if (!client) return;

    if (confirm(`¿Estás seguro de eliminar al cliente "${client.nombre}"?`)) {
        state.clients = state.clients.filter(c => String(c.id) !== String(id));
        saveAllToStorage();
        renderAll();
        showToast(`Cliente "${client.nombre}" eliminado.`, "warning");
    }
}

/* -------------------------------------------------------------
   PROVIDERS MANAGEMENT & TABLE RENDER
   ------------------------------------------------------------- */
function renderProveedores() {
    const searchVal = document.getElementById('search-proveedores').value.toLowerCase();
    const tbody = document.getElementById('proveedores-tbody');

    const filteredProviders = state.providers.filter(p => 
        p.nombre.toLowerCase().includes(searchVal) || p.contacto.toLowerCase().includes(searchVal)
    );

    if (filteredProviders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Ningún proveedor coincide con la búsqueda.</td></tr>';
        return;
    }

    tbody.innerHTML = filteredProviders.map(p => `
        <tr>
            <td class="font-semibold">${escapeHTML(p.nombre)}</td>
            <td>${escapeHTML(p.contacto)}</td>
            <td>${escapeHTML(p.telefono)}</td>
            <td><span class="badge badge-warning">${escapeHTML(p.productos)}</span></td>
            <td class="text-right">
                <button class="btn-action btn-action-edit" data-id="${p.id}" title="Editar Proveedor">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
                <button class="btn-action btn-action-delete" data-id="${p.id}" title="Eliminar Proveedor">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            </td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.btn-action-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            openModalProveedor(btn.getAttribute('data-id'));
        });
    });

    tbody.querySelectorAll('.btn-action-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteProviderDirect(btn.getAttribute('data-id'));
        });
    });
}

function deleteProviderDirect(id) {
    const provider = state.providers.find(p => String(p.id) === String(id));
    if (!provider) return;

    if (confirm(`¿Estás seguro de eliminar al proveedor "${provider.nombre}"?`)) {
        state.providers = state.providers.filter(p => String(p.id) !== String(id));
        saveAllToStorage();
        renderAll();
        showToast(`Proveedor "${provider.nombre}" eliminado.`, "warning");
    }
}

/* -------------------------------------------------------------
   NUEVA VENTA: DYNAMIC FORM LOGIC & RECEIPT CALCULATOR
   ------------------------------------------------------------- */
/* -------------------------------------------------------------
   NUEVA VENTA: DYNAMIC FORM LOGIC & SHOPPING CART CALCULATOR
   ------------------------------------------------------------- */
function setupNuevaVentaView() {
    const clientSelector = document.getElementById('venta-cliente');
    const productSelector = document.getElementById('venta-producto');
    const qtyInput = document.getElementById('venta-cantidad');
    const priceInput = document.getElementById('venta-precio-mostrado');
    const feedbackSpan = document.getElementById('venta-stock-feedback');
    const serialContainer = document.getElementById('venta-serial-container');
    const serialSelect = document.getElementById('venta-serial');

    // Reset temporal cart state
    ventaCarrito = [];

    // Set Receipt Date
    const today = new Date();
    document.getElementById('receipt-venta-fecha').textContent = `Fecha: ${today.toLocaleDateString('es-ES')}`;

    // Populate selectors
    clientSelector.innerHTML = '<option value="" disabled selected>-- Elija un Cliente --</option>' +
        state.clients.map(c => `<option value="${c.id}">${escapeHTML(c.nombre)}</option>`).join('');

    productSelector.innerHTML = '<option value="" disabled selected>-- Elija un Producto --</option>' +
        state.inventory.map(p => `<option value="${escapeHTML(p.sku)}">${escapeHTML(p.nombre)} (Stock: ${p.stock})</option>`).join('');

    // Reset inputs
    qtyInput.value = '';
    qtyInput.disabled = true;
    priceInput.value = '$0.00';
    feedbackSpan.textContent = '';
    serialContainer.style.display = 'none';
    serialSelect.innerHTML = '';
    
    // Unlock client selector
    clientSelector.disabled = false;
    
    renderCarrito();

    // Change handlers
    clientSelector.onchange = () => {
        const client = state.clients.find(c => String(c.id) === String(clientSelector.value));
        document.getElementById('receipt-venta-cliente').textContent = client ? client.nombre : 'No seleccionado';
    };

    productSelector.onchange = () => {
        const product = state.inventory.find(p => p.sku === productSelector.value);
        if (product) {
            // Calculate actual available stock considering cart quantities
            const alreadyInCartQty = ventaCarrito.filter(item => item.sku === product.sku).reduce((acc, item) => acc + item.cantidad, 0);
            const availableStock = product.stock - alreadyInCartQty;
            
            priceInput.value = formatCurrency(product.precioVenta);

            if (product.requiereSerial) {
                // Show serial selection
                serialContainer.style.display = 'block';
                
                // Populate serial selection dropdown, filtering out already added serials
                const alreadyInCartSerials = ventaCarrito.filter(item => item.sku === product.sku).map(item => item.serialSelected);
                const series = (product.numSeries || []).filter(sn => !alreadyInCartSerials.includes(sn));
                
                serialSelect.innerHTML = '<option value="" disabled selected>-- Elija un Número de Serie --</option>' +
                    series.map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');
                
                qtyInput.disabled = true;
                qtyInput.value = 1;
                qtyInput.min = 1;
                qtyInput.max = 1;

                feedbackSpan.innerHTML = `Disponibles: <strong class="${availableStock < product.stockMinimo ? 'text-red' : ''}">${availableStock} unidades (S/N)</strong> (Precio: ${formatCurrency(product.precioVenta)})`;

                if (availableStock <= 0 || series.length === 0) {
                    serialSelect.innerHTML = '<option value="" disabled selected>-- Sin series disponibles --</option>';
                    feedbackSpan.innerHTML = '<span class="text-red font-semibold">⚠️ SIN STOCK DISPONIBLE. Elija otro producto o remueva del carrito.</span>';
                }
            } else {
                // Bulk standard product
                serialContainer.style.display = 'none';
                serialSelect.innerHTML = '';

                qtyInput.disabled = false;
                qtyInput.value = 1;
                qtyInput.min = 1;
                qtyInput.max = availableStock;

                feedbackSpan.innerHTML = `Disponibles: <strong class="${availableStock < product.stockMinimo ? 'text-red' : ''}">${availableStock} unidades</strong> (Precio: ${formatCurrency(product.precioVenta)})`;

                if (availableStock <= 0) {
                    qtyInput.disabled = true;
                    qtyInput.value = 0;
                    feedbackSpan.innerHTML = '<span class="text-red font-semibold">⚠️ SIN STOCK DISPONIBLE. Elija otro producto o remueva del carrito.</span>';
                }
            }
            calculateVentaTotal();
        }
    };

    serialSelect.onchange = () => {
        calculateVentaTotal();
    };

    qtyInput.oninput = () => {
        calculateVentaTotal();
    };
}

function calculateVentaTotal() {
    const qty = Number(document.getElementById('venta-cantidad').value) || 0;
    const sku = document.getElementById('venta-producto').value;
    const product = state.inventory.find(p => p.sku === sku);

    if (product) {
        // Calculate actual available stock considering cart quantities
        const alreadyInCartQty = ventaCarrito.filter(item => item.sku === product.sku).reduce((acc, item) => acc + item.cantidad, 0);
        const availableStock = product.stock - alreadyInCartQty;

        if (!product.requiereSerial && qty > availableStock) {
            document.getElementById('venta-cantidad').value = availableStock;
            showToast(`Límite excedido. Solo dispones de ${availableStock} unidades adicionales.`, "warning");
            calculateVentaTotal();
            return;
        }
    }
}

function agregarAlCarrito() {
    const clientSelector = document.getElementById('venta-cliente');
    const productSelector = document.getElementById('venta-producto');
    const qtyInput = document.getElementById('venta-cantidad');
    const serialSelect = document.getElementById('venta-serial');

    const clientId = clientSelector.value;
    const sku = productSelector.value;
    const qty = Number(qtyInput.value);

    if (!clientId) {
        showToast("Por favor, seleccione un cliente primero.", "error");
        return;
    }

    if (!sku) {
        showToast("Por favor, seleccione un producto.", "error");
        return;
    }

    const client = state.clients.find(c => String(c.id) === String(clientId));
    const product = state.inventory.find(p => p.sku === sku);

    if (!client || !product) {
        showToast("Producto o cliente no válidos.", "error");
        return;
    }

    if (product.requiereSerial) {
        const selectedSerial = serialSelect.value;
        if (!selectedSerial) {
            showToast("Por favor seleccione un número de serie para continuar.", "error");
            return;
        }

        // Validate serial duplicate in cart
        if (ventaCarrito.some(item => item.sku === sku && item.serialSelected === selectedSerial)) {
            showToast("Este número de serie ya está agregado al carrito.", "error");
            return;
        }

        ventaCarrito.push({
            sku: product.sku,
            nombre: product.nombre,
            cantidad: 1,
            precioVenta: product.precioVenta,
            subtotal: product.precioVenta,
            requiereSerial: true,
            serialSelected: selectedSerial
        });

        showToast(`Producto serializado agregado: S/N ${selectedSerial}`, "success");
    } else {
        if (qty <= 0) {
            showToast("Por favor ingrese una cantidad mayor a cero.", "error");
            return;
        }

        // Check stock
        const alreadyInCartQty = ventaCarrito.filter(item => item.sku === sku).reduce((acc, item) => acc + item.cantidad, 0);
        if (alreadyInCartQty + qty > product.stock) {
            showToast(`Stock insuficiente. Solo quedan ${product.stock - alreadyInCartQty} unidades disponibles.`, "error");
            return;
        }

        const existingItem = ventaCarrito.find(item => item.sku === sku);
        if (existingItem) {
            existingItem.cantidad += qty;
            existingItem.subtotal = existingItem.cantidad * existingItem.precioVenta;
        } else {
            ventaCarrito.push({
                sku: product.sku,
                nombre: product.nombre,
                cantidad: qty,
                precioVenta: product.precioVenta,
                subtotal: qty * product.precioVenta,
                requiereSerial: false
            });
        }

        showToast(`${product.nombre} agregado al carrito (${qty} u.)`, "success");
    }

    // Refresh cart display
    renderCarrito();

    // Reset input fields but keep product selector ready
    productSelector.value = "";
    qtyInput.value = "";
    qtyInput.disabled = true;
    document.getElementById('venta-precio-mostrado').value = "$0.00";
    document.getElementById('venta-stock-feedback').textContent = "";
    serialSelect.innerHTML = "";
    document.getElementById('venta-serial-container').style.display = "none";
}

function eliminarDelCarrito(index) {
    if (index >= 0 && index < ventaCarrito.length) {
        const removedItem = ventaCarrito[index];
        ventaCarrito.splice(index, 1);
        showToast(`Se quitó ${removedItem.nombre} de la venta.`, "warning");
        
        renderCarrito();

        // Refresh product selector state in case the removed item frees up stock/serials
        document.getElementById('venta-producto').dispatchEvent(new Event('change'));
    }
}

function renderCarrito() {
    const clientSelector = document.getElementById('venta-cliente');
    const cartTbody = document.getElementById('cart-tbody');
    const receiptItemsList = document.getElementById('receipt-venta-items');
    const receiptTotalText = document.getElementById('receipt-venta-total');

    // Update Client on receipt
    const client = state.clients.find(c => String(c.id) === String(clientSelector.value));
    document.getElementById('receipt-venta-cliente').textContent = client ? client.nombre : 'No seleccionado';

    if (ventaCarrito.length === 0) {
        cartTbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-3">No hay productos agregados.</td>
            </tr>
        `;
        receiptItemsList.innerHTML = `<div class="text-center text-muted" style="font-size: 0.8rem; py-2;">Sin productos en la venta</div>`;
        receiptTotalText.textContent = "$0.00";

        // Enable client selector when cart is empty
        clientSelector.disabled = false;
    } else {
        // Disable client selector when items exist in the cart
        clientSelector.disabled = true;

        let total = 0;
        cartTbody.innerHTML = ventaCarrito.map((item, index) => {
            total += item.subtotal;
            const itemDesc = item.requiereSerial ? 
                `${escapeHTML(item.nombre)} <span class="serial-badge-item">${escapeHTML(item.serialSelected)}</span>` : 
                escapeHTML(item.nombre);

            return `
                <tr>
                    <td class="font-semibold">${escapeHTML(item.sku)}</td>
                    <td>${itemDesc}</td>
                    <td class="text-center font-semibold">${item.cantidad}</td>
                    <td class="text-right">${formatCurrency(item.precioVenta)}</td>
                    <td class="text-right font-semibold">${formatCurrency(item.subtotal)}</td>
                    <td class="text-center">
                        <button type="button" class="btn-action-delete-cart" onclick="eliminarDelCarrito(${index})" title="Quitar de la venta">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        receiptItemsList.innerHTML = ventaCarrito.map(item => {
            const metaText = item.requiereSerial ? `S/N: ${item.serialSelected}` : `Cant: ${item.cantidad} x ${formatCurrency(item.precioVenta)}`;
            return `
                <div class="receipt-item-row">
                    <div class="receipt-item-details">
                        <span class="receipt-item-name">${escapeHTML(item.nombre)}</span>
                        <span class="receipt-item-meta">${metaText}</span>
                    </div>
                    <div class="receipt-item-price">${formatCurrency(item.subtotal)}</div>
                </div>
            `;
        }).join('');

        receiptTotalText.textContent = formatCurrency(total);
    }
}

function processVenta(e) {
    e.preventDefault();
    const clientSelector = document.getElementById('venta-cliente');
    const clientId = clientSelector.value;
    const client = state.clients.find(c => String(c.id) === String(clientId));

    if (!client) {
        showToast("Por favor seleccione un cliente.", "error");
        return;
    }

    if (ventaCarrito.length === 0) {
        showToast("Por favor agregue al menos un producto a la venta.", "error");
        return;
    }

    let transactionTotal = 0;
    const descParts = [];

    // Loop and apply stock reductions
    for (let item of ventaCarrito) {
        const product = state.inventory.find(p => p.sku === item.sku);
        if (!product) {
            showToast(`El producto con SKU ${item.sku} ya no existe en el catálogo.`, "error");
            return;
        }

        if (product.requiereSerial) {
            const serialIdx = product.numSeries.indexOf(item.serialSelected);
            if (serialIdx === -1) {
                showToast(`El número de serie ${item.serialSelected} de ${product.nombre} ya no está disponible.`, "error");
                return;
            }

            // Splice serial number
            product.numSeries.splice(serialIdx, 1);
            product.stock = product.numSeries.length;
            descParts.push(`${product.nombre} (S/N: ${item.serialSelected}) x1`);
        } else {
            if (item.cantidad > Number(product.stock)) {
                showToast(`Stock insuficiente para ${product.nombre}. Quedan ${product.stock} unidades en almacén.`, "error");
                return;
            }

            product.stock = Number(product.stock) - item.cantidad;
            descParts.push(`${product.nombre} x${item.cantidad}`);
        }

        transactionTotal += item.subtotal;
    }

    // Increase client accumulated purchased amount
    client.totalComprado = Number(client.totalComprado) + transactionTotal;

    // Join products string for history
    const productDescription = descParts.join(', ');

    // Add transaction to log
    const newTx = {
        id: state.transactions.length > 0 ? Math.max(...state.transactions.map(t => t.id)) + 1 : 1,
        tipo: "Venta",
        fecha: new Date().toISOString(),
        entidad: client.nombre,
        producto: productDescription,
        cantidad: ventaCarrito.reduce((acc, item) => acc + item.cantidad, 0),
        total: transactionTotal
    };
    state.transactions.push(newTx);

    // Clear Cart
    ventaCarrito = [];

    // Save & update
    saveAllToStorage();
    renderAll();

    showToast(`Venta exitosa por ${formatCurrency(transactionTotal)}! Stock del catálogo actualizado.`, "success");
    
    // Redirect / reload SPA views
    navigateToSection('dashboard');
}

/* -------------------------------------------------------------
   NUEVA COMPRA: DYNAMIC FORM LOGIC & RECEIPT CALCULATOR
   ------------------------------------------------------------- */
function setupNuevaCompraView() {
    const providerElem = document.getElementById('compra-proveedor');
    const productSelector = document.getElementById('compra-producto');
    const qtyInput = document.getElementById('compra-cantidad');
    const costInput = document.getElementById('compra-costo-unitario');
    const feedbackSpan = document.getElementById('compra-stock-feedback');
    const serialContainer = document.getElementById('compra-serial-container');
    const serialInput = document.getElementById('compra-seriales');

    // Set Receipt Date
    const today = new Date();
    document.getElementById('receipt-compra-fecha').textContent = `Fecha: ${today.toLocaleDateString('es-ES')}`;

    // Populate selectors
    providerElem.innerHTML = '<option value="" disabled selected>-- Elija un Proveedor --</option>' +
        state.providers.map(p => `<option value="${p.id}">${escapeHTML(p.nombre)}</option>`).join('');

    productSelector.innerHTML = '<option value="" disabled selected>-- Elija un Producto --</option>' +
        state.inventory.map(p => `<option value="${escapeHTML(p.sku)}">${escapeHTML(p.nombre)} (Stock: ${p.stock})</option>`).join('');

    // Reset inputs
    qtyInput.value = '';
    qtyInput.disabled = true;
    costInput.value = '';
    costInput.disabled = true;
    feedbackSpan.textContent = '';
    serialContainer.style.display = 'none';
    serialInput.value = '';

    resetCompraReceipt();

    // Handlers
    providerElem.onchange = () => {
        const prov = state.providers.find(p => String(p.id) === String(providerElem.value));
        document.getElementById('receipt-compra-proveedor').textContent = prov ? prov.nombre : 'No seleccionado';
    };

    productSelector.onchange = () => {
        const product = state.inventory.find(p => p.sku === productSelector.value);
        if (product) {
            qtyInput.disabled = false;
            costInput.disabled = false;
            costInput.value = product.precioCompra; // Pre-fill suggested purchase unit price!

            if (product.requiereSerial) {
                // Serialized product
                serialContainer.style.display = 'block';
                serialInput.value = '';
                
                qtyInput.disabled = true; // derived from serial count
                qtyInput.value = 0;

                feedbackSpan.innerHTML = `Stock Actual: <strong>${product.stock} unidades (S/N)</strong> (Costo sugerido: ${formatCurrency(product.precioCompra)})`;
            } else {
                // Bulk standard product
                serialContainer.style.display = 'none';
                serialInput.value = '';

                qtyInput.disabled = false;
                qtyInput.value = 10; // Suggested reorder qty default

                feedbackSpan.innerHTML = `Stock Actual: <strong>${product.stock} unidades</strong> (Costo sugerido: ${formatCurrency(product.precioCompra)})`;
            }
            calculateCompraTotal();
        }
    };

    serialInput.oninput = () => {
        const product = state.inventory.find(p => p.sku === productSelector.value);
        if (product && product.requiereSerial) {
            const series = serialInput.value.split(',').map(s => s.trim()).filter(Boolean);
            qtyInput.value = series.length;
        }
        calculateCompraTotal();
    };

    qtyInput.oninput = () => calculateCompraTotal();
    costInput.oninput = () => calculateCompraTotal();
}

function calculateCompraTotal() {
    const qty = Number(document.getElementById('compra-cantidad').value) || 0;
    const cost = Number(document.getElementById('compra-costo-unitario').value) || 0;
    const sku = document.getElementById('compra-producto').value;
    const product = state.inventory.find(p => p.sku === sku);

    if (product) {
        const total = qty * cost;
        
        let prodNameText = product.nombre;
        if (product.requiereSerial) {
            const serialVal = document.getElementById('compra-seriales').value;
            const series = serialVal.split(',').map(s => s.trim()).filter(Boolean);
            if (series.length > 0) {
                prodNameText += ` (S/N: ${series.join(', ')})`;
            }
        }
        
        document.getElementById('receipt-compra-producto').textContent = prodNameText;
        document.getElementById('receipt-compra-cantidad').textContent = qty;
        document.getElementById('receipt-compra-costo').textContent = formatCurrency(cost);
        document.getElementById('receipt-compra-total').textContent = formatCurrency(total);
    }
}

function resetCompraReceipt() {
    document.getElementById('receipt-compra-proveedor').textContent = 'No seleccionado';
    document.getElementById('receipt-compra-producto').textContent = 'No seleccionado';
    document.getElementById('receipt-compra-cantidad').textContent = '0';
    document.getElementById('receipt-compra-costo').textContent = '$0.00';
    document.getElementById('receipt-compra-total').textContent = '$0.00';
}

function processCompra(e) {
    e.preventDefault();
    const providerElem = document.getElementById('compra-proveedor');
    const productSelector = document.getElementById('compra-producto');
    const qtyInput = document.getElementById('compra-cantidad');
    const costInput = document.getElementById('compra-costo-unitario');
    const serialInput = document.getElementById('compra-seriales');

    const providerId = providerElem.value;
    const sku = productSelector.value;
    const cost = Number(costInput.value);

    const provider = state.providers.find(p => String(p.id) === String(providerId));
    const product = state.inventory.find(p => p.sku === sku);

    if (!provider || !product || cost <= 0) {
        showToast("Complete todos los campos con valores correctos.", "error");
        return;
    }

    let qty = 0;
    let newSeries = [];

    if (product.requiereSerial) {
        newSeries = serialInput.value.split(',').map(s => s.trim()).filter(Boolean);
        qty = newSeries.length;

        if (qty === 0) {
            showToast("Por favor ingrese al menos un número de serie para este producto.", "error");
            return;
        }

        // Validate duplicates in input list itself
        const uniqueInputSeries = new Set(newSeries);
        if (uniqueInputSeries.size !== newSeries.length) {
            showToast("No se permiten números de serie duplicados en la entrada.", "error");
            return;
        }

        // Validate duplicates globally (against existing database serial numbers)
        for (let s of newSeries) {
            const dupProduct = state.inventory.find(p => p.numSeries && p.numSeries.includes(s));
            if (dupProduct) {
                showToast(`El número de serie "${s}" ya está registrado en el producto: ${dupProduct.nombre}.`, "error");
                return;
            }
        }
    } else {
        qty = Number(qtyInput.value);
        if (qty <= 0) {
            showToast("Ingrese una cantidad de compra mayor a cero.", "error");
            return;
        }
    }

    const totalCostVal = qty * cost;

    // Mutate global state
    // 1. Add Stock / Concatenate serials
    if (product.requiereSerial) {
        if (!product.numSeries) product.numSeries = [];
        product.numSeries.push(...newSeries);
        product.stock = product.numSeries.length;
    } else {
        product.stock = Number(product.stock) + qty;
    }
    
    // 2. Adjust current products default buy price to the latest registered cost
    product.precioCompra = cost;

    // 3. Add transaction
    const newTx = {
        id: state.transactions.length > 0 ? Math.max(...state.transactions.map(t => t.id)) + 1 : 1,
        tipo: "Compra",
        fecha: new Date().toISOString(),
        entidad: provider.nombre,
        producto: product.requiereSerial ? `${product.nombre} (S/N: ${newSeries.join(', ')})` : product.nombre,
        cantidad: qty,
        total: totalCostVal
    };
    state.transactions.push(newTx);

    // Save & update
    saveAllToStorage();
    renderAll();

    showToast(`Reabasto completado exitosamente por ${formatCurrency(totalCostVal)}. Almacén actualizado.`, "success");

    navigateToSection('dashboard');
}

/* -------------------------------------------------------------
   HISTORIAL AUDITORIA & FILTER RENDER
   ------------------------------------------------------------- */
function renderHistorial() {
    const searchVal = document.getElementById('search-historial').value.toLowerCase();
    const filterType = document.getElementById('filter-historial-tipo').value;
    const tbody = document.getElementById('historial-tbody');

    const filtered = state.transactions.filter(t => {
        const matchesSearch = t.producto.toLowerCase().includes(searchVal) || t.entidad.toLowerCase().includes(searchVal);
        const matchesType = filterType === 'all' || t.tipo === filterType;
        return matchesSearch && matchesType;
    });

    // Sort transactions by date descending (latest first)
    const sorted = [...filtered].reverse();

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Ningún registro en el historial coincide.</td></tr>';
        return;
    }

    tbody.innerHTML = sorted.map(t => {
        const formattedDate = new Date(t.fecha).toLocaleString('es-ES', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });

        const isVenta = t.tipo === 'Venta';
        const typeBadge = isVenta ? 
            '<span class="badge badge-success">Venta (Ingreso)</span>' : 
            '<span class="badge badge-warning">Compra (Reabasto)</span>';

        return `
            <tr>
                <td>${formattedDate}</td>
                <td>${typeBadge}</td>
                <td class="font-semibold">${escapeHTML(t.entidad)}</td>
                <td>${escapeHTML(t.producto)}</td>
                <td class="text-center">${t.cantidad}</td>
                <td class="text-right font-semibold ${isVenta ? 'text-green' : 'text-orange'}">
                    ${isVenta ? '+' : '-'}${formatCurrency(t.total)}
                </td>
            </tr>
        `;
    }).join('');
}

/* -------------------------------------------------------------
   MODAL WINDOW DIALOG HANDLERS
   ------------------------------------------------------------- */

// General modal opener
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active-modal');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active-modal');
}

// 1. PRODUCT MODAL
function openModalProducto(sku = null) {
    const isEdit = sku !== null;
    const title = document.getElementById('modal-producto-titulo');
    const skuInput = document.getElementById('prod-sku');
    const nameInput = document.getElementById('prod-nombre');
    const catInput = document.getElementById('prod-categoria');
    const stockInput = document.getElementById('prod-stock');
    const minInput = document.getElementById('prod-stock-min');
    const buyInput = document.getElementById('prod-precio-compra');
    const sellInput = document.getElementById('prod-precio-venta');
    const origSku = document.getElementById('prod-original-sku');

    const reqSerialCheckbox = document.getElementById('prod-requiere-serial');
    const serialsContainer = document.getElementById('prod-seriales-container');
    const serialsTextarea = document.getElementById('prod-seriales-textarea');

    document.getElementById('form-producto').reset();

    if (isEdit) {
        const prod = state.inventory.find(p => p.sku === sku);
        if (!prod) return;
        
        title.textContent = "Editar Producto Existente";
        skuInput.value = prod.sku;
        skuInput.disabled = true; // Lock SKU editing to preserve transaction referential integrity
        origSku.value = prod.sku;
        nameInput.value = prod.nombre;
        catInput.value = prod.categoria;
        stockInput.value = prod.stock;
        minInput.value = prod.stockMinimo;
        buyInput.value = prod.precioCompra;
        sellInput.value = prod.precioVenta;

        // Serial number logic
        reqSerialCheckbox.checked = !!prod.requiereSerial;
        serialsTextarea.value = prod.numSeries ? prod.numSeries.join(', ') : '';
        if (prod.requiereSerial) {
            serialsContainer.style.display = 'block';
            stockInput.disabled = true;
        } else {
            serialsContainer.style.display = 'none';
            stockInput.disabled = false;
        }
    } else {
        title.textContent = "Agregar Nuevo Producto al Almacén";
        skuInput.disabled = false;
        origSku.value = '';

        reqSerialCheckbox.checked = false;
        serialsTextarea.value = '';
        serialsContainer.style.display = 'none';
        stockInput.disabled = false;
    }

    showModal('modal-producto');
}

function saveProduct(e) {
    e.preventDefault();
    const origSku = document.getElementById('prod-original-sku').value;
    const sku = document.getElementById('prod-sku').value.trim().toUpperCase();
    const name = document.getElementById('prod-nombre').value.trim();
    const category = document.getElementById('prod-categoria').value.trim();
    const minStock = Number(document.getElementById('prod-stock-min').value);
    const buyPrice = Number(document.getElementById('prod-precio-compra').value);
    const sellPrice = Number(document.getElementById('prod-precio-venta').value);

    const requiereSerial = document.getElementById('prod-requiere-serial').checked;
    const serialsText = document.getElementById('prod-seriales-textarea').value;
    
    // Parse serial numbers
    let numSeries = [];
    if (requiereSerial) {
        numSeries = serialsText.split(',').map(s => s.trim()).filter(Boolean);
        
        // Validate duplicates in the input list itself
        const uniqueSeries = new Set(numSeries);
        if (uniqueSeries.size !== numSeries.length) {
            showToast("No se permiten números de serie duplicados en este producto.", "error");
            return;
        }

        // Check if any of these serial numbers already exist in OTHER products in the inventory
        for (let s of numSeries) {
            const dupProduct = state.inventory.find(p => p.sku !== origSku && p.numSeries && p.numSeries.includes(s));
            if (dupProduct) {
                showToast(`El número de serie "${s}" ya está registrado en el producto: ${dupProduct.nombre}.`, "error");
                return;
            }
        }
    }

    const stock = requiereSerial ? numSeries.length : Number(document.getElementById('prod-stock').value);

    if (!sku || !name || !category || stock < 0 || minStock < 0 || buyPrice <= 0 || sellPrice <= 0) {
        showToast("Verifique que todos los números sean válidos y mayores a cero.", "error");
        return;
    }

    // Validate serial quantity matches stock
    if (requiereSerial && numSeries.length === 0) {
        showToast("Debe ingresar al menos un número de serie si requiere control por S/N.", "error");
        return;
    }

    const isEdit = origSku !== '';

    if (isEdit) {
        // Edit product in array
        const idx = state.inventory.findIndex(p => p.sku === origSku);
        if (idx !== -1) {
            state.inventory[idx] = {
                sku: origSku,
                nombre: name,
                categoria: category,
                stock: stock,
                stockMinimo: minStock,
                precioCompra: buyPrice,
                precioVenta: sellPrice,
                requiereSerial: requiereSerial,
                numSeries: numSeries
            };
            showToast(`Producto "${name}" modificado con éxito.`, "success");
        }
    } else {
        // Add new, check for SKU collision
        if (state.inventory.some(p => p.sku === sku)) {
            showToast(`Ya existe un producto con el SKU "${sku}".`, "error");
            return;
        }
        
        state.inventory.push({
            sku: sku,
            nombre: name,
            categoria: category,
            stock: stock,
            stockMinimo: minStock,
            precioCompra: buyPrice,
            precioVenta: sellPrice,
            requiereSerial: requiereSerial,
            numSeries: numSeries
        });
        showToast(`Producto "${name}" añadido al catálogo.`, "success");
    }

    saveAllToStorage();
    renderAll();
    hideModal('modal-producto');
}

// 2. CLIENT MODAL
function openModalCliente(id = null) {
    const isEdit = id !== null;
    const title = document.getElementById('modal-cliente-titulo');
    const nameInput = document.getElementById('cli-nombre');
    const telInput = document.getElementById('cli-telefono');
    const emailInput = document.getElementById('cli-email');
    const idInput = document.getElementById('cli-id');

    document.getElementById('form-cliente').reset();

    if (isEdit) {
        const cli = state.clients.find(c => String(c.id) === String(id));
        if (!cli) return;
        title.textContent = "Modificar Datos del Cliente";
        idInput.value = cli.id;
        nameInput.value = cli.nombre;
        telInput.value = cli.telefono;
        emailInput.value = cli.email;
    } else {
        title.textContent = "Registrar Nuevo Cliente";
        idInput.value = '';
    }

    showModal('modal-cliente');
}

function saveClient(e) {
    e.preventDefault();
    const id = document.getElementById('cli-id').value;
    const name = document.getElementById('cli-nombre').value.trim();
    const tel = document.getElementById('cli-telefono').value.trim();
    const email = document.getElementById('cli-email').value.trim();

    if (!name || !tel || !email) {
        showToast("Complete los datos requeridos.", "error");
        return;
    }

    const isEdit = id !== '';

    if (isEdit) {
        const cli = state.clients.find(c => String(c.id) === String(id));
        if (cli) {
            cli.nombre = name;
            cli.telefono = tel;
            cli.email = email;
            showToast(`Cliente "${name}" actualizado.`, "success");
        }
    } else {
        const nextId = state.clients.length > 0 ? Math.max(...state.clients.map(c => c.id)) + 1 : 1;
        state.clients.push({
            id: nextId,
            nombre: name,
            telefono: tel,
            email: email,
            totalComprado: 0.00
        });
        showToast(`Cliente "${name}" registrado exitosamente.`, "success");
    }

    saveAllToStorage();
    renderAll();
    hideModal('modal-cliente');
}

// 3. PROVIDER MODAL
function openModalProveedor(id = null) {
    const isEdit = id !== null;
    const title = document.getElementById('modal-proveedor-titulo');
    const nameInput = document.getElementById('prov-nombre');
    const contactInput = document.getElementById('prov-contacto');
    const telInput = document.getElementById('prov-telefono');
    const itemsInput = document.getElementById('prov-productos');
    const idInput = document.getElementById('prov-id');

    document.getElementById('form-proveedor').reset();

    if (isEdit) {
        const prov = state.providers.find(p => String(p.id) === String(id));
        if (!prov) return;
        title.textContent = "Modificar Datos del Proveedor";
        idInput.value = prov.id;
        nameInput.value = prov.nombre;
        contactInput.value = prov.contacto;
        telInput.value = prov.telefono;
        itemsInput.value = prov.productos;
    } else {
        title.textContent = "Registrar Nuevo Proveedor";
        idInput.value = '';
    }

    showModal('modal-proveedor');
}

function saveProvider(e) {
    e.preventDefault();
    const id = document.getElementById('prov-id').value;
    const name = document.getElementById('prov-nombre').value.trim();
    const contact = document.getElementById('prov-contacto').value.trim();
    const tel = document.getElementById('prov-telefono').value.trim();
    const items = document.getElementById('prov-productos').value.trim();

    if (!name || !contact || !tel || !items) {
        showToast("Complete los datos requeridos.", "error");
        return;
    }

    const isEdit = id !== '';

    if (isEdit) {
        const prov = state.providers.find(p => String(p.id) === String(id));
        if (prov) {
            prov.nombre = name;
            prov.contacto = contact;
            prov.telefono = tel;
            prov.productos = items;
            showToast(`Proveedor "${name}" actualizado.`, "success");
        }
    } else {
        const nextId = state.providers.length > 0 ? Math.max(...state.providers.map(p => p.id)) + 1 : 1;
        state.providers.push({
            id: nextId,
            nombre: name,
            contacto: contact,
            telefono: tel,
            productos: items
        });
        showToast(`Proveedor "${name}" registrado exitosamente.`, "success");
    }

    saveAllToStorage();
    renderAll();
    hideModal('modal-proveedor');
}

/* -------------------------------------------------------------
   GLOBAL INTERACTION UTILITIES
   ------------------------------------------------------------- */

// Format float as currency locale string
function formatCurrency(value) {
    return new Intl.NumberFormat('es-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}

// Redirects SPA view internally
function navigateToSection(targetId, callback = null) {
    const btn = document.querySelector(`.menu-item[data-target="${targetId}"]`);
    if (btn) {
        btn.click();
        if (callback) callback();
    }
}

// Safe string escaping for HTML rendering
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Sleek floating Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon based on type
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>`;
    } else {
        iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`;
    }

    toast.innerHTML = `${iconSvg} <span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    // Fade out and auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px) scale(0.9)';
        setTimeout(() => toast.remove(), 350);
    }, 3500);
}

/* -------------------------------------------------------------
   MÓDULO DE REPORTES: FILTRADO Y EXPORTACIÓN (EXCEL & PDF)
   ------------------------------------------------------------- */
function renderReportes() {
    const reportTypeSelect = document.getElementById('reporte-tipo');
    const dateDesdeInput = document.getElementById('reporte-fecha-desde');
    const dateHastaInput = document.getElementById('reporte-fecha-hasta');
    const alertBox = document.getElementById('reporte-alerta-vacio');
    const tableHeader = document.getElementById('reporte-thead');
    const tableBody = document.getElementById('reporte-tbody');
    const btnExcel = document.getElementById('btn-exportar-excel');
    const btnPdf = document.getElementById('btn-exportar-pdf');

    const reportType = reportTypeSelect.value;

    // Default dates initialization if empty
    if (!dateDesdeInput.value || !dateHastaInput.value) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        if (!dateDesdeInput.value) dateDesdeInput.value = `${year}-${month}-01`;
        if (!dateHastaInput.value) dateHastaInput.value = `${year}-${month}-${day}`;
    }

    const desdeVal = dateDesdeInput.value;
    const hastaVal = dateHastaInput.value;

    let filteredData = [];

    if (reportType === 'inventario') {
        // Current inventory snapshot
        dateDesdeInput.disabled = true;
        dateHastaInput.disabled = true;

        filteredData = state.inventory;

        let totalStock = 0;
        let totalVal = 0;

        filteredData.forEach(p => {
            totalStock += Number(p.stock) || 0;
            totalVal += (Number(p.stock) || 0) * (Number(p.precioCompra) || 0);
        });

        tableHeader.innerHTML = `
            <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th class="text-center">Stock</th>
                <th class="text-right">Precio Compra</th>
                <th class="text-right">Precio Venta</th>
                <th class="text-right">Valor Inventario</th>
            </tr>
        `;

        if (filteredData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No hay productos registrados en el catálogo.</td></tr>';
        } else {
            tableBody.innerHTML = filteredData.map(p => `
                <tr>
                    <td class="font-semibold">${escapeHTML(p.sku)}</td>
                    <td>${escapeHTML(p.nombre)}</td>
                    <td><span class="badge badge-info">${escapeHTML(p.categoria)}</span></td>
                    <td class="text-center font-semibold">${p.stock}</td>
                    <td class="text-right">${formatCurrency(p.precioCompra)}</td>
                    <td class="text-right">${formatCurrency(p.precioVenta)}</td>
                    <td class="text-right font-semibold">${formatCurrency(p.stock * p.precioCompra)}</td>
                </tr>
            `).join('') + `
                <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid var(--color-border-light);">
                    <td colspan="3">TOTALES</td>
                    <td class="text-center font-semibold">${totalStock}</td>
                    <td></td>
                    <td></td>
                    <td class="text-right text-green font-semibold">${formatCurrency(totalVal)}</td>
                </tr>
            `;
        }
    } else {
        // Sales or purchases reports
        dateDesdeInput.disabled = false;
        dateHastaInput.disabled = false;

        const isVentas = reportType === 'ventas';
        const rawTxs = state.transactions.filter(t => t.tipo === (isVentas ? 'Venta' : 'Compra'));

        const startDate = desdeVal ? new Date(desdeVal + 'T00:00:00') : null;
        const endDate = hastaVal ? new Date(hastaVal + 'T23:59:59') : null;

        filteredData = rawTxs.filter(t => {
            const tDate = new Date(t.fecha);
            return (!startDate || tDate >= startDate) && (!endDate || tDate <= endDate);
        });

        // Sort chronological
        filteredData.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        let totalQty = 0;
        let totalVal = 0;

        filteredData.forEach(t => {
            totalQty += Number(t.cantidad) || 0;
            totalVal += Number(t.total) || 0;
        });

        tableHeader.innerHTML = `
            <tr>
                <th>Fecha y Hora</th>
                <th>${isVentas ? 'Cliente' : 'Proveedor'}</th>
                <th>Productos</th>
                <th class="text-center">Cant.</th>
                <th class="text-right">Total Transacción</th>
            </tr>
        `;

        if (filteredData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No se encontraron movimientos para el periodo seleccionado.</td></tr>`;
        } else {
            tableBody.innerHTML = filteredData.map(t => {
                const formattedDate = new Date(t.fecha).toLocaleString('es-ES', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
                return `
                    <tr>
                        <td>${formattedDate}</td>
                        <td class="font-semibold">${escapeHTML(t.entidad)}</td>
                        <td>${escapeHTML(t.producto)}</td>
                        <td class="text-center font-semibold">${t.cantidad}</td>
                        <td class="text-right font-semibold ${isVentas ? 'text-green' : 'text-orange'}">${formatCurrency(t.total)}</td>
                    </tr>
                `;
            }).join('') + `
                <tr style="background-color: #f8fafc; font-weight: 700; border-top: 2px solid var(--color-border-light);">
                    <td colspan="3">TOTALES</td>
                    <td class="text-center font-semibold">${totalQty}</td>
                    <td class="text-right font-semibold ${isVentas ? 'text-green' : 'text-orange'}">${formatCurrency(totalVal)}</td>
                </tr>
            `;
        }
    }

    // Dynamic buttons validation
    if (filteredData.length === 0) {
        btnExcel.disabled = true;
        btnPdf.disabled = true;
        
        // Show empty alert
        alertBox.style.display = 'block';
        if (reportType === 'inventario') {
            document.getElementById('reporte-alerta-texto').textContent = 'No hay productos registrados en el catálogo.';
        } else {
            document.getElementById('reporte-alerta-texto').textContent = 'No hay datos disponibles en el rango de fechas seleccionado.';
        }
    } else {
        btnExcel.disabled = false;
        btnPdf.disabled = false;
        alertBox.style.display = 'none';
    }
}

function exportarExcel() {
    const reportType = document.getElementById('reporte-tipo').value;
    const desde = document.getElementById('reporte-fecha-desde').value;
    const hasta = document.getElementById('reporte-fecha-hasta').value;

    let headers = [];
    let rows = [];
    let filename = '';

    if (reportType === 'inventario') {
        filename = `Reporte_Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`;
        headers = ["SKU", "Nombre", "Categoría", "Stock", "Precio Compra ($)", "Precio Venta ($)", "Valor Inventario ($)"];
        
        let totalStock = 0;
        let totalVal = 0;

        state.inventory.forEach(p => {
            const stock = Number(p.stock) || 0;
            const buy = Number(p.precioCompra) || 0;
            const subtotal = stock * buy;
            
            totalStock += stock;
            totalVal += subtotal;

            rows.push([
                p.sku,
                p.nombre,
                p.categoria,
                stock,
                buy,
                Number(p.precioVenta) || 0,
                subtotal
            ]);
        });

        // Totales row
        rows.push(["TOTALES", "", "", totalStock, "", "", totalVal]);

    } else {
        const isVentas = reportType === 'ventas';
        filename = `Reporte_${isVentas ? 'Ventas' : 'Compras'}_${desde}_a_${hasta}.xlsx`;
        headers = ["Fecha y Hora", isVentas ? "Cliente" : "Proveedor", "Productos", "Cantidad", "Total Transacción ($)"];

        const rawTxs = state.transactions.filter(t => t.tipo === (isVentas ? 'Venta' : 'Compra'));
        const startDate = desde ? new Date(desde + 'T00:00:00') : null;
        const endDate = hasta ? new Date(hasta + 'T23:59:59') : null;

        const filtered = rawTxs.filter(t => {
            const tDate = new Date(t.fecha);
            return (!startDate || tDate >= startDate) && (!endDate || tDate <= endDate);
        });

        filtered.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        let totalQty = 0;
        let totalVal = 0;

        filtered.forEach(t => {
            const qty = Number(t.cantidad) || 0;
            const total = Number(t.total) || 0;
            totalQty += qty;
            totalVal += total;

            rows.push([
                new Date(t.fecha).toLocaleString('es-ES'),
                t.entidad,
                t.producto,
                qty,
                total
            ]);
        });

        // Totales row
        rows.push(["TOTALES", "", "", totalQty, totalVal]);
    }

    if (rows.length === 0) {
        showToast("No hay datos para exportar.", "error");
        return;
    }

    // SheetJS integration
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        
        // Add basic column widths
        const wscols = headers.map(h => ({ wch: Math.max(h.length + 3, 12) }));
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        XLSX.writeFile(wb, filename);
        showToast("Archivo Excel descargado con éxito.", "success");
    } catch (err) {
        console.error(err);
        showToast("Error al exportar archivo Excel.", "error");
    }
}

function descargarPDF() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        showToast("Error: La biblioteca jsPDF no está cargada.", "error");
        return;
    }

    const reportType = document.getElementById('reporte-tipo').value;
    const desde = document.getElementById('reporte-fecha-desde').value;
    const hasta = document.getElementById('reporte-fecha-hasta').value;

    const doc = new jsPDF();
    const generationDate = new Date().toLocaleString('es-ES');

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59); // Slate 800

    let reportTitle = '';
    let headers = [];
    let body = [];
    let columnStyles = {};

    if (reportType === 'inventario') {
        reportTitle = "Reporte de Inventario Actual - LDT Multiservicios";
        headers = [["SKU", "Nombre", "Categoría", "Stock", "P. Compra", "P. Venta", "Valor Stock"]];
        
        let totalStock = 0;
        let totalVal = 0;

        state.inventory.forEach(p => {
            const stock = Number(p.stock) || 0;
            const buy = Number(p.precioCompra) || 0;
            const val = stock * buy;
            totalStock += stock;
            totalVal += val;

            body.push([
                p.sku,
                p.nombre,
                p.categoria,
                stock,
                formatCurrency(buy),
                formatCurrency(Number(p.precioVenta) || 0),
                formatCurrency(val)
            ]);
        });

        // Add footer row
        body.push(["TOTALES", "", "", totalStock, "", "", formatCurrency(totalVal)]);
        
        columnStyles = {
            3: { halign: 'center' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' }
        };

    } else {
        const isVentas = reportType === 'ventas';
        reportTitle = `Reporte de ${isVentas ? 'Ventas' : 'Compras'} - LDT Multiservicios`;
        headers = [["Fecha y Hora", isVentas ? "Cliente" : "Proveedor", "Productos", "Cant.", "Total"]];

        const rawTxs = state.transactions.filter(t => t.tipo === (isVentas ? 'Venta' : 'Compra'));
        const startDate = desde ? new Date(desde + 'T00:00:00') : null;
        const endDate = hasta ? new Date(hasta + 'T23:59:59') : null;

        const filtered = rawTxs.filter(t => {
            const tDate = new Date(t.fecha);
            return (!startDate || tDate >= startDate) && (!endDate || tDate <= endDate);
        });

        filtered.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        let totalQty = 0;
        let totalVal = 0;

        filtered.forEach(t => {
            const qty = Number(t.cantidad) || 0;
            const total = Number(t.total) || 0;
            totalQty += qty;
            totalVal += total;

            body.push([
                new Date(t.fecha).toLocaleString('es-ES'),
                t.entidad,
                t.producto,
                qty,
                formatCurrency(total)
            ]);
        });

        // Add footer row
        body.push(["TOTALES", "", "", totalQty, formatCurrency(totalVal)]);

        columnStyles = {
            3: { halign: 'center' },
            4: { halign: 'right' }
        };
    }

    if (body.length <= 1) {
        showToast("No hay registros en el rango seleccionado.", "error");
        return;
    }

    doc.text(reportTitle, 14, 20);

    // Meta details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate 500
    
    let subtext = `Generado: ${generationDate}`;
    if (reportType !== 'inventario') {
        subtext += ` | Rango: ${desde || '--'} al ${hasta || '--'}`;
    }
    doc.text(subtext, 14, 26);

    // AutoTable layout
    doc.autoTable({
        startY: 32,
        head: headers,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [74, 85, 104], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold' },
        styles: { fontSize: 8.5, fontFamily: 'helvetica' },
        columnStyles: columnStyles,
        didParseCell: function (data) {
            // Apply bold styles to totals row manually
            if (data.row.index === body.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [241, 245, 249];
            }
        }
    });

    // Save
    const suffix = reportType === 'inventario' ? 'Inventario' : (reportType === 'ventas' ? 'Ventas' : 'Compras');
    doc.save(`Reporte_${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast("Documento PDF descargado con éxito.", "success");
}

// factory reset storage
function triggerFactoryReset() {
    if (confirm("⚠️ ¿Estás seguro de reiniciar la base de datos a sus valores iniciales?\nSe perderán todas tus ventas y compras nuevas.")) {
        localStorage.clear();
        state.inventory = JSON.parse(JSON.stringify(defaultInventory));
        state.clients = JSON.parse(JSON.stringify(defaultClients));
        state.providers = JSON.parse(JSON.stringify(defaultProviders));
        state.transactions = JSON.parse(JSON.stringify(defaultTransactions));
        ventaCarrito = [];
        
        saveAllToStorage();
        renderAll();
        
        showToast("Base de datos restaurada a valores iniciales de fábrica.", "warning");
        navigateToSection('dashboard');
    }
}

/* -------------------------------------------------------------
   GLOBAL BINDINGS & EVENT LISTENERS
   ------------------------------------------------------------- */
function setupEventListeners() {
    // 1. Modals Open
    document.getElementById('btn-abrir-modal-producto').onclick = () => openModalProducto();
    document.getElementById('btn-abrir-modal-cliente').onclick = () => openModalCliente();
    document.getElementById('btn-abrir-modal-proveedor').onclick = () => openModalProveedor();

    // 2. Modals Close binds
    document.querySelectorAll('.modal-close-btn, .btn-cerrar-modal').forEach(btn => {
        btn.onclick = (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) overlay.classList.remove('active-modal');
        };
    });

    // Close on clicking overlay backing
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.classList.remove('active-modal');
        };
    });

    // 3. Search and filter binds
    document.getElementById('search-inventario').oninput = () => renderInventario();
    document.getElementById('filter-inventario-categoria').onchange = () => renderInventario();
    
    document.getElementById('search-clientes').oninput = () => renderClientes();
    document.getElementById('search-proveedores').oninput = () => renderProveedores();
    
    document.getElementById('search-historial').oninput = () => renderHistorial();
    document.getElementById('filter-historial-tipo').onchange = () => renderHistorial();

    // Report filters change and export buttons click bindings
    document.getElementById('reporte-tipo').onchange = () => renderReportes();
    document.getElementById('reporte-fecha-desde').onchange = () => renderReportes();
    document.getElementById('reporte-fecha-hasta').onchange = () => renderReportes();
    document.getElementById('btn-exportar-excel').onclick = exportarExcel;
    document.getElementById('btn-exportar-pdf').onclick = descargarPDF;

    // 4. Forms submit binds
    document.getElementById('form-producto').onsubmit = saveProduct;
    document.getElementById('form-cliente').onsubmit = saveClient;
    document.getElementById('form-proveedor').onsubmit = saveProvider;
    document.getElementById('form-nueva-venta').onsubmit = processVenta;
    document.getElementById('form-nueva-compra').onsubmit = processCompra;

    // 4b. Add to cart button bind
    document.getElementById('btn-agregar-producto-carrito').onclick = agregarAlCarrito;

    // 5. Factory reset button
    document.getElementById('btn-limpiar-historial-datos').onclick = triggerFactoryReset;

    // 6. Setup product modal checkbox/textarea dynamic behaviors
    const reqSerialCheckbox = document.getElementById('prod-requiere-serial');
    const serialsContainer = document.getElementById('prod-seriales-container');
    const serialsTextarea = document.getElementById('prod-seriales-textarea');
    const stockInput = document.getElementById('prod-stock');

    if (reqSerialCheckbox && serialsContainer && serialsTextarea && stockInput) {
        reqSerialCheckbox.onchange = () => {
            if (reqSerialCheckbox.checked) {
                serialsContainer.style.display = 'block';
                stockInput.disabled = true;
                const serials = serialsTextarea.value.split(',').map(s => s.trim()).filter(Boolean);
                stockInput.value = serials.length;
            } else {
                serialsContainer.style.display = 'none';
                stockInput.disabled = false;
            }
        };

        serialsTextarea.oninput = () => {
            if (reqSerialCheckbox.checked) {
                const serials = serialsTextarea.value.split(',').map(s => s.trim()).filter(Boolean);
                stockInput.value = serials.length;
            }
        };
    }
}

// Boot up app on DOM Load
window.addEventListener('DOMContentLoaded', initApp);
