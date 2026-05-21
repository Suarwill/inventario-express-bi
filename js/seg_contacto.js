export function abrirCanalSoporteWhatsApp() {
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

export function abrirCanalSoporteEmail() {
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