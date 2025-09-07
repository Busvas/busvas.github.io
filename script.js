document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // ========== DOM ==========
    const DOM = {
        provinceGrid: document.getElementById('province-grid'),
        terminalGrid: document.getElementById('terminal-grid'),
        cooperativeContainer: document.getElementById('cooperative-container'),
        provinceListSide: document.getElementById('province-list-side'),
        currentProvinceName: document.getElementById('current-province-name'),
        currentTerminalName: document.getElementById('current-terminal-name'),
        btnHome: document.getElementById('btn-home'),
        btnProvince: document.getElementById('btn-province'),
        btnTerminal: document.getElementById('btn-terminal'),
        tooltip: document.getElementById('tooltip'),
        toggleAllBtn: document.getElementById('toggle-all')
    };
    window.DOM = window.DOM || DOM;

    // ========== APP STATE ==========
    const appData = window.appData || {
        provincias: [],
        currentProvince: null,
        currentTerminal: null,
        ciudadesPrincipales: [],
        anuncio: null,
        cooperativas: {}  // Añadido para coop.json
    };
    window.appData = appData;

    // ========== HELPERS ==========
    function safeParse(json) {
        try { return JSON.parse(json); } catch { return null; }
    }
    function calculateAverageRating(obj) {
        if (!obj || typeof obj !== 'object') return 0;
        const vals = Object.values(obj).filter(v => typeof v === 'number');
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    function generateStarRating(r) {
        const full = Math.floor(r);
        const half = r - full >= 0.5;
        let out = '';
        for (let i = 0; i < 5; i++) {
            if (i < full) out += '★';
            else if (i === full && half) out += '☆';
            else out += '☆';
        }
        return out;
    }

    // ========== RENDER: PROVINCES ==========
    function renderProvinces() {
        const grid = DOM.provinceGrid;
        if (!grid) return;
        grid.innerHTML = '';
        if (DOM.provinceListSide) DOM.provinceListSide.innerHTML = '';

        if (!Array.isArray(appData.provincias) || appData.provincias.length === 0) {
            grid.innerHTML = '<div class="error">No hay provincias disponibles.</div>';
            return;
        }

        appData.provincias.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="img/provincias/${p.id}.png" alt="${p.nombre}" class="card-img"
                         onerror="this.onerror=null;this.src='img/provincias/default.png'">
                </div>
                <div class="card-body">
                    <h3 class="card-title">${p.nombre}</h3>
                    <p class="card-meta">${(p.terminales || []).length} terminales</p>
                </div>
            `;
            card.addEventListener('click', () => selectProvince(p));
            grid.appendChild(card);

            if (DOM.provinceListSide) {
                const li = document.createElement('li');
                li.textContent = p.nombre;
                li.addEventListener('click', () => selectProvince(p));
                DOM.provinceListSide.appendChild(li);
            }
        });

        // attempt to render ads if any
        scheduleAdsRender();
    }

    // ========== SELECT PROVINCE / TERMINALS ==========
    function selectProvince(prov) {
        appData.currentProvince = prov;
        if (DOM.currentProvinceName) DOM.currentProvinceName.textContent = prov.nombre;
        if (DOM.btnProvince) { DOM.btnProvince.textContent = prov.nombre; DOM.btnProvince.disabled = false; }
        if (DOM.btnTerminal) { DOM.btnTerminal.disabled = true; DOM.btnTerminal.textContent = 'Terminal'; }
        renderTerminals();
        // Remueve la llamada directa: try { window.renderProvinceAd && window.renderProvinceAd(); } catch (e) {}
        scheduleAdsRender();
        showSection('terminal');
    }

    function renderTerminals() {
        const grid = DOM.terminalGrid;
        if (!grid) return;
        grid.innerHTML = '';
        const province = appData.currentProvince;
        if (!province || !Array.isArray(province.terminales)) {
            grid.innerHTML = '<div class="error">No hay terminales.</div>';
            return;
        }
        province.terminales.forEach(t => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-img-container">
                    <div class="card-rounded-container">
                        <img src="img/provincias/ciudades/${t.id}.png" alt="${t.nombre}" class="card-img-rounded"
                             onerror="this.onerror=null;this.src='img/provincias/ciudades/default.png'">
                    </div>
                </div>
                <div class="card-body">
                    <h3 class="card-title">Terminal ${t.nombre}</h3>
                    <p class="card-meta">${(t.cooperativas || []).length} cooperativas</p>
                </div>
            `;
            card.addEventListener('click', () => selectTerminal(t));
            grid.appendChild(card);
        });

        // Remueve la llamada directa: try { window.renderTerminalAd && window.renderTerminalAd(); } catch (e) {}
        scheduleAdsRender();
    }
    window.renderTerminals = renderTerminals;

    // ========== SELECT TERMINAL / COOPERATIVAS ==========
    function selectTerminal(t) {
        console.log('selectTerminal: Seleccionando terminal', t);
        if (!t) {
            console.error('selectTerminal: Terminal no válida');
            return;
        }
        appData.currentTerminal = t;
        console.log('selectTerminal: currentTerminal asignado', appData.currentTerminal);
        console.log('selectTerminal: Cooperativas en terminal', t.cooperativas);

        if (DOM.currentTerminalName) DOM.currentTerminalName.textContent = `Terminal ${t.nombre}`;
        if (DOM.btnTerminal) { DOM.btnTerminal.textContent = t.nombre; DOM.btnTerminal.disabled = false; }
        renderCooperatives();
        // Remueve la llamada directa: try { window.renderTerminalAd && window.renderTerminalAd(); } catch (e) {}
        scheduleAdsRender();
        showSection('cooperative');
    }

    function renderCooperatives() {
        console.log('renderCooperatives: Iniciando');
        const container = DOM.cooperativeContainer;
        if (!container) {
            console.error('renderCooperatives: Container #cooperative-container no encontrado');
            return;
        }
        container.innerHTML = '';
        const terminal = appData.currentTerminal;
        console.log('renderCooperativas: Terminal actual', terminal);
        if (!terminal || !Array.isArray(terminal.cooperativas)) {
            console.warn('renderCooperativas: No hay cooperativas o terminal inválida', terminal);
            container.innerHTML = '<div class="error">No hay cooperativas.</div>';
            return;
        }
        console.log('renderCooperativas: Número de cooperativas', terminal.cooperativas.length);

        terminal.cooperativas.forEach((coop, idx) => {
            console.log('renderCooperativas: Procesando cooperativa', idx, coop.nombre);

            // Cambia esta verificación
            const coopGeneral = appData.cooperativas[coop.id] || {};
            if (!coopGeneral.nombre && !coop.nombre) {
                console.warn('renderCooperativas: Cooperativa sin nombre en coop.json ni data.json', coop);
                return;
            }

            // El resto del código ya usa coopGeneral.nombre || coop.nombre || 'Cooperativa', así que está bien
            const rating = calculateAverageRating(coopGeneral.rating_global || {});

            const logoSrc = `img/terminales/${coop.id}.png`;  // Usa el ID completo (ej. c-riobamba.png)
            const card = document.createElement('div');
            card.className = 'cooperative-card';
            card.innerHTML = `
                <div class="coop-header" data-index="${idx}">
                    <img src="${logoSrc}" alt="${coopGeneral.nombre || 'Cooperativa'}" class="coop-logo"
                         onerror="this.onerror=null;this.src='./img/terminales/default.png'">
                    <div class="coop-info">
                        <h3>${coopGeneral.nombre || coop.nombre || 'Cooperativa'}</h3>
                        <div class="coop-rating-row">
                            <div class="coop-rating" data-rating='${JSON.stringify(coopGeneral.rating_global || {})}'>
                                ${generateStarRating(rating)} <span>${rating.toFixed(1)}</span>
                            </div>
                            <!-- Botón para toggle del contenedor de info, inicialmente oculto excepto en la primera -->
                            <button class="info-btn" type="button" style="display: ${idx === 0 ? 'flex' : 'none'};">
                                <i class="fas fa-info-circle"></i>
                            </button>
                        </div>
                    </div>
                    <button class="accordion-toggle" aria-expanded="${idx === 0}">${idx === 0 ? '−' : '+'}</button>
                </div>
                <!-- Contenedor de info oculto -->
                <div class="info-container" style="display: none;">
                    ${buildInfoHTML(coop, coopGeneral)}
                </div>
                <div class="coop-body" style="display:${idx === 0 ? 'block' : 'none'};">
                    ${renderRoutes(coop.rutas || [], coopGeneral.nombre, terminal.nombre)}
                </div>
            `;
            container.appendChild(card);
        });

        // Adjunta eventos
        addTooltipEventsToContainer(container);
        setupAccordionEvents();
        attachTimeClickHandlers(container);
        attachInfoBtnEvents(container); // Para el botón de info

        // attempt coop ad render
        try { window.renderCooperativeAd && window.renderCooperativeAd(); } catch (e) { }
        scheduleAdsRender();
    }
    window.renderCooperatives = renderCooperatives;

    // ========== FUNCIÓN PARA CONSTRUIR HTML DEL MODAL DE INFO ==========
    function buildInfoHTML(coop, coopGeneral) {
        let html = '';

        // 1. Teléfonos: Gerencia (de coop.json), Boletería/Encomiendas (de data.json)
        // En buildInfoHTML
        if (coopGeneral.telefono_gerencia) {
            html += `<div class="info-row"><i class="fas fa-phone"></i> <strong>Gerencia:</strong> <a href="tel:${coopGeneral.telefono_gerencia}" style="color: #007bff; text-decoration: none;">${coopGeneral.telefono_gerencia}</a></div>`;
        }
        if (coop.telefonos && coop.telefonos.boleteria) {
            html += `<div class="info-row"><i class="fas fa-ticket-alt"></i> <strong>Boletería:</strong> <a href="tel:${coop.telefonos.boleteria}" style="color: #007bff; text-decoration: none;">${coop.telefonos.boleteria}</a></div>`;
        }
        if (coop.telefonos && coop.telefonos.encomiendas) {
            html += `<div class="info-row"><i class="fas fa-box"></i> <strong>Encomiendas:</strong> <a href="tel:${coop.telefonos.encomiendas}" style="color: #007bff; text-decoration: none;">${coop.telefonos.encomiendas}</a></div>`;
        }

        // 2. Redes sociales y web: Íconos en fila (de coop.json)
        if (coopGeneral.redes) {
            const redesMap = {
                facebook: { icon: 'fab fa-facebook', label: 'Facebook' },
                instagram: { icon: 'fab fa-instagram', label: 'Instagram' },
                web: { icon: 'fas fa-globe', label: 'Sitio Web' },
                youtube: { icon: 'fab fa-youtube', label: 'YouTube' },
                tiktok: { icon: 'fab fa-tiktok', label: 'TikTok' }
            };
            html += '<div class="info-row redes">';
            Object.keys(coopGeneral.redes).forEach(key => {
                if (redesMap[key]) {
                    html += `<a href="${coopGeneral.redes[key]}" target="_blank" title="${redesMap[key].label}" style="margin: 0 5px; color: #007bff; text-decoration: none;"><i class="${redesMap[key].icon}"></i></a>`;
                }
            });
            html += '</div>';
        }

        // 3. Servicios: Igual (de data.json)
        if (coopGeneral.servicios && Array.isArray(coopGeneral.servicios) && coopGeneral.servicios.length > 0) {
            html += `<div class="info-row"><strong>Servicios:</strong> ${coopGeneral.servicios.join(', ')}</div>`;
        }

        return html;
    }

    // ========== ROUTES ==========
    function renderRoutes(rutas, coopNombre, terminalNombre) {
        if (!Array.isArray(rutas) || rutas.length === 0) return '<div class="no-routes">No hay rutas disponibles.</div>';
        return rutas.map(r => {
            const horarios = Array.isArray(r.horarios) ? r.horarios : [];
            return `
                <div class="route">
                    <div class="route-title">
                        <span class="origin">${terminalNombre || ''}</span>
                        <i class="fas fa-arrow-right"></i>
                        <span class="destination">${r.destino || ''}</span>
                    </div>
                    <div class="route-schedule">
                        ${horarios.map(h => `<span class="time"
                            data-coop="${coopNombre || ''}"
                            data-origen="${terminalNombre || ''}"
                            data-destino="${r.destino || ''}"
                            data-hora="${h}"
                            data-precio="${r.costo || ''}">${h}</span>`).join('')}
                    </div>
                    ${r.costo ? `<div class="route-price">$${r.costo}</div>` : ''}
                </div>
            `;
        }).join('');
    }
    window.renderRoutes = renderRoutes;

    // ========== TOOLTIP HELPERS ==========
    function addTooltipEventsToContainer(container) {
        if (!container) return;
        const icons = container.querySelectorAll('.info-icon');
        console.log('addTooltipEventsToContainer: Adjuntando eventos a', icons.length, 'icons');
        icons.forEach(icon => {
            // Evento para hover (desktop)
            icon.addEventListener('mouseenter', (e) => {
                const info = icon.getAttribute('title') || '';
                console.log('Tooltip mostrado para:', info);
                showTooltip(info, e.pageX, e.pageY);
            });
            icon.addEventListener('mouseleave', () => {
                console.log('Tooltip ocultado');
                hideTooltip();
            });
            // Evento para click (móviles/touch)
            icon.addEventListener('click', (e) => {
                e.preventDefault(); // Evita comportamiento por defecto
                const info = icon.getAttribute('title') || '';
                console.log('Tooltip mostrado por click para:', info);
                showTooltip(info, e.pageX, e.pageY);
            });
        });
    }
    function showTooltip(content, x, y) {
        console.log('showTooltip: Mostrando tooltip con contenido:', content);
        if (!DOM.tooltip) {
            console.error('showTooltip: #tooltip no encontrado en DOM');
            return;
        }
        DOM.tooltip.textContent = content;
        DOM.tooltip.style.left = `${x + 10}px`;
        DOM.tooltip.style.top = `${y + 10}px`;
        DOM.tooltip.style.display = 'block';
        DOM.tooltip.style.display = '1';
        console.log('showTooltip: Tooltip mostrado en posición', x, y);
    }
    function hideTooltip() {
        const t = DOM.tooltip;
        if (!t) return;
        t.style.display = 'none';
    }
    window.addTooltipEvents = addTooltipEventsToContainer;

    // ========== ACCORDION ==========
    function setupAccordionEvents() {
        const container = DOM.cooperativeContainer;
        if (!container) return;
        container.querySelectorAll('.coop-header').forEach(header => {
            // remove old handler if present
            try { header.removeEventListener('click', header._accordionHandler); } catch (e) { }
            const handler = function (e) {
                // ignore clicks on interactive inner elements
                if (e.target.closest('.info-btn') || e.target.closest('.coop-rating') || e.target.closest('a')) return;
                // allow toggle button clicks (they have their own handler)
                if (e.target.closest('.accordion-toggle')) return;
                const toggleBtn = header.querySelector('.accordion-toggle');
                const body = header.nextElementSibling.nextElementSibling; // coop-body está después de info-container
                if (!body || !toggleBtn) return;
                const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
                const newState = !isExpanded;
                toggleBtn.setAttribute('aria-expanded', newState.toString());
                toggleBtn.innerHTML = newState ? '−' : '+';
                body.style.display = newState ? 'block' : 'none';
                // Actualiza display del botón de info
                const infoBtn = header.querySelector('.info-btn');
                if (infoBtn) infoBtn.style.display = newState ? 'flex' : 'none';
                // Si se cierra, también cierra el contenedor de info
                if (!newState) {
                    const infoContainer = header.nextElementSibling; // info-container es el siguiente sibling
                    if (infoContainer) infoContainer.style.display = 'none';
                }
            };
            header.addEventListener('click', handler);
            header._accordionHandler = handler;

            // explicit toggle button
            const tb = header.querySelector('.accordion-toggle');
            if (tb) {
                try { tb.removeEventListener('click', tb._clickHandler); } catch (e) { }
                const btnHandler = function (ev) {
                    ev.stopPropagation();
                    const body = tb.closest('.cooperative-card').querySelector('.coop-body');
                    if (!body) return;
                    const isExpanded = body.style.display === 'block'; // Usa el estado visual en lugar de aria-expanded
                    const newState = !isExpanded;
                    tb.setAttribute('aria-expanded', newState.toString());
                    tb.innerHTML = newState ? '−' : '+';
                    body.style.display = newState ? 'block' : 'none';
                    // Actualiza display del botón de info
                    const infoBtn = tb.closest('.coop-header').querySelector('.info-btn');
                    if (infoBtn) infoBtn.style.display = newState ? 'flex' : 'none';
                    // Si se cierra, también cierra el contenedor de info
                    if (!newState) {
                        const infoContainer = tb.closest('.cooperative-card').querySelector('.info-container');
                        if (infoContainer) infoContainer.style.display = 'none';
                    }
                };
                tb.addEventListener('click', btnHandler);
                tb._clickHandler = btnHandler;
            }
        });
        updateToggleButtonState();
    }
    window.setupAccordionEvents = setupAccordionEvents;

    function updateToggleButtonState() {
        const container = DOM.cooperativeContainer;
        if (!container) return;
        container.querySelectorAll('.coop-header').forEach(h => {
            const body = h.nextElementSibling;
            const tb = h.querySelector('.accordion-toggle');
            if (!tb || !body) return;
            const open = body.style.display === 'block';
            tb.setAttribute('aria-expanded', open.toString());
            tb.innerHTML = open ? '−' : '+';
        });
    }
    window.updateToggleButtonState = updateToggleButtonState;

    function toggleAllAccordions() {
        const container = DOM.cooperativeContainer;
        if (!container) return;
        const bodies = container.querySelectorAll('.coop-body');
        const anyClosed = Array.from(bodies).some(b => b.style.display !== 'block');
        bodies.forEach(b => b.style.display = anyClosed ? 'block' : 'none');
        updateToggleButtonState();
    }
    window.toggleAllAccordions = toggleAllAccordions;

    // ========== FAVORITES BRIDGE ==========
    function addFavoriteRoute(route) {
        const r = route && typeof route === 'object' ? route : {};
        // prefer direct implementation in favoritos.js
        if (typeof window.addFavoriteRouteImpl === 'function') {
            try { return window.addFavoriteRouteImpl(r); } catch (e) { console.error('addFavoriteRouteImpl', e); }
        }
        // otherwise dispatch event that favoritos.js can listen to
        try { window.dispatchEvent(new CustomEvent('favorite:add', { detail: r })); } catch (e) { }
        // try to open favorites modal via exposed function
        if (typeof window.showFavoritesModal === 'function') {
            try { window.showFavoritesModal(); } catch (e) { }
        } else {
            try { window.dispatchEvent(new Event('favorite:open')); } catch (e) { }
        }
    }
    window.addFavoriteRoute = addFavoriteRoute;

    function attachTimeClickHandlers(container) {
        if (!container) return;
        container.querySelectorAll('.time').forEach(el => {
            try { el.removeEventListener('click', el._timeHandler); } catch (e) { }
            const handler = function () {
                const fav = {
                    coop: el.dataset.coop || el.getAttribute('data-coop') || '',
                    origen: el.dataset.origen || el.getAttribute('data-origen') || '',
                    destino: el.dataset.destino || el.getAttribute('data-destino') || '',
                    hora: el.dataset.hora || el.getAttribute('data-hora') || '',
                    precio: el.dataset.precio || el.getAttribute('data-precio') || ''
                };
                addFavoriteRoute(fav);
            };
            el.addEventListener('click', handler);
            el._timeHandler = handler;
        });
    }

    // ========== NAV / EVENTS ==========
    function showSection(name) {
        console.log('showSection: Cambiando a', name);
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active-section'));
        const map = { home: 'home-section', terminal: 'terminal-section', cooperative: 'cooperative-section' };
        const id = map[name] || 'home-section';
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('active-section');
            console.log('showSection: Sección activa', id);
        }
        window.scrollTo({ top: 0 });
        // Llama a scheduleAdsRender después de activar la sección
        scheduleAdsRender();
    }
    function navigateTo(section) { showSection(section); history.pushState({ section }, '', `#${section}`); }
    function resetNavigation() {
        if (DOM.btnProvince) { DOM.btnProvince.disabled = true; DOM.btnProvince.textContent = 'Provincia'; }
        if (DOM.btnTerminal) { DOM.btnTerminal.disabled = true; DOM.btnTerminal.textContent = 'Terminal'; }
        appData.currentProvince = null; appData.currentTerminal = null;
    }

    function setupEventListeners() {
        if (DOM.btnHome) DOM.btnHome.addEventListener('click', () => { resetNavigation(); renderProvinces(); showSection('home'); scheduleAdsRender(); });
        if (DOM.btnProvince) DOM.btnProvince.addEventListener('click', () => { showSection('terminal'); scheduleAdsRender(); });
        if (DOM.btnTerminal) DOM.btnTerminal.addEventListener('click', () => { if (appData.currentTerminal) { renderCooperatives(); showSection('cooperative'); scheduleAdsRender(); } });

        if (DOM.toggleAllBtn) DOM.toggleAllBtn.addEventListener('click', toggleAllAccordions);

        window.addEventListener('hashchange', () => {
            const h = window.location.hash;
            if (h === '#cooperative' || h === '#cooperativas') { showSection('cooperative'); if (appData.currentTerminal) renderCooperatives(); }
            else if (h === '#terminal') showSection('terminal');
            else showSection('home');
            scheduleAdsRender();
        });

        // allow favoritos.js to attach on events if it wants
    }
    window.setupEventListeners = setupEventListeners;
    window.showSection = showSection;
    window.navigateTo = navigateTo;
    window.resetNavigation = resetNavigation;

    // ========== ADS SCHEDULER (actualizado con checks para currentProvince/currentTerminal) ==========
    function scheduleAdsRender() {
        // Evita llamadas múltiples con un flag simple
        if (scheduleAdsRender._running) return;
        scheduleAdsRender._running = true;

        setTimeout(() => {
            try {
                // Verifica si appData está cargado
                if (!appData || !Array.isArray(appData.provincias)) {
                    console.warn('scheduleAdsRender: appData no cargado aún');
                    scheduleAdsRender._running = false;
                    return;
                }

                // Renderiza solo para la sección activa
                const activeSection = document.querySelector('.section.active-section');
                if (!activeSection) {
                    console.warn('scheduleAdsRender: No hay sección activa');
                    scheduleAdsRender._running = false;
                    return;
                }

                const sectionId = activeSection.id;
                console.log('scheduleAdsRender: Renderizando para sección', sectionId);

                if (sectionId === 'home-section' && typeof window.renderHomeAd === 'function') {
                    window.renderHomeAd();
                } else if (sectionId === 'terminal-section' && typeof window.renderProvinceAd === 'function' && appData.currentProvince) {
                    window.renderProvinceAd();
                } else if (sectionId === 'cooperative-section' && typeof window.renderTerminalAd === 'function' && appData.currentTerminal) {
                    window.renderTerminalAd();
                }
                // Nota: renderCooperativeAd no está definido en ads.js, así que se omite

            } catch (e) {
                console.error('scheduleAdsRender error:', e);
            }
            scheduleAdsRender._running = false;
        }, 50); // Pequeño delay para asegurar que la sección esté activa
    }

    // ========== DATA LOADING ==========
    async function loadData() {
        try {
            const resp = await fetch('data.json', { cache: 'no-cache' });
            if (!resp.ok) throw new Error('fetch failed ' + resp.status);
            const data = await resp.json();
            appData.provincias = Array.isArray(data.provincias) ? data.provincias : [];
            appData.ciudadesPrincipales = data.ciudades_principales || [];
            appData.anuncio = data.anuncio || null;

            // Cargar coop.json
            const coopResp = await fetch('coop.json', { cache: 'no-cache' });
            if (!coopResp.ok) throw new Error('fetch coop.json failed ' + coopResp.status);
            const coopData = await coopResp.json();
            appData.cooperativas = coopData;
        } catch (err) {
            console.error('loadData error', err);
            appData.provincias = appData.provincias || [];
            appData.cooperativas = {};
        }
    }

    // ========== REGISTER IMPLEMENTATIONS WITH auxiliar.js QUEUE (if present) ==========
    if (typeof window.__registerImpl === 'function') {
        try {
            window.__registerImpl('showSection', showSection);
            window.__registerImpl('navigateTo', navigateTo);
            window.__registerImpl('resetNavigation', resetNavigation);
            window.__registerImpl('setupEventListeners', setupEventListeners);
            window.__registerImpl('addTooltipEvents', addTooltipEventsToContainer);
            window.__registerImpl('setupAccordionEvents', setupAccordionEvents);
            window.__registerImpl('updateToggleButtonState', updateToggleButtonState);
            window.__registerImpl('renderTerminals', renderTerminals);
            window.__registerImpl('renderCooperatives', renderCooperatives);
            window.__registerImpl('renderRoutes', renderRoutes);
            window.__registerImpl('renderHomeAd', window.renderHomeAd || function () { });
            window.__registerImpl('renderProvinceAd', window.renderProvinceAd || function () { });
            window.__registerImpl('renderTerminalAd', window.renderTerminalAd || function () { });
            window.__registerImpl('renderCooperativeAd', window.renderCooperativeAd || function () { });
            window.__registerImpl('addFavoriteRoute', addFavoriteRoute);
            window.__registerImpl('toggleAllAccordions', toggleAllAccordions);
        } catch (e) { console.error('registerImpl error', e); }
    }

    // ========== BOOT ==========
    (async function boot() {
        await loadData();
        setupEventListeners();
        renderProvinces();
        showSection('home'); // Esto activará la sección y renderizará anuncios
    })();

});

function attachInfoBtnEvents(container) {
    if (!container) return;
    container.querySelectorAll('.info-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que active el accordion
            const infoContainer = btn.closest('.cooperative-card').querySelector('.info-container');
            if (infoContainer) {
                const isVisible = infoContainer.style.display === 'block';
                infoContainer.style.display = isVisible ? 'none' : 'block';
            }
        });
    });
}

const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    // Añade el enlace tel:
} else {
    // Texto plano
}