import "dotenv/config";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
// import Tesseract from "tesseract.js"; // Gemini ya hace OCR nativo

import { parseImagen } from "./parser.js";
import { mergePrecios, mergePromos } from "./merge.js";


const app = express();
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

const preciosPath = path.resolve("../app/precios.json");
const promosPath = path.resolve("../app/promos.json");

app.use(express.json());
app.use(express.static("public"));

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
    for (const file of req.files) {
      console.log(`Enviando imagen a Gemini: \${file.originalname}...`);
      
      const buffer = fs.readFileSync(file.path);
      const mimeType = "image/jpeg"; // Multer ya guarda el archivo

      const parsed = await parseImagen(buffer, mimeType);

      if (parsed.precios) allExtractedPrecios.push(...parsed.precios);
      if (parsed.promos) allExtractedPromos.push(...parsed.promos);
      
      fs.unlinkSync(file.path);
    }


    // Analizar duplicados antes de enviar la respuesta
    const actualesPrecios = JSON.parse(fs.readFileSync(preciosPath, "utf8"));
    const actualesPromos = JSON.parse(fs.readFileSync(promosPath, "utf8"));

    const preciosTagged = allExtractedPrecios.map(p => {
      const match = actualesPrecios.find(e => 
        e.comercio.toLowerCase() === p.comercio.toLowerCase() && 
        e.producto.toLowerCase() === p.producto.toLowerCase()
      );
      
      let status = "new";
      let original = null;
      if (match) {
        status = (match.precio == p.precio) ? "identical" : "update";
        if (status === "update") original = { precio: match.precio };
      }
      
      return { ...p, status, original };
    });

    const promosTagged = allExtractedPromos.map(p => {
      const match = actualesPromos.find(e => 
        e.comercio.toLowerCase() === p.comercio.toLowerCase() && 
        e.medio_pago.toLowerCase() === p.medio_pago.toLowerCase() && 
        e.descuento.toLowerCase() === p.descuento.toLowerCase()
      );

      let status = "new";
      let original = null;
      if (match) {
        const isIdentical = 
          match.detalle.toLowerCase() === p.detalle.toLowerCase() &&
          match.vigencia.toLowerCase() === p.vigencia.toLowerCase();
        status = isIdentical ? "identical" : "update";
        if (status === "update") {
          original = { detalle: match.detalle, vigencia: match.vigencia };
        }
      }

      return { ...p, status, original };
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
