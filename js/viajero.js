// viajero.js - scaffold para la sección Ruta del Viajero
window.viajerosData = null;

async function loadViajero() {
  try {
    const res = await fetch('viajeros.json?v=20241001', { cache: 'no-cache' });
    window.viajerosData = await res.json();
    // index places by id for fast lookup
    window.viajerosById = {};
    (window.viajerosData.places || []).forEach(p => { window.viajerosById[p.id] = p; });
    console.debug('viajero: loaded', window.viajerosData);
  } catch (e) {
    console.error('viajero: failed to load viajeros.json', e);
    window.viajerosData = { places: [], placements: { home: [], provincias: {}, defaults: { places: [] } } };
    window.viajerosById = {};
  }
}

function renderViajeroForTerminal(arg1, arg2) {
  // API: renderViajeroForTerminal(terminalId, provinceId)
  // Backwards-compatible: if arg1 is a selector string, try to use it (legacy callers).
  let terminalId = null;
  let provinceId = null;
  if (typeof arg1 === 'string' && arg1.trim().startsWith('#')) {
    // legacy: selector provided, ignore and fall back to ids if possible from arg2
    // try to detect ids in arg2/arg3 usage (not available here), so just abort
    // Prefer current usage: renderViajeroForTerminal(terminalId, provinceId)
    return;
  } else {
    terminalId = arg1;
    provinceId = arg2;
  }

  // Determine which places apply for this terminal via viajeros.json placements
  const coopSection = document.getElementById('cooperative-section');
  if (!coopSection) return;

  const vd = window.viajerosData || { places: [], placements: { home: [], provincias: {}, defaults: { places: [] } } };
  console.debug('viajero.render start', { terminalId, provinceId, hasData: !!window.viajerosData });
  console.debug('viajero.placements snapshot', vd.placements);
  // gather place ids: terminal -> province -> home -> defaults
  let placeIds = [];
  try {
    const provMap = vd.placements && vd.placements.provincias ? vd.placements.provincias : {};
    if (provinceId && provMap[provinceId]) {
      const p = provMap[provinceId];
      console.debug('viajero: province placement object', p);
      // places assigned to province
      if (Array.isArray(p.places)) placeIds = placeIds.concat(p.places);
      // terminal-specific
      if (p.terminales && terminalId && Array.isArray(p.terminales[terminalId])) placeIds = placeIds.concat(p.terminales[terminalId]);
    }
    // fallback to home
    if (placeIds.length === 0 && Array.isArray(vd.placements && vd.placements.home)) placeIds = placeIds.concat(vd.placements.home || []);
    // fallback to defaults
    if (placeIds.length === 0 && Array.isArray(vd.placements && vd.placements.defaults && vd.placements.defaults.places)) placeIds = placeIds.concat(vd.placements.defaults.places || []);
  } catch (e) { console.warn('viajero: error resolving placements', e); }

  // dedupe and map to place objects
  const uniqIds = Array.from(new Set(placeIds)).slice(0, 10);
  console.debug('viajero: resolved uniqIds', uniqIds);
  const places = uniqIds.map(id => window.viajerosById && window.viajerosById[id]).filter(Boolean).slice(0, 5);
  console.debug('viajero: mapped places', places.map(p => p && p.id));

  // If there are no places to show, remove any existing section and exit
  if (!places || places.length === 0) {
    const existing = document.getElementById('viajero-section');
    if (existing) existing.remove();
    console.debug('viajero: no places found for', { terminalId, provinceId }, '— section removed');
    return;
  }

  // Create section only when we have places
  const existing = document.getElementById('viajero-section');
  if (existing) existing.remove();

  const section = document.createElement('section');
  section.id = 'viajero-section';
  section.className = 'section viajero-section active-section';
  section.innerHTML = `
    <div class="viajero-inner">
      <div class="viajero-header">
        <h2><i class="fas fa-compass"></i> Ruta del viajero</h2>
        <p class="viajero-sub">Top recomendaciones para este terminal</p>
      </div>
      <div class="viajero-list" id="viajero-list"></div>
    </div>
  `;

  // Insert the new section after the cooperative section
  coopSection.parentNode.insertBefore(section, coopSection.nextSibling);

  const listEl = section.querySelector('#viajero-list');

  // Render a main heading and subtitle as requested
  const mainTitle = document.createElement('h3');
  mainTitle.className = 'viajero-main-title';
  mainTitle.textContent = '¿Ya te vas? No te vayas sin antes visitar estos lugares recomendados';
  listEl.appendChild(mainTitle);
  const catGrid = document.createElement('div');
  catGrid.className = 'viajero-cat-grid';
  listEl.appendChild(catGrid);

  places.forEach((p, index) => {
    // 🧨 NUCLEAR: Cache-busting específico para imágenes de viajeros
    const isChrome = /Chrome/.test(navigator.userAgent);
    let imgSrc = p.imagen || 'img/coop/default.png';
    
    if (isChrome && imgSrc.includes('anuncios/')) {
      // Solo aplicar nuclear a imágenes de anuncios en Chrome
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const nuclear = Math.floor(Math.random() * 999999);
      
      imgSrc += '?viajero=' + timestamp + '&chrome=1&idx=' + index + '&r=' + randomId + '&nuclear=' + nuclear + '&v=20241001';
      console.log('🧨 VIAJERO NUCLEAR:', p.id, '→', imgSrc);
    } else if (imgSrc.includes('anuncios/')) {
      // Para otros navegadores, cache-busting normal
      imgSrc += '?viajero=' + Date.now() + '&v=20241001';
    }
    
    const el = document.createElement('div');
    el.className = 'viajero-card';
    
    // 🐱 ESPECIAL: Agregar data-attribute para v-bubble-1 (gatito)
    if (p.id === 'v-bubble-1') {
      el.setAttribute('data-viajero-id', 'v-bubble-1');
      console.log('🐱 Contenedor del gatito configurado para:', p.id);
    }
    
    // Generate unique ID for tracking
    const viajeroId = p.id || `viajero-${Date.now()}`;
    const viajeroTitle = p.title || `Viajero ${viajeroId}`;
    
    // 🔍 DEBUG: Construir y verificar la URL final
    const finalUrl = p.links && (p.links.maps || p.links.instagram || p.links.facebook) || '#';
    
    // 🐛 LOG para debug específico de v-bubble-1
    if (p.id === 'v-bubble-1') {
      console.log('🐱 DEBUG v-bubble-1:');
      console.log('  - p.links:', p.links);
      console.log('  - maps:', p.links?.maps);
      console.log('  - instagram:', p.links?.instagram);
      console.log('  - facebook:', p.links?.facebook);
      console.log('  - URL final:', finalUrl);
    }
    
    el.innerHTML = `
      <a class="viajero-link" href="${finalUrl}" target="_blank" rel="noopener noreferrer"
         onclick="console.log('🎯 CLICK en ${viajeroId} - URL: ${finalUrl}'); trackBannerClick({bannerId: '${viajeroId}', bannerType: 'viajero', title: '${viajeroTitle}', placement: 'viajero'}); if ('${finalUrl}' !== '#') { window.open('${finalUrl}', '_blank'); } return false;">
        <div class="viajero-image-wrap"><img src="${imgSrc}" alt="${p.title || ''}" onerror="this.src='img/coop/default.png?fallback=${Date.now()}'"></div>
        <div class="viajero-card-body">
          ${p.header ? `<h4 class="viajero-card-header">${p.header}</h4>` : ''}
          <h5 class="viajero-card-title">${p.title || ''}</h5>
          <p class="viajero-card-desc">${p.description || ''}</p>
        </div>
      </a>
    `;
    catGrid.appendChild(el);
    
    // 🐱 FUNCIONALIDAD ESPECIAL PARA EL GATITO
    if (p.id === 'v-bubble-1') {
      setupCatAnimation(el);
      createCatAnimationContainer(el);
    }
  });
}

// 🐱 CREAR CONTENEDOR DE ANIMACIÓN DEL GATITO
function createCatAnimationContainer(containerElement) {
  console.log('🐱 Creando contenedor de animación del gatito');
  
  // Crear contenedor hermano
  const catContainer = document.createElement('div');
  catContainer.className = 'cat-animation-container';
  catContainer.innerHTML = `
    <!-- Video principal con transparencia -->
    <video 
      class="cat-video" 
      muted 
      playsinline
      style="display: none;"
      oncanplay="this.style.display = 'block'; this.nextElementSibling.style.display = 'none';"
      onerror="this.style.display = 'none'; this.nextElementSibling.style.display = 'block';"
    >
      <source src="img/animations/cat-punch.webm" type="video/webm">
      <source src="img/animations/cat-punch.mp4" type="video/mp4">
    </video>
    
    <!-- GIF fallback -->
    <img 
      class="cat-gif" 
      src="img/animations/cat-punch.gif" 
      alt="Gatito golpeando"
      style="display: block;"
      onerror="this.style.display = 'none';"
    >
  `;
  
  // Agregar al contenedor padre (posición relativa)
  containerElement.style.position = 'relative';
  containerElement.appendChild(catContainer);
  
  console.log('🐱 Contenedor de animación creado');
  return catContainer;
}

// 🐱 FUNCIONES DE ANIMACIÓN DEL GATITO
function setupCatAnimation(containerElement) {
  console.log('🐱 Configurando animación del gatito para Bubble Planet');
  
  // Función para activar la animación completa
  function triggerCatPunch() {
    console.log('🐱 ¡Iniciando secuencia de animación del gatito!');
    
    const catContainer = containerElement.querySelector('.cat-animation-container');
    const catVideo = catContainer?.querySelector('.cat-video');
    const catGif = catContainer?.querySelector('.cat-gif');
    
    if (!catContainer) {
      console.warn('🐱 Contenedor de animación no encontrado');
      return;
    }
    
    // FASE 1: Mostrar el gato apareciendo
    containerElement.classList.add('cat-animation-active');
    catContainer.classList.add('cat-appearing');
    
    // FASE 2: Reproducir video/gif
    if (catVideo && catVideo.style.display !== 'none') {
      catVideo.currentTime = 0;
      catVideo.play().catch(e => console.log('🐱 Video no disponible, usando GIF'));
    }
    
    // FASE 3: Activar animación del contenedor (sincronizado)
    setTimeout(() => {
      containerElement.classList.remove('cat-punch-active');
      containerElement.offsetHeight; // Forzar reflow
      containerElement.classList.add('cat-punch-active');
    }, 500); // 0.5s después de que aparece el gato
    
    // FASE 4: Limpiar después de la animación
    setTimeout(() => {
      containerElement.classList.remove('cat-punch-active', 'cat-animation-active');
      catContainer.classList.remove('cat-appearing');
      
      // Pausar video si está reproduciéndose
      if (catVideo) catVideo.pause();
      
    }, 2500); // 2.5 segundos total
  }
  
  // TESTING: Click manual para probar la animación
  containerElement.addEventListener('click', (e) => {
    // 🐛 FIX: Solo prevenir el comportamiento por defecto si NO es un click en el enlace
    const isLinkClick = e.target.closest('.viajero-link');
    if (!isLinkClick) {
      e.preventDefault();
      triggerCatPunch();
    }
    // Si es click en el enlace, dejar que funcione normalmente
  });
  
  // Auto-animación cada 8 segundos para demo
  const autoAnimation = setInterval(() => {
    // Solo si el elemento sigue en el DOM
    if (document.contains(containerElement)) {
      triggerCatPunch();
    } else {
      clearInterval(autoAnimation);
    }
  }, 8000); // Cada 8 segundos
  
  // Primera animación después de 3 segundos
  setTimeout(triggerCatPunch, 3000);
  
  // Exponer función para control externo (cuando agregues el gato)
  containerElement._triggerCatPunch = triggerCatPunch;
  
  console.log('🐱 Animación del gatito configurada: click manual + auto cada 8s');
}

// 🔍 FUNCIÓN DEBUG PARA ENLACES DE VIAJEROS
window.debugViajeroLinks = function() {
  console.log('🔍 === DEBUG: ENLACES DE VIAJEROS ===');
  
  if (!window.viajeros || !window.viajeros.places) {
    console.error('❌ Datos de viajeros no cargados');
    return;
  }
  
  window.viajeros.places.forEach(place => {
    console.log(`📍 ${place.id}:`, {
      title: place.title,
      links: place.links,
      finalUrl: place.links && (place.links.maps || place.links.instagram || place.links.facebook) || '#'
    });
  });
  
  // Verificación específica de v-bubble-1
  const bubble = window.viajeros.places.find(p => p.id === 'v-bubble-1');
  if (bubble) {
    console.log('🐱 v-bubble-1 DETALLE:', {
      hasLinks: !!bubble.links,
      instagram: bubble.links?.instagram,
      shouldGoTo: bubble.links?.instagram || '#'
    });
    
    // Verificar elemento DOM
    const bubbleElement = document.querySelector('[data-viajero-id="v-bubble-1"] .viajero-link');
    if (bubbleElement) {
      console.log('🔗 Elemento DOM href:', bubbleElement.href);
    }
  }
  
  console.log('=== FIN DEBUG ENLACES ===');
};

// Función pública para activar animación desde fuera
window.triggerCatAnimation = function() {
  const bubbleContainer = document.querySelector('.viajero-card[data-viajero-id="v-bubble-1"]');
  if (bubbleContainer && bubbleContainer._triggerCatPunch) {
    bubbleContainer._triggerCatPunch();
    return true;
  }
  console.warn('🐱 Contenedor del gatito no encontrado');
  return false;
};

// Expose functions
window.loadViajero = loadViajero;
window.renderViajeroForTerminal = renderViajeroForTerminal;
