// ============================================================
// MOTOR DE DATOS SINTÉTICOS — núcleo reutilizable de la Factory
// ------------------------------------------------------------
// JS puro, sin React ni dependencias. Una semilla → un dataset
// coherente y determinista: misma semilla, mismos números; semilla
// distinta, dashboard distinto pero internamente consistente
// (las alertas, la narrativa y los KPIs citan las mismas cifras).
//
// Vantix y Halo comparten este motor. Lo específico de cada SaaS
// vive en su PROFILE, no en el motor — igual que lib/llm.js.
// ============================================================

// --- PRNG sembrado (un solo generador para toda la Factory) ---
// hash de string (xfnv1a) → entero, luego mulberry32. Determinista.
export function makeRng(seed) {
  const str = String(seed);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Semilla nueva y legible por sesión. Solo se invoca en el cliente.
export function newSeed() {
  return "vtx-" + Math.random().toString(36).slice(2, 10);
}

// ============================================================
// PERFIL VANTIX — lo específico de este SaaS (Halo traerá el suyo)
// ============================================================
export const VANTIX_PROFILE = {
  palette: {
    brand: "#6366F1", indigo: "#6366F1", teal: "#22B5C4", green: "#10B981",
    good: "#10B981", warn: "#F59E0B", amber: "#F59E0B", orange: "#F59E0B",
    bad: "#EF4444", red: "#EF4444", blue: "#4F8DF5",
  },
  cohortMonths: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
  // ratio se deriva de clv/cac; c es la clave de color dentro de palette
  channels: [
    { ch: "Referral",    cac: 90,  clv: 459, vol: 420, c: "teal" },
    { ch: "Organic",     cac: 70,  clv: 322, vol: 980, c: "green" },
    { ch: "Content",     cac: 140, clv: 511, vol: 310, c: "indigo" },
    { ch: "Paid Social", cac: 220, clv: 540, vol: 760, c: "amber" },
    { ch: "Paid Search", cac: 310, clv: 620, vol: 540, c: "orange" },
    { ch: "Display",     cac: 280, clv: 392, vol: 290, c: "red" },
  ],
  retentionPlan: [
    { seg: "At-Risk Premium",  action: "Llamada del account manager + oferta de retención 15%", effort: "Alto",  window: "7 días",  color: "bad",  baseAccounts: 12, baseClv: 214, baseImpact: 182 },
    { seg: "Cooling VIP",      action: "Upgrade a plan anual con descuento de fidelidad",        effort: "Medio", window: "14 días", color: "warn", baseAccounts: 8,  baseClv: 156, baseImpact: 118 },
    { seg: "Loyal en declive", action: "Campaña de reactivación + tutorial de feature core",     effort: "Bajo",  window: "30 días", color: "warn", baseAccounts: 23, baseClv: 98,  baseImpact: 64 },
  ],
  // grid base de retención (el motor lo jitterea y preserva la señal de marzo)
  cohortBaseGrid: [
    { name: "Ene 25", vals: [100, 88, 81, 76, 72, 70] },
    { name: "Feb 25", vals: [100, 91, 85, 80, 77, null] },
    { name: "Mar 25", vals: [100, 82, 74, 68, null, null] },
    { name: "Abr 25", vals: [100, 93, 88, null, null, null] },
    { name: "May 25", vals: [100, 94, null, null, null, null] },
    { name: "Jun 25", vals: [100, null, null, null, null, null] },
  ],
};

// ============================================================
// GENERADOR — semilla → dataset completo y coherente
// ============================================================
export function generateDataset(seed, profile = VANTIX_PROFILE, inputs = {}) {
  const rng = makeRng(seed);
  const P = profile.palette;

  // --- escala "a medida": ancla las cifras de dinero al MRR que declara el
  // usuario (sin ingerir datos reales; solo escala lo extensivo). Lo intensivo
  // (NRR, churn, CLV:CAC, unit economics) NO escala: es realista a cualquier
  // tamaño. baseMrrK = 480 es el MRR implícito del dashboard original.
  const baseMrrK = 480;
  const mrrK = inputs.mrrK && inputs.mrrK > 0 ? inputs.mrrK : baseMrrK;
  const moneyFactor = mrrK / baseMrrK;
  // formatea $K → "$847.2K" o "$3.5M" según magnitud
  const fmtK = (k) => (k >= 1000 ? `$${(k / 1000).toFixed(1)}M` : `$${k.toFixed(1)}K`);

  const between = (lo, hi) => lo + (hi - lo) * rng();
  const round = (v, d = 0) => +(+v).toFixed(d);
  const jitter = (base, pct) => base * (1 + (rng() * 2 - 1) * pct);
  const intBetween = (lo, hi) => Math.round(between(lo, hi));
  // serie de sparkline desde start hasta end con ligero ruido
  const spark = (start, end, n = 8, d = 1) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      out.push(round(start + (end - start) * t + (rng() * 2 - 1) * Math.abs(end - start) * 0.07, d));
    }
    out[n - 1] = round(end, d);
    return out;
  };

  // --- primitivas coherentes: todo lo demás se deriva de aquí ---
  const nrr = round(between(108, 116), 1);
  const nrrDelta = round(between(2.6, 5.2), 1);
  const clvCac = round(between(3.8, 4.7), 1);
  const clvCacDelta = round(between(0.3, 0.8), 1);
  const churn = round(between(5.5, 8.5), 1);
  const churnDelta = round(between(1.2, 2.6), 1);
  const revAtRiskK = round(between(720, 950) * moneyFactor, 1);
  const revAtRiskDelta = round(between(8, 16), 1);

  // --- plan de retención (las cuentas suman el total en riesgo) ---
  const retentionPlan = profile.retentionPlan.map((r) => {
    const accounts = Math.max(1, Math.round(jitter(r.baseAccounts, 0.18)));
    const clv = round(jitter(r.baseClv, 0.12) * moneyFactor);
    const impact = Math.min(clv, round(jitter(r.baseImpact, 0.12) * moneyFactor));
    return { seg: r.seg, accounts, clv, action: r.action, effort: r.effort, window: r.window, color: P[r.color], impact };
  });
  const atRiskAccounts = retentionPlan.reduce((a, p) => a + p.accounts, 0);
  const recoverK = retentionPlan.reduce((a, p) => a + p.impact, 0);
  const top = retentionPlan[0];

  // --- canales (ratio = clv/cac, derivado) ---
  const channels = profile.channels.map((c) => {
    const cac = round(jitter(c.cac, 0.12));
    const clv = round(jitter(c.clv, 0.12));
    const vol = round(jitter(c.vol, 0.12));
    const dec = c.clv / c.cac >= 3 ? 1 : 2;
    return { ch: c.ch, cac, clv, vol, ratio: round(clv / cac, dec), c: P[c.c] };
  });
  const referral = channels.find((c) => c.ch === "Referral") || channels[0];
  const paidSearch = channels.find((c) => c.ch === "Paid Search") || channels[channels.length - 1];

  // --- KPIs (citan las primitivas; el spark es solo forma) ---
  const kpis = [
    { label: "Revenue at Risk",        val: fmtK(revAtRiskK), d: `-${revAtRiskDelta}%`, good: false, spark: spark(revAtRiskK * 0.048, revAtRiskK * 0.034, 8, 0) },
    { label: "Net Revenue Retention",  val: `${nrr.toFixed(1)}%`,          d: `+${nrrDelta}%`,       good: true,  spark: spark(nrr - 14, nrr) },
    { label: "Predicted CLV : CAC",    val: `${clvCac.toFixed(1)} : 1`,    d: `+${clvCacDelta}`,     good: true,  spark: spark(clvCac - 1.2, clvCac, 8, 1) },
    { label: "Churn Probability",      val: `${churn.toFixed(1)}%`,        d: `-${churnDelta}%`,     good: true,  spark: spark(churn + 4, churn, 8, 1) },
  ];

  const revenueAtRisk = { totalK: revAtRiskK, totalLabel: fmtK(revAtRiskK), accounts: atRiskAccounts, recoverK, recoverLabel: fmtK(recoverK) };

  // --- cohortes (jitter suave + se preserva la regresión de marzo) ---
  const cohortMonths = profile.cohortMonths;
  const cohortGrid = profile.cohortBaseGrid.map((row) => ({
    name: row.name,
    vals: row.vals.map((v) =>
      v == null || v === 100 ? v : Math.round(Math.max(40, Math.min(99, v + (rng() * 2 - 1) * 2.4)))
    ),
  }));
  const cohortGap = intBetween(8, 11);
  if (cohortGrid[1].vals[2] != null) cohortGrid[2].vals[2] = cohortGrid[1].vals[2] - cohortGap;

  // --- alertas (referencian plan, cohortes y canales) ---
  const payFail = intBetween(32, 45);
  const paySubs = intBetween(38, 56);
  const loyalDrop = intBetween(11, 17);
  const alerts = [
    { sev: "critical", c: P.bad,  title: `${top.accounts} cuentas de alto valor cruzaron a riesgo crítico`, meta: `$${top.clv}K CLV en juego · últimas 168h`, action: "Ver lista de rescate" },
    { sev: "critical", c: P.bad,  title: `Tasa de fallo de pago +${payFail}% en plan Premium`, meta: `${paySubs} suscripciones afectadas · dunning activo`, action: "Revisar facturación" },
    { sev: "warning",  c: P.warn, title: `Cohorte de marzo retiene ${cohortGap}pts por debajo de febrero`, meta: "Posible regresión de onboarding", action: "Comparar cohortes" },
    { sev: "warning",  c: P.warn, title: `Engagement del segmento Loyal cayó ${loyalDrop}% en 30 días`, meta: "Indicador adelantado de churn", action: "Ver causa raíz" },
    { sev: "info",     c: P.blue, title: `Canal Referral ahora top en CLV:CAC (${referral.ratio.toFixed(1)}:1)`, meta: "Considera reasignar presupuesto de Paid", action: "Ver atribución" },
  ];

  // --- narrativa ejecutiva (mismas cifras que el resto) ---
  const reassignK = intBetween(36, 44);
  const incrementalK = Math.round(reassignK * between(4.4, 5.0));
  const riskJump = intBetween(120, 160);
  const narrative = [
    { tag: "GANADO", c: P.good, text: `Referral superó a Paid Search en CLV:CAC (${referral.ratio.toFixed(1)}:1 vs ${paidSearch.ratio.toFixed(1)}:1). Reasignar $${reassignK}K de presupuesto generaría ~$${incrementalK}K en CLV incremental.` },
    { tag: "RIESGO", c: P.bad,  text: `${top.accounts} cuentas de alto valor ($${top.clv}K CLV) cruzaron a riesgo crítico esta semana, +${riskJump}% vs media de 8 semanas. Concentradas en plan Premium con fallos de pago.` },
    { tag: "TENDENCIA", c: P.indigo, text: `NRR subió a ${nrr.toFixed(1)}% (+${nrrDelta}pts trimestre). La expansión de cuentas Core compensa el churn de Marginal — señal de product-market fit saludable.` },
  ];

  return {
    seed,
    inputs: { mrrK, customers: inputs.customers || null, industry: inputs.industry || null },
    metrics: { nrr, nrrDelta, clvCac, churn, revAtRiskK, atRiskAccounts, recoverK, cohortGap, mrrK, arrK: mrrK * 12 },
    simulator: { baseMrrK: mrrK, atRiskMrrK: round(mrrK * 0.175) },
    finance: { startMrrK: mrrK },
    kpis,
    revenueAtRisk,
    retentionPlan,
    channels,
    cohortMonths,
    cohortGrid,
    alerts,
    narrative,
  };
}
