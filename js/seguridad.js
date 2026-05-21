import { abrirCanalSoporteWhatsApp, abrirCanalSoporteEmail } from './seg_contacto.js';
import { generarCSVVentas, generarCSVInventario } from './seg_reportes.js';

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