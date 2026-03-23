import OpenAI from "openai";
import "dotenv/config";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
  console.log("Testeando conexión con OpenAI...");
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Responde 'OK'" }],
  });
  console.log("Respuesta:", res.choices[0].message.content);
}

test();
