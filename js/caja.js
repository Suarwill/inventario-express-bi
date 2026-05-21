document.addEventListener('DOMContentLoaded', () => {
    const contenedor = document.getElementById('caja-estado-flujo');
    if (contenedor) {
        contenedor.innerHTML = `<p style="color: var(--texto-secundario);">Esperando inicialización del almacenamiento local...</p>`;
    }
});

window.addEventListener('db-ready', () => {
    if (document.getElementById('caja-estado-flujo')) {
        evaluarEstadoCaja();
    }
});

async function evaluarEstadoCaja() {
    const contenedor = document.getElementById('caja-estado-flujo');
    try {
        const [cajaActiva, respuestaHtml] = await Promise.all([
            window.FrausDB.obtenerEstadoCaja(),
            fetch('html/caja.html')
        ]);

        if (!respuestaHtml.ok) {
            throw new Error("No se pudo cargar el archivo de componentes HTML de la caja.");
        }

        const textoHtml = await respuestaHtml.text();
        const parser = new DOMParser();
        const docPlantillas = parser.parseFromString(textoHtml, 'text/html');

        if (!cajaActiva) {
            renderizarFormularioApertura(contenedor, docPlantillas);
        } else {
            renderizarPanelMonitoreo(contenedor, cajaActiva, docPlantillas);
        }
    } catch (error) {
        console.error("Error al evaluar estado de caja:", error);
        contenedor.innerHTML = `<p style="color: var(--alerta);">Error crítico al leer los datos de almacenamiento o componentes estructurales.</p>`;
    }
}

function renderizarFormularioApertura(contenedor, docPlantillas) {
    const template = docPlantillas.getElementById('template-apertura');
    if (!template) {
        contenedor.innerHTML = `<p style="color: var(--alerta);">Error: Plantilla de apertura no encontrada.</p>`;
        return;
    }

    contenedor.innerHTML = '';
    contenedor.appendChild(template.content.cloneNode(true));

    const btnApertura = document.getElementById('btn-ejecutar-apertura');
    if (btnApertura) {
        btnApertura.addEventListener('click', async () => {
            const montoApertura = parseInt(document.getElementById('monto-apertura-input').value) || 0;
            if (montoApertura < 0) {
                alert("El monto de apertura no puede ser negativo.");
                return;
            }

            const exito = await window.FrausDB.abrirCaja({
                fecha_apertura: new Date().toISOString(),
                monto_apertura: montoApertura,
                estado: 'ABIERTO'
            });

            if (exito) {
                alert("Turno de caja iniciado exitosamente.");
                evaluarEstadoCaja();
            } else {
                alert("No se pudo registrar la apertura de caja en IndexedDB.");
            }
        });
    }
}

async function renderizarPanelMonitoreo(contenedor, cajaActiva, docPlantillas) {
    const template = docPlantillas.getElementById('template-monitoreo');
    if (!template) {
        contenedor.innerHTML = `<p style="color: var(--alerta);">Error: Plantilla de monitoreo no encontrada.</p>`;
        return;
    }

    contenedor.innerHTML = '';
    contenedor.appendChild(template.content.cloneNode(true));

    let totalEfectivoEsperado = 0;

    const ejecutarFlujoCalculo = async () => {
        if (!window.FrausDB) return;
        
        const totales = await window.FrausDB.obtenerTotalesVentasTurnoActual() || {};

        const vEfectivo = totales.efectivo || 0;
        const vTarjeta = totales.tarjeta || 0;
        const vTransferencia = totales.transferencia || 0;

        totalEfectivoEsperado = cajaActiva.monto_apertura + vEfectivo;
        const totalElectronico = vTarjeta + vTransferencia;

        const elementoEfectivo = document.getElementById('calc-efectivo');
        const elementoElectronico = document.getElementById('calc-electronico');

        if (elementoEfectivo) elementoEfectivo.innerText = `$${totalEfectivoEsperado}`;
        if (elementoElectronico) elementoElectronico.innerText = `$${totalElectronico}`;
    };

    const btnActualizar = document.getElementById('btn-actualizar-calculos');
    if (btnActualizar) {
        btnActualizar.addEventListener('click', ejecutarFlujoCalculo);
    }
    
    const btnCierre = document.getElementById('btn-ejecutar-cierre');
    if (btnCierre) {
        btnCierre.addEventListener('click', async () => {
            const montoReal = parseInt(document.getElementById('monto-cierre-input').value) || 0;
            if (montoReal < 0) {
                alert("El monto de cierre no puede ser inferior a 0.");
                return;
            }

            const diferencia = montoReal - totalEfectivoEsperado;
            
            if (diferencia === 0) {
                alert("Caja cuadrada con éxito. No se detectaron diferencias estadísticas.");
            } else if (diferencia < 0) {
                alert(`Cierre procesado. Advertencia: Se detectó un faltante de dinero de $${Math.abs(diferencia)} pesos.`);
            } else {
                alert(`Cierre procesado. Advertencia: Se detectó un excedente de dinero de $${diferencia} pesos.`);
            }

            await window.FrausDB.cerrarCaja({
                fecha_cierre: new Date().toISOString(),
                monto_cierre_real: montoReal,
                monto_esperado: totalEfectivoEsperado,
                diferencia: diferencia,
                estado: 'CERRADO'
            });

            evaluarEstadoCaja();
        });
    }

    await ejecutarFlujoCalculo();
}