# StxWatch-MCMG — Project State

_Last updated: August 9, 2026. This document is written to be the single onboarding read for a fresh start — everything a new conversation needs to pick up where this one left off, without needing the history that got us here._

## What this is

StxWatch-MCMG is a micro-cap stock analyzer that scores companies using a custom evidence-based framework called IESE (Investment Evidence Scoring Engine). It's a full-stack web app (React frontend, Express backend) plus a standalone automation pipeline that runs daily, scores a fixed basket of tickers, and writes structured results to Airtable for tracking over time.

**Repo:** `github.com/littlealliegurl-dotcom/StxWatch-MCMG` (public)

**Seed basket (the five tickers being tracked):** ASTS, RENE, BMEA, LUNA, QUBT

## Architecture

**Stack:** React 19, Vite 6, Tailwind CSS v4, Framer Motion, lucide-react, Express 4, `@google/genai` (Gemini API with Search Grounding), flat-file JSON persistence at `data/stocks.json`

**Scoring model — IESE v1.0:**
| Category | Weight |
|---|---|
| Demand | 25% |
| Execution | 20% |
| Competition | 20% |
| Financial | 20% |
| External | 15% |

Key design decisions baked into the app:
- `score.overall` is always computed server-side via `computeOverallScore()` — never trusted directly from Gemini's output, to keep scoring consistent and auditable
- Industry metrics are dynamic: Gemini identifies each company's actual industry, then picks the 2 most relevant metrics per category rather than using one fixed metric set for every company
- `GET /api/config` reports `{ demoMode: boolean }` so the frontend knows whether it's running on real or simulated data
- Business Health Meter: a five-state derived read (`excellent / strong / positive / neutral / at-risk`) computed via `getHealthState()` in `types.ts`

**Repo structure (all real, tracked source — no zip archives anymore):**
```
src/App.tsx          755 lines — main UI
src/types.ts         223 lines — types, scoring logic, health-state derivation
src/main.tsx          10 lines
src/index.css          1 line
server.ts             768 lines — Express backend, Gemini integration, API routes
scorer.ts             ~300 lines — standalone automation script (see below)
package.json / package-lock.json
vite.config.ts / tsconfig.json
.env.example / .gitignore
.github/workflows/daily-score.yml — GitHub Actions automation
SCORER.md             — automation-specific documentation
```

## The Automation Pipeline (scorer.ts)

This is the newest piece, built and debugged over this session. It runs independently of the web app — it doesn't need the app to be deployed anywhere, it just needs Node and network access.

**What it does each run:**
1. Loops through the seed basket (ASTS, RENE, BMEA, LUNA, QUBT)
2. For each ticker, calls Gemini (`ai.models.generateContent()` with Google Search grounding) to produce IESE scores
3. Falls back to a deterministic simulated score if Gemini fails or no key is configured — this fallback is intentional and safe, not a bug, but it means the data is fake when it's active (see Known Issues below)
4. Writes results to Airtable — one record per ticker per run
5. Writes a `scorer-debug.txt` file with the exact error text if anything failed, so failures are diagnosable without needing access to GitHub's log storage

**Run modes:**
- `npm run score` — dev, runs via tsx directly
- `npm run score:build` — bundles to `dist/scorer.cjs` via esbuild
- `npm run score:prod` — runs the bundled version
- **Automated:** `.github/workflows/daily-score.yml` runs every day at 09:00 UTC (4 AM EST, pre-market), and can also be triggered manually from the repo's Actions tab → "Daily IESE Scoring" → "Run workflow"

## Airtable Setup

There are **three** Airtable bases in play now — worth knowing about so nothing looks like clutter later:

1. **StxWatch-MCMG Repo Mirror** (`app28hlWLnX51LBxk`) — mirrors the repo's file structure as records (Files, Contributors, Conflicts & Changelog tables). Predates the scoring automation, untouched by `scorer.ts`.
2. **SCORES** (`apppoYLfhlaPHeFhO`), table `tblScores` (`tblyi3vwdStEI5Svh`) — the live table `scorer.ts` writes to. Fields: Ticker, Overall Score, Confidence, Last Updated, Demand, Execution, Competition, Financial, External, Evidence Count. Only genuine analysis lives here — every record is real.
3. **StxWatch Score Testing Archive** (`app7c5DL3Sc57zhL8`), table "Archived Test Records" — 32 records from the setup/debugging phase (simulated fallbacks from each bug fixed along the way, one manual test write, one empty placeholder), each tagged with a Data Source category and a plain-language Notes explanation of what happened. This is a real error log, not just discarded test data — worth a look if a similar failure pattern ever shows up again.

**Credentials required (as GitHub Actions secrets on the repo):**
- `AIRTABLE_PAT` — must have scopes `data.records:read` and `data.records:write` (not `data.recordComments:*` — easy mix-up in Airtable's token UI), and must have both bases listed under Access
- `GEMINI_API_KEY` — from https://aistudio.google.com/apikey

Both secrets are currently set correctly as of this writing.

## Current Status: Working End-to-End

The full pipeline runs successfully: GitHub Actions triggers → scorer runs → writes to Airtable → confirmed via direct record lookup. Nine debugging fixes went into getting here (see PROJECT_LOG.md for the blow-by-blow if it's ever needed, but it generally shouldn't be).

**Gemini grounding decision (resolved):** `gemini-3.5-flash` combined with Google Search grounding was hitting immediate `429 RESOURCE_EXHAUSTED` on the free tier — a known, widely-reported issue, not specific to this setup. Decision made: drop the grounding tool and run on training knowledge instead, staying on the free tier. Rationale, in Alonzo's words: "working and imperfect versus perfect and not working." The plan is to tighten the scoring model until it's producing exactly what's wanted, *then* enable billing and re-add live search grounding — not the other way around. This is implemented as of this writing; the prompt and system instruction were also adjusted so Gemini is explicit about working from training data rather than implying it searched live sources.

## Roadmap

- Score history log (12–15 entries per ticker) with a momentum indicator (↑↑, ↑, →, ↓, ↓↓)
- Desktop/tablet layout support for the web app (currently not built)
- A dashboard to visualize score trends over time from the Airtable history
- Once the scoring model is tuned and producing what's wanted: enable billing on the Gemini API project and re-add Google Search grounding for live-data analysis

## How to Pick This Back Up

If starting fresh: clone the repo, read this file, then read `SCORER.md` for automation specifics. Everything is in working order — the natural next step is watching a few days of automated runs and tuning the scoring model, not fixing anything.
