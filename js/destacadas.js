/* ========== COOPERATIVAS DESTACADAS ========== */

(function () {
  'use strict';

  const container = (window.DOM && window.DOM.featuredCooperative) || document.getElementById('featured-cooperatives') || null;
  const DEFAULT_COOP_LOGO = 'img/terminales/default.png';
  const DEFAULT_COOP_IMG_EMPTY = '';

  function safeParseJSON(str) {
    try { return JSON.parse(str); } catch (e) { return null; }
  }

  // acepta array u objeto (mapa de valores)
  function calculateAverageRating(ratingGlobal) {
    if (!ratingGlobal) return 0;
    if (Array.isArray(ratingGlobal)) {
      if (ratingGlobal.length === 0) return 0;
      const sum = ratingGlobal.reduce((acc, val) => acc + (Number(val) || 0), 0);
      return sum / ratingGlobal.length;
    }
    if (typeof ratingGlobal === 'object') {
      const vals = Object.values(ratingGlobal).map(v => Number(v) || 0).filter(v => !isNaN(v));
      if (!vals.length) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    const n = Number(ratingGlobal);
    return isNaN(n) ? 0 : n;
  }

  function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating - fullStars >= 0.5 ? 1 : 0;
    const emptyStars = Math.max(0, 5 - fullStars - halfStar);
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star" aria-hidden="true"></i>';
    if (halfStar) stars += '<i class="fas fa-star-half-alt" aria-hidden="true"></i>';
    for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star" aria-hidden="true"></i>';
    return `<span class="star-rating">${stars}</span>`;
  }

  function ensureTooltip() {
    // prefer existing tooltip (script.js may have created one)
    let t = (window.DOM && window.DOM.tooltip) || document.getElementById('tooltip');
    if (!t) {
      t = document.createElement('div');
      t.id = 'tooltip';
      t.className = 'tooltip';
      t.style.position = 'absolute';
      t.style.pointerEvents = 'none';
      t.style.opacity = '0';
      document.body.appendChild(t);
    }
    return t;
  }

  function showRatingTooltip(e) {
    const ratingDataRaw = e.currentTarget && e.currentTarget.getAttribute && e.currentTarget.getAttribute('data-rating');
    let ratingObj = safeParseJSON(ratingDataRaw);
    const tooltip = ensureTooltip();
    if (!tooltip) return;
    let html = '';
    if (ratingObj && typeof ratingObj === 'object') {
      html += '<div style="font-weight:600;margin-bottom:4px">Calificaciones</div>';
      Object.entries(ratingObj).forEach(([k, v]) => {
        html += `<div style="font-size:12px">${k}: ${String(v)}</div>`;
      });
    } else {
      html = 'Sin calificaciones';
    }
    tooltip.innerHTML = html;
    tooltip.style.opacity = '1';
    tooltip.style.left = (e.pageX + 10) + 'px';
    tooltip.style.top = (e.pageY - 10) + 'px';
  }

  function hideTooltip() {
    const t = document.getElementById('tooltip');
    if (t) t.style.opacity = '0';
  }

  function addTooltipEvents(el) {
    if (!el) return;
    el.addEventListener('mousemove', function (e) {
      const t = document.getElementById('tooltip');
      if (t && t.style.opacity === '1') {
        t.style.left = (e.pageX + 10) + 'px';
        t.style.top = (e.pageY - 10) + 'px';
      }
    });
    el.addEventListener('mouseleave', hideTooltip);
  }

  function renderFeaturedCooperatives() {
    if (!container) return;
    // seguridad sobre appData
    const provincias = (window.appData && Array.isArray(window.appData.provincias)) ? window.appData.provincias : [];
    container.innerHTML = '';

    const allCoops = [];
    provincias.forEach(provincia => {
      if (!provincia || !Array.isArray(provincia.terminales)) return;
      provincia.terminales.forEach(terminal => {
        if (!terminal || !Array.isArray(terminal.cooperativas)) return;
        terminal.cooperativas.forEach(coop => {
          const mainRoutes = Array.isArray(coop.rutas) ? coop.rutas : [];
          if (mainRoutes.length > 0) {
            const rating = calculateAverageRating(coop.rating_global);
            allCoops.push({
              ...coop,
              terminal: terminal.nombre || '',
              provincia: provincia.nombre || '',
              mainRoutes: mainRoutes,
              rating
            });
          }
        });
      });
    });

    const top = allCoops.sort((a, b) => b.rating - a.rating).slice(0, 3);
    if (!top.length) {
      container.innerHTML = '<div class="no-featured" style="padding:1rem">No hay cooperativas destacadas disponibles.</div>';
      return;
    }

    top.forEach((coop, idx) => {
      const card = document.createElement('div');
      card.className = 'featured-card';

      const logo = coop.logo ? `img/terminales/${coop.logo}` : DEFAULT_COOP_LOGO;
      card.innerHTML = `
        <div class="featured-card-header">
          ${idx === 0 ? '<span class="featured-badge">TOP 1</span>' : ''}
          <div class="featured-coop-info">
            <img src="${logo}" class="featured-coop-logo" alt="${escapeHtml(coop.nombre || '')}">
            <div>
              <h3>${escapeHtml(coop.nombre || '')}</h3>
              <div class="coop-rating" data-rating='${escapeHtml(JSON.stringify(coop.rating_global || {}))}'>
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
                <span class="route-city">${escapeHtml(coop.terminal || '')}</span>
                <i class="fas fa-arrow-right route-arrow" aria-hidden="true"></i>
                <span class="route-city">${escapeHtml(route.destino || '')}</span>
              </div>
              <div class="route-meta">
                <span>${Array.isArray(route.horarios) ? escapeHtml(route.horarios.slice(0, 15).join(' - ')) : ''}</span>
                <span>${route.costo ? '$' + escapeHtml(String(route.costo)) : ''}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // fallback image on error
      const img = card.querySelector('img.featured-coop-logo');
      if (img) {
        img.addEventListener('error', function () {
          this.removeEventListener('error', arguments.callee);
          this.src = DEFAULT_COOP_LOGO;
        });
      }

      const ratingEl = card.querySelector('.coop-rating');
      if (ratingEl) {
        ratingEl.addEventListener('mouseenter', showRatingTooltip);
        ratingEl.addEventListener('mouseleave', hideTooltip);
      }

      addTooltipEvents(card);
      container.appendChild(card);
    });
  }

  // util escapar
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  // export
  window.renderFeaturedCooperatives = renderFeaturedCooperatives;

  // auto-render when DOM ready (if container exists)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { if (container) renderFeaturedCooperatives(); });
  } else {
    if (container) renderFeaturedCooperatives();
  }

})();