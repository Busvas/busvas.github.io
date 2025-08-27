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
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    }

    sidebarToggle && sidebarToggle.addEventListener('click', toggleSidebar);
    closeSidebar && closeSidebar.addEventListener('click', toggleSidebar);
    sidebarOverlay && sidebarOverlay.addEventListener('click', toggleSidebar);

    // ========== BOTÓN DE RETROCESO ==========
    backBtn && backBtn.addEventListener('click', function () {
        backBtn.classList.add('clicked');
        setTimeout(() => {
            backBtn.classList.remove('clicked');
        }, 500);

        // Navegación según la sección activa
        if (document.getElementById('cooperative-section')?.classList.contains('active-section')) {
            window.showSection && window.showSection('terminal');
            window.renderProvinceAd && window.renderProvinceAd();
        } else if (document.getElementById('terminal-section')?.classList.contains('active-section')) {
            window.showSection && window.showSection('home');
            window.renderHomeAd && window.renderHomeAd();
        }
    });

    // ========== LOGO CLICK ==========
    logoLink && logoLink.addEventListener('click', function (e) {
        e.preventDefault();
        window.showSection && window.showSection('home');
    });

     // ========== SIDEBAR HOME BUTTON ==========
    const sidebarBtnHome = document.getElementById('sidebar-btn-home');
    sidebarBtnHome && sidebarBtnHome.addEventListener('click', function () {
        document.getElementById('home-section')?.classList.add('active-section');
        document.getElementById('terminal-section')?.classList.remove('active-section');
        document.getElementById('cooperative-section')?.classList.remove('active-section');
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    });
});