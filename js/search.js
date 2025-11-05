document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    // Elements
    const searchBtn = document.getElementById('search-btn');
    const modal = document.getElementById('search-modal');
    const modalOverlay = document.getElementById('search-modal-overlay');
    const modalClose = document.querySelector('.search-modal-close');
    const originInput = document.getElementById('search-origin');
    const destInput = document.getElementById('search-dest');

    if (!originInput || !destInput) {
        console.warn('search.js: elementos de entrada de búsqueda no encontrados.');
        return;
    }

    // Utilities
    function debounce(fn, wait = 180) {
        let t;
        return function () { clearTimeout(t); const args = arguments; t = setTimeout(() => fn.apply(this, args), wait); };
    }
    function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

    // Suggestion containers (positioned under inputs)
    let originList = document.getElementById('search-origin-list');
    if (!originList) {
        originList = document.createElement('div');
        originList.id = 'search-origin-list';
        originList.className = 'search-suggestions';
        originList.setAttribute('role', 'listbox');
        originList.style.position = 'absolute';
        originList.style.display = 'none';
        originList.style.zIndex = '10001';
        document.body.appendChild(originList);
    }
    let destList = document.getElementById('search-dest-list');
    if (!destList) {
        destList = document.createElement('div');
        destList.id = 'search-dest-list';
        destList.className = 'search-suggestions';
        destList.setAttribute('role', 'listbox');
        destList.style.position = 'absolute';
        destList.style.display = 'none';
        destList.style.zIndex = '10001';
        document.body.appendChild(destList);
    }

    function positionSuggestionList(listEl, inputEl) {
        if (!listEl || !inputEl) return;
        const rect = inputEl.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;
        listEl.style.left = (rect.left + scrollX) + 'px';
        listEl.style.top = (rect.bottom + scrollY + 6) + 'px';
        listEl.style.minWidth = Math.max(rect.width, 180) + 'px';
        listEl.style.display = 'block';
        listEl.style.maxHeight = '260px';
        listEl.style.overflow = 'auto';
        listEl.style.boxSizing = 'border-box';
    }
    function hideSuggestionList(listEl) {
        if (!listEl) return;
        listEl.style.display = 'none';
        listEl.innerHTML = '';
    }

    // Reposition on scroll/resize
    const rejigger = debounce(() => {
        if (originList.style.display !== 'none' && originInput.value.trim()) positionSuggestionList(originList, originInput);
        if (destList.style.display !== 'none' && destInput.value.trim()) positionSuggestionList(destList, destInput);
    }, 80);
    window.addEventListener('resize', rejigger);
    window.addEventListener('scroll', rejigger, { passive: true });

    // Modal open/close
    searchBtn && searchBtn.addEventListener('click', function () {
        modal && modal.classList.add('active');
        modalOverlay && modalOverlay.classList.add('active');
        originInput.value = '';
        destInput.value = '';
        hideSuggestionList(originList);
        hideSuggestionList(destList);
        originInput.focus();
        // Oculta el modal de la Ruta del Viajero si está visible
        const viajeroSection = document.getElementById('viajero-section');
        if (viajeroSection) viajeroSection.style.display = 'none';
    });
    function closeModal() {
    modal && modal.classList.remove('active');
    modalOverlay && modalOverlay.classList.remove('active');
    hideSuggestionList(originList);
    hideSuggestionList(destList);
    // Vuelve a mostrar el modal de la Ruta del Viajero si existe
    const viajeroSection = document.getElementById('viajero-section');
    if (viajeroSection) viajeroSection.style.display = '';
    }
    modalClose && modalClose.addEventListener('click', closeModal);
    modalOverlay && modalOverlay.addEventListener('click', closeModal);

    // Data helpers
    function getAllCities() {
        if (!window.appData || !Array.isArray(window.appData.provincias)) return [];
        const cities = [];
        window.appData.provincias.forEach(prov => (prov.terminales || []).forEach(t => { if (t && t.nombre) cities.push(t.nombre); }));
        return Array.from(new Set(cities));
    }

    // ---------- SYNONYMS / ALIASES ----------
    let SYNONYM_ENTRIES = [
        { canonical: 'banos_de_agua_santa', variants: ['baños de agua santa', 'banos de agua santa', 'baños', 'banos', 'banos de agua'] }
    ];
    const SYNONYM_MAP = {}; // variantNormalized -> canonicalToken

    function normalizeTextBasic(s) {
        return String(s || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[\u2010-\u2015]/g, ' ')
            .replace(/[(){}\[\],\/\\|+<>:;"]/g, ' ')
            .replace(/&amp;|&/g, ' and ')
            .replace(/[^0-9a-zA-Z\s-]/g, ' ')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function buildSynonymMap() {
        Object.keys(SYNONYM_MAP).forEach(k => delete SYNONYM_MAP[k]);
        SYNONYM_ENTRIES.forEach(e => {
            const canonicalToken = String(e.canonical || '').toLowerCase().trim().replace(/\s+/g, '_');
            (e.variants || []).forEach(v => {
                const vn = normalizeTextBasic(v);
                if (vn) SYNONYM_MAP[vn] = canonicalToken;
            });
        });
    }

    function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function applySynonymsToString(s) {
        if (!s) return '';
        let txt = normalizeTextBasic(s);
        const variants = Object.keys(SYNONYM_MAP).sort((a, b) => b.length - a.length);
        for (const v of variants) {
            if (!v) continue;
            const canonical = SYNONYM_MAP[v];
            const re = new RegExp('\\b' + escapeRegex(v) + '\\b', 'g');
            txt = txt.replace(re, canonical);
        }
        return txt;
    }

    (function loadSynonymsFile() {
        try {
            fetch('/sinonimos.json?v=20241001', { cache: 'no-cache' })
                .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
                .then(json => {
                    if (Array.isArray(json) && json.length) SYNONYM_ENTRIES = json;
                    else if (json && Array.isArray(json.entries)) SYNONYM_ENTRIES = json.entries;
                })
                .catch(() => { /* ignore, keep defaults */ })
                .finally(() => { buildSynonymMap(); });
        } catch (e) { buildSynonymMap(); }
    })();

    // ---------- normalization & token matching ----------
    function normalizeText(s) { return applySynonymsToString(s); }
    function tokenize(s) {
        const n = normalizeText(s);
        if (!n) return [];
        const parts = n.split(/[\s-]+/).map(p => p.trim()).filter(Boolean);
        return parts.filter(t => t.length > 1 || parts.length === 1);
    }
    function countTokenMatches(tokensA, tokensB) {
        if (!tokensA.length || !tokensB.length) return 0;
        const setB = new Set(tokensB);
        let count = 0;
        tokensA.forEach(t => { if (setB.has(t)) count++; });
        return count;
    }

    // Suggestion rendering (closes lists on selection)
    function renderSuggestions(listEl, items, inputEl) {
        if (!listEl) return;
        if (!items || !items.length) { hideSuggestionList(listEl); return; }
        listEl.innerHTML = items.map((city, i) =>
            `<div class="search-suggestion-item" role="option" data-index="${i}" tabindex="0">${city}</div>`
        ).join('');
        positionSuggestionList(listEl, inputEl);

        // prevent blur when clicking inside the list
        listEl.addEventListener('mousedown', e => e.preventDefault());

        listEl.querySelectorAll('.search-suggestion-item').forEach(item => {
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                if (listEl === originList) {
                    originInput.value = item.textContent;
                    hideSuggestionList(originList);
                    hideSuggestionList(destList);
                    setTimeout(() => { try { destInput.focus(); } catch (err) {} }, 0);
                } else {
                    destInput.value = item.textContent;
                    hideSuggestionList(destList);
                    hideSuggestionList(originList);
                    setTimeout(() => { try { destInput.focus(); destInput.setSelectionRange(destInput.value.length, destInput.value.length); } catch (err) {} }, 0);
                }
            });
            item.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); item.click(); }
            });
        });
    }

    function showOriginSuggestions() {
        const value = originInput.value.trim().toLowerCase();
        if (!value) { hideSuggestionList(originList); return; }
        const filtered = getAllCities().filter(city => city.toLowerCase().includes(value));
        renderSuggestions(originList, filtered, originInput);
    }
    function showDestSuggestions() {
        const value = destInput.value.trim().toLowerCase();
        if (!value) { hideSuggestionList(destList); return; }
        const filtered = getAllCities().filter(city => city.toLowerCase().includes(value));
        renderSuggestions(destList, filtered, destInput);
    }
    originInput.addEventListener('input', debounce(showOriginSuggestions, 180));
    destInput.addEventListener('input', debounce(showDestSuggestions, 180));
    originInput.addEventListener('focus', () => { if (originInput.value.trim()) showOriginSuggestions(); });
    destInput.addEventListener('focus', () => { if (destInput.value.trim()) showDestSuggestions(); });

    // Hide suggestion lists when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#search-origin-list') && !e.target.closest('#search-origin')) hideSuggestionList(originList);
        if (!e.target.closest('#search-dest-list') && !e.target.closest('#search-dest')) hideSuggestionList(destList);
    });

    originInput.addEventListener('blur', function () {
        setTimeout(() => { if (document.activeElement && originList.contains(document.activeElement)) return; hideSuggestionList(originList); }, 150);
    });
    destInput.addEventListener('blur', function () {
        setTimeout(() => { if (document.activeElement && destList.contains(document.activeElement)) return; hideSuggestionList(destList); }, 150);
    });

    // Keyboard nav for suggestion lists
    function attachKeyboardNav(inputEl, listEl) {
        inputEl.addEventListener('keydown', function (e) {
            if (listEl.style.display === 'none') {
                if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit(); }
                return;
            }
            const items = Array.from(listEl.querySelectorAll('.search-suggestion-item'));
            if (!items.length) return;
            const active = listEl.querySelector('.active-suggestion');
            let idx = active ? Number(active.getAttribute('data-index')) : -1;
            if (e.key === 'ArrowDown') {
                e.preventDefault(); if (idx < items.length - 1) idx++; items.forEach(it => it.classList.remove('active-suggestion')); items[idx].classList.add('active-suggestion'); items[idx].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); if (idx > 0) idx--; items.forEach(it => it.classList.remove('active-suggestion')); if (idx >= 0) { items[idx].classList.add('active-suggestion'); items[idx].focus(); } else inputEl.focus();
            } else if (e.key === 'Escape') {
                hideSuggestionList(listEl);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (active) active.click(); else handleSearchSubmit();
            }
        });
    }
    attachKeyboardNav(originInput, originList);
    attachKeyboardNav(destInput, destList);

    // Helpers for coop accordion/scrolling/highlighting
    function openCoopAccordion(coopEl) {
        if (!coopEl) return false;
        const body = coopEl.querySelector('.coop-body');
        if (!body) return false;
        // Si ya está abierto, no hacemos nada
        if (body.classList.contains('open')) return true;
        // Busca el botón de toggle
        const toggleBtn = coopEl.querySelector('.accordion-toggle');
        if (toggleBtn) {
            try { toggleBtn.click(); return true; } catch (e) { return false; }
        }
        // Si no hay botón, forzamos la clase (fallback)
        body.classList.add('open');
        return true;
    }
    function scrollMainToElement(el) { if (!el) return; try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
    function scrollWithinCoopToRoute(coopEl, routeEl) { if (!coopEl || !routeEl) return; try { routeEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); routeEl.classList.add('search-highlight'); setTimeout(() => routeEl.classList.remove('search-highlight'), 3000); } catch (e) {} }
    function highlightTimesForRoute(routeEl) { if (!routeEl) return; const times = Array.from(routeEl.querySelectorAll('.time')); times.forEach(t => { t.classList.add('search-highlight-time'); if (!t.dataset.__searchBound) { t.addEventListener('click', function () { t.classList.toggle('active-time'); t.classList.add('search-highlight-time'); }); t.dataset.__searchBound = '1'; } }); }

    // ---------------------------
    // Matching considering ORIGEN + DESTINO
    // ---------------------------
    function findMatchingCooperatives(origen, destino) {
        if (!destino) return [];
        const userDestTokens = tokenize(destino);
        const userOrigTokens = origen ? tokenize(origen) : [];

        const MIN_DEST_RATIO = 0.6;
        const MIN_ORIG_RATIO = 0.4;
        const EXACT_BOOST = 1000;

        const coops = Array.from(document.querySelectorAll('.cooperative-card'));
        const matches = [];

        coops.forEach(coop => {
            const coopName = normalizeText(coop.getAttribute('data-name') || coop.textContent || '').slice(0, 60);
            const routeEls = Array.from(coop.querySelectorAll('.route')) || [];
            let best = null; let bestScore = 0; let bestDestRatio = 0; let bestOrigRatio = 0;

            routeEls.forEach(r => {
                const destCandidates = [];
                const destEl = r.querySelector('.destination');
                if (destEl && destEl.textContent) destCandidates.push(destEl.textContent);
                const dd = (r.dataset && r.dataset.destino) ? r.dataset.destino : (r.getAttribute ? r.getAttribute('data-destino') : '');
                if (dd) destCandidates.push(dd);

                const origCandidates = [];
                const oEl = r.querySelector('.origin');
                if (oEl && oEl.textContent) origCandidates.push(oEl.textContent);

                const fullText = r.textContent || '';
                if (fullText) {
                    const parts = fullText.split(/[-–—]| a | to | hasta /i).map(p => p.trim()).filter(Boolean);
                    if (parts.length >= 2) {
                        destCandidates.push(parts[parts.length - 1]);
                        origCandidates.push(parts[0]);
                    }
                }
                destCandidates.push(fullText);

                destCandidates.forEach(dc => {
                    const candDestTokens = tokenize(dc || '');
                    const destMatched = countTokenMatches(userDestTokens, candDestTokens);
                    const destRatio = userDestTokens.length ? (destMatched / userDestTokens.length) : 0;

                    let origMatched = 0, origRatio = 0;
                    if (userOrigTokens.length) {
                        const oc = origCandidates.length ? origCandidates.join(' ') : '';
                        const candOrigTokens = tokenize(oc || '');
                        origMatched = countTokenMatches(userOrigTokens, candOrigTokens);
                        origRatio = userOrigTokens.length ? (origMatched / userOrigTokens.length) : 0;
                    } else {
                        origRatio = 0.5;
                    }

                    let score = destMatched * 2 + origMatched + destRatio + origRatio * 0.8;
                    const candDestNorm = normalizeText(dc || '');
                    const targetDestNorm = normalizeText(destino || '');
                    if (candDestNorm && targetDestNorm && candDestNorm.includes(targetDestNorm)) score += EXACT_BOOST;

                    if (score > bestScore) {
                        bestScore = score;
                        best = r;
                        bestDestRatio = destRatio;
                        bestOrigRatio = origRatio;
                    }
                });
            });

            const accepted = (bestScore >= EXACT_BOOST) ||
                (bestScore > 0 && bestDestRatio >= MIN_DEST_RATIO && (userOrigTokens.length ? bestOrigRatio >= MIN_ORIG_RATIO || bestScore >= 2 : true));

            if (accepted && best) matches.push({ coopEl: coop, bestRouteEl: best, score: bestScore, destRatio: bestDestRatio, origRatio: bestOrigRatio });
        });

        matches.sort((a, b) => b.score - a.score);
        const MAX_COOPS = 8;
        return matches.slice(0, MAX_COOPS);
    }

    function findBestRouteInCoopScore(coopEl, origen, destino) {
        if (!coopEl || !destino) return { routeEl: null, score: 0 };
        const userDestTokens = tokenize(destino);
        const userOrigTokens = origen ? tokenize(origen) : [];
        let best = null; let bestScore = 0;
        const routeEls = Array.from(coopEl.querySelectorAll('.route')) || [];
        routeEls.forEach(r => {
            const fullText = r.textContent || '';
            const destCandidates = [];
            const destEl = r.querySelector('.destination');
            if (destEl && destEl.textContent) destCandidates.push(destEl.textContent);
            const dd = (r.dataset && r.dataset.destino) ? r.dataset.destino : (r.getAttribute ? r.getAttribute('data-destino') : '');
            if (dd) destCandidates.push(dd);
            destCandidates.push(fullText);

            const origCandidates = [];
            const oEl = r.querySelector('.origin');
            if (oEl && oEl.textContent) origCandidates.push(oEl.textContent);
            if (fullText) {
                const parts = fullText.split(/[-–—]| a | to | hasta /i).map(p => p.trim()).filter(Boolean);
                if (parts.length >= 2) { destCandidates.push(parts[parts.length - 1]); origCandidates.push(parts[0]); }
            }

            destCandidates.forEach(dc => {
                const candDestTokens = tokenize(dc || '');
                const destMatched = countTokenMatches(userDestTokens, candDestTokens);
                let origMatched = 0;
                if (userOrigTokens.length) {
                    const oc = origCandidates.length ? origCandidates.join(' ') : '';
                    const candOrigTokens = tokenize(oc || '');
                    origMatched = countTokenMatches(userOrigTokens, candOrigTokens);
                }
                const score = destMatched * 2 + origMatched;
                if (score > bestScore) { bestScore = score; best = r; }
            });
        });
        return { routeEl: best, score: bestScore };
    }

    async function processDestinationSequence(origen, destino) {
        if (!destino) return;
        const anyCoops = await waitForSelector('.cooperative-card', 3000);
        if (!anyCoops) return;

        let matches = findMatchingCooperatives(origen, destino);

        if (!matches || !matches.length) {
            console.debug('[search] No se encontraron rutas que coincidan con destino:', destino, '-> no abrir cooperativas (mantener vista de terminal).');
            return;
        }

        const first = matches[0];
        try { scrollMainToElement(first.coopEl); first.coopEl.classList.add('search-highlight'); setTimeout(() => first.coopEl.classList.remove('search-highlight'), 1600); } catch (e) {}

        for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            try { scrollMainToElement(m.coopEl); } catch (e) {}
            await delay(250);

            try { openCoopAccordion(m.coopEl); } catch (e) {}
            await waitForSelectorIn(m.coopEl, '.route', 3000);

            await delay(1000);

            try {
                const res = findBestRouteInCoopScore(m.coopEl, origen, destino);
                const routeEl = res.routeEl || m.bestRouteEl;
                if (routeEl) {
                    highlightTimesForRoute(routeEl);
                    scrollWithinCoopToRoute(m.coopEl, routeEl);
                }
            } catch (e) { }

            await delay(1000);
        }
    }

    function findProvinceTerminalByName(name) {
        if (!name || !window.appData || !Array.isArray(window.appData.provincias)) return null;
        const targetNorm = normalizeText(name);
        const userTokens = tokenize(name);
        if (!targetNorm) return null;

        let bestMatch = null;
        let bestScore = 0;
        let bestRatio = 0;

        for (const prov of window.appData.provincias) {
            for (const terminal of (prov.terminales || [])) {
                if (!terminal || !terminal.nombre) continue;
                const termNorm = normalizeText(terminal.nombre);
                if (termNorm === targetNorm) return { province: prov, terminal: terminal };

                const termTokens = tokenize(terminal.nombre);
                if (!termTokens.length) continue;
                const matched = countTokenMatches(userTokens, termTokens);
                const ratio = userTokens.length ? (matched / userTokens.length) : 0;
                const score = matched + ratio * 0.5;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { province: prov, terminal: terminal };
                    bestRatio = ratio;
                }
            }
        }

        const MIN_RATIO = 0.5;
        const MIN_MATCHED = (userTokens.length >= 2) ? 2 : 1;
        if (bestMatch && (bestRatio >= MIN_RATIO || bestScore >= MIN_MATCHED)) return bestMatch;
        return null;
    }

    async function navegarACooperativasDeOrigen(origen, destino) {
        if (!window.appData || !Array.isArray(window.appData.provincias)) return;

        // Resolve origin (priority)
        let originInfo = null;
        if (origen && origen.trim()) originInfo = findProvinceTerminalByName(origen);

        // tolerant fallback by contains / id
        if (!originInfo && origen && origen.trim()) {
            const target = normalizeText(origen || '');
            outer: for (const prov of window.appData.provincias || []) {
                for (const terminal of (prov.terminales || [])) {
                    if (!terminal || !terminal.nombre) continue;
                    const tname = normalizeText(terminal.nombre);
                    const tid = terminal.id ? normalizeText(terminal.id) : '';
                    if (!target) continue;
                    if (tname === target || tid === target || tname.includes(target)) {
                        originInfo = { province: prov, terminal: terminal };
                        break outer;
                    }
                }
            }
        }

        // try using destination as origin if nothing found (last attempt)
        if (!originInfo && destino && destino.trim()) {
            const tryAsOrigin = findProvinceTerminalByName(destino);
            if (tryAsOrigin) originInfo = tryAsOrigin;
        }

        // last resort: current or first available
        if (!originInfo) {
            originInfo = {
                province: window.appData.currentProvince || (window.appData.provincias && window.appData.provincias[0]) || null,
                terminal: window.appData.currentTerminal || (window.appData.provincias && window.appData.provincias[0] && window.appData.provincias[0].terminales && window.appData.provincias[0].terminales[0]) || null
            };
        }

        if (!originInfo || !originInfo.terminal) {
            return;
        }

        // STEP 0: set current province and ENSURE we ENTER the province screen first (show terminals list)
        try {
            window.appData.currentProvince = originInfo.province;
            if (typeof window.selectProvince === 'function') {
                try { window.selectProvince(originInfo.province); } catch (e) { }
            }
            if (typeof window.showSection === 'function') {
                try { window.showSection('province'); } catch (e) {}
            }
            try { window.location.hash = 'province'; } catch (e) {}
            if (typeof window.renderTerminals === 'function') {
                try { window.renderTerminals(); } catch (e) {}
            }
        } catch (e) { }
        await delay(1000);

        // STEP 1: ensure terminals are visible
        try {
            await waitForSelector('.card--terminal', 2000);
        } catch (e) { }

        // STEP 2: set/select terminal (enter terminal -> cooperatives)
        try {
            window.appData.currentTerminal = originInfo.terminal;
            if (typeof window.selectTerminal === 'function') {
                try { window.selectTerminal(originInfo.terminal); }
                catch (e) { }
            } else {
                // fallback: find terminal card and click it to enter terminal view
                const termName = originInfo.terminal.nombre || '';
                const termEl = findTerminalCard ? findTerminalCard(termName) : null;
                if (termEl && termEl.click) {
                    try { termEl.click(); } catch (e) { }
                }
            }
            if (typeof window.showSection === 'function') {
                try { window.showSection('terminal'); } catch (e) {}
            }
            try { window.location.hash = 'terminal'; } catch (e) {}
        } catch (e) { }
        await delay(1000);

        // STEP 3: ensure cooperatives are rendered
        try {
            if (typeof window.renderCooperatives === 'function') {
                try { window.renderCooperatives(); } catch (e) {}
            }
            await waitForSelector('.cooperative-card', 3000);
        } catch (e) { }
        await delay(1000);

        // STEP 4: show cooperative section explicitly
        try {
            if (typeof window.showSection === 'function') window.showSection('cooperative');
            try { window.location.hash = 'cooperative'; } catch (e) {}
        } catch (e) { }
        await delay(1000);

        // Solo ejecutar la búsqueda de rutas si existen cooperativas en pantalla
        const coopCards = document.querySelectorAll('.cooperative-card');
        if (coopCards && coopCards.length > 0) {
            try {
                await delay(250);
                await processDestinationSequence(originInfo.terminal.nombre || origen, destino);
            } catch (e) { }
        }
    }

    // helper: wait for selector inside a container
    function waitForSelectorIn(container, selector, timeout = 2500, interval = 100) {
        return new Promise(resolve => {
            const start = Date.now();
            (function check() {
                if (!container) return resolve(false);
                if (container.querySelector(selector)) return resolve(true);
                if (Date.now() - start > timeout) return resolve(false);
                setTimeout(check, interval);
            })();
        });
    }

    // generic waitForSelector in document
    function waitForSelector(selector, timeout = 3000, interval = 100) {
        return new Promise(resolve => {
            const start = Date.now();
            (function check() {
                if (document.querySelector(selector)) return resolve(true);
                if (Date.now() - start > timeout) return resolve(false);
                setTimeout(check, interval);
            })();
        });
    }

    // find DOM helpers for blinking
    function findTerminalCard(terminalName) {
        if (!terminalName) return null;
        const target = normalizeText(terminalName);
        const els = document.querySelectorAll('.card--terminal');
        for (const el of els) { const txt = normalizeText(el.textContent || el.innerText || ''); if (txt.includes(target)) return el; }
        return null;
    }

    // blink helper
    function blinkElement(el, opts = {}) {
        if (!el) return Promise.resolve();
        const times = opts.times || 4; const interval = opts.interval || 200; const cls = opts.className || 'blink-highlight';
        return new Promise(resolve => {
            let count = 0;
            const iv = setInterval(() => { try { el.classList.toggle(cls); } catch (e) {} count++; if (count >= times) { clearInterval(iv); try { el.classList.remove(cls); } catch (e) {} resolve(); } }, interval);
        });
    }

    // Fuzzy search para ciudades y destinos
    function levenshtein(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // sustitución
                        matrix[i][j - 1] + 1,     // inserción
                        matrix[i - 1][j] + 1      // eliminación
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function fuzzyFind(term, candidates, maxDistance = 2) {
        term = term.toLowerCase();
        let best = null;
        let bestDist = Infinity;
        candidates.forEach(c => {
            const dist = levenshtein(term, c.toLowerCase());
            if (dist < bestDist && dist <= maxDistance) {
                best = c;
                bestDist = dist;
            }
        });
        return best;
    }

    // Ejemplo de uso en la búsqueda:
    // const sinonimos = [...]; // cargar sinonimos.json
    // const ciudades = sinonimos.flatMap(s => [s.canonical, ...s.variants]);
    // let resultado = fuzzyFind(inputValue, ciudades);
    // Si resultado es null, no hay coincidencia cercana.

    // Search submit handling & bindings
    function handleSearchSubmit() {
        const origen = originInput.value.trim();
        const destino = destInput.value.trim();
        hideSuggestionList(originList);
        hideSuggestionList(destList);
        if (!origen && !destino) {
            alert('Por favor ingresa origen o destino.');
            return;
        }

        // Cargar sinonimos y ciudades
        const sinonimos = SYNONYM_ENTRIES;
        const ciudades = sinonimos.flatMap(s => [s.canonical, ...(s.variants || [])]);

        // Buscar origen y destino usando fuzzyFind
        let resultadoOrigen = origen ? fuzzyFind(origen, ciudades, 2) : null;
        let resultadoDestino = destino ? fuzzyFind(destino, ciudades, 2) : null;

        // Si no hay coincidencia fuzzy, usar el texto original
        if (!resultadoOrigen && origen) resultadoOrigen = origen;
        if (!resultadoDestino && destino) resultadoDestino = destino;

        // Navegar y resaltar rutas como antes
        navegarACooperativasDeOrigen(resultadoOrigen, resultadoDestino);

        // Cierra el modal
        modal.style.display = 'none';
        modalOverlay.style.display = 'none';
    }

    // Global search handler (debounced)
    window.handleGlobalSearch = debounce(handleSearchSubmit, 300);

    // Bind enter key on inputs to trigger search
    originInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit(); }
    });
    destInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit(); }
    });

    // Search modal open/close logic
    searchBtn && searchBtn.addEventListener('click', function () {
        if (modal) {
            modal.style.display = 'block';
            modalOverlay && (modalOverlay.style.display = 'block');
            originInput && originInput.focus();
        }
    });
    modalClose && modalClose.addEventListener('click', function () {
        if (modal) {
            modal.style.display = 'none';
            modalOverlay && (modalOverlay.style.display = 'none');
        }
    });
    modalOverlay && modalOverlay.addEventListener('click', function () {
        if (modal) {
            modal.style.display = 'none';
            modalOverlay.style.display = 'none';
        }
    });

    // Vincula el submit del modal
    const searchBtnModal = document.getElementById('search-btn-modal');
    searchBtnModal && searchBtnModal.addEventListener('click', handleSearchSubmit);
});