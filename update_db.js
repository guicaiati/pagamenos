const fs = require('fs');
const path = require('path');

const catsPath = 'c:/Users/pante/.gemini/antigravity/scratch/paga-menos/app/categorias.json';
const promosPath = 'c:/Users/pante/.gemini/antigravity/scratch/paga-menos/app/promos.json';

const cats = JSON.parse(fs.readFileSync(catsPath, 'utf-8'));
const promos = JSON.parse(fs.readFileSync(promosPath, 'utf-8'));

const catKeys = Object.keys(cats);

console.log(`Processing ${promos.length} promos...`);

promos.forEach((p, idx) => {
    const comercio = (p.comercio || "").toLowerCase();
    const detalle = (p.detalle || "").toLowerCase();
    const str = (comercio + ' ' + detalle).toLowerCase();
    
    let targetCat = p.categoria;

    // Explicit fixes for known merchants/keywords
    if (comercio.includes('freddo') || str.includes('helado') || str.includes('cono de crema') || str.includes('sundae') || str.includes('mcflurry')) {
        targetCat = 'heladerias';
    } else if (str.includes('nafta') || str.includes('combustible') || str.includes('axion') || str.includes('ypf') || str.includes('shell') || str.includes('puma') || str.includes('estación de servicio') || str.includes('estacion de servicio')) {
        targetCat = 'combustible';
    } else if (comercio.includes('farmalife') || comercio.includes('farmacity') || comercio.includes('vantage') || comercio.includes('simplicity') || str.includes('farmacia') || str.includes('perfumería')) {
        targetCat = 'farmacia';
    } else if (comercio.includes('carrefour') || comercio.includes('coto') || comercio.includes('vea') || comercio.includes('disco') || comercio.includes('jumbo') || comercio.includes('chino') || str.includes('supermercado') || str.includes('express')) {
        targetCat = 'compras';
    } else if (comercio.includes('mcdonald') || comercio.includes('burger king') || comercio.includes('mostaza') || comercio.includes('wendy') || comercio.includes('milanga') || comercio.includes('pizza') || comercio.includes('empanadas') || str.includes('gastronomía') || str.includes('gastronomia') || str.includes('cena') || str.includes('almuerzo') || str.includes('quarto de libra') || str.includes('whopper')) {
        targetCat = 'comida';
    } else if (str.includes('café') || str.includes('cafe') || str.includes('desayuno') || str.includes('merienda') || str.includes('starbucks') || str.includes('martinez') || str.includes('bonafide') || str.includes('havanna')) {
        targetCat = 'desayuno_merienda';
    } else if (str.includes('subte') || str.includes('colectivo') || str.includes('tren') || str.includes('pasajes') || str.includes('cabify') || str.includes('uber') || str.includes('transporte')) {
        targetCat = 'transporte';
    } else if (str.includes('personal') || str.includes('movistar') || str.includes('claro') || str.includes('telecentro') || str.includes('metrogas') || str.includes('edenor') || str.includes('edesur') || str.includes('luz') || str.includes('agua') || str.includes('gas') || str.includes('servicios') || str.includes('celular') || str.includes('recarga')) {
        targetCat = 'facturas';
    }

    // Final validation
    if (!targetCat || !catKeys.includes(targetCat)) {
        targetCat = 'otros';
    }

    p.categoria = targetCat;

    // Clean up tags that might cause confusion (optional but good)
    if (p.tags) {
        p.tags = p.tags.filter(t => !catKeys.includes(t.toLowerCase()) || t.toLowerCase() === targetCat);
    }
});

fs.writeFileSync(promosPath, JSON.stringify(promos, null, 2));
console.log("Database updated successfully.");
