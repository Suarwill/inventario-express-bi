export function generarCSVVentas() {
    const DB_NAME = 'FrausTechPOS';
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = (e) => {
        const db = e.target.result;
        
        if (!db.objectStoreNames.contains('ventas')) {
            alert("El almacén de ventas aún no ha sido creado.");
            return;
        }

        const transaccion = db.transaction(['ventas'], 'readonly');
        const almacen = transaccion.objectStore('ventas');
        const peticionGetAll = almacen.getAll();

        peticionGetAll.onsuccess = (evt) => {
            const registros = evt.target.result;
            if (registros.length === 0) {
                alert("No existen registros de ventas para exportar.");
                return;
            }

            const cabeceras = [
                'ID Venta', 
                'Fecha Pasada', 
                'Metodo Pago', 
                'SKU Producto', 
                'Descripcion', 
                'Cantidad', 
                'Precio Unitario', 
                'Subtotal Linea',
                'Total Boleta'
            ];
            
            const filas = [];

            registros.forEach(venta => {
                const idVenta = venta.id || "";
                const fecha = venta.fecha || "";
                const metodo = venta.metodo_pago || "";
                const totalBoleta = venta.total || 0;

                const listaArticulos = venta.items || venta.productos || [];

                if (Array.isArray(listaArticulos) && listaArticulos.length > 0) {
                    listaArticulos.forEach(item => {
                        const sku = item.sku || item.codigo || "N/A";
                        let descripcion = item.descripcion || "Sin descripción";
                        const cantidad = parseInt(item.cantidad) || 0;
                        const precio = parseInt(item.precio) || parseInt(item.precio_venta) || 0;
                        const subtotal = cantidad * precio;

                        if (descripcion.includes(',') || descripcion.includes('\n') || descripcion.includes('"')) {
                            descripcion = `"${descripcion.replace(/"/g, '""')}"`;
                        }

                        filas.push([
                            idVenta,
                            fecha,
                            metodo,
                            sku,
                            descripcion,
                            cantidad,
                            precio,
                            subtotal,
                            totalBoleta
                        ].join(','));
                    });
                } else {
                    filas.push([
                        idVenta,
                        fecha,
                        metodo,
                        "N/A",
                        "Venta sin articulos desglosados",
                        0,
                        0,
                        0,
                        totalBoleta
                    ].join(','));
                }
            });

            const contenidoCSV = [cabeceras.join(','), ...filas].join('\n');
            descargarPlantillaCSV(contenidoCSV, 'reporte_ventas_detallado');
        };

        peticionGetAll.onerror = (evt) => {
            console.error("Error al extraer el historial de ventas:", evt.target.error);
        };
    };

    request.onerror = (e) => {
        console.error("Error al conectar con IndexedDB para reporte de ventas:", e.target.error);
    };
}

export function generarCSVInventario() {
    const DB_NAME = 'FrausTechPOS';
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = (e) => {
        const db = e.target.result;
        
        if (!db.objectStoreNames.contains('productos') || !db.objectStoreNames.contains('historial_inventario') || !db.objectStoreNames.contains('ventas')) {
            alert("Los almacenes necesarios para calcular existencias no están completos.");
            return;
        }

        const transaccion = db.transaction(['productos', 'historial_inventario', 'ventas'], 'readonly');
        const storeProductos = transaccion.objectStore('productos');
        const storeHistorial = transaccion.objectStore('historial_inventario');
        const storeVentas = transaccion.objectStore('ventas');

        const reqProd = storeProductos.getAll();
        const reqHist = storeHistorial.getAll();
        const reqVent = storeVentas.getAll();

        let productosBase = [];
        let historialMovimientos = [];
        let historialVentas = [];

        reqProd.onsuccess = () => { productosBase = reqProd.result || []; };
        reqHist.onsuccess = () => { historialMovimientos = reqHist.result || []; };
        reqVent.onsuccess = () => { historialVentas = reqVent.result || []; };

        transaccion.oncomplete = () => {
            if (productosBase.length === 0) {
                alert("El catálogo de inventario está vacío. No hay productos para exportar.");
                return;
            }

            const cabeceras = ['codigo', 'descripcion', 'precio_costo', 'precio_venta', 'stock', 'categoria'];
            
            const filas = productosBase.map(prod => {
                const sku = prod.codigo;

                const ingresosSku = historialMovimientos
                    .filter(m => m.sku === sku && (m.tipo_movimiento === 'BOLETA' || m.tipo_movimiento === 'FACTURA' || m.tipo_movimiento === 'ENTRADA'))
                    .reduce((acc, curr) => acc + (parseInt(curr.cantidad) || 0), 0);

                const egresosMovimientosSku = historialMovimientos
                    .filter(m => m.sku === sku && (m.tipo_movimiento === 'MERMA' || m.tipo_movimiento === 'RETIRO'))
                    .reduce((acc, curr) => acc + (parseInt(curr.cantidad) || 0), 0);

                let egresosVentasSku = 0;
                historialVentas.forEach(v => {
                    const listaArticulos = v.productos || v.items || [];
                    if (Array.isArray(listaArticulos)) {
                        listaArticulos.forEach(p => {
                            if (p.sku === sku || p.codigo === sku) {
                                egresosVentasSku += (parseInt(p.cantidad) || 0);
                            }
                        });
                    }
                });

                const stockNetoCalculado = ingresosSku - (egresosMovimientosSku + egresosVentasSku);

                return cabeceras.map(campo => {
                    if (campo === 'stock') {
                        return stockNetoCalculado;
                    }
                    
                    let valor = prod[campo] === undefined || prod[campo] === null ? "" : prod[campo];
                    if (typeof valor === 'string' && (valor.includes(',') || valor.includes('\n') || valor.includes('"'))) {
                        valor = `"${valor.replace(/"/g, '""')}"`;
                    }
                    return valor;
                }).join(',');
            });

            const contenidoCSV = [cabeceras.join(','), ...filas].join('\n');
            descargarPlantillaCSV(contenidoCSV, 'maestro_inventario_calculado');
        };

        transaccion.onerror = (evt) => {
            console.error("Error al extraer registros cruzados para inventario:", evt.target.error);
        };
    };

    request.onerror = (e) => {
        console.error("Error al conectar con IndexedDB para reporte de inventario:", e.target.error);
    };
}

function descargarPlantillaCSV(textoCSV, prefijoNombre) {
    const blob = new Blob(['\uFEFF' + textoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const elementoLink = document.createElement('a');
    const fecha = new Date().toISOString().split('T')[0];

    elementoLink.setAttribute("href", url);
    elementoLink.setAttribute("download", `fraustech_${prefijoNombre}_${fecha}.csv`);
    elementoLink.style.visibility = 'hidden';

    document.body.appendChild(elementoLink);
    elementoLink.click();
    document.body.removeChild(elementoLink);
    URL.revokeObjectURL(url);
}