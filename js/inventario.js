document.addEventListener('DOMContentLoaded', () => {
    const tabAbastecer = document.getElementById('sub-abastecer');
    if (tabAbastecer) {
        renderizarFormularioIngreso(tabAbastecer);
    }

    const botonesTabs = document.querySelectorAll('.sub-tab-btn');
    const contenedoresContenido = document.querySelectorAll('.sub-content');

    botonesTabs.forEach(boton => {
        boton.addEventListener('click', () => {
            const idDestino = boton.getAttribute('data-sub');

            botonesTabs.forEach(b => b.classList.remove('active'));
            contenedoresContenido.forEach(c => c.style.display = 'none');

            boton.classList.add('active');

            const contenedorDestino = document.getElementById(idDestino);
            if (contenedorDestino) {
                contenedorDestino.style.display = 'block';
                if (idDestino === 'sub-maestro') {
                    renderizarMaestroProductos(contenedorDestino);
                } else if (idDestino === 'sub-salidas') {
                    renderizarSalidasProductos(contenedorDestino);
                }
            }
        });
    });
});