"use client";
// ============================================================
// SESSION PROVIDER — estado por sesión del lado del cliente
// ------------------------------------------------------------
// Origen de verdad: una SEMILLA. El dataset se DERIVA de ella, así
// que persistir la semilla (no el dataset) basta para que un visitante
// que vuelve vea "sus" mismos números. Costo cero: solo localStorage.
//
// SSR-safe: el servidor y el primer render del cliente usan una semilla
// baseline determinista (mismo HTML en ambos lados → sin hydration
// mismatch). Tras montar, se reemplaza por la semilla de la sesión.
// ============================================================
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { generateDataset, newSeed } from "../lib/synth";

const STORAGE_KEY = "vantix:session:v1";
const BASELINE_SEED = "vantix-baseline"; // determinista para SSR + primer render

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [seed, setSeed] = useState(BASELINE_SEED);

  // Tras montar (solo cliente): lee o crea la semilla de la sesión.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.seed) {
          setSeed(saved.seed);
          return;
        }
      }
      const s = newSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ seed: s }));
      setSeed(s);
    } catch {
      // localStorage no disponible (modo privado, etc.) → semilla efímera
      setSeed(newSeed());
    }
  }, []);

  // Re-siembra: nueva semilla = dataset distinto. Lo usará "Conectar fuente".
  const reseed = () => {
    const s = newSeed();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, seed: s }));
    } catch {
      /* ignora persistencia si no hay storage */
    }
    setSeed(s);
  };

  const dataset = useMemo(() => generateDataset(seed), [seed]);
  const value = useMemo(() => ({ seed, dataset, reseed }), [seed, dataset]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
