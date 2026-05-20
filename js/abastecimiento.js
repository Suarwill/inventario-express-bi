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