document.addEventListener('DOMContentLoaded', function () {
    // ========== ELEMENTOS DEL HEADER ==========
    const navbar = document.querySelector('.navbar');
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const closeSidebar = document.querySelector('.close-sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const backBtn = document.getElementById('back-btn');
    const logoLink = document.getElementById('logo-link');

    // ========== SIDEBAR ==========
    function toggleSidebar() {
        if (sidebar) sidebar.classList.toggle('active');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
    }

    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (closeSidebar) closeSidebar.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

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
    const sidebarBtnHome = document.getElementById('sidebar-btn-home');
    if (sidebarBtnHome) {
        sidebarBtnHome.addEventListener('click', function () {
            document.getElementById('home-section')?.classList.add('active-section');
            document.getElementById('terminal-section')?.classList.remove('active-section');
            document.getElementById('cooperative-section')?.classList.remove('active-section');
            if (sidebar) sidebar.classList.remove('active');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        });
    }
});