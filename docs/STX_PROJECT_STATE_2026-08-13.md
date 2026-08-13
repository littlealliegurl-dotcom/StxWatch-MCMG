# STX_PROJECT_STATE — 2026-08-13

**This is the canonical fallback document for StxWatch-MCMG.** If this thread is gone, memory is gone, or a fresh Claude session has zero history — start here. Everything needed to reboot system knowledge and resume work on the GitHub repo, the Airtable bases, the deployment, and the automation is in this one file. Live-verified against GitHub, Airtable and Vercel on the date above, not carried forward from older notes.

**Source-of-truth rule (unchanged):** GitHub (`littlealliegurl-dotcom/StxWatch-MCMG`) is the only authoritative version of the code. Airtable bases are downstream references. When anything disagrees with GitHub, GitHub wins. Always.

---

## 0. Jump-Start Procedure (read this if starting cold)

1. Clone `github.com/littlealliegurl-dotcom/StxWatch-MCMG` (public).
2. **The work is on branches, not `main`.** See §1. `main` is 2 commits behind and does **not** contain the deployable backend.
3. Read this file, then `SCORER.md` for automation specifics.
4. **Where we stopped:** the code is finished, committed and pushed. The only thing standing between here and a live deployment is entering two credential values into Vercel. See §9.
5. To check whether the deploy went through after this snapshot: hit `<deployment-url>/api/health` — it needs no credentials and answers the routing question on its own. Then `/api/config`, which names any missing credential explicitly.

---

## 1. Branch Layout — READ THIS FIRST

| Branch | HEAD | Provider | Secrets needed | State |
|---|---|---|---|---|
| `claude/repo-access-permissions-debug-37og3s` | `20d5cb4` | Gemini | `GEMINI_API_KEY`, `AIRTABLE_PAT` | **Deploy target.** Verified locally end-to-end. |
| `claude/native-claude-fork` | `780d735` | Claude | `ANTHROPIC_API_KEY`, `AIRTABLE_PAT` | Complete, builds clean, live path never executed. |
| `main` | `fa78a56` | Gemini | — | Stale. Pre-dates all backend work. Do not deploy. |

Both feature branches share the same architecture, persistence layer and Airtable schema. They differ **only** in the model provider. The fork exists because running the app on Gemini while the rest of the toolchain is Claude-side meant two SDKs, two credentials, two structured-output mechanisms and two independent failure modes.

**Recommended order:** deploy the Gemini branch first (it has a verified path), then switch the Vercel project to the fork — a branch change plus one environment-variable swap.

---

## 2. What This Is

Micro-cap stock analyzer scoring companies via IESE (Investment Evidence Scoring Engine). Full-stack web app (React frontend, Express backend) plus a nightly automation that scores a fixed basket and writes to Airtable.

**Seed basket:** ASTS, RENE, BMEA, LUNA, QUBT

## 3. Architecture (confirmed live on 2026-08-13)

**Stack:** React 19, Vite 6, Tailwind CSS v4, Motion, lucide-react, Express 4, Airtable REST persistence. Node >= 20 (pinned via `engines`).

**Scoring model — IESE v1.0** (`src/types.ts`, 223 lines, `SCORING_WEIGHTS`):

| Category | Weight |
|---|---|
| Demand | 25% |
| Execution | 20% |
| Competition | 20% |
| Financial | 20% |
| External | 15% |

Key design decisions:
- `score.overall` always recomputed server-side via `computeOverallScore()` — never trusted from the model
- Industry metrics are dynamic — the model picks 2 relevant metrics per category per company
- Business Health Meter: five-state derived read via `getHealthState()`
- No live web search on either branch. Analysis runs on training knowledge; prompts instruct conservative confidence.

**Repo structure (real, tracked, verified):**
```
api/[...path].ts      15 lines — Vercel serverless entry (catch-all)
lib/api.ts           104 lines — createApiApp(): 4 routes
lib/analysis.ts      333 lines — model call + simulated fallback
lib/store.ts         218 lines — Airtable persistence
lib/seed.ts          362 lines — PRE_SEEDED_STOCKS
src/App.tsx          755 lines — main UI
src/types.ts         223 lines — types, scoring, health-state
src/main.tsx          10 lines
src/index.css          1 line
server.ts             45 lines — local dev only (Vite + static + listen)
scorer.ts            401 lines — nightly automation
vercel.json / vite.config.ts / tsconfig.json / package.json
.github/workflows/daily-score.yml
CONFLICTS.md / README.md / SCORER.md / metadata.json / index.html
```

**API routes** (`lib/api.ts`):

| Route | Purpose |
|---|---|
| `GET /api/health` | Depends on nothing. Proves the serverless function is routing. Returns `ok`, `node`, and **booleans** for each credential — never values. |
| `GET /api/config` | `{demoMode, persistence, ready, missing[]}`. `missing` names any credential still unset. |
| `GET /api/stocks` | All tracked companies, newest first. |
| `POST /api/stocks/analyze` | Fresh analysis. Response carries `_meta.dataSource` (`live`/`simulated`) and `_meta.persisted`. |

## 4. Deployment (Vercel)

**Team:** `allie` (slug `allie14`, id `team_t4QM6nIM3sFjjk11bdGwryOW`)
**Status as of this snapshot: NOT YET DEPLOYED.** No Vercel project existed; the GitHub login connection had never been added to the Vercel account (the API returns "You need to add a Login Connection to your GitHub account first").

`vercel.json`:
```json
{
  "framework": "vite",
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```
The SPA rewrite excludes `/api/` so the catch-all function at `api/[...path].ts` handles those paths. `npm run build:web` is `vite build` only — the esbuild server bundle is not used on Vercel.

## 5. Airtable — four bases

**Credentials:** `AIRTABLE_PAT` needs `data.records:read` + `data.records:write` (**not** `data.recordComments:*` — that mix-up cost a day on Aug 8), with access to the SCORES base.

### a) SCORES — `apppoYLfhlaPHeFhO` — the live table
- Table `tblScores` — `tblyi3vwdStEI5Svh`
- Original fields: Ticker `fldqROIl1eYLHsEgg` · Overall Score `fldk8bPvWh1vB9IvA` · Confidence `fldzAwEjWrXJrPqSB` · Last Updated `fldUXQti9MUrF8Jhh` · Demand `fldicPX3f0RtnD9Lx` · Execution `fldrUcguTxu0CmohS` · Competition `fldlKvp0ftcMEIfib` · Financial `fldAUy19LcdMBixM0` · External `fldZ8UKgwwDi5HKL7` · Evidence Count `fldHKxN6PL83XnZu1`
- **Added 2026-08-13:** `Data Source` `fldD6C5LEV8x4xPpe` (singleSelect: `live` / `simulated`) · `Payload` `fldNcn3CEnqOUA9rn` (multilineText, full CompanyScore JSON)
- **Both writers append** — the scorer and the web app each POST a new row per ticker. Never switch to `performUpsert` on `Ticker`: many rows share a ticker and Airtable's upsert fails when more than one record matches. `listStocks()` collapses to the newest row per ticker on read.
- Unused default "Table 1" (`tblgdtZZqg10nROPs`) — ignore.

### b) StxWatch-MCMG Repo Mirror — `app28hlWLnX51LBxk` — stale since 2026-07-26, manual
### c) Repo Mirror (SOLO) — `appQRMpz3fYkxOVid` — FROZEN, never edit
### d) StxWatch Score Testing Archive — `app7c5DL3Sc57zhL8` — debug-phase records

All four confirmed present at `permissionLevel: create` on 2026-08-13.

## 6. GitHub Access — resolved, with one open thread

Audited exhaustively on 2026-08-13 (browser audit + API). **No server-side permission problem exists.**

| Surface | State |
|---|---|
| Branch protection / rulesets | None. Nothing blocks pushes. |
| Claude GitHub App | All repositories; read+write on code, workflows, actions, PRs |
| Actions `GITHUB_TOKEN` | Working — run #32 pushed `ab2df25..142f7dd` to `main` |
| Repo Actions secrets | `GEMINI_API_KEY`, `AIRTABLE_PAT` both set |
| Collaborators | `digital-Alchemy-mcmg` (write). Expired `metconmg` invite cancelled. |
| Classic PAT `081026-MCMG-StockWatch` | Narrowed to `repo` + `workflow`, expires 2026-09-10 |
| Two-factor auth | **NOT ENABLED** — open item |
| OAuth apps | Kimi GitHub Plugin and Z.ai revoked (both unused) |

**Do not "fix" this:** Settings → Actions → Workflow permissions reads *read-only*. That is correct. `daily-score.yml` declares its own `permissions: contents: write`, and runs #28–32 prove the override works. Flipping the repo default grants write to every future workflow and fixes nothing.

**The open thread:** the classic PAT still reads **"Never used"** after all of the above. Nothing is authenticating with it. If local pushes fail from a developer machine, that is the cause — check with `gh auth status` on that machine. It cannot be diagnosed from a browser or from a cloud session.

## 7. Nightly Automation

`.github/workflows/daily-score.yml` — cron `0 9 * * *`, though runs consistently land ~11:35 UTC. Runs #28–#32 all green. Each run appends one row per ticker to `tblScores` and commits `scorer-debug.txt`.

`scorer.ts` marks every row `live` or `simulated` in the Data Source column and prints a loud warning listing any simulated tickers. A green run that quietly wrote fabricated numbers is the failure this project has hit repeatedly; the column exists so it cannot recur silently.

## 8. Fixed on 2026-08-13

1. **`server.ts` called `fs.mkdirSync` at module load** — throws on a read-only serverless filesystem before any route runs. Flat-file persistence removed entirely.
2. **All routes lived inside `startServer()`** beside `app.listen()` and Vite middleware, so they could not be mounted anywhere else. Extracted to `lib/api.ts`.
3. **`vercel.json` rewrote `/api/(.*)` → `/api/$1`** — a no-op loop pointing at a directory that did not exist.
4. **`scorer.ts` sent no `responseSchema`**, so free-form JSON truncated before its closing brace and the greedy `/\{[\s\S]*\}/` match returned null — RENE fell through to simulated scores on every run. Constrained the response the way `server.ts` always did.
5. **`server.ts` still passed `tools: [{ googleSearch: {} }]`.** Grounding was dropped from the scorer because it 429s instantly on the free tier; the web path never got that fix, so every live analysis would have failed.
6. **Score coercion used `|| 50`**, silently turning a legitimate score of 0 into 50.
7. **The UI claimed "Google Search Grounding Enabled"** when grounding had been removed.
8. **`saveStock` used `performUpsert`** on a table with many rows per ticker — would have errored on the first analysis of any seed ticker.

## 9. WHERE WE STOPPED — resume here

**Everything that can be built without credentials is built, committed and pushed.** The remaining work is entering two values into Vercel.

Blocking, in order:
1. Add the GitHub login connection to the Vercel account (`https://vercel.com/account/login-connections`) — it has never been added.
2. Import the repo as project `stxwatch-mcmg` on team `allie`.
3. Set `GEMINI_API_KEY` and `AIRTABLE_PAT` for **Production AND Preview**. Preview is the one that matters — a branch deploy is a Preview deployment, and if Preview is unchecked the build succeeds and the app silently runs simulated.
   - Gemini key: viewable/copyable at `https://aistudio.google.com/apikey`
   - Airtable PAT: **value is shown once at creation and cannot be recovered.** Create a *new* token (`data.records:read` + `data.records:write`, access to SCORES). **Do not delete the existing one** — the nightly workflow depends on it and is currently green.
4. Turn Deployment Protection OFF (public repo, app meant to be reachable).
5. Deploy branch `claude/repo-access-permissions-debug-37og3s` — not `main`.

### Verification ladder (run in this order — each isolates one failure)

| Check | Green | If not |
|---|---|---|
| `/api/health` returns JSON | Serverless routing works | HTML/404 → `vercel.json` problem, **not** a credential problem |
| `/api/health` → `env.GEMINI_API_KEY: true` | Key landed | false → wrong environment scope (check Preview) |
| `/api/config` → `ready: true, missing: []` | Both credentials landed | `missing` names exactly which one didn't |
| `/api/stocks` returns a JSON array | Store reachable | — |
| Analyze `ASTS` → `_meta.dataSource: "live"` | Model path works | `simulated` → read the error in `_meta` |
| `_meta.persisted: true` | Airtable write from serverless works | false → check PAT scopes/base access |

### Known-unverified paths (as of this snapshot)

These are the reasons this was not called a guarantee. Each has a recognizable signature and a bounded fix:

1. **Serverless routing on Vercel** — `api/[...path].ts` + the SPA rewrite is reasoned from Vercel's filesystem-before-rewrites ordering, never executed. `/api/health` isolates it.
2. **The Gemini `responseSchema` fix** — diagnosis is solid (truncation proven in the debug log; fix copies `server.ts`'s working pattern) but has never run against the API.
3. **Airtable write from a serverless cold start** — the 12-field payload was validated against the live table via API, but not through a Vercel function with a 10s `AbortSignal.timeout`.
4. **The entire Claude fork's live path** — no `ANTHROPIC_API_KEY` was available to test with.

## 10. Roadmap

- Enable 2FA on the GitHub account
- Resolve the "Never used" PAT thread on the developer machine (`gh auth status`)
- Once the Gemini deploy is green: switch Vercel to `claude/native-claude-fork`, swap the env var, retire the Gemini key
- Merge the chosen branch to `main` and delete the other
- Score history / momentum indicator (↑↑ ↑ → ↓ ↓↓) — now partly free: `tblScores` is append-only, so history already accumulates
- Desktop/tablet layout for the web app
- Resync the Repo Mirror base (stale since 2026-07-26), or retire it

---

## Versioning Convention

- **Naming:** `STX_PROJECT_STATE_YYYY-MM-DD.md`, dated the day it is regenerated.
- **One canonical copy at a time.** The previous dated file is removed when a new one lands — `STX_PROJECT_STATE_2026-08-08.md` was deleted in the same commit that created this file. Git history preserves it.
- **When to regenerate:** after any meaningful architecture change, a resolved decision, a new base or table, a credential rotation, or a deploy.
- **How to regenerate:** re-pull live from GitHub, Airtable and Vercel — do not copy-edit from memory. `PROJECT_LOG.md` stays separate and append-only; this file is a single current snapshot.
