let promos = [];
let precios = []; 
let activeMedios = []; 
let activeCategory = null;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const cat = chip.dataset.category;
            if (activeCategory === cat) {
                activeCategory = null; 
                chip.classList.remove('active');
            } else {
                document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
                activeCategory = cat; 
                chip.classList.add('active');
            }
            buscar();
        });
    });

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const val = chip.dataset.value;
            if (activeMedios.includes(val)) {
                activeMedios = activeMedios.filter(m => m !== val);
                chip.classList.remove('active');
            } else {
                activeMedios.push(val);
                chip.classList.add('active');
            }
            buscar();
        });
    });

    const busquedaIn = document.getElementById('busqueda');
    if (busquedaIn) {
        busquedaIn.addEventListener('input', () => {
            buscar();
        });
    }

    Promise.all([
        fetch('promos.json').then(res => res.json()),
        fetch('precios.json').then(res => res.json())
    ]).then(([promosData, preciosData]) => {
        promos = promosData;
        precios = preciosData;
        syncPaymentFilters();
        buscar();
    });
});

function syncPaymentFilters() {
    const availableMedios = [...new Set(promos.map(p => p.medio_pago))];
    document.querySelectorAll('.chip').forEach(chip => {
        const val = chip.dataset.value;
        const isAvailable = availableMedios.includes(val) || 
                            (val === "Tarjeta" && availableMedios.includes("Tarjeta"));

        if (isAvailable) {
            chip.classList.remove('disabled');
            chip.classList.add('active');
            if (!activeMedios.includes(val)) activeMedios.push(val);
        } else {
            chip.classList.add('disabled');
            chip.classList.remove('active');
            activeMedios = activeMedios.filter(m => m !== val);
        }
    });
}

function buscar() {
    const busquedaElement = document.getElementById('busqueda');
    const busqueda = busquedaElement ? busquedaElement.value : "";
    
    let filtered = promos.filter(p => {
        const busquedaLower = busqueda.toLowerCase();
        const matchesSearch = busqueda === "" || 
                            p.comercio.toLowerCase().includes(busquedaLower) || 
                            (p.detalle && p.detalle.toLowerCase().includes(busquedaLower)) ||
                            p.tags.some(tag => tag.toLowerCase().includes(busquedaLower));
        
        let matchesCategory = !activeCategory;
        if (activeCategory) {
            matchesCategory = p.categoria.toLowerCase() === activeCategory || 
                             p.tags.some(tag => tag.toLowerCase() === activeCategory);
        }

        return matchesSearch && matchesCategory;
    });

    let options = [];
    filtered.forEach(p => {
        if (activeMedios.includes(p.medio_pago) || (p.medio_pago === "Tarjeta" && activeMedios.includes("Tarjeta"))) {
            const benefit = {...p};
            const matchPrice = precios.find(pr => 
                pr.comercio === p.comercio && 
                p.detalle.toLowerCase().includes(pr.producto.toLowerCase())
            );
            if (matchPrice) {
                const discount = parseValue(p.descuento);
                benefit.finalPrice = Math.round(matchPrice.precio * (1 - discount / 100));
            } else {
                benefit.finalPrice = Infinity;
            }
            options.push(benefit);
        }
    });

    let minFinalPrice = Infinity;
    options.forEach(opt => {
        if (opt.finalPrice < minFinalPrice) minFinalPrice = opt.finalPrice;
    });

    let globalBestPerc = 0;
    if (minFinalPrice === Infinity) {
        options.forEach(opt => {
            const val = parseValue(opt.descuento);
            if (val > globalBestPerc) globalBestPerc = val;
        });
    }

    const isSpecialView = busqueda !== "" || activeCategory !== null;
    options.forEach(opt => {
        if (isSpecialView) {
            if (minFinalPrice !== Infinity) {
                opt.isGlobalBest = opt.finalPrice === minFinalPrice;
            } else if (globalBestPerc > 0) {
                opt.isGlobalBest = parseValue(opt.descuento) === globalBestPerc;
            }
        } else {
            opt.isGlobalBest = false;
        }
    });

    options.sort((a, b) => {
        if (a.finalPrice !== Infinity && b.finalPrice !== Infinity) return a.finalPrice - b.finalPrice;
        if (a.finalPrice !== Infinity) return -1;
        if (b.finalPrice !== Infinity) return 1;
        return parseValue(b.descuento) - parseValue(a.descuento);
    });

    render(options);
}

function parseValue(desc) {
    if (desc === "2x1") return 50; 
    const match = desc.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
}

function render(options) {
    const container = document.getElementById('resultados');
    if (!container) return;
    container.innerHTML = "";

    const grouped = {};
    options.forEach(opt => {
        if (!grouped[opt.comercio]) grouped[opt.comercio] = [];
        grouped[opt.comercio].push(opt);
    });

    Object.keys(grouped).forEach(comercio => {
        const merchantBenefits = grouped[comercio];
        const groupDiv = document.createElement('div');
        groupDiv.className = 'merchant-group';

        let benefitsHTML = "";
        merchantBenefits.forEach((benefit, idx) => {
            const isHighlight = idx === 0;
            const globalBestClass = benefit.isGlobalBest ? 'global-best' : '';
            const starIcon = benefit.isGlobalBest ? '<i data-lucide="star" class="star-icon"></i>' : '';
            
            // DYNAMIC BORDER FOR HIGHLIGHT
            const borderStyle = benefit.isGlobalBest ? '1.5px solid var(--accent-green)' : '1px solid rgba(255, 255, 255, 0.05)';

            let priceHUD = "";
            const matchPrice = precios.find(pr => 
                pr.comercio === benefit.comercio && 
                benefit.detalle.toLowerCase().includes(pr.producto.toLowerCase())
            );

            if (matchPrice) {
                const discount = parseValue(benefit.descuento);
                const original = matchPrice.precio;
                const final = benefit.finalPrice;
                const saved = original - final;

                priceHUD = `
                    <div class="price-hero" style="color: #FFD100; font-size: 14px; font-weight: 900; margin-bottom: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 8px;">
                        <span>PAGÁS FINAL: $${final.toLocaleString('es-AR')}</span>
                        <span style="background: rgba(255, 209, 0, 0.15); font-size: 9px; padding: 2px 6px; border-radius: 4px;">AHORRÁS $${saved.toLocaleString('es-AR')}</span>
                    </div>
                `;
            }

            benefitsHTML += `
                <div class="benefit-block ${isHighlight ? 'highlight' : ''} ${globalBestClass}" style="padding: 15px; border-radius: 16px; background: rgba(255, 255, 255, 0.03); border: ${borderStyle}; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                        <span class="label-sm">${benefit.medio_pago} ${starIcon}</span>
                        <span class="tag-mini ${benefit.medio_pago === 'Personal Pay' ? 'purple' : ''} ${benefit.medio_pago === 'MODO' ? 'active-green' : ''}">${benefit.tipo_beneficio}</span>
                    </div>
                    ${priceHUD}
                    <div class="benefit-flex" style="display: flex; align-items: center; gap: 15px; margin: 2px 0;">
                        <div class="benefit-value" style="font-size: 32px; font-weight: 900; line-height: 1;">${benefit.descuento}</div>
                    </div>
                    <div class="benefit-detail" style="font-size: 13px; color: var(--text-muted); line-height: 1.4; margin-top: 5px; margin-bottom: 10px;">${benefit.detalle}</div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <span class="label-sm" style="font-size: 8px;">VIGENCIA: ${benefit.vigencia}</span>
                    </div>
                </div>
            `;
        });

        const isTransport = merchantBenefits[0].categoria === 'transporte';
        const medio = merchantBenefits[0].medio_pago;

        groupDiv.innerHTML = `
            <div class="merchant-name" style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">${comercio}</div>
            ${benefitsHTML}
            <div class="payment-method-bar" style="display: flex; align-items: center; gap: 10px; padding: 12px; background: rgba(255, 255, 255, 0.02); border-radius: 12px; margin: 10px 0; border: 1px dashed rgba(255, 255, 255, 0.1);">
                <i data-lucide="${medio === 'Tarjeta' ? 'credit-card' : 'smartphone'}"></i>
                <span style="font-size: 11px; color: var(--text-muted);">Pagás con <strong>${medio.toUpperCase()}</strong></span>
            </div>
            <div class="actions-container" style="display: flex; gap: 8px; margin-top: 5px;">
                <button class="btn-primary" style="flex: 1; background: var(--accent-green); border: none; padding: 12px 20px; border-radius: 25px; color: var(--bg-deep); font-size: 13px; font-weight: 700; cursor: pointer;">${isTransport ? 'VER DETALLES' : 'VER SUCURSALES'}</button>
            </div>
        `;
        container.appendChild(groupDiv);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}
