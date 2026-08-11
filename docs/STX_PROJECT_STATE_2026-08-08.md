# STX_PROJECT_STATE — 2026-08-08

**This is the canonical fallback document for StxWatch-MCMG.** If this thread is gone, memory is gone, or a fresh Claude session has zero history — start here. Everything needed to reboot system knowledge and jump-start work on the GitHub repo, the Airtable bases, and the automation is in this one file. Live-verified against GitHub and Airtable on the date above, not just carried forward from older notes.

**Source-of-truth rule (from the Repo Mirror base's own pinned operating procedures — adopted here as the standing rule for this whole project):** GitHub (`littlealliegurl-dotcom/StxWatch-MCMG`, branch `main`) is the only authoritative version of the code. Airtable bases are downstream, manually-synced references. When anything disagrees with GitHub, GitHub wins. Always. This document is a snapshot, not a substitute — if it ever looks stale, re-verify against GitHub and Airtable directly rather than trusting old numbers.

---

## 0. Jump-Start Procedure (read this if starting cold)

1. Clone `github.com/littlealliegurl-dotcom/StxWatch-MCMG` (public, default branch `main`).
2. Read this file fully, then `SCORER.md` in the repo for automation specifics.
3. Confirm the two GitHub Actions secrets are still set: `AIRTABLE_PAT`, `GEMINI_API_KEY` (see §5 for scopes).
4. Confirm Airtable access to the four bases in §4 — `list_bases` should return all four.
5. If you need to know "is the pipeline actually running," don't assume — pull recent records straight from `tblScores` (base `apppoYLfhlaPHeFhO`) and check the `Last Updated` timestamps.
6. Nothing here is currently broken or blocked on a decision (as of this date). If you're picking this up to keep building, go straight to §8 Roadmap.

---

## 1. What This Is

StxWatch-MCMG is a micro-cap stock analyzer scoring companies via a custom framework called IESE (Investment Evidence Scoring Engine). It's a full-stack web app (React frontend, Express backend) plus a standalone daily automation pipeline that scores a fixed ticker basket and writes results to Airtable.

**Seed basket:** ASTS, RENE, BMEA, LUNA, QUBT

## 2. Architecture (confirmed live against `main` on 2026-08-08)

**Stack:** React 19, Vite 6, Tailwind CSS v4, Framer Motion, lucide-react, Express 4, `@google/genai` (Gemini API), flat-file JSON persistence at `data/stocks.json`.

**Scoring model — IESE v1.0** (confirmed in `src/types.ts` on `main`, 223 lines, `SCORING_WEIGHTS` constant):
| Category | Weight |
|---|---|
| Demand | 25% |
| Execution | 20% |
| Competition | 20% |
| Financial | 20% |
| External | 15% |

Key design decisions:
- `score.overall` always computed server-side via `computeOverallScore()` — never trusted directly from Gemini's output
- Industry metrics are dynamic — Gemini picks the 2 most relevant metrics per category per company
- `GET /api/config` reports `{ demoMode: boolean }`
- Business Health Meter: five-state derived read (`excellent / strong / positive / neutral / at-risk`) via `getHealthState()` in `types.ts`

**Repo structure (real, tracked source):**
```
src/App.tsx          755 lines — main UI
src/types.ts         223 lines — types, scoring logic, health-state derivation
src/main.tsx          10 lines
src/index.css          1 line
server.ts             768 lines — Express backend, Gemini integration, API routes
scorer.ts             ~300 lines — standalone automation script
package.json / package-lock.json
vite.config.ts / tsconfig.json
.env.example / .gitignore
.github/workflows/daily-score.yml
SCORER.md
```

## 3. Automation Pipeline (`scorer.ts`)

1. Loops through the seed basket
2. Calls `ai.models.generateContent()` — confirmed live as the correct `@google/genai` method (not the old `ai.getGenerativeModel()`, which was a real bug earlier — see §7)
3. Scores from **training knowledge, not live search** (decision below) — falls back to a deterministic simulated score only if Gemini fails or no key is set
4. Writes one record per ticker per run to `tblScores`
5. Writes `scorer-debug.txt` on any failure, with exact error text

**Run modes:** `npm run score` (dev/tsx) · `npm run score:build` (esbuild bundle) · `npm run score:prod` (bundled)
**Automated:** `.github/workflows/daily-score.yml` — cron `0 9 * * *` (09:00 UTC / 4am EST, pre-market) + manual `workflow_dispatch`. Confirmed live: `permissions: contents: write` is set, the push step has no error-swallowing fallback, the commit step only fires on a genuine `git diff --cached`, pushes go to `main`.

## 4. Gemini Grounding Decision — RESOLVED, live and running

`gemini-3.5-flash` + Google Search grounding hit immediate `429 RESOURCE_EXHAUSTED` on the free tier — a known, widely-reported issue, not specific to this setup.

**Decision:** dropped grounding, running on training knowledge, staying free-tier. In Alonzo's words: *"working and imperfect versus perfect and not working."* Plan: tighten the scoring model first, enable billing and re-add live grounding later.

Confirmed live in `scorer.ts`'s system instruction: the model is explicitly told it has no live search access, to keep confidence scores conservative, and to be honest about uncertainty rather than fabricate.

## 5. Airtable — full reference (four bases)

**Credentials:** `AIRTABLE_PAT` needs scopes `data.records:read` + `data.records:write` (not `data.recordComments:*`), Access granted to at least the SCORES and Repo Mirror bases. `GEMINI_API_KEY` from https://aistudio.google.com/apikey. Both confirmed set and working.

### a) SCORES — `apppoYLfhlaPHeFhO` — the live table `scorer.ts` writes to
- Table `tblScores` — `tblyi3vwdStEI5Svh`
- Fields: Ticker `fldqROIl1eYLHsEgg` · Overall Score `fldk8bPvWh1vB9IvA` · Confidence `fldzAwEjWrXJrPqSB` · Last Updated `fldUXQti9MUrF8Jhh` · Demand `fldicPX3f0RtnD9Lx` · Execution `fldrUcguTxu0CmohS` · Competition `fldlKvp0ftcMEIfib` · Financial `fldAUy19LcdMBixM0` · External `fldZ8UKgwwDi5HKL7` · Evidence Count `fldHKxN6PL83XnZu1`
- There's also an unused default "Table 1" (`tblgdtZZqg10nROPs`) auto-created by Airtable — ignore it, not part of the pipeline.
- **Snapshot pulled 2026-08-08:** most recent run landed ~02:19–02:21 UTC (a prior run ~02:01–02:03 UTC same session). Sample confidence values: ASTS 70, RENE 60, QUBT 30 — varied and conservative, consistent with genuine training-knowledge analysis rather than the flat simulated fallback. This will drift daily; re-pull rather than trusting these numbers going forward.

### b) StxWatch-MCMG Repo Mirror — `app28hlWLnX51LBxk` — WORKING COPY, manually synced
- Predates the scoring automation; not touched by `scorer.ts`
- Tables: Files (`tbluUs2LX718SryaD`), Contributors (`tbliy9OyqwzYDAkZq`), Conflicts & Changelog (`tbl8dOGRTHuDr1zvL`)
- **Important — this base is self-admittedly stale.** Its own pinned "0. OPERATING PROCEDURES" record (in Conflicts & Changelog) states its Files table was last synced 2026-07-26 and reflects an older snapshot of the repo — it has NOT been resynced to reflect the current scoring automation (`scorer.ts`, the daily workflow, the IESE v1.0 rebuild). Don't treat this base's Files table as current file state. Resync it by hand if you need it to be useful, or just work from GitHub directly.
- Also contains one unrelated record: a separate forked project called "company-valuation-analyzer" (different ticker basket, different codebase) was logged here for reference on 2026-07-27. It is explicitly **not** part of StxWatch-MCMG — a different lineage, noted but not merged.

### c) StxWatch-MCMG Repo Mirror (SOLO) — `appQRMpz3fYkxOVid` — FROZEN, never edit
- Immutable snapshot captured 2026-07-26. Same table structure as (b). Kept as a permanent point-in-time reference; the working copy is (b), not this one.

### d) StxWatch Score Testing Archive — `app7c5DL3Sc57zhL8`
- Table "Archived Test Records" — `tblFgIAaiVwHbQS3U`
- Fields: Ticker `fldcGdXoofkQmzU7L` · Overall Score `fldAdHYsBUJt7f3mQ` · Confidence `fld6ICr3uqmIH4qdn` · Demand `fldvdbfjxQMvtxr3o` · Execution `fldnrK4NxZebVM1I7` · Competition `fldmm1Gu2sIlHbgsm` · Financial `fldmjZ3j9qHFRpobT` · External `fldaybGUxIEkOS5i0` · Evidence Count `fldVdG8AQaQtccoMt` · Original Timestamp `fldFoW6aFCHL5CEkB` · Data Source `fldpXr0HOLF2FRqsw` · Notes `fld8DGAqPYCriieBP`
- Holds the setup/debugging-phase records (Aug 8–9) kept separate so `tblScores` stays clean. This is a real error log, worth checking first if a similar failure pattern ever shows up again.

## 6. Getting GitHub Write Access (if setting up a new token)

Use a **classic** PAT with `repo` scope, plus `workflow` scope if the token will ever push to `.github/workflows/`. Fine-grained tokens default to no repo access and gate workflow files separately — this cost real time once already; don't repeat it.

## 7. Debugging History (condensed — full detail in PROJECT_LOG.md if it's ever needed)

Nine fixes got the pipeline from broken to working, most of them one silent failure uncovering the next:
1. Fine-grained PAT → switched to classic `repo` token
2. Missing `workflow` scope on the token → added
3. Repo held zip archives only → unpacked to real tracked source
4. `writeScoresToAirtable()` swallowed its own errors → now sets `process.exitCode = 1` on failure
5. Workflow's push step had a blanket `|| echo` fallback masking real failures → removed, now only skips on a genuinely empty diff
6. Default `GITHUB_TOKEN` lacked write access → added `permissions: contents: write`
7. Airtable token had `data.recordComments:*` instead of `data.records:*`, and was missing Access to the new SCORES base → both fixed
8. `scorer.ts` called `ai.getGenerativeModel()` (wrong package's method) → fixed to `ai.models.generateContent()`, matching `server.ts`'s working pattern. This one mattered a lot: every run up to this fix — including the first one that "successfully" wrote to Airtable — was silently writing fake simulated numbers, not real analysis.
9. Free-tier Gemini grounding hit `429 RESOURCE_EXHAUSTED` → resolved per §4 (dropped grounding, training-knowledge mode)

**The generalizable lesson:** nearly every fix uncovered a different problem underneath because something was failing silently instead of loudly (green CI with zero Airtable writes, a push fallback eating real errors, a caught exception quietly substituting fake data). None of these showed up under "did the job succeed" — they needed actual error text surfaced and read. `scorer-debug.txt`, committed on every run via `if: always()`, was the single most useful diagnostic tool in the whole process.

## 8. Roadmap (open, nothing urgent, nothing blocked)

- Score history log (12–15 entries per ticker) with a momentum indicator (↑↑, ↑, →, ↓, ↓↓)
- Desktop/tablet layout support for the web app (not built yet)
- Dashboard to visualize score trends over time from Airtable history
- Once the scoring model is tuned: enable Gemini billing, re-add Google Search grounding for live-data analysis
- Resync the Repo Mirror (working copy) base's Files table — it's been stale since 2026-07-26

---

## Versioning Convention — how this document stays canonical

- **Naming:** `STX_PROJECT_STATE_YYYY-MM-DD.md`, dated the day it's regenerated.
- **One canonical copy at a time.** When a new version is generated, remove the previous dated file from the project so there's never more than one `STX_PROJECT_STATE_*.md` in play — the exact confusion that made this reconciliation necessary the first time shouldn't happen again.
- **When to regenerate:** after any meaningful architecture change, a resolved open decision, a new Airtable base or table, a credential rotation, or roughly whenever it's been a while and you want a fresh live-verified snapshot rather than trusted-from-memory notes.
- **How to regenerate:** don't just copy-edit this file from memory — re-pull live from GitHub and Airtable the way this version was built, so drift doesn't compound. PROJECT_LOG.md stays separate and cumulative (append-only history); this file stays a single current snapshot.
