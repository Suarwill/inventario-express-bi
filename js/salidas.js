async function renderizarSalidasProductos(contenedor) {
    let htmlFilaPlantilla = '';

    try {
        const [resSalida, resBusqueda, resFila] = await Promise.all([
            fetch('html/salida.html'),
            fetch('html/busqueda.html'),
            fetch('html/fila_grilla_salida.html')
        ]);

        if (!resSalida.ok || !resBusqueda.ok || !resFila.ok) {
            throw new Error("Error al obtener los fragmentos de componentes de salidas.");
        }

        const htmlSalida = await resSalida.text();
        const htmlBusqueda = await resBusqueda.text();
        htmlFilaPlantilla = await resFila.text();

        contenedor.innerHTML = htmlSalida + htmlBusqueda;

    } catch (error) {
        console.error("[Salidas] Error en la carga de vistas:", error);
        contenedor.innerHTML = `<p style="color:#ef4444; padding:20px;">Error al cargar el módulo de retiro y mermas.</p>`;
        return;
    }

    const selectTipo = document.getElementById('salida-tipo');
    const inputFolio = document.getElementById('salida-folio');
    const inputMotivo = document.getElementById('salida-motivo');
    const tbody = document.getElementById('contenedor-lineas-salidas');

    const modal = contenedor.querySelector('#modal-buscar-producto');
    const modalInput = contenedor.querySelector('#modal-input-filtro');
    const modalTabla = contenedor.querySelector('#modal-tabla-resultados');
    const btnCerrarModal = contenedor.querySelector('#modal-cerrar');
    let filaDestinoModal = null;

    const generarFolioSalida = () => {
        inputFolio.value = `SM-${Date.now().toString().slice(-6)}`;
    };

    const crearFilaFormulario = () => {
        const tr = document.createElement('tr');
        tr.className = 'fila-producto-salida';
        tr.style.borderBottom = '1px solid #2e344d';

        tr.innerHTML = htmlFilaPlantilla;

        const btnLupa = tr.querySelector('.btn-lupa-buscar');
        const inputSku = tr.querySelector('.linea-sku');
        const inputCantidad = tr.querySelector('.linea-cantidad');
        const inputDescripcion = tr.querySelector('.linea-descripcion');
        const btnEliminar = tr.querySelector('.btn-eliminar-fila');

        let debounceTimer;
        inputSku.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const skuBuscado = e.target.value.trim();

            if (skuBuscado.length >= 3) {
                debounceTimer = setTimeout(async () => {
                    const producto = await window.FrausDB.consultarProductoPorSku(skuBuscado);
                    if (producto) {
                        inputDescripcion.value = producto.descripcion || '';
                    }
                }, 1000);
            }
        });

        btnLupa.addEventListener('click', () => {
            filaDestinoModal = { inputSku, inputDescripcion };
            modalInput.value = '';
            modalTabla.innerHTML = `<tr><td colspan="3" style="padding:15px; text-align:center; color:#94a3b8;">Escribe un término para iniciar el filtro por descripción...</td></tr>`;
            modal.style.display = 'flex';
            modalInput.focus();
        });

        btnEliminar.addEventListener('click', () => {
            if (tbody.querySelectorAll('.fila-producto-salida').length > 1) {
                tr.remove();
            } else {
                alert("El documento debe poseer al menos una línea de registro.");
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
                            }
                            modal.style.display = 'none';
                        });

                        modalTabla.appendChild(filaTmp);
                    }
                    cursor.continue();
                } else if (coincidencias === 0) {
                    modalTabla.innerHTML = `<tr><td colspan="3" style="padding:15px; text-align:center; color:#ef4444;">No se encontraron productos que coincidan.</td></tr>`;
                }
            };
        }, 300);
    });

    if (btnCerrarModal) {
        btnCerrarModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    document.getElementById('btn-agregar-fila-salida').addEventListener('click', crearFilaFormulario);

    document.getElementById('form-salida-producto').addEventListener('submit', async (e) => {
        e.preventDefault();

        const tipoMov = selectTipo.value;
        const folioDoc = inputFolio.value.trim();
        const motivoText = inputMotivo.value.trim();
        const inputFecha = document.getElementById('salida-fecha').value;
        const fechaMovimiento = inputFecha ? new Date(inputFecha + 'T12:00:00').toISOString() : new Date().toISOString();

        const lineasAPersistir = [];
        const filasDom = tbody.querySelectorAll('.fila-producto-salida');

        filasDom.forEach(f => {
            const skuVal = f.querySelector('.linea-sku').value.trim();
            const cantVal = parseInt(f.querySelector('.linea-cantidad').value) || 0;
            const descVal = f.querySelector('.linea-descripcion').value.trim();

            if (skuVal && cantVal > 0) {
                lineasAPersistir.push({
                    sku: skuVal,
                    cantidad: cantVal,
                    descripcion: descVal,
                    categoria: 'Salida',
                    subcategoria: 'General',
                    precioNetoUnitario: 0
                });
            }
        });

        if (lineasAPersistir.length === 0) {
            alert("Debe ingresar al menos un SKU válido con cantidad mayor a cero.");
            return;
        }

        const exito = await window.FrausDB.registrarIngresoMercaderiaMultilinea({
            folio: folioDoc,
            tipo: tipoMov,
            fecha: fechaMovimiento,
            origen: motivoText,
            productos: lineasAPersistir
        });

        if (exito) {
            alert(`Documento de salida ${folioDoc} procesado con éxito.`);
            document.getElementById('form-salida-producto').reset();
            tbody.innerHTML = '';
            generarFolioSalida();
            crearFilaFormulario();
        } else {
            alert("No se pudo escribir el lote de rebajas en IndexedDB.");
        }
    });

    generarFolioSalida();
    crearFilaFormulario();
}