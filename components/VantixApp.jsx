"use client";
import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ComposedChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis
} from "recharts";
import { SessionProvider, useSession, useIsMobile } from "./session";
import { makeRng, toSnapshot } from "../lib/synth";

/* ============================================================
   VANTIX — SISTEMA DE DISEÑO ESTÁNDAR
   ------------------------------------------------------------
   TIPOGRAFÍA (Inter en toda la UI):
     FS.h1  24px/700  → título de página (H1)
     FS.h2  14px/600  → título de panel
     FS.kpi 26px/700  → cifras grandes de KPI
     FS.body 13px/450 → texto de cuerpo
     FS.label 11px/500 → etiquetas de campo
     FS.tag  10.5px/500 UPPER → etiqueta de panel (esquina)
     FS.axis 10px/400  → ejes y micro-texto de gráfica
   COLOR (significado fijo):
     brand (índigo #6366F1) → acción, activo, links, énfasis neutro
     good  (#10B981) → positivo / saludable / blindar
     warn  (#F59E0B) → atención / vigilar
     bad   (#EF4444) → riesgo / crítico / rescate
     sub   (#6B7280) → texto secundario   line (#E8EAEE) → bordes
   GRÁFICAS: solo DATA_RAMP (6 colores). +6 categorías → rampColor() interpola.
   PANEL: altura fija = h, sin scroll salvo tablas; título arriba-izq, tag arriba-der.
   ============================================================ */
const FS = { h1: 24, h2: 14, kpi: 26, body: 13, label: 11, tag: 10.5, axis: 10 };

/* ===== SISTEMA DE COLOR ESTANDARIZADO =====
   Marca: índigo (primario, único color de acción/UI)
   Semánticos: good/warn/bad (significado fijo, nunca decorativos)
   Neutros: panel/panel2/line/sub/text
   Rampa de datos (d1..d6): SOLO para visualizaciones que distinguen categorías.
   Los nombres antiguos (pink, teal, etc.) se mapean a la rampa para coherencia. */
const BRAND = "#6366F1";        // índigo primario
const BRAND_DK = "#4F46E5";     // índigo oscuro (hover/énfasis)
const PAL = {
  // neutros
  panel: "#FFFFFF", panel2: "#F7F8FA", line: "#E8EAEE", sub: "#6B7280", text: "#1A1D23",
  // marca
  indigo: BRAND, brand: BRAND, brandDk: BRAND_DK,
  // semánticos (significado fijo)
  good: "#10B981", warn: "#F59E0B", bad: "#EF4444",
  // rampa de datos secuencial índigo→teal→verde (6 tonos, armónica)
  d1: "#6366F1", d2: "#4F8DF5", d3: "#22B5C4", d4: "#10B981", d5: "#84CC16", d6: "#F59E0B",
};
// Los 6 ÚNICOS colores para gráficas (violeta, azul, teal, verde, lima, naranja)
const DATA_RAMP = [PAL.d1, PAL.d2, PAL.d3, PAL.d4, PAL.d5, PAL.d6];
// Aliases → todos caen dentro de los 6 oficiales (sin introducir colores nuevos)
PAL.violet = PAL.d1; PAL.blue = PAL.d2; PAL.teal = PAL.d3; PAL.green = PAL.d4;
PAL.lime = PAL.d5; PAL.amber = PAL.d6; PAL.orange = PAL.d6;
PAL.pink = PAL.d1; PAL.magenta = PAL.d1; PAL.red = PAL.bad;
// Interpolación: si hay más de 6 categorías, genera tonos intermedios ENTRE los 6,
// sin salirse de la paleta. rampColor(i, total) reparte los puntos sobre la rampa.
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbToHex(r) { return "#" + r.map(v => Math.round(v).toString(16).padStart(2, "0")).join(""); }
function rampColor(i, total) {
  if (total <= 1) return DATA_RAMP[0];
  if (total <= DATA_RAMP.length) return DATA_RAMP[i];
  // posición continua sobre la rampa [0 .. ramp.length-1]
  const pos = (i / (total - 1)) * (DATA_RAMP.length - 1);
  const lo = Math.floor(pos), hi = Math.min(lo + 1, DATA_RAMP.length - 1), t = pos - lo;
  const a = hexToRgb(DATA_RAMP[lo]), b = hexToRgb(DATA_RAMP[hi]);
  return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
}
const FONT = `"Inter", -apple-system, sans-serif`;
const REPO_URL = "https://github.com/frisonialessia/Vantix"; // "View source" (repo público)

/* =================== DATOS =================== */
const ridgeNames = ["PLATINUM", "VIP", "PREMIUM", "CORE", "GROWTH", "AT-RISK", "DORMANT"];
const ridgeMeans = [8, 14, 22, 34, 48, 66, 84];
const ridgeSegments = ridgeNames.map((name, i) => ({ name, color: rampColor(i, ridgeNames.length), mean: ridgeMeans[i] }));
const ridgeData = Array.from({ length: 50 }, (_, i) => {
  const x = i * 2; const row = { x };
  ridgeSegments.forEach((s) => { row[s.name] = +(Math.exp(-((x - s.mean) ** 2) / (2 * 13 ** 2)) * 100).toFixed(2); });
  return row;
});
const boxBase = [
  { phrase: "Power Users", lo: 78, q1: 86, med: 92, q3: 96, hi: 100 },
  { phrase: "Champions", lo: 70, q1: 80, med: 88, q3: 93, hi: 99 },
  { phrase: "Loyal", lo: 60, q1: 70, med: 76, q3: 84, hi: 95 },
  { phrase: "Engaged", lo: 52, q1: 63, med: 70, q3: 78, hi: 90 },
  { phrase: "Regular", lo: 40, q1: 55, med: 64, q3: 74, hi: 88 },
  { phrase: "Casual", lo: 30, q1: 42, med: 52, q3: 63, hi: 80 },
  { phrase: "Occasional", lo: 18, q1: 28, med: 38, q3: 50, hi: 72 },
  { phrase: "Lapsing", lo: 12, q1: 20, med: 28, q3: 40, hi: 60 },
  { phrase: "Cooling", lo: 6, q1: 14, med: 20, q3: 30, hi: 48 },
  { phrase: "Dormant", lo: 2, q1: 6, med: 11, q3: 20, hi: 38 },
  { phrase: "Churned", lo: 0, q1: 3, med: 7, q3: 14, hi: 28 },
];
const boxSegments = boxBase.map((b, i) => ({ ...b, c: rampColor(i, boxBase.length) }));
const waterfall = [
  { name: "Base Q1", v: 0, delta: 1840, type: "start" }, { name: "Organic", v: 1840, delta: 920, type: "up" },
  { name: "Paid", v: 2760, delta: 610, type: "up" }, { name: "Referral", v: 3370, delta: 740, type: "up" },
  { name: "Churn loss", v: 4110, delta: -680, type: "down" }, { name: "Reactivation", v: 3430, delta: 390, type: "up" },
  { name: "Downgrade", v: 3820, delta: -240, type: "down" }, { name: "Net CLV", v: 0, delta: 3580, type: "end" },
];
const wfChart = waterfall.map((d) => {
  if (d.type === "start" || d.type === "end") return { name: d.name, base: 0, bar: d.delta, color: PAL.indigo };
  if (d.type === "up") return { name: d.name, base: d.v, bar: d.delta, color: PAL.teal };
  return { name: d.name, base: d.v + d.delta, bar: -d.delta, color: PAL.red };
});
const riskBands = ["Low", "Medium", "High", "Critical"];
const valueBands = ["High Value", "Mid Value", "Low Value", "Marginal"];
const heat = valueBands.map((v, vi) => riskBands.map((r, ri) => ({ v, r, vi, ri, count: Math.round(40 + Math.sin(vi * 1.3 + ri) * 30 + ri * vi * 9) })));
function heatColor(vi, ri) {
  if (vi <= 1 && ri >= 2) return PAL.red; if (vi <= 1 && ri === 1) return PAL.amber;
  if (vi <= 1 && ri === 0) return PAL.teal; if (vi >= 2 && ri >= 2) return PAL.sub;
  if (vi === 2) return PAL.lime; return PAL.line;
}
const demo = [{ age: "18–24", v: 12 }, { age: "25–34", v: 34 }, { age: "35–44", v: 27 }, { age: "45–54", v: 16 }, { age: "55–64", v: 8 }, { age: "65+", v: 3 }];
const _rndEcon = makeRng("vtx-econ"); // sembrado → determinista (SSR-safe, sin hydration mismatch)
const econ = Array.from({ length: 60 }, () => {
  const income = 20 + _rndEcon() * 180; const spend = income * (0.1 + _rndEcon() * 0.5);
  return { income: +income.toFixed(0), spend: +spend.toFixed(1), z: spend, c: spend > 60 ? PAL.teal : spend > 30 ? PAL.indigo : PAL.amber };
});
const psycho = [{ trait: { en: "Innovation", es: "Innovación" }, A: 88, B: 42 }, { trait: { en: "Loyalty", es: "Lealtad" }, A: 74, B: 55 }, { trait: { en: "Price-sens.", es: "Precio-sens." }, A: 30, B: 82 }, { trait: { en: "Status", es: "Status" }, A: 81, B: 38 }, { trait: { en: "Exploration", es: "Exploración" }, A: 69, B: 47 }, { trait: { en: "Risk", es: "Riesgo" }, A: 58, B: 71 }];
const fc = Array.from({ length: 24 }, (_, i) => {
  const trend = 320 + i * 9; const season = Math.sin((i / 12) * Math.PI * 2) * 28;
  const actual = i < 16 ? +(trend + season + (Math.random() - 0.5) * 18).toFixed(0) : null;
  const forecast = i >= 15 ? +(trend + season).toFixed(0) : null; const band = i >= 15 ? (i - 14) * 9 : 0;
  return { m: `M${i + 1}`, actual, forecast, lo: forecast ? forecast - band : null, range: forecast ? band * 2 : null };
});
const seasonal = Array.from({ length: 12 }, (_, i) => ({ m: ["E","F","M","A","M","J","J","A","S","O","N","D"][i], s: +(Math.sin((i / 12) * Math.PI * 2) * 28).toFixed(1) }));
// KPIs y Alertas ahora se generan por sesión → dataset.kpis / dataset.alerts (lib/synth.js)

// Causa raíz de churn (factores correlacionados con churn)
const churnDrivers = [
  { factor: { en: "Login drop (>21 days)", es: "Caída de login (>21 días)" }, lift: 4.8, c: PAL.red },
  { factor: { en: "Unresolved support ticket", es: "Ticket soporte sin resolver" }, lift: 3.6, c: PAL.orange },
  { factor: { en: "Recent payment failure", es: "Fallo de pago reciente" }, lift: 3.1, c: PAL.amber },
  { factor: { en: "No core-feature usage", es: "Sin uso de feature core" }, lift: 2.4, c: PAL.lime },
  { factor: { en: "Downgrade in 90 days", es: "Downgrade en 90 días" }, lift: 2.0, c: PAL.green },
  { factor: { en: "Incomplete onboarding", es: "Onboarding incompleto" }, lift: 1.7, c: PAL.teal },
];
// Secuencia de eventos previos al churn (timeline agregada)
const churnTimeline = [
  { day: -60, login: 92, churned: 88 }, { day: -45, login: 85, churned: 70 },
  { day: -30, login: 78, churned: 48 }, { day: -21, login: 74, churned: 31 },
  { day: -14, login: 71, churned: 19 }, { day: -7, login: 69, churned: 9 }, { day: 0, login: 68, churned: 3 },
];

// Next best action — lista de cuentas con recomendación
const nbaRows = [
  { acct: "Northwind Trading", seg: "Premium", clv: "$18.4K", risk: { en: "Critical", es: "Crítico" }, rc: PAL.red, action: { en: "AM call + 15% retention", es: "Llamada del AM + 15% retención" }, roi: "+$15.6K", roc: PAL.good },
  { acct: "Acme Logistics", seg: "VIP", clv: "$31.2K", risk: { en: "High", es: "Alto" }, rc: PAL.orange, action: { en: "Upgrade to annual plan", es: "Upgrade a plan anual" }, roi: "+$9.1K", roc: PAL.good },
  { acct: "Globex SaaS", seg: "Core", clv: "$6.7K", risk: { en: "High", es: "Alto" }, rc: PAL.orange, action: { en: "Reactivation email + tutorial", es: "Email reactivación + tutorial" }, roi: "+$2.3K", roc: PAL.good },
  { acct: "Initech Cloud", seg: "Growth", clv: "$3.1K", risk: { en: "Medium", es: "Medio" }, rc: PAL.amber, action: { en: "Nurture — no direct spend", es: "Nutrir — sin inversión directa" }, roi: "+$0.6K", roc: PAL.sub },
  { acct: "Hooli Data", seg: "Marginal", clv: "$0.9K", risk: { en: "Critical", es: "Crítico" }, rc: PAL.red, action: { en: "Don't invest — let churn", es: "No invertir — dejar churnear" }, roi: "—", roc: PAL.sub },
  { acct: "Umbrella Retail", seg: "VIP", clv: "$24.8K", risk: { en: "Low", es: "Bajo" }, rc: PAL.teal, action: { en: "Shield — loyalty program", es: "Blindar — programa de lealtad" }, roi: "+$5.0K", roc: PAL.good },
];

// Cohortes vivas (retención por mes desde adquisición)
// cohortMonths / cohortGrid ahora se generan por sesión → dataset.* (lib/synth.js)
function cohortColor(v) {
  if (v == null) return "transparent";
  if (v >= 90) return PAL.teal; if (v >= 80) return PAL.green; if (v >= 72) return PAL.lime;
  if (v >= 65) return PAL.amber; return PAL.orange;
}

// Atribución CLV por canal → dataset.channels (lib/synth.js)

/* =================== PRIMITIVAS =================== */
function Spark({ data, color }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 26}`).join(" ");
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: 30 }}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" /></svg>;
}
function Panel({ title, tag, children, span = 1, h = 320 }) {
  return <div style={{ gridColumn: `span ${span}`, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: "16px 18px 14px", display: "flex", flexDirection: "column", boxShadow: "0 1px 2px rgba(16,17,22,.04)", height: h, overflow: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexShrink: 0 }}>
      <h3 style={{ margin: 0, fontSize: FS.h2, fontWeight: 600, color: PAL.text, letterSpacing: "-.1px" }}>{title}</h3>
      {tag && <span style={{ fontSize: FS.tag, color: PAL.sub, letterSpacing: ".3px", textTransform: "uppercase" }}>{tag}</span>}
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div></div>;
}
function TipBox({ active, payload, label, unit = "" }) {
  if (!active || !payload || !payload.length) return null;
  return <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 11.5, color: PAL.text, boxShadow: "0 4px 14px rgba(16,17,22,.1)" }}>
    <div style={{ color: PAL.sub, marginBottom: 4, fontWeight: 600 }}>{label}</div>
    {payload.filter(p => p.value != null).map((p, i) => <div key={i} style={{ color: p.color || p.fill }}>{p.name}: {p.value}{unit}</div>)}</div>;
}
function Legend({ c, t }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: "inline-block" }} />{t}</span>;
}
function H1({ title, sub }) {
  return <div style={{ marginBottom: 22 }}>
    <h1 style={{ margin: 0, fontSize: FS.h1, fontWeight: 700, letterSpacing: "-.5px" }}>{title}</h1>
    <p style={{ margin: "4px 0 0", color: PAL.sub, fontSize: FS.body }}>{sub}</p></div>;
}
function Logo({ size = 34 }) {
  // Logotipo Vantix (opción 3): V limpia con punto de "vantage" en el ápice,
  // degradado índigo→teal. id único por tamaño para evitar colisión de gradientes.
  const id = `vlogo-${size}`;
  return <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0, display: "block" }} aria-label="Vantix" role="img">
    <defs>
      <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor={PAL.brandDk} /><stop offset="55%" stopColor={PAL.brand} /><stop offset="100%" stopColor="#22B5C4" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="40" height="40" rx="11" fill={`url(#${id})`} />
    {/* V simétrica */}
    <path d="M11 13 L20 28 L29 13" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    {/* punto de vantage en el ápice derecho */}
    <circle cx="29" cy="13" r="2.7" fill="#fff" />
  </svg>;
}
// Marca de GitHub (para el botón "View source"). currentColor → hereda del padre.
function GhIcon({ size = 17 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
    <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>;
}
function Tabs({ tabs }) {
  const [active, setActive] = useState(0);
  return <div>
    <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: `1px solid ${PAL.line}` }}>
      {tabs.map((t, i) => (
        <button key={i} onClick={() => setActive(i)} style={{ fontSize: 13, fontWeight: active === i ? 600 : 500, color: active === i ? PAL.brand : PAL.sub, background: "transparent", border: "none", borderBottom: active === i ? `2px solid ${PAL.brand}` : "2px solid transparent", padding: "9px 14px", cursor: "pointer", fontFamily: FONT, marginBottom: -1 }}>{t.label}</button>))}
    </div>
    <div>{tabs[active].content}</div>
  </div>;
}

/* =================== GRÁFICAS BASE =================== */
function Ridgeline() {
  const { L } = useSession();
  // SVG único: cada cresta con su línea base separada uniformemente. No se desborda.
  const W = 600, H = 320, padL = 92, padR = 16, padT = 56, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = ridgeSegments.length;
  const baseGap = plotH / n;                 // separación entre líneas base
  const amp = baseGap * 1.75;                // alto de cada cresta (cabe bajo padT)
  const xMax = 100;
  const px = (x) => padL + (x / xMax) * plotW;
  const baseY = (i) => padT + baseGap * (i + 0.4);
  const peak = ridgeData.reduce((m, d) => Math.max(m, ...ridgeSegments.map(s => d[s.name])), 0);
  const path = (s, i) => {
    const by = baseY(i);
    let d = `M ${px(ridgeData[0].x)} ${by}`;
    ridgeData.forEach(pt => { d += ` L ${px(pt.x).toFixed(1)} ${(by - (pt[s.name] / peak) * amp).toFixed(1)}`; });
    d += ` L ${px(ridgeData[ridgeData.length - 1].x)} ${by} Z`;
    return d;
  };
  return <div>
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>{ridgeSegments.map((s, i) => (
        <linearGradient key={i} id={`rg-${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.color} stopOpacity={0.78} /><stop offset="100%" stopColor={s.color} stopOpacity={0.25} />
        </linearGradient>))}</defs>
      {/* de atrás (arriba) hacia adelante (abajo) para que el solape se vea natural */}
      {ridgeSegments.map((s, i) => (<g key={s.name}>
        <path d={path(s, i)} fill={`url(#rg-${i})`} stroke={s.color} strokeWidth={1.4} />
        <text x={padL - 8} y={baseY(i) - 2} textAnchor="end" fontSize={FS.label} fontWeight={600} fill={s.color} fontFamily="Inter">{s.name}</text>
      </g>))}
      {/* eje X */}
      {[0, 20, 40, 60, 80, 100].map(t => (
        <text key={t} x={px(t)} y={H - 8} textAnchor="middle" fontSize={FS.axis} fill={PAL.sub} fontFamily="Inter">{t}%</text>))}
    </svg>
    <div style={{ textAlign: "center", fontSize: FS.axis, color: PAL.sub, marginTop: 2 }}>{L("Churn probability (90 days)", "Probabilidad de churn (90 días)")}</div>
  </div>;
}
function BoxPlots() {
  return <div>
    {boxSegments.map((b) => (
      <div key={b.phrase} style={{ display: "flex", alignItems: "center", height: 26 }}>
        <div style={{ width: 86, fontSize: 10.5, fontWeight: 500, color: b.c, textAlign: "right", paddingRight: 10 }}>{b.phrase}</div>
        <div style={{ position: "relative", flex: 1, height: 18 }}>
          <div style={{ position: "absolute", left: `${b.lo}%`, width: `${b.hi - b.lo}%`, top: 8, height: 1.5, background: b.c, opacity: .6 }} />
          <div style={{ position: "absolute", left: `${b.lo}%`, top: 4, width: 1.5, height: 9, background: b.c, opacity: .6 }} />
          <div style={{ position: "absolute", left: `${b.hi}%`, top: 4, width: 1.5, height: 9, background: b.c, opacity: .6 }} />
          <div style={{ position: "absolute", left: `${b.q1}%`, width: `${b.q3 - b.q1}%`, top: 1, height: 16, background: b.c, opacity: 0.45, border: `1.5px solid ${b.c}`, borderRadius: 3 }} />
          <div style={{ position: "absolute", left: `${b.med}%`, top: 1, width: 2, height: 16, background: b.c }} />
        </div></div>))}
    <div style={{ marginLeft: 86, display: "flex", justifyContent: "space-between", fontSize: 9.5, color: PAL.sub, marginTop: 6 }}>
      {["0","25","50","75","100"].map(t => <span key={t}>{t}</span>)}</div>
    <div style={{ marginLeft: 86, textAlign: "center", fontSize: 9.5, color: PAL.sub, marginTop: 2 }}>Engagement score</div></div>;
}
function Waterfall() {
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={wfChart} margin={{ top: 20, right: 10, bottom: 10, left: -10 }}>
      <CartesianGrid vertical={false} stroke={PAL.line} />
      <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: PAL.sub }} interval={0} angle={-18} textAnchor="end" height={50} />
      <YAxis tick={{ fontSize: 10, fill: PAL.sub }} tickFormatter={(v) => `$${v / 1000}k`} />
      <Tooltip content={<TipBox />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
      <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
      <Bar dataKey="bar" stackId="a" radius={[3, 3, 0, 0]} isAnimationActive={false}>
        {wfChart.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
    </BarChart></ResponsiveContainer>;
}
function Heatmap() {
  const { L } = useSession();
  return <div>
    <div className="matrixgrid" style={{ display: "grid", gridTemplateColumns: "78px repeat(4, 1fr)", gap: 4 }}>
      <div />{riskBands.map((r) => <div key={r} style={{ fontSize: 9.5, color: PAL.sub, textAlign: "center", paddingBottom: 4, textTransform: "uppercase", letterSpacing: ".3px" }}>{r}</div>)}
      {heat.map((row, vi) => (<React.Fragment key={vi}>
        <div style={{ fontSize: 9.5, color: PAL.sub, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>{valueBands[vi]}</div>
        {row.map((cell) => { const col = heatColor(cell.vi, cell.ri); const faint = col === PAL.line || col === PAL.sub;
          return <div key={cell.ri} style={{ background: col, opacity: faint ? 0.4 : 0.9, borderRadius: 6, height: 46, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: faint ? PAL.sub : "#fff", cursor: "pointer", transition: "transform .12s" }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.04)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{cell.count}</span><span style={{ fontSize: 8, opacity: 0.85 }}>{L("accounts", "cuentas")}</span></div>; })}
      </React.Fragment>))}</div>
    <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 9.5, color: PAL.sub, flexWrap: "wrap" }}>
      <Legend c={PAL.teal} t={L("Shield VIP", "Blindar VIP")} /><Legend c={PAL.amber} t={L("Watch", "Vigilar")} /><Legend c={PAL.red} t={L("Urgent rescue", "Rescate urgente")} /><Legend c={PAL.lime} t={L("Nurture", "Nutrir")} /><Legend c={PAL.sub} t={L("Don't invest", "No invertir")} /></div></div>;
}
function Forecast() {
  const { L } = useSession();
  return <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
    <div style={{ flex: 2, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={fc} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <defs><linearGradient id="band" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PAL.indigo} stopOpacity={0.18} /><stop offset="100%" stopColor={PAL.indigo} stopOpacity={0.18} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke={PAL.line} />
          <XAxis dataKey="m" tick={{ fontSize: 9, fill: PAL.sub }} interval={2} />
          <YAxis tick={{ fontSize: 10, fill: PAL.sub }} tickFormatter={(v) => `$${v}k`} domain={[280, 600]} />
          <Tooltip content={<TipBox unit="k" />} />
          <Area dataKey="lo" stackId="b" stroke="none" fill="transparent" isAnimationActive={false} />
          <Area dataKey="range" stackId="b" stroke="none" fill="url(#band)" name={L("80% band", "Banda 80%")} isAnimationActive={false} />
          <Line dataKey="actual" stroke={PAL.teal} strokeWidth={2.4} dot={false} name={L("Actual MRR", "MRR real")} isAnimationActive={false} />
          <Line dataKey="forecast" stroke={PAL.indigo} strokeWidth={2.4} strokeDasharray="5 4" dot={false} name={L("Forecast", "Proyección")} isAnimationActive={false} />
        </ComposedChart></ResponsiveContainer></div>
    <div style={{ fontSize: 9.5, color: PAL.sub, margin: "6px 0 2px", paddingLeft: 4 }}>{L("Isolated seasonal component", "Componente estacional aislado")}</div>
    <div style={{ flex: 1, minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={seasonal} margin={{ top: 2, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={PAL.line} /><XAxis dataKey="m" tick={{ fontSize: 9, fill: PAL.sub }} /><YAxis tick={{ fontSize: 9, fill: PAL.sub }} />
          <Tooltip content={<TipBox unit="k" />} />
          <Bar dataKey="s" radius={[2, 2, 2, 2]} isAnimationActive={false}>{seasonal.map((d, i) => <Cell key={i} fill={d.s >= 0 ? PAL.green : PAL.orange} />)}</Bar>
        </BarChart></ResponsiveContainer></div></div>;
}

/* =================== MÓDULOS NUEVOS =================== */

// 1) ALERTAS & TRIGGERS
function AlertsView({ embedded } = {}) {
  const { dataset, L } = useSession();
  const { alerts } = dataset;
  const sevLabel = { critical: L("Critical", "Crítico"), warning: L("Attention", "Atención"), info: L("Insight", "Insight") };
  const summary = [
    { n: alerts.filter((a) => a.sev === "critical").length, t: L("Critical", "Críticas"), c: PAL.red },
    { n: alerts.filter((a) => a.sev === "warning").length, t: L("Attention", "Atención"), c: PAL.amber },
    { n: alerts.filter((a) => a.sev === "info").length, t: L("Insights", "Insights"), c: PAL.blue },
  ];
  return <div>
    {!embedded && <H1 title={L("Alerts & Triggers", "Alertas & Triggers")} sub={L("The system watches for you. Each alert points to a decision, not just a number.", "El sistema vigila por ti. Cada alerta apunta a una decisión, no solo a un dato.")} />}
    <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
      {summary.map((s) => (
        <div key={s.t} style={{ flex: 1, background: PAL.panel, border: `1px solid ${PAL.line}`, borderLeft: `3px solid ${s.c}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: s.c }}>{s.n}</div>
          <div style={{ fontSize: 12, color: PAL.sub, marginTop: 2 }}>{s.t} {L("active", "activas")}</div></div>))}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {alerts.map((a, i) => (
        <div key={i} style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderLeft: `3px solid ${a.c}`, borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700, color: a.c, background: `${a.c}1A`, padding: "2px 8px", borderRadius: 20, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".4px" }}>{sevLabel[a.sev]}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
            <div style={{ fontSize: 12, color: PAL.sub, marginTop: 3 }}>{a.meta}</div></div>
          <button style={{ flexShrink: 0, marginLeft: 16, fontSize: 12, fontWeight: 600, color: a.c, background: "transparent", border: `1px solid ${a.c}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontFamily: FONT }}>{a.action}</button>
        </div>))}</div></div>;
}

// 2) CAUSA RAÍZ DE CHURN
function RootCauseView() {
  const { L } = useSession();
  return <div>
    <H1 title={L("Churn root cause", "Causa raíz de churn")} sub={L("High churn is the symptom. This shows which events precede it and how much they multiply the risk.", "Churn alto es el síntoma. Esto muestra qué eventos lo preceden y cuánto multiplican el riesgo.")} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Panel title={L("Risk factors (lift over baseline)", "Factores de riesgo (lift sobre baseline)")} tag={L("correlation", "correlación")} h={340}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={churnDrivers.map((d) => ({ ...d, factor: L(d.factor.en, d.factor.es) }))} margin={{ top: 6, right: 30, bottom: 6, left: 10 }}>
            <CartesianGrid horizontal={false} stroke={PAL.line} />
            <XAxis type="number" tick={{ fontSize: 10, fill: PAL.sub }} tickFormatter={(v) => `${v}x`} domain={[0, 5.5]} />
            <YAxis type="category" dataKey="factor" tick={{ fontSize: 10.5, fill: PAL.text }} width={150} />
            <Tooltip content={<TipBox unit="x" />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
            <Bar dataKey="lift" radius={[0, 4, 4, 0]} isAnimationActive={false}>{churnDrivers.map((d, i) => <Cell key={i} fill={d.c} />)}</Bar>
          </BarChart></ResponsiveContainer>
      </Panel>
      <Panel title={L("Pre-churn sequence", "Secuencia previa al churn")} tag={L("60 days before", "60 días antes")} h={340}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={churnTimeline} margin={{ top: 10, right: 16, bottom: 6, left: -16 }}>
            <CartesianGrid vertical={false} stroke={PAL.line} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: PAL.sub }} tickFormatter={(v) => `${v}d`} />
            <YAxis tick={{ fontSize: 10, fill: PAL.sub }} />
            <Tooltip content={<TipBox />} />
            <Line dataKey="login" stroke={PAL.teal} strokeWidth={2.4} dot={false} name={L("Login activity %", "Actividad de login %")} isAnimationActive={false} />
            <Line dataKey="churned" stroke={PAL.red} strokeWidth={2.4} dot={false} name={L("Still active (later churn) %", "Aún activos (luego churn) %")} isAnimationActive={false} />
          </LineChart></ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 9.5, color: PAL.sub, marginTop: 4 }}>
          <Legend c={PAL.teal} t="Login" /><Legend c={PAL.red} t={L("Path to churn", "Camino al churn")} /></div>
      </Panel></div>
    <div style={{ marginTop: 14, background: `${PAL.indigo}0D`, border: `1px solid ${PAL.indigo}40`, borderRadius: 12, padding: "14px 18px", fontSize: 13, color: PAL.text }}>
      <strong style={{ color: PAL.indigo }}>{L("Model reading:", "Lectura del modelo:")}</strong> {L("a sustained login drop of more than 21 days multiplies churn risk by 4.8. It's the earliest and most actionable signal — intervene here, not once they've already stopped paying.", "una caída de login sostenida más de 21 días multiplica el riesgo de churn por 4.8. Es la señal más temprana y accionable — interviene aquí, no cuando ya dejó de pagar.")}</div></div>;
}

// 3) SIMULADOR WHAT-IF
function SimulatorView() {
  const { dataset, L } = useSession();
  const base = dataset.simulator.baseMrrK;          // MRR k (escalado a las cifras del usuario)
  const atRiskMrr = dataset.simulator.atRiskMrrK;   // MRR concentrado en el segmento At-Risk
  const [atRiskRed, setAtRiskRed] = useState(2);   // reducción de churn del segmento At-Risk (pts)
  const [churnRed, setChurnRed] = useState(1);     // reducción de churn general (pts)
  const [nrr, setNrr] = useState(Math.round(dataset.metrics.nrr));
  const [reactivation, setReactivation] = useState(15);
  const proj = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const baseline = base * Math.pow(1 + (112 - 100) / 100 / 12, m);
      const atRiskEffect = 1 + (atRiskRed * (atRiskMrr / base) * 0.06 * m);
      const churnEffect = 1 + (churnRed * 0.004 * m);
      const nrrEffect = Math.pow(1 + (nrr - 100) / 100 / 12, m) / Math.pow(1 + (112 - 100) / 100 / 12, m);
      const reactEffect = 1 + (reactivation - 15) * 0.0008 * m;
      return { m: `M${m}`, baseline: +baseline.toFixed(0), scenario: +(baseline * atRiskEffect * churnEffect * nrrEffect * reactEffect).toFixed(0) };
    });
  }, [atRiskRed, churnRed, nrr, reactivation, base, atRiskMrr]);
  const liftM12 = proj[11].scenario - proj[11].baseline;
  const arrLift = Math.round(liftM12 * 12);
  // ARR atribuible específicamente al slider de At-Risk (aislando su efecto)
  const atRiskArr = Math.round(atRiskRed * (atRiskMrr / base) * 0.06 * 12 * base * 12 / 100);
  const Slider = ({ label, val, set, min, max, step, fmt, accent }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: FS.body, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: accent || PAL.brand }}>{fmt(val)}</span></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(+e.target.value)} style={{ width: "100%", accentColor: accent || PAL.brand }} /></div>);
  return <div>
    <H1 title={L("Impact simulator", "Simulador de impacto")} sub={L("Move a lever and see how much ARR you gain. From analytics to a quantified decision.", "Mueve una palanca y ve cuánto ARR ganas. De la analítica a la decisión cuantificada.")} />
    {/* FRASE PROTAGONISTA — la que cierra la venta */}
    <div style={{ background: `linear-gradient(135deg, ${PAL.brandDk}, ${PAL.brand} 60%, #22B5C4)`, borderRadius: 16, padding: "24px 28px", marginBottom: 16, color: "#fff" }}>
      <div style={{ fontSize: FS.body, opacity: .9, fontWeight: 500 }}>{L(<>If you cut the <strong>At-Risk</strong> segment's churn by <strong>{atRiskRed} {atRiskRed === 1 ? "point" : "points"}</strong>…</>, <>Si reduces el churn del segmento <strong>At-Risk</strong> en <strong>{atRiskRed} {atRiskRed === 1 ? "punto" : "puntos"}</strong>…</>)}</div>
      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1px", marginTop: 6 }}>{L(`you gain $${atRiskArr}K in ARR`, `ganas $${atRiskArr}K en ARR`)}</div>
      <div style={{ fontSize: FS.body, opacity: .9, marginTop: 4 }}>{L(<>With every lever active: <strong>+${arrLift}K ARR</strong> over 12 months · +${liftM12}K recurring monthly MRR</>, <>Con todas las palancas activas: <strong>+${arrLift}K ARR</strong> en 12 meses · +${liftM12}K MRR mensual recurrente</>)}</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 14 }}>
      <Panel title={L("Decision levers", "Palancas de decisión")} tag="what-if" h={440}>
        <div style={{ padding: "10px 12px", background: `${PAL.bad}0D`, border: `1px solid ${PAL.bad}30`, borderRadius: 10, marginBottom: 16 }}>
          <Slider label={L("↓ At-Risk segment churn", "↓ Churn segmento At-Risk")} val={atRiskRed} set={setAtRiskRed} min={0} max={5} step={0.5} fmt={(v) => `−${v} pts`} accent={PAL.bad} />
          <div style={{ fontSize: FS.label, color: PAL.sub, marginTop: -8 }}>{L(`The highest-impact lever: At-Risk concentrates $${atRiskMrr}K MRR.`, `La palanca de mayor impacto: At-Risk concentra $${atRiskMrr}K MRR.`)}</div>
        </div>
        <Slider label={L("↓ Overall churn", "↓ Churn general")} val={churnRed} set={setChurnRed} min={0} max={5} step={0.5} fmt={(v) => `−${v} pts`} />
        <Slider label="Net Revenue Retention" val={nrr} set={setNrr} min={95} max={125} step={1} fmt={(v) => `${v}%`} />
        <Slider label={L("Reactivation rate", "Tasa de reactivación")} val={reactivation} set={setReactivation} min={5} max={35} step={1} fmt={(v) => `${v}%`} />
      </Panel>
      <Panel title={L("MRR projection — scenario vs baseline", "Proyección de MRR — escenario vs baseline")} tag={L("12 months", "12 meses")} h={440}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={proj} margin={{ top: 10, right: 16, bottom: 6, left: -10 }}>
            <defs><linearGradient id="scen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PAL.brand} stopOpacity={0.25} /><stop offset="100%" stopColor={PAL.brand} stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={PAL.line} />
            <XAxis dataKey="m" tick={{ fontSize: FS.axis, fill: PAL.sub }} />
            <YAxis tick={{ fontSize: FS.axis, fill: PAL.sub }} tickFormatter={(v) => `$${v}k`} domain={["auto", "auto"]} />
            <Tooltip content={<TipBox unit="k" />} />
            <Area dataKey="scenario" stroke={PAL.brand} strokeWidth={2.6} fill="url(#scen)" name={L("Scenario", "Escenario")} isAnimationActive={false} />
            <Line dataKey="baseline" stroke={PAL.sub} strokeWidth={2} strokeDasharray="5 4" dot={false} name="Baseline" isAnimationActive={false} />
          </ComposedChart></ResponsiveContainer>
      </Panel></div></div>;
}

// 4) NEXT BEST ACTION
function NbaView() {
  const { L } = useSession();
  return <div>
    <H1 title="Next Best Action" sub={L("The model doesn't just segment — it recommends the action per account and estimates its return.", "El modelo no solo segmenta — recomienda la acción por cuenta y estima su retorno.")} />
    <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div className="tablewrap" style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 720 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr .8fr .8fr .8fr 2fr 1fr", padding: "12px 18px", borderBottom: `1px solid ${PAL.line}`, fontSize: FS.label, fontWeight: 600, color: PAL.sub, textTransform: "uppercase", letterSpacing: ".4px", background: PAL.panel2 }}>
        <span>{L("Account", "Cuenta")}</span><span>{L("Segment", "Segmento")}</span><span>CLV</span><span>{L("Risk", "Riesgo")}</span><span>{L("Recommended action", "Acción recomendada")}</span><span>{L("Est. return", "Retorno est.")}</span></div>
      {nbaRows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr .8fr .8fr .8fr 2fr 1fr", padding: "14px 18px", borderBottom: i < nbaRows.length - 1 ? `1px solid ${PAL.line}` : "none", fontSize: FS.body, alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{r.acct}</span>
          <span style={{ color: PAL.sub }}>{r.seg}</span>
          <span style={{ fontWeight: 600 }}>{r.clv}</span>
          <span><span style={{ fontSize: FS.label, fontWeight: 700, color: r.rc, background: `${r.rc}1A`, padding: "3px 9px", borderRadius: 20 }}>{L(r.risk.en, r.risk.es)}</span></span>
          <span style={{ color: PAL.text }}>{L(r.action.en, r.action.es)}</span>
          <span style={{ fontWeight: 700, color: r.roc }}>{r.roi}</span>
        </div>))}</div></div></div>
    <div style={{ marginTop: 14, display: "flex", gap: 12 }}>
      <button style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: PAL.indigo, border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontFamily: FONT }}>{L("Export list to CRM", "Exportar lista al CRM")}</button>
      <button style={{ fontSize: 12.5, fontWeight: 600, color: PAL.text, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontFamily: FONT }}>{L("Trigger retention campaign", "Disparar campaña de retención")}</button></div></div>;
}

// 5) COHORTES VIVAS
function CohortsView() {
  const { dataset, L } = useSession();
  const { cohortMonths, cohortGrid } = dataset;
  return <div>
    <H1 title={L("Live cohorts", "Cohortes vivas")} sub={L("Every acquisition cohort and how its retention decays. The most honest way to know if the product is improving.", "Cada cohorte de adquisición y cómo se desgasta su retención. La forma más honesta de saber si el producto mejora.")} />
    <Panel title={L("Retention by cohort (% active)", "Retención por cohorte (% activos)")} tag={L("retention heatmap", "heatmap de retención")} h={360}>
      <div style={{ display: "grid", gridTemplateColumns: `90px repeat(${cohortMonths.length}, 1fr)`, gap: 4 }}>
        <div />{cohortMonths.map((m, i) => <div key={i} style={{ fontSize: 10, color: PAL.sub, textAlign: "center", paddingBottom: 6 }}>{L("Month", "Mes")} {i}</div>)}
        {cohortGrid.map((row) => (<React.Fragment key={row.name}>
          <div style={{ fontSize: 11, color: PAL.text, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10 }}>{row.name}</div>
          {row.vals.map((v, i) => { const col = cohortColor(v);
            return <div key={i} style={{ background: col, opacity: v == null ? 1 : 0.9, borderRadius: 6, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: v == null ? "transparent" : "#fff", fontSize: 12.5, fontWeight: 700, border: v == null ? `1px dashed ${PAL.line}` : "none" }}>{v == null ? "" : `${v}%`}</div>; })}
        </React.Fragment>))}</div>
      <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 9.5, color: PAL.sub, flexWrap: "wrap" }}>
        <Legend c={PAL.teal} t="≥90%" /><Legend c={PAL.green} t="80–89%" /><Legend c={PAL.lime} t="72–79%" /><Legend c={PAL.amber} t="65–71%" /><Legend c={PAL.orange} t="<65%" /></div>
    </Panel>
    <div style={{ marginTop: 14, background: `${PAL.amber}0D`, border: `1px solid ${PAL.amber}40`, borderRadius: 12, padding: "14px 18px", fontSize: 13 }}>
      <strong style={{ color: PAL.amber }}>{L("Signal:", "Señal:")}</strong> {L("the March cohort retains 9 points below February at the same month of life. It coincides with an onboarding-flow change — worth reverting or A/B testing.", "la cohorte de marzo retiene 9 puntos por debajo de febrero al mismo mes de vida. Coincide con un cambio en el flujo de onboarding — vale la pena revertir o testear.")}</div></div>;
}

// 6) ATRIBUCIÓN CLV POR CANAL
function AttributionView() {
  const { dataset, L } = useSession();
  const { channels } = dataset;
  return <div>
    <H1 title={L("CLV attribution by channel", "Atribución de CLV por canal")} sub={L("Don't optimize for volume or cheap CAC. Optimize for CLV:CAC — which channel brings valuable customers.", "No optimices por volumen ni por CAC barato. Optimiza por CLV:CAC — qué canal trae clientes valiosos.")} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Panel title={L("CLV vs CAC by channel", "CLV vs CAC por canal")} tag={L("scatter · bubble = volume", "scatter · burbuja = volumen")} h={360}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 6 }}>
            <CartesianGrid stroke={PAL.line} />
            <XAxis type="number" dataKey="cac" name="CAC" tick={{ fontSize: 10, fill: PAL.sub }} tickFormatter={(v) => `$${v}`} label={{ value: "CAC ($)", position: "bottom", offset: 2, style: { fontSize: 9.5, fill: PAL.sub } }} />
            <YAxis type="number" dataKey="clv" name="CLV" tick={{ fontSize: 10, fill: PAL.sub }} tickFormatter={(v) => `$${v}`} label={{ value: "CLV ($)", angle: -90, position: "insideLeft", style: { fontSize: 9.5, fill: PAL.sub } }} />
            <ZAxis type="number" dataKey="vol" range={[80, 600]} />
            <Tooltip content={<TipBox />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={channels} isAnimationActive={false}>{channels.map((d, i) => <Cell key={i} fill={d.c} fillOpacity={0.55} stroke={d.c} />)}</Scatter>
          </ScatterChart></ResponsiveContainer>
      </Panel>
      <Panel title={L("CLV : CAC ratio by channel", "Ratio CLV : CAC por canal")} tag={L("healthy > 3:1", "sano > 3:1")} h={360}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={channels} margin={{ top: 6, right: 36, bottom: 6, left: 10 }}>
            <CartesianGrid horizontal={false} stroke={PAL.line} />
            <XAxis type="number" tick={{ fontSize: 10, fill: PAL.sub }} tickFormatter={(v) => `${v}:1`} domain={[0, 6]} />
            <YAxis type="category" dataKey="ch" tick={{ fontSize: 11, fill: PAL.text }} width={90} />
            <Tooltip content={<TipBox />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
            <Bar dataKey="ratio" radius={[0, 4, 4, 0]} isAnimationActive={false} name="CLV:CAC">{channels.map((d, i) => <Cell key={i} fill={d.ratio >= 3 ? PAL.teal : d.ratio >= 2 ? PAL.amber : PAL.red} />)}</Bar>
          </BarChart></ResponsiveContainer>
        <div style={{ fontSize: 11, color: PAL.sub, marginTop: 6, textAlign: "center" }}>{L("Referral and Organic exceed 4.5:1 · Display destroys value below 1.5:1", "Referral y Organic superan 4.5:1 · Display destruye valor por debajo de 1.5:1")}</div>
      </Panel></div>
    <div style={{ marginTop: 14, background: `${PAL.teal}0D`, border: `1px solid ${PAL.teal}40`, borderRadius: 12, padding: "14px 18px", fontSize: 13 }}>
      <strong style={{ color: PAL.teal }}>{L("Recommendation:", "Recomendación:")}</strong> {L("reallocate budget from Display (1.4:1) toward Referral (5.1:1). Although Paid Search brings the highest CLV, its CAC leaves it at 2:1 — barely profitable.", "reasigna presupuesto de Display (1.4:1) hacia Referral (5.1:1). Aunque Paid Search trae el CLV más alto, su CAC lo deja en 2:1 — apenas rentable.")}</div></div>;
}


/* =================== CAPA SILICON VALLEY =================== */

// === DATOS NUEVOS ===
const aiMessages = [
  { role: "user", text: { en: "Why did the March cohort's retention drop?", es: "¿Por qué cayó la retención de la cohorte de marzo?" } },
  { role: "ai", text: { en: "The March cohort retains 9 points below February at month 3 (74% vs 85%). The model attributes 68% of the drop to an onboarding change deployed on March 4: the core-feature activation step moved from screen 2 to screen 5, and the activation rate fell from 81% to 62%. Accounts that don't activate in the first 7 days churn 4.8x more.", es: "La cohorte de marzo retiene 9 puntos por debajo de febrero al mes 3 (74% vs 85%). El modelo atribuye el 68% de la caída a un cambio en el flujo de onboarding desplegado el 4 de marzo: el paso de activación de feature core pasó de la pantalla 2 a la 5, y la tasa de activación cayó del 81% al 62%. Las cuentas que no activaron en los primeros 7 días churnean 4.8x más." }, insight: true,
    actions: [{ en: "View full cohort", es: "Ver cohorte completa" }, { en: "Revert onboarding change", es: "Revertir cambio de onboarding" }] },
  { role: "user", text: { en: "How much MRR is at risk if we don't fix it?", es: "¿Cuánto MRR está en riesgo si no lo arreglamos?" } },
  { role: "ai", text: { en: "If the activation rate stays at 62%, I project an incremental loss of $84K in MRR over the next 6 months, concentrated in the March–May cohorts. Reverting the onboarding change would recover ~$71K of that. The ROI of reverting is immediate: no development cost beyond a rollback.", es: "Si la tasa de activación se mantiene en 62%, proyecto una pérdida incremental de $84K en MRR durante los próximos 6 meses, concentrada en las cohortes de marzo a mayo. Revertir el cambio de onboarding recuperaría ~$71K de eso. El ROI de revertir es inmediato: no tiene costo de desarrollo más allá de un rollback." }, insight: true,
    actions: [{ en: "View detailed projection", es: "Ver proyección detallada" }, { en: "Create task for the team", es: "Crear tarea para el equipo" }] },
];
// narrative ahora se genera por sesión → dataset.narrative (lib/synth.js)
const _rndAnom = makeRng("vtx-anom");
const anomalies = Array.from({ length: 40 }, (_, i) => {
  const base = 100 + Math.sin(i / 3) * 15 + i * 0.6;
  const isAnom = i === 24 || i === 31;
  const v = isAnom ? base + (i === 24 ? 48 : -38) : base + (_rndAnom() - 0.5) * 8;
  return { d: i, v: +v.toFixed(1), anom: isAnom };
});
const integrations = [
  { name: "Salesforce", cat: { en: "CRM", es: "CRM" }, status: "connected", c: PAL.blue, dir: { en: "Bidirectional", es: "Bidireccional" } },
  { name: "HubSpot", cat: { en: "Marketing", es: "Marketing" }, status: "connected", c: PAL.orange, dir: { en: "Bidirectional", es: "Bidireccional" } },
  { name: "Slack", cat: { en: "Alerts", es: "Alertas" }, status: "connected", c: PAL.violet, dir: { en: "Outbound", es: "Salida" } },
  { name: "Stripe", cat: { en: "Billing", es: "Billing" }, status: "connected", c: PAL.indigo, dir: { en: "Inbound", es: "Entrada" } },
  { name: "Segment", cat: { en: "Events", es: "Eventos" }, status: "available", c: PAL.green, dir: { en: "Inbound", es: "Entrada" } },
  { name: "Snowflake", cat: { en: "Data warehouse", es: "Data warehouse" }, status: "available", c: PAL.teal, dir: { en: "Inbound", es: "Entrada" } },
  { name: "Intercom", cat: { en: "Support", es: "Soporte" }, status: "available", c: PAL.blue, dir: { en: "Bidirectional", es: "Bidireccional" } },
  { name: "Zapier", cat: { en: "Automation", es: "Automatización" }, status: "available", c: PAL.amber, dir: { en: "Bidirectional", es: "Bidireccional" } },
];
const teamMembers = [
  { name: "Ana Rivera", role: { en: "CFO", es: "CFO" }, scope: { en: "Full access", es: "Acceso total" }, c: PAL.indigo, init: "AR" },
  { name: "Marco Díaz", role: { en: "Head of Growth", es: "Head of Growth" }, scope: { en: "Analytics + campaigns", es: "Analítica + campañas" }, c: PAL.teal, init: "MD" },
  { name: "Lucía Fernández", role: { en: "Account Manager", es: "Account Manager" }, scope: { en: "Her book only (84 accounts)", es: "Solo su cartera (84 cuentas)" }, c: PAL.green, init: "LF" },
  { name: "Tom Becker", role: { en: "Analyst", es: "Analista" }, scope: { en: "Read + export", es: "Lectura + exportar" }, c: PAL.amber, init: "TB" },
];
const auditLog = [
  { who: { en: "Ana Rivera", es: "Ana Rivera" }, act: { en: "Exported rescue list (12 accounts)", es: "Exportó lista de rescate (12 cuentas)" }, t: { en: "2h ago", es: "hace 2h" }, c: PAL.indigo },
  { who: { en: "Marco Díaz", es: "Marco Díaz" }, act: { en: "Triggered retention campaign — Premium segment", es: "Disparó campaña de retención — segmento Premium" }, t: { en: "5h ago", es: "hace 5h" }, c: PAL.teal },
  { who: { en: "System", es: "Sistema" }, act: { en: "Synced 2.4M transactions from Stripe", es: "Sincronizó 2.4M transacciones desde Stripe" }, t: { en: "6h ago", es: "hace 6h" }, c: PAL.sub },
  { who: { en: "Lucía Fernández", es: "Lucía Fernández" }, act: { en: "Viewed Northwind Trading cohort", es: "Visualizó cohorte Northwind Trading" }, t: { en: "8h ago", es: "hace 8h" }, c: PAL.green },
  { who: { en: "Tom Becker", es: "Tom Becker" }, act: { en: "Changed churn alert threshold (>21d → >18d)", es: "Modificó umbral de alerta de churn (>21d → >18d)" }, t: { en: "yesterday", es: "ayer" }, c: PAL.amber },
];
const onboardingSteps = [
  { n: 1, t: { en: "Connect your data source", es: "Conecta tu fuente de datos" }, d: { en: "Stripe, Snowflake or CSV", es: "Stripe, Snowflake o CSV" }, done: true },
  { n: 2, t: { en: "Map your columns", es: "Mapea tus columnas" }, d: { en: "Auto-detect date, amount, customer", es: "Detección automática de fecha, monto, cliente" }, done: true },
  { n: 3, t: { en: "The engine computes RFM + CLV", es: "El motor calcula RFM + CLV" }, d: { en: "Background processing (~4 min)", es: "Procesamiento en background (~4 min)" }, done: true },
  { n: 4, t: { en: "Explore your first insight", es: "Explora tu primer insight" }, d: { en: "The assistant generates your initial summary", es: "El asistente genera tu resumen inicial" }, done: false },
];
const compliance = [
  { name: { en: "SOC 2 Type II", es: "SOC 2 Type II" }, status: { en: "Certified", es: "Certificado" }, c: PAL.good, d: { en: "Audited annually", es: "Auditado anualmente" } },
  { name: { en: "GDPR", es: "GDPR" }, status: { en: "Compliant", es: "Conforme" }, c: PAL.good, d: { en: "Data in EU/US region", es: "Datos en región UE/US" } },
  { name: { en: "Encryption", es: "Cifrado" }, status: { en: "AES-256", es: "AES-256" }, c: PAL.good, d: { en: "At rest and in transit", es: "En reposo y tránsito" } },
  { name: { en: "PII Handling", es: "PII Handling" }, status: { en: "Tokenized", es: "Tokenizado" }, c: PAL.good, d: { en: "Identifier hashing", es: "Hashing de identificadores" } },
];
// Explicabilidad del modelo (SHAP-style)
const shap = [
  { f: { en: "Days since last login", es: "Días desde último login" }, v: 38, c: PAL.red, dir: { en: "+risk", es: "+riesgo" } },
  { f: { en: "Unresolved ticket", es: "Ticket sin resolver" }, v: 24, c: PAL.orange, dir: { en: "+risk", es: "+riesgo" } },
  { f: { en: "Core-feature usage drop", es: "Caída de uso de feature core" }, v: 18, c: PAL.amber, dir: { en: "+risk", es: "+riesgo" } },
  { f: { en: "Account tenure", es: "Antigüedad de cuenta" }, v: -14, c: PAL.teal, dir: { en: "−risk", es: "−riesgo" } },
  { f: { en: "Annual plan", es: "Plan anual" }, v: -11, c: PAL.green, dir: { en: "−risk", es: "−riesgo" } },
];

// Limpia tokens de Markdown sueltos que el LLM podría devolver (asteriscos,
// backticks) para que nunca se vean crudos. No toca "_" (snake_case seguro).
function stripMd(s) {
  return String(s).replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "");
}
// Formato inline: **negrita** → <strong>, y limpia el resto.
function inlineFmt(text, keyBase) {
  const out = [];
  let rest = String(text), k = 0, m;
  const boldRe = /\*\*(.+?)\*\*/;
  while ((m = boldRe.exec(rest))) {
    if (m.index > 0) out.push(stripMd(rest.slice(0, m.index)));
    out.push(<strong key={`${keyBase}-b${k++}`}>{stripMd(m[1])}</strong>);
    rest = rest.slice(m.index + m[0].length);
  }
  out.push(stripMd(rest));
  return out;
}
// Renderiza la respuesta del asistente con Markdown mínimo: respeta saltos de
// línea, viñetas (-, *, •) y negritas; sin asteriscos ni "#" crudos.
function RichText({ text }) {
  const lines = String(text || "").split("\n");
  return <div>{lines.map((raw, i) => {
    const line = raw.trim();
    if (!line) return <div key={i} style={{ height: 7 }} />;
    if (/^#{1,6}\s+/.test(line))
      return <div key={i} style={{ fontWeight: 700, margin: "6px 0 2px" }}>{inlineFmt(line.replace(/^#{1,6}\s+/, ""), i)}</div>;
    if (/^[-*•]\s+/.test(line))
      return <div key={i} style={{ display: "flex", gap: 8, margin: "2px 0" }}><span style={{ color: PAL.brand, flexShrink: 0 }}>•</span><span>{inlineFmt(line.replace(/^[-*•]\s+/, ""), i)}</span></div>;
    return <div key={i} style={{ margin: "2px 0" }}>{inlineFmt(line, i)}</div>;
  })}</div>;
}

// === MÓDULO: ASISTENTE IA (pantalla completa) ===
function AssistantView({ previewHeight } = {}) {
  const isPreview = !!previewHeight;
  const { dataset, company, credits, spendCredits, lang, L } = useSession();
  // La conversación arranca distinta según el contexto:
  // - preview de la landing: los mensajes de ejemplo (se ve "lleno").
  // - asistente real: un saludo personalizado con las cifras de la sesión.
  const [msgs, setMsgs] = useState(() => isPreview
    ? aiMessages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: L(m.text.en, m.text.es), actions: m.actions && m.actions.map(a => L(a.en, a.es)) }))
    : [{ role: "assistant", content: L(
        `Hi${company ? `, ${company} team` : ""}. I've loaded your business analysis: ${dataset.revenueAtRisk.totalLabel} of CLV at risk across ${dataset.revenueAtRisk.accounts} accounts, NRR ${dataset.metrics.nrr}% and CLV:CAC ${dataset.metrics.clvCac}:1. Ask me what to prioritize, why a customer is leaving, or where to reallocate budget.`,
        `Hola${company ? `, equipo de ${company}` : ""}. Tengo cargado el análisis de tu negocio: ${dataset.revenueAtRisk.totalLabel} de CLV en riesgo en ${dataset.revenueAtRisk.accounts} cuentas, NRR ${dataset.metrics.nrr}% y CLV:CAC ${dataset.metrics.clvCac}:1. Pregúntame qué priorizar, por qué se va un cliente, o dónde reasignar presupuesto.`
      ) }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = React.useRef(null);
  const suggestions = lang === "es"
    ? ["¿Qué cuentas debería priorizar esta semana?", "Resume el churn del último trimestre", "¿Qué canal trae los clientes más valiosos?"]
    : ["Which accounts should I prioritize this week?", "Summarize last quarter's churn", "Which channel brings the most valuable customers?"];

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setSending(true);
    // En el preview de la landing no llamamos al backend (costo cero al explorar).
    if (isPreview) {
      setTimeout(() => {
        setMsgs(m => [...m, { role: "assistant", content: L("This is a demo. Enter and connect your business to chat with the assistant about your data.", "Esta es una demo. Entra y conecta tu negocio para conversar con el asistente sobre tus datos.") }]);
        setSending(false);
      }, 700);
      return;
    }
    // Cada consulta consume 1 crédito (refleja el costo de cómputo del modelo).
    if (!spendCredits(1)) {
      setMsgs(m => [...m, { role: "assistant", content: L("You're out of credits for this session. Top up in “Credits & usage” to keep asking.", "Te quedaste sin créditos para esta sesión. Renuévalos en «Créditos & uso» para seguir consultando.") }]);
      setSending(false);
      return;
    }
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), context: toSnapshot(dataset, company), lang }),
      });
      const data = await res.json();
      setMsgs(m => [...m, { role: "assistant", content: data.reply || data.error || L("I couldn't respond right now.", "No pude responder en este momento.") }]);
    } catch {
      setMsgs(m => [...m, { role: "assistant", content: L("There was a connection problem. Please try again.", "Hubo un problema de conexión. Intenta de nuevo.") }]);
    } finally {
      setSending(false);
    }
  };

  return <div style={{ display: "flex", flexDirection: "column", height: previewHeight || "calc(100vh - 110px)" }}>
    {/* encabezado */}
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: `1px solid ${PAL.line}`, flexShrink: 0 }}>
      <Logo size={36} />
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px" }}>{L("Vantix Assistant", "Asistente Vantix")}</div>
        <div style={{ fontSize: FS.label, color: PAL.sub }}>{L("Ask in natural language — it answers with the cause and the action", "Pregunta en lenguaje natural — responde con la causa y la acción")}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {!isPreview && <span style={{ fontSize: FS.label, color: PAL.brand, fontWeight: 600 }}>{credits} {L("credits", "créditos")}</span>}
        <span style={{ fontSize: FS.label, color: PAL.good, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: PAL.good }} />{L("Online", "En línea")}</span>
      </div>
    </div>
    {/* mensajes (scroll) */}
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 0", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "84%" }}>
              {m.role === "assistant" && <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <Logo size={22} /><span style={{ fontSize: 11.5, fontWeight: 600, color: PAL.sub }}>{L("Assistant", "Asistente")}</span></div>}
              <div style={{ background: m.role === "user" ? PAL.brand : PAL.panel, color: m.role === "user" ? "#fff" : PAL.text, padding: "13px 17px", borderRadius: 14, fontSize: FS.body, lineHeight: 1.6, border: m.role === "assistant" ? `1px solid ${PAL.line}` : "none", boxShadow: m.role === "assistant" ? "0 1px 2px rgba(16,17,22,.04)" : "none" }}>{m.role === "assistant" ? <RichText text={m.content} /> : m.content}</div>
              {m.actions && <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {m.actions.map((a, j) => <button key={j} style={{ fontSize: 12, fontWeight: 600, color: j === 0 ? PAL.brand : PAL.text, background: PAL.panel, border: `1px solid ${j === 0 ? PAL.brand : PAL.line}`, borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontFamily: FONT }}>{a}</button>)}
              </div>}
            </div></div>))}
        {sending && <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Logo size={22} /><span style={{ fontSize: FS.body, color: PAL.sub, fontStyle: "italic" }}>{L("typing…", "escribiendo…")}</span></div>
        </div>}
      </div>
    </div>
    {/* barra de entrada (fija abajo) */}
    <div style={{ flexShrink: 0, paddingTop: 14, borderTop: `1px solid ${PAL.line}` }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {suggestions.map((s, i) => <button key={i} onClick={() => setInput(s)} style={{ fontSize: 11.5, color: PAL.sub, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 20, padding: "7px 13px", cursor: "pointer", fontFamily: FONT }}>{s}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder={L("Ask about your data…", "Pregunta sobre tus datos…")} style={{ flex: 1, fontSize: FS.body, padding: "14px 16px", borderRadius: 12, border: `1px solid ${PAL.line}`, fontFamily: FONT, outline: "none", background: PAL.panel }} />
          <button onClick={send} disabled={sending} style={{ fontSize: FS.body, fontWeight: 600, color: "#fff", background: sending ? PAL.sub : PAL.brand, border: "none", borderRadius: 12, padding: "0 24px", cursor: sending ? "default" : "pointer", fontFamily: FONT }}>{L("Send", "Enviar")}</button>
        </div>
        <div style={{ fontSize: 10, color: PAL.sub, textAlign: "center", marginTop: 8 }}>{L("The assistant answers about your data. Information to decide, not investment advice.", "El asistente responde sobre tus datos. Información para decidir, no consejo de inversión.")}</div>
      </div>
    </div>
  </div>;
}

// === MÓDULO: NARRATIVAS + ANOMALÍAS ===
function NarrativeView({ embedded } = {}) {
  const { dataset, L } = useSession();
  const { narrative } = dataset;
  return <div>
    {!embedded && <H1 title={L("Executive summary", "Resumen ejecutivo")} sub={L("Auto-generated every Monday. What changed, why it matters and what to do — without decoding charts.", "Generado automáticamente cada lunes. Qué cambió, por qué importa y qué hacer — sin descifrar gráficos.")} />}
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: PAL.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{L("This week's narrative", "Narrativa de la semana")}</div>
        {narrative.map((n, i) => (
          <div key={i} style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderLeft: `3px solid ${n.c}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700, color: n.c, background: `${n.c}1A`, padding: "2px 8px", borderRadius: 20, marginBottom: 8, letterSpacing: ".4px" }}>{n.tag}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{n.text}</div></div>))}
      </div>
      <Panel title={L("Anomaly detection", "Detección de anomalías")} tag={L("daily MRR · auto-flagged", "MRR diario · auto-flagged")} h={340}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={anomalies} margin={{ top: 10, right: 14, bottom: 6, left: -16 }}>
            <CartesianGrid vertical={false} stroke={PAL.line} />
            <XAxis dataKey="d" tick={{ fontSize: 9, fill: PAL.sub }} tickFormatter={(v) => `D${v}`} interval={6} />
            <YAxis tick={{ fontSize: 10, fill: PAL.sub }} />
            <Tooltip content={<TipBox />} />
            <Line dataKey="v" stroke={PAL.indigo} strokeWidth={2} dot={false} name="MRR" isAnimationActive={false} />
            <Scatter data={anomalies.filter(a => a.anom)} dataKey="v" fill={PAL.red} isAnimationActive={false} name={L("Anomaly", "Anomalía")} />
          </ComposedChart></ResponsiveContainer>
        <div style={{ fontSize: 11, color: PAL.sub, marginTop: 6, textAlign: "center" }}>{L("2 anomalies detected · the model flags the odd before you look for it", "2 anomalías detectadas · el modelo marca lo raro antes de que lo busques")}</div>
      </Panel></div></div>;
}

// === MÓDULO: INTEGRACIONES ===
function IntegrationsView({ embedded } = {}) {
  const { L } = useSession();
  return <div>
    {!embedded && <H1 title={L("Integrations", "Integraciones")} sub={L("It doesn't just export — it writes back. The more tools it connects, the harder it is to leave.", "No solo exporta — escribe de vuelta. Cuantas más herramientas conecta, más difícil es abandonarlo.")} />}
    <div className="cardrow" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
      {integrations.map((it) => (
        <div key={it.name} style={{ background: PAL.panel, border: `1px solid ${it.status === "connected" ? `${it.c}66` : PAL.line}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${it.c}1A`, display: "flex", alignItems: "center", justifyContent: "center", color: it.c, fontWeight: 700, fontSize: 16 }}>{it.name[0]}</div>
            {it.status === "connected"
              ? <span style={{ fontSize: 10, fontWeight: 700, color: PAL.good, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: PAL.good }} />{L("Connected", "Conectado")}</span>
              : <span style={{ fontSize: 10, color: PAL.sub }}>{L("Available", "Disponible")}</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</div>
          <div style={{ fontSize: 11.5, color: PAL.sub, marginBottom: 12 }}>{L(it.cat.en, it.cat.es)} · {L(it.dir.en, it.dir.es)}</div>
          <button style={{ width: "100%", fontSize: 12, fontWeight: 600, color: it.status === "connected" ? PAL.sub : "#fff", background: it.status === "connected" ? PAL.panel2 : it.c, border: it.status === "connected" ? `1px solid ${PAL.line}` : "none", borderRadius: 8, padding: "9px", cursor: "pointer", fontFamily: FONT }}>{it.status === "connected" ? L("Configure", "Configurar") : L("Connect", "Conectar")}</button>
        </div>))}
    </div>
    <div style={{ marginTop: 14, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{L("Public API + Webhooks", "API pública + Webhooks")}</div>
      <div style={{ fontSize: 12.5, color: PAL.sub, marginBottom: 12 }}>{L("An API turns a product into a platform. Others can build on your data and embed your dashboards.", "Una API convierte un producto en plataforma. Otros pueden construir sobre tus datos y embeber tus dashboards.")}</div>
      <code style={{ display: "block", background: PAL.panel2, borderRadius: 8, padding: "12px 14px", fontSize: 12, color: PAL.text, fontFamily: "monospace" }}>{L("POST /v1/segments/at-risk → webhook to your CRM in real time", "POST /v1/segments/at-risk → webhook a tu CRM en tiempo real")}</code>
    </div></div>;
}

// === MÓDULO: EQUIPO & RBAC ===
function TeamView() {
  const { L } = useSession();
  return <div>
    <H1 title={L("Team & permissions", "Equipo & permisos")} sub={L("RBAC: the CFO sees everything, the account manager only their book. Essential to sell to enterprises.", "RBAC: el CFO ve todo, el account manager solo su cartera. Indispensable para vender a empresas.")} />
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
      <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${PAL.line}`, fontSize: 11, fontWeight: 600, color: PAL.sub, textTransform: "uppercase", letterSpacing: ".4px", background: PAL.panel2, display: "flex", justifyContent: "space-between" }}><span>{L("Team members", "Miembros del equipo")}</span><span>{L("Scope (RBAC)", "Alcance (RBAC)")}</span></div>
        {teamMembers.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: i < teamMembers.length - 1 ? `1px solid ${PAL.line}` : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${m.c}1A`, color: m.c, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>{m.init}</div>
              <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</div><div style={{ fontSize: 11.5, color: PAL.sub }}>{L(m.role.en, m.role.es)}</div></div>
            </div>
            <span style={{ fontSize: 11.5, color: m.c, fontWeight: 500 }}>{L(m.scope.en, m.scope.es)}</span>
          </div>))}
      </div>
      <Panel title="Audit log" tag={L("who viewed what and when", "quién vio qué y cuándo")} h={320}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {auditLog.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.c, marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5 }}><strong style={{ color: a.c }}>{L(a.who.en, a.who.es)}</strong> {L(a.act.en, a.act.es)}</div>
                <div style={{ fontSize: 10.5, color: PAL.sub }}>{L(a.t.en, a.t.es)}</div></div>
            </div>))}
        </div>
      </Panel></div></div>;
}

// === MÓDULO: ONBOARDING SELF-SERVE ===
function OnboardingView() {
  const { L } = useSession();
  return <div>
    <H1 title="Onboarding" sub={L("Connect your data and see value in 10 minutes without talking to anyone. Efficient growth lives here.", "Conecta tus datos y ve valor en 10 minutos sin hablar con nadie. El crecimiento eficiente vive aquí.")} />
    <div style={{ maxWidth: 720 }}>
      <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: 24 }}>
        {onboardingSteps.map((s, i) => (
          <div key={s.n} style={{ display: "flex", gap: 16, paddingBottom: i < onboardingSteps.length - 1 ? 20 : 0, position: "relative" }}>
            {i < onboardingSteps.length - 1 && <div style={{ position: "absolute", left: 17, top: 36, bottom: 4, width: 2, background: s.done ? PAL.teal : PAL.line }} />}
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: s.done ? PAL.teal : PAL.panel2, border: s.done ? "none" : `2px solid ${PAL.line}`, color: s.done ? "#fff" : PAL.sub, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0, zIndex: 1 }}>{s.done ? "✓" : s.n}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: s.done ? PAL.text : PAL.sub }}>{L(s.t.en, s.t.es)}</div>
              <div style={{ fontSize: 12.5, color: PAL.sub, marginTop: 2 }}>{L(s.d.en, s.d.es)}</div>
              {!s.done && <button style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: "#fff", background: PAL.indigo, border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontFamily: FONT }}>{L("Continue", "Continuar")}</button>}
            </div></div>))}
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 12 }}>
        {[{ t: "Stripe", c: PAL.indigo }, { t: "Snowflake", c: PAL.teal }, { t: L("Upload CSV", "Subir CSV"), c: PAL.sub }].map((o) => (
          <div key={o.t} style={{ flex: 1, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 12, padding: 16, textAlign: "center", cursor: "pointer" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${o.c}1A`, color: o.c, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontWeight: 700 }}>{o.t[0]}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{o.t}</div></div>))}
      </div></div></div>;
}

// === MÓDULO: PRICING & BILLING ===
function BillingView() {
  const { credits, L } = useSession();
  const balance = credits, monthly = 500;
  const pct = (balance / monthly) * 100;
  const usage = [
    { type: L("AI Assistant queries", "Consultas al Asistente IA"), count: 47, credits: 47, color: PAL.d1 },
    { type: L("Market micro-studies", "Micro-estudios de mercado"), count: 3, credits: 75, color: PAL.d3 },
    { type: L("Retention plans", "Planes de retención"), count: 2, credits: 30, color: PAL.d4 },
    { type: L("Monte Carlo simulations", "Simulaciones Monte Carlo"), count: 1, credits: 5, color: PAL.d5 },
  ];
  const spent = usage.reduce((a, u) => a + u.credits, 0);
  const history = [
    { date: L("Jun 02", "02 jun"), action: L("Micro-study: expansion to EU", "Micro-estudio: expansión a EU"), credits: -25 },
    { date: L("Jun 01", "01 jun"), action: L("Retention plan · At-Risk Premium", "Plan de retención · At-Risk Premium"), credits: -15 },
    { date: L("May 31", "31 may"), action: L("Query: which accounts to prioritize?", "Consulta: ¿qué cuentas priorizar?"), credits: -1 },
    { date: L("May 28", "28 may"), action: L("Monthly credit renewal", "Renovación mensual de créditos"), credits: +500 },
    { date: L("May 27", "27 may"), action: L("Monte Carlo simulation · ARR 18m", "Simulación Monte Carlo · ARR 18m"), credits: -5 },
  ];
  return <div>
    <H1 title={L("Credits & usage", "Créditos & uso")} sub={L("Each analysis consumes credits that reflect the models' compute cost. Transparent, no subscription.", "Cada análisis consume créditos que reflejan el costo de cómputo de los modelos. Transparente, sin suscripción.")} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
      <Panel title={L("Credit balance", "Saldo de créditos")} tag={L("early access · free", "early access · gratis")} h={200}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1px", color: PAL.brand }}>{balance}</span>
          <span style={{ fontSize: FS.body, color: PAL.sub }}>{L(`of ${monthly} credits`, `de ${monthly} créditos`)}</span>
        </div>
        <div style={{ height: 10, background: PAL.panel2, borderRadius: 6, overflow: "hidden", margin: "14px 0 8px" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: PAL.brand, borderRadius: 6 }} /></div>
        <div style={{ fontSize: FS.label, color: PAL.sub }}>{L(`Renews free on the 28th of each month · ${spent} credits used this period`, `Se renuevan gratis el 28 de cada mes · ${spent} créditos usados este periodo`)}</div>
        <button style={{ marginTop: 16, fontSize: FS.body, fontWeight: 600, color: PAL.brand, background: PAL.panel, border: `1px solid ${PAL.brand}`, borderRadius: 9, padding: "9px 16px", cursor: "pointer", fontFamily: FONT }}>{L("Request more credits", "Solicitar más créditos")}</button>
      </Panel>
      <Panel title={L("Usage by analysis type", "Consumo por tipo de análisis")} tag={L("this period", "este periodo")} h={200}>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {usage.map((u, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: FS.body, marginBottom: 4 }}>
                <span>{u.type} <span style={{ color: PAL.sub, fontSize: FS.label }}>· {u.count}×</span></span>
                <span style={{ fontWeight: 700 }}>{u.credits}</span></div>
              <div style={{ height: 6, background: PAL.panel2, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${(u.credits / spent) * 100}%`, height: "100%", background: u.color, borderRadius: 4 }} /></div>
            </div>))}
        </div>
      </Panel>
    </div>
    <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${PAL.line}`, fontSize: FS.label, fontWeight: 700, color: PAL.sub, textTransform: "uppercase", letterSpacing: ".4px", background: PAL.panel2 }}>{L("Credit history", "Historial de créditos")}</div>
      {history.map((h, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: i < history.length - 1 ? `1px solid ${PAL.line}` : "none", fontSize: FS.body }}>
          <div style={{ display: "flex", gap: 14 }}><span style={{ color: PAL.sub, width: 50 }}>{h.date}</span><span>{h.action}</span></div>
          <span style={{ fontWeight: 700, color: h.credits > 0 ? PAL.good : PAL.text }}>{h.credits > 0 ? `+${h.credits}` : h.credits}</span>
        </div>))}
    </div></div>;
}

// === MÓDULO: GOBERNANZA & EXPLICABILIDAD ===
function GovernanceView() {
  const { L } = useSession();
  return <div>
    <H1 title={L("Trust & governance", "Confianza & gobernanza")} sub={L("What closes enterprise deals: compliance, model explainability and PII handling.", "Lo que cierra ventas enterprise: cumplimiento, explicabilidad del modelo y manejo de PII.")} />
    <div className="cardrow" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
      {compliance.map((c) => (
        <div key={c.name.en} style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.c }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: c.c }}>{L(c.status.en, c.status.es)}</span></div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{L(c.name.en, c.name.es)}</div>
          <div style={{ fontSize: 11.5, color: PAL.sub, marginTop: 2 }}>{L(c.d.en, c.d.es)}</div></div>))}
    </div>
    <Panel title={L("Model explainability", "Explicabilidad del modelo")} tag={L("why this account is at risk", "por qué esta cuenta está en riesgo")} h={320}>
      <div style={{ fontSize: 12.5, color: PAL.sub, marginBottom: 14 }}>{L(<>Account <strong style={{ color: PAL.text }}>Northwind Trading</strong> · 78% churn probability. A black box isn't actionable; this shows which factors push the prediction.</>, <>Cuenta <strong style={{ color: PAL.text }}>Northwind Trading</strong> · probabilidad de churn 78%. Una caja negra no es accionable; esto muestra qué factores empujan la predicción.</>)}</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart layout="vertical" data={shap.map((d) => ({ ...d, f: L(d.f.en, d.f.es) }))} margin={{ top: 0, right: 50, bottom: 0, left: 10 }}>
          <CartesianGrid horizontal={false} stroke={PAL.line} />
          <XAxis type="number" tick={{ fontSize: 10, fill: PAL.sub }} domain={[-20, 45]} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`} />
          <YAxis type="category" dataKey="f" tick={{ fontSize: 11, fill: PAL.text }} width={180} />
          <Tooltip content={<TipBox unit="%" />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
          <Bar dataKey="v" radius={[0, 4, 4, 0]} isAnimationActive={false}>{shap.map((d, i) => <Cell key={i} fill={d.c} />)}</Bar>
        </BarChart></ResponsiveContainer>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 9.5, color: PAL.sub, marginTop: 6 }}><Legend c={PAL.red} t={L("Increases risk", "Aumenta riesgo")} /><Legend c={PAL.teal} t={L("Reduces risk", "Reduce riesgo")} /></div>
    </Panel></div>;
}

// === MÓDULO: EMBEDDABLE ANALYTICS ===
function EmbedView({ embedded } = {}) {
  const { L } = useSession();
  return <div>
    {!embedded && <H1 title="Embeddable analytics" sub={L("Let other companies put your dashboards inside their products. It's a whole business model.", "Que otras empresas metan tus dashboards dentro de sus productos. Es un modelo de negocio entero.")} />}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Panel title={L("Embedded preview", "Vista previa embebida")} tag={L("iframe in client product", "iframe en producto de cliente")} h={300}>
        <div style={{ border: `2px dashed ${PAL.line}`, borderRadius: 12, padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, color: PAL.sub, marginBottom: 10 }}>app.tu-cliente.com / analytics</div>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fc.filter(d => d.actual)} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs><linearGradient id="emb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PAL.teal} stopOpacity={0.3} /><stop offset="100%" stopColor={PAL.teal} stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke={PAL.line} /><XAxis dataKey="m" tick={{ fontSize: 9, fill: PAL.sub }} interval={3} /><YAxis tick={{ fontSize: 9, fill: PAL.sub }} />
                <Area dataKey="actual" stroke={PAL.teal} strokeWidth={2.2} fill="url(#emb)" isAnimationActive={false} />
              </AreaChart></ResponsiveContainer></div>
        </div>
      </Panel>
      <Panel title={L("Integration snippet", "Snippet de integración")} tag="white-label" h={300}>
        <code style={{ display: "block", background: PAL.panel2, borderRadius: 10, padding: 16, fontSize: 12, color: PAL.text, fontFamily: "monospace", lineHeight: 1.7 }}>
          {"<script src=\"cdn.tu-saas.com/embed.js\"></scr" + "ipt>"}<br/>
          {"<div data-dashboard=\"clv-retention\""}<br/>
          {"     data-token=\"pk_live_…\""}<br/>
          {"     data-theme=\"light\">"}<br/>
          {"</div>"}
        </code>
        <div style={{ fontSize: 12, color: PAL.sub, marginTop: 12 }}>{L("Theme, branding and permissions inherit from the client. Every company that embeds expands your market without you touching their product.", "Tema, branding y permisos heredan del cliente. Cada empresa que embebe amplía tu mercado sin que toques su producto.")}</div>
      </Panel></div></div>;
}


/* =================== MAPAS DE CALOR REALES =================== */

// Datos geográficos: ingresos por estado de EE.UU. (paths SVG reales simplificados)
// Coordenadas en grid hexagonal de estados (tilegram) — legible y profesional
const usStates = [
  { id: "WA", x: 1, y: 0, rev: 412 }, { id: "MT", x: 2, y: 0, rev: 88 }, { id: "ND", x: 3, y: 0, rev: 72 }, { id: "MN", x: 4, y: 0, rev: 198 }, { id: "WI", x: 5, y: 0, rev: 224 }, { id: "MI", x: 6, y: 0, rev: 287 }, { id: "NY", x: 8, y: 0, rev: 689 }, { id: "VT", x: 9, y: 0, rev: 41 }, { id: "ME", x: 10, y: 0, rev: 58 },
  { id: "OR", x: 1, y: 1, rev: 234 }, { id: "ID", x: 2, y: 1, rev: 64 }, { id: "SD", x: 3, y: 1, rev: 51 }, { id: "IA", x: 4, y: 1, rev: 142 }, { id: "IL", x: 5, y: 1, rev: 478 }, { id: "IN", x: 6, y: 1, rev: 216 }, { id: "OH", x: 7, y: 1, rev: 388 }, { id: "PA", x: 8, y: 1, rev: 442 }, { id: "NJ", x: 9, y: 1, rev: 356 }, { id: "CT", x: 10, y: 1, rev: 187 }, { id: "RI", x: 11, y: 1, rev: 44 },
  { id: "CA", x: 0, y: 2, rev: 920 }, { id: "NV", x: 1, y: 2, rev: 178 }, { id: "UT", x: 2, y: 2, rev: 134 }, { id: "WY", x: 3, y: 2, rev: 38 }, { id: "NE", x: 4, y: 2, rev: 79 }, { id: "MO", x: 5, y: 2, rev: 198 }, { id: "KY", x: 6, y: 2, rev: 132 }, { id: "WV", x: 7, y: 2, rev: 61 }, { id: "VA", x: 8, y: 2, rev: 318 }, { id: "MD", x: 9, y: 2, rev: 241 }, { id: "DE", x: 10, y: 2, rev: 52 },
  { id: "AZ", x: 2, y: 3, rev: 246 }, { id: "CO", x: 3, y: 3, rev: 289 }, { id: "KS", x: 4, y: 3, rev: 94 }, { id: "AR", x: 5, y: 3, rev: 87 }, { id: "TN", x: 6, y: 3, rev: 201 }, { id: "NC", x: 7, y: 3, rev: 312 }, { id: "SC", x: 8, y: 3, rev: 148 }, { id: "DC", x: 9, y: 3, rev: 98 },
  { id: "NM", x: 3, y: 4, rev: 71 }, { id: "OK", x: 4, y: 4, rev: 112 }, { id: "LA", x: 5, y: 4, rev: 119 }, { id: "MS", x: 6, y: 4, rev: 64 }, { id: "AL", x: 7, y: 4, rev: 108 }, { id: "GA", x: 8, y: 4, rev: 367 },
  { id: "TX", x: 4, y: 5, rev: 712 }, { id: "FL", x: 9, y: 5, rev: 534 },
  { id: "AK", x: 0, y: 6, rev: 47 }, { id: "HI", x: 1, y: 6, rev: 63 },
];
function geoColor(rev) {
  const t = Math.min(rev / 920, 1);
  // escala secuencial de intensidad sobre el índigo de marca (99,102,241)
  return `rgba(99,102,241,${0.14 + t * 0.82})`;
}

function GeoHeatmap() {
  const { L } = useSession();
  const [hover, setHover] = useState(null);
  const cell = 46, gap = 4;
  const cols = 12, rows = 7;
  return <div style={{ position: "relative" }}>
    <svg viewBox={`0 0 ${cols * (cell + gap)} ${rows * (cell + gap) + 4}`} style={{ width: "100%", height: "auto" }}>
      {usStates.map((s) => {
        const px = s.x * (cell + gap), py = s.y * (cell + gap);
        const active = hover && hover.id === s.id;
        return <g key={s.id} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
          <rect x={px} y={py} width={cell} height={cell} rx={7} fill={geoColor(s.rev)} stroke={active ? "#1A1D23" : "#FFFFFF"} strokeWidth={active ? 2 : 1.5} />
          <text x={px + cell / 2} y={py + cell / 2 - 2} textAnchor="middle" fontSize="11" fontWeight="700" fill={s.rev > 300 ? "#fff" : "#1A1D23"} fontFamily="Inter">{s.id}</text>
          <text x={px + cell / 2} y={py + cell / 2 + 11} textAnchor="middle" fontSize="7.5" fill={s.rev > 300 ? "rgba(255,255,255,.85)" : "#6B7280"} fontFamily="Inter">{s.rev}K</text>
        </g>;
      })}
    </svg>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
      <span style={{ fontSize: 10.5, color: "#6B7280" }}>$0</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "linear-gradient(90deg, rgba(99,102,241,.14), rgba(99,102,241,.96))" }} />
      <span style={{ fontSize: 10.5, color: "#6B7280" }}>$920K</span>
    </div>
    {hover && <div style={{ position: "absolute", top: 8, right: 8, background: "#FFFFFF", border: `1px solid #E7E9EE`, borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 14px rgba(16,17,22,.12)" }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{hover.id}</div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>{L("Revenue", "Ingresos")}: <strong style={{ color: "#1A1D23" }}>${hover.rev}K</strong></div>
    </div>}
  </div>;
}

// Heatmap tipo calendario (actividad de cuentas por día — estilo GitHub)
const calWeeks = 26, calDays = 7;
const _rndCal = makeRng("vtx-cal");
const calData = Array.from({ length: calWeeks * calDays }, (_, i) => {
  const base = Math.sin(i / 18) * 0.4 + 0.5;
  const v = Math.max(0, Math.min(1, base + (_rndCal() - 0.5) * 0.6));
  return { i, v, week: Math.floor(i / calDays), day: i % calDays };
});
function calColor(v) {
  if (v < 0.15) return "#EEF0F3";
  return `rgba(16,185,129,${0.3 + v * 0.7})`;
}
function CalendarHeatmap() {
  const { L } = useSession();
  const cell = 13, gap = 3;
  const months = L(["Jan","Feb","Mar","Apr","May","Jun"], ["Ene","Feb","Mar","Abr","May","Jun"]);
  const dayLabels = L(["M","","W","","F","",""], ["L","","X","","V","",""]);
  return <div>
    <svg viewBox={`0 0 ${calWeeks * (cell + gap) + 20} ${calDays * (cell + gap) + 22}`} style={{ width: "100%", height: "auto" }}>
      {months.map((m, i) => <text key={i} x={20 + i * 4.3 * (cell + gap)} y={9} fontSize="9.5" fill="#6B7280" fontFamily="Inter">{m}</text>)}
      {dayLabels.map((d, i) => d && <text key={i} x={2} y={28 + i * (cell + gap)} fontSize="8" fill="#6B7280" fontFamily="Inter">{d}</text>)}
      {calData.map((c) => (
        <rect key={c.i} x={20 + c.week * (cell + gap)} y={16 + c.day * (cell + gap)} width={cell} height={cell} rx={2.5} fill={calColor(c.v)}>
          <title>{`${L("Activity", "Actividad")}: ${(c.v * 100).toFixed(0)}%`}</title>
        </rect>))}
    </svg>
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 8, fontSize: 10, color: "#6B7280" }}>
      {L("Less", "Menos")} {[0.05, 0.25, 0.45, 0.65, 0.9].map((v, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: 2.5, background: calColor(v), display: "inline-block" }} />)} {L("More", "Más")}
    </div>
  </div>;
}

// Heatmap matricial profesional: cohorte hora×día (cuándo compran)
const hours = ["0","3","6","9","12","15","18","21"];
const days7 = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const _rndMatrix = makeRng("vtx-matrix");
const matrixData = days7.map((d, di) => hours.map((h, hi) => {
  const peak = Math.exp(-((hi - 4.5) ** 2) / 6) * (di < 5 ? 1 : 0.55);
  return { d, h, di, hi, v: +(peak * 100 + _rndMatrix() * 12).toFixed(0) };
}));
function matrixColor(v) {
  const t = Math.min(v / 100, 1);
  return `rgba(99,102,241,${0.12 + t * 0.86})`;
}
function MatrixHeatmap() {
  const { L } = useSession();
  const dayNames = L(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"]);
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: `42px repeat(${hours.length}, 1fr)`, gap: 3 }}>
      <div />{hours.map(h => <div key={h} style={{ fontSize: 9.5, color: "#6B7280", textAlign: "center" }}>{h}h</div>)}
      {matrixData.map((row, di) => (<React.Fragment key={di}>
        <div style={{ fontSize: 10, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>{dayNames[di]}</div>
        {row.map((c) => <div key={c.hi} title={`${dayNames[c.di]} ${c.h}h: ${c.v}`} style={{ background: matrixColor(c.v), borderRadius: 4, height: 30, cursor: "pointer" }} />)}
      </React.Fragment>))}
    </div>
    <div style={{ fontSize: 10.5, color: "#6B7280", marginTop: 10, textAlign: "center" }}>{L("Purchase peak: Tue–Thu, 12–3pm · use this for campaign timing", "Pico de compra: martes–jueves, 12–15h · usa esto para timing de campañas")}</div>
  </div>;
}

// === MÓDULO: MAPAS GEOGRÁFICOS ===
function GeoView({ embedded } = {}) {
  const { L } = useSession();
  return <div>
    {!embedded && <H1 title={L("Geographic heatmaps", "Mapas de calor geográficos")} sub={L("Where your revenue and risk live. Geographic concentration reveals markets to defend and to expand.", "Dónde está tu ingreso y tu riesgo. La concentración geográfica revela mercados a defender y a expandir.")} />}
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
      <Panel title={L("Revenue by state", "Ingresos por estado")} tag={L("choropleth · U.S.", "coroplético · EE.UU.")} h={440}><GeoHeatmap /></Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Panel title={L("Top markets", "Top mercados")} tag={L("by revenue", "por ingreso")} h={210}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[...usStates].sort((a, b) => b.rev - a.rev).slice(0, 6).map((s, i) => {
              const max = 920;
              return <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, width: 26 }}>{s.id}</span>
                <div style={{ flex: 1, height: 14, background: "#F6F7F9", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(s.rev / max) * 100}%`, height: "100%", background: geoColor(s.rev), borderRadius: 4 }} /></div>
                <span style={{ fontSize: 11, color: "#6B7280", width: 44, textAlign: "right" }}>${s.rev}K</span>
              </div>;
            })}
          </div>
        </Panel>
        <Panel title={L("Concentration", "Concentración")} tag={L("Pareto rule", "regla de Pareto")} h={210}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: 14 }}>
            <div><div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.5px", color: PAL.brand }}>62%</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{L("of revenue comes from 5 states (CA, TX, NY, FL, IL)", "del ingreso viene de 5 estados (CA, TX, NY, FL, IL)")}</div></div>
            <div style={{ borderTop: `1px solid #E7E9EE`, paddingTop: 12 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: PAL.warn }}>{L("Concentration risk", "Riesgo de concentración")}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{L("A regional recession in California would hit 22% of ARR", "Una recesión regional en California impactaría el 22% del ARR")}</div></div>
          </div>
        </Panel>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
      <Panel title={L("Account activity", "Actividad de cuentas")} tag={L("calendar heatmap · 6 months", "heatmap calendario · 6 meses")} h={200}><CalendarHeatmap /></Panel>
      <Panel title={L("Purchase pattern", "Patrón de compra")} tag={L("hour × weekday", "hora × día de semana")} h={200}><MatrixHeatmap /></Panel>
    </div>
  </div>;
}


/* =================== HERRAMIENTAS AVANZADAS =================== */

// ---------- 1) MAPA INTELIGENTE EN VIVO ----------
// Simula streaming: eventos de transacción que "llegan" y animan sobre un mapa.
const cityNodes = [
  { id: "SF", name: "San Francisco", x: 8, y: 42, base: 92 },
  { id: "LA", name: "Los Ángeles", x: 12, y: 56, base: 78 },
  { id: "SEA", name: "Seattle", x: 11, y: 22, base: 64 },
  { id: "DEN", name: "Denver", x: 30, y: 46, base: 51 },
  { id: "AUS", name: "Austin", x: 42, y: 68, base: 73 },
  { id: "CHI", name: "Chicago", x: 52, y: 38, base: 81 },
  { id: "NYC", name: "Nueva York", x: 76, y: 36, base: 96 },
  { id: "MIA", name: "Miami", x: 72, y: 74, base: 69 },
  { id: "BOS", name: "Boston", x: 80, y: 30, base: 58 },
  { id: "ATL", name: "Atlanta", x: 64, y: 60, base: 62 },
];
function IntelligentMap({ embedded } = {}) {
  const [nodes, setNodes] = useState(() => cityNodes.map(n => ({ ...n, pulse: n.base, live: 0 })));
  const [pings, setPings] = useState([]);
  const [feed, setFeed] = useState([]);
  const [running, setRunning] = useState(true);
  const [metric, setMetric] = useState("revenue");
  const idRef = React.useRef(0);

  React.useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const node = cityNodes[Math.floor(Math.random() * cityNodes.length)];
      const amt = Math.floor(40 + Math.random() * 960);
      const id = idRef.current++;
      setPings(p => [...p.slice(-12), { id, x: node.x, y: node.y, c: amt > 600 ? PAL.d1 : amt > 300 ? PAL.d3 : PAL.d4 }]);
      setNodes(ns => ns.map(n => n.id === node.id ? { ...n, pulse: Math.min(100, n.pulse + amt / 80), live: n.live + 1 } : { ...n, pulse: Math.max(n.base, n.pulse - 0.4) }));
      setFeed(f => [{ id, city: node.name, amt, t: new Date().toLocaleTimeString("es", { hour12: false }) }, ...f.slice(0, 7)]);
      setTimeout(() => setPings(p => p.filter(x => x.id !== id)), 1400);
    }, 700);
    return () => clearInterval(iv);
  }, [running]);

  const { L } = useSession();
  const nodeColor = (v) => v > 80 ? PAL.d1 : v > 60 ? PAL.d3 : v > 40 ? PAL.d4 : PAL.d5;
  const metrics = [{ k: "revenue", en: "revenue", es: "revenue" }, { k: "cuentas", en: "accounts", es: "cuentas" }, { k: "riesgo", en: "risk", es: "riesgo" }];
  return <div>
    {!embedded && <H1 title={L("Live intelligent map", "Mapa inteligente en vivo")} sub={L("Each dot is a transaction arriving in real time. Nodes grow and change color with accumulated activity.", "Cada punto es una transacción llegando en tiempo real. Los nodos crecen y cambian de color según la actividad acumulada.")} />}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
      <Panel title={L("Real-time activity", "Actividad en tiempo real")} tag={running ? "● streaming" : L("paused", "pausado")} h={460}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => setRunning(r => !r)} style={{ fontSize: 11.5, fontWeight: 600, color: running ? PAL.bad : PAL.good, background: PAL.panel, border: `1px solid ${running ? PAL.bad : PAL.good}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: FONT }}>{running ? L("Pause stream", "Pausar stream") : L("Resume", "Reanudar")}</button>
          {metrics.map(m => <button key={m.k} onClick={() => setMetric(m.k)} style={{ fontSize: 11.5, fontWeight: 500, color: metric === m.k ? "#fff" : PAL.sub, background: metric === m.k ? PAL.indigo : PAL.panel2, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: FONT, textTransform: "capitalize" }}>{L(m.en, m.es)}</button>)}
        </div>
        <div style={{ position: "relative", width: "100%", height: 360, background: "radial-gradient(circle at 50% 40%, #F0F4FA, #F6F7F9)", borderRadius: 12, overflow: "hidden", border: `1px solid ${PAL.line}` }}>
          <svg viewBox="0 0 100 90" style={{ width: "100%", height: "100%" }}>
            {/* grid sutil */}
            {Array.from({ length: 10 }).map((_, i) => <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="90" stroke="#E7E9EE" strokeWidth="0.2" />)}
            {Array.from({ length: 9 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#E7E9EE" strokeWidth="0.2" />)}
            {/* conexiones entre nodos activos */}
            {nodes.filter(n => n.pulse > 70).map((n, i, arr) => i < arr.length - 1 && <line key={n.id} x1={n.x} y1={n.y} x2={arr[i + 1].x} y2={arr[i + 1].y} stroke={PAL.d1} strokeWidth="0.3" strokeDasharray="1 1" opacity="0.4" />)}
            {/* pings animados */}
            {pings.map(p => <circle key={p.id} cx={p.x} cy={p.y} r="1" fill={p.c}>
              <animate attributeName="r" from="1" to="6" dur="1.4s" /><animate attributeName="opacity" from="0.9" to="0" dur="1.4s" /></circle>)}
            {/* nodos */}
            {nodes.map(n => <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={1.6 + n.pulse / 28} fill={nodeColor(n.pulse)} opacity="0.85" stroke="#fff" strokeWidth="0.4" />
              <text x={n.x} y={n.y - 2.2 - n.pulse / 28} textAnchor="middle" fontSize="2.4" fontWeight="700" fill="#1A1D23" fontFamily="Inter">{n.id}</text>
            </g>)}
          </svg>
          <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 10, color: PAL.sub, display: "flex", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: PAL.d1 }} />{L("High", "Alta")}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: PAL.d3 }} />{L("Medium", "Media")}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: PAL.d4 }} />{L("Low", "Baja")}</span>
          </div>
        </div>
      </Panel>
      <Panel title={L("Event feed", "Feed de eventos")} tag="live" h={460}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, overflow: "hidden" }}>
          {feed.length === 0 && <div style={{ fontSize: 12, color: PAL.sub, textAlign: "center", marginTop: 20 }}>{L("Waiting for events…", "Esperando eventos…")}</div>}
          {feed.map((e, i) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 11px", background: i === 0 ? `${PAL.indigo}0D` : PAL.panel2, borderRadius: 9, fontSize: 12, transition: "background .3s" }}>
              <div><div style={{ fontWeight: 600 }}>{e.city}</div><div style={{ fontSize: 10, color: PAL.sub }}>{e.t}</div></div>
              <div style={{ fontWeight: 700, color: e.amt > 600 ? PAL.magenta : e.amt > 300 ? PAL.indigo : PAL.teal }}>+${e.amt}</div>
            </div>))}
        </div>
      </Panel>
    </div>
  </div>;
}

// ---------- 2) MICRO-ESTUDIOS DE MERCADO INMEDIATOS ----------
const studyTemplates = [
  {
    topic: { en: "Expansion to a new segment", es: "Expansión a nuevo segmento" },
    verdict: { en: "High opportunity", es: "Oportunidad alta" }, vc: PAL.good, score: 82,
    findings: [
      { k: { en: "Market size (TAM)", es: "Tamaño de mercado (TAM)" }, v: "$340M", trend: { en: "+12% annually", es: "+12% anual" }, good: true },
      { k: { en: "Current penetration", es: "Penetración actual" }, v: "3.2%", trend: { en: "ample headroom", es: "headroom amplio" }, good: true },
      { k: { en: "Estimated CAC", es: "CAC estimado" }, v: "$210", trend: { en: "−18% vs current channel", es: "−18% vs canal actual" }, good: true },
      { k: { en: "Direct competition", es: "Competencia directa" }, v: { en: "4 players", es: "4 players" }, trend: { en: "none dominant", es: "ninguno dominante" }, good: true },
    ],
    bars: [{ n: { en: "Your segment", es: "Tu segmento" }, v: 82, c: PAL.d1 }, { n: { en: "Adjacent A", es: "Adyacente A" }, v: 64, c: PAL.d2 }, { n: { en: "Adjacent B", es: "Adyacente B" }, v: 47, c: PAL.d3 }, { n: { en: "Saturated", es: "Saturado" }, v: 28, c: PAL.d6 }],
    rec: { en: "The SMB services segment has the best opportunity/competition ratio. Recommendation: a 90-day pilot with a capped budget before scaling.", es: "El segmento de PYMEs de servicios tiene el mejor ratio oportunidad/competencia. Recomendación: piloto de 90 días con presupuesto acotado antes de escalar." },
  },
  {
    topic: { en: "Price sensitivity", es: "Sensibilidad al precio" },
    verdict: { en: "Room to raise", es: "Margen para subir" }, vc: PAL.good, score: 71,
    findings: [
      { k: { en: "Estimated elasticity", es: "Elasticidad estimada" }, v: "−0.6", trend: { en: "inelastic", es: "inelástico" }, good: true },
      { k: { en: "Modeled optimal price", es: "Precio óptimo modelado" }, v: { en: "$59/mo", es: "$59/mes" }, trend: { en: "+18% vs current", es: "+18% vs actual" }, good: true },
      { k: { en: "Projected churn", es: "Churn proyectado" }, v: "+1.2pts", trend: { en: "absorbable", es: "absorbible" }, good: false },
      { k: { en: "Net revenue", es: "Ingreso neto" }, v: "+$1.4M ARR", trend: { en: "after adjustment", es: "tras ajuste" }, good: true },
    ],
    bars: [{ n: { en: "$39 (current)", es: "$39 (actual)" }, v: 100, c: PAL.d3 }, { n: { en: "$49", es: "$49" }, v: 118, c: PAL.d2 }, { n: { en: "$59 (optimal)", es: "$59 (óptimo)" }, v: 132, c: PAL.d1 }, { n: { en: "$69", es: "$69" }, v: 121, c: PAL.d6 }],
    rec: { en: "The model suggests stepping up to $59. Demand is inelastic in your premium segment; the incremental churn is offset 11x by the additional revenue.", es: "El modelo sugiere subir a $59 escalonadamente. La demanda es inelástica en tu segmento premium; el churn incremental se compensa 11x con el ingreso adicional." },
  },
  {
    topic: { en: "Competitive risk", es: "Riesgo competitivo" },
    verdict: { en: "Active monitoring", es: "Vigilancia activa" }, vc: PAL.warn, score: 58,
    findings: [
      { k: { en: "New entrants (12m)", es: "Nuevos entrantes (12m)" }, v: "3", trend: { en: "one with $40M funding", es: "uno con $40M funding" }, good: false },
      { k: { en: "Feature overlap", es: "Solapamiento de features" }, v: "64%", trend: { en: "growing", es: "creciente" }, good: false },
      { k: { en: "Retention advantage", es: "Ventaja de retención" }, v: "+22pts NRR", trend: { en: "your moat", es: "tu foso" }, good: true },
      { k: { en: "Switching cost", es: "Switching cost" }, v: { en: "High", es: "Alto" }, trend: { en: "deep integrations", es: "integraciones profundas" }, good: true },
    ],
    bars: [{ n: { en: "Your retention", es: "Tu retención" }, v: 88, c: PAL.d1 }, { n: { en: "Competitor X", es: "Competidor X" }, v: 71, c: PAL.d3 }, { n: { en: "Competitor Y", es: "Competidor Y" }, v: 66, c: PAL.d4 }, { n: { en: "New entrant", es: "Nuevo entrante" }, v: 52, c: PAL.d6 }],
    rec: { en: "Your moat is retention and switching cost, not features. Recommendation: deepen integrations rather than compete on feature parity.", es: "Tu foso es la retención y el switching cost, no las features. Recomendación: profundizar integraciones antes que competir en paridad de features." },
  },
];
function MicroStudyView() {
  const { L } = useSession();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const run = (tpl) => {
    setTopic(tpl.topic.en); setLoading(true); setResult(null);
    setTimeout(() => { setResult(tpl); setLoading(false); }, 1400);
  };
  return <div>
    <H1 title={L("Market micro-studies", "Micro-estudios de mercado")} sub={L("Instant strategic analysis. Pick a business question and the engine generates the study with data, a verdict and a recommendation.", "Análisis estratégico al instante. Elige una pregunta de negocio y el motor genera el estudio con datos, veredicto y recomendación.")} />
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
      {studyTemplates.map(tpl => (
        <button key={tpl.topic.en} onClick={() => run(tpl)} style={{ fontSize: 13, fontWeight: 600, color: topic === tpl.topic.en ? "#fff" : PAL.text, background: topic === tpl.topic.en ? PAL.indigo : PAL.panel, border: `1px solid ${topic === tpl.topic.en ? PAL.indigo : PAL.line}`, borderRadius: 10, padding: "11px 18px", cursor: "pointer", fontFamily: FONT }}>{L(tpl.topic.en, tpl.topic.es)}</button>))}
    </div>
    {loading && <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: 50, textAlign: "center" }}>
      <div style={{ display: "inline-block", width: 28, height: 28, border: `3px solid ${PAL.line}`, borderTopColor: PAL.indigo, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ marginTop: 14, fontSize: 13, color: PAL.sub }}>{L("Analyzing market, competition and internal data…", "Analizando mercado, competencia y datos internos…")}</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>}
    {result && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ gridColumn: "span 2", background: PAL.panel, border: `1px solid ${PAL.line}`, borderLeft: `4px solid ${result.vc}`, borderRadius: 14, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 11.5, color: PAL.sub, textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 600 }}>{L("Engine verdict", "Veredicto del motor")}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: result.vc, marginTop: 4 }}>{L(result.verdict.en, result.verdict.es)}</div></div>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-1px", color: result.vc }}>{result.score}</div>
          <div style={{ fontSize: 10.5, color: PAL.sub }}>score / 100</div></div>
      </div>
      <Panel title={L("Key findings", "Hallazgos clave")} tag={L("data", "datos")} h={280}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {result.findings.map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < result.findings.length - 1 ? `1px solid ${PAL.line}` : "none", paddingBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: PAL.sub }}>{L(f.k.en, f.k.es)}</span>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, fontWeight: 700 }}>{typeof f.v === "string" ? f.v : L(f.v.en, f.v.es)}</div>
                <div style={{ fontSize: 10.5, color: f.good ? PAL.good : PAL.warn }}>{L(f.trend.en, f.trend.es)}</div></div>
            </div>))}
        </div>
      </Panel>
      <Panel title={L("Modeled comparison", "Comparativa modelada")} tag={L("scenarios", "escenarios")} h={280}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={result.bars.map((b) => ({ ...b, n: L(b.n.en, b.n.es) }))} margin={{ top: 10, right: 10, bottom: 30, left: -16 }}>
            <CartesianGrid vertical={false} stroke={PAL.line} />
            <XAxis dataKey="n" tick={{ fontSize: 10, fill: PAL.sub }} angle={-15} textAnchor="end" height={50} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: PAL.sub }} />
            <Tooltip content={<TipBox />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
            <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive={true}>{result.bars.map((b, i) => <Cell key={i} fill={b.c} />)}</Bar>
          </BarChart></ResponsiveContainer>
      </Panel>
      <div style={{ gridColumn: "span 2", background: `${result.vc}0D`, border: `1px solid ${result.vc}40`, borderRadius: 14, padding: "16px 20px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: result.vc, marginBottom: 6 }}>{L("Recommendation", "Recomendación")}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{L(result.rec.en, result.rec.es)}</div>
      </div>
    </div>}
    {!result && !loading && <div style={{ background: PAL.panel, border: `1px dashed ${PAL.line}`, borderRadius: 14, padding: 50, textAlign: "center", color: PAL.sub, fontSize: 13 }}>{L("Pick a business question above to generate a micro-study.", "Elige una pregunta de negocio arriba para generar un micro-estudio.")}</div>}
  </div>;
}

// ---------- 3) TABLA MULTIDIMENSIONAL (PIVOTE) ----------
const pivotRaw = [];
const regions = ["Norte", "Sur", "Este", "Oeste"];
const segs = ["Premium", "VIP", "Core", "Growth"];
const chans = ["Organic", "Paid", "Referral"];
let seed = 7;
const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
regions.forEach(r => segs.forEach(s => chans.forEach(c => {
  pivotRaw.push({ region: r, seg: s, chan: c, revenue: Math.round(20 + rng() * 480), accounts: Math.round(5 + rng() * 95), churn: +(2 + rng() * 12).toFixed(1) });
})));
const DIMS = [{ k: "region", l: { en: "Region", es: "Región" } }, { k: "seg", l: { en: "Segment", es: "Segmento" } }, { k: "chan", l: { en: "Channel", es: "Canal" } }];
const MEASURES = [{ k: "revenue", l: { en: "Revenue", es: "Ingreso" }, fmt: (v) => `$${v}K`, agg: "sum" }, { k: "accounts", l: { en: "Accounts", es: "Cuentas" }, fmt: (v) => v, agg: "sum" }, { k: "churn", l: { en: "Churn %", es: "Churn %" }, fmt: (v) => `${v.toFixed(1)}%`, agg: "avg" }];

function PivotView() {
  const { L } = useSession();
  // Localiza los VALORES de dimensión (las regiones están en español en los datos).
  const locVal = (v) => L({ Norte: "North", Sur: "South", Este: "East", Oeste: "West" }[v] || v, v);
  const [rowDim, setRowDim] = useState("region");
  const [colDim, setColDim] = useState("seg");
  const [measure, setMeasure] = useState("revenue");
  const [expanded, setExpanded] = useState({});

  const meas = MEASURES.find(m => m.k === measure);
  const rowVals = [...new Set(pivotRaw.map(d => d[rowDim]))];
  const colVals = [...new Set(pivotRaw.map(d => d[colDim]))];

  const aggregate = (rows) => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((a, d) => a + d[measure], 0);
    return meas.agg === "avg" ? sum / rows.length : sum;
  };
  const cellVal = (rv, cv) => aggregate(pivotRaw.filter(d => d[rowDim] === rv && d[colDim] === cv));
  const rowTotal = (rv) => aggregate(pivotRaw.filter(d => d[rowDim] === rv));
  const colTotal = (cv) => aggregate(pivotRaw.filter(d => d[colDim] === cv));
  const grandTotal = aggregate(pivotRaw);

  const allCells = rowVals.flatMap(rv => colVals.map(cv => cellVal(rv, cv)));
  const maxCell = Math.max(...allCells);
  const heatBg = (v) => measure === "churn"
    ? `rgba(239,68,68,${0.08 + (v / 14) * 0.62})`
    : `rgba(99,102,241,${0.06 + (v / maxCell) * 0.66})`;

  const thirdDim = DIMS.find(d => d.k !== rowDim && d.k !== colDim).k;

  return <div>
    <H1 title={L("Multidimensional table", "Tabla multidimensional")} sub={L("Pivot any dimension against another, change the metric and drill down. A real pivot table, not an image.", "Pivota cualquier dimensión contra otra, cambia la métrica y haz drill-down. Tabla dinámica real, no una imagen.")} />
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
      <div><div style={{ fontSize: 10.5, color: PAL.sub, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{L("Rows", "Filas")}</div>
        <select value={rowDim} onChange={e => setRowDim(e.target.value)} style={selStyle}>{DIMS.filter(d => d.k !== colDim).map(d => <option key={d.k} value={d.k}>{L(d.l.en, d.l.es)}</option>)}</select></div>
      <div><div style={{ fontSize: 10.5, color: PAL.sub, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{L("Columns", "Columnas")}</div>
        <select value={colDim} onChange={e => setColDim(e.target.value)} style={selStyle}>{DIMS.filter(d => d.k !== rowDim).map(d => <option key={d.k} value={d.k}>{L(d.l.en, d.l.es)}</option>)}</select></div>
      <div><div style={{ fontSize: 10.5, color: PAL.sub, marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{L("Metric", "Métrica")}</div>
        <select value={measure} onChange={e => setMeasure(e.target.value)} style={selStyle}>{MEASURES.map(m => <option key={m.k} value={m.k}>{L(m.l.en, m.l.es)}</option>)}</select></div>
      <div style={{ fontSize: 11.5, color: PAL.sub, paddingBottom: 9 }}>{L("Click a row to drill down by", "Clic en una fila para drill-down por")} <strong style={{ color: PAL.text }}>{(() => { const d = DIMS.find(d => d.k === thirdDim); return L(d.l.en, d.l.es); })()}</strong></div>
    </div>
    <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
        <thead><tr style={{ background: PAL.panel2 }}>
          <th style={{ ...thStyle, textAlign: "left" }}>{(() => { const d = DIMS.find(d => d.k === rowDim); return L(d.l.en, d.l.es); })()}</th>
          {colVals.map(cv => <th key={cv} style={thStyle}>{locVal(cv)}</th>)}
          <th style={{ ...thStyle, background: `${PAL.indigo}10` }}>Total</th>
        </tr></thead>
        <tbody>
          {rowVals.map(rv => (<React.Fragment key={rv}>
            <tr onClick={() => setExpanded(e => ({ ...e, [rv]: !e[rv] }))} style={{ cursor: "pointer", borderTop: `1px solid ${PAL.line}` }}>
              <td style={{ ...tdStyle, fontWeight: 600, textAlign: "left" }}><span style={{ display: "inline-block", width: 14, color: PAL.sub }}>{expanded[rv] ? "▾" : "▸"}</span>{locVal(rv)}</td>
              {colVals.map(cv => { const v = cellVal(rv, cv); return <td key={cv} style={{ ...tdStyle, background: heatBg(v), fontWeight: 500 }}>{meas.fmt(v)}</td>; })}
              <td style={{ ...tdStyle, fontWeight: 700, background: `${PAL.indigo}08` }}>{meas.fmt(rowTotal(rv))}</td>
            </tr>
            {expanded[rv] && [...new Set(pivotRaw.map(d => d[thirdDim]))].map(tv => (
              <tr key={tv} style={{ background: PAL.panel2 }}>
                <td style={{ ...tdStyle, textAlign: "left", paddingLeft: 32, color: PAL.sub, fontSize: 11.5 }}>{(() => { const d = DIMS.find(d => d.k === thirdDim); return L(d.l.en, d.l.es); })()}: {locVal(tv)}</td>
                {colVals.map(cv => { const v = aggregate(pivotRaw.filter(d => d[rowDim] === rv && d[colDim] === cv && d[thirdDim] === tv)); return <td key={cv} style={{ ...tdStyle, color: PAL.sub, fontSize: 11.5 }}>{meas.fmt(v)}</td>; })}
                <td style={{ ...tdStyle, color: PAL.sub, fontSize: 11.5 }}>{meas.fmt(aggregate(pivotRaw.filter(d => d[rowDim] === rv && d[thirdDim] === tv)))}</td>
              </tr>))}
          </React.Fragment>))}
          <tr style={{ borderTop: `2px solid ${PAL.line}`, background: `${PAL.indigo}08` }}>
            <td style={{ ...tdStyle, fontWeight: 700, textAlign: "left" }}>Total</td>
            {colVals.map(cv => <td key={cv} style={{ ...tdStyle, fontWeight: 700 }}>{meas.fmt(colTotal(cv))}</td>)}
            <td style={{ ...tdStyle, fontWeight: 800, color: PAL.indigo }}>{meas.fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
    <div style={{ marginTop: 12, fontSize: 11.5, color: PAL.sub }}>{L("Showing", "Mostrando")} <strong style={{ color: PAL.text }}>{L(meas.l.en, meas.l.es)}</strong> · {rowVals.length}×{colVals.length} {L("cells", "celdas")} · {L(`${pivotRaw.length} records aggregated live`, `${pivotRaw.length} registros agregados en vivo`)}</div>
  </div>;
}
const selStyle = { fontSize: 13, padding: "9px 14px", borderRadius: 9, border: "1px solid #E7E9EE", background: "#fff", fontFamily: '"Inter", sans-serif', cursor: "pointer", minWidth: 140 };
const thStyle = { padding: "12px 14px", fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".3px", textAlign: "center" };
const tdStyle = { padding: "11px 14px", textAlign: "center", color: "#1A1D23" };


/* =================== ANÁLISIS DE RED & CLUSTERING =================== */

// Genera clusters de clientes con física de fuerza (force-directed layout precalculado)
function buildGraph() {
  const clusterBase = [
    { id: 0, name: "Power Users", cx: 30, cy: 32, n: 16 },
    { id: 1, name: "Enterprise", cx: 70, cy: 28, n: 14 },
    { id: 2, name: "Growth SMB", cx: 40, cy: 68, n: 18 },
    { id: 3, name: "At-Risk", cx: 68, cy: 70, n: 11 },
    { id: 4, name: "New / Trial", cx: 22, cy: 58, n: 13 },
    { id: 5, name: "Dormant", cx: 82, cy: 50, n: 9 },
  ];
  const clusters = clusterBase.map((c, i) => ({ ...c, color: rampColor(i, clusterBase.length) }));
  let s = 42; const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const nodes = []; let nid = 0;
  clusters.forEach(c => {
    for (let i = 0; i < c.n; i++) {
      const ang = rng() * Math.PI * 2, rad = rng() * 11 + 1.5;
      nodes.push({ id: nid++, cluster: c.id, color: c.color,
        x: c.cx + Math.cos(ang) * rad, y: c.cy + Math.sin(ang) * rad,
        size: 0.7 + rng() * 1.8, val: Math.round(2 + rng() * 48) });
    }
  });
  // aristas: intra-cluster densas, inter-cluster escasas
  const edges = [];
  nodes.forEach((a, i) => nodes.forEach((b, j) => {
    if (j <= i) return;
    const same = a.cluster === b.cluster;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (same && dist < 9 && rng() < 0.5) edges.push({ a: i, b: j, color: a.color, w: 0.18 });
    else if (!same && dist < 16 && rng() < 0.06) edges.push({ a: i, b: j, color: "#C4C9D4", w: 0.1 });
  }));
  return { clusters, nodes, edges };
}
const GRAPH = buildGraph();

function NetworkGraph({ highlight, setHighlight }) {
  return <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
    {GRAPH.edges.map((e, i) => { const a = GRAPH.nodes[e.a], b = GRAPH.nodes[e.b];
      const dim = highlight != null && a.cluster !== highlight && b.cluster !== highlight;
      return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.color} strokeWidth={e.w} opacity={dim ? 0.04 : 0.5} />; })}
    {GRAPH.nodes.map(n => { const dim = highlight != null && n.cluster !== highlight;
      return <circle key={n.id} cx={n.x} cy={n.y} r={n.size} fill={n.color} stroke="#fff" strokeWidth={0.25}
        opacity={dim ? 0.15 : 0.95} style={{ transition: "opacity .2s", cursor: "pointer" }}
        onMouseEnter={() => setHighlight(n.cluster)} onMouseLeave={() => setHighlight(null)} />; })}
  </svg>;
}

// Clustering 2D (proyección tipo UMAP/t-SNE) — segmentos descubiertos por el modelo
function buildClusters2D() {
  let s = 99; const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const centerBase = [
    { x: 0.2, y: 2.9, n: 18 }, { x: 2.4, y: 2.2, n: 16 },
    { x: -0.6, y: -1.0, n: 22 }, { x: -0.4, y: 0.9, n: 14 },
    { x: -2.4, y: 1.0, n: 13 }, { x: 2.0, y: -0.9, n: 17 },
    { x: 0.9, y: -0.6, n: 12 },
  ];
  const centers = centerBase.map((c, i) => ({ ...c, c: rampColor(i, centerBase.length) }));
  const pts = [];
  centers.forEach(ct => { for (let i = 0; i < ct.n; i++) {
    pts.push({ x: +(ct.x + (rng() - 0.5) * 1.0).toFixed(2), y: +(ct.y + (rng() - 0.5) * 0.9).toFixed(2), c: ct.c }); } });
  return pts;
}
const CLUSTERS2D = buildClusters2D();

function NetworkView() {
  const { L } = useSession();
  const [highlight, setHighlight] = useState(null);
  return <div>
    <H1 title={L("Network analysis & clustering", "Análisis de red & clustering")} sub={L("Segments discovered by the model, not hand-defined. Customers that behave alike cluster together; the connections reveal communities.", "Segmentos descubiertos por el modelo, no definidos a mano. Los clientes que se comportan parecido se agrupan; las conexiones revelan comunidades.")} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Panel title={L("Customer relationship graph", "Grafo de relaciones de clientes")} tag={L("force-directed · communities", "force-directed · comunidades")} h={420}>
        <div style={{ position: "relative", height: "100%" }}>
          <NetworkGraph highlight={highlight} setHighlight={setHighlight} />
        </div>
      </Panel>
      <Panel title={L("Cluster projection", "Proyección de clusters")} tag={L("UMAP 2D · auto segments", "UMAP 2D · segmentos auto")} h={420}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 16, left: 0 }}>
            <CartesianGrid stroke={PAL.line} />
            <XAxis type="number" dataKey="x" tick={{ fontSize: 9.5, fill: PAL.sub }} domain={[-3, 3.2]} label={{ value: L("Component 1", "Componente 1"), position: "bottom", offset: -2, style: { fontSize: 9.5, fill: PAL.sub } }} />
            <YAxis type="number" dataKey="y" tick={{ fontSize: 9.5, fill: PAL.sub }} domain={[-2.5, 3.6]} label={{ value: L("Component 2", "Componente 2"), angle: -90, position: "insideLeft", style: { fontSize: 9.5, fill: PAL.sub } }} />
            <Scatter data={CLUSTERS2D} isAnimationActive={false}>{CLUSTERS2D.map((p, i) => <Cell key={i} fill={p.c} fillOpacity={0.75} stroke={p.c} />)}</Scatter>
          </ScatterChart></ResponsiveContainer>
      </Panel>
    </div>
    <div className="cardrow" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginTop: 14 }}>
      {GRAPH.clusters.map(c => {
        const tot = GRAPH.nodes.filter(n => n.cluster === c.id).reduce((a, n) => a + n.val, 0);
        return <div key={c.id} onMouseEnter={() => setHighlight(c.id)} onMouseLeave={() => setHighlight(null)}
          style={{ background: PAL.panel, border: `1px solid ${highlight === c.id ? c.color : PAL.line}`, borderRadius: 12, padding: 14, cursor: "pointer", transition: "border-color .2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color }} />
            <span style={{ fontSize: 11.5, fontWeight: 600 }}>{c.name}</span></div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.5px" }}>{c.n}</div>
          <div style={{ fontSize: 10.5, color: PAL.sub }}>{L("accounts", "cuentas")} · ${tot}K CLV</div>
        </div>;
      })}
    </div>
    <div style={{ marginTop: 14, background: `${PAL.indigo}0D`, border: `1px solid ${PAL.indigo}40`, borderRadius: 12, padding: "14px 18px", fontSize: 13, lineHeight: 1.55 }}>
      <strong style={{ color: PAL.indigo }}>{L("Model reading:", "Lectura del modelo:")}</strong> {L(<>clustering detected 6 natural communities. The <span style={{ color: PAL.bad, fontWeight: 600 }}>At-Risk</span> cluster has weak connections to the rest — isolated accounts that stopped interacting with your product. The <span style={{ color: PAL.d2, fontWeight: 600 }}>Enterprise</span> cluster is densely connected: high cohesion, low collective churn risk.</>, <>el clustering detectó 6 comunidades naturales. El cluster <span style={{ color: PAL.bad, fontWeight: 600 }}>At-Risk</span> tiene conexiones débiles con el resto — son cuentas aisladas que dejaron de interactuar con tu producto. El cluster <span style={{ color: PAL.d2, fontWeight: 600 }}>Enterprise</span> está densamente conectado: alta cohesión, bajo riesgo de churn colectivo.</>)}</div>
  </div>;
}

/* =================== OVERVIEW (dashboard original) =================== */
// Panel destacado: Revenue at Risk + plan de retención → dataset.retentionPlan (lib/synth.js)
function RevenueAtRiskPanel() {
  const { dataset, L } = useSession();
  const { retentionPlan, revenueAtRisk } = dataset;
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const totalRecover = retentionPlan.reduce((a, p) => a + p.impact, 0);
  const generate = () => { setLoading(true); setTimeout(() => { setLoading(false); setGenerated(true); }, 1100); };
  return <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: PAL.bad }} />
          <span style={{ fontSize: FS.h2, fontWeight: 600 }}>Revenue at Risk</span></div>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.5px", marginTop: 8 }}>{revenueAtRisk.totalLabel} <span style={{ fontSize: FS.body, fontWeight: 600, color: PAL.bad }}>{L(`in CLV across ${revenueAtRisk.accounts} accounts`, `en CLV de ${revenueAtRisk.accounts} cuentas`)}</span></div>
        <div style={{ fontSize: FS.body, color: PAL.sub, marginTop: 4 }}>{L("Concentrated in 3 segments. The model can propose a retention plan prioritized by impact.", "Concentrado en 3 segmentos. El modelo puede proponer un plan de retención priorizado por impacto.")}</div>
      </div>
      {!generated && <button onClick={generate} disabled={loading} style={{ flexShrink: 0, fontSize: FS.body, fontWeight: 600, color: "#fff", background: loading ? PAL.sub : PAL.brand, border: "none", borderRadius: 10, padding: "12px 20px", cursor: loading ? "default" : "pointer", fontFamily: FONT }}>
        {loading ? L("Generating plan…", "Generando plan…") : L("Generate retention plan", "Generar plan de retención")}</button>}
    </div>
    {loading && <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, color: PAL.sub, fontSize: FS.body }}>
      <span style={{ display: "inline-block", width: 18, height: 18, border: `2.5px solid ${PAL.line}`, borderTopColor: PAL.brand, borderRadius: "50%", animation: "vspin .8s linear infinite" }} />
      {L("Prioritizing segments by CLV at risk and intervention cost…", "Priorizando segmentos por CLV en riesgo y costo de intervención…")}
      <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style></div>}
    {generated && <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: FS.label, fontWeight: 700, color: PAL.sub, textTransform: "uppercase", letterSpacing: ".4px" }}>{L("Prioritized retention plan", "Plan de retención priorizado")}</span>
        <span style={{ fontSize: FS.body, color: PAL.good, fontWeight: 700 }}>{L(`Est. recovery: +$${totalRecover}K CLV`, `Recuperación estimada: +$${totalRecover}K CLV`)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {retentionPlan.map((p, i) => (
          <div key={i} style={{ border: `1px solid ${PAL.line}`, borderLeft: `3px solid ${p.color}`, borderRadius: 10, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: FS.body, fontWeight: 600 }}>{p.seg} <span style={{ fontSize: FS.label, color: PAL.sub, fontWeight: 400 }}>{L(`· ${p.accounts} accounts · $${p.clv}K CLV`, `· ${p.accounts} cuentas · $${p.clv}K CLV`)}</span></div>
              <div style={{ fontSize: FS.body, color: PAL.text, marginTop: 3 }}>{p.action}</div>
              <div style={{ fontSize: FS.label, color: PAL.sub, marginTop: 4 }}>{L(`Effort: ${p.effort} · Window: ${p.window}`, `Esfuerzo: ${p.effort} · Ventana: ${p.window}`)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: PAL.good }}>+${p.impact}K</div>
              <div style={{ fontSize: 10, color: PAL.sub }}>{L("recoverable", "recuperable")}</div>
            </div>
          </div>))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={() => { window.location.hash = "/simulador"; }} style={{ fontSize: FS.body, fontWeight: 600, color: "#fff", background: PAL.brand, border: "none", borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontFamily: FONT }}>{L("Simulate ARR impact", "Simular impacto en ARR")}</button>
        <button style={{ fontSize: FS.body, fontWeight: 600, color: PAL.text, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontFamily: FONT }}>{L("Export to CRM", "Exportar al CRM")}</button>
        <button style={{ fontSize: FS.body, fontWeight: 600, color: PAL.text, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 10, padding: "10px 18px", cursor: "pointer", fontFamily: FONT }}>{L("Assign to team", "Asignar al equipo")}</button>
      </div>
    </div>}
  </div>;
}

function OverviewView() {
  const { dataset, company, L } = useSession();
  const { kpis } = dataset;
  return <div>
    <H1 title="Customer Intelligence" sub={`${company ? company + " · " : ""}${L("Churn prediction · CLV modeling · RFM & forecast", "Predicción de churn · Modelado de CLV · RFM & forecast")}`} />
    <div className="cardrow" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
      {kpis.map((k) => (
        <div key={k.label} style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: FS.label, color: PAL.sub, marginBottom: 8, fontWeight: 500 }}>{k.label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: FS.kpi, fontWeight: 700, letterSpacing: "-.5px" }}>{k.val}</span>
            <span style={{ fontSize: 11.5, color: k.good ? PAL.good : PAL.bad, fontWeight: 600 }}>{k.d}</span></div>
          <div style={{ marginTop: 8 }}><Spark data={k.spark} color={k.good ? PAL.good : PAL.bad} /></div></div>))}</div>
    <RevenueAtRiskPanel />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, alignItems: "start" }}>
      <Panel title={L("Churn by value segment", "Churn por segmento de valor")} tag="ridgeline" h={360}><Ridgeline /></Panel>
      <Panel title={L("Behavioral segmentation", "Segmentación conductual")} tag="boxplot" h={360}><BoxPlots /></Panel>
      <Panel title={L("Forecast & cycles — MRR", "Forecast & ciclos — MRR")} tag={L("projection + seasonality", "proyección + estacionalidad")} span={2} h={380}><Forecast /></Panel>
      <Panel title={L("CLV bridge by cohort", "CLV bridge por cohorte")} tag="waterfall" h={340}><Waterfall /></Panel>
      <Panel title={L("Value × risk matrix", "Matriz valor × riesgo")} tag="heatmap RFM" h={360}><Heatmap /></Panel>
      <Panel title={L("Demographic segmentation", "Segmentación demográfica")} tag={L("age cohorts", "cohortes de edad")} h={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={demo} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke={PAL.line} /><XAxis dataKey="age" tick={{ fontSize: 10, fill: PAL.sub }} /><YAxis domain={[0, "dataMax + 4"]} allowDecimals={false} tick={{ fontSize: 10, fill: PAL.sub }} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<TipBox unit="%" />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
            <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive={false}>{demo.map((d, i) => <Cell key={i} fill={rampColor(i, demo.length)} />)}</Bar>
          </BarChart></ResponsiveContainer></Panel>
      <Panel title={L("Psychographic profile", "Perfil psicográfico")} tag="radar" h={300}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={psycho.map((p) => ({ ...p, trait: L(p.trait.en, p.trait.es) }))} outerRadius="72%">
            <PolarGrid stroke={PAL.line} /><PolarAngleAxis dataKey="trait" tick={{ fontSize: 9.5, fill: PAL.sub }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name={L("High CLV", "Alto CLV")} dataKey="A" stroke={PAL.teal} fill={PAL.teal} fillOpacity={0.3} isAnimationActive={false} />
            <Radar name={L("At risk", "En riesgo")} dataKey="B" stroke={PAL.amber} fill={PAL.amber} fillOpacity={0.22} isAnimationActive={false} />
            <Tooltip content={<TipBox />} /></RadarChart></ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 9.5, color: PAL.sub, marginTop: 4 }}><Legend c={PAL.teal} t={L("High CLV", "Alto CLV")} /><Legend c={PAL.amber} t={L("At risk", "En riesgo")} /></div></Panel>
      <Panel title={L("Economic segmentation", "Segmentación económica")} tag={L("income × spend", "ingreso × gasto")} span={2} h={320}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 16, left: 0 }}>
            <CartesianGrid stroke={PAL.line} />
            <XAxis type="number" dataKey="income" name={L("Income", "Ingreso")} unit="k" tick={{ fontSize: 10, fill: PAL.sub }} label={{ value: L("Annual income ($K)", "Ingreso anual ($K)"), position: "bottom", offset: -2, style: { fontSize: 9.5, fill: PAL.sub } }} />
            <YAxis type="number" dataKey="spend" name={L("Spend", "Gasto")} tick={{ fontSize: 10, fill: PAL.sub }} label={{ value: L("Monthly spend ($)", "Gasto mensual ($)"), angle: -90, position: "insideLeft", style: { fontSize: 9.5, fill: PAL.sub } }} />
            <ZAxis type="number" dataKey="z" range={[40, 300]} /><Tooltip content={<TipBox />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={econ} isAnimationActive={false}>{econ.map((d, i) => <Cell key={i} fill={d.c} fillOpacity={0.55} stroke={d.c} strokeOpacity={0.9} />)}</Scatter>
          </ScatterChart></ResponsiveContainer></Panel></div></div>;
}

/* =================== VISTAS COMBINADAS (consolidan solapamientos) =================== */
function MapsView() {
  const { L } = useSession();
  return <div>
    <H1 title={L("Maps", "Mapas")} sub={L("Real-time geographic activity and revenue concentration by region.", "Actividad geográfica en tiempo real y concentración de ingreso por región.")} />
    <Tabs tabs={[
      { label: L("Live", "En vivo"), content: <IntelligentMap embedded /> },
      { label: L("Geo heatmap", "Calor geográfico"), content: <GeoView embedded /> },
    ]} />
  </div>;
}
function PulseView() {
  const { L } = useSession();
  return <div>
    <H1 title={L("Summary & Alerts", "Resumen & Alertas")} sub={L("What changed, why it matters and what needs action now.", "Qué cambió, por qué importa y qué requiere acción ahora.")} />
    <Tabs tabs={[
      { label: L("Executive summary", "Resumen ejecutivo"), content: <NarrativeView embedded /> },
      { label: L("Active alerts", "Alertas activas"), content: <AlertsView embedded /> },
    ]} />
  </div>;
}
function ConnectionsView() {
  const { L } = useSession();
  return <div>
    <H1 title={L("Connections", "Conexiones")} sub={L("Integrate external tools and embed the analytics into your own product.", "Integra herramientas externas y embebe la analítica en tu propio producto.")} />
    <Tabs tabs={[
      { label: L("Integrations & API", "Integraciones & API"), content: <IntegrationsView embedded /> },
      { label: "Embeddable", content: <EmbedView embedded /> },
    ]} />
  </div>;
}


/* =================== MÓDULO FINANCIERO =================== */

// ---- Datos base del P&L (proyección trimestral, en miles $) ----
const pnlQuarters = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"];
function buildPnL(startMrr = 480) {
  let mrr = startMrr; const rows = [];
  pnlQuarters.forEach((q, i) => {
    const grow = 1 + (0.13 - i * 0.006);          // crecimiento que se modera
    mrr = i === 0 ? mrr : mrr * grow;
    const revenue = mrr * 3;                        // ingreso trimestral
    const cogs = revenue * 0.22;                    // costo de servir
    const gross = revenue - cogs;
    const sm = revenue * 0.34;                      // ventas & marketing
    const rd = revenue * 0.18;                      // I+D
    const ga = revenue * 0.12;                      // G&A
    const ebitda = gross - sm - rd - ga;
    rows.push({ q, revenue: +revenue.toFixed(0), cogs: +cogs.toFixed(0), gross: +gross.toFixed(0),
      sm: +sm.toFixed(0), rd: +rd.toFixed(0), ga: +ga.toFixed(0), ebitda: +ebitda.toFixed(0),
      margin: +((ebitda / revenue) * 100).toFixed(1) });
  });
  return rows;
}
// ---- Monte Carlo: miles de trayectorias de ARR a 18 meses ----
function monteCarlo(runs, months, p) {
  // p: { startArr, growthMean, growthSd, churnMean, churnSd }
  const paths = [];
  let s = 1234;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const gauss = (m, sd) => { // Box-Muller
    const u1 = Math.max(rnd(), 1e-9), u2 = rnd();
    return m + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  for (let r = 0; r < runs; r++) {
    let arr = p.startArr; const path = [arr];
    for (let m = 1; m <= months; m++) {
      const g = gauss(p.growthMean, p.growthSd) / 100;
      const c = Math.max(0, gauss(p.churnMean, p.churnSd)) / 100;
      arr = Math.max(0, arr * (1 + g - c));
      path.push(arr);
    }
    paths.push(path);
  }
  // percentiles por mes
  const pct = (arr2, pp) => { const a = [...arr2].sort((x, y) => x - y); return a[Math.floor(pp * (a.length - 1))]; };
  const bands = [];
  for (let m = 0; m <= months; m++) {
    const col = paths.map(pa => pa[m]);
    bands.push({ m, p10: +pct(col, 0.1).toFixed(0), p50: +pct(col, 0.5).toFixed(0), p90: +pct(col, 0.9).toFixed(0),
      lo: +pct(col, 0.1).toFixed(0), range: +(pct(col, 0.9) - pct(col, 0.1)).toFixed(0) });
  }
  return { paths, bands };
}

// ---- Componente: P&L ----
function PnLTab() {
  const { dataset, L } = useSession();
  const PNL = useMemo(() => buildPnL(dataset.finance.startMrrK), [dataset.finance.startMrrK]);
  const lines = [
    { k: "revenue", l: L("Revenue", "Ingreso"), strong: true, c: PAL.text },
    { k: "cogs", l: "(−) COGS", c: PAL.sub },
    { k: "gross", l: L("Gross margin", "Margen bruto"), strong: true, c: PAL.d4 },
    { k: "sm", l: L("(−) Sales & Mkt", "(−) Ventas & Mkt"), c: PAL.sub },
    { k: "rd", l: L("(−) R&D", "(−) I+D"), c: PAL.sub },
    { k: "ga", l: "(−) G&A", c: PAL.sub },
    { k: "ebitda", l: "EBITDA", strong: true, c: PAL.brand },
  ];
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
      <Panel title={L("Revenue vs EBITDA trajectory", "Trayectoria ingreso vs EBITDA")} tag={L("8-quarter projection", "proyección 8 trimestres")} h={300}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={PNL} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
            <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PAL.brand} stopOpacity={0.25} /><stop offset="100%" stopColor={PAL.brand} stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={PAL.line} />
            <XAxis dataKey="q" tick={{ fontSize: FS.axis, fill: PAL.sub }} />
            <YAxis tick={{ fontSize: FS.axis, fill: PAL.sub }} tickFormatter={(v) => `$${(v/1000).toFixed(1)}M`} />
            <Tooltip content={<TipBox unit="k" />} />
            <Area dataKey="revenue" stroke={PAL.brand} strokeWidth={2.4} fill="url(#rev)" name={L("Revenue", "Ingreso")} isAnimationActive={false} />
            <Line dataKey="ebitda" stroke={PAL.d4} strokeWidth={2.4} dot={false} name="EBITDA" isAnimationActive={false} />
          </ComposedChart></ResponsiveContainer>
      </Panel>
      <Panel title={L("EBITDA margin", "Margen EBITDA")} tag={L("% of revenue", "% sobre ingreso")} h={300}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={PNL} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={PAL.line} />
            <XAxis dataKey="q" tick={{ fontSize: FS.axis, fill: PAL.sub }} />
            <YAxis tick={{ fontSize: FS.axis, fill: PAL.sub }} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<TipBox unit="%" />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
            <Bar dataKey="margin" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {PNL.map((d, i) => <Cell key={i} fill={d.margin >= 0 ? PAL.d4 : PAL.bad} />)}</Bar>
          </BarChart></ResponsiveContainer>
      </Panel>
    </div>
    <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div className="tablewrap" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: FS.body, minWidth: 640 }}>
        <thead><tr style={{ background: PAL.panel2 }}>
          <th style={{ padding: "11px 16px", textAlign: "left", fontSize: FS.label, fontWeight: 700, color: PAL.sub, textTransform: "uppercase", letterSpacing: ".3px" }}>{L("Income statement ($K)", "Estado de resultados ($K)")}</th>
          {PNL.map(r => <th key={r.q} style={{ padding: "11px 12px", textAlign: "right", fontSize: FS.label, fontWeight: 700, color: PAL.sub }}>{r.q}</th>)}
        </tr></thead>
        <tbody>
          {lines.map((ln, li) => (
            <tr key={ln.k} style={{ borderTop: `1px solid ${PAL.line}`, background: ln.strong ? PAL.panel2 : PAL.panel }}>
              <td style={{ padding: "10px 16px", textAlign: "left", fontWeight: ln.strong ? 700 : 400, color: ln.c }}>{ln.l}</td>
              {PNL.map(r => <td key={r.q} style={{ padding: "10px 12px", textAlign: "right", fontWeight: ln.strong ? 700 : 400, color: ln.k === "ebitda" ? (r.ebitda >= 0 ? PAL.d4 : PAL.bad) : PAL.text }}>{r[ln.k] < 0 ? `(${Math.abs(r[ln.k])})` : r[ln.k]}</td>)}
            </tr>))}
        </tbody>
      </table></div></div>
  </div>;
}

// ---- Componente: Runway ----
function RunwayTab() {
  const { L } = useSession();
  const [cash, setCash] = useState(4200);     // caja actual $K
  const [burn, setBurn] = useState(280);      // burn mensual $K
  const [growth, setGrowth] = useState(6);    // % mejora mensual del burn (hacia break-even)
  const proj = useMemo(() => {
    const rows = []; let c = cash, b = burn;
    for (let m = 0; m <= 24; m++) {
      rows.push({ m: `M${m}`, cash: +c.toFixed(0), burn: +b.toFixed(0) });
      b = b * (1 - growth / 100);              // el burn baja al acercarse a break-even
      c = c - b;
      if (c < 0) { rows.push({ m: `M${m+1}`, cash: 0, burn: +b.toFixed(0) }); break; }
    }
    return rows;
  }, [cash, burn, growth]);
  const zeroM = proj.findIndex(r => r.cash <= 0);
  const runwayMonths = zeroM === -1 ? "24+" : zeroM;
  const safe = runwayMonths === "24+" || runwayMonths >= 12;
  const Slider = ({ label, val, set, min, max, step, fmt }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: FS.body, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: PAL.brand }}>{fmt(val)}</span></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(+e.target.value)} style={{ width: "100%", accentColor: PAL.brand }} /></div>);
  return <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
    <Panel title={L("Cash assumptions", "Supuestos de caja")} tag={L("editable", "editable")} h={420}>
      <Slider label={L("Current cash", "Caja actual")} val={cash} set={setCash} min={500} max={10000} step={100} fmt={(v) => `$${(v/1000).toFixed(1)}M`} />
      <Slider label={L("Monthly burn", "Burn mensual")} val={burn} set={setBurn} min={50} max={800} step={10} fmt={(v) => `$${v}K`} />
      <Slider label={L("Burn improvement / mo", "Mejora de burn / mes")} val={growth} set={setGrowth} min={0} max={15} step={1} fmt={(v) => `${v}%`} />
      <div style={{ marginTop: 20, padding: 16, background: safe ? `${PAL.good}12` : `${PAL.bad}12`, borderRadius: 12, border: `1px solid ${safe ? PAL.good : PAL.bad}40` }}>
        <div style={{ fontSize: FS.label, color: PAL.sub }}>{L("Estimated runway", "Runway estimado")}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: safe ? PAL.good : PAL.bad, letterSpacing: "-1px" }}>{runwayMonths} <span style={{ fontSize: FS.body, fontWeight: 600 }}>{L("months", "meses")}</span></div>
        <div style={{ fontSize: FS.label, color: PAL.sub, marginTop: 2 }}>{safe ? L("Healthy zone (>12 months)", "Zona saludable (>12 meses)") : L("Heads up: raise capital or cut burn", "Atención: levanta capital o reduce burn")}</div></div>
    </Panel>
    <Panel title={L("Cash projection", "Proyección de caja")} tag={L("until runway runs out", "hasta agotar runway")} h={420}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={proj} margin={{ top: 10, right: 14, bottom: 0, left: -6 }}>
          <defs><linearGradient id="cashg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PAL.brand} stopOpacity={0.25} /><stop offset="100%" stopColor={PAL.brand} stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke={PAL.line} />
          <XAxis dataKey="m" tick={{ fontSize: FS.axis, fill: PAL.sub }} interval={2} />
          <YAxis tick={{ fontSize: FS.axis, fill: PAL.sub }} tickFormatter={(v) => `$${(v/1000).toFixed(1)}M`} />
          <Tooltip content={<TipBox unit="k" />} />
          <Area dataKey="cash" stroke={PAL.brand} strokeWidth={2.6} fill="url(#cashg)" name={L("Cash", "Caja")} isAnimationActive={false} />
          <Line dataKey="burn" stroke={PAL.warn} strokeWidth={2} dot={false} name={L("Monthly burn", "Burn mensual")} isAnimationActive={false} />
        </ComposedChart></ResponsiveContainer>
    </Panel>
  </div>;
}

// ---- Componente: Monte Carlo ----
function MonteCarloTab() {
  const { dataset, L } = useSession();
  const startArr = dataset.finance.startMrrK * 12;   // ARR inicial (escalado al MRR del usuario)
  const fmtArr = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}M` : `$${Math.round(v)}k`);
  const [growth, setGrowth] = useState(8);
  const [churn, setChurn] = useState(3);
  const [vol, setVol] = useState(4);
  const months = 18;
  const sim = useMemo(() => monteCarlo(400, months, {
    startArr, growthMean: growth, growthSd: vol, churnMean: churn, churnSd: vol * 0.6,
  }), [growth, churn, vol, startArr]);
  // muestra de 60 trayectorias para dibujar el "abanico"
  const sample = sim.paths.filter((_, i) => i % 7 === 0).slice(0, 60);
  const target = Math.round(startArr * 1.5625);   // objetivo ARR (~1.56× el inicial)
  const final = sim.paths.map(p => p[months]);
  const probTarget = (final.filter(v => v >= target).length / final.length * 100).toFixed(0);
  const W = 600, H = 280, padL = 44, padR = 12, padT = 12, padB = 24;
  const allMax = Math.max(...sim.bands.map(b => b.p90)) * 1.05;
  const px = (m) => padL + (m / months) * (W - padL - padR);
  const py = (v) => padT + (1 - v / allMax) * (H - padT - padB);
  const Slider = ({ label, val, set, min, max, step, fmt }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: FS.body, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: FS.body, fontWeight: 700, color: PAL.brand }}>{fmt(val)}</span></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(+e.target.value)} style={{ width: "100%", accentColor: PAL.brand }} /></div>);
  return <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
    <Panel title={L("Model assumptions", "Supuestos del modelo")} tag={L("400 simulations", "400 simulaciones")} h={420}>
      <Slider label={L("Avg monthly growth", "Crecimiento mensual medio")} val={growth} set={setGrowth} min={0} max={15} step={0.5} fmt={(v) => `${v}%`} />
      <Slider label={L("Avg monthly churn", "Churn mensual medio")} val={churn} set={setChurn} min={0} max={10} step={0.5} fmt={(v) => `${v}%`} />
      <Slider label={L("Volatility", "Volatilidad")} val={vol} set={setVol} min={1} max={10} step={0.5} fmt={(v) => `±${v}%`} />
      <div style={{ marginTop: 20, padding: 16, background: `${PAL.brand}10`, borderRadius: 12, border: `1px solid ${PAL.brand}40` }}>
        <div style={{ fontSize: FS.label, color: PAL.sub }}>{L(`Probability of exceeding ${fmtArr(target)} ARR in 18m`, `Probabilidad de superar ${fmtArr(target)} ARR en 18m`)}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: PAL.brand, letterSpacing: "-1px" }}>{probTarget}%</div>
        <div style={{ fontSize: FS.label, color: PAL.sub, marginTop: 2 }}>{L(`Projected median: $${(sim.bands[months].p50/1000).toFixed(1)}M`, `Mediana proyectada: $${(sim.bands[months].p50/1000).toFixed(1)}M`)}</div></div>
    </Panel>
    <Panel title={L("Scenario fan — ARR at 18 months", "Abanico de escenarios — ARR a 18 meses")} tag="Monte Carlo · P10–P90" h={420}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* banda P10-P90 */}
        <path d={`M ${sim.bands.map(b => `${px(b.m).toFixed(1)} ${py(b.p90).toFixed(1)}`).join(" L ")} L ${[...sim.bands].reverse().map(b => `${px(b.m).toFixed(1)} ${py(b.p10).toFixed(1)}`).join(" L ")} Z`} fill={PAL.brand} fillOpacity={0.1} />
        {/* trayectorias muestra */}
        {sample.map((p, i) => <polyline key={i} points={p.map((v, m) => `${px(m).toFixed(1)},${py(v).toFixed(1)}`).join(" ")} fill="none" stroke={PAL.brand} strokeWidth={0.4} opacity={0.18} />)}
        {/* mediana */}
        <polyline points={sim.bands.map(b => `${px(b.m).toFixed(1)},${py(b.p50).toFixed(1)}`).join(" ")} fill="none" stroke={PAL.brand} strokeWidth={2.6} />
        {/* línea objetivo */}
        <line x1={padL} y1={py(target)} x2={W - padR} y2={py(target)} stroke={PAL.d4} strokeWidth={1.2} strokeDasharray="4 3" />
        <text x={W - padR} y={py(target) - 4} textAnchor="end" fontSize={FS.axis} fill={PAL.d4} fontFamily="Inter">{L("Target", "Objetivo")} {fmtArr(target)}</text>
        {/* ejes */}
        {[0, 6, 12, 18].map(m => <text key={m} x={px(m)} y={H - 8} textAnchor="middle" fontSize={FS.axis} fill={PAL.sub} fontFamily="Inter">M{m}</text>)}
        {[0, allMax/2, allMax].map((v, i) => <text key={i} x={padL - 6} y={py(v) + 3} textAnchor="end" fontSize={FS.axis} fill={PAL.sub} fontFamily="Inter">${(v/1000).toFixed(0)}M</text>)}
      </svg>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: FS.axis, color: PAL.sub, marginTop: 6 }}>
        <Legend c={PAL.brand} t={L("Median (P50)", "Mediana (P50)")} /><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: PAL.brand, opacity: 0.2 }} />{L("P10–P90 band", "Banda P10–P90")}</span></div>
    </Panel>
  </div>;
}

// ---- Componente: Unit Economics ----
const unitData = [
  { k: { en: "CLV (lifetime value)", es: "CLV (valor de vida)" }, v: { en: "$3,580", es: "$3,580" }, good: true, note: { en: "BG/NBD + Gamma-Gamma", es: "BG/NBD + Gamma-Gamma" } },
  { k: { en: "CAC (acquisition cost)", es: "CAC (costo adquisición)" }, v: { en: "$830", es: "$830" }, good: true, note: { en: "channel mix", es: "mezcla de canales" } },
  { k: { en: "CLV : CAC ratio", es: "Ratio CLV : CAC" }, v: { en: "4.3 : 1", es: "4.3 : 1" }, good: true, note: { en: "healthy > 3:1", es: "sano > 3:1" } },
  { k: { en: "CAC payback", es: "CAC payback" }, v: { en: "11 months", es: "11 meses" }, good: true, note: { en: "target < 12m", es: "objetivo < 12m" } },
  { k: { en: "Contribution margin", es: "Margen de contribución" }, v: { en: "68%", es: "68%" }, good: true, note: { en: "after cost to serve", es: "tras costo de servir" } },
  { k: { en: "Per-customer break-even", es: "Break-even por cliente" }, v: { en: "Month 11", es: "Mes 11" }, good: true, note: { en: "break-even point", es: "punto de equilibrio" } },
];
const paybackCurve = Array.from({ length: 19 }, (_, m) => ({ m: `M${m}`, acum: +(-830 + m * 88).toFixed(0) }));
function UnitEconTab() {
  const { L } = useSession();
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
    <Panel title="Unit economics" tag={L("per customer", "por cliente")} h={360}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {unitData.map((u, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: i < unitData.length - 1 ? `1px solid ${PAL.line}` : "none", paddingBottom: 9 }}>
            <div><div style={{ fontSize: FS.body, fontWeight: 500 }}>{L(u.k.en, u.k.es)}</div><div style={{ fontSize: FS.label, color: PAL.sub }}>{L(u.note.en, u.note.es)}</div></div>
            <div style={{ fontSize: 17, fontWeight: 700, color: u.good ? PAL.d4 : PAL.bad }}>{L(u.v.en, u.v.es)}</div>
          </div>))}
      </div>
    </Panel>
    <Panel title={L("CAC payback curve", "Curva de payback del CAC")} tag={L("cumulative recovery", "recuperación acumulada")} h={360}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={paybackCurve} margin={{ top: 10, right: 14, bottom: 0, left: -2 }}>
          <CartesianGrid vertical={false} stroke={PAL.line} />
          <XAxis dataKey="m" tick={{ fontSize: FS.axis, fill: PAL.sub }} interval={2} />
          <YAxis tick={{ fontSize: FS.axis, fill: PAL.sub }} tickFormatter={(v) => `$${v}`} />
          <Tooltip content={<TipBox />} />
          <Line dataKey="acum" stroke={PAL.brand} strokeWidth={2.6} dot={false} name={L("Cumulative cash flow", "Flujo acumulado")} isAnimationActive={false} />
          <Line dataKey={() => 0} stroke={PAL.sub} strokeWidth={1} strokeDasharray="4 3" dot={false} name="Break-even" isAnimationActive={false} />
        </ComposedChart></ResponsiveContainer>
      <div style={{ fontSize: FS.axis, color: PAL.sub, marginTop: 4, textAlign: "center" }}>{L("The customer repays their CAC at month 11 and generates net value after that", "El cliente repaga su CAC en el mes 11 y genera valor neto después")}</div>
    </Panel>
  </div>;
}

// ---- Vista contenedora ----
function FinanceView() {
  const { L } = useSession();
  return <div>
    <H1 title={L("Financial modeling", "Modelado financiero")} sub={L("P&L, runway and scenarios. Information to decide — not investment advice.", "P&L, runway y escenarios. Información para decidir — no es consejo de inversión.")} />
    <Tabs tabs={[
      { label: L("Projected P&L", "P&L proyectado"), content: <PnLTab /> },
      { label: "Runway & burn", content: <RunwayTab /> },
      { label: "Monte Carlo", content: <MonteCarloTab /> },
      { label: "Unit economics", content: <UnitEconTab /> },
    ]} />
  </div>;
}

/* =================== CUENTA: CONFIGURACIÓN Y LOGOUT =================== */
function SettingsView() {
  const { email, userName, userInitials, company, lang, setLang, L } = useSession();
  const [tab, setTab] = useState(0);
  const Row = ({ label, desc, children }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${PAL.line}` }}>
      <div><div style={{ fontSize: FS.body, fontWeight: 500 }}>{label}</div><div style={{ fontSize: FS.label, color: PAL.sub, marginTop: 2 }}>{desc}</div></div>
      <div>{children}</div>
    </div>);
  const Toggle = ({ on }) => (
    <div style={{ width: 38, height: 22, borderRadius: 20, background: on ? PAL.brand : PAL.line, position: "relative", cursor: "pointer", transition: "background .2s" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: on ? 18 : 2, transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} /></div>);
  const sel = { fontSize: FS.body, padding: "8px 12px", borderRadius: 9, border: `1px solid ${PAL.line}`, background: PAL.panel, fontFamily: FONT, cursor: "pointer" };
  return <div>
    <H1 title={L("Settings", "Configuración")} sub={L("Your account, product preferences and notifications.", "Tu cuenta, preferencias del producto y notificaciones.")} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
      <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${PAL.brand}1A`, color: PAL.brand, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>{userInitials}</div>
          <div><div style={{ fontSize: 16, fontWeight: 600 }}>{userName}</div><div style={{ fontSize: FS.label, color: PAL.sub }}>{company ? L(`${company} · Full access`, `${company} · Acceso total`) : L("Full access", "Acceso total")}</div></div>
        </div>
        <Row label={L("Name", "Nombre")} desc={L("How you appear to the team", "Como apareces en el equipo")}><input key={userName} defaultValue={userName} style={{ ...sel, width: 160 }} /></Row>
        <Row label="Email" desc={L("For alerts and reports", "Para alertas y reportes")}><input key={email} defaultValue={email} style={{ ...sel, width: 200 }} /></Row>
        <Row label={L("Language", "Idioma")} desc={L("Interface language", "Idioma de la interfaz")}><select value={lang} onChange={(e) => setLang(e.target.value)} style={{ ...sel }}><option value="en">English</option><option value="es">Español</option></select></Row>
        <Row label={L("Time zone", "Zona horaria")} desc={L("For dates and reports", "Para fechas y reportes")}><select style={sel}><option>GMT-6 (CDMX)</option><option>GMT-5 (Bogotá)</option><option>GMT+1 (Madrid)</option></select></Row>
      </div>
      <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ fontSize: FS.h2, fontWeight: 600, marginBottom: 4 }}>{L("Preferences", "Preferencias")}</div>
        <Row label={L("Email notifications", "Notificaciones por email")} desc={L("Critical alerts to your inbox", "Alertas críticas a tu inbox")}><Toggle on={true} /></Row>
        <Row label={L("Weekly summary", "Resumen semanal")} desc={L("Every Monday at 9:00", "Cada lunes a las 9:00")}><Toggle on={true} /></Row>
        <Row label={L("Real-time alerts", "Alertas en tiempo real")} desc={L("Accounts crossing into risk", "Cuentas que cruzan a riesgo")}><Toggle on={true} /></Row>
        <Row label={L("Dark mode", "Modo oscuro")} desc={L("Coming soon", "Próximamente")}><Toggle on={false} /></Row>
        <Row label={L("Default range", "Rango por defecto")} desc={L("When opening the dashboard", "Al abrir el dashboard")}><select style={sel}>{lang === "es" ? <><option>Últimos 30 días</option><option>Último trimestre</option></> : <><option>Last 30 days</option><option>Last quarter</option></>}</select></Row>
      </div>
    </div>
    <div style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontSize: FS.h2, fontWeight: 600, marginBottom: 4 }}>{L("Security", "Seguridad")}</div>
      <Row label={L("Password", "Contraseña")} desc={L("Last updated 3 months ago", "Última actualización hace 3 meses")}><button style={{ ...sel, fontWeight: 600, color: PAL.brand, borderColor: PAL.brand }}>{L("Change", "Cambiar")}</button></Row>
      <Row label={L("Two-factor authentication", "Autenticación de dos factores")} desc={L("Extra security layer", "Capa extra de seguridad")}><Toggle on={true} /></Row>
      <Row label={L("Active sessions", "Sesiones activas")} desc={L("2 connected devices", "2 dispositivos conectados")}><button style={{ ...sel }}>{L("Manage", "Gestionar")}</button></Row>
    </div>
  </div>;
}

function LogoutView({ onCancel, onConfirm }) {
  const { L } = useSession();
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 160px)", textAlign: "center" }}>
    <Logo size={56} />
    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 20, letterSpacing: "-.3px" }}>{L("Log out?", "¿Cerrar sesión?")}</div>
    <div style={{ fontSize: FS.body, color: PAL.sub, marginTop: 8, maxWidth: 360 }}>{L("You'll sign out of your Vantix account. You'll need to sign in again to access your data.", "Saldrás de tu cuenta de Vantix. Tendrás que volver a iniciar sesión para acceder a tus datos.")}</div>
    <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
      <button onClick={onCancel} style={{ fontSize: FS.body, fontWeight: 600, color: PAL.text, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 10, padding: "11px 22px", cursor: "pointer", fontFamily: FONT }}>{L("Cancel", "Cancelar")}</button>
      <button onClick={onConfirm} style={{ fontSize: FS.body, fontWeight: 600, color: "#fff", background: PAL.bad, border: "none", borderRadius: 10, padding: "11px 22px", cursor: "pointer", fontFamily: FONT }}>{L("Log out", "Cerrar sesión")}</button>
    </div>
  </div>;
}


/* =================== LANDING PAGE + LOGIN =================== */

const landingFeatures = [
  { t: { en: "Customer Intelligence", es: "Customer Intelligence" }, d: { en: "Predict churn and CLV per customer with BG/NBD models. Segment by behavior, not intuition.", es: "Predice churn y CLV por cliente con modelos BG/NBD. Segmenta por comportamiento, no por intuición." }, icon: "◉" },
  { t: { en: "Market micro-studies", es: "Micro-estudios de mercado" }, d: { en: "Instant strategic analysis: expansion, pricing, competition. With a verdict and a recommendation.", es: "Análisis estratégicos al instante: expansión, precio, competencia. Con veredicto y recomendación." }, icon: "◎" },
  { t: { en: "Financial modeling", es: "Modelado financiero" }, d: { en: "Projected P&L, runway and Monte Carlo simulation. What a CFO needs before a board meeting.", es: "P&L proyectado, runway y simulación Monte Carlo. Lo que un CFO necesita antes de una junta." }, icon: "◈" },
  { t: { en: "AI Assistant", es: "Asistente IA" }, d: { en: "Ask in natural language. It answers with the cause and the action, not a chart to decode.", es: "Pregunta en lenguaje natural. Responde con la causa y la acción, no con un gráfico que descifrar." }, icon: "◐" },
  { t: { en: "Network analysis", es: "Análisis de red" }, d: { en: "Discover customer communities with clustering. Segments emerge from the data.", es: "Descubre comunidades de clientes con clustering. Los segmentos emergen de los datos." }, icon: "◍" },
  { t: { en: "Real-time maps", es: "Mapas en tiempo real" }, d: { en: "Live geographic activity and revenue-concentration heatmaps by region.", es: "Actividad geográfica en vivo y heatmaps de concentración de ingreso por región." }, icon: "◓" },
];
const landingSteps = [
  { n: 1, t: { en: "Connect your data", es: "Conecta tus datos" }, d: { en: "Stripe, Snowflake or a CSV. Automatic column mapping in minutes.", es: "Stripe, Snowflake o un CSV. Mapeo automático de columnas en minutos." } },
  { n: 2, t: { en: "The engine analyzes", es: "El motor analiza" }, d: { en: "RFM, CLV, churn and segmentation run in the background over your transactions.", es: "RFM, CLV, churn y segmentación corren en background sobre tus transacciones." } },
  { n: 3, t: { en: "You decide with data", es: "Decides con datos" }, d: { en: "Alerts, next-best-action and scenarios. From analytics to action.", es: "Alertas, next-best-action y escenarios. De la analítica a la acción." } },
];

// Toggle de idioma reutilizable (EN | ES)
function LangToggle({ lang, setLang }) {
  return <div style={{ display: "inline-flex", border: `1px solid ${PAL.line}`, borderRadius: 8, overflow: "hidden", fontFamily: FONT }}>
    {["en", "es"].map((l) => (
      <button key={l} onClick={() => setLang(l)} style={{ fontSize: 11.5, fontWeight: 600, padding: "6px 10px", border: "none", cursor: "pointer", background: lang === l ? PAL.brand : "transparent", color: lang === l ? "#fff" : PAL.sub, fontFamily: FONT }}>{l.toUpperCase()}</button>
    ))}
  </div>;
}


// Preview interactivo del producto: navegación real (completa) dentro del marco
function ProductPreview() {
  const { L } = useSession();
  const groups = [
    { sec: { en: "INTELLIGENCE", es: "INTELIGENCIA" }, items: [
      { label: { en: "Overview", es: "Overview" }, view: <OverviewView /> },
      { label: { en: "AI Assistant", es: "Asistente IA" }, view: <AssistantView previewHeight={620} /> },
      { label: { en: "Summary & Alerts", es: "Resumen & Alertas" }, view: <PulseView /> },
      { label: { en: "Maps", es: "Mapas" }, view: <MapsView /> },
    ]},
    { sec: { en: "ANALYSIS", es: "ANÁLISIS" }, items: [
      { label: { en: "Network analysis", es: "Análisis de red" }, view: <NetworkView /> },
      { label: { en: "Churn root cause", es: "Causa raíz de churn" }, view: <RootCauseView /> },
      { label: { en: "Live cohorts", es: "Cohortes vivas" }, view: <CohortsView /> },
      { label: { en: "Forecast & Cycles", es: "Forecast & Ciclos" }, view: <ForecastCyclesView /> },
    ]},
    { sec: { en: "MARKET & DECISION", es: "MERCADO & DECISIÓN" }, items: [
      { label: { en: "Micro-studies", es: "Micro-estudios" }, view: <MicroStudyView /> },
      { label: { en: "Multidimensional table", es: "Tabla multidimensional" }, view: <PivotView /> },
      { label: { en: "CLV attribution", es: "Atribución CLV" }, view: <AttributionView /> },
      { label: { en: "What-if simulator", es: "Simulador what-if" }, view: <SimulatorView /> },
      { label: { en: "Next Best Action", es: "Next Best Action" }, view: <NbaView /> },
    ]},
    { sec: { en: "FINANCE", es: "FINANZAS" }, items: [
      { label: { en: "Financial modeling", es: "Modelado financiero" }, view: <FinanceView /> },
    ]},
    { sec: { en: "PLATFORM", es: "PLATAFORMA" }, items: [
      { label: { en: "Connections", es: "Conexiones" }, view: <ConnectionsView /> },
      { label: { en: "Team & RBAC", es: "Equipo & RBAC" }, view: <TeamView /> },
      { label: { en: "Governance", es: "Gobernanza" }, view: <GovernanceView /> },
      { label: { en: "Credits & usage", es: "Créditos & uso" }, view: <BillingView /> },
      { label: { en: "Onboarding", es: "Onboarding" }, view: <OnboardingView /> },
    ]},
  ];
  const flat = groups.flatMap(g => g.items);
  const [active, setActive] = useState(0);
  const activeItem = flat[active];
  const isMobile = useIsMobile();

  // Barra de ventana (compartida entre móvil y escritorio).
  const windowBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderBottom: `1px solid ${PAL.line}`, background: PAL.panel2 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#E2E4E9" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#E2E4E9" }} />
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#E2E4E9" }} />
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ fontSize: 11.5, color: PAL.sub, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 7, padding: "4px 40px", fontFamily: "monospace" }}>app.vantix.io</div>
      </div>
      <div style={{ fontSize: 10, color: PAL.brand, fontWeight: 600, background: `${PAL.brand}12`, padding: "3px 9px", borderRadius: 20 }}>DEMO</div>
    </div>
  );

  // MÓVIL: sin sidebar ni escalado (ilegible en pantalla pequeña). Navegación
  // en píldoras con scroll horizontal + la vista real a ancho natural, que
  // reflowa sola (los grids colapsan vía globals.css; las gráficas encogen).
  if (isMobile) {
    return <div style={{ marginTop: 36, borderRadius: 14, border: `1px solid ${PAL.line}`, boxShadow: "0 16px 40px -18px rgba(16,17,22,.18)", overflow: "hidden", background: PAL.panel, textAlign: "left" }}>
      {windowBar}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px", borderBottom: `1px solid ${PAL.line}`, WebkitOverflowScrolling: "touch", background: PAL.panel }}>
        {flat.map((it, i) => (
          <button key={it.label.en} onClick={() => setActive(i)} style={{ fontSize: 12, fontWeight: active === i ? 600 : 500, whiteSpace: "nowrap", padding: "7px 12px", borderRadius: 20, cursor: "pointer", fontFamily: FONT, border: `1px solid ${active === i ? PAL.brand : PAL.line}`, color: active === i ? "#fff" : PAL.sub, background: active === i ? PAL.brand : PAL.panel }}>{L(it.label.en, it.label.es)}</button>))}
      </div>
      <div className="vx-grid-collapse" style={{ maxHeight: 460, overflowY: "auto", overflowX: "auto", padding: "14px 14px 28px", background: PAL.panel2 }}>
        {activeItem.view}
      </div>
    </div>;
  }

  let idx = -1;
  return <div style={{ marginTop: 56, maxWidth: 980, marginLeft: "auto", marginRight: "auto", borderRadius: 16, border: `1px solid ${PAL.line}`, boxShadow: "0 24px 60px -20px rgba(16,17,22,.18), 0 8px 20px -12px rgba(16,17,22,.1)", overflow: "hidden", background: PAL.panel }}>
    {windowBar}
    {/* cuerpo */}
    <div style={{ display: "flex", textAlign: "left", height: 520 }}>
      {/* sidebar interactivo completo (scrolleable) */}
      <div style={{ width: 184, borderRight: `1px solid ${PAL.line}`, padding: "14px 12px", flexShrink: 0, background: PAL.panel, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16, padding: "0 4px" }}>
          <Logo size={22} /><span style={{ fontSize: 13, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>Vantix</span></div>
        {groups.map((g) => (
          <div key={g.sec.en} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: PAL.sub, letterSpacing: ".5px", padding: "0 8px", marginBottom: 4, opacity: .7 }}>{L(g.sec.en, g.sec.es)}</div>
            {g.items.map((it) => { idx++; const i = idx; return (
              <div key={it.label.en} onClick={() => setActive(i)} style={{ fontSize: 12, padding: "7px 9px", borderRadius: 7, marginBottom: 1, cursor: "pointer", color: active === i ? PAL.brand : PAL.sub, background: active === i ? `${PAL.brand}12` : "transparent", fontWeight: active === i ? 600 : 450, borderLeft: active === i ? `2px solid ${PAL.brand}` : "2px solid transparent", transition: "background .12s" }}>{L(it.label.en, it.label.es)}</div>);
            })}
          </div>))}
      </div>
      {/* viewport: vista real escalada, con scroll vertical para no perder información */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", background: PAL.panel2 }}>
        <div style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ transform: "scale(0.66)", transformOrigin: "top left", width: "151.5%", padding: "16px 20px 40px" }}>
            {activeItem.view}
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 44, background: `linear-gradient(to top, ${PAL.panel2}, transparent)`, pointerEvents: "none" }} />
      </div>
    </div>
  </div>;
}

function LandingView({ onEnter }) {
  const { L, lang, setLang } = useSession();
  const isMobile = useIsMobile();
  const navLink = { fontSize: 14, color: PAL.sub, cursor: "pointer", fontWeight: 500, textDecoration: "none" };
  const section = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };
  const viewSource = (full) => <a href={REPO_URL} target="_blank" rel="noopener noreferrer" style={{ ...navLink, display: "inline-flex", alignItems: "center", gap: 6 }} title="View source on GitHub"><GhIcon />{full && L("View source", "Ver código")}</a>;
  return <div style={{ fontFamily: FONT, color: PAL.text, background: PAL.panel }}>
    {/* NAV */}
    <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.85)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${PAL.line}` }}>
      <div style={{ ...section, display: "flex", alignItems: "center", height: 64, gap: isMobile ? 14 : 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={30} /><span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-.3px", fontFamily: '"Space Grotesk", sans-serif' }}>Vantix</span></div>
        <div style={{ flex: 1 }} />
        {!isMobile && <a style={navLink} onClick={() => document.getElementById("feat")?.scrollIntoView({ behavior: "smooth" })}>{L("Product", "Producto")}</a>}
        {!isMobile && <a style={navLink} onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>{L("Credits", "Créditos")}</a>}
        {viewSource(!isMobile)}
        <LangToggle lang={lang} setLang={setLang} />
        <button onClick={onEnter} style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: PAL.brand, border: "none", borderRadius: 10, padding: isMobile ? "9px 14px" : "10px 18px", cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>{L("Try demo", "Probar demo")}</button>
      </div>
    </nav>

    {/* HERO */}
    <header style={{ ...section, paddingTop: isMobile ? 48 : 80, paddingBottom: isMobile ? 40 : 60, textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: PAL.brand, background: `${PAL.brand}12`, padding: "6px 14px", borderRadius: 20 }}>Market & Customer Intelligence</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: PAL.sub, background: PAL.panel2, border: `1px solid ${PAL.line}`, padding: "6px 14px", borderRadius: 20 }}>{L("Proof of concept", "Prueba de concepto")}</span>
      </div>
      <h1 style={{ fontSize: "clamp(30px, 6.5vw, 52px)", fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1.08, margin: 0, maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}>
        {L(<>Predictive intelligence to maximize <span style={{ color: PAL.brand }}>financial value</span></>, <>Inteligencia predictiva para maximizar el <span style={{ color: PAL.brand }}>valor financiero</span></>)}</h1>
      <p style={{ fontSize: "clamp(16px, 2.4vw, 19px)", color: PAL.sub, lineHeight: 1.5, maxWidth: 640, margin: "22px auto 0" }}>
        {L("Vantix predicts churn and the lifetime value of every customer, and turns it into decisions that protect and grow your revenue.", "Vantix predice el churn y el valor de vida de cada cliente, y lo traduce en decisiones que protegen y hacen crecer tus ingresos.")}</p>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 34, flexWrap: "wrap" }}>
        <button onClick={() => document.getElementById("feat")?.scrollIntoView({ behavior: "smooth" })} style={{ fontSize: 15, fontWeight: 600, color: "#fff", background: PAL.brand, border: "none", borderRadius: 12, padding: "14px 28px", cursor: "pointer", fontFamily: FONT }}>{L("How it works", "Cómo funciona")}</button>
        <button onClick={onEnter} style={{ fontSize: 15, fontWeight: 600, color: PAL.text, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 12, padding: "14px 28px", cursor: "pointer", fontFamily: FONT }}>{L("See demo", "Ver demo")}</button>
      </div>
      <div style={{ fontSize: 13, color: PAL.sub, marginTop: 16 }}>{L("Explore the full product · Set it up in 10 minutes", "Explora el producto completo · Configúralo en 10 minutos")}</div>
      <ProductPreview />
    </header>

    {/* MARCAS — IA que mueve la plataforma + stack de datos/BI con el que se integra.
       Lockups MONOCROMOS (grises, sin color): look "trusted by" enterprise y uniforme. */}
    <div style={{ ...section, paddingBottom: 56, textAlign: "center" }}>
      {[
        { label: { en: "POWERED BY FRONTIER AI", es: "IMPULSADO POR IA DE FRONTERA" },
          marks: ["OpenAI", "Anthropic", "Google Gemini"] },
        { label: { en: "CONNECTS WITH YOUR STACK", es: "SE CONECTA CON TU STACK" },
          marks: ["Snowflake", "BigQuery", "Power BI", "Salesforce", "Stripe"] },
      ].map((row, ri) => (
        <div key={ri} style={{ marginTop: ri ? 28 : 0 }}>
          <div style={{ fontSize: 11.5, color: PAL.sub, letterSpacing: ".8px", fontWeight: 600, marginBottom: 14 }}>{L(row.label.en, row.label.es)}</div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: isMobile ? 16 : 30, flexWrap: "wrap", opacity: .9 }}>
            {row.marks.map((name) => (
              <div key={name} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: "#ECEEF1", color: "#585E66", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{name[0]}</span>
                <span style={{ fontSize: 15.5, fontWeight: 600, color: "#4B5158", letterSpacing: "-.2px" }}>{name}</span>
              </div>))}
          </div>
        </div>))}
    </div>

    {/* CARACTERÍSTICAS */}
    <section id="feat" style={{ background: PAL.panel2, padding: isMobile ? "48px 0" : "70px 0" }}>
      <div style={section}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-.8px", margin: 0 }}>{L("Everything you need to decide", "Todo lo que necesitas para decidir")}</h2>
          <p style={{ fontSize: 17, color: PAL.sub, marginTop: 12 }}>{L("One platform, not ten scattered tools.", "Una plataforma, no diez herramientas sueltas.")}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {landingFeatures.map((f, i) => (
            <div key={i} style={{ background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 14, padding: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: `${PAL.brand}12`, color: PAL.brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 7 }}>{L(f.t.en, f.t.es)}</div>
              <div style={{ fontSize: 14, color: PAL.sub, lineHeight: 1.55 }}>{L(f.d.en, f.d.es)}</div>
            </div>))}
        </div>
      </div>
    </section>

    {/* CÓMO FUNCIONA */}
    <section style={{ ...section, padding: isMobile ? "48px 24px" : "70px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 44 }}>
        <h2 style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-.8px", margin: 0 }}>{L("From data to decision in 3 steps", "De los datos a la decisión en 3 pasos")}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
        {landingSteps.map((s) => (
          <div key={s.n} style={{ textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: PAL.brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, margin: "0 auto 16px" }}>{s.n}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{L(s.t.en, s.t.es)}</div>
            <div style={{ fontSize: 14.5, color: PAL.sub, lineHeight: 1.55, maxWidth: 280, margin: "0 auto" }}>{L(s.d.en, s.d.es)}</div>
          </div>))}
      </div>
    </section>

    {/* PRECIOS */}
    <section id="pricing" style={{ background: PAL.panel2, padding: isMobile ? "48px 0" : "70px 0" }}>
      <div style={section}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-.8px", margin: 0 }}>{L("Credit-based access", "Acceso basado en créditos")}</h2>
          <p style={{ fontSize: 17, color: PAL.sub, marginTop: 12, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>{L("Start free. Each analysis consumes credits — no subscription, no card. You only pay for the compute you use.", "Empieza gratis. Cada análisis consume créditos — sin suscripción, sin tarjeta. Pagas solo por el cómputo que usas.")}</p>
        </div>
        <div style={{ maxWidth: 720, margin: "0 auto", background: PAL.panel, border: `2px solid ${PAL.brand}`, borderRadius: 16, padding: isMobile ? 22 : 32, position: "relative" }}>
          <div style={{ position: "absolute", top: -11, left: isMobile ? 22 : 32, fontSize: 11, fontWeight: 700, color: "#fff", background: PAL.brand, padding: "4px 12px", borderRadius: 20 }}>{L("EARLY ACCESS · FREE", "EARLY ACCESS · GRATIS")}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: "clamp(32px, 7vw, 40px)", fontWeight: 800, letterSpacing: "-1px" }}>{L("500 credits", "500 créditos")}</span>
            <span style={{ fontSize: 16, color: PAL.sub }}>{L("/ month · renewed free", "/ mes · renovados gratis")}</span>
          </div>
          <div style={{ fontSize: 14.5, color: PAL.sub, marginTop: 8, marginBottom: 24 }}>{L("Enough to explore the whole product. No commitment during launch.", "Suficiente para explorar todo el producto. Sin compromiso durante el lanzamiento.")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 26 }}>
            {(lang === "es"
              ? [["Consulta al Asistente IA","1 crédito",true],["Micro-estudio de mercado","25 créditos",true],["Plan de retención","15 créditos",true],["Simulación Monte Carlo","5 créditos",true],["Dashboards & analítica","Siempre incluido",false],["Conexiones de datos","Siempre incluido",false]]
              : [["AI Assistant query","1 credit",true],["Market micro-study","25 credits",true],["Retention plan","15 credits",true],["Monte Carlo simulation","5 credits",true],["Dashboards & analytics","Always included",false],["Data connections","Always included",false]]
            ).map(([k, v, isCredit], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${PAL.line}`, paddingBottom: 9 }}>
                <span style={{ fontSize: 14 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: isCredit ? PAL.brand : PAL.good }}>{v}</span>
              </div>))}
          </div>
          <button onClick={onEnter} style={{ width: "100%", fontSize: 15, fontWeight: 600, color: "#fff", background: PAL.brand, border: "none", borderRadius: 10, padding: "14px", cursor: "pointer", fontFamily: FONT }}>{L("Start free with 500 credits", "Empezar gratis con 500 créditos")}</button>
          <div style={{ textAlign: "center", fontSize: 12.5, color: PAL.sub, marginTop: 12 }}>{L("Credits reflect the real compute cost of the AI models. Transparent, no surprises.", "Los créditos reflejan el costo real de cómputo de los modelos de IA. Transparente y sin sorpresas.")}</div>
        </div>
      </div>
    </section>

    {/* FOOTER */}
    <footer style={{ borderTop: `1px solid ${PAL.line}`, padding: "40px 0" }}>
      <div style={{ ...section, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo size={26} /><span style={{ fontWeight: 700, fontSize: 15 }}>Vantix</span></div>
        <div style={{ fontSize: 13, color: PAL.sub }}>© 2026 Vantix · Market & Customer Intelligence</div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: PAL.sub, alignItems: "center", flexWrap: "wrap" }}>{viewSource(true)}<span>{L("Privacy", "Privacidad")}</span><span>{L("Terms", "Términos")}</span><span>SOC 2</span></div>
      </div>
      <div style={{ ...section, marginTop: 18, fontSize: 11.5, lineHeight: 1.5, color: PAL.sub, opacity: .85, textAlign: "center" }}>
        {L("Proof of concept, for demonstration only. All figures are synthetic and generated from your inputs — no real data is processed. Brand names are shown to illustrate the AI models and integrations, and do not imply any partnership or endorsement.", "Prueba de concepto, solo con fines de demostración. Todas las cifras son sintéticas y se generan a partir de tus datos — no se procesa información real. Los nombres de marcas se muestran para ilustrar los modelos de IA e integraciones, y no implican alianza ni respaldo.")}
      </div>
    </footer>
  </div>;
}

function LoginView({ onLogin, onBack }) {
  const { L } = useSession();
  return <div style={{ fontFamily: FONT, color: PAL.text, minHeight: "100vh", display: "flex", background: PAL.panel2 }}>
    {/* panel izq — marca */}
    <div style={{ flex: 1, background: `linear-gradient(150deg, ${PAL.brandDk}, ${PAL.brand} 55%, #22B5C4)`, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 60px", color: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30 }}>
        <div style={{ background: "rgba(255,255,255,.18)", borderRadius: 12, padding: 4 }}><Logo size={36} /></div>
        <span style={{ fontWeight: 700, fontSize: 24, fontFamily: '"Space Grotesk", sans-serif' }}>Vantix</span></div>
      <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.8px", lineHeight: 1.2, margin: 0, maxWidth: 380 }}>{L("From data to decision.", "De los datos a la decisión.")}</h2>
      <p style={{ fontSize: 16, opacity: .9, lineHeight: 1.6, marginTop: 18, maxWidth: 380 }}>{L("Predict churn, model your customers' value and generate micro-studies instantly.", "Predice churn, modela el valor de tus clientes y genera micro-estudios al instante.")}</p>
    </div>
    {/* panel der — formulario */}
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 40px" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.3px" }}>{L("Sign in", "Inicia sesión")}</div>
        <div style={{ fontSize: 14, color: PAL.sub, marginTop: 6, marginBottom: 26 }}>{L("Welcome back to Vantix", "Bienvenido de vuelta a Vantix")}</div>
        <label style={{ fontSize: 13, fontWeight: 500, color: PAL.sub }}>Email</label>
        <input defaultValue="ana@empresa.com" style={{ width: "100%", fontSize: 14, padding: "12px 14px", borderRadius: 10, border: `1px solid ${PAL.line}`, fontFamily: FONT, outline: "none", margin: "6px 0 16px", background: PAL.panel }} />
        <label style={{ fontSize: 13, fontWeight: 500, color: PAL.sub }}>{L("Password", "Contraseña")}</label>
        <input type="password" defaultValue="vantix2026" style={{ width: "100%", fontSize: 14, padding: "12px 14px", borderRadius: 10, border: `1px solid ${PAL.line}`, fontFamily: FONT, outline: "none", margin: "6px 0 8px", background: PAL.panel }} />
        <div style={{ textAlign: "right", marginBottom: 18 }}><span style={{ fontSize: 13, color: PAL.brand, cursor: "pointer" }}>{L("Forgot your password?", "¿Olvidaste tu contraseña?")}</span></div>
        <button onClick={onLogin} style={{ width: "100%", fontSize: 15, fontWeight: 600, color: "#fff", background: PAL.brand, border: "none", borderRadius: 10, padding: "13px", cursor: "pointer", fontFamily: FONT }}>{L("Enter the dashboard", "Entrar al dashboard")}</button>
        <div style={{ textAlign: "center", fontSize: 13, color: PAL.sub, marginTop: 18 }}>{L("No account?", "¿No tienes cuenta?")} <span onClick={onLogin} style={{ color: PAL.brand, cursor: "pointer", fontWeight: 600 }}>{L("Start free", "Empieza gratis")}</span></div>
        <div style={{ textAlign: "center", marginTop: 24 }}><span onClick={onBack} style={{ fontSize: 13, color: PAL.sub, cursor: "pointer" }}>{L("← Back to the home page", "← Volver a la página principal")}</span></div>
      </div>
    </div>
  </div>;
}

/* =================== APP SHELL: RESPONSIVE + SIDEBAR COLAPSABLE =================== */

function ForecastCyclesView() {
  const { L } = useSession();
  return <div>
    <H1 title={L("Forecast & Cycles", "Forecast & Ciclos")} sub={L("MRR projection with confidence band + seasonal decomposition.", "Proyección de MRR con banda de confianza + descomposición estacional.")} />
    <Panel title={L("MRR — projection + seasonality", "MRR — proyección + estacionalidad")} tag="prophet-style" h={480}><Forecast /></Panel>
  </div>;
}

// Etiquetas de nav bilingües: { en, es }.
const NAV = [
  { sec: { en: "INTELLIGENCE", es: "INTELIGENCIA" }, items: [
    { label: { en: "Overview", es: "Overview" }, slug: "overview", view: () => <OverviewView /> },
    { label: { en: "AI Assistant", es: "Asistente IA" }, slug: "asistente", view: () => <AssistantView /> },
    { label: { en: "Summary & Alerts", es: "Resumen & Alertas" }, slug: "pulso", view: () => <PulseView /> },
    { label: { en: "Maps", es: "Mapas" }, slug: "mapas", view: () => <MapsView /> },
  ]},
  { sec: { en: "ANALYSIS", es: "ANÁLISIS" }, items: [
    { label: { en: "Network analysis", es: "Análisis de red" }, slug: "red", view: () => <NetworkView /> },
    { label: { en: "Churn root cause", es: "Causa raíz de churn" }, slug: "causa-raiz", view: () => <RootCauseView /> },
    { label: { en: "Live cohorts", es: "Cohortes vivas" }, slug: "cohortes", view: () => <CohortsView /> },
    { label: { en: "Forecast & Cycles", es: "Forecast & Ciclos" }, slug: "forecast", view: () => <ForecastCyclesView /> },
  ]},
  { sec: { en: "MARKET & DECISION", es: "MERCADO & DECISIÓN" }, items: [
    { label: { en: "Micro-studies", es: "Micro-estudios" }, slug: "estudios", view: () => <MicroStudyView /> },
    { label: { en: "Multidimensional table", es: "Tabla multidimensional" }, slug: "pivote", view: () => <PivotView /> },
    { label: { en: "CLV attribution", es: "Atribución CLV" }, slug: "atribucion", view: () => <AttributionView /> },
    { label: { en: "What-if simulator", es: "Simulador what-if" }, slug: "simulador", view: () => <SimulatorView /> },
    { label: { en: "Next Best Action", es: "Next Best Action" }, slug: "nba", view: () => <NbaView /> },
  ]},
  { sec: { en: "FINANCE", es: "FINANZAS" }, items: [
    { label: { en: "Financial modeling", es: "Modelado financiero" }, slug: "finanzas", view: () => <FinanceView /> },
  ]},
  { sec: { en: "PLATFORM", es: "PLATAFORMA" }, items: [
    { label: { en: "Connections", es: "Conexiones" }, slug: "conexiones", view: () => <ConnectionsView /> },
    { label: { en: "Team & RBAC", es: "Equipo & RBAC" }, slug: "equipo", view: () => <TeamView /> },
    { label: { en: "Governance", es: "Gobernanza" }, slug: "gobernanza", view: () => <GovernanceView /> },
    { label: { en: "Credits & usage", es: "Créditos & uso" }, slug: "planes", view: () => <BillingView /> },
    { label: { en: "Onboarding", es: "Onboarding" }, slug: "onboarding", view: () => <OnboardingView /> },
  ]},
];
const ALL_ITEMS = NAV.flatMap(g => g.items.map(it => ({ ...it, sec: g.sec })));
// Rutas de cuenta: accesibles por slug pero no en el sidebar principal
const ACCOUNT_ROUTES = [
  { label: { en: "Settings", es: "Configuración" }, slug: "settings", sec: { en: "ACCOUNT", es: "CUENTA" }, view: () => <SettingsView /> },
  { label: { en: "Log out", es: "Cerrar sesión" }, slug: "logout", sec: { en: "ACCOUNT", es: "CUENTA" }, view: (go, onLogout) => <LogoutView onCancel={() => go("overview")} onConfirm={onLogout} /> },
];
const ROUTE_INDEX = [...ALL_ITEMS, ...ACCOUNT_ROUTES];

function useHashRoute(defaultSlug) {
  const read = () => {
    if (typeof window === "undefined") return defaultSlug;
    const h = window.location.hash.replace(/^#\/?/, "");
    return ROUTE_INDEX.find(i => i.slug === h) ? h : defaultSlug;
  };
  const [slug, setSlug] = useState(defaultSlug);
  React.useEffect(() => {
    setSlug(read());                       // sincroniza con el hash real tras montar
    const onChange = () => setSlug(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const go = (s) => { if (typeof window !== "undefined") window.location.hash = `/${s}`; setSlug(s); };
  return [slug, go];
}

// PUERTA DE CONEXIÓN — primer contacto del usuario. Llega sin datos; elige una
// fuente (simulada) y, opcionalmente, el nombre de su empresa → el dashboard se
// puebla con datos sintéticos "suyos". Sin integración real, costo cero.
// Bandas de negocio → valores representativos para escalar el dashboard.
const MRR_BANDS = [
  { label: { en: "Under $10k", es: "Menos de $10k" }, mrrK: 5 },
  { label: { en: "$10k – $50k", es: "$10k – $50k" }, mrrK: 30 },
  { label: { en: "$50k – $200k", es: "$50k – $200k" }, mrrK: 120 },
  { label: { en: "$200k – $1M", es: "$200k – $1M" }, mrrK: 500 },
  { label: { en: "Over $1M", es: "Más de $1M" }, mrrK: 2000 },
];
const CUST_BANDS = [
  { label: { en: "Under 100", es: "Menos de 100" }, v: 50 },
  { label: { en: "100 – 1,000", es: "100 – 1.000" }, v: 500 },
  { label: { en: "1,000 – 10,000", es: "1.000 – 10.000" }, v: 4000 },
  { label: { en: "Over 10,000", es: "Más de 10.000" }, v: 40000 },
];
// Valor canónico en inglés (para el lead) + etiqueta localizada para mostrar.
const INDUSTRIES = [
  { en: "SaaS / Software", es: "SaaS / Software" }, { en: "E-commerce", es: "E-commerce" },
  { en: "Fintech", es: "Fintech" }, { en: "Marketplace", es: "Marketplace" },
  { en: "Health", es: "Salud" }, { en: "Education", es: "Educación" },
  { en: "Services", es: "Servicios" }, { en: "Other", es: "Otro" },
];

function ConnectGate({ onBack }) {
  const { connect, L } = useSession();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState(INDUSTRIES[0].en);
  const [mrrIdx, setMrrIdx] = useState(2);
  const [custIdx, setCustIdx] = useState(1);
  const [consent, setConsent] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const steps = [
    L("Authenticating secure connection…", "Autenticando conexión segura…"),
    L("Reading historical transactions…", "Leyendo transacciones históricas…"),
    L("Computing RFM, CLV and churn probability…", "Calculando RFM, CLV y probabilidad de churn…"),
    L(`Generating intelligence for ${company || "your business"}…`, `Generando la inteligencia de ${company || "tu negocio"}…`),
  ];
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const submit = () => {
    if (connecting) return;
    if (!emailOk) { setError(L("Enter a valid work email.", "Ingresa un email de trabajo válido.")); return; }
    if (!consent) { setError(L("We need your consent to continue.", "Necesitamos tu consentimiento para continuar.")); return; }
    setError("");
    const inputs = { mrrK: MRR_BANDS[mrrIdx].mrrK, customers: CUST_BANDS[custIdx].v, industry };
    // Captura del lead — no bloquea la demo si el endpoint falla o no está configurado.
    try {
      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(), company: company.trim(), industry,
          mrr_band: MRR_BANDS[mrrIdx].label.en, customers_band: CUST_BANDS[custIdx].label.en,
        }),
      }).catch(() => {});
    } catch { /* noop */ }
    setConnecting(true);
    setStep(0);
    let i = 0;
    const iv = setInterval(() => { i = Math.min(i + 1, steps.length - 1); setStep(i); }, 720);
    setTimeout(() => { clearInterval(iv); connect(company, inputs, email); }, 2950);
  };
  const fld = { width: "100%", fontSize: FS.body, padding: "11px 13px", borderRadius: 10, border: `1px solid ${PAL.line}`, fontFamily: FONT, outline: "none", background: PAL.panel };
  const lbl = { fontSize: FS.label, fontWeight: 600, color: PAL.sub, display: "block", marginBottom: 5 };
  return <div style={{ fontFamily: FONT, color: PAL.text, minHeight: "100vh", background: PAL.panel2, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
    <style>{`@keyframes cgspin{to{transform:rotate(360deg)}}`}</style>
    <div style={{ width: "100%", maxWidth: 580, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 18, padding: "clamp(22px, 5vw, 32px) clamp(20px, 5vw, 34px) 26px", boxShadow: "0 24px 60px -20px rgba(16,17,22,.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Logo size={40} />
        <div><div style={{ fontSize: 18, fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', letterSpacing: "-.3px" }}>Vantix</div>
          <div style={{ fontSize: FS.label, color: PAL.sub }}>{L("Try the intelligence with your business's numbers", "Prueba la inteligencia con los números de tu negocio")}</div></div>
      </div>
      {!connecting ? <>
        <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.5px", margin: "0 0 8px" }}>{L("Generate your tailored dashboard", "Genera tu dashboard a medida")}</h1>
        <p style={{ fontSize: FS.body, color: PAL.sub, lineHeight: 1.55, margin: "0 0 20px" }}>{L(<>Tell us a few things about your business and Vantix generates a dashboard scaled to your figures. <strong style={{ color: PAL.text }}>The data is simulated from what you enter — we don't process real information.</strong></>, <>Dinos unos datos de tu negocio y Vantix genera un dashboard escalado a tus cifras. <strong style={{ color: PAL.text }}>Los datos son simulados a partir de lo que ingresas — no procesamos información real.</strong></>)}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={lbl}>{L("Work email *", "Email de trabajo *")}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={fld} /></div>
          <div><label style={lbl}>{L("Company", "Empresa")}</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={L("e.g. Acme Inc.", "ej. Acme Inc.")} style={fld} /></div>
          <div><label style={lbl}>{L("Industry", "Industria")}</label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ ...fld, cursor: "pointer" }}>{INDUSTRIES.map((x) => <option key={x.en} value={x.en}>{L(x.en, x.es)}</option>)}</select></div>
          <div><label style={lbl}>{L("Approx. MRR", "MRR aproximado")}</label>
            <select value={mrrIdx} onChange={(e) => setMrrIdx(+e.target.value)} style={{ ...fld, cursor: "pointer" }}>{MRR_BANDS.map((b, i) => <option key={i} value={i}>{L(b.label.en, b.label.es)}</option>)}</select></div>
          <div style={{ gridColumn: "span 2" }}><label style={lbl}>{L("Number of customers", "Nº de clientes")}</label>
            <select value={custIdx} onChange={(e) => setCustIdx(+e.target.value)} style={{ ...fld, cursor: "pointer" }}>{CUST_BANDS.map((b, i) => <option key={i} value={i}>{L(b.label.en, b.label.es)}</option>)}</select></div>
        </div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: FS.label, color: PAL.sub, cursor: "pointer", lineHeight: 1.5, marginBottom: error ? 8 : 16 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 1, accentColor: PAL.brand, flexShrink: 0 }} />
          <span>{L("I agree that Vantix stores my email and contacts me about the product. No spam; unsubscribe anytime.", "Acepto que Vantix guarde mi email y me contacte sobre el producto. Sin spam; baja cuando quieras.")}</span>
        </label>
        {error && <div style={{ fontSize: FS.label, color: PAL.bad, marginBottom: 12 }}>{error}</div>}
        <button onClick={submit} style={{ width: "100%", fontSize: FS.body, fontWeight: 600, color: "#fff", background: PAL.brand, border: "none", borderRadius: 11, padding: "13px", cursor: "pointer", fontFamily: FONT }}>{L("Generate my dashboard", "Generar mi dashboard")}</button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <span onClick={onBack} style={{ fontSize: FS.label, color: PAL.sub, cursor: "pointer" }}>{L("← Back to home", "← Volver al inicio")}</span>
          <span style={{ fontSize: FS.label, color: PAL.sub, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: PAL.good }} />{L("Simulated data · no card", "Datos simulados · sin tarjeta")}</span>
        </div>
      </> : <div style={{ textAlign: "center", padding: "30px 10px 24px" }}>
        <div style={{ display: "inline-block", width: 34, height: 34, border: `3px solid ${PAL.line}`, borderTopColor: PAL.brand, borderRadius: "50%", animation: "cgspin .8s linear infinite" }} />
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>{company ? L(`Building ${company}'s dashboard…`, `Construyendo el dashboard de ${company}…`) : L("Building your dashboard…", "Construyendo tu dashboard…")}</div>
        <div style={{ fontSize: FS.body, color: PAL.sub, marginTop: 8, minHeight: 20 }}>{steps[step]}</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 18 }}>
          {steps.map((_, i) => <span key={i} style={{ width: 26, height: 4, borderRadius: 2, background: i <= step ? PAL.brand : PAL.line, transition: "background .3s" }} />)}
        </div>
      </div>}
    </div>
  </div>;
}

function Dashboard({ onLogout }) {
  const { connected, company, email, userName, userInitials, lang, setLang, L } = useSession();
  const [slug, go] = useHashRoute("overview");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  React.useEffect(() => {
    const close = () => setMenuOpen(false);
    if (menuOpen) { window.addEventListener("click", close); return () => window.removeEventListener("click", close); }
  }, [menuOpen]);

  // Puerta de conexión: sin fuente conectada no hay datos que mostrar.
  if (!connected) return <ConnectGate onBack={onLogout} />;

  const current = ROUTE_INDEX.find(i => i.slug === slug) || ROUTE_INDEX[0];
  const q = query.toLowerCase();
  const results = query.length > 0 ? ALL_ITEMS.filter(i => `${i.label.en} ${i.label.es}`.toLowerCase().includes(q)) : [];
  const nav = (s) => { go(s); setMobileOpen(false); };

  const itemRow = (it) => { const on = it.slug === slug;
    return <div key={it.slug} onClick={() => nav(it.slug)} style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12.5, marginBottom: 1, cursor: "pointer", background: on ? `${PAL.brand}14` : "transparent", color: on ? PAL.brand : PAL.sub, fontWeight: on ? 600 : 450, borderLeft: on ? `2px solid ${PAL.brand}` : "2px solid transparent", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{L(it.label.en, it.label.es)}</div>; };

  const SidebarInner = () => <>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "0 8px" }}>
      <Logo size={34} />
      <div><div style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: "-.3px", fontFamily: '"Space Grotesk", sans-serif' }}>Vantix</div>
        <div style={{ fontSize: 8.5, color: PAL.sub, letterSpacing: ".6px" }}>MARKET & CUSTOMER INTELLIGENCE</div></div></div>
    {NAV.map((g) => (
      <div key={g.sec.en} style={{ marginBottom: 13 }}>
        <div style={{ fontSize: 9, color: PAL.sub, letterSpacing: "1px", padding: "0 8px 5px", fontWeight: 700 }}>{L(g.sec.en, g.sec.es)}</div>
        {g.items.map(itemRow)}
      </div>))}
    <div style={{ marginTop: 12, padding: "10px 12px", background: PAL.panel2, borderRadius: 10, fontSize: 10.5, color: PAL.good, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: PAL.good }} />{L("Model active · 2.4M tx/day", "Modelo activo · 2.4M tx/día")}</div>
    {/* La cabecera oculta el toggle en móvil; lo exponemos aquí, en el cajón. */}
    {isMobile && <div style={{ marginTop: 14, padding: "0 8px" }}>
      <div style={{ fontSize: 9, color: PAL.sub, letterSpacing: "1px", marginBottom: 6, fontWeight: 700 }}>{L("LANGUAGE", "IDIOMA")}</div>
      <LangToggle lang={lang} setLang={setLang} />
    </div>}
  </>;

  return <div style={{ display: "flex", minHeight: "100vh", background: PAL.panel2, fontFamily: FONT, color: PAL.text }}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
      *{box-sizing:border-box} body{margin:0}
      ::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#D4D7DD;border-radius:4px}
      input[type=range]{height:4px;border-radius:4px;background:${PAL.line}}
      @media (max-width: 859px){
        main [style*="grid-template-columns"]{ grid-template-columns: 1fr !important; }
        main [style*="span 2"]{ grid-column: span 1 !important; }
        main .tablewrap [style*="grid-template-columns"]{ grid-template-columns: 1.6fr .8fr .8fr .8fr 2fr 1fr !important; }
        main table{ font-size: 11px !important; }
        /* Excepciones de mayor especificidad (div.clase) que ganan al colapso anterior:
           las filas de tarjetas/KPI van 2-por-fila (no un stack alto) y la matriz RFM
           conserva su retícula (scrollea en horizontal si no cabe). */
        main div.cardrow{ grid-template-columns: repeat(2, 1fr) !important; }
        main div.matrixgrid{ grid-template-columns: 78px repeat(4, 1fr) !important; overflow-x: auto; }
      }
      @media (max-width: 360px){
        main div.cardrow{ grid-template-columns: 1fr !important; }
      }`}</style>

    {/* SIDEBAR DESKTOP */}
    {!isMobile && <aside style={{ width: 226, background: PAL.panel, borderRight: `1px solid ${PAL.line}`, padding: "20px 12px", flexShrink: 0, height: "100vh", overflowY: "auto", position: "sticky", top: 0 }}>
      <SidebarInner />
    </aside>}

    {/* SIDEBAR MÓVIL (overlay) */}
    {isMobile && mobileOpen && <>
      <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,17,22,.4)", zIndex: 90 }} />
      <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: 252, background: PAL.panel, padding: "20px 12px", overflowY: "auto", zIndex: 100, boxShadow: "4px 0 24px rgba(16,17,22,.15)" }}>
        <SidebarInner />
      </aside>
    </>}

    {/* COLUMNA PRINCIPAL */}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <header style={{ background: PAL.panel, borderBottom: `1px solid ${PAL.line}`, padding: "11px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
        {isMobile && <button onClick={() => setMobileOpen(true)} style={{ background: PAL.panel2, border: `1px solid ${PAL.line}`, borderRadius: 8, width: 36, height: 36, fontSize: 16, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>☰</button>}
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, flexShrink: 0 }}>
          {company && <><span style={{ fontSize: 11.5, fontWeight: 700, color: PAL.brand, background: `${PAL.brand}12`, padding: "3px 9px", borderRadius: 7, whiteSpace: "nowrap", maxWidth: isMobile ? 120 : 220, overflow: "hidden", textOverflow: "ellipsis" }}>{company}</span><span style={{ color: PAL.line }}>/</span></>}
          {!isMobile && <><span style={{ color: PAL.sub }}>{L(current.sec.en, current.sec.es)}</span><span style={{ color: PAL.line }}>/</span></>}
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{L(current.label.en, current.label.es)}</span>
        </div>
        {!isMobile && <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L("Search…", "Buscar…")}
            style={{ width: "100%", fontSize: 12.5, padding: "8px 12px 8px 30px", borderRadius: 9, border: `1px solid ${PAL.line}`, background: PAL.panel2, fontFamily: FONT, outline: "none" }} />
          <span style={{ position: "absolute", left: 10, top: 8, color: PAL.sub, fontSize: 13 }}>⌕</span>
          {results.length > 0 && <div style={{ position: "absolute", top: 38, left: 0, right: 0, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(16,17,22,.12)", overflow: "hidden", zIndex: 60 }}>
            {results.slice(0, 6).map(r => <div key={r.slug} onClick={() => { nav(r.slug); setQuery(""); }} style={{ padding: "9px 14px", fontSize: 12.5, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
              onMouseEnter={(e) => e.currentTarget.style.background = PAL.panel2} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span style={{ fontWeight: 500 }}>{L(r.label.en, r.label.es)}</span><span style={{ color: PAL.sub, fontSize: 10.5 }}>{L(r.sec.en, r.sec.es)}</span></div>)}
          </div>}
        </div>}
        <div style={{ flex: 1 }} />
        {!isMobile && <LangToggle lang={lang} setLang={setLang} />}
        {!isMobile && <select style={{ fontSize: 12, padding: "7px 12px", borderRadius: 9, border: `1px solid ${PAL.line}`, background: PAL.panel, color: PAL.text, fontFamily: FONT, cursor: "pointer" }}>
          {lang === "es"
            ? <><option>Últimos 30 días</option><option>Último trimestre</option><option>Últimos 12 meses</option></>
            : <><option>Last 30 days</option><option>Last quarter</option><option>Last 12 months</option></>}
        </select>}
        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <div onClick={() => setMenuOpen(o => !o)} style={{ width: 32, height: 32, borderRadius: "50%", background: `${PAL.brand}1A`, color: PAL.brand, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0, cursor: "pointer", userSelect: "none" }}>{userInitials}</div>
          {menuOpen && <div style={{ position: "absolute", top: 42, right: 0, width: 240, background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 12, boxShadow: "0 8px 28px rgba(16,17,22,.14)", overflow: "hidden", zIndex: 80 }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${PAL.line}` }}>
              <div style={{ fontSize: FS.body, fontWeight: 600 }}>{userName}</div>
              <div style={{ fontSize: FS.label, color: PAL.sub, overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
              <div style={{ fontSize: 10, color: PAL.brand, marginTop: 4, fontWeight: 600 }}>{company ? L(`${company} · Full access`, `${company} · Acceso total`) : L("Full access", "Acceso total")}</div>
            </div>
            <div onClick={() => { nav("settings"); setMenuOpen(false); }} style={{ padding: "11px 16px", fontSize: FS.body, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={(e) => e.currentTarget.style.background = PAL.panel2} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: PAL.sub }}>⚙</span> {L("Settings", "Configuración")}</div>
            <div onClick={() => { nav("planes"); setMenuOpen(false); }} style={{ padding: "11px 16px", fontSize: FS.body, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={(e) => e.currentTarget.style.background = PAL.panel2} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: PAL.sub }}>◫</span> {L("Credits & usage", "Créditos & uso")}</div>
            <div onClick={() => { nav("logout"); setMenuOpen(false); }} style={{ padding: "11px 16px", fontSize: FS.body, cursor: "pointer", color: PAL.bad, fontWeight: 500, borderTop: `1px solid ${PAL.line}`, display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={(e) => e.currentTarget.style.background = `${PAL.bad}0D`} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span>⏻</span> {L("Log out", "Cerrar sesión")}</div>
          </div>}
        </div>
      </header>

      <main style={{ flex: 1, padding: isMobile ? "16px 14px" : "22px 24px", overflow: "auto" }}>
        {current.view(go, onLogout)}
        <div style={{ marginTop: 22, fontSize: 9.5, color: PAL.sub, textAlign: "center" }}>{L("CLV model BG/NBD + Gamma-Gamma · route:", "Modelo CLV BG/NBD + Gamma-Gamma · ruta:")} <code style={{ fontFamily: "monospace" }}>#/{slug}</code></div>
      </main>
    </div>
  </div>;
}

/* =================== ROOT: FLUJO DE SESIÓN =================== */
function AppShell() {
  // Entrada en 1 clic: 'Probar demo' va directo al dashboard; la puerta de
  // conexión vive dentro (mientras connected sea false). El login se conserva
  // en código pero queda fuera del flujo por defecto.
  const { disconnect } = useSession();
  const [stage, setStage] = useState("landing");
  if (stage === "landing") return <LandingView onEnter={() => { window.location.hash = "/overview"; setStage("app"); }} />;
  if (stage === "login") return <LoginView onLogin={() => { window.location.hash = "/overview"; setStage("app"); }} onBack={() => setStage("landing")} />;
  return <Dashboard onLogout={() => { disconnect(); window.location.hash = ""; setStage("landing"); }} />;
}

// El SessionProvider envuelve todo: la landing (preview), el login y el dashboard
// comparten el mismo dataset sintético por sesión.
export default function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}
