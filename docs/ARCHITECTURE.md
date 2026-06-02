# Vantix — Architecture (Master Doc)

This document describes the complete system: the design philosophy, the stack, every subsystem, the data flow, and the decisions behind them. It is the technical companion to the [Executive Summary](EXECUTIVE_SUMMARY.md).

---

## 1. Design philosophy

Three constraints shaped every decision:

1. **Feel first-tier, cost near zero.** No real data backend; a deterministic synthetic engine produces a bespoke experience per visitor. The only variable cost (AI tokens) is capped by credits + rate-limiting.
2. **Keep the surface tiny.** Three runtime dependencies. AI and database access are plain `fetch` against REST endpoints — no SDKs — which also keeps secrets server-side.
3. **Reusable core.** The synthetic-data engine and the LLM proxy are written to be lifted into the next SaaS with minimal change.

---

## 2. Tech stack & languages

| Area | Technology | Notes |
|------|------------|-------|
| Framework | Next.js **14.2.5** (App Router) | Server components + serverless route handlers |
| UI runtime | React **18.3.1** + JSX | Single-page feel via client state, no router lib |
| Styling | **Inline styles** + one `globals.css` | No CSS framework; a locked design-token palette |
| Charts | Recharts **2.12.7** + hand-authored SVG | Custom SVG for ridgeline, boxplots, waterfall, RFM heatmap, calendars, network graph |
| AI | Google **Gemini** (`gemini-2.5-flash`) | Behind a provider-agnostic proxy (Gemini / demo / Anthropic / OpenAI ready) |
| Lead store | **Supabase** (Postgres) | REST insert, Row-Level Security insert-only |
| Hosting / CI | **Vercel** | Push to `main` → automatic production deploy |
| Tooling | ESLint (`eslint-config-next`) | |

**Languages:** JavaScript (ES2020+), JSX, CSS, SQL (Supabase RLS policy), Markdown, JSON.

---

## 3. The four-layer data architecture

Vantix was designed around four conceptual layers. Today the product implements Layers 1–3; Layer 4 is the upgrade path to a real backend.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4  REAL DATA (future)                                  │
│           swap the engine for warehouse/ETL connectors        │
├─────────────────────────────────────────────────────────────┤
│  Layer 3  INTELLIGENCE   AI assistant (Gemini) grounded on    │
│           the session snapshot · credits · rate-limit         │
├─────────────────────────────────────────────────────────────┤
│  Layer 2  SESSION        SessionProvider · localStorage ·     │
│           connection gate · language · credits                │
├─────────────────────────────────────────────────────────────┤
│  Layer 1  SYNTHETIC DATA seeded deterministic engine          │
│           generateDataset(seed, profile, inputs, lang)        │
└─────────────────────────────────────────────────────────────┘
```

The key idea: **the source of truth is a seed**. The dataset is *derived* from it, so persisting `{ seed, company, inputs }` is enough to fully reconstruct a returning visitor's dashboard — no database required.

---

## 4. Repository map

```
app/
  api/assistant/route.js   serverless LLM proxy (key + rate-limit live here)
  api/lead/route.js        lead capture → Supabase REST
  globals.css              base styles + responsive media queries
  icon.svg                 favicon (gradient "V")
  layout.js                root layout, fonts, metadata (lang="en")
  page.js                  mounts <App/>
components/
  VantixApp.jsx            the entire UI: landing, connect gate, dashboard, 40+ views
  session.jsx              SessionProvider/useSession, persistence, useIsMobile
lib/
  synth.js                 synthetic-data engine (PRNG, profile, generateDataset, toSnapshot)
  llm.js                   provider-agnostic LLM client (askLLM)
docs/                      this documentation
```

---

## 5. Subsystems

### 5.1 Synthetic-data engine — `lib/synth.js`

- **Deterministic PRNG.** A string hash (`xfnv1a`) turns a seed string into an integer, which feeds `mulberry32` for a fast, seeded pseudo-random stream. Same seed → identical dataset, on server and client (no hydration mismatch).
- **`generateDataset(seed, profile = VANTIX_PROFILE, inputs, lang)`** builds the full dataset: KPIs, alerts, narrative, channels, cohorts, retention plan, etc. Money figures **scale to the user's inputs** (e.g. approximate MRR), so a $30k/mo business and a $2M/mo business see proportionate numbers.
- **Bilingual output.** Generated strings (alerts, narrative, retention plan) are produced directly in the active language.
- **`toSnapshot(dataset, company)`** flattens the dataset into a compact text snapshot used to **ground** the AI assistant.

### 5.2 Session & state — `components/session.jsx`

- **`SessionProvider`** exposes: `seed, dataset, company, email, userName, userInitials, inputs, credits, connected, lang, setLang, L, connect, reseed, spendCredits, disconnect`.
- **Connection gate.** Visitors arrive *disconnected* (baseline seed → empty-state UI). `connect(company, inputs, email)` seeds deterministically from the company name, flips `connected`, and the dashboard populates.
- **Persistence.** `{ seed, company, email, inputs, credits, connected }` is stored in `localStorage`, so a returning visitor recovers their dashboard. Language preference is stored separately.
- **Derived identity.** A presentable name + initials are derived from the email (no extra form fields).
- **`useIsMobile(bp)`** — SSR-safe viewport hook (false on server/first render, then adjusts) used for structural responsive branches.

### 5.3 AI assistant — `lib/llm.js` + `app/api/assistant/route.js`

- **Provider-agnostic.** `askLLM(messages, { lang, context })` switches on `LLM_PROVIDER` (`gemini` implemented; `demo`, `anthropic`, `openai` stubbed). Swapping providers never touches the UI.
- **Grounding.** The system prompt is augmented with the session `toSnapshot(...)` as the *only* source of truth for figures, plus a language directive and a "reply in plain text, no Markdown" instruction.
- **Security.** The API key is read from `process.env` inside the serverless route — it never reaches the client or the repo.
- **Cost guards.** An in-memory rate-limiter allows **15 requests / 60s / IP** (the map self-clears past 5,000 entries); the UI also spends **credits** per call. `demo` mode returns pre-generated answers at absolute zero cost.
- **Clean rendering.** The client renders assistant replies through a tiny Markdown sanitizer (real bold + bullets, stray `*`/backticks/`#` stripped) so model formatting never leaks as raw characters.

### 5.4 Lead capture — `app/api/lead/route.js`

- POSTs `{ email, company, industry, mrr_band, customers_band, source: "vantix-demo" }` to `${SUPABASE_URL}/rest/v1/leads`.
- Uses the **anon** key with an RLS **insert-only** policy: the public key can write a lead but cannot read the table.
- **Graceful degradation:** if the Supabase env vars are absent, the endpoint returns `ok` without storing, so the demo never breaks.

Required RLS policy:

```sql
alter table public.leads enable row level security;
create policy "anon insert leads" on public.leads
  for insert to anon with check (true);
```

### 5.5 Internationalization

- A co-located helper `L("English", "Español")` returns the right string (or JSX fragment) based on `lang`.
- Data arrays use `{ en, es }` objects resolved via `L(x.en, x.es)`.
- English is primary; a compact `EN | ES` toggle (in the nav, and in the mobile drawer for the dashboard) flips everything live and persists the choice.

### 5.6 Responsive design

- **`globals.css` media queries** using attribute selectors (e.g. `[style*="repeat(3, 1fr)"]`) collapse grids by breakpoint — they reach the landing & gate, which live outside `<main>`.
- **Fluid typography** via `clamp()` for hero/section headings.
- **`useIsMobile`** drives structural branches (e.g. the product preview swaps a scaled desktop frame for a pill-nav + natural-width mobile variant; the dashboard sidebar becomes a drawer).
- **Higher-specificity exceptions** (`div.cardrow` → 2-up KPI rows, `div.matrixgrid` → preserve the RFM matrix) override the blanket single-column collapse without fragile `:not()` chains.

### 5.7 Design system

A locked palette (indigo brand, fixed semantic good/warn/bad, neutral panels, a sequential data ramp), Inter + Space Grotesk fonts, and inline styles throughout — deliberately no CSS framework, to keep the bundle and the mental model small.

---

## 6. User flow

```
Landing ──Try demo──▶ Connect gate ──connect()──▶ Dashboard
  │                      │  email + company + params      │
  │                      ▼                                ▼
  │                 POST /api/lead                  generateDataset(seed…)
  │                 → Supabase                       AI Assistant ─▶ POST /api/assistant
  └─ View source (GitHub) · EN/ES · PoC badge        → Gemini (grounded on snapshot)
```

State is restored from `localStorage` on return; "Log out" clears it and returns to the empty state.

---

## 7. Security & privacy

- Secrets (Gemini key, Supabase keys) live only in server env vars; never shipped to the client or committed.
- Supabase RLS is insert-only for the public key.
- All dashboard figures are synthetic; no real customer data is processed. The connect form stores only the email + coarse business bands the user volunteers.

---

## 8. Cost model

| Item | Cost |
|------|------|
| Hosting / CI (Vercel) | Free tier |
| Lead store (Supabase) | Free tier |
| Dashboard data | $0 — generated client-side |
| AI tokens | Only variable cost; bounded by credits + 15 req/min/IP, and avoidable via `demo` mode |

---

## 9. Deployment & CI

- Hosted on Vercel; **every push to `main` triggers a production deploy**.
- Env vars are configured in the Vercel project (Production scope) and take effect on the next deployment.
- Local development: `npm run dev`; production build verified with `npm run build` before each merge.

---

## 10. Notable decisions

- **Seed-as-source-of-truth** → full personalization with zero backend and no hydration mismatch.
- **Plain `fetch` over SDKs** → fewer dependencies, smaller attack surface, keys stay server-side.
- **Provider-agnostic LLM proxy** → the AI vendor is a one-line env change.
- **Inline styles + attribute-selector media queries** → responsive on a styling system with no class names, without adopting a framework.
- **Credits + rate-limit** → the demo can be public without an open-ended token bill.

---

## 11. Roadmap

- **Layer 4:** replace the synthetic engine with real warehouse/ETL connectors behind the same `dataset` shape.
- **Category-defining churn layer:** Customer 360 drill-down, a Health Score primitive, retention Playbooks.
- **Polish:** custom domain, richer empty/loading states, optional dark mode.
