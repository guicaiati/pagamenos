const fileInput = document.getElementById('file-input');
const extractBtn = document.getElementById('extract-btn');
const uploadStep = document.getElementById('upload-step');
const previewStep = document.getElementById('preview-step');
const previewBody = document.getElementById('preview-body');
const saveBtn = document.getElementById('save-btn');
const loader = document.getElementById('loader');
const logArea = document.getElementById('log-area');

// --- Funciones Dinámicas de Categorías ---
let CAT_LABELS = {};
let CAT_ICON_HTML = {};
let CAT_RAW_DATA = {};
const ICON_STYLE = 'width:12px;height:12px;';

async function loadCategories() {
    try {
        const res = await fetch('/categories');
        CAT_RAW_DATA = await res.json();
        CAT_LABELS = {};
        CAT_ICON_HTML = {};
        for (const [k, v] of Object.entries(CAT_RAW_DATA)) {
            CAT_LABELS[k] = v.label;
            CAT_ICON_HTML[k] = `<i data-lucide="${v.icon}" style="${ICON_STYLE}"></i>`;
        }
        if (extractedData.promos.length > 0) renderPreview(extractedData);
    } catch (e) { console.error('Error cargando categorias', e); }
}

loadCategories();

// --- Gestión de Días de la Semana ---
// Convierte días en cualquier formato (string o índice) a array de índices 0-6
const DIA_MAP = { lunes:0, martes:1, miercoles:2, miércoles:2, jueves:3, viernes:4, sabado:5, sábado:5, domingo:6 };

function normalizeDias(dias) {
    if (!Array.isArray(dias)) return [];
    return dias.map(d => {
        if (typeof d === 'number') return d;
        // Convertir string: normalizar acento y buscar en el mapa
        const key = String(d).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return DIA_MAP[key] ?? -1;
    }).filter(i => i >= 0 && i <= 6);
}

window.renderDaysChips = (dias, idx, context = 'preview') => {
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const activeDays = normalizeDias(dias);
    
    return `
        <div class="days-container" data-idx="${idx}">
            ${days.map((d, i) => {
                const isActive = activeDays.includes(i);
                const clickAction = (idx === -1) ? '' : `onclick="toggleDay(${idx}, ${i}, '${context}')"`;
                return `<div class="day-chip ${isActive ? 'active' : ''}" 
                             ${clickAction} 
                             title="${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i]}">${d}</div>`;
            }).join('')}
        </div>
    `;
};

window.toggleDay = (idx, dayIndex, context = 'preview') => {
    let dataset = (context === 'preview') ? extractedData.promos : fullDbData.promos;
    let p = dataset[idx];
    // Normalizar a índices antes de operar
    p.dias = normalizeDias(p.dias);
    
    const pos = p.dias.indexOf(dayIndex);
    if (pos > -1) {
        p.dias.splice(pos, 1);
    } else {
        p.dias.push(dayIndex);
        p.dias.sort();
    }
    
    if (context === 'preview') {
        renderPreview(extractedData);
    } else {
        // Actualizar solo el chip clickeado (sin rerenderizar tabla completa)
        const chip = document.querySelector(`.days-container[data-idx="${idx}"] .day-chip:nth-child(${dayIndex + 1})`);
        if (chip) chip.classList.toggle('active', p.dias.includes(dayIndex));

        // Actualizar fecha de modificación
        const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false });
        p.fecha_modificacion = ahora;
        const modCell = document.querySelector(`.db-mod-date[data-dbtype="promos"][data-dbidx="${idx}"]`);
        if (modCell) {
            modCell.innerText = ahora;
            modCell.style.color = 'var(--accent-green)';
        }
    }
};

let extractedData = { precios: [], promos: [] };

async function refreshStats() {
    try {
        const res = await fetch('/status');
        const data = await res.json();
        document.getElementById('count-precios').innerText = data.countPrecios;
        document.getElementById('count-promos').innerText = data.countPromos;
        document.getElementById('last-update').innerText = data.lastUpdate;
    } catch (e) { }
}

refreshStats();

const textInput = document.getElementById('text-input');

const checkInputs = () => {
    if (fileInput.files.length > 0 || textInput.value.trim().length > 0) {
        extractBtn.disabled = false;
        logArea.innerHTML = `<i data-lucide="paperclip" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>${fileInput.files.length} archivos | <i data-lucide="file-text" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i>${textInput.value.trim().length > 0 ? 'Texto detectado' : 'Sin texto'} (Pulsa Analizar)`;
        lucide.createIcons();
    } else {
        extractBtn.disabled = true;
        logArea.innerHTML = "Esperando archivos o texto plano...";
    }
};

fileInput.addEventListener('change', checkInputs);
textInput.addEventListener('input', checkInputs);

extractBtn.addEventListener('click', async () => {
    const files = fileInput.files;
    const textContent = textInput.value.trim();
    if (files.length === 0 && textContent.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    if (textContent.length > 0) {
        formData.append('rawText', textContent);
    }

    extractBtn.disabled = true;
    loader.style.display = 'flex';
    logArea.innerText = "Reconociendo datos en tu PC local...";

    try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Mostrar previsualización de imágenes y texto
        const gallery = document.getElementById('image-gallery');
        gallery.innerHTML = "";

        if (textContent.length > 0) {
            const txtBox = document.createElement('div');
            txtBox.style.padding = '15px';
            txtBox.style.background = 'rgba(160,100,255,0.05)';
            txtBox.style.borderRadius = '12px';
            txtBox.style.border = '1px dashed rgba(160,100,255,0.3)';
            txtBox.innerHTML = `<h4 style="color:#a064ff; font-size:11px; margin-bottom:8px; text-transform:uppercase;">Texto Plano Detectado</h4><p style="font-size:11px; color:rgba(255,255,255,0.7); line-height:1.4;">${textContent}</p>`;
            gallery.appendChild(txtBox);
        }

        Array.from(files).forEach((file, idx) => {
            const label = document.createElement('div');
            label.className = 'img-label';
            label.innerText = `Captura ${idx + 1}`;

            const container = document.createElement('div');
            container.className = 'img-container';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);

            // Manejar zoom inteligente siguiendo el mouse
            container.addEventListener('mousemove', (e) => {
                const { left, top, width, height } = container.getBoundingClientRect();
                const x = ((e.clientX - left) / width) * 100;
                const y = ((e.clientY - top) / height) * 100;
                img.style.transformOrigin = `${x}% ${y}%`;
            });
            
            container.addEventListener('mouseleave', () => {
                img.style.transformOrigin = 'center center';
            });

            container.appendChild(img);
            gallery.appendChild(label);
            gallery.appendChild(container);
        });

        extractedData = data;
        renderPreview(data);

        loader.style.display = 'none';
        uploadStep.style.display = 'none';
        previewStep.style.display = 'block';
    } catch (e) {
        loader.style.display = 'none';
        extractBtn.disabled = false;
        const errBox = document.getElementById('error-display');
        errBox.style.display = 'block';
        errBox.innerText = "Error: " + e.message;
    }
});

let currentDbTypeFilter = 'all';
let currentDbCatFilter = 'all';

function setDbTypeFilter(val, label) {
    currentDbTypeFilter = val;
    document.getElementById('db-type-label').innerText = label;
    document.getElementById('db-type-options').style.display = 'none';
    filterDbTable();
}

function setDbCatFilter(val, label) {
    currentDbCatFilter = val;
    document.getElementById('db-cat-label').innerText = label;
    document.getElementById('db-cat-options').style.display = 'none';
    filterDbTable();
}

window.openSmartCatPicker = function (e, type, idx) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const picker = document.getElementById('smart-cat-picker');
    const searchIn = document.getElementById('smart-cat-search');

    picker.style.display = 'block';

    // Posicionamiento inteligente
    let left = rect.left;
    let top = rect.bottom + 5;

    // Si se sale por abajo
    if (top + 300 > window.innerHeight) {
        top = rect.top - 300 - 5;
    }
    // Si se sale por derecha
    if (left + 250 > window.innerWidth) {
        left = rect.right - 250;
    }

    picker.style.left = left + 'px';
    picker.style.top = top + 'px';

    searchIn.value = '';
    searchIn.focus();

    renderSmartCatList('', type, idx);

    searchIn.oninput = (ev) => {
        renderSmartCatList(ev.target.value, type, idx);
    };
};

function renderSmartCatList(query, type, idx) {
    const list = document.getElementById('smart-cat-list');
    list.innerHTML = '';
    const q = query.toLowerCase();

    const filtered = Object.entries(CAT_RAW_DATA).filter(([k, v]) =>
        k.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)
    );

    filtered.forEach(([k, v]) => {
        const item = document.createElement('div');
        item.style.padding = '8px 10px';
        item.style.borderRadius = '6px';
        item.style.cursor = 'pointer';
        item.style.fontSize = '12px';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '8px';
        item.style.color = '#fff';
        item.style.transition = 'all 0.2s';
        item.innerHTML = `<i data-lucide="${v.icon}" style="width:14px;height:14px;opacity:0.7;"></i> <span>${v.label}</span>`;

        item.onmouseover = () => { item.style.background = 'rgba(55,255,180,0.1)'; item.style.color = 'var(--accent-green)'; };
        item.onmouseout = () => { item.style.background = 'transparent'; item.style.color = '#fff'; };

        item.onclick = () => {
            if (type === 'preview') {
                extractedData.promos[idx].categoria = k;
                renderPreview(extractedData);
            } else {
                fullDbData.promos[idx].categoria = k;
                fullDbData.promos[idx].fecha_modificacion = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false });
                renderDbTable();
            }
            document.getElementById('smart-cat-picker').style.display = 'none';
        };

        list.appendChild(item);
    });

    lucide.createIcons();
    if (filtered.length === 0) {
        list.innerHTML = `<div style="padding:10px; color:var(--text-muted); font-size:11px; text-align:center;">No hay resultados</div>`;
    }
}

// Cerrar picker al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('#smart-cat-picker') && !e.target.closest('.cat-selector-btn') && !e.target.closest('.db-cat-btn')) {
        document.getElementById('smart-cat-picker').style.display = 'none';
    }
});

function renderPreview(data) {
    const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    previewBody.innerHTML = "";

    const getBadge = (status) => {
        if (status === 'identical') return `<span class="tag-mini" style="background:rgba(55,255,180,0.05); color:rgba(255,255,255,0.4); border:1px solid rgba(255,255,255,0.1);">IDÉNTICO ✓</span>`;
        if (status === 'new') return `<span class="tag-mini" style="background:rgba(55,255,180,0.1); color:var(--accent-green);">+ NUEVA</span>`;
        return ``;
    };

    data.precios.forEach((p, idx) => {
        const tr = document.createElement('tr');
        if (p.status === 'identical') tr.style.opacity = "0.5";

        const beforePrice = p.status === 'update' ? `<br><small style="color:var(--text-muted); font-size:10px; text-decoration:line-through;">Original: $${p.original.precio}</small>` : '';

        tr.innerHTML = `
            <td><span class="tag-type" style="background:rgba(255,209,0,0.1); color:#FFD100; padding:6px 14px; border-radius:6px; letter-spacing:1px; font-weight:800; box-shadow:inset 0 0 0 1px rgba(255,209,0,0.2);">PRECIO</span></td>
            <td style="outline:none; vertical-align:middle;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span contenteditable="true" data-type="precios" data-idx="${idx}" data-field="comercio" style="outline:none; cursor:text; min-width:20px;">${p.comercio}</span>
                    <div contenteditable="false" style="display:inline-flex;">${getBadge(p.status, p.matchScore)}</div>
                </div>
            </td>
            <td><span style="color:rgba(255,255,255,0.1);">-</span></td>
            <td><span style="color:rgba(255,255,255,0.1);">-</span></td>
            <td contenteditable="true" data-type="precios" data-idx="${idx}" data-field="producto" style="outline:none; cursor:text;">${p.producto}</td>
            <td contenteditable="true" data-type="precios" data-idx="${idx}" data-field="precio" class="tag-price" style="outline:none; cursor:text; font-weight:900; color:${p.status === 'update' ? 'var(--accent-green)' : 'var(--text-main)'}; font-size:16px;">$${p.precio}${beforePrice}</td>
            <td><span style="color:rgba(255,255,255,0.1);">-</span></td>
        `;
        previewBody.appendChild(tr);
    });

    data.promos.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.id = `row-promo-${idx}`;
        if (p.status === 'identical') tr.style.opacity = "0.3";

        // Color de fondo si es sospechoso
        if (p.status === 'potential_duplicate' || p.status === 'update') {
            tr.style.background = p.status === 'update' ? "rgba(160, 100, 255, 0.05)" : "rgba(255,209,0,0.02)";
        }

        const renderActions = (p, idx) => {
            if (p.status === 'identical') return `<span style="color:var(--text-muted); font-size:10px;">IDÉNTICA ✓</span>`;

            if (p.isForcedNew) {
                return `<button class="tag-mini new-force" style="cursor:pointer;" onclick="setPromoStatus(${idx}, 'update')">✓ FORZADA NUEVA</button>
                         <br><a href="#" style="color:var(--text-muted); font-size:9px; margin-top:5px; display:inline-block;" onclick="setPromoStatus(${idx}, 'update')">revertir</a>`;
            }

            if (p.status === 'new') return `<span style="color:var(--accent-green); font-size:10px;">+ NUEVA</span>`;

            const consejo = p.matchScore >= 90 ? "Parecido extremo (Recomendado)" : "Parecido alto (Verificar)";
            const adviceIcon = p.matchScore >= 90 ? "check-circle" : "info";

            const isHighlyRecommended = p.matchScore >= 90;

            return `
                <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                    <button class="tag-mini" 
                            style="background:#a064ff; color:white; border:${isHighlyRecommended ? '2px solid rgba(255,255,255,0.8)' : 'none'}; cursor:pointer; padding:8px 10px; border-radius:6px; font-size:10px; font-weight:800; width:110px; box-shadow:0 4px 10px rgba(160,100,255,0.2); display:flex; align-items:center; justify-content:center; gap:5px;" 
                            onclick="setPromoStatus(${idx}, 'update')">
                        <i data-lucide="${isHighlyRecommended ? 'check-circle-2' : 'refresh-cw'}" style="width:12px; height:12px;"></i> ACTUALIZAR
                    </button>
                    <button class="tag-mini" 
                            style="background:var(--accent-green); color:black; border:none; cursor:pointer; padding:8px 10px; border-radius:6px; font-size:10px; font-weight:800; width:110px; box-shadow:0 4px 10px rgba(55,255,180,0.2); display:flex; align-items:center; justify-content:center; gap:5px;" 
                            onclick="setPromoStatus(${idx}, 'new')">
                        <i data-lucide="plus" style="width:12px; height:12px;"></i> ES NUEVA
                    </button>
                    <button class="tag-mini" 
                            style="background:#ff3737; color:white; border:none; cursor:pointer; padding:8px 10px; border-radius:6px; font-size:10px; font-weight:800; width:110px; box-shadow:0 4px 10px rgba(255,55,55,0.2); display:flex; align-items:center; justify-content:center; gap:5px;" 
                            onclick="removeRow(${idx})">
                        <i data-lucide="x" style="width:12px; height:12px;"></i> DESCARTAR
                    </button>
                </div>
            `;

        };

        const diffSpan = (val, orgVal, isDetail = false) => {
            if (!orgVal || p.isForcedNew) return '';
            const isDiff = normalize(val) !== normalize(orgVal);
            const color = isDiff ? '#ff3737' : 'rgba(255,255,255,0.5)';
            const bg = isDiff ? 'rgba(255,55,55,0.05)' : 'rgba(160, 100, 255, 0.05)';
            const border = isDiff ? 'rgba(255,55,55,0.2)' : 'rgba(160, 100, 255, 0.2)';

            return `
                <div style="margin-top:8px; padding:6px 10px; background:${bg}; border-radius:10px; border:1px solid ${border}; font-size:10px; line-height:1.2; display:block;">
                    <span style="display:flex; align-items:center; gap:5px; color:${color};">
                        <i data-lucide="database-backup" style="width:10px; height:10px; opacity:0.7;"></i>
                        <span style="font-size:9px; font-weight:800; opacity:0.5; margin-right:5px;">DB:</span>
                        <b>${orgVal}</b>
                    </span>
                </div>
            `;
        };

        tr.innerHTML = `
            <td style="vertical-align:middle;">
                <span class="tag-type" style="background:rgba(55,255,180,0.08); color:var(--accent-green); padding:6px 14px; border-radius:6px; letter-spacing:1px; font-weight:800; box-shadow:inset 0 0 0 1px rgba(55,255,180,0.2);">PROMO</span>
            </td>
            <td style="outline:none; vertical-align:middle;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <span contenteditable="true" data-type="promos" data-idx="${idx}" data-field="comercio" style="outline:none; cursor:text; min-width:20px;">${p.comercio}</span>
                    <div contenteditable="false" style="display:inline-flex;">${getBadge(p.status, p.matchScore)}</div>
                </div>
                <div class="cat-selector-wrap" style="position:relative;">
                    <button class="cat-selector-btn" onclick="openSmartCatPicker(event, 'preview', ${idx})" data-idx="${idx}" title="${p.categoria || 'Categoría'}" 
                        style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:4px 8px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; color:var(--text-muted); font-size:10px; font-weight:700; white-space:nowrap;">
                        ${CAT_ICON_HTML[p.categoria] || '<i data-lucide="tag" style="width:12px;height:12px;"></i>'}
                        <span class="cat-label">${CAT_LABELS[p.categoria] || (p.categoria || 'Categoría')}</span>
                    </button>
                </div>
            </td>
            <td contenteditable="true" data-type="promos" data-idx="${idx}" data-field="medio_pago" style="outline:none; color:#a064ff;">
                ${p.medio_pago}
            </td>
            <td contenteditable="true" data-type="promos" data-idx="${idx}" data-field="forma_pago" style="outline:none; color:var(--text-muted);">
                ${p.forma_pago || 'QR/Tarjeta'}
            </td>
            <td style="vertical-align:middle;">
                ${renderDaysChips(p.dias, idx, 'preview')}
            </td>
            <td contenteditable="true" data-type="promos" data-idx="${idx}" data-field="detalle" style="outline:none; line-height:1.4;">
                ${p.detalle}
            </td>
            <td contenteditable="true" data-type="promos" data-idx="${idx}" data-field="descuento" style="outline:none; font-weight:900; color:var(--accent-pink); font-size:16px; letter-spacing:-0.5px;">
                ${p.descuento}
            </td>
            <td>${renderActions(p, idx)}</td>
        `;

        previewBody.appendChild(tr);

        // Fila de comparación (Alineada por columnas dentro de un recuadro)
        if (p.original && !p.isForcedNew) {
            const isDiff = (f) => normalize(p[f]) !== normalize(p.original[f]);
            const color = (f) => isDiff(f) ? '#ff3737' : 'rgba(255,255,255,0.7)';
            const consejo = p.matchScore >= 90 ? "Parecido extremo (Recomendado)" : "Parecido alto (Verificar)";
            const iconColor = p.status === 'update' ? '#a064ff' : '#FFD100';

            // 1. Fila de Título
            const trTitle = document.createElement('tr');
            trTitle.innerHTML = `
                <td colspan="8" style="padding:15px 0 0 0; border:none; background:transparent;">
                    <div style="background:rgba(160, 100, 255, 0.05); border:1px solid rgba(160, 100, 255, 0.2); border-bottom:none; border-radius:12px 12px 0 0; padding:12px 20px; display:flex; align-items:center; gap:10px; margin-bottom:-1px; border-left:none; border-right:none;">
                        <i data-lucide="database" style="width:14px; height:14px; color:var(--text-main);"></i>
                        <span style="font-weight:900; letter-spacing:1px; font-size:10px; color:var(--text-main); text-transform:uppercase;">EN BASE DE DATOS (COMPARATIVA)</span>
                    </div>
                </td>
            `;
            previewBody.appendChild(trTitle);

            // 2. Fila de Datos (Sin bordes redondeados raros, alineada a los bordes de la tabla)
            const trData = document.createElement('tr');
            trData.innerHTML = `
                <td style="background:rgba(160, 100, 255, 0.05); border-left:1px solid rgba(160, 100, 255, 0.2); border-bottom:1px solid rgba(160, 100, 255, 0.2); border-radius:0 0 0 12px; padding:15px 20px;">
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(160, 100, 255, 0.15); border:1px solid rgba(160, 100, 255, 0.3); padding:8px; border-radius:8px; width:fit-content; gap:4px;">
                        <i data-lucide="database-backup" style="width:12px; height:12px; color:#a064ff;"></i>
                        <span style="font-size:9px; font-weight:900; color:#a064ff; text-transform:uppercase; letter-spacing:1px;">BASE</span>
                    </div>
                </td>
                <td style="background:rgba(160, 100, 255, 0.05); border-bottom:1px solid rgba(160, 100, 255, 0.2); padding:15px 20px;">
                    <span style="color:${color('comercio')}">${p.original.comercio}</span>
                </td>
                <td style="background:rgba(160, 100, 255, 0.05); border-bottom:1px solid rgba(160, 100, 255, 0.2); padding:15px 20px;">
                    <span style="color:${color('medio_pago')}">${p.original.medio_pago}</span>
                </td>
                <td style="background:rgba(160, 100, 255, 0.05); border-bottom:1px solid rgba(160, 100, 255, 0.2); padding:15px 20px;">
                    <span style="color:${color('forma_pago')}">${p.original.forma_pago || 'QR/Tarjeta'}</span>
                </td>
                <td style="background:rgba(160, 100, 255, 0.05); border-bottom:1px solid rgba(160, 100, 255, 0.2); padding:15px 20px;">
                    <div style="opacity:0.4; pointer-events:none; filter:grayscale(1);">
                        ${renderDaysChips(p.original.dias || [], -1)}
                    </div>
                </td>
                <td style="background:rgba(160, 100, 255, 0.05); border-bottom:1px solid rgba(160, 100, 255, 0.2); padding:15px 20px;">
                    <span style="color:${color('detalle')}; font-style:italic; opacity:0.8;">${p.original.detalle}</span>
                </td>
                <td style="background:rgba(160, 100, 255, 0.05); border-bottom:1px solid rgba(160, 100, 255, 0.2); padding:15px 20px;">
                    <span style="font-weight:900; color:${color('descuento')}; font-size:16px;">${p.original.descuento}</span>
                </td>
                <td style="background:rgba(160, 100, 255, 0.05); border-right:1px solid rgba(160, 100, 255, 0.2); border-bottom:1px solid rgba(160, 100, 255, 0.2); border-radius:0 0 12px 0; text-align:center; padding:15px 20px;">
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:help;" title="${p.matchScore}% de coincidencia. ${consejo}">
                        <i data-lucide="info" style="width:16px; height:16px; color:${iconColor}; stroke-width:3px; margin-bottom:6px;"></i>
                        <span style="font-size:15px; color:#a064ff; font-weight:900; line-height:1;">${p.matchScore}%</span>
                        <span style="font-size:10px; color:#a064ff; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-top:4px;">PARECIDO</span>
                    </div>
                </td>
            `;
            previewBody.appendChild(trData);
        }
    });

    lucide.createIcons();

    if (data.precios.length === 0 && data.promos.length === 0) {
        previewBody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding:40px; color:var(--text-muted);'>No se detectaron datos relevantes en las imágenes.</td></tr>";
    }
}

// Función para descartar fila
window.removeRow = (idx) => {
    extractedData.promos.splice(idx, 1);
    renderPreview(extractedData);
};

// Función para cambiar el estado de una promo manualmente
window.setPromoStatus = (idx, newStatus) => {
    extractedData.promos[idx].status = newStatus;

    if (newStatus === 'new') {
        extractedData.promos[idx].isForcedNew = true;
    } else {
        extractedData.promos[idx].isForcedNew = false;
    }

    renderPreview(extractedData);
};

// Listener para edición en vivo mejorado para spans internos
previewBody.addEventListener('input', (e) => {
    const el = e.target;
    const targetEl = el.closest('[contenteditable="true"]');
    if (targetEl && targetEl.hasAttribute('data-type')) {
        const type = targetEl.getAttribute('data-type');
        const idx = parseInt(targetEl.getAttribute('data-idx'));
        const field = targetEl.getAttribute('data-field');
        let val = targetEl.innerText.trim();
        if (val.startsWith('$')) val = val.slice(1);
        extractedData[type][idx][field] = val;
    }
});

saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try {
        const res = await fetch('/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(extractedData)
        });
        const result = await res.json();

        const notif = document.getElementById('notification-success');
        const notifText = document.getElementById('notification-text');
        notif.style.display = 'block';
        notifText.innerText = result.message || "¡Datos guardados con éxito!";

        setTimeout(() => {
            location.reload();
        }, 2500);
    } catch (e) {
        saveBtn.disabled = false;
        const errBox = document.getElementById('error-display');
        errBox.style.display = 'block';
        errBox.innerText = "Error al guardar: " + e.message;
    }
});

// --- LÓGICA DEL EDITOR DE BASE DE DATOS ---
let fullDbData = { promos: [], precios: [] };

// Modal Editor de Categorias
window.renderCatList = function() {
    const list = document.getElementById('cat-list');
    list.innerHTML = '';
    for (const [key, data] of Object.entries(CAT_RAW_DATA)) {
        list.insertAdjacentHTML('beforeend', `
            <div class="cat-builder-row" style="display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.03); padding:10px; border-radius:10px;">
                <input type="text" class="cat-key" value="${key}" placeholder="ID (ej: comida)" style="flex:1; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px; color:white; font-size:12px; outline:none;" ${key === '' ? '' : 'readonly title="El ID de categoría no de puede cambiar una vez creado"'}>
                <input type="text" class="cat-label" value="${data.label}" placeholder="Etiqueta / Nombre Visible" style="flex:2; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px; color:white; font-size:12px; outline:none;">
                <input type="text" class="cat-icon" value="${data.icon}" placeholder="Lucide icon" style="flex:1; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px; color:white; font-size:12px; outline:none;">
                <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:#ff3737; cursor:pointer; padding:5px;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </div>
        `);
    }
    lucide.createIcons();
}

window.openCatEditor = function() {
    document.getElementById('cat-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';
    renderCatList();
}

window.closeCatEditor = function() {
    document.getElementById('cat-modal').style.display = 'none';
    document.body.style.overflow = '';
}

window.addCatRow = function() {
    CAT_RAW_DATA[''] = { label: '', icon: 'tag' };
    renderCatList();
}

window.saveCategories = async function() {
    const btn = document.getElementById('cat-save-btn');
    const og = btn.innerHTML;
    btn.innerHTML = 'GUARDANDO...';
    btn.disabled = true;

    try {
        const rows = document.querySelectorAll('.cat-builder-row');
        const newData = {};
        rows.forEach(r => {
            let k = r.querySelector('.cat-key').value.trim();
            if (!k) k = 'cat_' + Date.now();
            k = k.toLowerCase().replace(/[^a-z0-9_]/g, ''); // slugify ID

            const l = r.querySelector('.cat-label').value.trim() || k;
            const i = r.querySelector('.cat-icon').value.trim() || 'tag';
            newData[k] = { label: l, icon: i };
        });

        const res = await fetch('/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newData)
        });

        if (!res.ok) throw new Error("Error en servidor");
        btn.innerHTML = '¡GUARDADO!';
        btn.style.background = '#28a745';

        await loadCategories(); // recarga la memoria JS local

        setTimeout(() => {
            btn.innerHTML = og;
            btn.style.background = 'var(--accent-green)';
            btn.disabled = false;
            closeCatEditor();
        }, 1500);
    } catch (e) {
        alert("Error: " + e.message);
        btn.innerHTML = og;
        btn.disabled = false;
    }
}

window.openDbEditor = async function() {
    const modal = document.getElementById('db-modal');
    const tbody = document.getElementById('db-table-body');

    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">Cargando base de datos... </td></tr>';
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    try {
        const res = await fetch('/db');
        fullDbData = await res.json();

        const catFilter = document.getElementById('db-cat-options');
        catFilter.innerHTML = `<div onclick="setDbCatFilter('all', 'Todas las categorías')" style="padding:10px 15px; font-size:13px; font-weight:700; cursor:pointer; color:var(--text-main); border-radius:8px; transition:all 0.2s; display:flex; align-items:center; gap:8px;" onmouseover="this.style.background='rgba(55,255,180,0.1)';this.style.color='var(--accent-green)';" onmouseout="this.style.background='transparent';this.style.color='var(--text-main)';"><i data-lucide="layout-grid" style="width:14px;height:14px;"></i> Todas las categorías</div>`;
        const uniqueCats = [...new Set(fullDbData.promos.map(p => p.categoria).filter(Boolean))];
        uniqueCats.forEach(cat => {
            const label = CAT_LABELS[cat] || cat;
            const iconHTML = CAT_ICON_HTML[cat] || `<i data-lucide="tag" style="width:14px;height:14px;"></i>`;
            const escapedLabel = label.replace(/'/g, "\\'");

            const opt = document.createElement('div');
            opt.setAttribute('onclick', `setDbCatFilter('${cat}', '${escapedLabel}')`);
            opt.setAttribute('style', `padding:10px 15px; font-size:13px; font-weight:700; cursor:pointer; color:var(--text-main); border-radius:8px; transition:all 0.2s; display:flex; align-items:center; gap:8px;`);
            opt.setAttribute('onmouseover', `this.style.background='rgba(55,255,180,0.1)';this.style.color='var(--accent-green)';`);
            opt.setAttribute('onmouseout', `this.style.background='transparent';this.style.color='var(--text-main)';`);
            opt.innerHTML = `${iconHTML} ${label}`;
            catFilter.appendChild(opt);
        });
        lucide.createIcons();

        renderDbTable();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:#ff3737;">Error al cargar la base de datos: ${e.message}</td></tr>`;
    }
}

window.closeDbEditor = function() {
    document.getElementById('db-modal').style.display = 'none';
    document.body.style.overflow = '';
}

window.filterDbTable = function() {
    renderDbTable();
}

window.renderDbTable = function() {
    const tbody = document.getElementById('db-table-body');
    const searchVal = document.getElementById('db-search').value.toLowerCase();
    const typeFilter = typeof currentDbTypeFilter !== 'undefined' ? currentDbTypeFilter : 'all';
    const catFilter = typeof currentDbCatFilter !== 'undefined' ? currentDbCatFilter : 'all';

    tbody.innerHTML = '';
    let count = 0;

    const renderRows = (type, items) => {
        items.forEach((item, idx) => {
            if (typeFilter !== 'all' && typeFilter !== type) return;
            if (type === 'promos' && catFilter !== 'all' && item.categoria !== catFilter) return;

            const searchStr = Object.values(item).join(' ').toLowerCase();
            if (searchVal && !searchStr.includes(searchVal)) return;

            count++;
            let isExpired = false;
            if (type === 'promos' && item.vigencia) {
                const parts = item.vigencia.split('/');
                if (parts.length === 3) {
                    let [dd, mm, yyyy] = parts;
                    if (yyyy.length === 2) yyyy = "20" + yyyy;
                    const expDate = new Date(yyyy, mm - 1, dd);
                    if (expDate < new Date().setHours(0, 0, 0, 0)) {
                        isExpired = true;
                    }
                }
            }

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
            if (isExpired) {
                tr.style.opacity = '0.4';
                tr.style.background = 'rgba(255, 55, 55, 0.05)';
                tr.title = 'Promoción Vencida';
            }

            if (type === 'promos') {
                tr.innerHTML = `
                    <td style="padding:16px 14px; vertical-align:middle; width:80px;">
                        <span style="background:rgba(55,255,180,0.08); color:var(--accent-green); padding:4px 8px; border-radius:4px; font-size:10px; font-weight:800;">PROMO</span>
                    </td>
                    <td style="padding:16px 14px; outline:none; font-size:13px;" contenteditable="true" data-dbtype="promos" data-dbidx="${idx}" data-dbfield="comercio">${item.comercio || ''}</td>
                    <td style="padding:16px 14px;">
                        <div class="db-cat-wrap" style="position:relative; display:inline-block;">
                            <button class="db-cat-btn" onclick="openSmartCatPicker(event, 'db', ${idx})" data-idx="${idx}" style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; cursor:pointer; color:var(--text-muted); font-size:11px; font-weight:700; display:flex; align-items:center; gap:5px; white-space:nowrap;">
                                ${CAT_ICON_HTML[item.categoria] || '<i data-lucide="tag" style="width:12px;height:12px;"></i>'}
                                <span>${CAT_LABELS[item.categoria] || item.categoria || 'Sin Categoría'}</span>
                            </button>
                        </div>
                    </td>
                    <td style="padding:16px 14px; outline:none; color:#a064ff; font-size:12px;" contenteditable="true" data-dbtype="promos" data-dbidx="${idx}" data-dbfield="medio_pago">${item.medio_pago || ''}</td>
                    <td style="padding:16px 14px; outline:none; font-size:12px;" contenteditable="true" data-dbtype="promos" data-dbidx="${idx}" data-dbfield="forma_pago">${item.forma_pago || ''}</td>
                    <td style="padding:16px 14px; vertical-align:middle;">
                        ${renderDaysChips(item.dias, idx, 'db')}
                    </td>
                    <td style="padding:16px 14px; outline:none; line-height:1.4; max-width:300px; font-size:12px;" contenteditable="true" data-dbtype="promos" data-dbidx="${idx}" data-dbfield="detalle">${item.detalle || ''}</td>
                    <td style="padding:16px 14px; outline:none; font-weight:900; color:var(--accent-pink); font-size:14px;" contenteditable="true" data-dbtype="promos" data-dbidx="${idx}" data-dbfield="descuento">${item.descuento || ''}</td>
                    <td style="padding:16px 14px; outline:none; font-size:11px;" contenteditable="true" data-dbtype="promos" data-dbidx="${idx}" data-dbfield="vigencia">${item.vigencia || ''}</td>
                    <td style="padding:16px 14px; font-size:10px; color:var(--text-muted); white-space:nowrap;" class="db-mod-date" data-dbtype="promos" data-dbidx="${idx}">${item.fecha_modificacion || '-'}</td>
                    <td style="padding:16px 14px; text-align:center;">
                        <button onclick="deleteDbRow('promos', ${idx})" style="background:rgba(255,55,55,0.1); border:none; color:#ff3737; cursor:pointer; padding:6px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center;" title="Eliminar registro"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                    </td>
                `;
            } else {
                tr.innerHTML = `
                    <td style="padding:14px 12px; vertical-align:middle;">
                        <span style="background:rgba(255,160,50,0.08); color:orange; padding:4px 8px; border-radius:4px; font-size:9px; font-weight:800;">PRECIO</span>
                    </td>
                    <td style="padding:14px 12px; outline:none;" contenteditable="true" data-dbtype="precios" data-dbidx="${idx}" data-dbfield="comercio">${item.comercio || ''}</td>
                    <td style="padding:14px 12px; color:rgba(255,255,255,0.2);">-</td>
                    <td style="padding:14px 12px; color:rgba(255,255,255,0.2);">-</td>
                    <td style="padding:14px 12px; color:rgba(255,255,255,0.2);">-</td>
                    <td style="padding:14px 12px; color:rgba(255,255,255,0.2);">-</td>
                    <td style="padding:14px 12px; outline:none;" contenteditable="true" data-dbtype="precios" data-dbidx="${idx}" data-dbfield="producto">${item.producto || ''}</td>
                    <td style="padding:14px 12px; outline:none; font-weight:900;" contenteditable="true" data-dbtype="precios" data-dbidx="${idx}" data-dbfield="precio">${item.precio || ''}</td>
                    <td style="padding:14px 12px; color:rgba(255,255,255,0.2);">-</td>
                    <td style="padding:14px 12px; font-size:10px; color:var(--text-muted); white-space:nowrap;" class="db-mod-date" data-dbtype="precios" data-dbidx="${idx}">${item.fecha_modificacion || '-'}</td>
                    <td style="padding:14px 12px; text-align:center;">
                        <button onclick="deleteDbRow('precios', ${idx})" style="background:rgba(255,55,55,0.1); border:none; color:#ff3737; cursor:pointer; padding:6px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center;" title="Eliminar registro"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                    </td>
                `;
            }
            tbody.appendChild(tr);
        });
    };

    renderRows('promos', fullDbData.promos);
    renderRows('precios', fullDbData.precios);

    document.getElementById('db-count-label').innerText = count + " registros";
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Listener para edición en DB
document.getElementById('db-table-body').addEventListener('input', (e) => {
    const el = e.target;
    if (el.hasAttribute('data-dbtype')) {
        const type = el.getAttribute('data-dbtype');
        const idx = parseInt(el.getAttribute('data-dbidx'));
        const field = el.getAttribute('data-dbfield');
        fullDbData[type][idx][field] = el.innerText.trim();
        // Marcar fecha de modificación
        const ahora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour12: false });
        fullDbData[type][idx].fecha_modificacion = ahora;
        const modCell = document.querySelector(`.db-mod-date[data-dbtype="${type}"][data-dbidx="${idx}"]`);
        if (modCell) {
            modCell.innerText = ahora;
            modCell.style.color = 'var(--accent-green)';
        }
    }
});

// Selector delegado DB
document.addEventListener('click', (e) => {
    const dbBtn = e.target.closest('.db-cat-btn');
    if (dbBtn) {
        const dropdown = dbBtn.nextElementSibling;
        const isVis = dropdown.style.display === 'block';

        document.querySelectorAll('table tbody tr').forEach(r => { r.style.position = ''; r.style.zIndex = ''; });
        document.querySelectorAll('.db-cat-dropdown').forEach(d => d.style.display = 'none');

        if (!isVis) {
            dropdown.style.display = 'block';
            const tr = dbBtn.closest('tr');
            if (tr) {
                tr.style.position = 'relative';
                tr.style.zIndex = '9999';
            }
        }
        return;
    }

    const dbOpt = e.target.closest('.db-cat-option');
    if (dbOpt) {
        const idx = parseInt(dbOpt.dataset.idx);
        const key = dbOpt.dataset.key;
        fullDbData.promos[idx].categoria = key;

        const btn = dbOpt.closest('.db-cat-wrap').querySelector('.db-cat-btn');
        btn.innerHTML = `${CAT_ICON_HTML[key]} <span>${CAT_LABELS[key] || key}</span>`;

        const tr = dbOpt.closest('tr');
        if (tr) { tr.style.position = ''; tr.style.zIndex = ''; }
        document.querySelectorAll('.db-cat-dropdown').forEach(d => d.style.display = 'none');
        return;
    }

    if (!e.target.closest('.db-cat-wrap')) {
        document.querySelectorAll('table tbody tr').forEach(r => { r.style.position = ''; r.style.zIndex = ''; });
        document.querySelectorAll('.db-cat-dropdown').forEach(d => d.style.display = 'none');
    }
});

// Eliminar fila
window.deleteDbRow = (type, idx) => {
    if (confirm("¿Seguro que querés eliminar este registro? (Necesita Guardar para aplicar)")) {
        fullDbData[type].splice(idx, 1);
        renderDbTable();
    }
};

window.saveDbChanges = async function() {
    const btn = document.getElementById('db-save-btn');
    const og = btn.innerHTML;
    btn.innerHTML = 'GUARDANDO...';
    btn.disabled = true;

    try {
        const res = await fetch('/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullDbData)
        });

        if (!res.ok) throw new Error("Error en servidor");
        btn.innerHTML = '¡GUARDADO!';
        btn.style.background = '#28a745';

        if (typeof refreshStats === 'function') refreshStats();

        // Recargar datos del servidor para mostrar fechas actualizadas
        const datosActualizados = await fetch('/db').then(r => r.json());
        fullDbData = datosActualizados;
        renderDbTable();

        setTimeout(() => {
            btn.innerHTML = og;
            btn.style.background = 'var(--accent-green)';
            btn.disabled = false;
        }, 2000);
    } catch (e) {
        alert("Error: " + e.message);
        btn.innerHTML = og;
        btn.disabled = false;
    }
}

lucide.createIcons();

// --- Lógica del Switch de Temas ---
window.toggleTheme = function () {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);
};

function updateThemeIcon(isLight) {
    const icon = document.getElementById('theme-icon');
    if (icon) {
        icon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
        lucide.createIcons();
    }
}

// Inicialización de Tema al cargar
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    // Esperar un momento a que Lucide esté listo para el icono inicial
    setTimeout(() => updateThemeIcon(true), 100);
}
