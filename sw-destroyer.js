// SERVICE WORKER NUCLEAR - DESTRUCTOR DE CACHÉ CHROME
console.log('🧨 SERVICE WORKER NUCLEAR ACTIVADO - DESTRUYENDO TODA CACHÉ');

// Eventos de instalación y activación
self.addEventListener('install', event => {
    console.log('🧨 SW: INSTALANDO DESTRUCTOR NUCLEAR');
    self.skipWaiting(); // Forzar activación inmediata
});

self.addEventListener('activate', event => {
    console.log('🧨 SW: ACTIVANDO MODO NUCLEAR - LIMPIANDO CACHÉ');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    console.log('🧨 SW: ELIMINANDO CACHÉ:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            console.log('🧨 SW: TODAS LAS CACHÉS DESTRUIDAS');
            return self.clients.claim(); // Tomar control inmediato
        })
    );
});

// Interceptar TODAS las requests y forzar bypass de caché
self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    // Si es una imagen de anuncios, NUCLEAR BYPASS
    if (url.includes('anuncios/') || url.includes('banner-')) {
        console.log('🧨 SW: INTERCEPTANDO IMAGEN DE ANUNCIO:', url);
        
        event.respondWith(
            fetch(event.request, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }).catch(() => {
                // Si falla, devolver imagen por defecto
                return fetch('/img/anuncios/default.png', { cache: 'no-store' });
            })
        );
        return;
    }
    
    // Para otros recursos, bypass normal
    if (url.includes('.json') || url.includes('.js') || url.includes('.css')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
        );
        return;
    }
    
    // Para todo lo demás, comportamiento normal
    event.respondWith(fetch(event.request));
});

console.log('🧨 SERVICE WORKER NUCLEAR LISTO PARA DESTRUIR CACHÉ DE CHROME');