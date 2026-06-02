// ============================================================
// PROXY SERVERLESS DEL ASISTENTE
// ------------------------------------------------------------
// El front-end llama a /api/assistant con los mensajes.
// Este código corre en el SERVIDOR (Vercel), donde vive la API key.
// El navegador nunca ve la key. Este es el muro de seguridad del Nivel 2.
// ============================================================
import { askLLM } from "../../../lib/llm";

export async function POST(request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];

    if (messages.length === 0) {
      return Response.json({ error: "Faltan mensajes." }, { status: 400 });
    }

    // Límite defensivo: no procesar historiales absurdamente largos.
    const trimmed = messages.slice(-12);

    const reply = await askLLM(trimmed);
    return Response.json({ reply });
  } catch (err) {
    console.error("Error en /api/assistant:", err);
    return Response.json(
      { error: "No se pudo procesar la consulta." },
      { status: 500 }
    );
  }
}
