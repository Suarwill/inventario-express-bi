const DB_NAME = 'FrausTechPOS';
const DB_VERSION = 1;
let dbInstancia = null;

const abrirBaseDatos = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            
            if (!db.objectStoreNames.contains('productos')) {
                db.createObjectStore('productos', { keyPath: 'codigo' });
            }
            if (!db.objectStoreNames.contains('ventas')) {
                db.createObjectStore('ventas', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('caja')) {
                db.createObjectStore('caja', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('historial_inventario')) {
                db.createObjectStore('historial_inventario', { keyPath: 'id', autoIncrement: true });
            }
            console.log("[IndexedDB] Estructura de almacenes creada/verificada.");
        };

        request.onsuccess = (e) => {
            dbInstancia = e.target.result;
            console.log("[IndexedDB] Conexión establecida con éxito.");
            resolve(dbInstancia);
        };

        request.onerror = (e) => {
            console.error("[IndexedDB] Error al abrir la base de datos:", e.target.error);
            reject(e.target.error);
        };
    });
};

window.FrausDB = {
    async inicializar() {
        try {
            await abrirBaseDatos();
            window.dispatchEvent(new CustomEvent('db-ready'));
        } catch (error) {
            console.error("[IndexedDB] Error crítico en la inicialización:", error);
        }
    },

    obtenerEstadoCaja() {
        return new Promise((resolve, reject) => {
            const transaccion = dbInstancia.transaction(['caja'], 'readonly');
            const almacen = transaccion.objectStore('caja');
            const request = almacen.openCursor(null, 'prev');

            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const registro = cursor.value;
                    if (registro.estado === 'abierto') {
                        resolve(registro);
                        return;
                    }
                }
                resolve(null);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    },

    abrirCaja(monto) {
        return new Promise((resolve, reject) => {
            const transaccion = dbInstancia.transaction(['caja'], 'readwrite');
            const almacen = transaccion.objectStore('caja');

            const nuevaCaja = {
                fecha_apertura: new Date().toISOString(),
                fecha_cierre: null,
                monto_apertura: monto,
                monto_cierre_real: null,
                estado: 'abierto'
            };

            const request = almacen.add(nuevaCaja);

            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    calcularTotalesDesde(fechaApertura) {
        return new Promise((resolve, reject) => {
            const transaccion = dbInstancia.transaction(['ventas'], 'readonly');
            const almacen = transaccion.objectStore('ventas');
            const request = almacen.openCursor();

            let efectivo = 0;
            let tarjeta = 0;
            let transferencia = 0;
            const fApertura = new Date(fechaApertura);

            request.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const venta = cursor.value;
                    if (new Date(venta.fecha) >= fApertura) {
                        if (venta.metodo_pago === 'Efectivo') efectivo += venta.total;
                        if (venta.metodo_pago === 'Tarjeta') tarjeta += venta.total;
                        if (venta.metodo_pago === 'Transferencia') transferencia += venta.total;
                    }
                    cursor.continue();
                } else {
                    resolve({ efectivo, tarjeta, transferencia });
                }
            };

            request.onerror = (e) => reject(e.target.error);
        });
    },

    cerrarCaja(id, montoReal) {
        return new Promise((resolve, reject) => {
            const transaccion = dbInstancia.transaction(['caja'], 'readwrite');
            const almacen = transaccion.objectStore('caja');
            const requestGet = almacen.get(id);

            requestGet.onsuccess = (e) => {
                const registro = e.target.result;
                if (registro) {
                    registro.monto_cierre_real = montoReal;
                    registro.fecha_cierre = new Date().toISOString();
                    registro.estado = 'cerrado';

                    const requestUpdate = almacen.put(registro);
                    requestUpdate.onsuccess = () => resolve(true);
                    requestUpdate.onerror = (err) => reject(err.target.error);
                } else {
                    resolve(false);
                }
            };

            requestGet.onerror = (e) => reject(e.target.error);
        });
    },

    registrarIngresoMercaderiaMultilinea(documento) {
        return new Promise((resolve) => {
            const transaccion = dbInstancia.transaction(['productos', 'historial_inventario'], 'readwrite');
            const almacenProductos = transaccion.objectStore('productos');
            const almacenHistorial = transaccion.objectStore('historial_inventario');

            let index = 0;

            const procesarSiguienteProducto = () => {
                if (index >= documento.productos.length) {
                    return;
                }

                const item = documento.productos[index];
                const peticionBusqueda = almacenProductos.get(item.sku);

                peticionBusqueda.onsuccess = (e) => {
                    const productoExistente = e.target.result;

                    if (productoExistente) {
                        productoExistente.precio_costo = item.precioNetoUnitario;
                        productoExistente.descripcion = item.descripcion;
                        productoExistente.categoria = item.categoria;
                        productoExistente.subcategoria = item.subcategoria;
                        almacenProductos.put(productoExistente);
                    } else {
                        almacenProductos.add({
                            codigo: item.sku,
                            descripcion: item.descripcion,
                            precio_costo: item.precioNetoUnitario,
                            precio_venta: Math.ceil(item.precioNetoUnitario * 1.3),
                            categoria: item.categoria,
                            subcategoria: item.subcategoria
                        });
                    }

                    almacenHistorial.add({
                        folio: documento.folio,
                        sku: item.sku,
                        tipo_movimiento: documento.tipo,
                        origen: documento.origen, 
                        cantidad: item.cantidad,
                        precio_costo_unitario: item.precioNetoUnitario,
                        fecha: documento.fecha
                    });

                    index++;
                    procesarSiguienteProducto();
                };

                peticionBusqueda.onerror = () => {
                    transaccion.abort();
                };
            };

            transaccion.oncomplete = () => resolve(true);
            transaccion.onerror = () => resolve(false);

            procesarSiguienteProducto();
        });
    },

    consultarProductoPorSku(sku) {
        return new Promise((resolve) => {
            if (!dbInstancia) {
                resolve(null);
                return;
            }
            const transaccion = dbInstancia.transaction(['productos'], 'readonly');
            const almacen = transaccion.objectStore('productos');
            const peticion = almacen.get(sku);

            peticion.onsuccess = (e) => {
                resolve(e.target.result || null);
            };
            peticion.onerror = () => {
                resolve(null);
            };
        });
    },

    registrarVenta(datosVenta) {
        return new Promise((resolve) => {
            const transaccion = dbInstancia.transaction(['ventas', 'historial_inventario'], 'readwrite');
            const almacenVentas = transaccion.objectStore('ventas');
            const almacenHistorial = transaccion.objectStore('historial_inventario');

            almacenVentas.add({
                fecha: datosVenta.fecha,
                items: datosVenta.items,
                neto: datosVenta.neto,
                iva: datosVenta.iva,
                total: datosVenta.total,
                metodo_pago: datosVenta.metodo_pago
            });

            datosVenta.items.forEach(item => {
                almacenHistorial.add({
                    folio: `VTA-${Date.now().toString().slice(-6)}`,
                    sku: item.sku,
                    tipo_movimiento: 'VENTA',
                    origen: 'Punto de Venta',
                    cantidad: item.cantidad,
                    precio_costo_unitario: 0,
                    fecha: datosVenta.fecha
                });
            });

            transaccion.oncomplete = () => resolve(true);
            transaccion.onerror = () => resolve(false);
        });
    }
};

window.FrausDB.inicializar().catch(console.error);