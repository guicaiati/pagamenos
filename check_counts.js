const fs = require('fs');
const promos = JSON.parse(fs.readFileSync('c:/Users/pante/.gemini/antigravity/scratch/paga-menos/app/promos.json', 'utf-8'));
const counts = {};
promos.forEach(p => {
    counts[p.categoria] = (counts[p.categoria] || 0) + 1;
});
console.log(JSON.stringify(counts, null, 2));
