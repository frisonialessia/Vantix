// ============================================================
// CAPTURA DE LEADS — proxy serverless a Supabase
// ------------------------------------------------------------
// Inserta el lead (email + parámetros del negocio) en la tabla `leads`
// de Supabase. La clave vive en el SERVIDOR (Vercel env), nunca en el
// cliente. Si Supabase no está configurado, responde ok sin guardar para
// no romper la demo (el dashboard se genera igual a partir de los inputs).
// ============================================================
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ ok: false, error: "Email inválido." }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    // Sin configurar todavía → no guardamos, pero no rompemos la demo.
    if (!url || !key) return Response.json({ ok: true, stored: false });

    const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);
    const row = {
      email,
      company: str(body?.company, 120),
      industry: str(body?.industry, 80),
      mrr_band: str(body?.mrr_band, 40),
      customers_band: str(body?.customers_band, 40),
      source: "vantix-demo",
    };

    const res = await fetch(`${url}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Supabase lead insert error:", res.status, detail.slice(0, 200));
      return Response.json({ ok: false, error: "No se pudo guardar el lead." }, { status: 502 });
    }
    return Response.json({ ok: true, stored: true });
  } catch (err) {
    console.error("Error en /api/lead:", err);
    return Response.json({ ok: false, error: "Error interno." }, { status: 500 });
  }
}
