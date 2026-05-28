# Sistema Local de Gestión de Inventarios y Ventas (ERP / POS)

Este es un sistema web local completamente modular, escalable y 100% editable diseñado para la gestión transaccional de compras, inventario por números de serie y punto de venta (POS) interactivo.

---

## 1. Arquitectura Tecnológica (Cero Fricción)

Para garantizar un despliegue local inmediato sin dependencias complejas (como Node.js, PHP o servidores Docker externos), el sistema está construido bajo el siguiente stack portátil:

*   **Backend:** Python con **Flask** (servidor API REST ligero).
*   **Base de Datos:** **SQLite** (Base de datos relacional autocontenida en un archivo físico en `database/db.sqlite`, automatizada con triggers e índices).
*   **Frontend:** **Single Page Application (SPA)** de alto rendimiento estructurada en HTML5, **Vanilla CSS** con diseño Premium (Modo Oscuro, efectos translúcidos glassmorphism y micro-animaciones) y **JavaScript Moderno (ES6+)**.
*   **Reportes:** Exportaciones dinámicas de Excel en el cliente con **SheetJS** y renderizado de facturas/reportes contables en PDF con **html2pdf.js**.

---

## 2. Requisitos Previos

*   **Sistema Operativo:** macOS (Mac)
*   **Python:** Versión 3.9 o superior instalada (Viene por defecto en macOS).
*   **Permisos de Ejecución:** Consola de comandos activa (Zsh / Bash).

---

## 3. Instrucciones de Inicio Rápido

Para instalar dependencias, inicializar la base de datos con datos semilla y levantar el servidor POS de manera automatizada:

1.  Abre la terminal de tu Mac en el directorio raíz del proyecto.
2.  Otorga permisos de ejecución al script de arranque rápido:
    ```bash
    chmod +x run.sh
    ```
3.  Ejecuta el script:
    ```bash
    ./run.sh
    ```

El script creará un entorno virtual de Python (`venv`), instalará Flask, inicializará el archivo de base de datos relacional y abrirá automáticamente tu navegador web por defecto en la dirección:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 4. Credenciales de Acceso Semilla

El sistema se inicializa con tres cuentas de colaboradores correspondientes a distintos roles y privilegios de negocio:

| Colaborador | Usuario | Contraseña | Rol / Privilegios |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` | Control total, configurar tipo de cambio, crear usuarios y alterar precios manuales. |
| **Vendedor** | `vendedor` | `vendedor123` | Acceso al POS, clientes y cobro de abonos al crédito. |
| **Almacenero** | `almacen` | `almacen123` | Registro de compras de mercadería e inventario de productos. |

---

## 5. Reglas de Negocio Implementadas

### A. Trazabilidad Estricta de Series Físicas
*   **Compras (Abastecimiento):** Al comprar un ítem que tiene activado el parámetro `maneja_series = TRUE`, el sistema exige capturar o escanear un código de serie único por cada unidad ingresada. Las series se registran con estado `'Disponible'`.
*   **Punto de Venta (POS):** Al agregar el producto al carrito de compras, el POS obligará al vendedor a abrir un selector visual de números de serie para vincular las unidades físicas exactas que se están entregando. Al procesar la venta, las series pasan a estado `'Vendido'` (o `'En Garantía'` si se otorgan meses de garantía en la venta).
*   **Anulación Transaccional:** Si se anula una venta, un trigger a nivel de base de datos libera automáticamente los números de serie devolviéndolos a estado `'Disponible'`. Si se anula una compra, se reduce el stock y se eliminan las series correspondientes si no han sido previamente vendidas.

### B. Multimoneda y Tipo de Cambio Fijo (TC)
*   Los precios en el catálogo de productos se almacenan de manera predeterminada en Soles (PEN).
*   El POS y Compras permiten transaccionar en Soles (PEN) y Dólares (USD). Al seleccionar USD, el sistema aplica la tasa de tipo de cambio ingresada por el administrador para el día y congela el tipo de cambio exacto de la transacción en la cabecera de la venta o compra para registros y reportes contables estables.

### C. Flexibilidad de Precios en el POS
Al facturar, se puede elegir de forma fluida el tipo de precio por ítem:
1.  **Público:** Precio final de venta configurado.
2.  **Mayorista:** Precio base/costo de almacén.
3.  **Manual:** Permite digitar un precio de venta personalizado de forma libre (Acción protegida, requiere credenciales de rol **Administrador**).

### D. Métodos de Pago y Cuentas por Cobrar/Pagar
*   Tanto ventas como compras admiten pago al **Contado** o al **Crédito** (con fecha de vencimiento obligatoria).
*   Las ventas al crédito generan automáticamente un registro en la tabla `cuentas_por_cobrar` y las compras en `cuentas_por_pagar`. Los abonos en efectivo amortizan la deuda y recalculan el saldo pendiente en tiempo real.