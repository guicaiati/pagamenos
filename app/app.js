let promos = [];
let activeMedios = [];
let activeCategory = null;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Category Toggle Logic
    document.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const cat = chip.dataset.category;
            if (activeCategory === cat) {
                activeCategory = null; // Toggle Off
                chip.classList.remove('active');
            } else {
                document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
                activeCategory = cat; // Select New
                chip.classList.add('active');
            }
            buscar();
        });
    });

    // Payment Filter Chips
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
    busquedaIn.addEventListener('input', () => {
        buscar();
    });

    fetch('promos.json')
        .then(res => res.json())
        .then(data => {
            promos = data;
            syncPaymentFilters();
            buscar();
        });
});

function syncPaymentFilters() {
    const availableMedios = [...new Set(promos.map(p => p.medio_pago))];
    const container = document.querySelector('.filter-chips');

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

    // Let chips stay in their original order (as per "revert" favor)
    // No reordering logic here unless asked again.
}

function buscar() {
    const busqueda = document.getElementById('busqueda').value;

    let filtered = promos.filter(p => {
        const busquedaLower = busqueda.toLowerCase();

        // Match Search Text
        const matchesSearch = busqueda === "" ||
            p.comercio.toLowerCase().includes(busquedaLower) ||
            (p.detalle && p.detalle.toLowerCase().includes(busquedaLower)) ||
            p.tags.some(tag => tag.toLowerCase().includes(busquedaLower));

        // Match Categories based on Index.html chips
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
            options.push({ ...p });
        }
    });

    let globalBestValue = 0;
    options.forEach(opt => {
        const val = parseValue(opt.descuento);
        if (val > globalBestValue) globalBestValue = val;
    });

    const isSpecialView = busqueda !== "" || activeCategory !== null;
    options.forEach(opt => {
        if (isSpecialView && parseValue(opt.descuento) === globalBestValue && globalBestValue > 0) {
            opt.isGlobalBest = true;
        } else {
            opt.isGlobalBest = false;
        }
    });

    options.sort((a, b) => parseValue(b.descuento) - parseValue(a.descuento));

    render(options);
}

function parseValue(desc) {
    if (desc === "2x1") return 50;
    const match = desc.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
}

function render(options) {
    const container = document.getElementById('resultados');
    container.innerHTML = "";

    if (options.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 40px; grid-column: 1/-1;">No encontramos promos con esos filtros...</div>';
        return;
    }

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

            benefitsHTML += `
                <div class="benefit-block ${isHighlight ? 'highlight' : ''} ${globalBestClass}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <span class="label-sm">${benefit.medio_pago} ${starIcon}</span>
                        <span class="tag-mini ${benefit.medio_pago === 'Personal Pay' ? 'purple' : ''}">${benefit.tipo_beneficio}</span>
                    </div>
                    <div class="benefit-value">${benefit.descuento}</div>
                    <div class="benefit-detail">${benefit.detalle}</div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top: auto;">
                        <span class="label-sm" style="font-size: 8px;">VIGENCIA: ${benefit.vigencia}</span>
                    </div>
                </div>
            `;
        });

        const isTransport = merchantBenefits[0].categoria === 'transporte';

        groupDiv.innerHTML = `
            <div class="merchant-name">${comercio}</div>
            ${benefitsHTML}
            <div class="actions-container">
                ${!isTransport ? '<button class="btn-primary">VER SUCURSALES</button>' : ''}
                <button class="${isTransport ? 'btn-primary' : 'btn-secondary'}">${isTransport ? 'VER CÓMO PAGAR' : `PAGAR CON ${merchantBenefits[0].medio_pago.toUpperCase()}`}</button>
            </div>
        `;
        container.appendChild(groupDiv);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}
