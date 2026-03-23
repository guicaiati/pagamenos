import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Placeholder
    // The SDK might not have a direct listModels, but let's try to see if we can get it from the API
    console.log("Intentando listar modelos...");
    // Just a dummy request to see if the key works at all
    const result = await model.generateContent("test");
    console.log("Conexión básica OK");
  } catch (e) {
    console.error("Error en test:", e.message);
  }
}

listModels();
