/* ==============================================================================
   MÓDULO DE EXPORTACIÓN DE REPORTES (EXCEL Y PDF)
   ============================================================================== */

/**
 * Exporta el historial completo de ventas a un archivo Excel (.xlsx)
 */
async function exportarVentasExcel() {
    try {
        const res = await fetch(`${API_URL}/api/ventas`);
        const ventas = await res.json();

        if (ventas.length === 0) {
            mostrarToast("No hay registros de ventas para exportar.", "warning");
            return;
        }

        const dataExport = ventas.map(v => ({
            "ID Venta": v.id,
            "Cliente": v.cliente_nombre,
            "Comprobante": `${v.tipo_comprobante} ${v.serie_comprobante}-${v.correlativo_comprobante}`,
            "Fecha Emisión": formatFecha(v.fecha_venta),
            "Moneda": v.moneda,
            "Tipo Cambio": v.tipo_cambio,
            "Método Pago": v.metodo_pago,
            "Fecha Venc.": v.fecha_vencimiento || "N/A",
            "Subtotal Neto": v.subtotal,
            "IGV (18%)": v.igv,
            "Total Facturado": v.total,
            "Estado": v.estado
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataExport);

        // Ajustar columnas
        ws['!cols'] = [10, 24, 24, 20, 10, 12, 14, 12, 14, 14, 14, 12].map(w => ({ wch: w }));

        XLSX.utils.book_append_sheet(wb, ws, "Historial de Ventas");
        XLSX.writeFile(wb, `Reporte_Ventas_${new Date().toISOString().slice(0,10)}.xlsx`);

        mostrarToast("Historial de ventas exportado a Excel con éxito.", "success");
    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo exportar el historial de ventas.", "danger");
    }
}

/**
 * Exporta el historial de compras (abastecimientos) a Excel
 */
async function exportarComprasExcel() {
    try {
        const res = await fetch(`${API_URL}/api/compras`);
        const compras = await res.json();

        if (compras.length === 0) {
            mostrarToast("No hay registros de compras para exportar.", "warning");
            return;
        }

        const dataExport = compras.map(c => ({
            "ID Compra": c.id,
            "Proveedor": c.proveedor_nombre,
            "Comprobante": `${c.tipo_comprobante} ${c.serie_comprobante}-${c.correlativo_comprobante}`,
            "Fecha Compra": formatFecha(c.fecha_compra),
            "Moneda": c.moneda,
            "Tipo Cambio": c.tipo_cambio,
            "Método Pago": c.metodo_pago,
            "Fecha Venc.": c.fecha_vencimiento || "N/A",
            "Subtotal Neto": c.subtotal,
            "IGV (18%)": c.igv,
            "Total Invertido": c.total,
            "Estado": c.estado
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataExport);

        ws['!cols'] = [10, 24, 24, 20, 10, 12, 14, 12, 14, 14, 14, 12].map(w => ({ wch: w }));

        XLSX.utils.book_append_sheet(wb, ws, "Historial de Compras");
        XLSX.writeFile(wb, `Reporte_Compras_${new Date().toISOString().slice(0,10)}.xlsx`);

        mostrarToast("Historial de compras exportado a Excel con éxito.", "success");
    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo exportar el historial de compras.", "danger");
    }
}

/**
 * Genera un reporte PDF con diseño premium de las utilidades y balance consolidado del ERP
 */
async function exportarPDFUtilidades() {
    try {
        const resConfig = await fetch(`${API_URL}/api/config`);
        const config = await resConfig.json();

        const resStats = await fetch(`${API_URL}/api/dashboard/stats`);
        const stats = await resStats.json();

        // Convertir el logo a Base64 para evitar problemas de CORS y bloqueos de html2canvas
        let logoBase64 = null;
        if (config.logo_path) {
            logoBase64 = await imageToBase64(`${API_URL}${config.logo_path}`);
        }

        // Crear plantilla HTML en memoria
        const printContainer = document.createElement('div');
        printContainer.style.padding = '32px';
        printContainer.style.backgroundColor = 'white';
        printContainer.style.color = '#1f2937';
        printContainer.style.fontFamily = "'Inter', sans-serif";
        printContainer.style.fontSize = '12px';
        printContainer.style.lineHeight = '1.6';

        const totalUtilidadesPEN = stats.utilidades.PEN;
        const totalUtilidadesUSD = stats.utilidades.USD;

        printContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #6366f1; padding-bottom:16px; margin-bottom:24px;">
                <div style="display:flex; align-items:center; gap:16px;">
                    ${logoBase64 ? `<img src="${logoBase64}" style="height:50px; width:50px; object-fit:contain; border-radius:4px;" alt="Logo" />` : ''}
                    <div>
                        <h1 style="font-size:22px; font-weight:800; color:#4f46e5; margin:0 0 4px;">${config.empresa_nombre}</h1>
                        <p style="margin:0; color:#6b7280; font-size:10px;">RUC: ${config.empresa_ruc} | Dirección: ${config.empresa_direccion || ''}</p>
                    </div>
                </div>
                <div style="text-align:right;">
                    <h2 style="font-size:14px; color:#4f46e5; font-weight:800; margin:0;">REPORTE DE UTILIDADES</h2>
                    <p style="font-size:10px; margin:2px 0 0; color:#9ca3af;">Generado el: ${new Date().toLocaleString()}</p>
                </div>
            </div>

            <p style="margin-bottom:20px; font-size:12px; color:#4b5563;">
                Este informe financiero consolida las ganancias brutas y netas obtenidas por la empresa mediante la evaluación del costo base (precio de compra/mayorista) versus el precio final cobrado en cada transacción POS realizada en la plataforma local.
            </p>

            <div style="display:flex; gap:20px; margin-bottom:32px;">
                <!-- Balance Soles -->
                <div style="flex:1; border:1px solid #e5e7eb; padding:16px; border-radius:8px; background-color:#faf5ff;">
                    <h3 style="font-size:12px; color:#4f46e5; text-transform:uppercase; margin:0 0 12px; font-weight:700; border-bottom:1px solid #ddd; padding-bottom:6px;">Balance en Soles (PEN)</h3>
                    <div style="display:flex; justify-content:between; padding:4px 0;">
                        <span>Ventas de Hoy:</span>
                        <strong style="color:#10b981;">S/ ${stats.ventas_hoy.PEN.toFixed(2)}</strong>
                    </div>
                    <div style="display:flex; justify-content:between; padding:4px 0;">
                        <span>Compras de Hoy:</span>
                        <strong style="color:#f59e0b;">S/ ${stats.compras_hoy.PEN.toFixed(2)}</strong>
                    </div>
                    <div style="display:flex; justify-content:between; padding:8px 0; border-top:1px dashed #ddd; margin-top:8px; font-size:14px;">
                        <strong>Utilidad Neta Acumulada:</strong>
                        <strong style="color:#4f46e5;">S/ ${totalUtilidadesPEN.toFixed(2)}</strong>
                    </div>
                </div>

                <!-- Balance Dólares -->
                <div style="flex:1; border:1px solid #e5e7eb; padding:16px; border-radius:8px; background-color:#ecfeff;">
                    <h3 style="font-size:12px; color:#0891b2; text-transform:uppercase; margin:0 0 12px; font-weight:700; border-bottom:1px solid #ddd; padding-bottom:6px;">Balance en Dólares (USD)</h3>
                    <div style="display:flex; justify-content:between; padding:4px 0;">
                        <span>Ventas de Hoy:</span>
                        <strong style="color:#10b981;">$ ${stats.ventas_hoy.USD.toFixed(2)}</strong>
                    </div>
                    <div style="display:flex; justify-content:between; padding:4px 0;">
                        <span>Compras de Hoy:</span>
                        <strong style="color:#f59e0b;">$ ${stats.compras_hoy.USD.toFixed(2)}</strong>
                    </div>
                    <div style="display:flex; justify-content:between; padding:8px 0; border-top:1px dashed #ddd; margin-top:8px; font-size:14px;">
                        <strong>Utilidad Neta Acumulada:</strong>
                        <strong style="color:#0891b2;">$ ${totalUtilidadesUSD.toFixed(2)}</strong>
                    </div>
                </div>
            </div>

            <div style="background-color:#f9fafb; border:1px solid #e5e7eb; padding:16px; border-radius:6px; margin-bottom:32px;">
                <h4 style="margin:0 0 8px; font-size:12px; font-weight:700;">Parámetros de Cálculo:</h4>
                <ul style="margin:0; padding-left:20px; font-size:11px; color:#4b5563;">
                    <li>La utilidad neta calcula las ventas realizadas en estado "Completada" excluyendo los comprobantes anulados.</li>
                    <li>Para las ventas en dólares, se realiza la conversión del precio costo base (en soles) utilizando la tasa de tipo de cambio registrada y congelada en el momento de la venta.</li>
                    <li>El stock actual de productos en alerta (bajo mínimo) no se valora en la utilidad puesto que no representa ingresos realizados sino activos fijos en almacén.</li>
                </ul>
            </div>

            <div style="margin-top:60px; text-align:center; color:#9ca3af; font-size:10px; border-top:1px solid #e5e7eb; padding-top:20px;">
                <p style="margin:0;">Reporte contable interno confidencial. Generado localmente mediante el motor ERP/POS.</p>
            </div>
        `;

        const opt = {
            margin:       10,
            filename:     `Reporte_Financiero_Utilidades_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
                scale: 2, 
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 800,
                onclone: (clonedDoc) => {
                    const sidebar = clonedDoc.querySelector('.sidebar');
                    if (sidebar) sidebar.style.setProperty('display', 'none', 'important');
                    const topHeader = clonedDoc.querySelector('.top-header');
                    if (topHeader) topHeader.style.setProperty('display', 'none', 'important');
                    clonedDoc.querySelectorAll('.modal, .modal-backdrop, .modal-container, .toast').forEach(el => {
                        el.style.setProperty('display', 'none', 'important');
                    });
                }
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Crear contenedor wrapper con position: absolute para evitar problemas de posicionamiento y clipping en html2canvas
        const wrapper = document.createElement('div');
        wrapper.id = 'print-wrapper-reportes';
        wrapper.style.position = 'absolute';
        wrapper.style.left = '0';
        wrapper.style.top = '0';
        wrapper.style.width = '800px';
        wrapper.style.height = 'auto';
        wrapper.style.overflow = 'hidden';
        wrapper.style.zIndex = '-9999';
        wrapper.style.pointerEvents = 'none';

        printContainer.style.width = '800px';
        
        wrapper.appendChild(printContainer);
        document.body.appendChild(wrapper);

        // Generar descarga PDF de forma asíncrona
        await html2pdf().set(opt).from(printContainer).save();
        
        document.body.removeChild(wrapper);
        mostrarToast("Reporte de utilidades PDF descargado con éxito.", "success");

    } catch (err) {
        console.error(err);
        mostrarToast("No se pudo generar el reporte consolidado de utilidades.", "danger");
    }
}
