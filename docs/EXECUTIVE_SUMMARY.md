# Vantix — Executive Summary

**One line:** A proof-of-concept SaaS that predicts customer churn and lifetime value (CLV) and turns it into decisions — personalized to each visitor's business, with a real AI assistant, at near-zero running cost.

**Live demo:** https://vantix-inky.vercel.app

---

## The problem

For most subscription and customer-driven businesses, the intelligence needed to fight churn and grow customer value is **fragmented and expensive**: data lives in a warehouse, dashboards in a BI tool, models in notebooks, and the "so what?" in someone's head. Decisions arrive late, and the link between a metric (churn, CLV, NRR) and its **financial impact** is rarely explicit.

## What Vantix demonstrates

A single, opinionated surface where:

1. **You start empty and connect your business** — name + a few parameters (industry, approximate MRR, number of customers).
2. **A dashboard is generated, scaled to your numbers** — 40+ views: churn root cause, CLV attribution, live cohorts, RFM value×risk, forecasting, Monte Carlo, network analysis, financial modeling, governance/RBAC, and more.
3. **An AI assistant explains and recommends** — grounded on your session data, always tying the metric to its financial impact and the next best action.

Everything a buyer would want to *feel* in an evaluation — personalization, depth, and a credible AI layer — without onboarding, data integration, or cost.

## Why it matters (the bet)

Vantix is part of a **"SaaS Factory"** experiment: build credible, end-to-end SaaS demos quickly, in public, to establish authority and validate positioning before investing in a real data backend. The interesting constraint was: **make it feel like a first-tier product while spending almost nothing to run it.**

## What was built

- **Personalized synthetic experience** — deterministic per-session data derived from the visitor's inputs (the same company always sees the same dashboard), so every demo feels bespoke.
- **Real AI assistant** — Google Gemini behind a server-side proxy, grounded on the live session snapshot, with a credits abstraction and rate-limiting as cost guards.
- **Lead capture** — email + business parameters stored in Supabase, so the demo doubles as a validation channel.
- **Bilingual (EN/ES)** and **fully responsive** (desktop / tablet / phone).
- **Honest framing** — labeled as a proof of concept with a synthetic-data disclaimer.

## How it runs at near-zero cost

- **No real data pipeline** — a seeded synthetic-data engine generates everything on the client.
- **Three runtime dependencies** (Next.js, React, Recharts); AI and database calls are plain `fetch`, no SDK bloat.
- **Free tiers** — Vercel (hosting/CI) and Supabase (lead store); the only variable cost is AI tokens, capped by credits + rate-limiting.

## Status & roadmap

**Status:** live proof of concept, 100% functional end-to-end (personalization → AI → lead capture), bilingual and responsive.

**Possible next steps:** a category-defining churn layer (Customer 360 drill-down, a Health Score primitive, retention Playbooks), a custom domain, and richer empty/loading states.

## Disclaimer

Proof of concept, for demonstration only. All figures are synthetic and generated from user inputs — no real customer data is processed. Third-party brand names are shown to illustrate AI models and potential integrations and do not imply any partnership or endorsement.
