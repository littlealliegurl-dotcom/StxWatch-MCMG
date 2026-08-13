/**
 * StxWatch-MCMG — persistence
 *
 * Replaces the previous flat-file store (data/stocks.json). That could not run
 * on Vercel: the serverless filesystem is read-only, and server.ts called
 * fs.mkdirSync at module load, so the function crashed on import before any
 * route ran.
 *
 * Records now go to the same Airtable table the nightly scorer writes to, so
 * the web app and the automation finally share one store instead of two that
 * never see each other. The full CompanyScore rides in the Payload column; the
 * flat category scalars stay as real columns so existing views keep working.
 *
 * With no AIRTABLE_PAT configured this degrades to an in-memory store seeded
 * from PRE_SEEDED_STOCKS, so local dev and the offline demo still work.
 */

import type { CompanyScore } from "../src/types";
import { PRE_SEEDED_STOCKS } from "./seed";

const AIRTABLE_BASE_ID = "apppoYLfhlaPHeFhO";
const AIRTABLE_SCORES_TABLE_ID = "tblyi3vwdStEI5Svh";
const AIRTABLE_API_ROOT = "https://api.airtable.com/v0";
const REQUEST_TIMEOUT_MS = 10_000;

function pat(): string {
  return process.env.AIRTABLE_PAT || "";
}

export function isAirtableConfigured(): boolean {
  return pat().length > 0;
}

/** In-memory fallback. Only used when Airtable isn't configured. */
let memoryStore: CompanyScore[] | null = null;
function memory(): CompanyScore[] {
  if (memoryStore === null) memoryStore = [...PRE_SEEDED_STOCKS];
  return memoryStore;
}

async function airtable(
  method: string,
  pathAndQuery: string,
  body?: unknown
): Promise<any> {
  const res = await fetch(`${AIRTABLE_API_ROOT}/${AIRTABLE_BASE_ID}/${pathAndQuery}`, {
    method,
    headers: {
      Authorization: `Bearer ${pat()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${method} failed (${res.status}): ${text}`);
  }
  return res.json();
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Build a displayable CompanyScore from a scorer-written row. Those rows only
 * carry the flat scalars, so company metadata is unknown — it is labelled as
 * such rather than invented.
 */
function fromScalars(fields: Record<string, any>): CompanyScore {
  const ticker = String(fields.Ticker || "").toUpperCase();
  const flat = (name: string) => ({
    score: num(fields[name]),
    trend: "→" as const,
    metrics: [],
  });

  return {
    company: {
      ticker,
      name: ticker,
      industry: "Not captured by the nightly scorer",
      market_cap: "—",
      price: 0,
      price_change_24h: 0,
      volume_24h: "—",
    },
    score: {
      overall: num(fields["Overall Score"]),
      confidence: num(fields.Confidence),
      trend: "→",
      verification: fields["Data Source"] === "simulated" ? "X" : "?",
      evidence_strength: 1,
      last_updated: fields["Last Updated"] || new Date().toISOString(),
    },
    categories: {
      demand: flat("Demand"),
      execution: flat("Execution"),
      competition: flat("Competition"),
      financial: flat("Financial"),
      external: flat("External"),
    },
    evidence: [],
    summary: {
      overall_assessment:
        fields["Data Source"] === "simulated"
          ? `Simulated record from the nightly scorer — not real analysis.`
          : `Nightly scorer record for ${ticker}. Run a fresh analysis for the full evidence trail.`,
      key_risks: [],
      watch_items: [],
      next_catalysts: [],
    },
  };
}

function recordToStock(record: any): CompanyScore | null {
  const fields = record?.fields ?? {};
  if (!fields.Ticker) return null;

  // Rows written by the web app carry the whole object; prefer it.
  if (typeof fields.Payload === "string" && fields.Payload.trim()) {
    try {
      const parsed = JSON.parse(fields.Payload);
      if (parsed && parsed.company && parsed.categories) return parsed as CompanyScore;
    } catch {
      // fall through to the scalar reconstruction
    }
  }
  return fromScalars(fields);
}

/**
 * Every tracked company, most-recently-updated first, one row per ticker.
 * Pre-seeded records fill in any ticker Airtable hasn't seen yet.
 */
export async function listStocks(): Promise<CompanyScore[]> {
  if (!isAirtableConfigured()) return [...memory()];

  try {
    const sort = `sort%5B0%5D%5Bfield%5D=${encodeURIComponent("Last Updated")}&sort%5B0%5D%5Bdirection%5D=desc`;
    const data = await airtable("GET", `${AIRTABLE_SCORES_TABLE_ID}?pageSize=100&${sort}`);

    const seen = new Set<string>();
    const stocks: CompanyScore[] = [];

    for (const record of data.records ?? []) {
      const stock = recordToStock(record);
      if (!stock) continue;
      const key = stock.company.ticker.toUpperCase();
      if (seen.has(key)) continue; // keep only the newest row per ticker
      seen.add(key);
      stocks.push(stock);
    }

    for (const seed of PRE_SEEDED_STOCKS) {
      if (!seen.has(seed.company.ticker.toUpperCase())) stocks.push(seed);
    }

    return stocks;
  } catch (error) {
    console.error("listStocks: Airtable read failed, serving seed data:", error);
    return [...PRE_SEEDED_STOCKS];
  }
}

/**
 * Upsert one analysis, keyed on Ticker. Returns false if the write did not
 * land, so callers can surface it instead of reporting a silent success —
 * a swallowed persistence failure has bitten this project before.
 */
export async function saveStock(
  stock: CompanyScore,
  dataSource: "live" | "simulated"
): Promise<boolean> {
  if (!isAirtableConfigured()) {
    const store = memory();
    const index = store.findIndex(
      (s) => s.company.ticker.toUpperCase() === stock.company.ticker.toUpperCase()
    );
    if (index !== -1) store[index] = stock;
    else store.unshift(stock);
    return true;
  }

  try {
    await airtable("PATCH", AIRTABLE_SCORES_TABLE_ID, {
      performUpsert: { fieldsToMergeOn: ["Ticker"] },
      records: [
        {
          fields: {
            Ticker: stock.company.ticker.toUpperCase(),
            "Overall Score": stock.score.overall,
            Confidence: stock.score.confidence,
            "Last Updated": stock.score.last_updated,
            Demand: stock.categories.demand.score,
            Execution: stock.categories.execution.score,
            Competition: stock.categories.competition.score,
            Financial: stock.categories.financial.score,
            External: stock.categories.external.score,
            "Evidence Count": stock.evidence.length,
            "Data Source": dataSource,
            Payload: JSON.stringify(stock),
          },
        },
      ],
    });
    return true;
  } catch (error) {
    console.error("saveStock: Airtable write failed:", error);
    return false;
  }
}
