document.addEventListener('DOMContentLoaded', () => {
    const btnExport = document.getElementById('btn-backup-export');
    const btnImport = document.getElementById('btn-backup-import');
    const btnCsvVentas = document.getElementById('btn-csv-ventas');
    const btnCsvInventario = document.getElementById('btn-csv-inventario');
    const btnWhatsApp = document.getElementById('btn-soporte-wa');
    const btnEmail = document.getElementById('btn-soporte-email');


    if (btnExport) {            btnExport.addEventListener('click', exportarIndexedDBAJSON)         }
    if (btnImport) {            btnImport.addEventListener('click', levantarSelectorImportacion)    }
    
    if (btnCsvVentas) {         btnCsvVentas.addEventListener('click', generarCSVVentas)            }
    if (btnCsvInventario) {     btnCsvInventario.addEventListener('click', generarCSVInventario)    }

    if (btnWhatsApp) {          btnWhatsApp.addEventListener('click', abrirCanalSoporteWhatsApp)    }
    if (btnEmail) {             btnEmail.addEventListener('click', abrirCanalSoporteEmail)          }

});

// CANAL DE SOPORTE: WHATSAPP
function abrirCanalSoporteWhatsApp() {
    if (!window.CONFIG_CLIENTE || !window.CONFIG_CLIENTE.administrador || !window.CONFIG_CLIENTE.administrador.celular) {
        alert("Error: No se pudo cargar el número de soporte técnico desde la configuración.");
        return;
    }

    const celularSoporte = window.CONFIG_CLIENTE.administrador.celular;
    const nombreEmpresa = window.CONFIG_CLIENTE.empresa?.nombre || "Cliente FrausTech";
    
    const mensaje = encodeURIComponent(`Hola Soporte FrausTech, necesito asistencia técnica para el comercio: *${nombreEmpresa}*.`);
    
    const urlWhatsApp = `https://api.whatsapp.com/send?phone=${celularSoporte}&text=${mensaje}`;
    
    window.open(urlWhatsApp, '_blank');
}

// CANAL DE SOPORTE: EMAIL
function abrirCanalSoporteEmail() {
    if (!window.CONFIG_CLIENTE || !window.CONFIG_CLIENTE.administrador || !window.CONFIG_CLIENTE.administrador.email) {
        alert("Error: No se pudo cargar el correo electrónico de soporte técnico desde la configuración.");
        return;
    }

    const emailSoporte = window.CONFIG_CLIENTE.administrador.email;
    const nombreEmpresa = window.CONFIG_CLIENTE.empresa?.nombre || "Cliente FrausTech";
    const rutEmpresa = window.CONFIG_CLIENTE.empresa?.rut || "Sin RUT";
    const licenciaClave = window.CONFIG_CLIENTE.licencia?.clave || "Sin Licencia";

    const asunto = encodeURIComponent(`Ticket de Soporte Técnico - ${nombreEmpresa}`);
    
    const cuerpo = encodeURIComponent(
        `Hola Soporte FrausTech,\n\n` +
        `Solicito asistencia técnica para el siguiente comercio:\n` +
        `--------------------------------------------------\n` +
        `Empresa: ${nombreEmpresa}\n` +
        `RUT: ${rutEmpresa}\n` +
        `Licencia: ${licenciaClave}\n` +
        `--------------------------------------------------\n\n` +
        `Descripción del problema o requerimiento:\n` +
        `[Por favor, detalle aquí su consulta para agilizar el soporte]`
    );

    const urlMailto = `mailto:${emailSoporte}?subject=${asunto}&body=${cuerpo}`;

    window.location.href = urlMailto;
}

// REPORTE: VENTAS
function generarCSVVentas() {
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

            const cabeceras = ['id', 'fecha', 'total', 'metodo_pago'];
            
            const filas = registros.map(obj => 
                cabeceras.map(campo => {
                    let valor = obj[campo] === undefined || obj[campo] === null ? "" : obj[campo];
                    if (typeof valor === 'string' && (valor.includes(',') || valor.includes('\n') || valor.includes('"'))) {
                        valor = `"${valor.replace(/"/g, '""')}"`;
                    }
                    return valor;
                }).join(',')
            );

            const contenidoCSV = [cabeceras.join(','), ...filas].join('\n');
            descargarPlantillaCSV(contenidoCSV, 'reporte_ventas');
        };

        peticionGetAll.onerror = (evt) => {
            console.error("Error al extraer el historial de ventas:", evt.target.error);
        };
    };

    request.onerror = (e) => {
        console.error("Error al conectar con IndexedDB para reporte de ventas:", e.target.error);
    };
}

// REPORTE: INVENTARIO
function generarCSVInventario() {
    const DB_NAME = 'FrausTechPOS';
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = (e) => {
        const db = e.target.result;
        
        if (!db.objectStoreNames.contains('productos')) {
            alert("El almacén de productos aún no ha sido creado.");
            return;
        }

        const transaccion = db.transaction(['productos'], 'readonly');
        const almacen = transaccion.objectStore('productos');
        const peticionGetAll = almacen.getAll();

        peticionGetAll.onsuccess = (evt) => {
            const registros = evt.target.result;
            if (registros.length === 0) {
                alert("El catálogo de inventario está vacío. No hay productos para exportar.");
                return;
            }

            const cabeceras = ['codigo', 'descripcion', 'precio_costo', 'precio_venta', 'stock', 'categoria'];

            const filas = registros.map(obj => 
                cabeceras.map(campo => {
                    let valor = obj[campo] === undefined || obj[campo] === null ? "" : obj[campo];
                    if (typeof valor === 'string' && (valor.includes(',') || valor.includes('\n') || valor.includes('"'))) {
                        valor = `"${valor.replace(/"/g, '""')}"`;
                    }
                    return valor;
                }).join(',')
            );

            const contenidoCSV = [cabeceras.join(','), ...filas].join('\n');
            descargarPlantillaCSV(contenidoCSV, 'maestro_inventario');
        };

        peticionGetAll.onerror = (evt) => {
            console.error("Error al extraer el catálogo de productos:", evt.target.error);
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

// EXPORTACION DE DATABASE
function exportarIndexedDBAJSON() {
    const DB_NAME = 'FrausTechPOS';
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = (e) => {
        const db = e.target.result;
        const almacenes = Array.from(db.objectStoreNames);
        const respaldo = {};
        let almacenesProcesados = 0;

        if (almacenes.length === 0) {
            alert("La base de datos está vacía. No hay datos para respaldar.");
            return;
        }

        const transaccion = db.transaction(almacenes, 'readonly');

        almacenes.forEach((nombreAlmacen) => {
            const almacen = transaccion.objectStore(nombreAlmacen);
            const peticionGetAll = almacen.getAll();

            peticionGetAll.onsuccess = (evt) => {
                respaldo[nombreAlmacen] = evt.target.result;
                almacenesProcesados++;

                if (almacenesProcesados === almacenes.length) {
                    descargarArchivoJSON(respaldo);
                }
            };

            peticionGetAll.onerror = (evt) => {
                console.error(`Error al leer el almacén ${nombreAlmacen}:`, evt.target.error);
            };
        });
    };

    request.onerror = (e) => {
        console.error("Error al abrir IndexedDB para exportación:", e.target.error);
        alert("No se pudo acceder a la base de datos local.");
    };
}

function descargarArchivoJSON(objetoDatos) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(objetoDatos, null, 2));
    const elementoDescarga = document.createElement('a');
    
    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    
    elementoDescarga.setAttribute("href", dataStr);
    elementoDescarga.setAttribute("download", `database_backup_${fecha}_${hora}.json`);
    elementoDescarga.style.display = 'none';
    
    document.body.appendChild(elementoDescarga);
    elementoDescarga.click();
    document.body.removeChild(elementoDescarga);
}

// IMPORTACION DE DATABASE
function levantarSelectorImportacion() {
    const confirmar = confirm("ADVERTENCIA: Al restaurar esta copia de seguridad, se reemplazarán por completo todos los datos actuales de inventario, ventas y cajas. ¿Desea continuar?");
    if (!confirmar) return;

    const inputInput = document.createElement('input');
    inputInput.type = 'file';
    inputInput.accept = '.json';
    
    inputInput.onchange = (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;

        const lector = new FileReader();
        lector.onload = (evt) => {
            try {
                const datosParseados = JSON.parse(evt.target.result);
                procesarImportacionAIndexedDB(datosParseados);
            } catch (err) {
                alert("El archivo seleccionado no tiene un formato JSON válido.");
                console.error(err);
            }
        };
        lector.readAsText(archivo);
    };

    inputInput.click();
}

function procesarImportacionAIndexedDB(datosRespaldo) {
    const DB_NAME = 'FrausTechPOS';
    const request = indexedDB.open(DB_NAME);

    request.onsuccess = (e) => {
        const db = e.target.result;
        const almacenesDestino = Array.from(db.objectStoreNames);
        
        const transaccion = db.transaction(almacenesDestino, 'readwrite');

        transaccion.oncomplete = () => {
            alert("Copia de seguridad restaurada con éxito. El sistema se actualizará.");
            window.location.reload();
        };

        transaccion.onerror = (evt) => {
            console.error("Error general en la transacción de importación:", evt.target.error);
            alert("Ocurrió un error al escribir los datos de respaldo.");
        };

        almacenesDestino.forEach((nombreAlmacen) => {
            const almacen = transaccion.objectStore(nombreAlmacen);
            
            const almenenLimpiar = almacen.clear();

            almenenLimpiar.onsuccess = () => {
                const registrosNuevos = datosRespaldo[nombreAlmacen];
                if (registrosNuevos && Array.isArray(registrosNuevos)) {
                    registrosNuevos.forEach((item) => {
                        almacen.add(item);
                    });
                }
            };

            almenenLimpiar.onerror = (evt) => {
                console.error(`Error al limpiar el almacén ${nombreAlmacen}:`, evt.target.error);
            };
        });
    };

    request.onerror = (e) => {
        console.error("Error al abrir IndexedDB para importación:", e.target.error);
    };
}