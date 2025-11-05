// Mapa: animación y visibilidad

document.addEventListener('DOMContentLoaded', function () {
    const btnMapa = document.getElementById('btn-mapa');
    const containerHome = document.querySelector('.container-home');

    if (btnMapa && containerHome) {
        btnMapa.addEventListener('click', function () {
            const isMapa = containerHome.classList.toggle('show-mapa');
            btnMapa.textContent = isMapa ? 'LISTA' : 'Mapa';
            // Esperar un pequeño tiempo para que el SVG se inserte si es dinámico
            setTimeout(inicializarEventosSVGProvincias, 200);
        });
    }
    // Inicializar al cargar por si el SVG ya está presente
    setTimeout(inicializarEventosSVGProvincias, 200);
});

// --- Vinculación de IDs y click en SVG ---
function normalizarId(id) {
    return String(id)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

function crearMapaVinculacion(provinceIds, svgIds) {
    const mapa = {};
    provinceIds.forEach(provId => {
        const normProv = normalizarId(provId);
        const match = svgIds.find(svgId => normalizarId(svgId).includes(normProv));
        if (match) mapa[match] = provId;
    });
    return mapa;
}

function inicializarClickSVGProvincias() {
    const provinceIds = [
        'p-chimborazo', 'p-bolivar', 'p-pichincha', 'p-el-oro', 'p-guayas', 'p-manabi', 'p-azuay', 'p-loja', 'p-tungurahua', 'p-cotopaxi', 'p-imbabura', 'p-esmeraldas', 'p-santo-domingo-tsachilas', 'p-pastaza', 'p-zamora-chinchipe', 'p-carchi', 'p-morona-santiago', 'p-napo', 'p-sucumbios', 'p-orellana', 'p-galapagos'
    ];

    const svgRoot = document.querySelector('.container-mapa svg');
    if (!svgRoot) return;
    // Solo elementos <path>, <polygon> o <g> con fill y id
    const svgElements = Array.from(svgRoot.querySelectorAll('path[id], polygon[id], g[id]'));
    const svgIds = svgElements.map(el => el.id);

    const mapaSVG = crearMapaVinculacion(provinceIds, svgIds);

    svgElements.forEach(el => {
        // Mejorar: detectar fill por estilo computado si no está en el atributo
        let fill = el.getAttribute('fill');
        if (!fill || fill === 'none' || fill === 'transparent') {
            fill = window.getComputedStyle(el).fill;
        }
        if (!fill || fill === 'none' || fill === 'transparent' || fill === 'rgba(0, 0, 0, 0)') return;
        el.style.cursor = 'pointer';

        // Efecto hover visual para depuración
        let originalFill = fill;
        el.addEventListener('mouseenter', function () {
            originalFill = el.getAttribute('fill') || window.getComputedStyle(el).fill;
            el.setAttribute('fill', '#ffe066'); // Amarillo claro para resaltar
        });
        el.addEventListener('mouseleave', function () {
            el.setAttribute('fill', originalFill);
        });

        const svgId = el.getAttribute('id');
        if (svgId) {
            el.addEventListener('click', function () {
                // Acción al hacer clic: usar el id directamente
                // Busca la tarjeta de provincia y simula el clic
                const card = document.querySelector('.province-grid [data-id*="' + svgId.toLowerCase() + '"]');
                if (card) {
                    card.click();
                } else if (typeof window.selectProvince === 'function') {
                    window.selectProvince(svgId.toLowerCase());
                }
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', inicializarClickSVGProvincias);

// --- Sincronización entre LISTA y MAPA ---
function sincronizarSeleccionProvincia(provinciaId) {
    // Normaliza el ID para buscar en ambos lados
    const normId = normalizarId(provinciaId);
    // Resalta la tarjeta en la lista
    document.querySelectorAll('.province-grid .province-card').forEach(card => {
        if (normalizarId(card.dataset.id) === normId) {
            card.classList.add('seleccionada');
        } else {
            card.classList.remove('seleccionada');
        }
    });
    // Resalta la región en el mapa SVG
    const svgRoot = document.querySelector('.container-mapa svg');
    if (svgRoot) {
        svgRoot.querySelectorAll('path[id], polygon[id], g[id]').forEach(region => {
            if (normalizarId(region.id) === normId) {
                region.classList.add('seleccionada-svg');
            } else {
                region.classList.remove('seleccionada-svg');
            }
        });
    }
}

// Hook para clicks en la lista
function inicializarClickListaProvincias() {
    document.querySelectorAll('.province-grid .province-card').forEach(card => {
        card.addEventListener('click', function () {
            sincronizarSeleccionProvincia(card.dataset.id);
            // Aquí puedes agregar la lógica para mostrar el detalle
            if (typeof window.selectProvince === 'function') {
                window.selectProvince(card.dataset.id);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', inicializarClickListaProvincias);

// Hook para clicks en el mapa SVG (ya existe, solo agregar sincronización)
function inicializarEventosSVGProvincias() {
    const svgRoot = document.querySelector('.container-mapa svg');
    if (svgRoot) {
        const provinciasElements = svgRoot.querySelectorAll('path[id], polygon[id]');
        provinciasElements.forEach(element => {
            const svgId = element.getAttribute('id');
            if (svgId) {
                element.classList.add('provincia-svg-hover');
                element.style.cursor = 'pointer';
                element.addEventListener('click', () => {
                    sincronizarSeleccionProvincia(svgId);
                    // ...lógica existente...
                    const card = document.querySelector('.province-grid [data-id*="' + svgId.toLowerCase() + '"]');
                    if (card) {
                        card.click();
                    } else if (typeof window.selectProvince === 'function') {
                        window.selectProvince(svgId.toLowerCase());
                    }
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', inicializarEventosSVGProvincias);

// --- Cargar SVG y activar clic en provincias ---
document.addEventListener('DOMContentLoaded', function () {
    const svgContainer = document.getElementById('svg-container');
    if (svgContainer) {
        fetch('mapa/mapa.svg')
            .then(response => {
                if (!response.ok) throw new Error('No se pudo cargar el mapa SVG');
                return response.text();
            })
            .then(svgText => {
                svgContainer.innerHTML = svgText;
                const svgRoot = svgContainer.querySelector('svg');
                if (svgRoot) {
                    svgRoot.style.width = '100%';
                    svgRoot.style.height = 'auto';
                    svgRoot.style.display = 'block';
                    const regiones = svgRoot.querySelectorAll('path[id], polygon[id], g[id]');
                    if (regiones.length === 0) {
                        svgContainer.insertAdjacentHTML('beforeend', '<div style="color:red;font-weight:bold;">No se detectaron provincias en el SVG</div>');
                    }
                    regiones.forEach(region => {
                        region.style.cursor = 'pointer';
                        region.addEventListener('click', function () {
                            // Normaliza el ID para buscar la carta exacta
                            const svgIdNorm = normalizarId(region.id);
                            const cards = document.querySelectorAll('.province-grid .province-card');
                            let found = false;
                            cards.forEach(card => {
                                if (normalizarId(card.dataset.id) === svgIdNorm) {
                                    // Resalta la carta y ejecuta la función de detalle
                                    card.classList.add('seleccionada');
                                    if (typeof window.selectProvince === 'function') {
                                        window.selectProvince(card.dataset.id);
                                    } else {
                                        card.click();
                                    }
                                    found = true;
                                } else {
                                    card.classList.remove('seleccionada');
                                }
                            });
                            if (!found) {
                                alert('No se encontró la carta para la provincia: ' + region.id);
                            }
                        });
                    });
                } else {
                    svgContainer.insertAdjacentHTML('beforeend', '<div style="color:red;font-weight:bold;">No se encontró el elemento <svg> en el archivo</div>');
                }
            })
            .catch(error => {
                svgContainer.innerHTML = '<div style="color:red;font-weight:bold;">Error al cargar el mapa SVG</div>';
                console.error('Error al cargar mapa.svg:', error);
            });
    }
});

// --- Clic en provincia SVG ejecuta selectProvince y actualiza appData.currentProvince ---
document.addEventListener('DOMContentLoaded', function () {
    const svgContainer = document.getElementById('svg-container');
    if (svgContainer) {
        fetch('mapa/mapa.svg')
            .then(response => {
                if (!response.ok) throw new Error('No se pudo cargar el mapa SVG');
                return response.text();
            })
            .then(svgText => {
                svgContainer.innerHTML = svgText;
                const svgRoot = svgContainer.querySelector('svg');
                if (svgRoot) {
                    svgRoot.style.width = '100%';
                    svgRoot.style.height = 'auto';
                    svgRoot.style.display = 'block';
                    const regiones = svgRoot.querySelectorAll('path[id], polygon[id], g[id]');
                    if (regiones.length === 0) {
                        svgContainer.insertAdjacentHTML('beforeend', '<div style="color:red;font-weight:bold;">No se detectaron provincias en el SVG</div>');
                    }
                    regiones.forEach(region => {
                        region.style.cursor = 'pointer';
                        region.addEventListener('click', function () {
                            // Normaliza el ID y busca el objeto provincia
                            const provinciaId = normalizarId(region.id);
                            let provinciaObj = null;
                            if (window.appData && Array.isArray(window.appData.provincias)) {
                                provinciaObj = window.appData.provincias.find(p => normalizarId(p.id) === provinciaId);
                                if (provinciaObj) {
                                    window.appData.currentProvince = provinciaObj;
                                }
                            }
                            if (typeof window.selectProvince === 'function') {
                                window.selectProvince(provinciaObj ? provinciaObj.id : provinciaId);
                            } else {
                                alert('Provincia seleccionada: ' + (provinciaObj ? provinciaObj.id : provinciaId));
                            }
                        });
                    });
                } else {
                    svgContainer.insertAdjacentHTML('beforeend', '<div style="color:red;font-weight:bold;">No se encontró el elemento <svg> en el archivo</div>');
                }
            })
            .catch(error => {
                svgContainer.innerHTML = '<div style="color:red;font-weight:bold;">Error al cargar el mapa SVG</div>';
                console.error('Error al cargar mapa.svg:', error);
            });
    }
});

// Observador para detectar el SVG y asignar eventos apenas esté disponible
const observer = new MutationObserver(() => {
    inicializarEventosSVGProvincias();
});
const containerMapa = document.querySelector('.container-mapa');
if (containerMapa) {
    observer.observe(containerMapa, { childList: true, subtree: true });
    // Por si ya está presente al cargar
    setTimeout(inicializarEventosSVGProvincias, 200);
}

// CSS para efecto hover en provincias SVG
const style = document.createElement('style');
style.innerHTML = `
.provincia-svg-hover {
    transition: filter 0.2s;
    filter: brightness(0.7);
}
.provincia-svg-hover:hover {
    filter: brightness(1.2);
}
`;
document.head.appendChild(style);

// CSS para resaltar selección
(function(){
    const style = document.createElement('style');
    style.textContent = `
        .province-card.seleccionada {
            outline: 3px solid #ffe066;
            box-shadow: 0 0 10px #ffe066;
        }
        .seleccionada-svg {
            filter: brightness(1.5) drop-shadow(0 0 8px #ffe066);
            stroke: #ffe066;
            stroke-width: 3;
        }
    `;
    document.head.appendChild(style);
})();
