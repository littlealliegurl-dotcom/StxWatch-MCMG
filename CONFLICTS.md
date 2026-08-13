# CONFLICTS.md

This file documents every point where the three source inputs — the chat
thread history, the files shared directly in this thread, and the AI Studio
ZIP export — disagreed, and the reasoning behind each resolution. Per the
build brief, none of these were treated as blockers; each was resolved in
favor of architectural stability and logged here instead.

---

### 1. Scoring model: four-factor vs. five-category

**Conflict:** The AI Studio export's `types.ts` and `server.ts` implement the
original four-factor model (`CompanyStock` — valuation / growth /
financialHealth / momentum, with a `stance` and `riskLevel`). The chat
thread's most recent design session replaced this with the IESE
(Investment Evidence Scoring Engine) v1.0 five-category model
(`CompanyScore` — Demand / Execution / Competition / Financial / External,
each backed by an evidence trail).

**Resolution:** The chat thread is the logic source of truth, so
`CompanyScore` is the only model the app writes new records in.
`LegacyCompanyStock` and its related types are kept in `src/types.ts` in a
clearly-marked "legacy" section for reference, but nothing in `server.ts` or
`App.tsx` reads or writes them.

### 2. Pre-seeded ticker universe

**Conflict:** The AI Studio export pre-seeds a "sub-$10 growth stock" basket
(SOFI, IONQ, CLSK, NIO, DNA, HUT, PLUG, SNDL, OPEN, RIG) matching its old
"Upcoming Stocks Under $10 Analyzer" framing. The chat thread's original
build (before the AI Studio detour) was a micro-cap breakout analyzer
pre-seeded with ASTS, RENE, BMEA, LUNA, QTUM.

**Resolution:** Kept the chat thread's five-ticker basket (ASTS, RENE, BMEA,
LUNA, QUBT — see item 3 for the QTUM swap) since the repo itself
(`StxWatch-MCMG`) and the app's IESE framing are both scoped to micro-cap
analysis, not a sub-$10 price screen. The AI Studio basket was dropped
entirely rather than merged in, to avoid mixing two different stock
universes with two different implied theses.

### 3. QTUM → QUBT

**Conflict/gap:** `QTUM` is not a single company — it's the ticker for the
Defiance Quantum ETF (verified via live search during this build). The
five-category evidence model assumes a single operating company, so an ETF
ticker doesn't fit the schema (no single "company" to score).

**Resolution:** Swapped the fifth seed ticker to `QUBT` (Quantum Computing
Inc.), a real single-company micro-cap in the same sector, so the seed data
stays internally consistent with the single-company model.

### 4. App identity / branding

**Conflict:** The AI Studio export's header copy ("Upcoming Stocks Under $10
Analyzer," "System Terminal v2.5") reflects the old four-factor, price-capped
framing.

**Resolution:** Rebranded the header to "StxWatch-MCMG" / "Micro-Cap Trend &
Valuation Engine" / "IESE v1.0," matching the repo name and the current
scoring model. The rest of the AI Studio export's visual chrome (dark
utility bar, stats block, card layout, modal structure, motion transitions)
was preserved as-is per the brief's "use AI Studio's layout/styling"
instruction — this was a copy change, not a redesign.

### 5. Business Health Meter — previously undefined

**Gap:** Earlier design notes flagged the Business Health Meter as "pending
definition."

**Resolution:** Defined it as a derived (not stored) five-state read of the
overall score — `excellent / strong / positive / neutral / at-risk` — each
mapped to a color used for the modal's radial meter and its label. See
`getHealthState()` in `src/types.ts`.

### 6. Industry profiles — hardcoded vs. Gemini-dynamic

**Gap:** Earlier design notes flagged this as an open decision.

**Resolution:** Went dynamic. Rather than maintaining a hardcoded map of
industry → indicator lists, the Gemini prompt in `server.ts` asks the model
to identify the company's actual industry first, then choose the two most
relevant metrics per fixed category for that industry. This keeps the five
categories fixed (as required) while letting the specific metrics flex
per-industry without a separate profile-maintenance system.

### 7. Client-side demo-mode detection

**Bug carried over from the AI Studio export:** The original `App.tsx`
checked `process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY"` directly in
client-side React code. `process.env` is not reliably populated in a Vite
browser bundle without extra config that this project doesn't otherwise use,
so this check would not work as intended.

**Resolution:** Added a `GET /api/config` endpoint that reports
`{ demoMode: boolean }` computed server-side, and had the client fetch it
once on mount. This was treated as a stability fix under the brief's
"conflict resolution" clause rather than a scope addition.

### 8. Overall score: server-computed vs. model-reported

**Decision (not a conflict, but a deliberate stability choice):** Gemini is
asked for category scores and metrics, but never for the top-line overall
score. `server.ts` always recomputes `score.overall` from the five category
scores using the fixed `SCORING_WEIGHTS` via `computeOverallScore()` — for
both the live Gemini path and the offline simulation path. This guarantees
the headline number is always auditable and reproducible from the category
breakdown shown in the same modal, which is the whole premise of an
"evidence scoring engine."

### 9. Persistence

**Non-conflict, confirmed compatible:** The chat thread's IESE v1.0 schema
intentionally dropped a per-score `history` array ("no persistence layer
yet"), but that refers to score-over-time trending, not to persisting the
current record at all. The AI Studio export's simple file-based persistence
(`data/stocks.json`, read/write on every request) does not reintroduce
history tracking and was kept as-is — it just persists the current record
per ticker, which both sources already assumed.

### 10. Gemini model name

Kept `gemini-3.5-flash` as specified in the AI Studio export's own working
`server.ts`, since this refers to the user's existing Google Gemini API
configuration, not an Anthropic product, and there was no indication in any
source that it needed to change.

**Superseded on this branch.** This fork runs entirely on the Anthropic API —
`@google/genai` is removed and both call sites use `@anthropic-ai/sdk` with
structured outputs. The motivation was not the model itself but the seam: two
providers meant two SDKs, two credentials, two structured-output mechanisms,
and two independent failure modes to reason about. The Gemini implementation
remains intact on `claude/repo-access-permissions-debug-37og3s` if it is ever
needed for comparison.
