document.addEventListener('DOMContentLoaded', () => {
    const tabAbastecer = document.getElementById('sub-abastecer');
    if (tabAbastecer) {
        renderizarFormularioIngreso(tabAbastecer);
    }
});



async function renderizarFormularioIngreso(contenedor) {
    let htmlFilaPlantilla = '';

    try {
        const [resIngreso, resBusqueda, resFila] = await Promise.all([
            fetch('html/ingreso.html'),
            fetch('html/busqueda.html'),
            fetch('html/fila_grilla.html')
        ]);

        if (!resIngreso.ok || !resBusqueda.ok || !resFila.ok) {
            throw new Error("Error al obtener los fragmentos de componentes de abastecimiento.");
        }
        
        const htmlIngreso = await resIngreso.text();
        const htmlBusqueda = await resBusqueda.text();
        htmlFilaPlantilla = await resFila.text();
        
        contenedor.innerHTML = htmlIngreso + htmlBusqueda;

    } catch (error) {
        console.error("[Abastecimiento] Error en la carga de vistas:", error);
        contenedor.innerHTML = `<p style="color:#ef4444; padding:20px;">Error al cargar el módulo de ingreso de mercadería.</p>`;
        return;
    }

    const selectTipo = document.getElementById('ingreso-tipo');
    const inputFolio = document.getElementById('ingreso-folio');
    const labelOrigen = document.getElementById('label-origen');
    const inputOrigen = document.getElementById('ingreso-origen');
    const tbody = document.getElementById('contenedor-lineas-productos');
    
    const modal = document.getElementById('modal-buscar-producto');
    const modalInput = document.getElementById('modal-input-filtro');
    const modalTabla = document.getElementById('modal-tabla-resultados');
    let filaDestinoModal = null; 

    const evaluarReglasDocumento = () => {
        if (selectTipo.value === 'ENTRADA') {
            inputFolio.value = `${Date.now().toString().slice(-6)}`;
            inputFolio.disabled = true;
            labelOrigen.innerText = "Descripción / Motivo:";
            inputOrigen.placeholder = "Ej: Ajuste inicial de stock";
        } else {
            inputFolio.value = '';
            inputFolio.disabled = false;
            inputFolio.placeholder = 'Ej: 1024';
            labelOrigen.innerText = "Proveedor:";
            inputOrigen.placeholder = "Ej: Distribuidora Central";
        }
    };

    selectTipo.addEventListener('change', evaluarReglasDocumento);

    const crearFilaFormulario = () => {
        const tr = document.createElement('tr');
        tr.className = 'fila-producto-ingreso';
        tr.style.borderBottom = '1px solid #2e344d';
        
        tr.innerHTML = htmlFilaPlantilla;

        const btnLupa = tr.querySelector('.btn-lupa-buscar');
        const inputSku = tr.querySelector('.linea-sku');
        const inputCantidad = tr.querySelector('.linea-cantidad');
        const inputDescripcion = tr.querySelector('.linea-descripcion');
        const inputCategoria = tr.querySelector('.linea-categoria');
        const inputSubcategoria = tr.querySelector('.linea-subcategoria');
        const inputUnitario = tr.querySelector('.linea-unitario');
        const txtNetoLinea = tr.querySelector('.linea-neto-calculado');
        const btnEliminar = tr.querySelector('.btn-eliminar-fila');

        const calcularLinea = () => {
            const c = parseInt(inputCantidad.value) || 0;
            const u = parseInt(inputUnitario.value) || 0;
            txtNetoLinea.innerText = `$${c * u}`;
            calcularTotalesGlobales();
        };

        let debounceTimer;
        inputSku.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const skuBuscado = e.target.value.trim();

            if (skuBuscado.length >= 3) {
                debounceTimer = setTimeout(async () => {
                    const producto = await window.FrausDB.consultarProductoPorSku(skuBuscado);
                    if (producto) {
                        inputDescripcion.value = producto.descripcion || '';
                        inputCategoria.value = producto.categoria || '';
                        inputSubcategoria.value = producto.subcategoria || '';
                        inputUnitario.value = producto.precio_costo || 0;
                        calcularLinea();
                    }
                }, 1000); 
            }
        });

        btnLupa.addEventListener('click', () => {
            filaDestinoModal = { inputSku, inputDescripcion, inputCategoria, inputSubcategoria, inputUnitario, calcularLinea };
            modalInput.value = '';
            modalTabla.innerHTML = `<tr><td colspan="3" style="padding:15px; text-align:center; color:#94a3b8;">Escribe un término para iniciar el filtro por descripción...</td></tr>`;
            modal.style.display = 'flex';
            modalInput.focus();
        });

        inputCantidad.addEventListener('input', calcularLinea);
        inputUnitario.addEventListener('input', calcularLinea);
        
        btnEliminar.addEventListener('click', () => {
            if (tbody.querySelectorAll('.fila-producto-ingreso').length > 1) {
                tr.remove();
                calcularTotalesGlobales();
            } else {
                alert("El documento debe poseer al menos una línea de producto.");
            }
        });

        tbody.appendChild(tr);
    };

    let modalDebounceTimer;
    modalInput.addEventListener('input', (e) => {
        clearTimeout(modalDebounceTimer);
        const termino = e.target.value.trim().toLowerCase();

        if (termino.length < 2) {
            modalTabla.innerHTML = `<tr><td colspan="3" style="padding:15px; text-align:center; color:#94a3b8;">Escribe al menos 2 letras...</td></tr>`;
            return;
        }

        modalDebounceTimer = setTimeout(async () => {
            if (!window.FrausDB || !dbInstancia) return;

            const transaccion = dbInstancia.transaction(['productos'], 'readonly');
            const almacen = transaccion.objectStore('productos');
            const request = almacen.openCursor();
            
            modalTabla.innerHTML = '';
            let coincidencias = 0;

            request.onsuccess = (evt) => {
                const cursor = evt.target.result;
                if (cursor) {
                    const prod = cursor.value;
                    const desc = (prod.descripcion || '').toLowerCase();
                    
                    if (desc.includes(termino)) {
                        coincidencias++;
                        const filaTmp = document.createElement('tr');
                        filaTmp.style.borderBottom = '1px solid #2e344d';
                        filaTmp.innerHTML = `
                            <td style="padding:10px; color:#3b82f6; font-family:monospace;">${prod.codigo}</td>
                            <td style="padding:10px;">${prod.descripcion}</td>
                            <td style="padding:10px; text-align:center;">
                                <button type="button" class="btn-seleccionar-match" style="background:#10b981; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">Seleccionar</button>
                            </td>
                        `;

                        filaTmp.querySelector('.btn-seleccionar-match').addEventListener('click', () => {
                            if (filaDestinoModal) {
                                filaDestinoModal.inputSku.value = prod.codigo;
                                filaDestinoModal.inputDescripcion.value = prod.descripcion || '';
                                filaDestinoModal.inputCategoria.value = prod.categoria || '';
                                filaDestinoModal.inputSubcategoria.value = prod.subcategoria || '';
                                filaDestinoModal.inputUnitario.value = prod.precio_costo || 0;
                                filaDestinoModal.calcularLinea();
                            }
                            modal.style.display = 'none';
                        });

                        modalTabla.appendChild(filaTmp);
                    }
                    cursor.continue();
                } else if (coincidencias === 0) {
                    modalTabla.innerHTML = `<tr><td colspan="3" style="padding:15px; text-align:center; color:#ef4444;">No se encontraron productos que coincidan con la descripción.</td></tr>`;
                }
            };
        }, 300);
    });

    document.getElementById('modal-cerrar').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    const calcularTotalesGlobales = () => {
        let netoAcumulado = 0;
        const filas = tbody.querySelectorAll('.fila-producto-ingreso');
        
        filas.forEach(f => {
            const c = parseInt(f.querySelector('.linea-cantidad').value) || 0;
            const u = parseInt(f.querySelector('.linea-unitario').value) || 0;
            netoAcumulado += (c * u);
        });

        const ivaCalculado = Math.round(netoAcumulado * 0.19);
        const totalCalculado = netoAcumulado + ivaCalculado;

        document.getElementById('resumen-neto').innerText = `$${netoAcumulado}`;
        document.getElementById('resumen-iva').innerText = `$${ivaCalculado}`;
        document.getElementById('resumen-total').innerText = `$${totalCalculado}`;
    };

    crearFilaFormulario();

    document.getElementById('btn-agregar-fila').addEventListener('click', () => {
        crearFilaFormulario();
        calcularTotalesGlobales();
    });

    document.getElementById('form-ingreso-producto').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tipoDoc = selectTipo.value;
        const numFolio = inputFolio.value.trim();
        const origen = inputOrigen.value.trim();
        
        let prefijo = "EB-";
        if (tipoDoc === "FACTURA") prefijo = "FE-";
        if (tipoDoc === "BOLETA") prefijo = "BE-";
        const folioCompleto = `${prefijo}${numFolio}`;

        const inputFecha = document.getElementById('ingreso-fecha').value;
        const fechaMovimiento = inputFecha ? new Date(inputFecha + 'T12:00:00').toISOString() : new Date().toISOString();

        const lineasAPersistir = [];
        const filasDom = tbody.querySelectorAll('.fila-producto-ingreso');

        filasDom.forEach(f => {
            const skuVal = f.querySelector('.linea-sku').value.trim();
            if (skuVal) { 
                lineasAPersistir.push({
                    sku: skuVal,
                    cantidad: parseInt(f.querySelector('.linea-cantidad').value) || 0,
                    descripcion: f.querySelector('.linea-descripcion').value.trim(),
                    categoria: f.querySelector('.linea-categoria').value.trim(),
                    subcategoria: f.querySelector('.linea-subcategoria').value.trim() || "General",
                    precioNetoUnitario: parseInt(f.querySelector('.linea-unitario').value) || 0
                });
            }
        });

        if (lineasAPersistir.length === 0) {
            alert("Debe ingresar al menos un producto con SKU válido.");
            return;
        }

        const exito = await window.FrausDB.registrarIngresoMercaderiaMultilinea({
            folio: folioCompleto,
            tipo: tipoDoc,
            fecha: fechaMovimiento,
            origen: origen,
            productos: lineasAPersistir
        });

        if (exito) {
            alert(`Documento transaccional ${folioCompleto} guardado con éxito en los registros.`);
            
            document.getElementById('form-ingreso-producto').reset();
            tbody.innerHTML = '';
            
            evaluarReglasDocumento();
            
            crearFilaFormulario();
            calcularTotalesGlobales();
        } else {
            alert("No se pudo escribir el lote de registros en IndexedDB.");
        }
    });

    evaluarReglasDocumento();
}

document.addEventListener('DOMContentLoaded', () => {
    const tabMaestro = document.getElementById('sub-maestro');
    if (tabMaestro) {
        // Listener o disparador cuando se activa la sub-tab de Productos
        document.querySelector('[data-sub="sub-maestro"]')?.addEventListener('click', () => {
            renderizarMaestroProductos(tabMaestro);
        });
    }
});

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
            // 1. Obtener todos los productos base, ventas e historial de abastecimiento
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

                // 2. Filtrar y sumar Ingresos por SKU (COMPRA / ENTRADA)
                const ingresosSku = historialMovimientos
                    .filter(m => m.sku === sku && (m.tipo_movimiento === 'COMPRA' || m.tipo_movimiento === 'ENTRADA'))
                    .reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

                // 3. Filtrar y sumar Egresos por SKU desde Historial de Movimientos (MERMAS / RETIRO)
                const egresosMovimientosSku = historialMovimientos
                    .filter(m => m.sku === sku && (m.tipo_movimiento === 'MERMA' || m.tipo_movimiento === 'RETIRO'))
                    .reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

                // 4. Filtrar y sumar Egresos por SKU desde el almacén de Ventas
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

                // 5. Aplicar Fórmula matemática estricta de Stock Neto
                const stockNetoReal = ingresosSku - (egresosMovimientosSku + egresosVentasSku);

                // 6. Encontrar último precio de costo de compra
                const comprasProducto = historialMovimientos
                    .filter(m => m.sku === sku && m.tipo_movimiento === 'COMPRA')
                    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

                const ultimoCostoCompra = comprasProducto.length > 0 
                    ? comprasProducto[0].precio_costo_unitario 
                    : (prod.precio_costo || 0);

                // 7. Renderizar la fila construida de manera dinámica
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

                // 8. Evento para modificar el precio de venta instantáneamente
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
                        precio_costo: ultimoCostoCompra // Actualiza el costo dinámico en el maestro principal
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

    // Funciones auxiliares genéricas para interactuar con IndexedDB de forma segura
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