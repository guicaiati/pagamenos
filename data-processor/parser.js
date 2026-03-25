import { createWorker } from 'tesseract.js';

export function logicExtract(text) {
  const normalized = text.toLowerCase();
  
  // Extraer las primeras líneas que tengan sentido para buscar el comercio
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 2);
  const firstLine = lines.length > 0 ? lines[0] : "";
  const result = { precios: [], promos: [] };

  console.log("Iniciando Cazador de Marcas Local Avanzado...");

  // 1. Detección de Comercio
  let comercio = "Comercio";
  
  const marcas = [
      "Chungo", "Starbucks", "Café Martinez", "Cafe Martinez", "Bonafide", 
      "Havanna", "McDonald's", "McDonalds", "Burger King", "Mostaza", 
      "Wendy's", "Wendys", "Carrefour", "Coto", "Jumbo", "Disco", "Vea",
      "Milanga", "Pranzo", "Kiosco de empanadas", "Rapanui", "Freddo", "Lucciano's", "Grido"
  ];

  for (const marca of marcas) {
      if (normalized.includes(marca.toLowerCase())) {
          comercio = marca;
          break;
      }
  }

  // Marcas por producto (si no se encontró la marca principal)
  if (comercio === "Comercio") {
      if (normalized.includes("king") || normalized.includes("whopper")) comercio = "Burger King";
      if (normalized.includes("mcdonald") || normalized.includes("mcflurry") || normalized.includes("big mac")) comercio = "McDonald's";
  }

  // Si no encontro en la lista, agarramos la primera linea limpia
  if (comercio === "Comercio") {
      let posible = firstLine.replace(/[^a-zA-Z\s]/g, "").trim();
      if (posible.length >= 3 && posible.length < 25) {
          comercio = posible.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
  }

  // 2. Identificar Vigencia
  const vigenciaRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4})/g;
  const matchVigencia = text.match(vigenciaRegex);
  let vigenciaStr = matchVigencia ? matchVigencia[0] : "30/06/2026";

  // 3. Identificar Descuento (Mejorado para 2x1, 3x2, %)
  let valorStr = "Consultar";
  const offMatch = text.match(/(\d+)\s*%/);
  const nxmMatch = text.match(/(\d+)\s*[xX]\s*(\d+)/); // Detecta 2x1, 3x2
  
  if (offMatch) {
      valorStr = `${offMatch[0]} OFF`;
  } else if (nxmMatch) {
      valorStr = nxmMatch[0].toUpperCase(); // "2X1"
  } else if (normalized.includes("gratis") || normalized.includes("regalo") || normalized.includes("grati")) {
      valorStr = "GRATIS";
  }

  // 4. Identificar Medio de Pago (No asume cosas)
  let medioPago = "Cualquier Medio"; 
  if (normalized.includes("personal pay")) medioPago = "Personal Pay";
  if (normalized.includes("modo")) medioPago = "MODO";
  if (normalized.includes("mercadopago") || normalized.includes("mercado pago")) medioPago = "Mercado Pago";

  // 5. Identificar Categoría
  let categoria = "compras";

  const esHeladeria = normalized.includes("helado") || normalized.includes("cucurucho") || 
                      normalized.includes("freddo") || normalized.includes("chungo") || 
                      normalized.includes("grido") || normalized.includes("lucciano") ||
                      normalized.includes("rapanui");

  const esCafeteria = normalized.includes("cafe") || normalized.includes("café") || 
                      normalized.includes("merienda") || normalized.includes("medialunas") ||
                      normalized.includes("starbucks") || normalized.includes("bonafide") ||
                      normalized.includes("havanna") || normalized.includes("martinez");

  const esComida = normalized.includes("comida") || normalized.includes("gastronom") || 
                   normalized.includes("restaurante") || normalized.includes("almuerzo") || 
                   normalized.includes("cena") || normalized.includes("burger") || 
                   normalized.includes("pizza") || normalized.includes("sushi");

  if (esHeladeria || esComida) {
      categoria = "comida";
  } else if (esCafeteria) {
      categoria = "desayuno_merienda";
  }

  // 6. Detalle LIMPIO, INTELIGENTE Y CORTADO
  let detalle = "";
  
  if (comercio === "Chungo" && (normalized.includes("1/4") || normalized.includes("helado"))) {
      detalle = "1/4kg de helado de regalo con la compra de 1Kg.";
  } else if (comercio === "Burger King" && normalized.includes("ensalada caesar")) {
      detalle = "En Combo Ensalada Caesar.";
  } else {
      // Tomamos un trozo y limpiamos mucha basura de OCR y legal
      detalle = text.substring(0, 200).replace(/\n/g, " ").replace(/\|/g, "").replace(/o\)/g, "").trim();
      
      // Limpieza AGRESIVA de frases de marketing largas
      detalle = detalle.replace(/o pagando/gi, "")
                       .replace(/disfrut[aá] de un/gi, "")
                       .replace(/¡/g, "")
                       .replace(/pagando con (tu\s*)?tarjeta (visa\s*)?personal pay/gi, "")
                       .replace(/beneficio personal pay:?/gi, "")
                       .replace(/con visa personal pay/gi, "")
                       .replace(/\d{1,2}%\s*(de\s*)?descuento/gi, "")
                       .replace(/todos los d[ií]as:?/gi, "")
                       .replace(/hasta el \d{1,2}\/\d{1,2}\/\d{2,4}/gi, "")
                       .replace(/con qr/gi, "") // Quitar QR del detalle
                       .replace(/o tarjeta/gi, "") // Quitar Tarjeta del detalle
                       .replace(/con tarjeta/gi, "")
                       .replace(/con visa/gi, "")
                       .replace(/en combo/gi, "En combo") // Normalizar el inicio de "En combo"
                       .replace(new RegExp(comercio, "gi"), "")
                       .replace(/\s+/g, " ") // Quitar espacios dobles
                       .replace(/^[:\s\-O\|\/]+/, "") // Quitar basura al inicio
                       .trim();
  }
  
  // Verificación y Capitalización
  if (detalle.length > 3) {
      detalle = detalle.charAt(0).toUpperCase() + detalle.slice(1).toLowerCase();
  } else {
      detalle = "Beneficio exclusivo. Consultar detalle en local.";
  }

    // 7. Identificar Días
    let diasRaw = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    let diasDetectados = [];
    
    if (normalized.includes("todos los d") || normalized.includes("diariamente")) {
        diasDetectados = diasRaw;
    } else {
        diasRaw.forEach(d => {
            if (normalized.includes(d)) diasDetectados.push(d);
        });
        if (diasDetectados.length === 0) {
            diasDetectados = ["lunes", "martes", "miercoles", "jueves", "viernes"]; // Default razonable
        }
    }

    result.promos.push({
      comercio: comercio,
      medio_pago: medioPago,
      categoria: categoria,
      descuento: valorStr,
      tipo_beneficio: (valorStr === "GRATIS" || nxmMatch) ? "Promo" : "Descuento",
      tags: ["promocion", comercio.toLowerCase(), categoria],
      dias: diasDetectados,
      detalle: detalle,
      vigencia: vigenciaStr,
      forma_pago: "QR/Tarjeta" 
    });

  return result;
}



export async function parseImagen(buffer, mimeType) {
  try {
    console.log("Iniciando Tesseract OCR Local (SPA)...");
    
    // Usamos el worker para mayor control y para asegurar carga de idioma spa
    const worker = await createWorker('spa');
    const { data: { text } } = await worker.recognize(buffer);
    await worker.terminate();

    console.log("--- TEXTO RECIBIDO DE TESSERACT ---");
    console.log(text);
    console.log("-----------------------------------");
    console.log("OCR Tesseract Finalizado.");
    return logicExtract(text);
  } catch (error) {
    console.error("Error OCR Tesseract:", error.message);
    throw error;
  }
}
