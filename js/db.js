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

const obtenerTotalesVentasTurnoActual = () => {
    return new Promise((resolve) => {
        if (!dbInstancia) {
            resolve({ efectivo: 0, tarjeta: 0, transferencia: 0 });
            return;
        }

        const transaccion = dbInstancia.transaction(['ventas', 'caja'], 'readonly');
        const almacenVentas = transaccion.objectStore('ventas');
        const almacenCaja = transaccion.objectStore('caja');

        const peticionCaja = almacenCaja.getAll();

        peticionCaja.onsuccess = (e) => {
            const registrosCaja = e.target.result || [];
            const turnoActivo = registrosCaja.find(c => c.estado === 'ABIERTO' || !c.fecha_cierre);

            if (!turnoActivo) {
                resolve({ efectivo: 0, tarjeta: 0, transferencia: 0 });
                return;
            }

            const fechaAperturaTurno = new Date(turnoActivo.fecha_apertura);
            const peticionVentas = almacenVentas.getAll();

            peticionVentas.onsuccess = (ev) => {
                const todasLasVentas = ev.target.result || [];
                const totales = { efectivo: 0, tarjeta: 0, transferencia: 0 };

                todasLasVentas.forEach(venta => {
                    const fechaVenta = new Date(venta.fecha);
                    if (fechaVenta >= fechaAperturaTurno) {
                        const metodo = (venta.metodo_pago || '').toLowerCase().trim();
                        const monto = parseInt(venta.total) || 0;

                        if (metodo === 'efectivo') {
                            totales.efectivo += monto;
                        } else if (metodo === 'tarjeta') {
                            totales.tarjeta += monto;
                        } else if (metodo === 'transferencia' || metodo === 'transf.') {
                            totales.transferencia += monto;
                        }
                    }
                });

                resolve(totales);
            };

            peticionVentas.onerror = () => resolve({ efectivo: 0, tarjeta: 0, transferencia: 0 });
        };

        peticionCaja.onerror = () => resolve({ efectivo: 0, tarjeta: 0, transferencia: 0 });
    });
};

const inicializar = async () => {
    try {
        await abrirBaseDatos();
        window.dispatchEvent(new CustomEvent('db-ready'));
    } catch (error) {
        console.error("Fallo crítico en inicialización de DB:", error);
    }
};

const obtenerEstadoCaja = () => {
    return new Promise((resolve) => {
        if (!dbInstancia) return resolve(null);
        const tx = dbInstancia.transaction(['caja'], 'readonly');
        const store = tx.objectStore('caja');
        const req = store.getAll();
        req.onsuccess = () => {
            const registros = req.result || [];
            const abierta = registros.find(c => c.estado === 'ABIERTO' || !c.fecha_cierre);
            resolve(abierta || null);
        };
        req.onerror = () => resolve(null);
    });
};

const abrirCaja = (datosApertura) => {
    return new Promise((resolve) => {
        if (!dbInstancia) return resolve(false);
        const tx = dbInstancia.transaction(['caja'], 'readwrite');
        const store = tx.objectStore('caja');
        const req = store.add(datosApertura);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
    });
};

const cerrarCaja = (datosCierre) => {
    return new Promise((resolve) => {
        if (!dbInstancia) return resolve(false);
        const tx = dbInstancia.transaction(['caja'], 'readwrite');
        const store = tx.objectStore('caja');
        const reqGetAll = store.getAll();

        reqGetAll.onsuccess = () => {
            const registros = reqGetAll.result || [];
            const abierta = registros.find(c => c.estado === 'ABIERTO' || !c.fecha_cierre);
            if (!abierta) return resolve(false);

            const registroActualizado = { ...abierta, ...datosCierre };
            const reqPut = store.put(registroActualizado);
            reqPut.onsuccess = () => resolve(true);
            reqPut.onerror = () => resolve(false);
        };
        reqGetAll.onerror = () => resolve(false);
    });
};

const registrarIngresoMercaderiaMultilinea = (documento) => {
    return new Promise((resolve) => {
        if (!dbInstancia) return resolve(false);
        const transaccion = dbInstancia.transaction(['productos', 'historial_inventario'], 'readwrite');
        const almacenProductos = transaccion.objectStore('productos');
        const almacenHistorial = transaccion.objectStore('historial_inventario');

        let index = 0;
        const procesarSiguienteProducto = () => {
            if (index >= documento.productos.length) return;

            const item = documento.productos[index];
            const peticionBusqueda = almacenProductos.get(item.sku);

            peticionBusqueda.onsuccess = (e) => {
                const productoExistente = e.target.result;

                if (productoExistente) {
                    if (documento.tipo === 'INGRESO' || documento.tipo === 'COMPRA') {
                        productoExistente.precio_costo = item.precioNetoUnitario;
                    }
                    almacenProductos.put(productoExistente);
                } else {
                    almacenProductos.add({
                        codigo: item.sku,
                        descripcion: item.descripcion,
                        categoria: item.categoria,
                        subcategoria: item.subcategoria || "General",
                        precio_costo: item.precioNetoUnitario,
                        precio_venta: 0
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
};

const consultarProductoPorSku = (sku) => {
    return new Promise((resolve) => {
        if (!dbInstancia) {
            resolve(null);
            return;
        }
        const transaccion = dbInstancia.transaction(['productos'], 'readonly');
        const almacen = transaccion.objectStore('productos');
        const peticion = almacen.get(sku);

        peticion.onsuccess = (e) => resolve(e.target.result || null);
        peticion.onerror = () => resolve(null);
    });
};

const registrarVenta = (datosVenta) => {
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
};

window.FrausDB = {
    inicializar,
    obtenerEstadoCaja,
    abrirCaja,
    cerrarCaja,
    registrarIngresoMercaderiaMultilinea,
    consultarProductoPorSku,
    registrarVenta,
    obtenerTotalesVentasTurnoActual
};

window.FrausDB.inicializar().catch(console.error);