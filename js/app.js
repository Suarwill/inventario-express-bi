document.addEventListener('DOMContentLoaded', async () => {
    console.log("[FrausTech POS] Iniciando orquestador del sistema...");

    const esValido = verificarLicenciaSistema();
    if (!esValido) {
        ejecutarBloqueoPantalla();
        return;
    }

    try {
        if (window.FrausDB && typeof window.FrausDB.inicializar === 'function') {
            await window.FrausDB.inicializar();
            console.log("[FrausTech POS] IndexedDB conectada y verificada.");
            
            const eventoDbReady = new CustomEvent('db-ready');
            window.dispatchEvent(eventoDbReady);
            console.log("[FrausTech POS] Evento 'db-ready' emitido a todos los sub-módulos.");
        } else {
            throw new Error("El motor FrausDB no se encuentra cargado en el contexto global.");
        }
    } catch (error) {
        console.error("[FrausTech POS] Fallo crítico en la secuencia de inicialización:", error);
        notificarFalloEstructural(error);
    }

    configurarMonitoreoEntorno();
});

function verificarLicenciaSistema() {
    if (!window.CONFIG_CLIENTE || !window.CONFIG_CLIENTE.licencia) {
        return false;
    }
    const licencia = window.CONFIG_CLIENTE.licencia;
    if (licencia.estado !== 'ACTIVA') {
        return false;
    }
    return true;
}

function ejecutarBloqueoPantalla() {
    const capaBloqueo = document.getElementById('bloqueo-licencia');
    if (capaBloqueo) {
        capaBloqueo.style.display = 'flex';
        capaBloqueo.innerHTML = `
            <div class="bloqueo-mensaje" style="text-align: center; margin: auto; padding: 40px; background: #1e293b; border-radius: 8px; border: 1px solid #ef4444; color: #f8fafc; font-family: sans-serif;">
                <h2 style="color: #ef4444; margin-bottom: 10px;">Licencia Inactiva o Restringida</h2>
                <p style="color: #94a3b8;">El terminal POS local no cuenta con los permisos necesarios para operar en este comercio.</p>
                <p style="font-size: 14px; margin-top: 20px; color: #64748b;">Por favor, contacte al soporte de FrausTech para validar el estado de su suscripción.</p>
            </div>
        `;
        
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.pointerEvents = 'none';
            appContainer.style.filter = 'blur(4px)';
        }
    }
}

function configurarMonitoreoEntorno() {
    window.addEventListener('offline', () => {
        console.warn("[Entorno] El terminal ha perdido conectividad de red. Operando en almacenamiento IndexedDB local aislado.");
    });

    window.addEventListener('online', () => {
        console.log("[Entorno] Conectividad de red restablecida.");
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error("[Entorno] Error asíncrono no capturado (Promise Rejection):", event.reason);
    });
}

function notificarFalloEstructural(error) {
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
        mainContainer.innerHTML = `
            <div style="padding: 20px; background: #541616; border: 1px solid #ff4444; color: #fff; margin: 20px; border-radius: 6px;">
                <h3>Error de inicialización del núcleo</h3>
                <p>No se pudo establecer comunicación con las estructuras de datos IndexedDB.</p>
                <code style="background: #000; padding: 5px; display: block; margin-top: 10px;">${error.message}</code>
            </div>
        `;
    }
}