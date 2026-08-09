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
import { GoogleGenAI } from "@google/genai";
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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

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
// Scoring Logic (Gemini-backed with fallback simulation)
// ────────────────────────────────────────────────────────────────────────────

async function analyzeTickerWithGemini(ticker: string): Promise<ScoreRecord> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    debugLog(`GEMINI SKIPPED for ${ticker} — key is ${!GEMINI_API_KEY ? "empty/unset" : "placeholder value"} (length: ${GEMINI_API_KEY.length})`);
    console.log(`  (No Gemini API key — using simulated analysis for ${ticker})`);
    return generateSimulatedScore(ticker);
  }

  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { headers: { "User-Agent": "stxwatch-mcmg-scorer" } },
  });

  const prompt = `Conduct a comprehensive Investment Evidence Scoring Engine (IESE) analysis for ${ticker}, based on your training knowledge of the company (you do not have live web search access for this analysis).

Provide a JSON response with this exact structure (numeric scores 0-100):
{
  "overall": <number>,
  "confidence": <number>,
  "demand": <number>,
  "execution": <number>,
  "competition": <number>,
  "financial": <number>,
  "external": <number>,
  "evidence_count": <number of distinct facts/observations you're confident are accurate from training data>
}

Be conservative in scoring — prefer accuracy over optimism. Since you don't have live data, keep "confidence" lower than you would with real-time search, and be honest that this reflects your training-data knowledge rather than current market conditions.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "You are a rigorous, evidence-based equities research engine working from training knowledge only (no live search access). Every score must be traceable to something you actually know. Prefer honesty about uncertainty over confident fabrication — lower confidence scores are expected and correct given the lack of live data.",
        responseMimeType: "application/json",
      },
    });

    const text = response.text ? response.text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn(`  ⚠️  Could not parse Gemini response for ${ticker}`);
      return generateSimulatedScore(ticker);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      ticker,
      overall: Math.round(parsed.overall || 50),
      confidence: Math.round(parsed.confidence || 50),
      demand: Math.round(parsed.demand || 50),
      execution: Math.round(parsed.execution || 50),
      competition: Math.round(parsed.competition || 50),
      financial: Math.round(parsed.financial || 50),
      external: Math.round(parsed.external || 50),
      evidence_count: parsed.evidence_count || 0,
      last_updated: new Date().toISOString(),
    };
  } catch (err) {
    const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    debugLog(`GEMINI ERROR — ticker ${ticker}`);
    debugLog(errMsg);
    if (err instanceof Error && err.stack) {
      debugLog(err.stack);
    }
    console.warn(`  ⚠️  Gemini request failed for ${ticker}:`, err);
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
      const score = await analyzeTickerWithGemini(ticker);
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
