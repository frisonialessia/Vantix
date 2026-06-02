// ============================================================
// CLIENTE LLM CONFIGURABLE — núcleo reutilizable de la Factory
// ------------------------------------------------------------
// Una sola función `askLLM` que abstrae el proveedor. Hoy Gemini;
// mañana Anthropic/OpenAI cambiando LLM_PROVIDER, sin tocar la UI.
// Vantix y Halo compartirán este archivo cuando exista el monorepo.
// ============================================================

const PROVIDER = process.env.LLM_PROVIDER || "demo";

// --- Respuestas pre-generadas para modo demo (costo cero absoluto) ---
// Convincentes para LinkedIn sin gastar un solo token.
const DEMO_RESPONSES = [
  "La cohorte de marzo retiene 9 puntos por debajo de febrero al mes 3 (74% vs 85%). El modelo atribuye el 68% de la caída a un cambio en el flujo de onboarding del 4 de marzo: la activación de feature core cayó del 81% al 62%. Las cuentas sin activar en 7 días churnean 4.8x más.",
  "Tus 3 segmentos de mayor riesgo concentran $364K de CLV recuperable. Priorizaría At-Risk Premium (12 cuentas, $182K): una llamada del account manager con oferta de retención del 15% en los próximos 7 días tiene el mejor ratio impacto/esfuerzo.",
  "Referral supera a Paid Search en CLV:CAC (5.1:1 vs 2.0:1). Reasignar $40K de presupuesto generaría ~$190K en CLV incremental. La señal es consistente en los últimos 3 trimestres.",
  "El NRR subió a 112.6% (+4.1 pts en el trimestre). La expansión de cuentas Core compensa el churn de Marginal — señal de product-market fit saludable. El driver principal es la adopción del módulo de analítica.",
];

// Prompt de sistema: define el comportamiento del Asistente de Vantix.
const SYSTEM_PROMPT = `Eres el Asistente de Vantix, una plataforma de customer & market intelligence.
Respondes en español, de forma concisa y orientada a la acción.
Siempre conectas los datos (churn, CLV, NRR) con su impacto financiero y propones el siguiente paso.
No das consejo de inversión; das información para que el usuario decida.
Si no tienes un dato, lo dices con honestidad en lugar de inventarlo.`;

// --- Implementación Gemini ---
async function askGemini(messages, context) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!key) throw new Error("GEMINI_API_KEY no configurada");

  // Grounding: si llega el snapshot de la sesión, es la única fuente de verdad.
  const systemText = context
    ? `${SYSTEM_PROMPT}\n\nDatos de la sesión actual (úsalos como ÚNICA fuente de verdad sobre las cifras; no inventes ni cambies números):\n${context}`
    : SYSTEM_PROMPT;

  // Gemini espera el historial en su formato de "contents".
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || "No pude generar una respuesta en este momento.";
}

// --- Punto de entrada único ---
// messages: [{ role: "user"|"assistant", content: string }]
export async function askLLM(messages, opts = {}) {
  if (PROVIDER === "demo") {
    // Elige una respuesta pre-generada (rota por longitud del historial).
    await new Promise((r) => setTimeout(r, 600)); // simula latencia
    return DEMO_RESPONSES[messages.length % DEMO_RESPONSES.length];
  }
  if (PROVIDER === "gemini") return askGemini(messages, opts.context);
  // Espacios para futuros proveedores:
  // if (PROVIDER === "anthropic") return askAnthropic(messages);
  // if (PROVIDER === "openai") return askOpenAI(messages);
  throw new Error(`Proveedor LLM no soportado: ${PROVIDER}`);
}
