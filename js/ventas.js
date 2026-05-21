document.addEventListener('DOMContentLoaded', () => {
    let carrito = [];
    const inputEscaner = document.getElementById('input-escaner');
    const carritoBody = document.getElementById('carrito-body');
    const gridDinamico = document.getElementById('grid-favoritos');
    const labelNeto = document.getElementById('total-neto');
    const labelIva = document.getElementById('total-iva');
    const labelBruto = document.getElementById('total-bruto');
    const botonesPago = document.querySelectorAll('.btn-pago');
    const btnPausar = document.getElementById('btn-pausar-venta');

    let modalBusqueda = null;
    let modalInput = null;
    let modalTabla = null;

    const verificarCajaAbierta = () => {
        return new Promise((resolve) => {
            if (!dbInstancia) return resolve(false);
            try {
                const tx = dbInstancia.transaction(['caja'], 'readonly');
                const store = tx.objectStore('caja');
                const req = store.getAll();

                req.onsuccess = () => {
                    const registros = req.result || [];
                    const cajaAbierta = registros.find(c => c.estado === 'ABIERTO' || !c.fecha_cierre);
                    resolve(!!cajaAbierta);
                };
                req.onerror = () => resolve(false);
            } catch (e) {
                resolve(false);
            }
        });
    };

    const evaluarEstadoCajaInterfaz = async () => {
        const contenedorMetodos = document.querySelector('.metodos-pago');
        if (!contenedorMetodos) return;

        let mensajeBloqueo = document.getElementById('alerta-caja-requerida');
        const tieneCaja = await verificarCajaAbierta();

        if (tieneCaja) {
            contenedorMetodos.style.display = 'flex';
            if (mensajeBloqueo) mensajeBloqueo.remove();
        } else {
            contenedorMetodos.style.display = 'none';
            if (!mensajeBloqueo) {
                mensajeBloqueo = document.createElement('div');
                mensajeBloqueo.id = 'alerta-caja-requerida';
                mensajeBloqueo.style.cssText = 'background:#ef444422; border:1px dashed #ef4444; color:#f87171; padding:15px; border-radius:8px; text-align:center; margin:15px; font-size:14px; font-weight:bold; display:flex; flex-direction:column; gap:10px; align-items:center;';
                mensajeBloqueo.innerHTML = `
                    <span>⚠️ Debe abrir caja para procesar ventas</span>
                    <a href="mod-caja.html" style="background:#ef4444; color:#fff; padding:6px 12px; border-radius:4px; text-decoration:none; font-size:12px;">Ir a Gestión de Caja</a>
                `;
                contenedorMetodos.parentNode.appendChild(mensajeBloqueo);
            }
        }
    };

    const inicializarModalVentas = async () => {
        try {
            const res = await fetch('html/busqueda.html');
            if (!res.ok) return;
            const html = await res.text();
            
            const contenedorModal = document.createElement('div');
            contenedorModal.innerHTML = html;
            document.body.appendChild(contenedorModal);

            modalBusqueda = document.getElementById('modal-buscar-producto');
            modalInput = document.getElementById('modal-input-filtro');
            modalTabla = document.getElementById('modal-tabla-resultados');

            document.getElementById('modal-cerrar').addEventListener('click', () => {
                modalBusqueda.style.display = 'none';
                inputEscaner.focus();
            });

            let debounceTimer;
            modalInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                const termino = e.target.value.trim().toLowerCase();

                if (termino.length < 2) {
                    modalTabla.innerHTML = `<tr><td colspan="3" style="padding:15px; text-align:center; color:#94a3b8;">Escribe al menos 2 letras...</td></tr>`;
                    return;
                }

                debounceTimer = setTimeout(() => {
                    if (!dbInstancia) return;
                    const tx = dbInstancia.transaction(['productos'], 'readonly');
                    const store = tx.objectStore('productos');
                    modalTabla.innerHTML = '';
                    let coincidencias = 0;

                    store.openCursor().onsuccess = (evt) => {
                        const cursor = evt.target.result;
                        if (cursor) {
                            const prod = cursor.value;
                            if ((prod.descripcion || '').toLowerCase().includes(termino)) {
                                coincidencias++;
                                const tr = document.createElement('tr');
                                tr.style.borderBottom = '1px solid #2e344d';
                                tr.innerHTML = `
                                    <td style="padding:10px; color:#3b82f6; font-family:monospace;">${prod.codigo}</td>
                                    <td style="padding:10px;">${prod.descripcion}</td>
                                    <td style="padding:10px; text-align:center;">
                                        <button type="button" class="btn-sel-match" style="background:#10b981; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">Seleccionar</button>
                                    </td>
                                `;
                                tr.querySelector('.btn-sel-match').addEventListener('click', () => {
                                    agregarAlCarrito(prod);
                                    modalBusqueda.style.display = 'none';
                                    inputEscaner.value = '';
                                    inputEscaner.focus();
                                });
                                modalTabla.appendChild(tr);
                            }
                            cursor.continue();
                        } else if (coincidencias === 0) {
                            modalTabla.innerHTML = `<tr><td colspan="3" style="padding:15px; text-align:center; color:#ef4444;">No hay coincidencias.</td></tr>`;
                        }
                    };
                }, 300);
            });

        } catch (err) {
            console.error(err);
        }
    };

    const actualizarTotales = () => {
        let totalBruto = carrito.reduce((acc, item) => acc + (item.precio_venta * item.cantidad), 0);
        let totalNeto = Math.round(totalBruto / 1.19);
        let totalIva = totalBruto - totalNeto;

        labelNeto.innerText = `$${totalNeto.toLocaleString('es-CL')}`;
        labelIva.innerText = `$${totalIva.toLocaleString('es-CL')}`;
        labelBruto.innerText = `$${totalBruto.toLocaleString('es-CL')}`;
    };

    const renderizarCarrito = () => {
        carritoBody.innerHTML = '';
        carrito.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:10px;">${item.descripcion}</td>
                <td style="padding:10px; width:90px;"><input type="number" class="cant-item" value="${item.cantidad}" min="1" style="width:100%; padding:5px; background:#0d0f14; border:1px solid #2e344d; color:#fff; text-align:center; border-radius:4px;"></td>
                <td style="padding:10px;">$${item.precio_venta.toLocaleString('es-CL')}</td>
                <td style="padding:10px; font-weight:bold; color:#10b981;">$${(item.precio_venta * item.cantidad).toLocaleString('es-CL')}</td>
                <td style="padding:10px; text-align:center;"><button type="button" class="btn-del-item" style="background:#ef4444; color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;">✕</button></td>
            `;

            tr.querySelector('.cant-item').addEventListener('change', (e) => {
                let nuevaCant = parseInt(e.target.value) || 1;
                carrito[index].cantidad = nuevaCant;
                renderizarCarrito();
            });

            tr.querySelector('.btn-del-item').addEventListener('click', () => {
                carrito.splice(index, 1);
                renderizarCarrito();
            });

            carritoBody.appendChild(tr);
        });

        actualizarTotales();
    };

    const agregarAlCarrito = (producto) => {
        const existe = carrito.find(item => item.sku === producto.codigo);
        if (existe) {
            existe.cantidad++;
        } else {
            carrito.push({
                sku: producto.codigo,
                descripcion: producto.descripcion,
                precio_venta: producto.precio_venta,
                cantidad: 1
            });
        }
        renderizarCarrito();
    };

    let escanerTimer;
    inputEscaner.addEventListener('input', (e) => {
        clearTimeout(escanerTimer);
        const valor = e.target.value.trim();
        if (!valor) return;

        escanerTimer = setTimeout(async () => {
            const producto = await window.FrausDB.consultarProductoPorSku(valor);
            if (producto) {
                agregarAlCarrito(producto);
                inputEscaner.value = '';
                inputEscaner.focus();
            } else {
                if (valor.length >= 3 && isNaN(valor)) {
                    if (modalBusqueda) {
                        modalBusqueda.style.display = 'flex';
                        modalInput.value = valor;
                        modalInput.dispatchEvent(new Event('input'));
                        modalInput.focus();
                    }
                }
            }
        }, 300);
    });

    botonesPago.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (carrito.length === 0) {
                alert("El carrito se encuentra vacío.");
                return;
            }

            const tieneCaja = await verificarCajaAbierta();
            if (!tieneCaja) {
                alert("Operación denegada: Debe abrir caja antes de procesar ventas en el sistema.");
                evaluarEstadoCajaInterfaz();
                return;
            }

            const metodo = btn.getAttribute('data-metodo');
            let nroTransaccionPos = null;

            if (metodo === 'tarjeta') {
                const voucher = prompt("Ingrese el número de operación / transacción del terminal POS:");
                if (voucher === null) {
                    return;
                }
                nroTransaccionPos = voucher.trim();
                if (!nroTransaccionPos) {
                    alert("El número de transacción es mandatorio para cobros con tarjeta.");
                    return;
                }
            }

            const totalBruto = carrito.reduce((acc, item) => acc + (item.precio_venta * item.cantidad), 0);
            const totalNeto = Math.round(totalBruto / 1.19);
            const totalIva = totalBruto - totalNeto;

            const datosVenta = {
                fecha: new Date().toISOString(),
                items: carrito,
                neto: totalNeto,
                iva: totalIva,
                total: totalBruto,
                metodo_pago: metodo.charAt(0).toUpperCase() + metodo.slice(1),
                transaccion_pos: nroTransaccionPos
            };

            const exito = await window.FrausDB.registrarVenta(datosVenta);
            if (exito) {
                alert("Venta procesada y boleta generada exitosamente.");
                carrito = [];
                renderizarCarrito();
                inputEscaner.value = '';
                inputEscaner.focus();
            } else {
                alert("Ocurrió un error interno al registrar la transacción.");
            }
        });
    });

    if (btnPausar) {
        btnPausar.addEventListener('click', () => {
            if (carrito.length === 0) {
                alert("No hay transacciones en curso para pausar.");
                return;
            }
            alert("Operación pausada temporalmente.");
        });
    }

    window.addEventListener('db-ready', () => {
        gridDinamico.innerHTML = '';
        evaluarEstadoCajaInterfaz();
        inicializarModalVentas();
    });

    if (window.FrausDB && dbInstancia) {
        gridDinamico.innerHTML = '';
        evaluarEstadoCajaInterfaz();
        inicializarModalVentas();
    }
});