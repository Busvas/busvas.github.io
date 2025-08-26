// Array para guardar rutas favoritas
let favoriteRoutes = [];

// Referencias a elementos del modal
const favoriteModal = document.getElementById('favorite-routes-modal');
const favoriteModalHeader = document.querySelector('.favorite-modal-header');
const favoriteList = document.getElementById('favorite-routes-list');
const toggleFavoriteModalBtn = document.getElementById('toggle-favorite-modal');

// Renderiza las rutas favoritas en el modal
function renderFavoriteRoutes() {
  favoriteList.innerHTML = '';
  favoriteRoutes.forEach((route, idx) => {
    const card = document.createElement('div');
    card.className = 'favorite-route-card';

    const info = document.createElement('div');
    info.className = 'favorite-route-info';
    info.innerHTML = `
      <span class="favorite-coop">${route.coop}&rarr;</span>
      <span class="favorite-route">${route.origen} &rarr; ${route.destino}</span>
      <span class="favorite-hour">${route.hora}</span>
      <span class="favorite-price">${route.precio ? '$' + route.precio : ''}</span>
    `;

    // Botón eliminar
    const removeBtn = document.createElement('button');
    removeBtn.className = 'favorite-remove-btn';
    removeBtn.title = 'Eliminar';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = () => {
      favoriteRoutes.splice(idx, 1);
      renderFavoriteRoutes();
      if (favoriteRoutes.length === 0) minimizeFavoriteModal();
    };

    // Botón corazón
    const heartBtn = document.createElement('button');
    heartBtn.className = 'favorite-heart-btn' + (route.favorito ? ' active' : '');
    heartBtn.title = 'Favorito';
    heartBtn.innerHTML = '<i class="fas fa-heart"></i>';
    heartBtn.onclick = () => {
      route.favorito = !route.favorito;
      renderFavoriteRoutes();
    };

    card.appendChild(info);
    card.appendChild(removeBtn);
    card.appendChild(heartBtn);

    favoriteList.appendChild(card);
  });
}

// Expande el modal
function expandFavoriteModal() {
  favoriteModal.classList.remove('minimized');
  favoriteModal.classList.add('expanded');
  toggleFavoriteModalBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
}

// Minimiza el modal
function minimizeFavoriteModal() {
  favoriteModal.classList.remove('expanded');
  favoriteModal.classList.add('minimized');
  toggleFavoriteModalBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
}

// Alterna el estado al hacer clic en la cabecera
favoriteModalHeader.addEventListener('click', function() {
  if (favoriteModal.classList.contains('expanded')) {
    minimizeFavoriteModal();
  } else {
    expandFavoriteModal();
  }
});

// Esta función debe llamarse cuando el usuario haga clic en un horario
function addFavoriteRoute({coop, origen, destino, hora, precio}) {
  // Busca si ya existe
  const idx = favoriteRoutes.findIndex(route =>
    route.coop === coop &&
    route.origen === origen &&
    route.destino === destino &&
    route.hora === hora &&
    route.precio === precio
  );
  if (idx !== -1) {
    // Si existe, elimínalo
    favoriteRoutes.splice(idx, 1);
    renderFavoriteRoutes();
    if (favoriteRoutes.length === 0) minimizeFavoriteModal();
    return;
  }
  // Si no existe, agrégalo
  favoriteRoutes.push({coop, origen, destino, hora, precio, favorito: false});
  renderFavoriteRoutes();
  expandFavoriteModal();
}

// Exporta la función para usarla en otros scripts si es necesario