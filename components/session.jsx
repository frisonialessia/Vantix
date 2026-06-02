"use client";
// ============================================================
// SESSION PROVIDER — estado por sesión del lado del cliente
// ------------------------------------------------------------
// Origen de verdad: una SEMILLA + si el usuario ya "conectó" una fuente.
// El dataset se DERIVA de la semilla; persistir { seed, company, connected }
// basta para que un visitante que vuelve (sin cerrar sesión) recupere su
// dashboard. Costo cero: solo localStorage, sin backend.
//
// Pipeline: el visitante llega DESCONECTADO (semilla baseline → la UI
// muestra la puerta de conexión). Al "conectar" una fuente sembramos desde
// el nombre de su empresa (determinista: Acme siempre ve el mismo dashboard)
// y marcamos connected=true → el dashboard se puebla con datos "suyos".
//
// SSR-safe: server y primer render usan la semilla baseline determinista
// (mismo HTML en ambos lados → sin hydration mismatch).
// ============================================================
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { generateDataset, newSeed } from "../lib/synth";

const STORAGE_KEY = "vantix:session:v1";
const LANG_KEY = "vantix:lang"; // preferencia de idioma, independiente de la sesión
const BASELINE_SEED = "vantix-baseline"; // determinista para SSR + estado vacío

// No pedimos nombre: derivamos uno presentable (y sus iniciales) del email.
function deriveName(email) {
  const local = (email || "").split("@")[0].replace(/[._\-+]+/g, " ").trim();
  if (!local) return "Invitado";
  return local.split(" ").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function deriveInitials(name, company) {
  const src = name && name !== "Invitado" ? name : company || "Vantix";
  const parts = src.trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2)).toUpperCase();
}

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [seed, setSeed] = useState(BASELINE_SEED);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [inputs, setInputs] = useState({});
  const [credits, setCredits] = useState(500);
  const [connected, setConnected] = useState(false);
  const [lang, setLangState] = useState("en"); // idioma principal: inglés

  // Tras montar (solo cliente): restaura idioma + sesión.
  useEffect(() => {
    try {
      const l = localStorage.getItem(LANG_KEY);
      if (l === "es" || l === "en") setLangState(l);
    } catch { /* */ }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.connected && saved.seed) {
          setSeed(saved.seed);
          setCompany(saved.company || "");
          setEmail(saved.email || "");
          setInputs(saved.inputs || {});
          setCredits(typeof saved.credits === "number" ? saved.credits : 500);
          setConnected(true);
        }
      }
    } catch {
      /* sin storage (modo privado) → arranca desconectado, datos baseline */
    }
  }, []);

  const persist = (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignora si no hay storage */
    }
  };

  // Conecta una fuente (simulada). Siembra desde el nombre de empresa si lo
  // hay (determinista y "suyo"); si no, una semilla aleatoria por sesión.
  const connect = (companyName, businessInputs = {}, userEmail = "") => {
    const name = (companyName || "").trim();
    const mail = (userEmail || "").trim();
    const s = name ? `co:${name.toLowerCase()}` : newSeed();
    setSeed(s);
    setCompany(name);
    setEmail(mail);
    setInputs(businessInputs);
    setCredits(500);
    setConnected(true);
    persist({ seed: s, company: name, email: mail, inputs: businessInputs, credits: 500, connected: true });
  };

  // Re-siembra manteniendo la conexión (otro "set" de datos simulados).
  const reseed = () => {
    const s = newSeed();
    setSeed(s);
    persist({ seed: s, company, email, inputs, credits, connected });
  };

  // Descuenta créditos por una acción (asistente, estudios…). Persiste el saldo.
  const spendCredits = (n = 1) => {
    if (credits < n) return false;
    const next = credits - n;
    setCredits(next);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const cur = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, credits: next }));
    } catch { /* ignora */ }
    return true;
  };

  // Desconecta (cerrar sesión): vuelve al estado vacío y permite re-demostrar
  // el flujo de conexión. Los datos son re-derivables del nombre de empresa.
  const disconnect = () => {
    setConnected(false);
    setCompany("");
    setEmail("");
    setInputs({});
    setCredits(500);
    setSeed(BASELINE_SEED);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignora */
    }
  };

  const userName = deriveName(email);
  const userInitials = deriveInitials(userName, company);
  const setLang = (l) => {
    const next = l === "es" ? "es" : "en";
    setLangState(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* */ }
  };
  // Helper de traducción co-localizada: L("English", "Español") → según idioma.
  const L = useMemo(() => (en, es) => (lang === "es" ? es : en), [lang]);

  const dataset = useMemo(() => generateDataset(seed, undefined, inputs, lang), [seed, inputs, lang]);
  const value = useMemo(
    () => ({ seed, dataset, company, email, userName, userInitials, inputs, credits, connected, lang, setLang, L, connect, reseed, spendCredits, disconnect }),
    [seed, dataset, company, email, inputs, credits, connected, lang]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
