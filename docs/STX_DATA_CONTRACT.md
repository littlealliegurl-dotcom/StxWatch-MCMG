# StxWatch-MCMG — Canonical Data Contract

Single source of truth for the shape moving between `server.ts`/`scorer.ts` (backend) and the dashboard (frontend). Backend changes: edit here first, then `src/types.ts` + backend, then the dashboard's `renderVals()`. Frontend changes (new lever): add the field here, then to `types.ts`/backend, then read it in the dashboard.

## 1. Core record — `CompanyScore` (per ticker)

Matches `src/types.ts` exactly. This is what `GET /api/stocks` returns (array of these) and what `POST /api/stocks/analyze` returns (one of these).

```ts
interface CompanyScore {
  company: {
    ticker: string;
    name: string;
    industry: string;
    market_cap: string;
    price: number;
    price_change_24h: number;   // percent
    volume_24h: string;
  };
  score: {
    overall: number;            // 0-100 — SERVER COMPUTED ONLY, see §3
    confidence: number;         // 0-100
    trend: "↑↑" | "↑" | "→" | "↓" | "↓↓";
    verification: "++" | "+" | "○" | "?" | "X";
    evidence_strength: number;  // 1-5
    last_updated: string;       // ISO 8601
  };
  categories: {
    demand: CategoryBlock;
    execution: CategoryBlock;
    competition: CategoryBlock;
    financial: CategoryBlock;
    external: CategoryBlock;
  };
  evidence: EvidenceItem[];
  summary: {
    overall_assessment: string;
    key_risks: string[];
    watch_items: string[];
    next_catalysts: string[];
  };
}

interface CategoryBlock {
  score: number;                // 0-100
  trend: TrendArrow;
  metrics: { name: string; value: string; score: number; trend: TrendArrow; notes: string }[];
}

interface EvidenceItem {
  title: string; category: string; description: string;
  date: string; source: string; url: string;
  reliability: number; verified: boolean; independent_sources: number;
  confidence: number; impact: number;  // -100..100
  expires: string;
}
```

## 2. Fixed constants — must match on both sides

| Constant | Value | Lives in |
|---|---|---|
| `SCORING_WEIGHTS` | demand 0.25, execution 0.20, competition 0.20, financial 0.20, external 0.15 | `types.ts` + dashboard `WEIGHTS` |
| `SEED_BASKET` | ASTS, RENE, BMEA, LUNA, QUBT | `scorer.ts` + dashboard seed data |
| `CATEGORY_KEYS` order | demand, execution, competition, financial, external | `types.ts` + dashboard `KEYS` |

Changing the basket or weights is a backend-first change — the frontend has no add/remove UI (fixed, display-only, per product decision).

## 3. Derived fields — computed, never stored, never sent by AI

| Field | Formula | Computed where |
|---|---|---|
| `score.overall` | `Σ categories[k].score × SCORING_WEIGHTS[k]`, rounded | Server (`computeOverallScore()`) — never trusted raw from Gemini |
| Health state (`excellent/strong/positive/neutral/at-risk`) | Overall ≥90/80/70/60/else | Client, from `score.overall` (`getHealthState()`) |
| Freshness (`green/yellow/red`) | Days since `last_updated` ≤30 / ≤90 / else | Client (`getFreshness()`) |
| Relative time ("3h ago") | `Date.now() - last_updated` | Client, display only |

## 4. API surface

| Endpoint | Method | Returns / Body | Drives |
|---|---|---|---|
| `/api/config` | GET | `{ demoMode: boolean }` | Top-bar real/simulated badge (always visible) |
| `/api/stocks` | GET | `CompanyScore[]` | Table/Bento tile population on load + Refresh All |
| `/api/stocks/analyze` | POST | body `{ ticker }` → returns one `CompanyScore` | "Ask AI to re-score" → shown as a pending suggestion, applied only on Confirm |

## 5. UI lever ↔ data map

Every control on the dashboard reads/writes one of the fields above. Add a new backend lever by adding a row here first.

| UI element | Reads | Writes / Action |
|---|---|---|
| Table row / Bento tile | `company.*`, `score.*`, derived health+freshness | — (click → opens detail) |
| Business Health Meter (ring) | `score.overall` → `getHealthState()` | — |
| Confidence bar | `score.confidence` | — |
| Category Scores grid | `categories[key].score`, `.metrics[]` | — |
| Evidence Trail (expandable) | `evidence[]` | — |
| Real/simulated badge | `/api/config` → `demoMode` | — |
| "Ask AI to re-score" button | — | `POST /api/stocks/analyze` → holds result as pending suggestion (not yet applied) |
| Confirm & Save | pending suggestion | Applies suggested `score.overall`/categories to that ticker's record (backend should persist to `data/stocks.json`) |
| Discard | pending suggestion | Drops it, no write |
| Refresh All Scores | — | Re-fetches `/api/stocks` (dashboard currently stubs this as a timestamp bump) |

## 6. Adding a new lever (either direction)

1. Add the field to §1 (and to `src/types.ts` + the relevant API response in `server.ts`/`scorer.ts`).
2. Add a row to §5 naming the UI element that will expose it and what action (if any) writes it back.
3. Update the dashboard's `renderVals()` to read the new field and the matching template markup.
4. If it changes a fixed constant (§2), update both `scorer.ts` and the dashboard's mock seed together.
