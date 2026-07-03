/* ==============================================================================
   MÓDULO DE ANALÍTICAS DEL DASHBOARD (Saas premium con Chart.js)
   ============================================================================== */

let dashboardVentasChart = null;
let dashboardCategoriasChart = null;
let globalStatsData = null; // Guardar datos para interactividad rápida
let monedaGraficoActiva = 'PEN'; // PEN o USD para el gráfico de barras

async function renderDashboard(container) {
    container.innerHTML = `
        <!-- 1. Fila de KPIs Superiores -->
        <div class="kpi-grid">
            <!-- Ventas de Hoy -->
            <div class="kpi-card sales">
                <div class="kpi-details">
                    <span class="kpi-label">Ventas de Hoy</span>
                    <div class="kpi-value-main" id="kpi-sales-main">S/ 0.00</div>
                    <div class="kpi-value-sec" id="kpi-sales-sec">
                        <span class="kpi-badge-usd">USD</span> <span id="kpi-sales-usd-val">$ 0.00</span>
                    </div>
                </div>
                <div class="kpi-icon-wrapper">
                    <i data-lucide="trending-up"></i>
                </div>
            </div>

            <!-- Compras del Mes -->
            <div class="kpi-card purchases">
                <div class="kpi-details">
                    <span class="kpi-label">Compras del Mes</span>
                    <div class="kpi-value-main" id="kpi-purchases-main" style="color:var(--color-warning);">S/ 0.00</div>
                    <div class="kpi-value-sec" id="kpi-purchases-sec">
                        <span class="kpi-badge-usd">USD</span> <span id="kpi-purchases-usd-val">$ 0.00</span>
                    </div>
                </div>
                <div class="kpi-icon-wrapper">
                    <i data-lucide="shopping-bag"></i>
                </div>
            </div>

            <!-- Clientes Activos -->
            <div class="kpi-card clients">
                <div class="kpi-details">
                    <span class="kpi-label">Clientes Activos</span>
                    <div class="kpi-value-main" id="kpi-clients-count" style="color:var(--color-info);">0</div>
                    <div class="kpi-value-sec">
                        <span class="kpi-badge-pen">Registrados</span> <span>Fidelizados</span>
                    </div>
                </div>
                <div class="kpi-icon-wrapper">
                    <i data-lucide="users"></i>
                </div>
            </div>

            <!-- Alertas Críticas -->
            <div class="kpi-card alerts">
                <div class="kpi-details">
                    <span class="kpi-label">Alertas Críticas</span>
                    <div class="kpi-value-main" id="kpi-alerts-count" style="color:var(--color-danger);">0</div>
                    <div class="kpi-value-sec">
                        <span style="color:var(--color-danger); font-weight:700;">Stock Bajo</span> <span>Requiere atención</span>
                    </div>
                </div>
                <div class="kpi-icon-wrapper">
                    <i data-lucide="alert-octagon"></i>
                </div>
            </div>
        </div>

        <!-- 2. Fila de Gráficos (Tendencias & Categorías) -->
        <div class="charts-layout">
            <!-- Gráfico de Tendencia de Ventas (Grande) -->
            <div class="card">
                <div class="card-title">
                    <span>Tendencia de Facturación Mensual</span>
                    <div class="chart-header-actions">
                        <button class="chart-tab-btn active" id="btn-chart-pen" onclick="cambiarMonedaGrafico('PEN')">Soles (PEN)</button>
                        <button class="chart-tab-btn" id="btn-chart-usd" onclick="cambiarMonedaGrafico('USD')">Dólares (USD)</button>
                    </div>
                </div>
                <div style="position:relative; height:320px; width:100%;">
                    <canvas id="canvas-ventas-mensuales"></canvas>
                </div>
            </div>

            <!-- Gráfico Donut de Categorías Más Vendidas -->
            <div class="card">
                <div class="card-title">Categorías Más Vendidas</div>
                <div style="position:relative; height:320px; width:100%; display:flex; justify-content:center; align-items:center;">
                    <canvas id="canvas-categorias-donut"></canvas>
                </div>
            </div>
        </div>

        <!-- 3. Fila de Tablas de Actividad Reciente -->
        <div class="tables-layout">
            <!-- Últimas Ventas Realizadas -->
            <div class="card">
                <div class="card-title">
                    <span>Últimas Ventas Realizadas</span>
                    <i data-lucide="history" style="color:var(--text-muted); width:18px;"></i>
                </div>
                <div class="table-container" style="border:none;">
                    <table class="dashboard-mini-table">
                        <thead>
                            <tr>
                                <th>Comprobante</th>
                                <th>Cliente</th>
                                <th>Fecha</th>
                                <th style="text-align:right;">Monto Cobrado</th>
                            </tr>
                        </thead>
                        <tbody id="dash-ventas-recientes-body">
                            <tr>
                                <td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">Cargando ventas recientes...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Alertas de Stock Críticas -->
            <div class="card">
                <div class="card-title">
                    <span>Productos en Alerta de Stock</span>
                    <span class="badge badge-danger" id="dash-stock-badge-count">0</span>
                </div>
                <div class="stock-alerts-list" id="dash-stock-alerts-container">
                    <div class="empty-list-message">Todo el inventario está en niveles óptimos.</div>
                </div>
            </div>
        </div>
    `;

    // Cargar datos
    await cargarDatosDashboardPremium();
    lucide.createIcons();
}

async function cargarDatosDashboardPremium() {
    try {
        const res = await fetch(`${API_URL}/api/dashboard/stats`);
        const data = await res.json();
        globalStatsData = data; // Respaldar datos

        // 1. Cargar KPIs de Ventas y Compras
        document.getElementById('kpi-sales-main').textContent = formatCurrency(data.ventas_hoy.PEN, 'PEN');
        document.getElementById('kpi-sales-usd-val').textContent = formatCurrency(data.ventas_hoy.USD, 'USD');

        document.getElementById('kpi-purchases-main').textContent = formatCurrency(data.compras_mes.PEN, 'PEN');
        document.getElementById('kpi-purchases-usd-val').textContent = formatCurrency(data.compras_mes.USD, 'USD');

        // 2. Cargar Clientes Activos
        document.getElementById('kpi-clients-count').textContent = data.clientes_activos;

        // 3. Alertas de Stock
        const alertCount = data.bajo_stock.length;
        document.getElementById('kpi-alerts-count').textContent = alertCount;
        document.getElementById('dash-stock-badge-count').textContent = alertCount;

        const alertsContainer = document.getElementById('dash-stock-alerts-container');
        if (alertCount > 0) {
            alertsContainer.innerHTML = data.bajo_stock.map(p => {
                const zeroStockClass = p.stock_actual === 0 ? 'zero-stock' : 'low-stock';
                const zeroStockLabel = p.stock_actual === 0 ? 'AGOTADO' : 'STOCK BAJO';
                const badgeColorClass = p.stock_actual === 0 ? 'badge-danger' : 'badge-warning';
                
                return `
                    <div class="alert-item-critical ${zeroStockClass}">
                        <div class="alert-product-info">
                            <span class="alert-product-name">${p.nombre}</span>
                            <span class="alert-product-limits">Mínimo requerido: ${p.stock_minimo} U.</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="badge ${badgeColorClass}" style="font-size:0.65rem;">${zeroStockLabel}</span>
                            <span class="alert-stock-badge" style="background-color:rgba(255,255,255,0.02); color:var(--text-main); border-color:var(--border-color);">${p.stock_actual} U.</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            alertsContainer.innerHTML = '<div class="empty-list-message">Todo el inventario está en niveles óptimos.</div>';
        }

        // 4. Ventas Recientes
        const tbodyVentas = document.getElementById('dash-ventas-recientes-body');
        if (data.ventas_recientes && data.ventas_recientes.length > 0) {
            tbodyVentas.innerHTML = data.ventas_recientes.map(v => {
                const badgeColor = v.estado === 'Completada' ? 'var(--color-success)' : 'var(--color-danger)';
                let parsedStr = v.fecha_venta;
                if (typeof parsedStr === 'string') {
                    if (!parsedStr.includes('T') && !parsedStr.includes('Z') && parsedStr.includes(' ')) {
                        parsedStr = parsedStr.replace(' ', 'T') + 'Z';
                    } else if (parsedStr.includes('T') && !parsedStr.includes('Z') && !parsedStr.includes('+') && !parsedStr.includes('-')) {
                        parsedStr = parsedStr + 'Z';
                    }
                }
                const d = new Date(parsedStr);
                let fechaFormateada = v.fecha_venta;
                if (!isNaN(d.getTime())) {
                    const horas = String(d.getHours()).padStart(2, '0');
                    const minutos = String(d.getMinutes()).padStart(2, '0');
                    const dia = String(d.getDate()).padStart(2, '0');
                    const mes = String(d.getMonth() + 1).padStart(2, '0');
                    fechaFormateada = `${horas}:${minutos} (${dia}/${mes})`;
                }
                return `
                    <tr>
                        <td style="font-family:monospace; font-weight:700;">${v.documento}</td>
                        <td style="font-weight:600;">${v.cliente_nombre}</td>
                        <td style="font-size:0.75rem; color:var(--text-muted);">${fechaFormateada}</td>
                        <td style="text-align:right; font-weight:700; color:${badgeColor};">${formatCurrency(v.total, v.moneda)}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbodyVentas.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No hay transacciones registradas hoy.</td></tr>';
        }

        // 5. Inicializar Gráfico de Barras y Donut
        inicializarGraficosDashboard(data);

    } catch (err) {
        console.error(err);
        mostrarToast("Fallo de conexión al cargar datos del tablero.", "danger");
    }
}

function inicializarGraficosDashboard(data) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#9ca3af' : '#4b5563';

    // A. GRÁFICO 1: TENDENCIA DE VENTAS (BARRAS / LÍNEA)
    const ctxVentas = document.getElementById('canvas-ventas-mensuales').getContext('2d');
    if (dashboardVentasChart) dashboardVentasChart.destroy();

    const meses = [...new Set(data.grafico_ventas.map(d => d.mes))].sort();
    const ventasDataset = obtenerDatasetPorMoneda(data.grafico_ventas, meses, monedaGraficoActiva);

    const nombresMeses = {
        '01':'Ene', '02':'Feb', '03':'Mar', '04':'Abr', '05':'May', '06':'Jun',
        '07':'Jul', '08':'Ago', '09':'Sep', '10':'Oct', '11':'Nov', '12':'Dic'
    };
    const etiquetasMeses = meses.map(m => {
        const p = m.split('-');
        return `${nombresMeses[p[1]]} ${p[0]}`;
    });

    dashboardVentasChart = new Chart(ctxVentas, {
        type: 'bar',
        data: {
            labels: etiquetasMeses,
            datasets: [{
                label: `Facturado (${monedaGraficoActiva})`,
                data: ventasDataset,
                backgroundColor: monedaGraficoActiva === 'PEN' ? 'rgba(99, 102, 241, 0.75)' : 'rgba(6, 182, 212, 0.75)',
                borderColor: monedaGraficoActiva === 'PEN' ? '#6366f1' : '#06b6d4',
                borderWidth: 1.5,
                borderRadius: 6,
                barThickness: 32
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` Total: ${formatCurrency(context.parsed.y, monedaGraficoActiva)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Inter', weight: '500' } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { family: 'Inter' },
                        callback: function(value) {
                            return (monedaGraficoActiva === 'PEN' ? 'S/ ' : '$ ') + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });

    // B. GRÁFICO 2: CATEGORÍAS MÁS VENDIDAS (DONUT)
    const ctxCat = document.getElementById('canvas-categorias-donut').getContext('2d');
    if (dashboardCategoriasChart) dashboardCategoriasChart.destroy();

    const catsLabels = data.categorias_vendidas.map(c => c.categoria);
    const catsData = data.categorias_vendidas.map(c => c.total_sold || c.total_vendido); // Compatibilidad sqlite

    // Colores vibrantes para la analítica
    const catColores = [
        'rgba(99, 102, 241, 0.8)',  // Violeta
        'rgba(6, 182, 212, 0.8)',   // Cian
        'rgba(16, 185, 129, 0.8)',  // Esmeralda
        'rgba(245, 158, 11, 0.8)',  // Ambar
        'rgba(239, 68, 68, 0.8)'    // Rojo
    ];

    dashboardCategoriasChart = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: catsLabels,
            datasets: [{
                data: catsData,
                backgroundColor: catColores,
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#1e293b' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%', // Anillo fino y elegante (Donut premium)
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: { family: 'Inter', weight: '500', size: 11 },
                        padding: 16
                    }
                }
            }
        }
    });
}

function obtenerDatasetPorMoneda(grafico, meses, moneda) {
    return meses.map(m => {
        const d = grafico.find(item => item.mes === m && item.moneda === moneda);
        return d ? parseFloat(d.total) : 0.0;
    });
}

function cambiarMonedaGrafico(moneda) {
    monedaGraficoActiva = moneda;
    
    // Cambiar clases activas en los botones de la UI
    document.getElementById('btn-chart-pen').classList.toggle('active', moneda === 'PEN');
    document.getElementById('btn-chart-usd').classList.toggle('active', moneda === 'USD');

    if (globalStatsData && dashboardVentasChart) {
        const meses = [...new Set(globalStatsData.grafico_ventas.map(d => d.mes))].sort();
        const nuevoDataset = obtenerDatasetPorMoneda(globalStatsData.grafico_ventas, meses, moneda);
        
        dashboardVentasChart.data.datasets[0].label = `Facturado (${moneda})`;
        dashboardVentasChart.data.datasets[0].data = nuevoDataset;
        dashboardVentasChart.data.datasets[0].backgroundColor = moneda === 'PEN' ? 'rgba(99, 102, 241, 0.75)' : 'rgba(6, 182, 212, 0.75)';
        dashboardVentasChart.data.datasets[0].borderColor = moneda === 'PEN' ? '#6366f1' : '#06b6d4';
        
        dashboardVentasChart.update();
    }
}
