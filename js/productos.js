async function renderizarMaestroProductos(contenedor) {
    let htmlFilaMaestro = '';

    try {
        const [resMaestro, resFila] = await Promise.all([
            fetch('html/maestro_productos.html'),
            fetch('html/fila_maestro.html')
        ]);

        if (!resMaestro.ok || !resFila.ok) throw new Error("Error al cargar los fragmentos del maestro.");

        contenedor.innerHTML = await resMaestro.text();
        htmlFilaMaestro = await resFila.text();

    } catch (error) {
        console.error("[Maestro] Error al inyectar vistas:", error);
        contenedor.innerHTML = `<p style="color:#ef4444; padding:20px;">Error al cargar el catálogo de productos.</p>`;
        return;
    }

    const tbody = document.getElementById('contenedor-filas-maestro');
    const btnRecargar = document.getElementById('btn-recargar-maestro');

    const cargarCatalogoCalculado = async () => {
        if (!window.FrausDB || !dbInstancia) return;
        tbody.innerHTML = `<tr><td colspan="7" style="padding:20px; text-align:center; color:#94a3b8;">Calculando existencias y flujos financieros...</td></tr>`;

        try {
            const productosBase = await obtenerTodosLosRegistros('productos');
            const historialMovimientos = await obtenerTodosLosRegistros('historial_inventario') || [];
            const historialVentas = await obtenerTodosLosRegistros('ventas') || [];

            tbody.innerHTML = '';

            if (productosBase.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="padding:20px; text-align:center; color:#94a3b8;">No hay productos registrados en el sistema.</td></tr>`;
                return;
            }

            productosBase.forEach(prod => {
                const sku = prod.codigo;

                const ingresosSku = historialMovimientos
                    .filter(m => m.sku === sku && (m.tipo_movimiento === 'COMPRA' || m.tipo_movimiento === 'ENTRADA'))
                    .reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

                const egresosMovimientosSku = historialMovimientos
                    .filter(m => m.sku === sku && (m.tipo_movimiento === 'MERMA' || m.tipo_movimiento === 'RETIRO'))
                    .reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

                let egresosVentasSku = 0;
                historialVentas.forEach(v => {
                    if (v.productos && Array.isArray(v.productos)) {
                        v.productos.forEach(p => {
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
                    ? comprasProducto[0].precio_costo_unitario 
                    : (prod.precio_costo || 0);

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #2e344d';
                tr.innerHTML = htmlFilaMaestro;

                tr.querySelector('.m-sku').innerText = sku;
                tr.querySelector('.m-descripcion').innerText = prod.descripcion || 'Sin descripción';
                tr.querySelector('.m-categoria').innerText = prod.categoria || 'General';
                
                const celdaStock = tr.querySelector('.m-stock');
                celdaStock.innerText = stockNetoReal;
                celdaStock.style.color = stockNetoReal < 0 ? '#ef4444' : (stockNetoReal === 0 ? '#64748b' : '#10b981');

                tr.querySelector('.m-costo').innerText = `$${ultimoCostoCompra}`;

                const inputPrecio = tr.querySelector('.m-precio-input');
                inputPrecio.value = prod.precio_venta || 0;

                const statusIndicator = tr.querySelector('.m-status');

                const actualizarPrecioVentaBD = async () => {
                    const nuevoPrecio = parseInt(inputPrecio.value) || 0;
                    if (nuevoPrecio < 0) {
                        alert("El precio de venta no puede ser negativo.");
                        inputPrecio.value = prod.precio_venta || 0;
                        return;
                    }

                    statusIndicator.innerText = "⏳";
                    
                    const exito = await actualizarCampoProducto(sku, { 
                        precio_venta: nuevoPrecio,
                        precio_costo: ultimoCostoCompra
                    });

                    if (exito) {
                        prod.precio_venta = nuevoPrecio; 
                        statusIndicator.innerText = "✅";
                        setTimeout(() => { statusIndicator.innerText = "💾"; }, 1500);
                    } else {
                        statusIndicator.innerText = "❌";
                        alert("Error al actualizar el precio en la base de datos.");
                    }
                };

                inputPrecio.addEventListener('blur', actualizarPrecioVentaBD);
                inputPrecio.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        actualizarPrecioVentaBD();
                        inputPrecio.blur();
                    }
                });

                tbody.appendChild(tr);
            });

        } catch (err) {
            console.error("[Maestro] Error calculando flujos de stock:", err);
            tbody.innerHTML = `<tr><td colspan="7" style="padding:20px; text-align:center; color:#ef4444;">Error analítico al consolidar balances.</td></tr>`;
        }
    };

    function obtenerTodosLosRegistros(nombreAlmacen) {
        return new Promise((resolve) => {
            if (!dbInstancia) return resolve([]);
            try {
                const tx = dbInstancia.transaction([nombreAlmacen], 'readonly');
                const store = tx.objectStore(nombreAlmacen);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });
    }

    function actualizarCampoProducto(sku, camposNuevos) {
        return new Promise((resolve) => {
            try {
                const tx = dbInstancia.transaction(['productos'], 'readwrite');
                const store = tx.objectStore(['productos']);
                const getReq = store.get(sku);

                getReq.onsuccess = () => {
                    const data = getReq.result;
                    if (!data) return resolve(false);

                    const registroActualizado = { ...data, ...camposNuevos };
                    const putReq = store.put(registroActualizado);
                    putReq.onsuccess = () => resolve(true);
                    putReq.onerror = () => resolve(false);
                };
                getReq.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    }

    btnRecargar.addEventListener('click', cargarCatalogoCalculado);
    await cargarCatalogoCalculado();
}