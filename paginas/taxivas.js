document.addEventListener('DOMContentLoaded', function () {
    // HEADER ELEMENTS
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const closeSidebar = document.querySelector('.close-sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const provinceListSide = document.getElementById('province-list-side');

    // Botón atrás: ir al index.html
    document.getElementById('back-btn')?.addEventListener('click', function () {
        window.location.href = '/index.html';
    });

    // Logo: ir al index.html
    document.getElementById('logo-link')?.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = '/index.html';
    });

    // Abrir/cerrar sidebar
    sidebarToggle && sidebarToggle.addEventListener('click', function () {
        sidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
    });
    closeSidebar && closeSidebar.addEventListener('click', function () {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    });
    sidebarOverlay && sidebarOverlay.addEventListener('click', function () {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    });

    // Botón inicio en sidebar: ir al index.html
    document.getElementById('sidebar-btn-home')?.addEventListener('click', function () {
        window.location.href = '/index.html';
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    });

    // Provincias en sidebar: ir a la pantalla de provincia en index.html
    provinceListSide && provinceListSide.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', function () {
            const provinciaId = li.getAttribute('data-id');
            if (provinciaId) {
                window.location.href = `/index.html#provincia-${provinciaId}`;
            } else {
                window.location.href = '/index.html';
            }
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    });

    // ========== CARGA DE TAXIVAS.JSON ==========
    fetch('/paginas/taxivas.json')
        .then(response => {
            if (!response.ok) throw new Error('No se pudo cargar taxivas.json');
            return response.json();
        })
        .then(data => {
            window.taxivasData = data;
            renderTaxivasAnuncio(data.anuncio);
            renderTaxiEmpresas(data.empresas);
        })
        .catch(error => {
            console.error('Error cargando taxivas.json:', error);
        });

    // Renderiza el anuncio en el contenedor correspondiente
    function renderTaxivasAnuncio(anuncios) {
        const container = document.getElementById('taxivas-ads');
        if (!container || !anuncios) return;
        const arr = Array.isArray(anuncios) ? anuncios : [anuncios];
        container.innerHTML = arr.map(anuncio => `
            <a href="${anuncio.link}" target="_blank">
                <img src="${anuncio.imagen || '../img/anuncios/default.png'}" alt="Anuncio TaxiVAS"
                     style="width:100%;max-width:400px;display:block;"
                     onerror="this.onerror=null;this.src='../img/anuncios/default.png';">
            </a>
        `).join('');
    }

    // == helpers para teléfonos / whatsapp ==
    const DEFAULT_COUNTRY = '593';
    function sanitizeNumber(raw) {
        if (!raw) return '';
        let s = String(raw).replace(/\D/g, '');    // solo dígitos
        s = s.replace(/^0+/, '');                   // quitar ceros iniciales
        // si parece número local (<=9 dígitos) anteponer country
        if (s && s.length <= 9 && !s.startsWith(DEFAULT_COUNTRY)) s = DEFAULT_COUNTRY + s;
        return s;
    }
    function formatDisplayNumber(digits) {
        if (!digits) return '';
        if (digits.startsWith(DEFAULT_COUNTRY)) {
            const rest = digits.slice(DEFAULT_COUNTRY.length);
            return `+${DEFAULT_COUNTRY} ${rest}`;
        }
        return `+${digits}`;
    }
    function buildWhatsAppHref(digits, fromLabel = 'busvas.com') {
        if (!digits) return '#';
        const msg = encodeURIComponent(`Vengo de ${fromLabel}, quiero información de los horarios`);
        return `https://wa.me/${digits}?text=${msg}`;
    }

    // Renderiza las empresas de taxi puerta a puerta (estructura corregida: h3 directo, ranting con rating-stars y rating-number)
    function renderTaxiEmpresas(empresas) {
        const container = document.getElementById('taxi-empresas-cards');
        if (!container || !empresas) return;
        container.innerHTML = empresas.map(empresa => {
            const rawPhone = empresa.telefono || empresa.phone || '';
            const digits = sanitizeNumber(rawPhone);
            const waHref = digits ? buildWhatsAppHref(digits) : '#';
            const displayPhone = digits ? formatDisplayNumber(digits) : (rawPhone || '');
            const phoneHtml = digits
                ? `<a class="taxi-phone-link" href="${waHref}" target="_blank" rel="noopener noreferrer" title="Enviar WhatsApp">${displayPhone}</a>`
                : (rawPhone ? `<span class="taxi-phone-raw">${rawPhone}</span>` : '');

            const phoneIconHtml = digits
                ? `<a class="taxi-info-icon whatsapp-link" href="${waHref}" target="_blank" rel="noopener noreferrer" title="WhatsApp"><i class="fas fa-phone"></i></a>`
                : '';

            const rating = calculateAverageRating(empresa.rating_global);
            const starsHtml = generateStarRating(rating);

            return `
            <div class="taxi-card">
                <div class="taxi-header">
                    <div class="taxi-logo-container">
                        <img src="${empresa.logo || '../img/taxivas/default.png'}" alt="${empresa.nombre}" class="taxi-logo">
                    </div>
                    <div class="taxi-info-container">
                        <h3 class="taxi-title">${empresa.nombre}</h3>
                        <div class="taxi-rating">
                            <span class="rating-stars">${starsHtml}</span>
                            <span class="rating-number">(${rating.toFixed(1)})</span>
                        </div>
                    </div>
                </div>
                <div class="taxi-body">
                    ${empresa.sitio_web ? `<a href="${empresa.sitio_web}" target="_blank" class="taxi-site">Sitio web</a>` : ''}
                    ${empresa.servicios && empresa.servicios.length > 0 ? `<p class="taxi-services">${empresa.servicios.join(', ')}</p>` : ''}
                    <div class="taxi-ciudades">
                        <strong>Ciudades:</strong>
                        ${empresa.ciudades.map(ciudad => `<span class="taxi-ciudad">${ciudad}</span>`).join('')}
                    </div>
                    ${phoneHtml || phoneIconHtml ? `<div class="taxi-contact-row"><strong>Contacto:</strong> ${phoneHtml} ${phoneIconHtml}</div>` : ''}
                </div>
            </div>
            `;
        }).join('');
    }

    // Helpers para rating
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

    // Renderiza empresas desde paginas/taxivas.json y crea enlaces a WhatsApp
    document.addEventListener('DOMContentLoaded', function () {
      'use strict';

      const container = document.getElementById('taxi-empresas-cards');
      if (!container) return;

      const defaultCountryCode = '593'; // ajustar si hace falta

      function sanitizeNumber(raw) {
        if (!raw) return '';
        let s = String(raw).replace(/\+/g, '').replace(/[^\d]/g, '');
        // quitar ceros iniciales
        s = s.replace(/^0+/, '');
        // si ya contiene country code (ej: 593...) lo dejamos, sino lo anteponemos
        if (!s.startsWith(defaultCountryCode) && s.length <= 10) s = defaultCountryCode + s;
        return s;
      }

      function formatDisplayNumber(digits) {
        if (!digits) return '';
        if (digits.startsWith(defaultCountryCode)) {
          const rest = digits.slice(defaultCountryCode.length);
          // formato básico: +CCC XXXXXXXX
          return `+${defaultCountryCode} ${rest}`;
        }
        return `+${digits}`;
      }

      function isMobileAgent() {
        return /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
      }

      function attachWhatsAppLink(anchor, digits, label) {
        if (!anchor || !digits) return;
        const text = encodeURIComponent(label || '');
        const waWeb = `https://wa.me/${digits}${text ? `?text=${text}` : ''}`;
        const waApp = `whatsapp://send?phone=${digits}${text ? `&text=${text}` : ''}`;
        anchor.href = waWeb;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.addEventListener('click', function (e) {
          // intentar abrir app en móvil; fallback a web
          if (isMobileAgent()) {
            e.preventDefault();
            // intento app
            window.location.href = waApp;
            // fallback a web si app no abre tras 700ms
            setTimeout(() => window.open(waWeb, '_blank'), 700);
          }
          // en escritorio usará waWeb por defecto
        });
      }

      function renderCompanyCard(company) {
        const phoneRaw = company.telefono || company.phone || '';
        const digits = sanitizeNumber(phoneRaw);
        const display = formatDisplayNumber(digits);
        const label = `Hola, estoy consultando sobre ${company.nombre || 'su servicio'}`;

        const rating = calculateAverageRating(company.rating_global || {});
        const starsHtml = generateStarRating(rating);

        const card = document.createElement('article');
        card.className = 'taxi-company-card';
        card.innerHTML = `
          <div class="taxi-header">
            <div class="taxi-logo-container">
              <img src="${company.logo || ''}" alt="${company.nombre || ''}" class="taxi-logo" onerror="this.style.display='none'"/>
            </div>
            <div class="taxi-info-container">
              <h3 class="taxi-name">${company.nombre || ''}</h3>
              <div class="taxi-rating">
                <span class="rating-stars">${starsHtml}</span>
                <span class="rating-number">(${rating.toFixed(1)})</span>
              </div>
            </div>
          </div>
          <div class="taxi-body">
            <p class="taxi-desc">${(company.servicios && company.servicios.join ? company.servicios.join(', ') : company.servicios || '')}</p>
            <div class="taxi-contact">
              <a class="contact-number" aria-label="Enviar WhatsApp al ${display}" title="${display}">${display}</a>
              <a class="contact-whatsapp" aria-label="WhatsApp ${company.nombre || ''}" title="WhatsApp">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.84 11.84 0 0 0 12 0C5.373 0 .01 5.374 .01 12c0 2.112.552 4.093 1.602 5.86L0 24l6.336-1.625A11.93 11.93 0 0 0 12 24c6.627 0 12-5.373 12-12 0-1.85-.438-3.594-1.48-5.12zM12 21.6c-.9 0-1.778-.24-2.54-.69l-.18-.09-3.76.965.98-3.66-.12-.19A8.04 8.04 0 0 1 3.96 12C3.96 7.06 7.06 3.96 12 3.96c4.94 0 8.04 3.1 8.04 8.04 0 4.94-3.1 8.04-8.04 8.04z"/></svg>
              </a>
            </div>
          </div>
        `;

        const waIcon = card.querySelector('.contact-whatsapp');
        const waNumber = card.querySelector('.contact-number');

        if (digits) {
          attachWhatsAppLink(waIcon, digits, label);
          attachWhatsAppLink(waNumber, digits, label);
        } else {
          if (waIcon) waIcon.style.display = 'none';
          if (waNumber) waNumber.style.display = 'none';
        }

        return card;
      }

      // cargar JSON
      fetch('/paginas/taxivas.json')
        .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
        .then(data => {
          const empresas = (data && data.empresas) ? data.empresas : [];
          container.innerHTML = '';
          empresas.forEach(c => container.appendChild(renderCompanyCard(c)));
        })
        .catch(err => {
          console.warn('No se pudo cargar /paginas/taxivas.json', err);
          if (window.taxivasData && Array.isArray(window.taxivasData)) {
            container.innerHTML = '';
            window.taxivasData.forEach(c => container.appendChild(renderCompanyCard(c)));
          }
        });
    });
});