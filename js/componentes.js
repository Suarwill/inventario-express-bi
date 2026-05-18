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
                    <li><a href="mod-inv.html" class="nav-link ${paginaActual === 'mod-inv.html' ? 'active' : ''}">📦 Inventario</a></li>
                    <li><a href="mod-bi.html" class="nav-link ${paginaActual === 'mod-bi.html' ? 'active' : ''}">📊 Negocio (BI)</a></li>
                    <li><a href="mod-caja.html" class="nav-link ${paginaActual === 'mod-caja.html' ? 'active' : ''}">💵 Caja</a></li>
                    <li><a href="mod-soporte.html" class="nav-link ${paginaActual === 'mod-soporte.html' ? 'active' : ''}">⚙️ Soporte</a></li>
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