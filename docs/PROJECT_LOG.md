# StxWatch-MCMG — Build & Debug Log

_This is reference material, not required reading. PROJECT_STATE.md is the one to start with. This file exists so that if a similar problem comes up again, there's a record of what it looked like and how it got fixed, instead of re-solving it from scratch._

## Getting GitHub write access

The first blocker was GitHub write access. The initial Personal Access Token was created as a **fine-grained token**, which GitHub now defaults to when you click "Generate new token." Fine-grained tokens don't work like the old `repo` checkbox — they need an explicit **Contents: Read and write** permission per repository, and it defaults to no access. That mismatch caused a 403 on the first push attempt. Switching to a **classic token** with the `repo` scope fixed it immediately — classic tokens are simpler for this kind of single-repo automation work and there was no reason to fight the fine-grained UI further.

A second, smaller version of the same problem showed up later: pushing the GitHub Actions workflow file itself failed with "refusing to allow a Personal Access Token to create or update workflow... without `workflow` scope." Classic tokens gate `.github/workflows/` changes behind a separate scope from general repo write access. Adding `workflow` to the token's scopes resolved it.

## Unpacking the repo

The repo started out holding only two zip archives (a canonical build and a raw AI Studio export) rather than tracked source files. This got fixed by cloning the repo, unzipping the canonical build, verifying line counts matched what was expected (755 lines in `App.tsx`, 768 in `server.ts`, 223 in `types.ts` — all confirmed), removing the zips, and committing the real file tree. Straightforward once GitHub write access was sorted.

## Building the automation — and the bugs that came with it

`scorer.ts` and the GitHub Actions workflow were built to run the IESE scoring model against the seed basket daily and write results to Airtable. Getting this actually working end-to-end took several rounds of debugging, each one hiding the next:

**Airtable base confusion.** The `tblScores` table ended up created in a brand-new, separate Airtable base rather than the original StxWatch-MCMG Repo Mirror base. This wasn't actually a problem — Airtable doesn't support merging bases anyway — but it meant the scorer's base ID needed to point at the new base, and it created some confusion later about which base's token access mattered.

**Silent failure #1 — bad error handling in the script itself.** The very first automated run reported "success" in GitHub Actions but wrote zero records to Airtable. The bug: `writeScoresToAirtable()` caught its own errors and just logged them, never surfacing the failure to the process exit code. Fixed by having it return a success/failure boolean and setting `process.exitCode = 1` when anything failed — so "green" in GitHub Actions actually means something now.

**Silent failure #2 — the workflow's own fallback logic.** Once the script started failing loudly, the "Push changes" step in the workflow still reported success even when the underlying `git push` failed, because it had a `|| echo "No changes to push"` fallback that swallowed *any* failure, not just the "nothing to commit" case. This one was sneaky — it took adding a debug-log file and watching a run where the commit succeeded locally but never made it upstream to catch. Fixed by removing the blanket fallback and only skipping the commit step when `git diff --cached` is genuinely empty.

**Silent failure #3 — missing workflow permissions.** Once the push step could fail honestly, it did — with a real permissions error. The default `GITHUB_TOKEN` that Actions provides has read-only repo access unless the workflow explicitly requests otherwise. Adding `permissions: contents: write` at the workflow level fixed it.

**The actual Airtable permission problem.** Once all three of the above were fixed, the real underlying error became visible for the first time: `403 INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`. Diagnosing this took a few passes because the token's scopes were initially wrong in a way that wasn't obvious — it had `data.recordComments:read/write` (permission to manage comments *on* records) instead of `data.records:read/write` (permission to manage the record data itself). Separately, the token's Access list only included the original Repo Mirror base, not the new Scores base. Both had to be fixed together: correct scopes, plus both bases added under Access.

**The Gemini SDK bug.** Separately from the Airtable issue, the scorer was calling `ai.getGenerativeModel(...)`, which is a method from the *old* `@google/generative-ai` package — it doesn't exist on `@google/genai`'s `GoogleGenAI` class, which is what this project actually uses (confirmed by checking how `server.ts` already does it successfully: `ai.models.generateContent(...)`). This error was being caught and silently falling back to simulated scores, so every run up to this point — including the first one that successfully wrote to Airtable — was writing fake, deterministically-generated numbers, not real analysis. This looked like success from every angle available (green CI, real records in Airtable) until the actual score values were hand-checked against the simulation's formula and found to match exactly.

**The current, unresolved issue — Gemini free-tier grounding quota.** After fixing the SDK call, real API calls started firing, but immediately hit `429 RESOURCE_EXHAUSTED`. This turned out not to be a burst/rate-limit problem (adding delays between requests didn't help) — it's a currently-widespread, documented issue with `gemini-3.5-flash` combined with Google Search grounding on free-tier API keys, returning quota-exceeded errors even on a fully fresh key with zero prior usage. This is on Google's side, not fixable through code or Airtable/GitHub configuration. See PROJECT_STATE.md for the options going forward.

## Lessons that generalized across this whole session

A pattern worth naming: nearly every "fix" in this session actually uncovered a *different* problem underneath, because something along the way was failing silently instead of loudly. GitHub Actions reporting green when Airtable writes failed. A `git push` fallback swallowing real errors. A caught exception silently substituting fake data for real analysis. None of these were caught by "did the job succeed" — they needed the actual error text surfaced and read. The `scorer-debug.txt` file (committed to the repo on every run, `if: always()`) turned out to be the single most useful diagnostic tool in this whole process, precisely because GitHub's own log storage was outside this environment's reachable network and had to be worked around.

## 2026-08-13 — Backend made deployable; Claude-native fork

A full day on two fronts: proving where the access problem actually was, and making the backend something Vercel could run.

**The access question resolved, and not where it was expected.** An exhaustive audit of every GitHub surface — branch protection, rulesets, the Claude app installation, Actions permissions, OAuth grants, both token types — found no server-side problem at all. Write access was proven by triggering run #32, which pushed a real commit to `main`. The one anomaly: the classic PAT reads "Never used". Nothing authenticates with it. Whatever local setup was expected to use it isn't reaching it, and that is the only surface a browser audit structurally cannot see.

A trap worth recording: Settings → Actions → Workflow permissions reads *read-only*, which looks like the obvious culprit. It isn't. The workflow declares its own `permissions: contents: write` and the override demonstrably works. Flipping the repo default would have widened write access for every future workflow and fixed nothing.

**Three things made the app undeployable, none of them obvious from reading the code linearly.** `server.ts` called `fs.mkdirSync` at module load — fine on a long-running host, fatal on a read-only serverless filesystem, and it fires at *import* time so no route ever runs. All three API routes lived inside `startServer()` next to `app.listen()` and the Vite middleware, so they couldn't be mounted anywhere else. And `vercel.json` rewrote `/api/(.*)` to `/api/$1` — a loop pointing at a directory that didn't exist.

**Two correctness bugs surfaced on the way in.** `server.ts` still passed `tools: [{ googleSearch: {} }]` — grounding had been dropped from the scorer in August because it 429s instantly on the free tier, but the web path never got the same fix, so every live analysis would have failed. And score coercion used `|| 50`, silently turning a legitimate score of 0 into 50.

**The RENE bug, diagnosed properly.** `scorer.ts` sent `responseMimeType` but no `responseSchema`, so generation was free-form and could stop mid-object. RENE's response ended at `"evidence_count": 5` with no closing brace — and the logged excerpt was ~152 characters against a 500-character window, so it wasn't the logger clipping it. The greedy `/\{[\s\S]*\}/` match then returned null and the run fell through to simulated scores. Same class as the earlier `getGenerativeModel` bug: `scorer.ts` had drifted from the working pattern sitting next to it in `server.ts`.

**A bug caught in review before it shipped.** The new `saveStock` used Airtable's `performUpsert` keyed on `Ticker`. But the scorer is append-only — `tblScores` already held many rows per ticker — and Airtable's upsert fails outright when more than one record matches the merge field. It would have errored on the first interactive analysis of any seed ticker. Both writers now append; `listStocks()` collapses to the newest row per ticker on read.

**Provenance became a column.** `tblScores` gained `Data Source` (live/simulated) and `Payload` (full CompanyScore JSON). The first exists because a simulated record was previously indistinguishable from a real one once flattened to ten scalars — which is exactly how fabricated numbers survived undetected. The second exists because the evidence trail, the whole premise of an *Evidence* Scoring Engine, was being discarded on every write; only `evidence.length` survived.

**The fork.** Running the app on Gemini while the rest of the toolchain was Claude-side meant two SDKs, two credentials, two structured-output mechanisms and two independent failure modes. `claude/native-claude-fork` removes the seam. Three things differ from the Gemini port and are worth knowing: refusals return HTTP 200 with empty or partial content, so `stop_reason` must be checked before touching `content`; thinking blocks share the content array, so text is extracted by filtering on block type rather than indexing position; and structured-output schemas require `additionalProperties: false` on every object and reject numeric bounds, so ranges moved into field descriptions.

**Made the deploy self-diagnosing.** `/api/health` depends on nothing — no env vars, no network, no model call — so a routing failure can be told apart from a missing-credential failure without guessing. `/api/config` gained `ready` and `missing[]`, naming exactly which credential is unset. Both report credentials as booleans, never values.

**The lesson that generalized, again.** Every fix today either uncovered a different problem underneath or revealed drift between two files that should have matched. `scorer.ts` vs `server.ts` diverged three separate times — the SDK method, the grounding decision, and the response schema — each time because a fix was applied to one call site and not the other. Two implementations of the same thing will drift; the fork exists partly to make that structurally impossible.
