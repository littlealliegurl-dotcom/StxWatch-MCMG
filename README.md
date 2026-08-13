# StxWatch-MCMG

Evidence-based micro-cap trend and valuation dashboard, scored by the **IESE
(Investment Evidence Scoring Engine) v1.0** — a fixed five-category model
where every score traces back to a dated, sourced piece of evidence.

> See [`CONFLICTS.md`](./CONFLICTS.md) for the reasoning behind every
> judgment call made while merging this codebase's three source lineages
> (chat-thread design decisions, in-thread file iterations, and the AI
> Studio export).

## Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS v4, `motion` (Framer Motion
  successor), `lucide-react` icons
- **Backend:** Express 4, served through Vite's middleware in dev and static
  files in production
- **AI:** `@anthropic-ai/sdk` calling Claude with structured outputs
- **Persistence:** flat-file JSON store at `data/stocks.json` (no database
  required)

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set a real ANTHROPIC_API_KEY to enable live analysis
npm run dev
```

The dev server runs on `http://localhost:3000`.

Without an `ANTHROPIC_API_KEY` configured, the app still runs — `/api/stocks/analyze`
falls back to a clearly-labeled offline simulation engine so the UI is fully
exercisable without any external API key.

### Production build

```bash
npm run build
npm start
```

## Architecture

### Data model (`src/types.ts`)

The canonical record is `CompanyScore`:

```
CompanyScore
├── company     — ticker, name, industry, market cap, price, volume
├── score       — overall (0-100), confidence, trend, verification, evidence_strength, last_updated
├── categories  — demand / execution / competition / financial / external
│                 (each: score, trend, 2+ metrics)
├── evidence[]  — dated, sourced observations with reliability/confidence/impact
└── summary     — overall_assessment, key_risks, watch_items, next_catalysts
```

The five category weights are **fixed** at the engine level
(`SCORING_WEIGHTS` in `src/types.ts`) — Demand 25%, Execution 20%,
Competition 20%, Financial 20%, External 15% — and are never overridden
per-company. The top-line `score.overall` is always recomputed from these
weights server-side (`computeOverallScore()`), never taken directly from the
model's own output, so the headline number is always auditable against the
category breakdown shown in the same view.

Trend arrows (`↑↑ ↑ → ↓ ↓↓`) and verification ratings (`++ + ○ ? X`) are
locked enums, not free text, at both the top level and per-category.

### Server (`server.ts`)

- `GET /api/stocks` — returns all tracked companies (pre-seeded + persisted)
- `POST /api/stocks/analyze` — runs a fresh IESE analysis for a ticker via
  Claude (or the offline simulator if no API key is set),
  persists it, and returns the result
- `GET /api/config` — reports `{ demoMode }` so the client can show a banner
  without depending on `process.env` inside the browser bundle

Industry-specific indicators are **not** hardcoded per sector. Instead, the
Claude prompt asks the model to identify the company's actual industry and
then choose the two most relevant metrics for each of the five fixed
categories — so the categories stay constant while the underlying metrics
adapt per industry.

### Frontend (`src/App.tsx`)

- Landing page: search bar, ticker presets, and a card grid summarizing each
  tracked company (score, trend, verification, evidence-star rating,
  freshness indicator)
- Analysis modal: Business Health Meter (radial, derived from the overall
  score), confidence/verification panel, executive summary, the five
  category breakdowns with their metrics, top positive/negative evidence
  factors, risks/watch-items/catalysts, and an expandable Evidence Trail
  with per-item source, date, reliability, and confidence

## Pre-seeded companies

`ASTS`, `RENE`, `BMEA`, `LUNA`, `QUBT` — a small micro-/small-cap basket used
for local development and demos. These are overwritten the moment you
re-run analysis on the same ticker, since the analyze endpoint always
fetches a fresh, live-grounded record when a real API key is configured.
