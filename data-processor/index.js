import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import { parseImagen } from "./parser.js";
import { mergePrecios, mergePromos, generateSlug } from "./merge.js";


const app = express();
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

const preciosPath = path.resolve("../app/precios.json");
const promosPath = path.resolve("../app/promos.json");
const categoriasPath = path.resolve("../app/categorias.json");

app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

// Base de Datos - Acceso Directo (Edición Masiva)
app.get("/db", (req, res) => {
  const precios = fs.existsSync(preciosPath) ? JSON.parse(fs.readFileSync(preciosPath, "utf8")) : [];
  const promos = fs.existsSync(promosPath) ? JSON.parse(fs.readFileSync(promosPath, "utf8")) : [];
  res.json({ precios, promos });
});

app.post("/db", (req, res) => {
  const { precios, promos } = req.body;
  if (precios) fs.writeFileSync(preciosPath, JSON.stringify(precios, null, 2));
  if (promos) fs.writeFileSync(promosPath, JSON.stringify(promos, null, 2));
  res.json({ success: true });
});

// Categorías API
app.get("/categories", (req, res) => {
  const cats = fs.existsSync(categoriasPath) ? JSON.parse(fs.readFileSync(categoriasPath, "utf8")) : {};
  res.json(cats);
});

app.post("/categories", (req, res) => {
  fs.writeFileSync(categoriasPath, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Estado del Servidor y Archivos
app.get("/status", (req, res) => {
  const stats = {
    hasKey: !!process.env.GEMINI_API_KEY,
    preciosSet: fs.existsSync(preciosPath),
    promosSet: fs.existsSync(promosPath),

    countPrecios: 0,
    countPromos: 0,
    lastUpdate: "Nunca"
  };

  if (stats.preciosSet) {
    const data = JSON.parse(fs.readFileSync(preciosPath, "utf8"));
    stats.countPrecios = data.length;
    const mtime = fs.statSync(preciosPath).mtime;
    stats.lastUpdate = mtime.toLocaleString('es-AR');
  }
  
  if (stats.promosSet) {
    const data = JSON.parse(fs.readFileSync(promosPath, "utf8"));
    stats.countPromos = data.length;
  }

  res.json(stats);
});

// 1. EXTRAER: Procesa imágenes y devuelve JSON propuesto (SIN GUARDAR)
app.post("/upload", upload.array("files"), async (req, res) => {
  console.log(`Extrayendo datos de ${req.files.length} archivos...`);
  
  let allExtractedPrecios = [];
  let allExtractedPromos = [];

  try {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        console.log(`Enviando imagen a Gemini: ${file.originalname}...`);
        
        const buffer = fs.readFileSync(file.path);
        const mimeType = "image/jpeg"; // Multer ya guarda el archivo

        const parsed = await parseImagen(buffer, mimeType);

        if (parsed.precios) allExtractedPrecios.push(...parsed.precios);
        if (parsed.promos) allExtractedPromos.push(...parsed.promos);
        
        fs.unlinkSync(file.path);
      }
    }

    if (req.body && req.body.rawText) {
      console.log(`Procesando texto manual ingresado...`);
      // Importación dinámica a nivel funcion para simplificar sin tocar arriba
      const { logicExtract } = await import("./parser.js");
      const parsedText = logicExtract(req.body.rawText);
      if (parsedText.precios) allExtractedPrecios.push(...parsedText.precios);
      if (parsedText.promos) allExtractedPromos.push(...parsedText.promos);
    }


    // Analizar duplicados antes de enviar la respuesta
    const actualesPrecios = JSON.parse(fs.readFileSync(preciosPath, "utf8"));
    const actualesPromos = JSON.parse(fs.readFileSync(promosPath, "utf8"));

    const preciosTagged = allExtractedPrecios.map(p => {
      let bestMatch = null;
      let highestScore = 0;

      for (const e of actualesPrecios) {
        let score = 0;
        // Comercio (50%)
        if (e.comercio.toLowerCase() === p.comercio.toLowerCase()) score += 50;
        // Producto (40%)
        if (e.producto.toLowerCase() === p.producto.toLowerCase()) score += 40;
        else if (e.producto.toLowerCase().includes(p.producto.toLowerCase()) || p.producto.toLowerCase().includes(e.producto.toLowerCase())) score += 20;
        // Precio (10%)
        if (e.precio == p.precio) score += 10;

        if (score > highestScore) {
          highestScore = score;
          bestMatch = e;
        }
      }

      let status = "new";
      let original = null;
      if (highestScore >= 90) {
        status = (highestScore === 100) ? "identical" : "update";
        original = bestMatch;
      } else if (highestScore >= 50) {
        status = "potential_duplicate";
        original = bestMatch;
      }
      
      return { ...p, status, matchScore: highestScore, original: original ? { precio: original.precio } : null };
    });

    const normalize = (s) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, "") : "";

    const promosTagged = allExtractedPromos.map(p => {
      p.slug = generateSlug(p);
      let bestMatch = null;
      let highestScore = 0;

      for (const e of actualesPromos) {
        let score = 0;

        // Comercio (20%)
        const compE = normalize(e.comercio); const compP = normalize(p.comercio);
        if (compE === compP && compE !== "") score += 20;
        else if (compE && compP && (compE.includes(compP) || compP.includes(compE))) score += 10;

        // Medio de Pago (20%)
        const medE = normalize(e.medio_pago); const medP = normalize(p.medio_pago);
        if (medE === medP && medE !== "") score += 20;
        else if (medE && medP && (medE.includes(medP) || medP.includes(medE))) score += 10;

        // Forma de Pago (10%)
        const formE = normalize(e.forma_pago); const formP = normalize(p.forma_pago);
        if (formE === formP && formE !== "") score += 10;
        else if (formE && formP && (formE.includes(formP) || formP.includes(formE))) score += 5;

        // Descuento/Valor (15%)
        const descE = normalize(e.descuento); const descP = normalize(p.descuento);
        if (descE === descP && descE !== "") score += 15;
        else if (descE && descP && (descE.includes(descP) || descP.includes(descE))) score += 8;

        // Detalle / Producto (Búsqueda inteligente por producto - 35%)
        const detailE = (e.detalle || "").toLowerCase(); 
        const detailP = (p.detalle || "").toLowerCase();
        const normDetE = normalize(detailE); const normDetP = normalize(detailP);
        
        if (normDetE === normDetP && normDetE !== "") {
            score += 35;
        } else if (normDetE && normDetP && (normDetE.includes(normDetP) || normDetP.includes(normDetE))) {
            score += 20;
        } else {
            // Extracción de palabras clave: mantenemos palabras > 3 letras o que contengan números (como 2x1, 10%, 3er)
            const getKeywords = (str) => str.replace(/[^a-z0-9áéíóúñ ]/g, " ").split(/\s+/).filter(w => w.length > 3 || /\d/.test(w));
            const wordsP = getKeywords(detailP);
            const wordsE = getKeywords(detailE);
            
            let matches = 0;
            for (let wp of wordsP) {
                // Si la palabra clave extraída está en la info original (ej: "king", "combo", "2x1")
                if (wordsE.includes(wp)) matches++;
            }
            
            if (wordsP.length > 0) {
               // Otorga hasta 15 puntos proporcionales a cuántas palabras clave coincidieron
               score += Math.floor((matches / wordsP.length) * 15);
            }
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = e;
        }
      }

      let status = "new";
      let original = null;
      
      // La coincidencia de SLUG sigue siendo la verdad absoluta del 100%
      const slugMatch = actualesPromos.find(e => (e.slug || generateSlug(e)) === p.slug);

      if (slugMatch) {
          const isIdentical = 
            slugMatch.descuento === p.descuento &&
            slugMatch.detalle === p.detalle &&
            slugMatch.vigencia === p.vigencia &&
            normalize(slugMatch.forma_pago) === normalize(p.forma_pago);
          status = isIdentical ? "identical" : "update";
          original = slugMatch;
          highestScore = 100;
      } else if (highestScore >= 35) {
          status = "potential_duplicate";
          original = bestMatch;
      }

      return { 
        ...p, 
        status, 
        matchScore: highestScore,
        original: original ? { 
          comercio: original.comercio, 
          medio_pago: original.medio_pago,
          descuento: original.descuento, 
          detalle: original.detalle,
          forma_pago: original.forma_pago,
          slug: original.slug || generateSlug(original)
        } : null 
      };
    });

    res.json({ 
      ok: true, 
      precios: preciosTagged, 
      promos: promosTagged 
    });
  } catch (error) {
    console.error("Error en extracción:", error.message);
    res.status(500).json({ ok: false, error: "Google API Error: " + error.message });
  }
});


// 2. GUARDAR: Aplica los cambios confirmados por el usuario
app.post("/save", (req, res) => {
  const { precios: nuevosPrecios, promos: nuevasPromos } = req.body;

  try {
    let actualesPrecios = JSON.parse(fs.readFileSync(preciosPath, "utf8"));
    let actualesPromos = JSON.parse(fs.readFileSync(promosPath, "utf8"));

    const resultPrecios = mergePrecios(actualesPrecios, nuevosPrecios || []);
    const resultPromos = mergePromos(actualesPromos, nuevasPromos || []);

    fs.writeFileSync(preciosPath, JSON.stringify(resultPrecios.data, null, 2));
    fs.writeFileSync(promosPath, JSON.stringify(resultPromos.data, null, 2));

    const totalAdded = resultPrecios.stats.added + resultPromos.stats.added;
    const totalUpdated = resultPrecios.stats.updated + resultPromos.stats.updated;

    let message = "Operación completada. ";
    if (totalAdded > 0) message += `Se agregaron ${totalAdded} nuevos registros. `;
    if (totalUpdated > 0) message += `Se detectaron y actualizaron ${totalUpdated} duplicados. `;
    if (totalAdded === 0 && totalUpdated === 0) message = "No se realizaron cambios (los datos ya existen).";

    res.json({ ok: true, message: message });
  } catch (error) {
    console.error("Error al guardar:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Processor API v1.1 - Multistage Pipeline`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`========================================`);
});
