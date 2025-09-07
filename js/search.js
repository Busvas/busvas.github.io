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
    });
    function closeModal() {
        modal && modal.classList.remove('active');
        modalOverlay && modalOverlay.classList.remove('active');
        hideSuggestionList(originList);
        hideSuggestionList(destList);
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
            fetch('/sinonimos.json', { cache: 'no-cache' })
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

        function isExpanded(el) {
            try {
                if (!el) return false;
                const cls = el.classList;
                if (cls && (cls.contains('open') || cls.contains('expanded') || cls.contains('is-open'))) return true;
                const ae = el.getAttribute && el.getAttribute('aria-expanded');
                if (ae === 'true') return true;
                if (el.tagName && el.tagName.toLowerCase() === 'details' && el.open) return true;
                const panel = el.querySelector('.coop-body, .coop-content, .accordion-panel, .details, .coop-details, .content');
                if (panel) {
                    const cs = getComputedStyle(panel);
                    if (cs && cs.display !== 'none' && cs.visibility !== 'hidden' && panel.offsetHeight > 0) return true;
                }
            } catch (e) { /* ignore */ }
            return false;
        }

        if (isExpanded(coopEl)) return true;

        const triggers = [
            '.coop-header', '.cooperative-header', '.coop-title', '.coop-toggle',
            '.coop-toggle-btn', '.accordion-toggle', '.coop-open', '.coop__header', 'button', '[role="button"]', 'a'
        ];
        function dispatchMouseEvent(target, type) {
            try {
                const ev = new MouseEvent(type, { view: window, bubbles: true, cancelable: true });
                target.dispatchEvent(ev);
            } catch (e) { try { target.click(); } catch (e2) {} }
        }

        for (const sel of triggers) {
            try {
                const el = coopEl.querySelector(sel);
                if (!el) continue;
                try {
                    dispatchMouseEvent(el, 'mouseover');
                    dispatchMouseEvent(el, 'mousedown');
                    dispatchMouseEvent(el, 'mouseup');
                    dispatchMouseEvent(el, 'click');
                    try { el.click(); } catch (e) {}
                } catch (e) {}
                if (isExpanded(coopEl)) return true;
            } catch (e) { /* ignore per-selector errors */ }
        }

        try {
            const chk = coopEl.querySelector('input[type="checkbox"], input[data-toggle="checkbox"]');
            if (chk) {
                try { chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
                if (isExpanded(coopEl)) return true;
            }
        } catch (e) {}

        try {
            const details = coopEl.querySelector('details');
            if (details) {
                try { details.open = true; } catch (e) {}
                if (isExpanded(coopEl)) return true;
            }
        } catch (e) {}

        // fallback: force-expansion pero respetando max-height definido en CSS
        try {
            if (coopEl.classList) coopEl.classList.add('expanded', 'open', 'is-open');
            coopEl.setAttribute && coopEl.setAttribute('aria-expanded', 'true');

            const header = coopEl.querySelector('.coop-header, .cooperative-header, .coop-title, .coop-toggle, .accordion-toggle');
            if (header && header.setAttribute) header.setAttribute('aria-expanded', 'true');

            const panel = coopEl.querySelector('.coop-body, .coop-content, .accordion-panel, .details, .coop-details, .content');
            if (panel) {
                // obtener max-height desde CSS si está definido
                const cs = getComputedStyle(panel);
                let cssMax = cs && cs.maxHeight ? cs.maxHeight : 'none';
                let maxLimit = 320; // default fallback si no hay max en CSS
                if (cssMax && cssMax !== 'none') {
                    const parsed = parseFloat(cssMax);
                    if (!isNaN(parsed) && parsed > 0) maxLimit = parsed;
                }
                // calcular altura objetivo: no exceder css max-height
                const targetHeight = Math.min(panel.scrollHeight || maxLimit, maxLimit);
                panel.style.display = 'block';
                panel.style.overflowY = 'auto';
                panel.style.maxHeight = targetHeight + 'px';
                panel.style.visibility = 'visible';
                panel.setAttribute && panel.setAttribute('aria-hidden', 'false');
            }

            try { coopEl.dispatchEvent(new CustomEvent('accordion:open', { bubbles: true })); } catch (e) {}

            return isExpanded(coopEl) || true;
        } catch (e) {
            return false;
        }
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

        const coops = Array.from(document.querySelectorAll('.cooperative-card, .cooperative, .coop-card'));
        const matches = [];

        coops.forEach(coop => {
            const coopName = normalizeText(coop.getAttribute('data-name') || coop.textContent || '').slice(0, 60);
            const routeEls = Array.from(coop.querySelectorAll('.route, .route-item, .route-row, .time')) || [];
            let best = null; let bestScore = 0; let bestDestRatio = 0; let bestOrigRatio = 0;

            routeEls.forEach(r => {
                const destCandidates = [];
                const destEl = r.querySelector('.destination, .route-destination, .route-to');
                if (destEl && destEl.textContent) destCandidates.push(destEl.textContent);
                const dd = (r.dataset && r.dataset.destino) ? r.dataset.destino : (r.getAttribute ? r.getAttribute('data-destino') : '');
                if (dd) destCandidates.push(dd);

                const origCandidates = [];
                const oEl = r.querySelector('.origin, .route-from, .from, .route-origin');
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

            // debug minimal: only when dev console open
            if (window && window.console && console.debug) console.debug('[search] coop:', coopName, 'bestScore:', Math.round(bestScore * 100) / 100, 'destRatio:', Math.round(bestDestRatio * 100) / 100, 'origRatio:', Math.round(bestOrigRatio * 100) / 100);

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
        const routeEls = Array.from(coopEl.querySelectorAll('.route, .route-item, .route-row, .time')) || [];
        routeEls.forEach(r => {
            const fullText = r.textContent || '';
            const destCandidates = [];
            const destEl = r.querySelector('.destination, .route-destination, .route-to');
            if (destEl && destEl.textContent) destCandidates.push(destEl.textContent);
            const dd = (r.dataset && r.dataset.destino) ? r.dataset.destino : (r.getAttribute ? r.getAttribute('data-destino') : '');
            if (dd) destCandidates.push(dd);
            destCandidates.push(fullText);

            const origCandidates = [];
            const oEl = r.querySelector('.origin, .route-from, .from, .route-origin');
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
        const anyCoops = await waitForSelector('.cooperative-card, .coop-card, .cooperative', 3000);
        if (!anyCoops) return;

        // buscar coincidencias estrictas dentro de cooperativas
        let matches = findMatchingCooperatives(origen, destino);

        // Si no hay matches estrictos, NO hacer fallback que abra todas las cooperativas.
        // En ese caso abortamos y dejamos al usuario en la vista del terminal para que siga buscando manualmente.
        if (!matches || !matches.length) {
            console.debug('[search] No se encontraron rutas que coincidan con destino:', destino, '-> no abrir cooperativas (mantener vista de terminal).');
            return;
        }

        // Scroll to first coop to give context
        const first = matches[0];
        try { scrollMainToElement(first.coopEl); first.coopEl.classList.add('search-highlight'); setTimeout(() => first.coopEl.classList.remove('search-highlight'), 1600); } catch (e) {}

        // Open accordions for ALL matching cooperatives sequentially (1s between major steps)
        // and highlight any matching route found inside each one.
        for (let i = 0; i < matches.length; i++) {
            const m = matches[i];

            // 1) bring coop into view
            try { scrollMainToElement(m.coopEl); } catch (e) {}
            await delay(250);

            // 2) open its accordion / details
            try { openCoopAccordion(m.coopEl); } catch (e) {}
            // wait for internal route elements to appear
            await waitForSelectorIn(m.coopEl, '.route, .route-item, .route-row, .time', 3000);

            // 3) pause 1s as requested between steps
            await delay(1000);

            // 4) find best route in this coop and highlight it (if any)
            try {
                const res = findBestRouteInCoopScore(m.coopEl, origen, destino);
                const routeEl = res.routeEl || m.bestRouteEl;
                if (routeEl) {
                    highlightTimesForRoute(routeEl);
                    scrollWithinCoopToRoute(m.coopEl, routeEl);
                }
            } catch (e) { /* ignore per-coop errors */ }

            // 5) wait 1s before proceeding to next cooperative (ensures observable sequential behavior)
            await delay(1000);
        }
    }

    // find province/terminal by name: return best match (strict)
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

    // Main navigation flow: resolve ORIGEN first, then render cooperatives, then highlight DESTINO
    async function navegarACooperativasDeOrigen(origen, destino) {
        if (!window.appData || !Array.isArray(window.appData.provincias)) return;

        console.debug('[search] iniciar navegación:', { origen, destino });

        // Resolve origin (priority) - reuse existing helper
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
            console.debug('[search] No se pudo resolver origen para renderizar cooperativas.', originInfo);
            return;
        }

        // STEP 0: set current province and ENSURE we ENTER the province screen first (show terminals list)
        try {
            window.appData.currentProvince = originInfo.province;
            console.debug('[search] STEP 0 set currentProvince (show province screen):', originInfo.province && originInfo.province.nombre);

            // prefer high-level API if available
            if (typeof window.selectProvince === 'function') {
                try { window.selectProvince(originInfo.province); } catch (e) { /* ignore */ }
            }

            // explicitly show province view so user sees terminal list first
            if (typeof window.showSection === 'function') {
                try { window.showSection('province'); } catch (e) {}
            }

            // also set hash as a fallback
            try { window.location.hash = 'province'; } catch (e) {}

            // render terminals immediately so the "Terminales en X" view is populated
            if (typeof window.renderTerminals === 'function') {
                try { window.renderTerminals(); } catch (e) {}
            }

            // wait 1s so user sees the province screen with terminals before entering terminal
        } catch (e) { console.debug('[search] STEP0 error', e); }
        await delay(1000);

        // STEP 1: ensure terminals are visible (extra safety)
        try {
            await waitForSelector('.terminal-card, .terminal, .terminal-item, .terminal-row', 2000);
            console.debug('[search] STEP 1 terminals should be visible for province:', originInfo.province && originInfo.province.nombre);
        } catch (e) { /* ignore */ }

        // STEP 2: set/select terminal (enter terminal -> cooperatives)
        try {
            window.appData.currentTerminal = originInfo.terminal;
            console.debug('[search] STEP 2 set currentTerminal (enter terminal):', originInfo.terminal && originInfo.terminal.nombre);
            if (typeof window.selectTerminal === 'function') {
                try { window.selectTerminal(originInfo.terminal); }
                catch (e) { /* fallback to DOM click */ }
            } else {
                // fallback: find terminal card and click it to enter terminal view
                const termName = originInfo.terminal.nombre || '';
                const termEl = findTerminalCard ? findTerminalCard(termName) : null;
                if (termEl && termEl.click) {
                    try { termEl.click(); } catch (e) { /* ignore */ }
                }
            }
            // ensure terminal view is shown
            if (typeof window.showSection === 'function') {
                try { window.showSection('terminal'); } catch (e) {}
            }
            try { window.location.hash = 'terminal'; } catch (e) {}
        } catch (e) { console.debug('[search] STEP2 error', e); }
        await delay(1000);

        // STEP 3: ensure cooperatives are rendered
        try {
            if (typeof window.renderCooperatives === 'function') {
                try { window.renderCooperatives(); } catch (e) {}
            }
            const ok = await waitForSelector('.cooperative-card, .coop-card, .cooperative', 3000);
            console.debug('[search] STEP 3 cooperatives rendered?', ok);
        } catch (e) { console.debug('[search] STEP3 error', e); }
        await delay(1000);

        // STEP 4: show cooperative section explicitly
        try {
            if (typeof window.showSection === 'function') window.showSection('cooperative');
            try { window.location.hash = 'cooperative'; } catch (e) {}
            console.debug('[search] STEP 4 showSection cooperative');
        } catch (e) { console.debug('[search] STEP4 error', e); }
        await delay(1000);

        // STEP 5: highlight destination terminal/province (non-destructive)
        try {
            if (destino && destino.trim()) {
                const destInfo = findProvinceTerminalByName(destino);
                if (destInfo) {
                    const provEl2 = findProvinceCard ? findProvinceCard(destInfo.province.nombre || '') : null;
                    if (provEl2) await blinkElement(provEl2, { times: 3, interval: 140, className: 'blink-highlight' });
                    const termEl2 = findTerminalCard ? findTerminalCard(destInfo.terminal.nombre || '') : null;
                    if (termEl2) await blinkElement(termEl2, { times: 3, interval: 140, className: 'blink-highlight-terminal' });
                    console.debug('[search] STEP 5 highlighted destino (if found)', destInfo.province && destInfo.terminal && destInfo.terminal.nombre);
                }
            }
        } catch (e) { console.debug('[search] STEP5 error', e); }
        await delay(1000);

        // STEP 6: run the cooperative matching / sequential highlight of routes
        try {
            await delay(250);
            await processDestinationSequence(originInfo.terminal.nombre || origen, destino);
            console.debug('[search] STEP 6 processDestinationSequence finished');
        } catch (e) { console.debug('[search] STEP6 error', e); }
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
    function findProvinceCard(provinceName) {
        if (!provinceName) return null;
        const target = normalizeText(provinceName);
        const els = document.querySelectorAll('.province-card, .province, .province-item, .province-row, .provincia-card');
        for (const el of els) { const txt = normalizeText(el.textContent || el.innerText || ''); if (txt.includes(target)) return el; }
        const dp = document.querySelector('[data-province]'); if (dp && normalizeText(dp.getAttribute('data-province') || '') === target) return dp;
        return null;
    }
    function findTerminalCard(terminalName) {
        if (!terminalName) return null;
        const target = normalizeText(terminalName);
        const els = document.querySelectorAll('.terminal-card, .terminal, .terminal-item, .terminal-row, .terminal-card-row');
        for (const el of els) { const txt = normalizeText(el.textContent || el.innerText || ''); if (txt.includes(target)) return el; }
        const dt = document.querySelector('[data-terminal]'); if (dt && normalizeText(dt.getAttribute('data-terminal') || '') === target) return dt;
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

    // Search submit handling & bindings
    function handleSearchSubmit() {
        const origen = originInput.value.trim();
        const destino = destInput.value.trim();
        hideSuggestionList(originList);
        hideSuggestionList(destList);
        if (origen) { closeModal(); navegarACooperativasDeOrigen(origen, destino); }
    }

    function bindSearchButtons() {
        const selectors = '#search-btn-modal, .search-btn-modal, [data-search-submit]';
        try {
            const buttons = Array.from(document.querySelectorAll(selectors));
            buttons.forEach(btn => {
                if (!btn.__searchBound) { btn.addEventListener('click', function (e) { e.preventDefault(); handleSearchSubmit(); }); btn.__searchBound = true; }
            });
        } catch (e) { /* ignore */ }

        if (!window.__search_delegate_bound) {
            document.addEventListener('click', function (e) {
                const btn = e.target && e.target.closest ? e.target.closest(selectors) : null;
                if (btn) { e.preventDefault(); handleSearchSubmit(); }
            });
            window.__search_delegate_bound = true;
        }
    }
    bindSearchButtons();
    setTimeout(bindSearchButtons, 500);

    // forms / enter handling
    document.addEventListener('submit', function (e) {
        if (!e.target) return;
        if (e.target.matches('#search-form, .search-form') || e.target.closest('#search-modal')) { e.preventDefault(); handleSearchSubmit(); }
    });
    originInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && originList.style.display === 'none') { e.preventDefault(); handleSearchSubmit(); } });
    destInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && destList.style.display === 'none') { e.preventDefault(); handleSearchSubmit(); } });

    // minimal helper used earlier
    function matchScore(userDest, candidateText) {
        const tUser = tokenize(userDest);
        if (!tUser.length) return 0;
        const tCand = tokenize(candidateText);
        if (!tCand.length) return 0;
        return countTokenMatches(tUser, tCand);
    }

    // expose main function for debugging
    window.__navegarACooperativasDeOrigen = navegarACooperativasDeOrigen;

});