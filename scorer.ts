/**
 * StxWatch-MCMG — IESE Automation Scorer
 * 
 * Runs IESE analysis against seed basket tickers (ASTS, RENE, BMEA, LUNA, QUBT)
 * and writes results to Airtable with score history tracking.
 * 
 * Can be invoked:
 * - Via cron job: node dist/scorer.cjs
 * - Via GitHub Actions: automated daily run
 * - Via manual command: npm run score
 */

import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "fs";

// ────────────────────────────────────────────────────────────────────────────
// Debug logging — written to disk so CI can commit it for inspection
// ────────────────────────────────────────────────────────────────────────────

const debugLines: string[] = [];
function debugLog(line: string): void {
  debugLines.push(line);
}
function flushDebugLog(): void {
  try {
    writeFileSync("scorer-debug.txt", debugLines.join("\n") + "\n", "utf-8");
  } catch {
    // best-effort only
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

dotenv.config();

const SEED_BASKET = ["ASTS", "RENE", "BMEA", "LUNA", "QUBT"] as const;
const AIRTABLE_BASE_ID = "apppoYLfhlaPHeFhO"; // Scores base (separate from the repo-mirror base app28hlWLnX51LBxk)
const AIRTABLE_SCORES_TABLE_ID = "tblyi3vwdStEI5Svh"; // tblScores
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

interface ScoreRecord {
  ticker: string;
  overall: number;
  confidence: number;
  last_updated: string;
  demand: number;
  execution: number;
  competition: number;
  financial: number;
  external: number;
  evidence_count: number;
  /**
   * Whether this row is real Claude analysis or the deterministic fallback.
   * Persisted to Airtable so a simulated row is never mistaken for signal —
   * that confusion is what let fabricated scores sit undetected before.
   */
  data_source: "live" | "simulated";
}

interface ScoreHistory {
  ticker: string;
  scores: Array<{
    overall: number;
    date: string;
    trend: "↑↑" | "↑" | "→" | "↓" | "↓↓";
  }>;
}

// ────────────────────────────────────────────────────────────────────────────
// Airtable API Wrapper
// ────────────────────────────────────────────────────────────────────────────

async function airtableRequest(
  method: string,
  endpoint: string,
  body?: unknown
): Promise<unknown> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${endpoint}`;
  
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${AIRTABLE_PAT}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const text = await response.text();
    debugLog(`AIRTABLE ERROR — ${method} ${url}`);
    debugLog(`Status: ${response.status}`);
    debugLog(`Body: ${text}`);
    throw new Error(
      `Airtable API error (${response.status}): ${text}`
    );
  }

  return response.json();
}

async function writeScoresToAirtable(scores: ScoreRecord[]): Promise<boolean> {
  if (!AIRTABLE_PAT) {
    console.log("⚠️  AIRTABLE_PAT not set — skipping Airtable write");
    return false;
  }

  const records = scores.map((score) => ({
    fields: {
      Ticker: score.ticker,
      "Overall Score": score.overall,
      Confidence: score.confidence,
      "Last Updated": score.last_updated,
      Demand: score.demand,
      Execution: score.execution,
      Competition: score.competition,
      Financial: score.financial,
      External: score.external,
      "Evidence Count": score.evidence_count,
      "Data Source": score.data_source,
    },
  }));

  console.log(`📊 Writing ${records.length} score records to Airtable...`);

  let allSucceeded = true;

  // Airtable has a 10-record batch limit
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    try {
      await airtableRequest("POST", AIRTABLE_SCORES_TABLE_ID, { records: batch });
      console.log(`  ✓ Batch ${Math.floor(i / 10) + 1} written`);
    } catch (err) {
      console.error(`  ✗ Batch ${Math.floor(i / 10) + 1} failed:`, err);
      allSucceeded = false;
    }
  }

  return allSucceeded;
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring Logic (Claude-backed with fallback simulation)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Coerce a model-supplied score to an integer. Uses an explicit finite check
 * rather than `||` so a legitimate score of 0 survives instead of silently
 * becoming the fallback value.
 */
function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
}

/**
 * Parse the model's JSON payload. With responseSchema set the whole response
 * should already be valid JSON, so that is tried first; the brace-matching
 * fallback stays for responses wrapped in prose or a code fence.
 */
function parseScorePayload(text: string): Record<string, unknown> | null {
  if (!text) return null;

  const attempts: string[] = [text];
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) attempts.push(braceMatch[0]);

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }

  return null;
}

async function analyzeTickerWithClaude(ticker: string): Promise<ScoreRecord> {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "MY_ANTHROPIC_API_KEY") {
    debugLog(`CLAUDE SKIPPED for ${ticker} — key is ${!ANTHROPIC_API_KEY ? "empty/unset" : "placeholder value"} (length: ${ANTHROPIC_API_KEY.length})`);
    console.log(`  (No Anthropic API key — using simulated analysis for ${ticker})`);
    return generateSimulatedScore(ticker);
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const prompt = `Conduct a comprehensive Investment Evidence Scoring Engine (IESE) analysis for ${ticker}, based on your training knowledge of the company (you do not have live web search access for this analysis).

Score each of the five IESE categories from 0-100: demand, execution, competition,
financial, external. Also provide an overall score, a confidence score, and
evidence_count — the number of distinct facts or observations you are confident are
accurate from training data.

Be conservative in scoring — prefer accuracy over optimism. Since you don't have live
data, keep confidence lower than you would with real-time search, and be honest that
this reflects your training-data knowledge rather than current market conditions.`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      system:
        "You are a rigorous, evidence-based equities research engine working from training knowledge only (no live search access). Every score must be traceable to something you actually know. Prefer honesty about uncertainty over confident fabrication — lower confidence scores are expected and correct given the lack of live data.",
      output_config: {
        // `medium` is deliberate: this is a bounded scoring call, not open-ended
        // reasoning, and it keeps the nightly run cheap across the basket.
        effort: "medium",
        // Structured outputs constrain generation to this schema, so the
        // truncated-JSON failure that silently simulated RENE every night
        // cannot recur. Note `additionalProperties: false` is required.
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              overall: { type: "integer", description: "0-100" },
              confidence: { type: "integer", description: "0-100" },
              demand: { type: "integer", description: "0-100" },
              execution: { type: "integer", description: "0-100" },
              competition: { type: "integer", description: "0-100" },
              financial: { type: "integer", description: "0-100" },
              external: { type: "integer", description: "0-100" },
              evidence_count: { type: "integer" },
            },
            required: [
              "overall",
              "confidence",
              "demand",
              "execution",
              "competition",
              "financial",
              "external",
              "evidence_count",
            ],
          },
        },
      },
      messages: [{ role: "user", content: prompt }],
    });

    const stopReason = response.stop_reason ?? "(none reported)";

    // A refusal returns HTTP 200 with empty or partial content, so check why
    // generation stopped before trusting anything in `content`.
    if (stopReason === "refusal") {
      const category = response.stop_details?.category ?? "unspecified";
      debugLog(`CLAUDE REFUSAL for ${ticker} — category: ${category}`);
      console.warn(`  ⚠️  Claude declined the request for ${ticker} (${category})`);
      return generateSimulatedScore(ticker);
    }

    // Thinking blocks share the content array; only text carries the payload.
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const parsed = parseScorePayload(text);

    if (!parsed) {
      // Record *why* it failed, not just that it did. A bare "parse failure" is
      // what made the equivalent bug take two runs to characterise.
      debugLog(`CLAUDE PARSE FAILURE for ${ticker}`);
      debugLog(`  stop_reason: ${stopReason}`);
      debugLog(`  response length: ${text.length} chars`);
      debugLog(`  raw response (first 500 chars):`);
      debugLog(text.slice(0, 500) || "(empty response)");
      console.warn(
        `  ⚠️  Could not parse Claude response for ${ticker} (stop_reason: ${stopReason})`
      );
      return generateSimulatedScore(ticker);
    }

    return {
      ticker,
      overall: num(parsed.overall, 50),
      confidence: num(parsed.confidence, 50),
      demand: num(parsed.demand, 50),
      execution: num(parsed.execution, 50),
      competition: num(parsed.competition, 50),
      financial: num(parsed.financial, 50),
      external: num(parsed.external, 50),
      evidence_count: num(parsed.evidence_count, 0),
      last_updated: new Date().toISOString(),
      data_source: "live",
    };
  } catch (err) {
    const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    debugLog(`CLAUDE ERROR — ticker ${ticker}`);
    debugLog(errMsg);
    if (err instanceof Error && err.stack) {
      debugLog(err.stack);
    }
    console.warn(`  ⚠️  Claude request failed for ${ticker}:`, err);
    return generateSimulatedScore(ticker);
  }
}

function generateSimulatedScore(ticker: string): ScoreRecord {
  // Deterministic but varied by ticker for demo purposes
  const seed = ticker.charCodeAt(0) + ticker.charCodeAt(1);
  const baseScore = (seed % 40) + 35; // 35-75 range

  return {
    ticker,
    overall: baseScore,
    confidence: 55 + (seed % 30),
    demand: 40 + (seed % 50),
    execution: 45 + (seed % 45),
    competition: 35 + (seed % 50),
    financial: 50 + (seed % 40),
    external: 30 + (seed % 60),
    evidence_count: 3 + (seed % 8),
    last_updated: new Date().toISOString(),
    data_source: "simulated",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Main Automation Run
// ────────────────────────────────────────────────────────────────────────────

async function runScoringAutomation(): Promise<void> {
  console.log("\n🔄 StxWatch-MCMG IESE Automation Scorer");
  console.log(`📅 ${new Date().toISOString()}\n`);

  const scores: ScoreRecord[] = [];
  const DELAY_BETWEEN_TICKERS_MS = 15000; // stay under free-tier RPM for grounded requests

  for (let i = 0; i < SEED_BASKET.length; i++) {
    const ticker = SEED_BASKET[i];
    console.log(`📈 Analyzing ${ticker}...`);
    try {
      const score = await analyzeTickerWithClaude(ticker);
      scores.push(score);
      console.log(
        `  ✓ Score: ${score.overall}/100 (confidence: ${score.confidence}/100)`
      );
    } catch (err) {
      console.error(`  ✗ Failed:`, err);
    }

    if (i < SEED_BASKET.length - 1) {
      debugLog(`Waiting ${DELAY_BETWEEN_TICKERS_MS / 1000}s before next ticker (rate limit spacing)`);
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_TICKERS_MS));
    }
  }

  console.log(`\n📊 Results: ${scores.length}/${SEED_BASKET.length} tickers analyzed\n`);

  // Surface fallbacks in the run output. A simulated row is fabricated data, and
  // a green run that quietly wrote fabricated numbers is the failure mode this
  // project has already been bitten by more than once.
  const simulated = scores.filter((s) => s.data_source === "simulated");
  if (simulated.length > 0) {
    const tickers = simulated.map((s) => s.ticker).join(", ");
    console.warn(
      `⚠️  ${simulated.length}/${scores.length} record(s) are SIMULATED, not real analysis: ${tickers}`
    );
    console.warn(`   These are marked "simulated" in the Data Source column in Airtable.`);
    console.warn(`   See scorer-debug.txt for the finishReason on each failure.\n`);
    debugLog(`SIMULATED FALLBACK USED for: ${tickers}`);
  } else {
    console.log("✓ All records are live Claude analysis — no simulated fallbacks\n");
  }

  // Write to Airtable if configured
  if (AIRTABLE_PAT) {
    const wroteOk = await writeScoresToAirtable(scores);
    if (!wroteOk) {
      console.error(
        "\n❌ One or more Airtable writes failed. Common cause: the AIRTABLE_PAT token " +
          "doesn't have access to this base. Check https://airtable.com/create/tokens and " +
          "confirm the token's 'Access' list includes this base.\n"
      );
      process.exitCode = 1;
    }
  } else {
    console.log("📄 Airtable credentials not configured — results not persisted");
    console.log("   Set AIRTABLE_PAT environment variable to enable writes");
    process.exitCode = 1;
  }

  console.log("\n✅ Scoring automation complete\n");
  flushDebugLog();
}

// ────────────────────────────────────────────────────────────────────────────
// CLI Entry Point
// ────────────────────────────────────────────────────────────────────────────

runScoringAutomation().catch((err) => {
  console.error("❌ Automation failed:", err);
  process.exit(1);
});
