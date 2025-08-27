/* ========== COOPERATIVAS DESTACADAS ========== */

// Asegura que el contenedor existe
const DOM = window.DOM || {};
DOM.featuredCooperative = document.getElementById('featured-cooperatives');

// Calcula el promedio de rating global
function calculateAverageRating(ratingGlobal) {
    if (!ratingGlobal || !Array.isArray(ratingGlobal) || ratingGlobal.length === 0) return 0;
    const sum = ratingGlobal.reduce((acc, val) => acc + val, 0);
    return sum / ratingGlobal.length;
}

// Genera estrellas visuales para el rating
function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star"></i>';
    if (halfStar) stars += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star"></i>';
    return `<span class="star-rating">${stars}</span>`;
}

// Muestra el tooltip de rating
function showRatingTooltip(e) {
    const ratingData = e.currentTarget.getAttribute('data-rating');
    let tooltip = document.getElementById('tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.className = 'tooltip';
        document.body.appendChild(tooltip);
    }
    tooltip.textContent = `Valoraciones: ${ratingData}`;
    tooltip.style.opacity = '1';
    tooltip.style.left = (e.pageX + 10) + 'px';
    tooltip.style.top = (e.pageY - 10) + 'px';
}

// Oculta el tooltip
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) tooltip.style.opacity = '0';
}

// Eventos para tooltips en la card
function addTooltipEvents(card) {
    card.addEventListener('mousemove', function (e) {
        const tooltip = document.getElementById('tooltip');
        if (tooltip && tooltip.style.opacity === '1') {
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY - 10) + 'px';
        }
    });
    card.addEventListener('mouseleave', hideTooltip);
}

// Renderiza las cooperativas destacadas
function renderFeaturedCooperatives() {
    DOM.featuredCooperative.innerHTML = '';

    const allCooperatives = [];
    if (!window.appData || !Array.isArray(appData.provincias)) return;

    appData.provincias.forEach(provincia => {
        if (!provincia.terminales) return;
        provincia.terminales.forEach(terminal => {
            if (!terminal.cooperativas) return;
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

// Exporta la función si necesitas llamarla desde otros archivos
window.renderFeaturedCooperatives = renderFeaturedCooperatives;