class MainHeader extends HTMLElement {
    connectedCallback() {
        const paginaActual = window.location.pathname.split('/').pop() || 'index.html';

        this.innerHTML = `
        <header>
            <div class="logo-area">
                <h2>FrausTech <span>BI Local</span></h2>
            </div>
            <nav>
                <ul>
                    <li><a href="index.html" class="nav-link ${paginaActual === 'index.html' ? 'active' : ''}">🛒 Ventas</a></li>
                    <li><a href="inventario.html" class="nav-link ${paginaActual === 'inventario.html' ? 'active' : ''}">📦 Inventario</a></li>
                    <li><a href="bi.html" class="nav-link ${paginaActual === 'bi.html' ? 'active' : ''}">📊 Negocio (BI)</a></li>
                    <li><a href="caja.html" class="nav-link ${paginaActual === 'caja.html' ? 'active' : ''}">💵 Caja</a></li>
                    <li><a href="soporte.html" class="nav-link ${paginaActual === 'soporte.html' ? 'active' : ''}">⚙️ Soporte</a></li>
                </ul>
            </nav>
        </header>
        `;
    }
}

class MainFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <footer>
            <p>&copy; FrausTech - Sistema de Gestión Comercial Local</p>
        </footer>
        `;
    }
}

customElements.define('main-header', MainHeader);
customElements.define('main-footer', MainFooter);