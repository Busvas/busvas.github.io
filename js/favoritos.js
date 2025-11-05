(function () {
  'use strict';

  const STORAGE_KEY = 'busvas_favorite_routes_v1';
  let favoriteRoutes = [];

  // Element refs
  let favoriteModal = null;
  let favoriteModalHeader = null;
  let favoriteList = null;
  let toggleFavoriteModalBtn = null;

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      favoriteRoutes = raw ? JSON.parse(raw) : [];
    } catch (e) {
      favoriteRoutes = [];
    }
  }
  function saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteRoutes)); } catch (e) {}
  }

  function ensureModalExists() {
    favoriteModal = document.getElementById('favorite-routes-modal');
    if (favoriteModal) {
      favoriteModal.classList.add('favorite-modal');
      favoriteModalHeader = favoriteModal.querySelector('.favorite-modal-header');
      favoriteList = favoriteModal.querySelector('.favorite-routes-list') || favoriteModal.querySelector('#favorite-routes-list');
      toggleFavoriteModalBtn = favoriteModal.querySelector('.toggle-favorite-modal') || favoriteModal.querySelector('#toggle-favorite-modal');
      return;
    }

    // build minimal DOM that relies on favoritos.css (no inline styles)
    favoriteModal = document.createElement('div');
    favoriteModal.id = 'favorite-routes-modal';
    favoriteModal.className = 'favorite-modal minimized';

    favoriteModalHeader = document.createElement('div');
    favoriteModalHeader.className = 'favorite-modal-header';
    favoriteModalHeader.innerHTML = `
      <div class="favorite-modal-title"><i class="fas fa-star" aria-hidden="true"></i><span style="margin-left:.5rem">Favoritos</span></div>
      <div><button class="toggle-favorite-modal" id="toggle-favorite-modal" aria-label="toggle favorites"><i class="fas fa-chevron-up"></i></button></div>
    `;
    toggleFavoriteModalBtn = favoriteModalHeader.querySelector('.toggle-favorite-modal');

    favoriteList = document.createElement('div');
    favoriteList.className = 'favorite-routes-list';
    favoriteList.id = 'favorite-routes-list';

    favoriteModal.appendChild(favoriteModalHeader);
    favoriteModal.appendChild(favoriteList);
    document.body.appendChild(favoriteModal);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  function setTimeActiveForRoute(route, active) {
    try {
      const times = document.querySelectorAll('.time');
      times.forEach(t => {
        const match =
          (t.dataset.coop || t.getAttribute('data-coop') || '') === (route.coop || '') &&
          (t.dataset.origen || t.getAttribute('data-origen') || '') === (route.origen || '') &&
          (t.dataset.destino || t.getAttribute('data-destino') || '') === (route.destino || '') &&
          (t.dataset.hora || t.getAttribute('data-hora') || '') === (route.hora || '') &&
          (t.dataset.precio || t.getAttribute('data-precio') || '') === (route.precio || '');
        if (match) {
          if (active) t.classList.add('active-time');
          else t.classList.remove('active-time');
        }
      });
    } catch (e) { /* ignore */ }
  }

  function renderFavoriteRoutes() {
    if (!favoriteList) return;
    favoriteList.innerHTML = '';

    if (!favoriteRoutes.length) {
      const empty = document.createElement('div');
      empty.className = 'favorite-empty';
      empty.textContent = 'No hay rutas guardadas.';
      favoriteList.appendChild(empty);
      return;
    }

    favoriteRoutes.forEach((route, idx) => {
      const card = document.createElement('div');
      card.className = 'favorite-route-card';

      const info = document.createElement('div');
      info.className = 'favorite-route-info';
      info.innerHTML = `
        <span class="favorite-coop">${escapeHtml(route.coop)}</span>
        <span class="favorite-route">${escapeHtml(route.origen)} → ${escapeHtml(route.destino)}</span>
        <span class="favorite-hour">${escapeHtml(route.hora)}${route.precio ? ' • $' + escapeHtml(route.precio) : ''}</span>
      `;

      const actions = document.createElement('div');
      actions.className = 'favorite-actions';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'favorite-remove-btn';
      removeBtn.title = 'Eliminar';
      removeBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
      removeBtn.addEventListener('click', () => {
        // remove and update visual state for .time
        const removed = favoriteRoutes.splice(idx, 1)[0];
        saveToStorage();
        renderFavoriteRoutes();
        if (removed) setTimeActiveForRoute(removed, false);
        if (!favoriteRoutes.length) minimizeFavoriteModal();
        playSound && playSound('tic'); // <-- agrega esto
      });

      const heartBtn = document.createElement('button');
      heartBtn.className = 'favorite-heart-btn' + (route.favorito ? ' active' : '');
      heartBtn.title = 'Marcar/Desmarcar';
      heartBtn.innerHTML = '<i class="fas fa-heart" aria-hidden="true"></i>';
      heartBtn.addEventListener('click', () => {
        console.log('Heart clicked for route:', route);
        route.favorito = !route.favorito;
        saveToStorage();
        renderFavoriteRoutes(); // Re-render para actualizar visual
        setTimeActiveForRoute(route, !!route.favorito);
      });

      actions.appendChild(removeBtn);
      actions.appendChild(heartBtn);

      card.appendChild(info);
      card.appendChild(actions);
      favoriteList.appendChild(card);
    });
  }

  function expandFavoriteModal() {
    if (!favoriteModal || !toggleFavoriteModalBtn) return;
    favoriteModal.classList.remove('minimized');
    favoriteModal.classList.add('expanded');
    const icon = toggleFavoriteModalBtn.querySelector('i');
    if (icon) icon.className = 'fas fa-chevron-down';
  }

  function minimizeFavoriteModal() {
    if (!favoriteModal || !toggleFavoriteModalBtn) return;
    favoriteModal.classList.remove('expanded');
    favoriteModal.classList.add('minimized');
    const icon = toggleFavoriteModalBtn.querySelector('i');
    if (icon) icon.className = 'fas fa-chevron-up';
  }

  function initEventBindings() {
    if (favoriteModalHeader) {
      favoriteModalHeader.addEventListener('click', (e) => {
        if (e.target.closest('.toggle-favorite-modal')) return;
        if (favoriteModal.classList.contains('expanded')) minimizeFavoriteModal();
        else expandFavoriteModal();
      });
    }
    if (toggleFavoriteModalBtn) {
      toggleFavoriteModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (favoriteModal.classList.contains('expanded')) minimizeFavoriteModal();
        else expandFavoriteModal();
      });
    }

    // Bridge events from script.js
    window.addEventListener('favorite:add', (ev) => {
      const d = ev && ev.detail ? ev.detail : null;
      if (d) addFavoriteRoute(d);
    });
    window.addEventListener('favorite:open', () => expandFavoriteModal());
  }

  // API: addFavoriteRoute (toggle add/remove behavior)
  function addFavoriteRoute(route) {
    if (!route || typeof route !== 'object') return;
    const r = {
      coop: String(route.coop || ''),
      origen: String(route.origen || ''),
      destino: String(route.destino || ''),
      hora: String(route.hora || ''),
      precio: route.precio == null ? '' : String(route.precio),
      favorito: !!route.favorito
    };

    const idx = favoriteRoutes.findIndex(it =>
      it.coop === r.coop &&
      it.origen === r.origen &&
      it.destino === r.destino &&
      it.hora === r.hora &&
      it.precio === r.precio
    );

    if (idx !== -1) {
      // remove existing favorite (toggle behavior)
      const removed = favoriteRoutes.splice(idx, 1)[0];
      saveToStorage();
      renderFavoriteRoutes();
      setTimeActiveForRoute(removed, false);
      if (!favoriteRoutes.length) minimizeFavoriteModal();
      return;
    }

    // add as favorite (mark favorito true)
    r.favorito = true;
    favoriteRoutes.push(r);
    saveToStorage();
    renderFavoriteRoutes();
    setTimeActiveForRoute(r, true);
    expandFavoriteModal();  // Cambio: Expande el modal solo al añadir (al clic en horario)
  }

  function registerGlobals() {
    if (typeof window.addFavoriteRouteImpl !== 'function') window.addFavoriteRouteImpl = addFavoriteRoute;
    if (typeof window.showFavoritesModal !== 'function') window.showFavoritesModal = expandFavoriteModal;
    if (typeof window.addFavoriteRoute !== 'function') window.addFavoriteRoute = addFavoriteRoute;
  }

  function init() {
    loadFromStorage();
    ensureModalExists();
    // Asegurar que no hay z-index inline que sobrescriba tu CSS
    if (favoriteModal && favoriteModal.style && favoriteModal.style.zIndex) {
      favoriteModal.style.zIndex = '';
    }
    initEventBindings();
    registerGlobals();
    renderFavoriteRoutes();
    // ensure .time elements reflect persisted favorito flags
    favoriteRoutes.forEach(r => { if (r.favorito) setTimeActiveForRoute(r, true); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('DOMContentLoaded', function () {
    function initFavoriteButtons(root = document) {
        root.querySelectorAll('.favorite-heart-btn').forEach(btn => {
            // asegurar no activo por defecto
            btn.classList.remove('active');
            if (btn.__fav_bound) return;
            btn.addEventListener('click', function (e) {
                console.log('Heart clicked, toggling active');
                e.preventDefault();
                e.stopPropagation();
                // toggle visual
                btn.classList.toggle('active');
                console.log('New class:', btn.className);
                // opcional: emitir evento para que el resto del sistema guarde el estado
                try { btn.dispatchEvent(new CustomEvent('favorite:toggled', { detail: { active: btn.classList.contains('active') }, bubbles: true })); } catch (err) {}
            });
            btn.__fav_bound = true;
        });
    }

    initFavoriteButtons();

    // re-inicializar cuando el modal cambie contenido
    const favModal = document.querySelector('.favorite-modal');
    if (favModal) {
        favModal.addEventListener('favorite:content-updated', () => initFavoriteButtons(favModal));
        const mo = new MutationObserver(() => initFavoriteButtons(favModal));
        mo.observe(favModal, { childList: true, subtree: true });
    }
});

  function initFavoriteButtons(root = document) {
    const buttons = Array.from((root || document).querySelectorAll('.favorite-heart-btn'));
    buttons.forEach(btn => {
      if (btn.__fav_bound) return;
      // ensure accessible state
      if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.toggle('active');
        btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
        try { btn.dispatchEvent(new CustomEvent('favorite:toggled', { detail: { active: btn.classList.contains('active') }, bubbles: true })); } catch (err) {}
      });

      // keyboard support: Enter / Space
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });

      btn.__fav_bound = true;
    });
  }

  // init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initFavoriteButtons());
  } else {
    initFavoriteButtons();
  }

  // re-init when modal content changes (so dynamically added buttons get handlers)
  const favModal = document.querySelector('.favorite-modal');
  if (favModal) {
    const mo = new MutationObserver(() => initFavoriteButtons(favModal));
    mo.observe(favModal, { childList: true, subtree: true });
  }

  // expose for manual init if needed
  window.initFavoriteButtons = initFavoriteButtons;

  // Cambio: Evento para cerrar con X (mejorado para limpiar todas las rutas)
  const closeFavoritesBtn = document.getElementById('close-favorites');
  if (closeFavoritesBtn) {
    closeFavoritesBtn.addEventListener('click', () => {
      // Limpiar todas las rutas
      favoriteRoutes = [];
      saveToStorage();
      renderFavoriteRoutes();
      minimizeFavoriteModal();  // Cerrar el modal
      console.log('Modal cerrado y todas las rutas eliminadas');
    });
  } else {
    console.warn('⚠️ Elemento #close-favorites no encontrado en el DOM');
  }

  // Ejemplo de modificación: Añadiendo verificaciones antes de añadir event listeners
  const element1 = document.getElementById('some-id-1');  // Reemplaza con el ID real
  if (element1) {  // Añade esta verificación
      element1.addEventListener('click', function() {
          // Tu código aquí
      });
  } else {
      console.warn('favoritos.js: Elemento #some-id-1 no encontrado, saltando event listener.');
  }

  const element2 = document.getElementById('some-id-2');  // Reemplaza con el ID real
  if (element2) {  // Añade esta verificación
      element2.addEventListener('click', function() {
          // Tu código aquí
      });
  } else {
      console.warn('favoritos.js: Elemento #some-id-2 no encontrado, saltando event listener.');
  }

  const playSound = window.playSound || function() {};

})();