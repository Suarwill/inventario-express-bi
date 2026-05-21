document.addEventListener('DOMContentLoaded', () => {
    const vistaBi = document.getElementById('sec-bi');
    if (vistaBi) {
        window.addEventListener('db-ready', () => {
            inicializarAnalisisBI();
        });
    }
});

async function inicializarAnalisisBI() {
    try {
        await Promise.all([
            calcularCapitalRetenido(),
            calcularTopMargenGanancia(),
            analizarTramosHorarios(),
            generarSugerenciasCompra(7)
        ]);
        
        configurarControlesSugerencias();
    } catch (error) {
        console.error("Error al procesar las metricas de BI:", error);
    }
}

async function calcularCapitalRetenido() {
    const elemento = document.getElementById('val-capital');
    if (!elemento) return;

    try {
        console.log("=== INICIANDO DEBUG DE CAPITAL RETENIDO ===");
        
        const productosBase = await obtenerDatosDeAlmacen('productos');
        const historialMovimientos = await obtenerDatosDeAlmacen('historial_inventario') || [];
        const historialVentas = await obtenerDatosDeAlmacen('ventas') || [];

        console.log(`Datos cargados desde IndexedDB:
        - Productos base: ${productosBase.length}
        - Movimientos historial: ${historialMovimientos.length}
        - Ventas totales: ${historialVentas.length}`);

        let capitalTotal = 0;

        productosBase.forEach(prod => {
            const sku = prod.codigo;
            
            const ingresosSku = historialMovimientos
                .filter(m => m.sku === sku && (m.tipo_movimiento === 'BOLETA' || m.tipo_movimiento === 'FACTURA' || m.tipo_movimiento === 'ENTRADA'))
                .reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

            const egresosMovimientosSku = historialMovimientos
                .filter(m => m.sku === sku && (m.tipo_movimiento === 'MERMA' || m.tipo_movimiento === 'RETIRO'))
                .reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

            let egresosVentasSku = 0;
            historialVentas.forEach(v => {
                const listaArticulos = v.productos || v.items || [];
                if (Array.isArray(listaArticulos)) {
                    listaArticulos.forEach(p => {
                        if (p.sku === sku || p.codigo === sku) {
                            egresosVentasSku += (p.cantidad || 0);
                        }
                    });
                }
            });

            const stockNetoReal = ingresosSku - (egresosMovimientosSku + egresosVentasSku);

            const comprasProducto = historialMovimientos
                .filter(m => m.sku === sku && m.tipo_movimiento === 'COMPRA')
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            const ultimoCostoCompra = comprasProducto.length > 0 
                ? (parseInt(comprasProducto[0].precio_costo_unitario) || parseInt(comprasProducto[0].precio_costo) || 0)
                : (parseInt(prod.precio_costo) || 0);

            console.log(`[SKU: ${sku}] (${prod.descripcion || 'Sin desc'}) -> 
            Ingresos (Historial): ${ingresosSku}
            Egresos Administrativos (Historial): ${egresosMovimientosSku}
            Egresos Comerciales (Ventas): ${egresosVentasSku}
            Stock Neto Calculado: ${stockNetoReal}
            Costo Unitario Usado: $${ultimoCostoCompra}`);

            if (stockNetoReal > 0) {
                const subtotalProducto = stockNetoReal * ultimoCostoCompra;
                capitalTotal += subtotalProducto;
                console.log(`   -> CIFRA POSITIVA: Sumando $${subtotalProducto} al capital total.`);
            } else {
                console.log(`   -> OMITIDO: El stock es 0 o negativo.`);
            }
        });

        console.log(`=== FIN DEBUG: Capital Total Resultante = $${capitalTotal} ===`);
        elemento.innerText = `$${capitalTotal.toLocaleString('es-CL')}`;

    } catch (error) {
        console.error("Error al calcular el capital retenido:", error);
        elemento.innerText = "$0";
    }
}

async function calcularTopMargenGanancia() {
    const lista = document.getElementById('lista-top-margen');
    if (!lista) return;

    const ventas = await obtenerDatosDeAlmacen('ventas');
    const productos = await obtenerDatosDeAlmacen('productos');
    const margenPorProducto = {};

    ventas.forEach(v => {
        if (!v.items) return;
        v.items.forEach(item => {
            const prodInfo = productos.find(p => p.codigo === item.sku);
            const costoUnitario = prodInfo ? (parseInt(prodInfo.precio_costo) || 0) : 0;
            const precioVentaUnitario = parseInt(item.precio) || 0;
            const cantidadVendida = parseInt(item.cantidad) || 0;

            const gananciaUnitaria = precioVentaUnitario - costoUnitario;
            const gananciaTotalLinea = gananciaUnitaria * cantidadVendida;

            if (!margenPorProducto[item.sku]) {
                margenPorProducto[item.sku] = {
                    descripcion: item.descripcion || item.sku,
                    ganancia: 0
                };
            }
            margenPorProducto[item.sku].ganancia += gananciaTotalLinea;
        });
    });

    const ranking = Object.values(margenPorProducto)
        .sort((a, b) => b.ganancia - a.ganancia)
        .slice(0, 5);

    lista.innerHTML = ranking.map(r => `
        <li>
            <span>${r.descripcion}</span>
            <strong>$${r.ganancia.toLocaleString('es-CL')}</strong>
        </li>
    `).join('');

    if (ranking.length === 0) {
        lista.innerHTML = `<li><span style="color:var(--texto-secundario);">Sin registros de ventas aún</span></li>`;
    }
}

async function analizarTramosHorarios() {
    const contenedor = document.getElementById('chart-horarios-simulado');
    if (!contenedor) return;

    const ventas = await obtenerDatosDeAlmacen('ventas');
    const conteoTramos = {
        'Mañana (06:00 - 11:00)': 0,
        'Mediodía (11:00 - 14:00)': 0,
        'Tarde (14:00 - 18:00)': 0,
        'Nocturno (18:00 - 22:00)': 0
    };

    ventas.forEach(v => {
        if (!v.fecha) return;
        const hora = new Date(v.fecha).getHours();

        if (hora >= 7 && hora < 11) conteoTramos['Mañana (07:00 - 11:00)']++;
        else if (hora >= 11 && hora < 14) conteoTramos['Mediodía (11:00 - 14:00)']++;
        else if (hora >= 14 && hora < 18) conteoTramos['Tarde (14:00 - 18:00)']++;
        else conteoTramos['Nocturno (18:00 - 22:00)']++;
    });

    const maxVentas = Math.max(...Object.values(conteoTramos), 1);

    contenedor.innerHTML = Object.entries(conteoTramos).map(([tramo, cantidad]) => {
        const porcentaje = (cantidad / maxVentas) * 100;
        return `
            <div style="margin-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; color:var(--texto-secundario);">
                    <span>${tramo}</span>
                    <strong>${cantidad} vtas</strong>
                </div>
                <div style="background:var(--bg-principal); height:12px; border-radius:6px; overflow:hidden; border:1px solid var(--borde);">
                    <div style="background:var(--accent); width:${porcentaje}%; height:100%; transition:width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
}

async function generarSugerenciasCompra(diasAnalisis) {
    const lista = document.getElementById('lista-sugerencias');
    if (!lista) return;

    const [ventas, productos, historial] = await Promise.all([
        obtenerDatosDeAlmacen('ventas'),
        obtenerDatosDeAlmacen('productos'),
        obtenerDatosDeAlmacen('historial_inventario')
    ]);

    const ahora = new Date();
    const fechaLimite = new Date(ahora.getTime() - (diasAnalisis * 24 * 60 * 60 * 1000));
    
    const ventasRecientes = ventas.filter(v => new Date(v.fecha) >= fechaLimite);
    const demandas = {};

    ventasRecientes.forEach(v => {
        if (!v.items) return;
        v.items.forEach(item => {
            demandas[item.sku] = (demandas[item.sku] || 0) + (parseInt(item.cantidad) || 0);
        });
    });

    const sugerencias = [];

    productos.forEach(prod => {
        const movimientos = historial.filter(h => h.sku === prod.codigo);
        let stockNeto = 0;

        movimientos.forEach(m => {
            const cant = parseInt(m.cantidad) || 0;
            if (['BOLETA', 'FACTURA', 'ENTRADA'].includes(m.tipo_movimiento)) {
                stockNeto += cant;
            } else if (['VENTA', 'MERMA', 'RETIRO'].includes(m.tipo_movimiento)) {
                stockNeto -= cant;
            }
        });

        const unidadesVendidas = demandas[prod.codigo] || 0;
        const promedioDiarioVenta = unidadesVendidas / diasAnalisis;
        const stockSeguridadEstimado = Math.ceil(promedioDiarioVenta * 3);

        if (stockNeto <= stockSeguridadEstimado && promedioDiarioVenta > 0) {
            const cantidadSugerida = Math.ceil((promedioDiarioVenta * diasAnalisis) * 1.5) - stockNeto;
            if (cantidadSugerida > 0) {
                sugerencias.push({
                    descripcion: prod.descripcion,
                    stockActual: stockNeto,
                    sugerido: cantidadSugerida
                });
            }
        }
    });

    sugerencias.sort((a, b) => b.sugerido - a.sugerido);

    lista.innerHTML = sugerencias.slice(0, 5).map(s => `
        <li>
            <span>${s.descripcion} <small style="color:var(--texto-oscuro); display:block;">Stock actual: ${s.stockActual} un.</small></span>
            <strong style="color:var(--exito);">Pedir +${s.sugerido} un.</strong>
        </li>
    `).join('');

    if (sugerencias.length === 0) {
        lista.innerHTML = `<li><span style="color:var(--texto-secundario);">Abastecimiento óptimo. No se requieren pedidos urgentes.</span></li>`;
    }
}

function configurarControlesSugerencias() {
    const btnSemana = document.getElementById('sug-semana');
    const btnMes = document.getElementById('sug-mes');

    if (btnSemana && btnMes) {
        btnSemana.addEventListener('click', () => {
            btnSemana.style.background = 'var(--accent)';
            btnSemana.style.color = 'var(--bg-campos)';
            btnMes.style.background = 'var(--bg-interacciones)';
            btnMes.style.color = 'var(--texto-secundario)';
            generarSugerenciasCompra(7);
        });

        btnMes.addEventListener('click', () => {
            btnMes.style.background = 'var(--accent)';
            btnMes.style.color = 'var(--bg-campos)';
            btnSemana.style.background = 'var(--bg-interacciones)';
            btnSemana.style.color = 'var(--texto-secundario)';
            generarSugerenciasCompra(30);
        });
    }
}

function obtenerDatosDeAlmacen(nombreAlmacen) {
    return new Promise((resolve) => {
        if (!window.indexedDB) return resolve([]);
        
        const request = indexedDB.open('FrausTechPOS');
        request.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(nombreAlmacen)) {
                resolve([]);
                return;
            }
            const tx = db.transaction([nombreAlmacen], 'readonly');
            const store = tx.objectStore(nombreAlmacen);
            const reqAll = store.getAll();

            reqAll.onsuccess = () => resolve(reqAll.result || []);
            reqAll.onerror = () => resolve([]);
        };
        request.onerror = () => resolve([]);
    });
}