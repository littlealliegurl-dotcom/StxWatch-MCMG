# StxWatch-MCMG — read this first

**If you are a fresh session and the user asks "where did we leave off?", the answer
lives in `docs/STX_PROJECT_STATE_*.md` — there is exactly one such file, always the
current one. Read it before answering. Its §9 is titled "WHERE WE STOPPED" and is
written to be read cold.**

Do not answer continuity questions from this file alone. This file is a stable index;
the state document is the source of truth and is regenerated from live sources.

---

## What this is

Micro-cap stock analyzer scoring companies via IESE (Investment Evidence Scoring
Engine) v1.0 — five weighted categories, every score traceable to a dated observation.
React 19 + Vite frontend, Express API, Airtable persistence, plus a nightly GitHub
Actions job that scores a fixed basket.

Seed basket: ASTS, RENE, BMEA, LUNA, QUBT

## Where things live

| What | Where |
|---|---|
| **Current state / where we stopped** | `docs/STX_PROJECT_STATE_*.md` (one file, dated) |
| Append-only history of problems and fixes | `docs/PROJECT_LOG.md` |
| Design decisions and their rationale | `CONFLICTS.md` |
| Nightly automation specifics | `SCORER.md` |
| Data model | `src/types.ts` |

## Branches — the work is NOT on `main`

| Branch | Provider | State |
|---|---|---|
| `claude/repo-access-permissions-debug-37og3s` | Gemini | Deploy target. Verified locally. |
| `claude/native-claude-fork` | Claude | Complete; live path unverified. |
| `main` | — | **Stale. Do not deploy.** |

Both feature branches share the same architecture and Airtable schema. They differ
only in the model provider. Check the state document for current HEADs.

## Standing rules — these look wrong and are not

1. **Do NOT set Settings → Actions → Workflow permissions to "Read and write."**
   It currently reads read-only. That is correct. `daily-score.yml` declares its own
   `permissions: contents: write` and the override demonstrably works. Changing the
   repo default grants write to every future workflow and fixes nothing.

2. **Never use Airtable `performUpsert` on `Ticker`.** Both writers append, and
   `tblScores` holds many rows per ticker — upsert fails when more than one record
   matches the merge field. `listStocks()` collapses to the newest row per ticker
   on read.

3. **`AIRTABLE_PAT` needs `data.records:read` + `data.records:write`** — NOT
   `data.recordComments:*`. That exact mix-up cost a day once already.

4. **Neither branch uses live web search.** Grounding was dropped because it returns
   429 immediately on the Gemini free tier. Analysis runs on training knowledge and
   prompts instruct conservative confidence. Do not re-enable it without checking
   the state document first.

5. **A simulated record must never be mistakable for a real one.** `tblScores` has a
   `Data Source` column (`live`/`simulated`) for exactly this reason — fabricated
   scores went undetected for multiple runs before it existed. Any new write path
   must set it.

6. **`lib/` must stay serverless-safe.** No filesystem writes, no `app.listen()`, no
   Vite imports at module scope. `server.ts` previously called `fs.mkdirSync` at
   import time, which crashes a Vercel function before any route runs.

## Diagnosing a deployment

Two endpoints exist to make failures self-identifying. Use them in this order:

- `GET /api/health` — depends on nothing (no env vars, no network, no model call).
  JSON back means routing works. HTML or 404 means `vercel.json`, **not** credentials.
- `GET /api/config` — returns `ready` and `missing[]`, naming any unset credential.

Both report credentials as booleans only, never values.

## Verification before claiming something works

This project has a documented history of green-but-broken: CI reporting success while
Airtable writes failed, a `git push` fallback swallowing real errors, a caught
exception silently substituting fabricated data. Prefer an end-to-end proof (a real
commit, a real record, a real response body) over a status indicator. If a check was
not actually run, say so rather than inferring it.
