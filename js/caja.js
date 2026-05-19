document.addEventListener('DOMContentLoaded', () => {
    const contenedor = document.getElementById('caja-estado-flujo');
    if (contenedor) {
        contenedor.innerHTML = `<p style="color: #94a3b8;">Esperando inicialización del almacenamiento local...</p>`;
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
        const cajaActiva = await window.FrausDB.obtenerEstadoCaja();
        
        if (!cajaActiva) {
            renderizarFormularioApertura(contenedor);
        } else {
            renderizarPanelMonitoreo(contenedor, cajaActiva);
        }
    } catch (error) {
        console.error("Error al evaluar estado de caja:", error);
        contenedor.innerHTML = `<p style="color: #ef4444;">Error crítico al leer los datos de almacenamiento.</p>`;
    }
}

function renderizarFormularioApertura(contenedor) {
    contenedor.innerHTML = `
        <div style="margin-top: 20px;">
            <p>La caja se encuentra actualmente cerrada. Ingrese el saldo inicial para iniciar el turno.</p>
            <div style="margin-top: 15px;">
                <label style="display:block; margin-bottom:5px;">Monto Inicial de Apertura ($):</label>
                <input type="number" id="monto-apertura-input" value="0" min="0" style="width:100%; padding:10px; background:#0d0f14; border:1px solid #2e344d; color:#fff; border-radius:6px; font-size:16px;">
            </div>
            <button type="button" id="btn-ejecutar-apertura" style="margin-top:20px; width:100%; background:#10b981; color:#111827; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:16px;">Abrir Caja</button>
        </div>
    `;

    document.getElementById('btn-ejecutar-apertura').addEventListener('click', async () => {
        const monto = parseInt(document.getElementById('monto-apertura-input').value) || 0;
        if (monto < 0) {
            alert("El monto no puede ser inferior a 0.");
            return;
        }
        await window.FrausDB.abrirCaja(monto);
        await evaluarEstadoCaja();
    });
}

async function renderizarPanelMonitoreo(contenedor, cajaActiva) {
    contenedor.innerHTML = `
        <div style="margin-top: 20px;">
            <div style="background:#0d0f14; padding:15px; border-radius:8px; border:1px solid #2e344d; margin-bottom:20px;">
                <p style="margin:0; color:#94a3b8; font-size:14px;">Fecha Apertura: ${new Date(cajaActiva.fecha_apertura).toLocaleString()}</p>
                <p style="margin:5px 0 0 0; font-size:18px;">Monto Inicial: <strong>$${cajaActiva.monto_apertura}</strong></p>
            </div>

            <div style="margin-bottom:20px;">
                <button type="button" id="btn-actualizar-calculos" style="background:#3b82f6; color:#fff; padding:10px 15px; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Actualizar Cálculos</button>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <div style="background:#1e293b; padding:12px; border-radius:6px;">
                    <span style="color:#94a3b8; font-size:13px;">Efectivo Esperado</span>
                    <div id="calc-efectivo" style="font-size:20px; font-weight:bold; margin-top:5px;">$0</div>
                    <span style="font-size:11px; color:#64748b;">(Apertura + Ventas)</span>
                </div>
                <div style="background:#1e293b; padding:12px; border-radius:6px;">
                    <span style="color:#94a3b8; font-size:13px;">Ventas Electrónicas</span>
                    <div id="calc-electronico" style="font-size:20px; font-weight:bold; margin-top:5px;">$0</div>
                    <span style="font-size:11px; color:#64748b;">(Tarjetas / Transf.)</span>
                </div>
            </div>

            <hr style="border:0; border-top:1px solid #2e344d; margin:25px 0;">

            <h3>Cierre de Turno</h3>
            <div style="margin-top:15px;">
                <label style="display:block; margin-bottom:5px;">Monto Real Físico en Caja ($):</label>
                <input type="number" id="monto-cierre-input" value="0" min="0" style="width:100%; padding:10px; background:#0d0f14; border:1px solid #2e344d; color:#fff; border-radius:6px; font-size:16px;">
            </div>

            <button type="button" id="btn-ejecutar-cierre" style="margin-top:20px; width:100%; background:#ef4444; color:#fff; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:16px;">Cerrar Caja</button>
        </div>
    `;

    let totalEfectivoEsperado = cajaActiva.monto_apertura;

    const ejecutarFlujoCalculo = async () => {
        const totales = await window.FrausDB.calcularTotalesDesde(cajaActiva.fecha_apertura);
        const vEfectivo = totales.efectivo || 0;
        const vTarjeta = totales.tarjeta || 0;
        const vTransferencia = totales.transferencia || 0;

        totalEfectivoEsperado = cajaActiva.monto_apertura + vEfectivo;
        const totalElectronico = vTarjeta + vTransferencia;

        document.getElementById('calc-efectivo').innerText = `$${totalEfectivoEsperado}`;
        document.getElementById('calc-electronico').innerText = `$${totalElectronico}`;
    };

    document.getElementById('btn-actualizar-calculos').addEventListener('click', ejecutarFlujoCalculo);
    
    await ejecutarFlujoCalculo();

    document.getElementById('btn-ejecutar-cierre').addEventListener('click', async () => {
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

        await window.FrausDB.cerrarCaja(cajaActiva.id, montoReal);
        await evaluarEstadoCaja();
    });
}