import Tesseract from "tesseract.js";

function logicExtract(text) {
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

  // 3. Identificar Descuento (Mejorado para no inventar "GRATIS")
  const offMatch = text.match(/(\d+)\s*%/);
  let valorStr = "Consultar"; // <- Si no hay % o palabra "gratis", no asume nada
  if (offMatch) {
      valorStr = `${offMatch[0]} OFF`;
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
  if (normalized.includes("helado") || normalized.includes("cucurucho") || normalized.includes("cafe") || normalized.includes("café")) {
      categoria = "desayuno_merienda";
  } else if (normalized.includes("comida") || normalized.includes("gastronom") || normalized.includes("restaurante")) {
      categoria = "comida";
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
      
      // Limpieza AGRESIVA de frases de marketing largas de Personal Pay
      detalle = detalle.replace(/o pagando/gi, "")
                       .replace(/disfrut[aá] de un/gi, "")
                       .replace(/¡/g, "")
                       .replace(/pagando con (tu\s*)?tarjeta (visa\s*)?personal pay/gi, "")
                       .replace(/beneficio personal pay:?/gi, "")

                       .replace(/con visa personal pay/gi, "")
                       .replace(/disfrut[aá] de un \d{1,2}%\s*(de\s*)?descuento en/gi, "En")
                       .replace(/\d{1,2}%\s*(de\s*)?descuento todos los d[ií]as:?/gi, "")
                       .replace(/hasta el \d{1,2}\/\d{1,2}\/\d{2,4}/gi, "")
                       .replace(new RegExp(comercio, "gi"), "")
                       .replace(/\s+/g, " ") // Quitar espacios dobles
                       .replace(/^:?\s*/, "") // Quitar dos puntos al inicio
                       .trim();
  }
  
  // Verificación y Capitalización
  if (detalle.length > 3) {
      detalle = detalle.charAt(0).toUpperCase() + detalle.slice(1).toLowerCase();
      // Asegurarse de que no sea tan largo (resumen)
      if (detalle.length > 70) {
          detalle = detalle.substring(0, 67) + "...";
      }
  } else {
      detalle = "Beneficio exclusivo. Consultar detalle en local.";
  }

  result.promos.push({
    comercio: comercio,
    medio_pago: medioPago,
    categoria: categoria,
    descuento: valorStr,
    tipo_beneficio: valorStr === "GRATIS" ? "Regalo" : "Descuento",
    tags: ["promocion", comercio.toLowerCase(), categoria],
    dias: ["lunes", "martes", "miercoles", "jueves", "viernes"],
    detalle: detalle,
    vigencia: vigenciaStr,
    forma_pago: "QR/Tarjeta" 
  });

  return result;
}

export async function parseImagen(buffer, mimeType) {
  try {
    const { data: { text } } = await Tesseract.recognize(buffer, "spa");
    return logicExtract(text);
  } catch (error) {
    console.error("Error OCR:", error.message);
    throw error;
  }
}
