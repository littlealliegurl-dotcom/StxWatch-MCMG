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
