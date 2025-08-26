/* ========== ANUNCIOS ========== */

// Renderiza un solo anuncio en el contenedor correspondiente
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
    container.innerHTML = `
        <a href="${anuncio.link || '#'}" target="_blank">
            <img src="${anuncio.imagen || 'img/anuncios/default.png'}" alt="Anuncio" style="width:100%;max-width:400px;"
                 onerror="this.onerror=null;this.src='img/anuncios/default.png';">
        </a>
    `;
}

// Convierte el anuncio en array si es necesario, o retorna uno por defecto
function getAnunciosArray(anuncio) {
    if (Array.isArray(anuncio) && anuncio.length > 0) {
        return anuncio;
    }
    if (anuncio && typeof anuncio === 'object' && (anuncio.imagen || anuncio.link)) {
        return [anuncio];
    }
    // Si no hay anuncio, retorna uno por defecto
    return [{
        imagen: "img/anuncios/default.png",
        link: "https://www.facebook.com/ofisolucionesintegrales?locale=es_LA"
    }];
}

/* ========== CAROUSEL DE ANUNCIOS SLIDER ========== */
function renderAdsCarousel(anuncios, type) {
    let container;
    if (type === 'province') {
        container = document.getElementById('province-ads');
    } else if (type === 'terminal') {
        container = document.getElementById('terminal-ads');
    } else if (type === 'cooperative') {
        container = document.getElementById('cooperative-ads');
    }
    if (!container) return;

    // Limpia intervalos previos si existen
    if (container._carouselInterval) {
        clearInterval(container._carouselInterval);
        container._carouselInterval = null;
    }

    if (!anuncios || anuncios.length === 0) {
        container.innerHTML = '';
        return;
    }
    let current = 0;

    // Crea el slider container
    container.innerHTML = `
        <div class="ads-slider" style="overflow:hidden;position:relative;width:100%;max-width:400px;height:auto;">
            <div class="ads-slider-track" style="display:flex;transition:transform 0.6s cubic-bezier(.77,0,.18,1);will-change:transform;">
                ${anuncios.map(ad => `
                    <a href="${ad.link || '#'}" target="_blank" style="flex:0 0 100%;">
                        <img src="${ad.imagen || 'img/anuncios/default.png'}" alt="Anuncio"
                             style="width:100%;max-width:400px;display:block;"
                             onerror="this.onerror=null;this.src='img/anuncios/default.png';">
                    </a>
                `).join('')}
            </div>
        </div>
    `;

    const track = container.querySelector('.ads-slider-track');
    const total = anuncios.length;

    function goTo(idx) {
        track.style.transform = `translateX(-${idx * 100}%)`;
    }

    goTo(current);

    if (total > 1) {
        container._carouselInterval = setInterval(() => {
            current = (current + 1) % total;
            goTo(current);
        }, 5000);
    }
}

/* ========== RENDERIZADO DE ANUNCIOS POR SECCIÓN ========== */

// Renderizar anuncio en HOME (pantalla de provincias)
window.renderHomeAd = function () {
    if (typeof appData === 'undefined') return;
    const anunciosArr = getAnunciosArray(appData.anuncio);
    if (anunciosArr.length > 1) {
        renderAdsCarousel(anunciosArr, 'province');
    } else {
        renderAds('province', anunciosArr[0]);
    }
}

// Renderizar anuncio en pantalla de provincia (pantalla de terminales)
window.renderProvinceAd = function () {
    if (typeof appData === 'undefined' || !appData.currentProvince) return;
    const anunciosArr = getAnunciosArray(appData.currentProvince.anuncio);
    if (anunciosArr.length > 1) {
        renderAdsCarousel(anunciosArr, 'terminal');
    } else {
        renderAds('terminal', anunciosArr[0]);
    }
}

// Renderizar anuncio en pantalla de terminal (pantalla de cooperativas)
window.renderTerminalAd = function () {
    if (typeof appData === 'undefined' || !appData.currentTerminal) return;
    const anunciosArr = getAnunciosArray(appData.currentTerminal.anuncio);
    if (anunciosArr.length > 1) {
        renderAdsCarousel(anunciosArr, 'cooperative');
    } else {
        renderAds('cooperative', anunciosArr[0]);
    }
}