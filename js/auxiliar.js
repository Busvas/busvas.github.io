// Lightweight bridge: placeholders + deferred-call queue so other scripts don't throw
(function () {
    if (window.__aux_loaded) return;
    window.__aux_loaded = true;

    window.__deferredQueue = window.__deferredQueue || [];

    // nombres esperados
    var exports = [
        'showSection', 'navigateTo', 'resetNavigation', 'setupEventListeners',
        'addTooltipEvents', 'setupAccordionEvents', 'updateToggleButtonState',
        'renderTerminals', 'renderCooperatives', 'renderRoutes',
        'renderHomeAd', 'renderProvinceAd', 'renderTerminalAd', 'renderCooperativeAd',
        'addFavoriteRoute', 'toggleAllAccordions'
    ];

    // Guardar implementaciones previas (si las hubiera) ANTES de crear placeholders
    var preExisting = {};
    exports.forEach(function (n) {
        var fn = window[n];
        if (typeof fn === 'function' && !fn.__isPlaceholder) {
            preExisting[n] = fn;
        }
    });

    window.__registerImpl = function (name, fn) {
        if (typeof name !== 'string' || typeof fn !== 'function') return;
        // avoid registering a placeholder as the real impl
        if (fn.__isPlaceholder) return;
        window['__impl_' + name] = fn;
        // create a forwarder that always calls the real impl
        window[name] = function () {
            var impl = window['__impl_' + name];
            if (typeof impl === 'function') return impl.apply(window, arguments);
        };
        // flush queued calls for that name
        if (Array.isArray(window.__deferredQueue) && window.__deferredQueue.length) {
            var remaining = [];
            window.__deferredQueue.forEach(function (entry) {
                if (entry.name === name) {
                    try { fn.apply(window, entry.args); } catch (e) { console.error('deferred call error', name, e); }
                } else {
                    remaining.push(entry);
                }
            });
            window.__deferredQueue = remaining;
        }
    };

    function makePlaceholder(name) {
        var ph = function () {
            var args = Array.prototype.slice.call(arguments);
            var impl = window['__impl_' + name];
            if (typeof impl === 'function') {
                return impl.apply(window, args);
            } else {
                window.__deferredQueue.push({ name: name, args: args });
                return undefined;
            }
        };
        // mark so we don't accidentally register it as real impl
        ph.__isPlaceholder = true;
        // only create placeholder if there's no real function currently
        if (typeof window[name] !== 'function' || window[name].__isPlaceholder) {
            window[name] = ph;
        }
    }

    // crear placeholders (no sobrescribir implementaciones reales)
    exports.forEach(makePlaceholder);

    // registrar las implementaciones que existían antes de cargar auxiliar.js
    Object.keys(preExisting).forEach(function (n) {
        try {
            window.__registerImpl(n, preExisting[n]);
        } catch (e) { /* ignore */ }
    });

})();