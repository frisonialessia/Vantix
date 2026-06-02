// ============================================================
// PROXY SERVERLESS DEL ASISTENTE
// ------------------------------------------------------------
// El front-end llama a /api/assistant con los mensajes + un snapshot
// de los datos de la sesión (grounding). Este código corre en el SERVIDOR
// (Vercel), donde vive la API key. El navegador nunca ve la key.
// ============================================================
import { askLLM } from "../../../lib/llm";

// --- Rate-limit en memoria (guarda de costo) ---
// Protege la cuota de Gemini del abuso del endpoint público. Se reinicia en
// cold start y no se comparte entre instancias, pero corta ráfagas. Para una
// demo de costo casi-cero es suficiente.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15; // consultas por IP por minuto
const hits = new Map();
function allow(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // evita crecimiento ilimitado de memoria
  return true;
}

export async function POST(request) {
  try {
    const ip = (request.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
    if (!allow(ip)) {
      return Response.json(
        { error: "Demasiadas consultas seguidas. Espera un momento e intenta de nuevo." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return Response.json({ error: "Faltan mensajes." }, { status: 400 });
    }

    // Snapshot de los datos de la sesión (grounding). Acotado para limitar tokens.
    const context = typeof body?.context === "string" ? body.context.slice(0, 4000) : "";

    // Límite defensivo: no procesar historiales absurdamente largos.
    const trimmed = messages.slice(-12);

    const reply = await askLLM(trimmed, { context });
    return Response.json({ reply });
  } catch (err) {
    console.error("Error en /api/assistant:", err);
    return Response.json(
      { error: "No se pudo procesar la consulta." },
      { status: 500 }
    );
  }
}
