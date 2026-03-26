let promos = [];
let precios = [];
let activeMedios = [];
let activeCategory = null;
let availableEntities = {};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const busquedaIn = document.getElementById('busqueda');
    if (busquedaIn) {
        busquedaIn.addEventListener('input', () => {
            buscar();
        });
        busquedaIn.addEventListener('click', (e) => e.stopPropagation());
    }

    let userBanks = [];

    Promise.all([
        fetch('promos.json').then(res => res.json()),
        fetch('precios.json').then(res => res.json()),
        fetch('categorias.json').then(res => res.ok ? res.json() : {}),
        fetch(`http://localhost:3000/user-banks?t=${Date.now()}`).then(res => res.json()).catch(e => {
            const local = localStorage.getItem('userBanks');
            if (local) return JSON.parse(local);
            return fetch('bancos_usuario.json').then(r => r.json());
        }),
        fetch('entidades_disponibles.json').then(res => res.ok ? res.json() : {})
    ]).then(([promosData, preciosData, catData, userData, entData]) => {
        promos = promosData;
        precios = preciosData;
        userBanks = userData;
        availableEntities = entData;

        if (Object.keys(catData).length > 0) {
            CATEGORY_MAP = catData;
        }

        // --- Sincronizar Filtros con las Tarjetas del Usuario ---
        activeMedios = userBanks.filter(ub => ub.status !== 'inactive').map(ub => {
            const config = availableEntities[ub.id];
            return config ? config.label : ub.id;
        });

        renderUnifiedFilters();
        buscar();
    });

    // --- Lógica de Ocultar Filtros y Footer al Scroll ---
    let lastScroll = 0;
    const filtersRow = document.querySelector('.filters-row');
    const bottomNav = document.querySelector('.bottom-nav');
    
    let wasFiltersOpen = false;
    let wasSearchExpanded = false;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        const searchBox = document.getElementById('search-box');
        const filtersRow = document.querySelector('.filters-row');

        if (currentScroll > 100 && currentScroll > lastScroll) {
            // BAJANDO: Solo minimizamos filtros y footer (Buscador PERSISTENTE)
            if (filtersRow && filtersRow.classList.contains('open-filters')) {
                wasFiltersOpen = true;
                filtersRow.classList.remove('open-filters');
            }
            if (bottomNav) bottomNav.classList.add('hide-footer');
        } else if (currentScroll < lastScroll) {
            // SUBIENDO: Recuperamos filtros si estaban abiertos
            if (wasFiltersOpen && filtersRow) {
                filtersRow.classList.add('open-filters');
                wasFiltersOpen = false;
            }
            if (bottomNav) bottomNav.classList.remove('hide-footer');
        }
        lastScroll = currentScroll;
    }, { passive: true });

    // Reset de memoria al click manual (si el usuario cierra algo, no queremos que el scroll lo reabra)
    document.addEventListener('click', (e) => {
        const box = document.getElementById('search-box');
        const input = document.getElementById('busqueda');
        const filtersRow = document.querySelector('.filters-row');
        
        if (box && !box.contains(e.target)) {
            box.classList.remove('expanded');
            if (input) input.blur();
            wasSearchExpanded = false; // El usuario lo cerró a propósito
        }
    });
});

window.toggleFilters = function(e) {
    if (e) e.stopPropagation();
    const row = document.querySelector('.filters-row');
    const btn = document.getElementById('filter-btn');
    if (row && btn) {
        row.classList.toggle('open-filters');
        // El botón queda activo si la fila está abierta O si hay una categoría aplicada
        if (row.classList.contains('open-filters') || activeCategory) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
};

window.toggleSearch = function(e) {
    if (e) e.stopPropagation();
    const box = document.getElementById('search-box');
    const input = document.getElementById('busqueda');
    if (box) {
        box.classList.toggle('expanded');
        if (box.classList.contains('expanded')) {
            setTimeout(() => input.focus(), 300);
        }
    }
};

let CATEGORY_MAP = {
    desayuno_merienda: { icon: 'coffee',        label: 'Desayuno y Merienda' },
    almuerzo_cena:     { icon: 'utensils',       label: 'Almuerzo y Cena'    },
    comida:            { icon: 'utensils',       label: 'Comida'             },
    compras:           { icon: 'shopping-cart',  label: 'Supermercados'      },
    farmacia:          { icon: 'pill',           label: 'Farmacia'           },
    transporte:        { icon: 'bus',            label: 'Transporte'         },
    moda:              { icon: 'shirt',          label: 'Moda'               },
    entretenimiento:   { icon: 'clapperboard',  label: 'Entretenimiento'    },
    electronica:       { icon: 'cpu',           label: 'Electrónica'        },
    hogar:             { icon: 'home',          label: 'Hogar'              },
};

function renderUnifiedFilters() {
    const container = document.getElementById('unified-filters');
    if (!container) return;
    container.innerHTML = "";

    // 1. BANCOS
    // Nota: Usamos una lista de "todos los posibles activos del usuario" para renderizar chips permanentes
    const userActiveOptions = activeMedios.slice(); // Copia

    userActiveOptions.forEach(medio => {
        const chip = document.createElement('div');
        chip.className = 'chip active';
        chip.textContent = medio;
        chip.onclick = (e) => {
            e.stopPropagation();
            if (activeMedios.includes(medio)) {
                activeMedios = activeMedios.filter(m => m !== medio);
                chip.classList.remove('active');
            } else {
                activeMedios.push(medio);
                chip.classList.add('active');
            }
            buscar();
        };
        container.appendChild(chip);
    });

    // 2. SEPARADOR
    const separator = document.createElement('div');
    separator.className = 'filter-separator';
    container.appendChild(separator);

    // 3. CATEGORÍAS (TOP 4)
    const presentCats = [...new Set(promos.map(p => p.categoria).filter(Boolean))];
    const forcedTop = ['desayuno_merienda', 'comida', 'heladerias', 'transporte'];
    const topCats = [];
    const otherCats = [];

    forcedTop.forEach(cat => { if (presentCats.includes(cat) || CATEGORY_MAP[cat]) topCats.push(cat); });
    presentCats.forEach(cat => { if (!topCats.includes(cat) && CATEGORY_MAP[cat]) otherCats.push(cat); });

    topCats.forEach(cat => {
        const cfg = CATEGORY_MAP[cat] || { icon: 'tag', label: cat };
        const chip = document.createElement('div');
        chip.className = 'cat-chip';
        if (activeCategory === cat) chip.classList.add('active');
        chip.dataset.category = cat;
        chip.innerHTML = `<i data-lucide="${cfg.icon}"></i>`;
        chip.onclick = (e) => {
            e.stopPropagation();
            if (activeCategory === cat) {
                activeCategory = null;
                chip.classList.remove('active');
            } else {
                container.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
                activeCategory = cat;
                chip.classList.add('active');
            }
            buscar();
        };
        container.appendChild(chip);
    });

    // 4. "+" DROPDOWN
    if (otherCats.length > 0) {
        const plus = document.createElement('div');
        plus.className = 'cat-chip';
        plus.innerHTML = '<i data-lucide="plus"></i>';
        plus.id = "plus-cat-btn";
        plus.onclick = (e) => {
            e.stopPropagation();
            const isMenu = document.getElementById('floating-cats-menu');
            if (isMenu) {
                isMenu.remove();
            } else {
                showFloatingCategories(plus, otherCats);
            }
        };
        container.appendChild(plus);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Sincronizar estado del botón de filtros con la categoría activa
    const btn = document.getElementById('filter-btn');
    const fRow = document.querySelector('.filters-row');
    if (btn && fRow) {
        if (activeCategory || fRow.classList.contains('open-filters')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }
}

function showFloatingCategories(anchor, cats) {
    const menu = document.createElement('div');
    menu.id = 'floating-cats-menu';
    menu.className = 'custom-menu-layer';
    menu.style.cssText = `
        display: block; position: fixed; background: var(--bg-deep); 
        border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; 
        padding: 10px; min-width: 200px; box-shadow: 0 20px 40px rgba(0,0,0,0.8); 
        z-index: 99999; backdrop-filter: blur(20px);
    `;

    const rect = anchor.getBoundingClientRect();
    menu.style.top = (rect.bottom + 10) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';

    cats.forEach(cat => {
        const cfg = CATEGORY_MAP[cat] || { icon: 'tag', label: cat };
        const item = document.createElement('div');
        item.style.cssText = 'padding: 12px 15px; display: flex; align-items: center; gap: 10px; color: white; cursor: pointer; border-radius: 12px; font-weight: 700; font-size: 14px;';
        if (activeCategory === cat) item.style.background = 'rgba(160, 100, 255, 0.2)';
        item.innerHTML = `<i data-lucide="${cfg.icon}" style="width:18px; height:18px;"></i> <span>${cfg.label}</span>`;
        
        item.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
            if (activeCategory === cat) {
                activeCategory = null;
            } else {
                activeCategory = cat;
            }
            menu.remove();
            renderUnifiedFilters();
            buscar();
        };
        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    // Cerrar al click afuera
    window.onclick = (e) => { if (!menu.contains(e.target)) menu.remove(); };
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function buscar() {
    const busquedaElement = document.getElementById('busqueda');
    const busqueda = busquedaElement ? busquedaElement.value : "";
    const busquedaLower = busqueda.toLowerCase();

    let filtered = promos.filter(p => {
        if (p.vigencia) {
            const parts = p.vigencia.split('/');
            if (parts.length === 3) {
                let [dd, mm, yyyy] = parts;
                if (yyyy.length === 2) yyyy = "20" + yyyy;
                const expDate = new Date(yyyy, mm - 1, dd);
                if (expDate < new Date().setHours(0,0,0,0)) return false;
            }
        }
        const matchesSearch = busqueda === "" ||
            p.comercio.toLowerCase().includes(busquedaLower) ||
            (p.detalle && p.detalle.toLowerCase().includes(busquedaLower)) ||
            (p.tags && p.tags.some(tag => tag.toLowerCase().includes(busquedaLower)));

        let matchesCategory = !activeCategory;
        if (activeCategory) matchesCategory = p.categoria && p.categoria.toLowerCase() === activeCategory;
        return matchesSearch && matchesCategory;
    });

    let options = [];
    filtered.forEach(p => {
        // MATCH MEJORADO: ¿El banco de la promo está en el filtro activo?
        const matchMedio = activeMedios.some(m => {
            const mLow = m.toLowerCase();
            const pBanco = (p.banco || "").toLowerCase();
            const pMedio = (p.medio_pago || "").toLowerCase();
            const isModo = mLow === "modo" && (p.forma_pago || "").toUpperCase().includes("QR");
            
            // Si el nombre del banco del filtro (ej: "Banco Nación") CONTIENE 
            // el nombre del banco de la promo (ej: "Nación")
            return mLow.includes(pBanco) || 
                   mLow.includes(pMedio) || 
                   pBanco.includes(mLow) || 
                   pMedio.includes(mLow) ||
                   isModo;
        });

        if (matchMedio) {
            const benefit = { ...p };
            const matchPrice = precios.find(pr => pr.comercio === p.comercio && p.detalle.toLowerCase().includes(pr.producto.toLowerCase()));
            if (matchPrice) {
                const discountPercentage = parseValue(p.descuento);
                const original = matchPrice.precio;
                if (p.descuento === "2x1") {
                    benefit.finalPrice = original; benefit.effectivePrice = original / 2; benefit.ahorro = original;
                } else {
                    benefit.finalPrice = Math.round(original * (1 - discountPercentage / 100));
                    benefit.effectivePrice = benefit.finalPrice; benefit.ahorro = original - benefit.finalPrice;
                }
            } else {
                benefit.finalPrice = Infinity; benefit.effectivePrice = Infinity;
            }
            options.push(benefit);
        }
    });

    const todayIdx = (new Date().getDay() + 6) % 7;
    options.forEach(opt => {
        const normDays = normalizeDias(opt.dias);
        opt.isToday = normDays.length === 0 || normDays.includes(todayIdx);
    });

    // Identificar la MEJOR oferta (isGlobalBest)
    const isSpecialView = busqueda !== "" || activeCategory !== null;
    let minEffectivePrice = Infinity;
    let maxDiscount = 0;
    
    const candidates = options.filter(o => o.isToday);
    const pool = candidates.length > 0 ? candidates : options;

    pool.forEach(opt => {
        if (opt.effectivePrice < minEffectivePrice) minEffectivePrice = opt.effectivePrice;
        const val = parseValue(opt.descuento);
        if (val > maxDiscount) maxDiscount = val;
    });

    options.forEach(opt => {
        opt.isGlobalBest = false;
        if (isSpecialView && pool.includes(opt)) {
            if (minEffectivePrice !== Infinity && minEffectivePrice < 500000) { // Umbral razonable para precios reales
                opt.isGlobalBest = opt.effectivePrice === minEffectivePrice;
            } else {
                opt.isGlobalBest = parseValue(opt.descuento) === maxDiscount && maxDiscount > 0;
            }
        }
    });

    options.sort((a, b) => {
        if (a.isToday && !b.isToday) return -1;
        if (!a.isToday && b.isToday) return 1;
        if (a.effectivePrice !== Infinity && b.effectivePrice !== Infinity) return a.effectivePrice - b.effectivePrice;
        return parseValue(b.descuento) - parseValue(a.descuento);
    });

    render(options);
}

function parseValue(desc) {
    if (desc === "2x1") return 50;
    const match = desc.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
}

const DIA_MAP_APP = { lunes:0, martes:1, miercoles:2, jueves:3, viernes:4, sabado:5, domingo:6 };
function normalizeDias(dias) {
    if (!Array.isArray(dias)) return [];
    return dias.map(d => {
        if (typeof d === 'number') return d;
        const key = String(d).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return DIA_MAP_APP[key] ?? -1;
    }).filter(i => i >= 0 && i <= 6);
}

function render(options) {
    const container = document.getElementById('resultados');
    const countContainer = document.getElementById('result-count');
    if (!container) return;
    
    if (countContainer) {
        if (options.length > 0) {
            countContainer.innerHTML = `SE ENCONTRARON <span>${options.length}</span> PROMOCIONES`;
        } else {
            countContainer.innerHTML = "NO SE ENCONTRARON PROMOCIONES";
        }
    }

    container.innerHTML = "";

    const grouped = {};
    options.forEach(opt => { if (!grouped[opt.comercio]) grouped[opt.comercio] = []; grouped[opt.comercio].push(opt); });

    Object.keys(grouped).forEach(comercio => {
        const merchantBenefits = grouped[comercio];
        const groupDiv = document.createElement('div');
        groupDiv.className = 'merchant-group';
        let benefitsHTML = "";
        merchantBenefits.forEach((benefit, idx) => {
            const isHighlight = idx === 0;
            const globalBestClass = benefit.isGlobalBest ? 'global-best' : '';
            const starIcon = benefit.isGlobalBest ? '<i data-lucide="star" class="star-icon"></i>' : '';
            const borderStyle = benefit.isGlobalBest ? '1.5px solid var(--accent-green)' : '1px solid rgba(255, 255, 255, 0.05)';
            let priceHUD = "";
            const matchPrice = precios.find(pr => pr.comercio === benefit.comercio && benefit.detalle.toLowerCase().includes(pr.producto.toLowerCase()));
            if (matchPrice) {
                priceHUD = `
                    <div class="price-hero" style="color: #FFD100; font-size: 14px; font-weight: 900; margin-bottom: 4px; text-transform: uppercase; display: flex; align-items: center; gap: 8px;">
                        <span>PAGÁS FINAL: $${benefit.finalPrice.toLocaleString('es-AR')}</span>
                        <span style="background: rgba(255, 209, 0, 0.15); font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">AHORRÁS $${benefit.ahorro.toLocaleString('es-AR')}</span>
                    </div>
                `;
            }
            const formaPago = (benefit.forma_pago || 'Tarjeta').toUpperCase();
            let icons = [];
            if (formaPago.includes('QR')) icons.push('<i data-lucide="qr-code" style="width: 14px; height: 14px; color: var(--accent-green);"></i>');
            if (formaPago.includes('NFC')) icons.push('<i data-lucide="nfc" style="width: 14px; height: 14px; color: var(--accent-green);"></i>');
            if (formaPago.includes('TARJETA') || icons.length === 0) icons.push('<i data-lucide="credit-card" style="width: 14px; height: 14px; color: var(--accent-green);"></i>');

            benefitsHTML += `
                <div class="benefit-block ${isHighlight ? 'highlight' : ''} ${globalBestClass}" style="padding: 15px; border-radius: 16px; background: rgba(255, 255, 255, 0.03); border: ${borderStyle}; margin-bottom: 12px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                        <span class="label-sm">${(benefit.banco && benefit.banco !== benefit.medio_pago) ? `<span style="color:white; font-weight:900;">${benefit.banco}</span> <span style="color:var(--text-muted); font-weight:500; margin-left:4px;">• ${benefit.medio_pago}</span>` : `<span style="color:white; font-weight:900;">${benefit.banco || benefit.medio_pago}</span>`} ${starIcon}</span>
                        <span class="tag-mini ${benefit.medio_pago.toLowerCase().replace(/\s/g, '-')}">${benefit.tipo_beneficio}</span>
                    </div>
                    ${priceHUD}
                    <div class="benefit-flex" style="display: flex; align-items: center; gap: 15px; margin: 4px 0;">
                        <div class="benefit-value" style="font-size: 32px; font-weight: 900; line-height: 1;">${benefit.descuento}</div>
                    </div>
                    <div class="benefit-detail">${benefit.detalle}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top: 12px; border-top: 1px solid var(--border);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${icons.join('')}
                            <span style="font-size: 11px; font-weight: 800; color: var(--text-muted);">CON ${formaPago}</span>
                        </div>
                        <span class="label-sm">VIGENCIA: ${benefit.vigencia}</span>
                    </div>
                </div>
            `;
        });
        groupDiv.innerHTML = `
            <div class="merchant-name" style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">${comercio}</div>
            ${benefitsHTML}
            <div class="actions-container"><button class="btn-primary" style="flex: 1; background: var(--accent-green); border: none; padding: 12px 20px; border-radius: 25px; color: var(--bg-deep); font-size: 13px; font-weight: 700;">VER SUCURSALES</button></div>
        `;
        container.appendChild(groupDiv);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
