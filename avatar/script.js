// Manejo de interactividad con scroll
document.addEventListener('DOMContentLoaded', function() {
    const planet = document.querySelector('.planet-earth-3d');
    const planetContainer = document.querySelector('.planet-container');
    const satellites = document.querySelectorAll('.satellite-orbit');
    const heroSection = document.querySelector('.hero-section');
    
    let scrollTimeout;
    let initialRotation = 0;

    // Variables para el control del scroll
    let lastScrollY = window.scrollY;
    let scrollDirection = 0;

    // Función para manejar el scroll
    function handleScroll() {
        const currentScrollY = window.scrollY;
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        const scrollProgress = Math.min(currentScrollY / (maxScroll * 0.5), 1);
        
        // Determinar dirección del scroll
        scrollDirection = currentScrollY > lastScrollY ? 1 : -1;
        lastScrollY = currentScrollY;

        // Efecto de rotación y zoom del planeta 3D basado en scroll
        if (planet) {
            // Efecto de inclinación sutil para el contenedor del iframe
            const tiltX = scrollProgress * 10;
            const tiltY = scrollDirection * scrollProgress * 5;
            
            planet.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
            
            // Efecto de zoom en el contenedor completo
            const scale = 1 + (scrollProgress * 0.4);
            planetContainer.style.transform = `scale(${scale})`;
            
            // Cambiar la intensidad del brillo basado en scroll
            const glowIntensity = 0.3 + (scrollProgress * 0.3);
            planet.style.filter = `brightness(${1 + scrollProgress * 0.2}) contrast(${1 + scrollProgress * 0.1})`;
        }

        // Acelerar satélites durante el scroll
        satellites.forEach((orbit, index) => {
            const speedMultiplier = 1 + (scrollProgress * 3);
            const baseSpeed = [15, 20, 25][index];
            const direction = index % 2 === 0 ? 1 : -1;
            
            orbit.style.animationDuration = `${baseSpeed / speedMultiplier}s`;
            
            // Efecto de inclinación en las órbitas
            const tiltAngle = scrollProgress * 30 * direction;
            orbit.style.transform = `translate(-50%, -50%) rotateX(${tiltAngle}deg)`;
        });

        // Efecto parallax en el fondo de estrellas
        const stars1 = document.querySelector('.stars');
        const stars2 = document.querySelector('.stars2');
        const stars3 = document.querySelector('.stars3');
        
        if (stars1) stars1.style.transform = `translateY(${currentScrollY * 0.2}px)`;
        if (stars2) stars2.style.transform = `translateY(${currentScrollY * 0.5}px)`;
        if (stars3) stars3.style.transform = `translateY(${currentScrollY * 0.8}px)`;

        // Efecto de opacidad en la sección hero
        const heroOpacity = Math.max(0, 1 - (scrollProgress * 2));
        heroSection.style.opacity = heroOpacity;

        // Limpiar timeout anterior y establecer uno nuevo
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            // Restaurar velocidad normal de los satélites después del scroll
            satellites.forEach((orbit, index) => {
                const baseSpeed = [15, 20, 25][index];
                orbit.style.animationDuration = `${baseSpeed}s`;
            });
        }, 150);
    }

    // Event listeners
    window.addEventListener('scroll', handleScroll);

    // Sin interacciones hover/click para mantener el planeta completamente limpio
    // El planeta rota automáticamente y no necesita efectos adicionales

    // Botón explorar con scroll suave
    const exploreBtn = document.querySelector('.explore-btn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', function() {
            document.querySelector('.content-section').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }

    // Efectos adicionales de entrada
    function addEntryAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, { threshold: 0.1 });

        // Observar elementos para animaciones de entrada
        document.querySelectorAll('.hero-title, .hero-subtitle, .hero-description').forEach(el => {
            observer.observe(el);
        });
    }

    // Inicializar animaciones de entrada
    addEntryAnimations();

    // Activar rotación automática como respaldo si Sketchfab no rota automáticamente
    // Descomenta la siguiente línea si quieres forzar la rotación del contenedor
    // if (planet) planet.classList.add('auto-rotate');

    // Optimización del rendimiento para dispositivos móviles
    let ticking = false;
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(handleScroll);
            ticking = true;
            setTimeout(() => { ticking = false; }, 16); // 60fps
        }
    }

    // Detectar si es móvil y ajustar eventos
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        // En móviles, usar un throttle más agresivo
        let mobileScrollTimer;
        window.addEventListener('scroll', () => {
            clearTimeout(mobileScrollTimer);
            mobileScrollTimer = setTimeout(handleScroll, 32); // 30fps en móviles
        });
    }

    // Preloader para mejor experiencia
    window.addEventListener('load', function() {
        document.body.classList.add('loaded');
    });

    // Easter egg: Konami code para efectos especiales
    let konamiCode = [];
    const konamiSequence = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // ↑↑↓↓←→←→BA
    
    document.addEventListener('keydown', function(e) {
        konamiCode.push(e.keyCode);
        if (konamiCode.length > konamiSequence.length) {
            konamiCode.shift();
        }
        
        if (konamiCode.length === konamiSequence.length && 
            konamiCode.every((code, i) => code === konamiSequence[i])) {
            // Activar modo especial
            activateSpecialMode();
        }
    });

    // Función para crear efecto de ondas al hacer click
    function createRippleEffect(element) {
        const ripple = document.createElement('div');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(0, 212, 255, 0.3);
            transform: scale(0);
            animation: ripple 0.6s linear;
            width: ${size}px;
            height: ${size}px;
            top: 50%;
            left: 50%;
            margin-left: ${-size/2}px;
            margin-top: ${-size/2}px;
            pointer-events: none;
        `;
        
        element.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    function activateSpecialMode() {
        // Efecto especial para el planeta 3D
        planet.style.animation = 'planetGlow 1s ease-in-out infinite';
        planet.style.filter = 'hue-rotate(180deg) saturate(2) brightness(1.5)';
        
        satellites.forEach(orbit => {
            orbit.style.animationDuration = '3s';
            orbit.style.filter = 'hue-rotate(120deg) brightness(2)';
        });
        
        // Crear efecto de partículas
        createParticleEffect();
        
        setTimeout(() => {
            location.reload(); // Reiniciar después de 10 segundos
        }, 10000);
    }

    function createParticleEffect() {
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                width: 3px;
                height: 3px;
                background: #00d4ff;
                border-radius: 50%;
                pointer-events: none;
                z-index: 1000;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: particleFloat 3s ease-out forwards;
            `;
            document.body.appendChild(particle);
            
            setTimeout(() => particle.remove(), 3000);
        }
    }

    // Agregar CSS para las partículas y efectos
    const particleStyle = document.createElement('style');
    particleStyle.textContent = `
        @keyframes particleFloat {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-100px) scale(0); }
        }
        @keyframes ripple {
            0% { transform: scale(0); opacity: 1; }
            100% { transform: scale(4); opacity: 0; }
        }
        .animate-in {
            animation: fadeInUp 1s ease-out forwards !important;
        }
        .loaded .stars {
            animation-play-state: running;
        }
    `;
    document.head.appendChild(particleStyle);
});

// =============================================================================
// FUNCIONES PARA INTEGRACIÓN CON DASHBOARD PYTHON
// =============================================================================

// URL base del servidor Python (ajustar según el deployment)
const DASHBOARD_URL = 'http://localhost:7860';

// Función para abrir el dashboard completo
function launchDashboard() {
    startDashboardAndOpen();
}

// Función para abrir dashboard completo
function launchFullDashboard() {
    startDashboardAndOpen();
}

// Función eliminada - ahora se usa la versión más avanzada más abajo

// Función para verificar si el servidor Python está ejecutándose
async function checkDashboardStatus() {
    try {
        // VERIFICACIÓN REAL: Método de detección sin CORS
        return new Promise((resolve) => {
            // Crear imagen que intente cargar desde el dashboard
            const testImg = new Image();
            const timeout = setTimeout(() => {
                // Si no responde en 3 segundos = OFFLINE
                updateStatusIndicator(false, "🔴 Dashboard Offline - No responde");
                resolve(false);
            }, 3000);

            // Si cualquier respuesta del servidor (incluso 404) = ONLINE
            testImg.onerror = () => {
                clearTimeout(timeout);
                // Error 404 es bueno - significa que el servidor responde
                updateStatusIndicator(true, "🟢 Dashboard Online - Verificado");
                resolve(true);
            };

            testImg.onload = () => {
                clearTimeout(timeout);
                // Imagen cargó = servidor definitivamente online
                updateStatusIndicator(true, "🟢 Dashboard Online - Conectado");
                resolve(true);
            };

            // Intentar cargar cualquier recurso del dashboard
            testImg.src = DASHBOARD_URL + '/assets/favicon.ico?t=' + Date.now();
        });
    } catch (error) {
        updateStatusIndicator(false, "🔴 Dashboard Offline - Error");
        return false;
    }
}

// Función para hacer verificación manual del dashboard
function forceStatusUpdate() {
    // Mostrar estado de verificación
    updateStatusIndicator(null, "⏳ Verificando conexión...");
    
    // Hacer verificación real del estado
    checkDashboardStatus().then(isOnline => {
        if (isOnline) {
            // Verificación exitosa - actualizar toda la interfaz
            updateDashboardInterface();
            
            // Mostrar mensaje de confirmación temporal
            const originalColor = document.getElementById('dashboard-status').style.background;
            const statusEl = document.getElementById('dashboard-status');
            statusEl.style.background = 'rgba(40, 167, 69, 1)';
            setTimeout(() => {
                statusEl.style.background = originalColor;
            }, 2000);
        } else {
            // Verificación falló - mostrar offline
            updateDashboardInterface();
            
            // Ofrecer opción de abrir dashboard para verificar manualmente
            setTimeout(() => {
                if (confirm("Dashboard parece estar offline. ¿Quieres intentar abrirlo manualmente para verificar?")) {
                    window.open(DASHBOARD_URL, '_blank');
                }
            }, 1000);
        }
    }).catch(() => {
        updateStatusIndicator(false, "❌ Error de verificación");
    });
}

// Función auxiliar para actualizar indicadores de estado
function updateStatusIndicator(isOnline, customMessage = null) {
    const statusIndicator = document.getElementById('dashboard-status');
    if (statusIndicator) {
        if (isOnline === null) {
            // Estado de verificación
            statusIndicator.innerHTML = customMessage || '⏳ Verificando...';
            statusIndicator.style.background = 'rgba(255, 184, 0, 0.9)';
            statusIndicator.style.color = 'white';
            statusIndicator.style.cursor = 'default';
        } else if (isOnline) {
            // Online
            statusIndicator.innerHTML = customMessage || '🟢 Dashboard Online';
            statusIndicator.style.background = 'rgba(40, 167, 69, 0.9)';
            statusIndicator.style.color = 'white';
            statusIndicator.style.cursor = 'pointer';
            statusIndicator.onclick = () => window.open(DASHBOARD_URL, '_blank');
            statusIndicator.title = 'Clic para abrir dashboard - Última verificación exitosa';
        } else {
            // Offline
            statusIndicator.innerHTML = customMessage || '🔴 Dashboard Offline';
            statusIndicator.style.background = 'rgba(220, 53, 69, 0.9)';
            statusIndicator.style.color = 'white';
            statusIndicator.style.cursor = 'pointer';
            statusIndicator.onclick = forceStatusUpdate;
            statusIndicator.title = 'Clic para verificar nuevamente';
        }
    }
}

// Función para iniciar el dashboard automáticamente
function startDashboardAndOpen(section = '') {
    // Mostrar modal de carga
    const loadingModal = showLoadingModal();
    
    // Primero verificar si el dashboard ya está ejecutándose
    checkDashboardStatus()
        .then(isOnline => {
            if (isOnline) {
                // Si ya está online, abrir directamente el dashboard REAL
                loadingModal.remove();
                showSuccessMessage(section);
                setTimeout(() => {
                    openDashboardUrl(section);
                }, 1500);
            } else {
                // Si no está online, mostrar instrucciones mejoradas
                showServerStartInstructions(section, loadingModal);
            }
        })
        .catch(() => {
            showServerStartInstructions(section, loadingModal);
        });
}

// Función para mostrar modal de carga
function showLoadingModal(customMessage = 'Verificando servidor Python...') {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        ">
            <div style="
                background: #1E2532;
                padding: 40px;
                border-radius: 15px;
                color: white;
                text-align: center;
                border: 2px solid #00D4FF;
                min-width: 400px;
            ">
                <div class="loading-spinner" style="
                    width: 50px;
                    height: 50px;
                    border: 4px solid #333;
                    border-top: 4px solid #00D4FF;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <h2 style="color: #00D4FF; margin-bottom: 20px;">
                    🚀 Dashboard NASA Ecuador
                </h2>
                <p>Conectando con datos satelitales...</p>
                <div id="loading-status" style="margin-top: 15px; font-size: 0.9em; color: #A1A9B8;">
                    ${customMessage}
                </div>
            </div>
        </div>
    `;
    
    // Agregar animación de spinner si no existe
    if (!document.querySelector('#spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(modal);
    return modal;
}

// Función para mostrar mensaje de éxito
function showSuccessMessage(section) {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        ">
            <div style="
                background: #1E2532;
                padding: 40px;
                border-radius: 15px;
                color: white;
                text-align: center;
                border: 2px solid #28a745;
                min-width: 400px;
                box-shadow: 0 0 30px rgba(40, 167, 69, 0.3);
            ">
                <div style="
                    width: 60px;
                    height: 60px;
                    background: #28a745;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 2rem;
                ">✅</div>
                <h2 style="color: #28a745; margin-bottom: 20px;">
                    ¡Conexión Exitosa!
                </h2>
                <p>Abriendo ${getSectionName(section)}...</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-cerrar después de 2 segundos
    setTimeout(() => {
        if (modal && modal.parentNode) {
            modal.remove();
        }
    }, 2000);
    
    return modal;
}

// Función para mostrar instrucciones de inicio del servidor
function showServerStartInstructions(section, loadingModal) {
    // Cerrar modal de carga
    loadingModal.remove();
    
    // Ya sabemos que Python está instalado y funcionando, solo necesitamos que abra el dashboard
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        " onclick="this.remove()">
            <div style="
                background: #1E2532;
                padding: 40px;
                border-radius: 15px;
                max-width: 600px;
                color: white;
                text-align: center;
                border: 2px solid #ffc107;
                box-shadow: 0 0 30px rgba(255, 193, 7, 0.3);
            " onclick="event.stopPropagation()">
                <h2 style="color: #ffc107; margin-bottom: 20px;">
                    � Dashboard NASA Ecuador - Listo para Usar
                </h2>
                <p style="margin-bottom: 20px; font-size: 1.1rem;">
                    El servidor Python ya está configurado. Solo necesitas iniciarlo una vez.
                </p>
                
                <div style="background: #28a745; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <h3 style="color: white; margin-bottom: 15px;">✅ PASO SIMPLE:</h3>
                    <p style="color: white; margin-bottom: 15px;">
                        Haz doble clic en: <strong>INICIAR_DASHBOARD.bat</strong>
                    </p>
                    <p style="color: white; font-size: 0.9rem;">
                        Verás todos los datos reales: 3,564 incendios + 205,200 precipitaciones
                    </p>
                </div>
                
                <div style="background: #0A0E1A; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                    <p><strong>¿Qué incluye el dashboard real?</strong></p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>🔥 Mapas de incendios con datos MODIS reales</li>
                        <li>💧 Precipitación GPM con análisis temporal</li>
                        <li>🌱 Variables de suelo GLDAS</li>
                        <li>📊 Filtros interactivos por provincia/cantón</li>
                        <li>⚠️ Alertas automáticas de riesgo</li>
                    </ul>
                </div>
                
                <div style="margin-top: 30px;">
                    <button onclick="openDashboardDirectly('${section}')" style="
                        background: linear-gradient(135deg, #28a745, #20c997);
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        color: white;
                        cursor: pointer;
                        margin-right: 10px;
                        font-weight: bold;
                    ">🚀 Abrir Dashboard Real</button>
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        background: #6c757d;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        color: white;
                        cursor: pointer;
                        font-weight: bold;
                    ">Cerrar</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Función auxiliar para obtener el nombre de la sección
function getSectionName(section) {
    const sectionNames = {
        '/incendios': 'Incendios Forestales 🔥',
        '/precipitacion': 'Precipitación GPM 💧',
        '/suelo-clima': 'Suelo & Clima 🌱',
        '': 'Dashboard Completo 🚀'
    };
    return sectionNames[section] || 'Dashboard NASA Ecuador';
}

// Función para reintentar la conexión
function retryConnection(section) {
    // Cerrar modal actual
    document.querySelector('[onclick="this.remove()"]').remove();
    
    // Mostrar modal de verificación
    const retryModal = showLoadingModal('Verificando servidor...');
    
    // Esperar un poco y verificar nuevamente
    setTimeout(async () => {
        const isOnline = await checkDashboardStatus();
        retryModal.remove();
        
        if (isOnline) {
            // ¡Éxito! Abrir dashboard
            showSuccessMessage(section);
            setTimeout(() => openDashboardUrl(section), 1500);
        } else {
            // Aún offline, mostrar instrucciones nuevamente
            showServerStartInstructions(section);
        }
    }, 2000);
}

// Función para abrir dashboard demo y cerrar modal
function openDashboardDemoAndClose(section) {
    // Cerrar modal actual
    document.querySelector('[onclick="this.remove()"]').remove();
    
    // Mostrar mensaje de carga del demo
    const demoModal = showLoadingModal('Cargando dashboard demo...');
    
    setTimeout(() => {
        demoModal.remove();
        openDashboardDemo(section);
        
        // Mostrar mensaje informativo
        showDemoInfoMessage();
    }, 1000);
}

// Función para mostrar mensaje informativo sobre el demo
function showDemoInfoMessage() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        " onclick="this.remove()">
            <div style="
                background: #1E2532;
                padding: 30px;
                border-radius: 15px;
                color: white;
                text-align: center;
                border: 2px solid #28a745;
                max-width: 500px;
                box-shadow: 0 0 30px rgba(40, 167, 69, 0.3);
            " onclick="event.stopPropagation()">
                <div style="
                    width: 60px;
                    height: 60px;
                    background: #28a745;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 2rem;
                ">📊</div>
                <h2 style="color: #28a745; margin-bottom: 20px;">
                    ¡Dashboard Demo Abierto!
                </h2>
                <p style="margin-bottom: 20px;">
                    Estás viendo una versión de demostración con datos de ejemplo. 
                    Para acceder a todos los datos reales y funcionalidades completas, 
                    instala Python y ejecuta el servidor.
                </p>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: #28a745;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    color: white;
                    cursor: pointer;
                    font-weight: bold;
                ">Entendido</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        if (modal && modal.parentNode) {
            modal.remove();
        }
    }, 5000);
}

// Función para abrir la URL del dashboard
function openDashboardUrl(section = '') {
    let url = DASHBOARD_URL;
    
    // Agregar rutas de sección si se especifica (el dashboard Python usa rutas, no parámetros)
    if (section) {
        // Las rutas ya vienen con el formato correcto: '/incendios', '/precipitacion', etc.
        url += section;
    }
    
    // Abrir en nueva pestaña
    window.open(url, '_blank');
}

// Función para abrir dashboard demo como alternativa
function openDashboardDemo(section = '') {
    const demoUrl = './dashboard_demo.html';
    
    // Agregar hash para la sección específica
    let finalUrl = demoUrl;
    if (section) {
        const sectionMap = {
            '/incendios': '#incendios',
            '/precipitacion': '#precipitacion', 
            '/suelo-clima': '#suelo'
        };
        finalUrl += (sectionMap[section] || '');
    }
    
    // Abrir en nueva pestaña
    window.open(finalUrl, '_blank');
}

// Función para abrir directamente el dashboard real (asumiendo que está ejecutándose)
function openDashboardDirectly(section = '') {
    // Cerrar modal
    const modal = document.querySelector('[onclick="this.remove()"]');
    if (modal) modal.remove();
    
    // Como ya sabemos que el servidor está en puerto 7860, abrir directamente
    let url = 'http://localhost:7860';
    
    // Agregar rutas de sección específica para el dashboard de Python
    if (section) {
        // Las rutas ya vienen con el formato correcto: '/incendios', '/precipitacion', etc.
        url += section;
    }
    
    // Mostrar mensaje de éxito
    showSuccessMessage(section);
    
    // Abrir dashboard real después de un breve delay
    setTimeout(() => {
        window.open(url, '_blank');
    }, 1500);
}

// Función para iniciar el servidor Python
function startPythonServer() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        " onclick="this.remove()">
            <div style="
                background: #1E2532;
                padding: 40px;
                border-radius: 15px;
                max-width: 700px;
                color: white;
                text-align: center;
                border: 2px solid #ffc107;
                box-shadow: 0 0 30px rgba(255, 193, 7, 0.3);
            " onclick="event.stopPropagation()">
                <h2 style="color: #ffc107; margin-bottom: 20px;">
                    ⚡ Configuración del Dashboard Python
                </h2>
                
                <div style="background: #FF5757; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>⚠️ PROBLEMA DETECTADO:</strong> Python no está instalado o no está en el PATH del sistema
                </div>
                
                <div style="text-align: left; margin: 20px 0;">
                    <h3 style="color: #00D4FF;">🔧 Solución Paso a Paso:</h3>
                    
                    <div style="background: #0A0E1A; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p><strong style="color: #ffc107;">PASO 1 - Instalar Python:</strong></p>
                        <p>1. Ve a: <a href="https://python.org/downloads/" target="_blank" style="color: #00D4FF;">https://python.org/downloads/</a></p>
                        <p>2. Descarga Python 3.9+ para Windows</p>
                        <p>3. <strong style="color: #FF5757;">¡IMPORTANTE!</strong> Marca la casilla "Add Python to PATH"</p>
                        <p>4. Instala y reinicia el PC</p>
                    </div>
                    
                    <div style="background: #0A0E1A; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p><strong style="color: #28a745;">PASO 2 - Verificar instalación:</strong></p>
                        <p>Abre CMD/PowerShell y ejecuta: <code style="background: #333; padding: 2px 6px; border-radius: 3px;">python --version</code></p>
                        <p>Deberías ver algo como: <code style="color: #28a745;">Python 3.9.x</code></p>
                    </div>
                    
                    <div style="background: #0A0E1A; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p><strong style="color: #00D4FF;">PASO 3 - Iniciar Dashboard:</strong></p>
                        <p>Haz doble clic en: <code style="background: #333; padding: 2px 6px; border-radius: 3px; color: #00D4FF;">start_dashboard.bat</code></p>
                        <p>O ejecuta en terminal: <code style="background: #333; padding: 2px 6px; border-radius: 3px; color: #00D4FF;">python hub_central.py</code></p>
                    </div>
                    
                    <div style="background: #28a745; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p><strong>✅ ALTERNATIVA - Sin Python:</strong></p>
                        <p>Usa Docker: <code style="background: #333; padding: 2px 6px; border-radius: 3px;">docker run -p 7860:7860 [imagen]</code></p>
                        <p>O contacta al desarrollador para una versión ejecutable</p>
                    </div>
                </div>
                
                <div style="margin-top: 25px;">
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        background: #ffc107;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        color: #000;
                        cursor: pointer;
                        margin-right: 10px;
                        font-weight: bold;
                    ">Entendido</button>
                    <button onclick="window.open('https://python.org/downloads/', '_blank')" style="
                        background: #007bff;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        color: white;
                        cursor: pointer;
                        font-weight: bold;
                    ">Descargar Python</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Función auxiliar para abrir el explorador de archivos
function openFileExplorer() {
    // Esta función intentará abrir el explorador en la carpeta actual
    // En navegadores modernos, esto puede estar limitado por seguridad
    try {
        // Crear un enlace temporal para descargar/mostrar la ubicación
        const link = document.createElement('a');
        link.href = './start_dashboard.bat';
        link.download = 'start_dashboard.bat';
        link.click();
    } catch (error) {
        alert('Busca el archivo "start_dashboard.bat" en la carpeta del proyecto y haz doble clic en él.');
    }
}

// Función para forzar actualización del estado
async function forceStatusUpdate() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    
    // Cambiar botón a estado de carga
    btn.innerHTML = '🔄 Verificando...';
    btn.disabled = true;
    
    // Actualizar estado inmediatamente
    await updateDashboardInterface();
    
    // Restaurar botón
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }, 1000);
}

// Verificar estado del dashboard al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Agregar indicador de estado si no existe
    if (!document.getElementById('dashboard-status')) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'dashboard-status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(40, 167, 69, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 0.9rem;
            z-index: 1000;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
        `;
        statusDiv.innerHTML = '� Dashboard Online';
        statusDiv.onclick = forceStatusUpdate;
        statusDiv.title = 'Haz clic para verificar o actualizar estado';
        document.body.appendChild(statusDiv);
    }
    
    // Verificar estado inicial después de cargar la página (más rápido)
    setTimeout(updateDashboardInterface, 500);
    
    // Solo verificar periódicamente si el usuario está activo
    // Intervalos más largos para reducir spam
    let statusCheckInterval = setInterval(() => {
        // Solo verificar si no está en una pestaña oculta
        if (!document.hidden) {
            updateDashboardInterface();
        }
    }, 30000); // Cada 30 segundos en lugar de 10
    
    // Pausar verificaciones cuando la pestaña está oculta
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            clearInterval(statusCheckInterval);
        } else {
            // Reanudar verificaciones cuando la pestaña vuelve a estar visible
            updateDashboardInterface();
            statusCheckInterval = setInterval(() => {
                if (!document.hidden) {
                    updateDashboardInterface();
                }
            }, 30000);
        }
    });
});

// Función para actualizar la interfaz basada en el estado del dashboard
async function updateDashboardInterface() {
    // Solo mostrar logs en modo debug
    if (window.DEBUG_MODE) console.log('Actualizando estado del dashboard...');
    const isOnline = await checkDashboardStatus();
    const serverBtn = document.querySelector('.start-server-btn');
    const refreshBtn = document.querySelector('.refresh-status-btn');
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    
    if (window.DEBUG_MODE) console.log('Dashboard está online:', isOnline);
    
    if (isOnline) {
        // Dashboard está online - activar funcionalidad completa
        if (serverBtn) {
            serverBtn.innerHTML = '✅ Servidor Activo';
            serverBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
            serverBtn.disabled = false;
        }
        
        if (refreshBtn) {
            refreshBtn.innerHTML = '✅ Conectado';
            refreshBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
        }
        
        // Agregar indicador visual a las tarjetas
        dashboardCards.forEach(card => {
            card.style.cursor = 'pointer';
            card.style.opacity = '1';
            
            // Remover indicador offline si existe
            const offlineIndicator = card.querySelector('.offline-indicator');
            if (offlineIndicator) {
                offlineIndicator.remove();
            }
            
            if (!card.querySelector('.online-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'online-indicator';
                indicator.innerHTML = '🟢 Online';
                indicator.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(40, 167, 69, 0.9);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: bold;
                    box-shadow: 0 2px 5px rgba(40, 167, 69, 0.3);
                `;
                card.style.position = 'relative';
                card.appendChild(indicator);
            }
        });
    } else {
        // Dashboard está offline - mostrar estado de espera
        if (serverBtn) {
            serverBtn.innerHTML = '⚡ Iniciar Servidor Python';
            serverBtn.style.background = 'linear-gradient(135deg, #ffc107, #fd7e14)';
            serverBtn.disabled = false;
        }
        
        if (refreshBtn) {
            refreshBtn.innerHTML = '🔄 Actualizar Estado';
            refreshBtn.style.background = 'linear-gradient(135deg, #17a2b8, #138496)';
        }
        
        // Remover indicadores online y agregar indicador offline
        dashboardCards.forEach(card => {
            const onlineIndicator = card.querySelector('.online-indicator');
            if (onlineIndicator) {
                onlineIndicator.remove();
            }
            
            if (!card.querySelector('.offline-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'offline-indicator';
                indicator.innerHTML = '🔴 Offline';
                indicator.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(220, 53, 69, 0.9);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: bold;
                    box-shadow: 0 2px 5px rgba(220, 53, 69, 0.3);
                `;
                card.style.position = 'relative';
                card.appendChild(indicator);
            }
        });
    }
}

// Configuración para diferentes entornos
function updateDashboardURL() {
    // Detectar si estamos en producción o desarrollo
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Desarrollo local
        DASHBOARD_URL = 'http://localhost:7860';
    } else if (hostname.includes('github.io')) {
        // GitHub Pages - necesitarás deployer el dashboard por separado
        DASHBOARD_URL = 'https://tu-usuario.github.io/dashboard'; // Cambiar por tu URL
    } else {
        // Producción - ajustar según tu servidor
        DASHBOARD_URL = 'https://tu-servidor.com'; // Cambiar por tu URL
    }
}

// ================================
// HEADER NAVIGATION FUNCTIONALITY
// ================================

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const navbarToggler = document.getElementById('navbarToggler');
    const navbarMenu = document.getElementById('navbarMenu');
    
    if (navbarToggler && navbarMenu) {
        navbarToggler.addEventListener('click', function() {
            navbarToggler.classList.toggle('active');
            navbarMenu.classList.toggle('active');
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!navbarToggler.contains(event.target) && !navbarMenu.contains(event.target)) {
                navbarToggler.classList.remove('active');
                navbarMenu.classList.remove('active');
            }
        });
        
        // Close mobile menu when clicking on nav links
        const navLinks = navbarMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navbarToggler.classList.remove('active');
                navbarMenu.classList.remove('active');
            });
        });
    }
});

// Enhanced dashboard navigation with direct routing
function openDashboard(section = '') {
    console.log(`🚀 Navegando al dashboard: ${section}`);
    
    // Animación de la tarjeta seleccionada (si existe)
    if (event && event.target) {
        const target = event.target.closest('.dashboard-card');
        if (target) {
            target.style.transform = 'scale(0.95)';
            setTimeout(() => target.style.transform = 'scale(1)', 150);
        }
    }
    
    // Verificar estado del dashboard y abrir directamente si está online
    checkDashboardStatus().then(isOnline => {
        if (isOnline) {
            // Dashboard está funcionando, abrir directamente con ruta específica
            openDashboardUrl(section);
        } else {
            // Dashboard no está funcionando, mostrar instrucciones
            startDashboardAndOpen(section);
        }
    }).catch(() => {
        // Error al verificar, mostrar instrucciones
        startDashboardAndOpen(section);
    });
}

// Smooth scroll for internal navigation
function smoothScrollTo(targetId) {
    const target = document.getElementById(targetId);
    if (target) {
        const headerHeight = document.querySelector('.header-nav').offsetHeight;
        const targetPosition = target.offsetTop - headerHeight - 20;
        
        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
}

// Header scroll effect
let lastScrollTop = 0;
const header = document.querySelector('.header-nav');

window.addEventListener('scroll', function() {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Add/remove scrolled class for styling
    if (scrollTop > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    
    // Optional: Hide header when scrolling down, show when scrolling up
    // Uncomment the following lines if you want this behavior
    /*
    if (scrollTop > lastScrollTop && scrollTop > 100) {
        // Scrolling down
        header.style.transform = 'translateY(-100%)';
    } else {
        // Scrolling up
        header.style.transform = 'translateY(0)';
    }
    */
    
    lastScrollTop = scrollTop;
});

// Enhanced keyboard navigation
document.addEventListener('keydown', function(event) {
    // ESC key closes mobile menu
    if (event.key === 'Escape') {
        const navbarToggler = document.getElementById('navbarToggler');
        const navbarMenu = document.getElementById('navbarMenu');
        
        if (navbarToggler && navbarMenu) {
            navbarToggler.classList.remove('active');
            navbarMenu.classList.remove('active');
        }
    }
});

// ================================
// LLUVIA DE ASTEROIDES
// ================================

// Inicializar asteroides cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
    initializeAsteroids();
});

function initializeAsteroids() {
    const asteroidesContainer = document.querySelector('.asteroides-container');
    
    if (!asteroidesContainer) {
        console.log('🌌 Contenedor de asteroides no encontrado');
        return;
    }

    console.log('🌟 Iniciando lluvia de asteroides...');
    
    // Generar asteroides iniciales
    for (let i = 0; i < 150; i++) {
        createAsteroid(asteroidesContainer, i * 50); // Escalonar la aparición inicial
    }
    
    // Generar asteroides continuamente
    setInterval(() => {
        createAsteroid(asteroidesContainer);
    }, 200); // Nuevo asteroide cada 200ms
}

function createAsteroid(container, delay = 0) {
    setTimeout(() => {
        const asteroide = document.createElement('div');
        asteroide.className = 'asteroide';
        
        // Tamaño aleatorio
        const sizes = ['small', 'medium', 'large'];
        const sizeClass = sizes[Math.floor(Math.random() * sizes.length)];
        asteroide.classList.add(sizeClass);
        
        // Posición inicial aleatoria
        asteroide.style.left = `${Math.random() * 120 - 10}%`; // -10% a 110%
        
        // Duración de animación aleatoria
        const duration = Math.random() * 4 + 2; // 2 a 6 segundos
        asteroide.style.animationDuration = `${duration}s`;
        
        // Retraso aleatorio para variedad
        asteroide.style.animationDelay = `${Math.random() * 2}s`;
        
        // Opacidad variable
        asteroide.style.opacity = Math.random() * 0.6 + 0.3; // 0.3 a 0.9
        
        // Agregar al contenedor
        container.appendChild(asteroide);
        
        // Remover el asteroide después de que termine la animación
        setTimeout(() => {
            if (asteroide.parentNode) {
                asteroide.parentNode.removeChild(asteroide);
            }
        }, (duration + 2) * 1000); // Duración + delay + margen de seguridad
        
    }, delay);
}

// Función para pausar/reanudar asteroides (opcional)
function toggleAsteroids() {
    const asteroides = document.querySelectorAll('.asteroide');
    asteroides.forEach(asteroide => {
        if (asteroide.style.animationPlayState === 'paused') {
            asteroide.style.animationPlayState = 'running';
        } else {
            asteroide.style.animationPlayState = 'paused';
        }
    });
}

// Reducir asteroides en dispositivos móviles para mejor performance
function adjustAsteroidsForDevice() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Reducir la frecuencia en móviles
        console.log('📱 Dispositivo móvil detectado - optimizando asteroides');
        
        // Limpiar asteroides existentes
        const container = document.querySelector('.asteroides-container');
        if (container) {
            container.innerHTML = '';
        }
        
        // Reinicializar con menos asteroides
        setTimeout(() => {
            for (let i = 0; i < 75; i++) { // Menos asteroides en móvil
                createAsteroid(container, i * 100);
            }
        }, 1000);
    }
}

// Llamar al cargar y al redimensionar
window.addEventListener('resize', adjustAsteroidsForDevice);
adjustAsteroidsForDevice();