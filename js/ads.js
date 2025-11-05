/* ========== ADS (versión optimizada: simple + checks básicos) ========== */

// Renderiza un solo anuncio en el contenedor correspondiente
function renderAds(type, ad) {
    if (!ad || typeof ad !== 'object') return; // Check básico
    let container;
    if (type === 'cooperative') container = document.getElementById('cooperative-ads');
    else if (type === 'terminal') container = document.getElementById('terminal-ads');
    else if (type === 'province') container = document.getElementById('province-ads');
    if (!container) return;

    // NUCLEAR: Parámetros anti-caché extremos para combatir Chrome terco
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const microTime = performance.now();
    const nuclear = Math.floor(Math.random() * 999999);
    const isChrome = /Chrome/.test(navigator.userAgent);

    let imgUrl = (ad.imagen || 'img/anuncios/default.png');
    if (isChrome) {
        // Chrome necesita MÚLTIPLES parámetros únicos para bypass
        imgUrl += '?nuclear=' + timestamp + '&chrome=1&r=' + randomId + '&micro=' + microTime + '&rand=' + nuclear + '&v=20241001&force=' + Date.now();
    } else {
        // Otros navegadores con parámetros normales
        imgUrl += '?t=' + timestamp + '&r=' + randomId + '&v=20241001';
    }

    // Generate unique banner ID for tracking
    const bannerId = ad.id || `${type}-ad-${Date.now()}`;
    const bannerTitle = ad.title || ad.name || `Banner ${type}`;
    
    container.innerHTML = `
        <a href="${ad.link || '#'}" target="_blank" rel="noopener" 
           onclick="trackBannerClick({bannerId: '${bannerId}', bannerType: 'ads', title: '${bannerTitle}', placement: '${type}'}); return true;">
            <img src="${imgUrl}" alt="Ad" style="width:100%;max-width:400px;"
                 onerror="this.src='img/anuncios/default.png?t=${timestamp}';">
        </a>
    `;
}

// Convierte el ad en array si es necesario, o retorna uno por defecto
// Global holders for external ads.json data
window.adsData = window.adsData || null;
window.adsById = window.adsById || {};

/**
 * loadAds - carga el archivo ads.json y construye índices útiles
 * Exponer como window.loadAds para que el boot del app lo pueda awaitear.
 */
window.loadAds = async function loadAds() {
    try {
        const res = await fetch('ads.json?v=20241001');
        if (!res.ok) throw new Error('Failed to fetch ads.json');
        const json = await res.json();
        window.adsData = json || {};
        // index by id if array provided
        window.adsById = {};
        if (Array.isArray(window.adsData.ads)) {
            window.adsData.ads.forEach(ad => {
                if (ad && ad.id) window.adsById[ad.id] = ad;
            });
        }
        return window.adsData;
    } catch (err) {
        console.error('loadAds error', err);
        window.adsData = null;
        window.adsById = {};
        return null;
    }
};

/**
 * getAdsArray - normaliza el valor de ad a un array usable.
 * - ad puede ser: array, object, string (id) o falsy.
 * - placement (optional) ayuda a resolver ads por seccion: 'home'|'province'|'terminal'
 */
function getAdsArray(adRef, placement, provinceId, terminalId) {
    // 1) Already an array of ids or objects
    if (Array.isArray(adRef) && adRef.length > 0) return adRef.map(a => (typeof a === 'string' ? window.adsById?.[a] : a)).filter(Boolean);

    // 2) Inline object single ad
    if (adRef && typeof adRef === 'object' && (adRef.imagen || adRef.image || adRef.link)) return [adRef];

    // 3) String id -> lookup in adsById
    if (typeof adRef === 'string' && adRef.trim() && window.adsById && window.adsById[adRef.trim()]) {
        return [window.adsById[adRef.trim()]];
    }

    // 4) Resolve via placements in ads.json: terminal -> province -> home -> defaults
    try {
        const adData = window.adsData || {};
        const placements = adData.placements || {};

        if (provinceId && terminalId && placements.provincias && placements.provincias[provinceId]) {
            const p = placements.provincias[provinceId];
            if (p.terminales && p.terminales[terminalId] && Array.isArray(p.terminales[terminalId]) && p.terminales[terminalId].length) {
                return p.terminales[terminalId].map(id => window.adsById?.[id]).filter(Boolean);
            }
            if (Array.isArray(p.ads) && p.ads.length) return p.ads.map(id => window.adsById?.[id]).filter(Boolean);
        }

        if (provinceId && placements.provincias && placements.provincias[provinceId]) {
            const p = placements.provincias[provinceId];
            if (Array.isArray(p.ads) && p.ads.length) return p.ads.map(id => window.adsById?.[id]).filter(Boolean);
        }

        const homeItems = (placements.home || []).map(id => window.adsById?.[id]).filter(Boolean);
        if (homeItems.length) return homeItems;

        const defaultItems = (placements.defaults?.ads || []).map(id => window.adsById?.[id]).filter(Boolean);
        if (defaultItems.length) return defaultItems;

        if (Array.isArray(adData.ads) && adData.ads.length) return adData.ads.map(a => (typeof a === 'string' ? window.adsById?.[a] : a)).filter(Boolean);

    } catch (err) {
        console.warn('getAdsArray placements lookup failed', err);
    }

    // fallback
    return [{ imagen: "img/anuncios/default.png", link: "#" }];
}

/* ========== CAROUSEL DE ADS / SLIDER ========== */
function renderAdsCarousel(ads, type) {
    if (!Array.isArray(ads) || ads.length === 0) return;
    let container;
    if (type === 'province') container = document.getElementById('province-ads');
    else if (type === 'terminal') container = document.getElementById('terminal-ads');
    else if (type === 'cooperative') container = document.getElementById('cooperative-ads');
    if (!container) return;

    // Limpia intervalos previos
    if (container._carouselInterval) clearInterval(container._carouselInterval);

    let current = 0;
    // NUCLEAR: Parámetros anti-caché extremos para carousel
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const microTime = performance.now();
    const isChrome = /Chrome/.test(navigator.userAgent);

    container.innerHTML = `
        <div class="ads-slider" style="overflow:hidden;position:relative;width:100%;max-width:400px;">
            <div class="ads-slider-track" style="display:flex;transition:transform 0.6s cubic-bezier(.77,0,.18,1);">
                ${ads.map((ad, index) => {
        const nuclear = Math.floor(Math.random() * 999999);
        let imgSrc = (ad.imagen || 'img/anuncios/default.png');

        if (isChrome) {
            imgSrc += '?nuclear=' + timestamp + '&chrome=1&idx=' + index + '&r=' + randomId + '&micro=' + microTime + '&rand=' + nuclear + '&v=20241001&force=' + Date.now();
        } else {
            imgSrc += '?t=' + timestamp + '&r=' + randomId + '&v=20241001&idx=' + index;
        }

        const bannerId = ad.id || `${type}-carousel-${index}`;
        const bannerTitle = ad.title || ad.name || `Carousel ${type} ${index + 1}`;
        
        return `
                        <a href="${ad.link || '#'}" target="_blank" rel="noopener" style="flex:0 0 100%;"
                           onclick="trackBannerClick({bannerId: '${bannerId}', bannerType: 'ads', title: '${bannerTitle}', placement: '${type}'}); return true;">
                            <img src="${imgSrc}" alt="Ad" style="width:100%;display:block;"
                                 onerror="this.src='img/anuncios/default.png?nuclear=${Date.now()}';">
                        </a>
                    `;
    }).join('')}
            </div>
        </div>
    `;

    const track = container.querySelector('.ads-slider-track');
    const total = ads.length;

    function goTo(idx) { track.style.transform = `translateX(-${idx * 100}%)`; }
    goTo(current);

    if (total > 1) {
        container._carouselInterval = setInterval(() => {
            current = (current + 1) % total;
            goTo(current);
        }, 5000);
    }
}

/* ========== RENDERIZADO DE ADS POR SECCIÓN ========== */

// Renderizar anuncio en HOME
window.renderHomeAd = function () {
    if (typeof appData === 'undefined') return;
    const items = getAdsArray(null, 'home');
    console.debug && console.debug('renderHomeAd -> resolved items:', items.map(i => i.id || i.imagen));
    if (items.length > 1) renderAdsCarousel(items, 'province');
    else renderAds('province', items[0]);
};

// Renderizar anuncio en pantalla de provincia
window.renderProvinceAd = function () {
    if (typeof appData === 'undefined' || !appData.currentProvince) return;
    const items = getAdsArray(null, 'province', appData.currentProvince.id);
    console.debug && console.debug('renderProvinceAd -> province:', appData.currentProvince.id, 'items:', items.map(i => i.id || i.imagen));
    if (items.length > 1) renderAdsCarousel(items, 'terminal');
    else renderAds('terminal', items[0]);
};

// Renderizar anuncio en pantalla de terminal
window.renderTerminalAd = function () {
    if (typeof appData === 'undefined' || !appData.currentTerminal) return;
    const provinceId = appData.currentProvince?.id;
    const terminalId = appData.currentTerminal?.id;
    const items = getAdsArray(null, 'terminal', provinceId, terminalId);
    console.debug && console.debug('renderTerminalAd -> province:', provinceId, 'terminal:', terminalId, 'items:', items.map(i => i.id || i.imagen));
    if (items.length > 1) renderAdsCarousel(items, 'cooperative');
    else renderAds('cooperative', items[0]);
};

// Ensure export names
if (!window.loadAds) window.loadAds = window.loadAds || (async () => { return null; });
if (!window.getAdsArray) window.getAdsArray = getAdsArray;
// Si este script se carga después del boot principal, forzamos re-evaluar el render de anuncios
setTimeout(function () {
    try {
        if (typeof scheduleAdsRender === 'function') scheduleAdsRender();
    } catch (e) { /* ignore */ }
}, 120);