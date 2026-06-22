/* ==============================================================================
   LÓGICA PRINCIPAL, ENRUTADOR Y COMPONENTES GLOBALES DE LA SPA
   ============================================================================== */

// URL Base de la API local (Se adapta automáticamente si se abre como archivo local file://)
const API_URL = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : ''; 

// Estado Global de la SPA
let usuarioActivo = null;
let tipoCambioActual = 3.7500;
let vistaActiva = 'dashboard';

// Al cargar el documento, inicializamos el sistema
document.addEventListener('DOMContentLoaded', () => {
    inicializarTema();
    inicializarSidebarColapsable();
    inicializarAutenticacion();
    registrarEventosMenu();
    obtenerTipoCambioGlobal();
    cargarLogoEmpresa();
});

/* ==============================================================================
   CONTROL DE AUTENTICACIÓN
   ============================================================================== */
function inicializarAutenticacion() {
    const sesion = localStorage.getItem('erp_session');
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
    if (sesion) {
        usuarioActivo = JSON.parse(sesion);
        loginScreen.style.display = 'none';
        appScreen.style.display = 'flex';
        actualizarInfoUsuarioHeader();
        irAVista('dashboard');
    } else {
        loginScreen.style.display = 'flex';
        appScreen.style.display = 'none';
    }

    // Evento del formulario de Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        errorDiv.style.display = 'none';
        
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (data.exito) {
                usuarioActivo = data.usuario;
                localStorage.setItem('erp_session', JSON.stringify(usuarioActivo));
                
                loginScreen.style.display = 'none';
                appScreen.style.display = 'flex';
                actualizarInfoUsuarioHeader();
                irAVista('dashboard');
                mostrarToast('Inicio de sesión correcto. ¡Bienvenido!', 'success');
            } else {
                errorDiv.textContent = data.mensaje || 'Error al autenticar.';
                errorDiv.style.display = 'block';
            }
        } catch (err) {
            errorDiv.textContent = 'No se pudo conectar con el servidor local.';
            errorDiv.style.display = 'block';
            console.error(err);
        }
    });

    // Evento del botón de cerrar sesión
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.removeItem('erp_session');
        usuarioActivo = null;
        loginScreen.style.display = 'flex';
        appScreen.style.display = 'none';
        mostrarToast('Sesión cerrada con éxito.', 'info');
    });
}

function actualizarInfoUsuarioHeader() {
    if (!usuarioActivo) return;
    document.getElementById('header-user-name').textContent = usuarioActivo.nombre;
    document.getElementById('header-user-role').textContent = usuarioActivo.rol;
    
    // Iniciales para el avatar
    const iniciales = usuarioActivo.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('header-avatar').textContent = iniciales;
}

/* ==============================================================================
   ENRUTADOR DE VISTAS (SPA ENGINE)
   ============================================================================= */
function registrarEventosMenu() {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const view = item.getAttribute('data-view');
            irAVista(view);
        });
    });
}

async function irAVista(vista) {
    vistaActiva = vista;
    const viewContainer = document.getElementById('main-view');
    const headerTitle = document.getElementById('current-view-title');
    
    // Limpiar contenedor
    viewContainer.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:200px;"><i data-lucide="loader" class="animate-spin" style="width:32px; height:32px; color:var(--color-primary);"></i></div>';
    lucide.createIcons();

    // Actualizar Título
    const titulos = {
        'dashboard': 'Dashboard de Control',
        'pos': 'Punto de Venta (POS)',
        'cotizaciones': 'Generador de Cotizaciones (Precios Manuales)',
        'inventario': 'Gestión de Inventario y Series',
        'movimientos': 'Resumen de Movimientos (Kárdex)',
        'compras': 'Registro de Compras (Abastecimiento)',
        'actores': 'Clientes y Proveedores',
        'cuentas': 'Cuentas Corrientes y Créditos',
        'soporte': 'Gestión de Servicio Técnico',
        'prestamos': 'Préstamos / Salidas Temporales Intertiendas',
        'configuracion': 'Configuración del Sistema'
    };
    headerTitle.textContent = titulos[vista] || 'Sistema ERP/POS';

    // Renderizar Vista
    try {
        switch (vista) {
            case 'dashboard':
                await renderDashboard(viewContainer);
                break;
            case 'pos':
                await renderPOS(viewContainer);
                break;
            case 'cotizaciones':
                await renderCotizaciones(viewContainer);
                break;
            case 'inventario':
                await renderInventario(viewContainer);
                break;
            case 'movimientos':
                await renderMovimientos(viewContainer);
                break;
            case 'compras':
                await renderCompras(viewContainer);
                break;
            case 'actores':
                await renderActores(viewContainer);
                break;
            case 'cuentas':
                await renderCuentas(viewContainer);
                break;
            case 'configuracion':
                await renderConfiguracion(viewContainer);
                break;
            case 'soporte':
                await renderSoporte(viewContainer);
                break;
            case 'prestamos':
                await renderPrestamos(viewContainer);
                break;
            default:
                viewContainer.innerHTML = '<h2>Vista no encontrada</h2>';
        }
    } catch (err) {
        viewContainer.innerHTML = `<div class="card" style="border-color:var(--color-danger); color:var(--color-danger);"><h3>Error al cargar vista:</h3><p>${err.message}</p></div>`;
        console.error(err);
    }
    
    // Inicializar iconos de Lucide cargados dinámicamente
    lucide.createIcons();
}

/* ==============================================================================
   TIPO DE CAMBIO GLOBAL
   ============================================================================== */
async function obtenerTipoCambioGlobal() {
    try {
        const res = await fetch(`${API_URL}/api/config`);
        const config = await res.json();
        if (config && config.tipo_cambio_actual) {
            tipoCambioActual = floatVal(config.tipo_cambio_actual);
            document.getElementById('global-tc').textContent = `S/ ${tipoCambioActual.toFixed(4)}`;
        }
    } catch (err) {
        console.error("Error al obtener tipo de cambio:", err);
    }
}

/* ==============================================================================
   CARGA DE LOGOTIPO DE LA EMPRESA
   ============================================================================== */
async function cargarLogoEmpresa() {
    try {
        const res = await fetch(`${API_URL}/api/config`);
        const config = await res.json();
        const logoIcon = document.getElementById('sidebar-logo-icon');
        if (logoIcon) {
            if (config && config.logo_path) {
                logoIcon.innerHTML = `<img src="${API_URL}${config.logo_path}" style="width: 100%; height: 100%; object-fit: contain; border-radius: var(--radius-md);" alt="Logo" />`;
                logoIcon.style.padding = '2px';
                logoIcon.style.background = 'none';
                logoIcon.style.boxShadow = 'none';
            } else {
                logoIcon.innerHTML = 'EG';
                logoIcon.style.padding = '';
                logoIcon.style.background = '';
                logoIcon.style.boxShadow = '';
            }
        }
    } catch (err) {
        console.error("Error al cargar logotipo de la empresa:", err);
    }
}

/* ==============================================================================
   MÓDULO DE TEMA (CLARO / OSCURO)
   ============================================================================== */
function inicializarTema() {
    const savedTheme = localStorage.getItem('erp_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    actualizarIconoTema(savedTheme);
    
    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('erp_theme', newTheme);
        actualizarIconoTema(newTheme);
    });
}

function actualizarIconoTema(theme) {
    const themeIcon = document.getElementById('theme-icon');
    if (theme === 'dark') {
        themeIcon.setAttribute('data-lucide', 'sun');
    } else {
        themeIcon.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
}

/* ==============================================================================
   MODALES GLOBALES (FUNCIONES AUXILIARES)
   ============================================================================== */
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function setupGlobalModal(title, bodyHtml, footerHtml) {
    document.getElementById('global-modal-title').textContent = title;
    document.getElementById('global-modal-body').innerHTML = bodyHtml;
    document.getElementById('global-modal-footer').innerHTML = footerHtml;
    openModal('global-modal');
    lucide.createIcons();
}

/* ==============================================================================
   NOTIFICACIONES FLOTANTES (TOASTS)
   ============================================================================== */
function mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.zIndex = '9999';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = 'var(--radius-sm)';
    toast.style.color = 'white';
    toast.style.fontWeight = '600';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.animation = 'slideInToast 0.3s ease';

    const colores = {
        'success': 'var(--color-success)',
        'warning': 'var(--color-warning)',
        'danger': 'var(--color-danger)',
        'info': 'var(--color-info)'
    };
    toast.style.backgroundColor = colores[tipo] || 'var(--color-primary)';
    
    const iconos = {
        'success': 'check-circle',
        'warning': 'alert-triangle',
        'danger': 'alert-circle',
        'info': 'info'
    };
    
    toast.innerHTML = `<i data-lucide="${iconos[tipo] || 'info'}" style="width:18px; height:18px;"></i> ${mensaje}`;
    
    document.body.appendChild(toast);
    lucide.createIcons();

    // Animación CSS temporal para el slideIn del toast
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes slideInToast {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

/* ==============================================================================
   FORMATEADORES Y UTILITARIOS MATEMÁTICOS
   ============================================================================== */
function formatCurrency(monto, moneda = 'PEN') {
    const val = floatVal(monto);
    if (moneda === 'PEN') {
        return `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
        return `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

function floatVal(val) {
    if (val === null || val === undefined || isNaN(val)) return 0.0;
    return parseFloat(val);
}

function formatFecha(fechaStr) {
    if (!fechaStr) return '';
    const date = new Date(fechaStr);
    if (isNaN(date.getTime())) return fechaStr; // Retorna original si falla
    return date.toLocaleString('es-PE', { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit' 
    });
}

function inicializarSidebarColapsable() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    
    // Leer estado guardado
    const isCollapsed = localStorage.getItem('erp_sidebar_collapsed') === 'true';
    if (isCollapsed && sidebar && mainContent) {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('sidebar-collapsed');
    }

    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            if (sidebar && mainContent) {
                const nowCollapsed = sidebar.classList.toggle('collapsed');
                mainContent.classList.toggle('sidebar-collapsed', nowCollapsed);
                localStorage.setItem('erp_sidebar_collapsed', nowCollapsed);
            }
        });
    }
}

// Convertir una URL de imagen a Base64 de forma asíncrona para evitar problemas de CORS/carga en html2canvas
async function imageToBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.error("Error converting image to Base64:", e);
        return null;
    }
}
