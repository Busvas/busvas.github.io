document.addEventListener('DOMContentLoaded', function () {
    // ========== ELEMENTOS DEL HEADER ==========
    const navbar = document.querySelector('.navbar');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const closeSidebar = document.querySelector('.close-sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const backBtn = document.getElementById('back-btn');
    const logoLink = document.getElementById('logo-link');
    const sidebarBtnHome = document.getElementById('sidebar-btn-home');
    const provinceListSide = document.getElementById('province-list-side');

    // ========== SIDEBAR ==========
    function openSidebar() {
        if (sidebar) sidebar.classList.add('active');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
    }
    function closeSidebarFn() {
        if (sidebar) sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
    function toggleSidebar() {
        if (sidebar) sidebar.classList.toggle('active');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
    }

    if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
    if (closeSidebar) closeSidebar.addEventListener('click', closeSidebarFn);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarFn);

    // ========== BOTÓN DE RETROCESO ==========
    if (backBtn) {
        backBtn.addEventListener('click', function () {
            backBtn.classList.add('clicked');
            setTimeout(() => backBtn.classList.remove('clicked'), 500);

            // Navegación según la sección activa
            if (document.getElementById('cooperative-section')?.classList.contains('active-section')) {
                window.showSection && window.showSection('terminal');
                window.renderProvinceAd && window.renderProvinceAd();
            } else if (document.getElementById('terminal-section')?.classList.contains('active-section')) {
                window.showSection && window.showSection('home');
                window.renderHomeAd && window.renderHomeAd();
            } else {
                // fallback: usar history.back() si no hay sección activa conocida
                try { history.back(); } catch (e) {}
            }
        });
    }

    // ========== LOGO CLICK ==========
    if (logoLink) {
        logoLink.addEventListener('click', function (e) {
            e.preventDefault();
            window.showSection && window.showSection('home');
        });
    }

    // ========== SIDEBAR HOME BUTTON ==========
    if (sidebarBtnHome) {
        sidebarBtnHome.addEventListener('click', function () {
            window.showSection && window.showSection('home');
            closeSidebarFn();
        });
    }

    // ========== PROVINCIAS EN SIDEBAR ==========
    function renderSidebarProvinces() {
        const ul = document.getElementById('province-list-side');
        if (!ul) return;
        ul.innerHTML = '';
        if (!window.appData || !Array.isArray(window.appData.provincias)) return;
        window.appData.provincias.forEach(prov => {
            const li = document.createElement('li');
            li.textContent = prov.nombre;
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
                window.selectProvince && window.selectProvince(prov);
                closeSidebarFn();
            });
            ul.appendChild(li);
        });
    }
    window.renderSidebarProvinces = renderSidebarProvinces;

    // Llama a renderSidebarProvinces cuando se cargan las provincias
    if (window.appData && Array.isArray(window.appData.provincias) && window.appData.provincias.length) {
        renderSidebarProvinces();
    } else {
        // Si las provincias se cargan asincrónicamente, escucha el evento o usa un pequeño delay
        setTimeout(renderSidebarProvinces, 800);
    }

    // Si tu app recarga provincias dinámicamente, puedes exponer la función:
    window.renderSidebarProvinces = renderSidebarProvinces;
});