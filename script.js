document.addEventListener('DOMContentLoaded', function () {
    /* ========== ELEMENTOS DEL DOM ========== */
    const DOM = {
        navbar: document.querySelector('.navbar'),
        sidebar: document.querySelector('.sidebar'),
        sidebarToggle: document.querySelector('.sidebar-toggle'),
        closeSidebar: document.querySelector('.close-sidebar'),
        sidebarOverlay: document.querySelector('.sidebar-overlay'),
        pathBar: document.querySelector('.path-bar'),
        btnHome: document.getElementById('btn-home'),
        btnProvince: document.getElementById('btn-province'),
        btnTerminal: document.getElementById('btn-terminal'),
        sections: {
            home: document.getElementById('home-section'),
            featured: document.getElementById('featured-section'),
            terminal: document.getElementById('terminal-section'),
            cooperative: document.getElementById('cooperative-section')
        },
        provinceGrid: document.getElementById('province-grid'),
        terminalGrid: document.getElementById('terminal-grid'),
        cooperativeContainer: document.getElementById('cooperative-container'),
        featuredCooperative: document.getElementById('featured-cooperatives'),
        currentProvinceName: document.getElementById('current-province-name'),
        currentTerminalName: document.getElementById('current-terminal-name'),
        provinceListSide: document.getElementById('province-list-side'),
        tooltip: document.getElementById('tooltip')
    };

    /* ========== DATOS DE LA APP ========== */
    const appData = {
        provincias: [],
        currentProvince: null,
        currentTerminal: null,
        ciudadesPrincipales: [],
        anuncio: null
    };

    /* ========== INICIALIZACIÓN ========== */
    init();

    async function init() {
        await loadData();
        setupEventListeners();
        renderProvinces();
        renderFeaturedCooperatives();
        renderHomeAd();
        showSection('home');
    }

    async function loadData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('Error al cargar datos');
            const data = await response.json();

            appData.provincias = data.provincias;
            appData.ciudadesPrincipales = data.ciudades_principales || [];
            appData.anuncio = data.anuncio || null;
        } catch (error) {
            console.error('Error:', error);
            showError('Error al cargar los datos. Por favor recarga la página.');
        }
    }

    /* ========== RENDERIZADO PRINCIPAL ========== */
    function renderProvinces() {
        DOM.provinceGrid.innerHTML = '';
        DOM.provinceListSide.innerHTML = '';

        appData.provincias.forEach(provincia => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="img/provincias/${provincia.id}.png" alt="${provincia.nombre}" class="card-img">
                </div>
                <div class="card-body">
                    <h3 class="card-title">${provincia.nombre}</h3>
                    <p class="card-meta">${provincia.terminales.length} terminales</p>
                </div>
            `;
            card.addEventListener('click', () => selectProvince(provincia));
            DOM.provinceGrid.appendChild(card);

            const li = document.createElement('li');
            li.textContent = provincia.nombre;
            li.addEventListener('click', () => {
                selectProvince(provincia);
                toggleSidebar();
            });
            DOM.provinceListSide.appendChild(li);
        });
    }

    function selectProvince(provincia) {
        appData.currentProvince = provincia;
        DOM.currentProvinceName.textContent = provincia.nombre;
        DOM.btnProvince.textContent = provincia.nombre;
        DOM.btnProvince.disabled = false;
        DOM.btnTerminal.disabled = true;
        DOM.btnTerminal.textContent = 'Terminal';
        renderTerminals();
        renderFeaturedCooperatives();
        renderProvinceAd();
        showSection('terminal');
    }

    function renderTerminals() {
        DOM.terminalGrid.innerHTML = '';

        appData.currentProvince.terminales.forEach(terminal => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="img/provincias/ciudades/${terminal.id}.png" alt="Terminal ${terminal.nombre}" class="card-img">
                </div>
                <div class="card-body">
                    <h3 class="card-title">Terminal ${terminal.nombre}</h3>
                    <p class="card-meta">${terminal.cooperativas.length} cooperativas</p>
                </div>
            `;
            card.addEventListener('click', () => selectTerminal(terminal));
            DOM.terminalGrid.appendChild(card);
        });
    }

    function selectTerminal(terminal) {
        appData.currentTerminal = terminal;
        DOM.currentTerminalName.textContent = `Terminal ${terminal.nombre}`;
        DOM.btnTerminal.textContent = terminal.nombre;
        DOM.btnTerminal.disabled = false;
        renderCooperatives();
        renderTerminalAd();
        navigateTo('cooperative');
    }

    function renderCooperatives() {
        DOM.cooperativeContainer.innerHTML = '';

        appData.currentTerminal.cooperativas.forEach((coop, index) => {
            const card = document.createElement('div');
            card.className = 'cooperative-card';

            const rating = calculateAverageRating(coop.rating_global);

            card.innerHTML = `
                <div class="coop-header" data-index="${index}">
                    <img src="img/terminales/${coop.logo || ''}" alt="${coop.nombre}" class="coop-logo">
                    <div class="coop-info">
                        <h3>${coop.nombre}</h3>
                        <div class="coop-rating-row">
                            <div class="coop-rating" data-rating='${JSON.stringify(coop.rating_global)}'>
                                ${generateStarRating(rating)}
                                <span>${rating.toFixed(1)}</span>
                            </div>
                            <span class="info-icon" data-coop='${JSON.stringify({
                nombre: coop.nombre,
                telefono: coop.telefono || '',
                sitio_web: coop.sitio_web || '',
                servicios: coop.servicios || []
            })}' title="Información de la cooperativa" style="position:relative;">
                                <i class="fas fa-info-circle"></i>
                            </span>
                        </div>
                    </div>
                    <button class="accordion-toggle" aria-expanded="${index === 0}"><</button>
                </div>
                <div class="coop-body" style="display: ${index === 0 ? 'block' : 'none'};">
                    ${renderRoutes(coop.rutas)}
                </div>
            `;

            const ratingEl = card.querySelector('.coop-rating');
            if (ratingEl) {
                ratingEl.addEventListener('mouseenter', showRatingTooltip);
                ratingEl.addEventListener('mouseleave', hideTooltip);
            }

            addTooltipEvents(card);

            DOM.cooperativeContainer.appendChild(card);
        });

        setupAccordionEvents();
        updateToggleButtonState();
    }

    /* ========== COOPERATIVAS DESTACADAS ========== */
    function renderFeaturedCooperatives() {
        DOM.featuredCooperative.innerHTML = '';

        const allCooperatives = [];
        appData.provincias.forEach(provincia => {
            provincia.terminales.forEach(terminal => {
                terminal.cooperativas.forEach(coop => {
                    const mainRoutes = coop.rutas && coop.rutas.length > 0 ? coop.rutas : [];
                    if (mainRoutes.length > 0) {
                        allCooperatives.push({
                            ...coop,
                            terminal: terminal.nombre,
                            provincia: provincia.nombre,
                            mainRoutes,
                            rating: calculateAverageRating(coop.rating_global)
                        });
                    }
                });
            });
        });

        const topCooperatives = allCooperatives
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 3);

        if (topCooperatives.length === 0) {
            DOM.featuredCooperative.innerHTML = '<div style="padding:1rem;">No hay cooperativas destacadas disponibles.</div>';
            return;
        }

        topCooperatives.forEach((coop, index) => {
            const card = document.createElement('div');
            card.className = 'featured-card';

            card.innerHTML = `
                <div class="featured-card-header">
                    ${index === 0 ? '<span class="featured-badge">TOP 1</span>' : ''}
                    <div class="featured-coop-info">
                        <img src="img/terminales/${coop.logo || ''}" class="featured-coop-logo" onerror="this.src=''">
                        <div>
                            <h3>${coop.nombre}</h3>
                            <div class="coop-rating" data-rating='${JSON.stringify(coop.rating_global)}'>
                                ${generateStarRating(coop.rating)}
                                <span>${coop.rating.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="featured-routes">
                    ${coop.mainRoutes.slice(0, 3).map(route => `
                        <div class="featured-route">
                            <div class="route-direction">
                                <span class="route-city">${coop.terminal}</span>
                                <i class="fas fa-arrow-right route-arrow"></i>
                                <span class="route-city">${route.destino}</span>
                            </div>
                            <div class="route-meta">
                                <span>${route.horarios ? route.horarios.slice(0, 15).join(' - ') : ''}</span>
                                <span>${route.costo ? '$' + route.costo : ''}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            const ratingEl = card.querySelector('.coop-rating');
            if (ratingEl) {
                ratingEl.addEventListener('mouseenter', showRatingTooltip);
                ratingEl.addEventListener('mouseleave', hideTooltip);
            }

            addTooltipEvents(card);
            DOM.featuredCooperative.appendChild(card);
        });
    }

    /* ========== FUNCIONES AUXILIARES ========== */
    function renderRoutes(rutas) {
        return rutas.map(ruta => `
            <div class="route">
                <div class="route-title">
                    <span class="origin">${appData.currentTerminal ? appData.currentTerminal.nombre : ''}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span class="destination">${ruta.destino}</span>
                </div>
                <div class="route-schedule">
                    ${ruta.horarios.map(h => `<span class="time">${h}</span>`).join('')}
                </div>
                ${ruta.costo ? `<div class="route-price">$${ruta.costo}</div>` : ''}
            </div>
        `).join('');
    }

    function calculateAverageRating(ratingObj) {
        if (!ratingObj) return 0;
        const values = Object.values(ratingObj);
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }

    function generateStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let stars = '';

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) stars += '★';
            else if (i === fullStars && hasHalfStar) stars += '☆';
            else stars += '☆';
        }

        return stars;
    }

    /* ========== TOOLTIPS ========== */
    function addTooltipEvents(element) {
        const infoIcons = element.querySelectorAll('.info-icon');
        infoIcons.forEach(icon => {
            icon.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleInfoModal(icon);
            });
        });
    }

    function toggleInfoModal(target) {
        const infoIcon = target.closest('.info-icon');
        if (!infoIcon) return;

        const existingModal = infoIcon.querySelector('.info-modal');
        if (existingModal) {
            existingModal.remove();
            return;
        }

        document.querySelectorAll('.info-modal').forEach(m => m.remove());

        const coopData = JSON.parse(infoIcon.dataset.coop);
        let modal = document.createElement('div');
        modal.className = 'info-modal';
        modal.innerHTML = `
            <strong>${coopData.nombre}</strong><br>
            ${coopData.telefono ? `<p><strong>Teléfono:</strong> <span class="copy-phone" style="cursor:pointer;color:#234f9e;">${coopData.telefono}</span></p>` : ''}
            ${coopData.sitio_web ? `<p><strong>Sitio web:</strong> <a href="${coopData.sitio_web}" target="_blank" style="color:#234f9e;">${coopData.sitio_web}</a></p>` : ''}
            ${coopData.servicios && coopData.servicios.length > 0 ? `<p><strong>Servicios:</strong> ${coopData.servicios.join(', ')}</p>` : ''}
        `;
        modal.querySelectorAll('.copy-phone').forEach(span => {
            span.addEventListener('click', function (e) {
                e.stopPropagation();
                navigator.clipboard.writeText(span.textContent);
                span.style.background = "#e0f7fa";
            });
        });

        infoIcon.appendChild(modal);
    }

    document.addEventListener('click', function (e) {
        document.querySelectorAll('.info-modal').forEach(modal => {
            if (!modal.contains(e.target)) {
                modal.remove();
            }
        });
    });

    function showRatingTooltip(e) {
        const ratingData = JSON.parse(e.target.closest('.coop-rating').dataset.rating);
        if (!ratingData) return;

        let tooltipContent = '<div style="text-align: center; padding: 0.5rem;">';
        tooltipContent += '<strong>Puntuación</strong><br>';

        for (const [category, value] of Object.entries(ratingData)) {
            tooltipContent += `${capitalizeFirstLetter(category)}: ${value.toFixed(1)}<br>`;
        }

        tooltipContent += '</div>';

        showTooltip(e.target, tooltipContent, 'top');
    }

    function showTooltip(element, content, position = 'top') {
        if (!DOM.tooltip) return;

        DOM.tooltip.innerHTML = content;
        DOM.tooltip.className = `tooltip ${position}`;
        DOM.tooltip.style.opacity = '1';

        const rect = element.getBoundingClientRect();
        const tooltipHeight = DOM.tooltip.offsetHeight;
        const tooltipWidth = DOM.tooltip.offsetWidth;

        switch (position) {
            case 'top':
                DOM.tooltip.style.left = `${rect.left + rect.width / 2 - tooltipWidth / 2}px`;
                DOM.tooltip.style.top = `${rect.top + window.scrollY - tooltipHeight - 10}px`;
                break;
            case 'bottom':
                DOM.tooltip.style.left = `${rect.left + rect.width / 2 - tooltipWidth / 2}px`;
                DOM.tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
                break;
            case 'left':
                DOM.tooltip.style.left = `${rect.left + window.scrollX - tooltipWidth - 10}px`;
                DOM.tooltip.style.top = `${rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2}px`;
                break;
            case 'right':
                DOM.tooltip.style.left = `${rect.right + window.scrollX + 10}px`;
                DOM.tooltip.style.top = `${rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2}px`;
                break;
        }
    }

    function hideTooltip() {
        if (DOM.tooltip) {
            DOM.tooltip.style.opacity = '0';
        }
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /* ========== CONTROL DE SECCIONES ========== */
    function showSection(sectionName) {
        Object.values(DOM.sections).forEach(section => {
            section.classList.remove('active-section');
        });

        DOM.sections[sectionName].classList.add('active-section');

        if (sectionName === 'terminal') {
            DOM.sections.featured.classList.add('active-section');
        }
    }

    /* ========== EVENT LISTENERS ========== */
    function setupEventListeners() {
        DOM.sidebarToggle.addEventListener('click', toggleSidebar);
        DOM.closeSidebar.addEventListener('click', toggleSidebar);
        DOM.sidebarOverlay.addEventListener('click', toggleSidebar);

        DOM.btnHome.addEventListener('click', () => {
            resetNavigation();
            renderHomeAd();
            navigateTo('home');
        });

        DOM.btnProvince.addEventListener('click', () => {
            renderProvinceAd();
            navigateTo('terminal');
        });

        DOM.btnTerminal.addEventListener('click', () => {
            if (appData.currentTerminal) {
                renderCooperatives();
                renderTerminalAd();
                navigateTo('cooperative');
            }
        });

        const logoLink = document.getElementById('logo-link');
        if (logoLink) {
            logoLink.addEventListener('click', function (e) {
                e.preventDefault();
                renderHomeAd();
                showSection('home');
            });
        }

        const toggleAllBtn = document.getElementById('toggle-all');
        if (toggleAllBtn) {
            toggleAllBtn.addEventListener('click', function () {
                toggleAllAccordions();
            });
        }

        document.getElementById('sidebar-btn-home').addEventListener('click', function() {
            // Muestra la sección principal (home)
            document.getElementById('home-section').classList.add('active-section');
            document.getElementById('terminal-section').classList.remove('active-section');
            document.getElementById('cooperative-section').classList.remove('active-section');
            // Cierra el sidebar
            document.querySelector('.sidebar').classList.remove('active');
            document.querySelector('.sidebar-overlay').classList.remove('active');
        });
    }

    /* ========== FUNCIONES UTILITARIAS ========== */
    function toggleSidebar() {
        DOM.sidebar.classList.toggle('active');
        DOM.sidebarOverlay.classList.toggle('active');
    }

    function resetNavigation() {
        DOM.btnProvince.disabled = true;
        DOM.btnTerminal.disabled = true;
        DOM.btnProvince.textContent = 'Provincia';
        DOM.btnTerminal.textContent = 'Terminal';
        appData.currentProvince = null;
        appData.currentTerminal = null;
    }

    function showError(message) {
        DOM.provinceGrid.innerHTML = `
        <div class="error">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
        </div>
    `;
    }

    function setupAccordionEvents() {
        const allHeaders = DOM.cooperativeContainer.querySelectorAll('.coop-header');
        allHeaders.forEach(header => {
            header.addEventListener('click', function (e) {
                if (
                    e.target.closest('.info-icon') ||
                    e.target.closest('.coop-rating') ||
                    e.target.closest('button') ||
                    e.target.closest('a')
                ) {
                    return;
                }
                const body = header.nextElementSibling;
                if (!body) return;
                const expanded = header.querySelector('.accordion-toggle').getAttribute('aria-expanded') === 'true';
                header.querySelector('.accordion-toggle').setAttribute('aria-expanded', !expanded);
                body.style.display = expanded ? 'none' : 'block';
            });
        });
    }

    function navigateTo(section) {
        showSection(section);
        history.pushState({ section }, "", `#${section}`);
    }

    window.addEventListener("popstate", (event) => {
        if (event.state && event.state.section) {
            showSection(event.state.section);
        } else {
            showSection('home');
        }
    });

    window.addEventListener("load", () => {
        const hash = window.location.hash.substring(1);
        if (hash === 'cooperative' && appData.currentTerminal) {
            renderCooperatives();
        }
        showSection(hash || 'home');
    });

    /* ========== ACCORDION TOGGLE ========== */
    function updateToggleButtonState() {
        const allToggles = document.querySelectorAll('.accordion-toggle');
        if (!allToggles.length) return;

        allToggles.forEach(toggle => {
            const body = toggle.closest('.coop-header').nextElementSibling;
            if (!body) return;
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.textContent = expanded ? '<' : '>';
        });

        const toggleAllBtn = document.getElementById('toggle-all');
        if (toggleAllBtn) {
            const anyOpen = Array.from(allToggles).some(toggle => toggle.getAttribute('aria-expanded') === 'true');
            toggleAllBtn.textContent = anyOpen ? 'MOSTRAR' : 'OCULTAR';
        }
    }

    function toggleAllAccordions() {
        const allToggles = document.querySelectorAll('.accordion-toggle');
        if (!allToggles.length) return;

        const shouldOpen = Array.from(allToggles).some(toggle => toggle.getAttribute('aria-expanded') === 'false');

        allToggles.forEach(toggle => {
            const body = toggle.closest('.coop-header').nextElementSibling;
            if (!body) return;
            toggle.setAttribute('aria-expanded', shouldOpen);
            body.style.display = shouldOpen ? 'block' : 'none';
            toggle.textContent = shouldOpen ? '<' : '>';
        });

        const toggleAllBtn = document.getElementById('toggle-all');
        if (toggleAllBtn) {
            toggleAllBtn.textContent = shouldOpen ? 'OCULTAR' : 'MOSTRAR';
        }
    }

    /* ========== ANUNCIOS ========== */
    function renderAds(type, anuncio) {
        let container;
        if (type === 'cooperative') {
            container = document.getElementById('cooperative-ads');
        } else if (type === 'terminal') {
            container = document.getElementById('terminal-ads');
        } else if (type === 'province') {
            container = document.getElementById('province-ads');
        }
        if (!container) return;
        container.innerHTML = '';
        if (anuncio) {
            container.innerHTML = `
                <a href="${anuncio.link}" target="_blank">
                    <img src="${anuncio.imagen}" alt="Anuncio" style="width:100%;max-width:400px;">
                </a>
            `;
        }
    }

    // Renderizar anuncio en HOME
    function renderHomeAd() {
        renderAds('province', appData.anuncio);
    }

    // Renderizar anuncio en pantalla de provincia
    function renderProvinceAd() {
        if (appData.currentProvince && appData.currentProvince.anuncio) {
            renderAds('terminal', appData.currentProvince.anuncio);
        } else {
            renderAds('terminal', null);
        }
    }

    // Renderizar anuncio en pantalla de terminal
    function renderTerminalAd() {
        if (appData.currentTerminal && appData.currentTerminal.anuncio) {
            renderAds('cooperative', appData.currentTerminal.anuncio);
        } else {
            renderAds('cooperative', null);
        }
    }

    function getAnuncio(obj) {
        // Si existe el anuncio en el objeto, úsalo
        if (obj && obj.anuncio) return obj.anuncio;
        // Si no existe, usa el anuncio principal del home
        return appData.anuncio;
    }

    // Ejemplo de uso en renderizado:
    function renderHomeAd() {
        renderAds('province', getAnuncio(appData));
    }

    function renderProvinceAd() {
        renderAds('terminal', getAnuncio(appData.currentProvince));
    }

    function renderTerminalAd() {
        renderAds('cooperative', getAnuncio(appData.currentTerminal));
    }







});
