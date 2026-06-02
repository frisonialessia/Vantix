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
const DEMO_RESPONSES = {
  en: [
    "The March cohort retains 9 points below February at month 3 (74% vs 85%). The model attributes 68% of the drop to an onboarding change on March 4: core-feature activation fell from 81% to 62%. Accounts not activated within 7 days churn 4.8x more.",
    "Your 3 highest-risk segments concentrate $364K of recoverable CLV. I'd prioritize At-Risk Premium (12 accounts, $182K): an account-manager call with a 15% retention offer in the next 7 days has the best impact/effort ratio.",
    "Referral beats Paid Search on CLV:CAC (5.1:1 vs 2.0:1). Reallocating $40K of budget would generate ~$190K in incremental CLV. The signal is consistent across the last 3 quarters.",
    "NRR rose to 112.6% (+4.1 pts this quarter). Expansion in Core accounts offsets Marginal churn — a sign of healthy product-market fit. The main driver is adoption of the analytics module.",
  ],
  es: [
    "La cohorte de marzo retiene 9 puntos por debajo de febrero al mes 3 (74% vs 85%). El modelo atribuye el 68% de la caída a un cambio en el flujo de onboarding del 4 de marzo: la activación de feature core cayó del 81% al 62%. Las cuentas sin activar en 7 días churnean 4.8x más.",
    "Tus 3 segmentos de mayor riesgo concentran $364K de CLV recuperable. Priorizaría At-Risk Premium (12 cuentas, $182K): una llamada del account manager con oferta de retención del 15% en los próximos 7 días tiene el mejor ratio impacto/esfuerzo.",
    "Referral supera a Paid Search en CLV:CAC (5.1:1 vs 2.0:1). Reasignar $40K de presupuesto generaría ~$190K en CLV incremental. La señal es consistente en los últimos 3 trimestres.",
    "El NRR subió a 112.6% (+4.1 pts en el trimestre). La expansión de cuentas Core compensa el churn de Marginal — señal de product-market fit saludable. El driver principal es la adopción del módulo de analítica.",
  ],
};

// Prompt de sistema: define el comportamiento del Asistente de Vantix.
const SYSTEM_PROMPT = `You are the Vantix Assistant, a customer & market intelligence platform.
You answer concisely and action-oriented.
You always connect the data (churn, CLV, NRR) to its financial impact and propose the next step.
You don't give investment advice; you give information so the user can decide.
If you don't have a figure, you say so honestly instead of inventing it.`;

// --- Implementación Gemini ---
async function askGemini(messages, context, lang) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!key) throw new Error("GEMINI_API_KEY no configurada");

  // Idioma de respuesta + grounding sobre los datos de la sesión.
  const langLine = `Respond in ${lang === "es" ? "Spanish" : "English"}.`;
  const systemText = context
    ? `${SYSTEM_PROMPT}\n${langLine}\n\nCurrent session data (use it as the ONLY source of truth about the figures; don't invent or change numbers):\n${context}`
    : `${SYSTEM_PROMPT}\n${langLine}`;

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
  const lang = opts.lang === "es" ? "es" : "en";
  if (PROVIDER === "demo") {
    // Elige una respuesta pre-generada (rota por longitud del historial).
    await new Promise((r) => setTimeout(r, 600)); // simula latencia
    const bank = DEMO_RESPONSES[lang];
    return bank[messages.length % bank.length];
  }
  if (PROVIDER === "gemini") return askGemini(messages, opts.context, lang);
  // Espacios para futuros proveedores:
  // if (PROVIDER === "anthropic") return askAnthropic(messages);
  // if (PROVIDER === "openai") return askOpenAI(messages);
  throw new Error(`Proveedor LLM no soportado: ${PROVIDER}`);
}
