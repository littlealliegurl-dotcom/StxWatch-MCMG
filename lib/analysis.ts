/**
 * StxWatch-MCMG — IESE analysis engine (Claude-native)
 *
 * Runs entirely on the Anthropic API. There is no second model provider in
 * this fork: the web app and the nightly scorer share one SDK, one credential
 * (ANTHROPIC_API_KEY) and one structured-output mechanism.
 *
 * Nothing here touches the filesystem, an HTTP server, or Vite — it must stay
 * importable inside a Vercel serverless function.
 */

import Anthropic from "@anthropic-ai/sdk";
import { CompanyScore, computeOverallScore } from "../src/types";

export const TREND_ENUM = ["↑↑", "↑", "→", "↓", "↓↓"];
export const VERIFICATION_ENUM = ["++", "+", "○", "?", "X"];

const MODEL = "claude-opus-5";

/** True when no usable Anthropic key is configured, so the app runs simulated. */
export function isDemoMode(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return !apiKey || apiKey === "MY_ANTHROPIC_API_KEY";
}

/**
 * Structured-output schemas require `additionalProperties: false` on every
 * object, and do not support numeric bounds (min/max) — ranges are stated in
 * the prompt instead. Keep both rules in mind when editing these.
 */
function categoryBlockSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      score: { type: "integer", description: "0-100" },
      trend: { type: "string", enum: TREND_ENUM },
      metrics: {
        type: "array",
        description: "Exactly two metrics, chosen for this company's industry.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            value: { type: "string", description: "Short display value" },
            score: { type: "integer", description: "0-100" },
            trend: { type: "string", enum: TREND_ENUM },
            notes: { type: "string", description: "One sentence" },
          },
          required: ["name", "value", "score", "trend", "notes"],
        },
      },
    },
    required: ["score", "trend", "metrics"],
  };
}

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    company: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        industry: { type: "string" },
        market_cap: { type: "string" },
        price: { type: "number" },
        price_change_24h: { type: "number" },
        volume_24h: { type: "string" },
      },
      required: [
        "name", "industry", "market_cap", "price", "price_change_24h", "volume_24h",
      ],
    },
    score: {
      type: "object",
      additionalProperties: false,
      properties: {
        confidence: { type: "integer", description: "0-100" },
        trend: { type: "string", enum: TREND_ENUM },
        verification: { type: "string", enum: VERIFICATION_ENUM },
        evidence_strength: { type: "integer", description: "1-5" },
      },
      required: ["confidence", "trend", "verification", "evidence_strength"],
    },
    categories: {
      type: "object",
      additionalProperties: false,
      properties: {
        demand: categoryBlockSchema(),
        execution: categoryBlockSchema(),
        competition: categoryBlockSchema(),
        financial: categoryBlockSchema(),
        external: categoryBlockSchema(),
      },
      required: ["demand", "execution", "competition", "financial", "external"],
    },
    evidence: {
      type: "array",
      description: "Two to four dated observations.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          description: { type: "string" },
          date: { type: "string", description: "ISO 8601 date" },
          source: { type: "string" },
          url: { type: "string", description: "Empty string if not known" },
          reliability: { type: "integer", description: "0-100" },
          verified: { type: "boolean" },
          independent_sources: { type: "integer" },
          confidence: { type: "integer", description: "0-100" },
          impact: { type: "integer", description: "-100 bearish to 100 bullish" },
          expires: { type: "string", description: "ISO 8601 date" },
        },
        required: [
          "title", "category", "description", "date", "source", "url",
          "reliability", "verified", "independent_sources", "confidence",
          "impact", "expires",
        ],
      },
    },
    summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        overall_assessment: { type: "string" },
        key_risks: { type: "array", items: { type: "string" } },
        watch_items: { type: "array", items: { type: "string" } },
        next_catalysts: { type: "array", items: { type: "string" } },
      },
      required: ["overall_assessment", "key_risks", "watch_items", "next_catalysts"],
    },
  },
  required: ["company", "score", "categories", "evidence", "summary"],
};

const SYSTEM_PROMPT =
  "You are a rigorous, evidence-based equities research engine working from training " +
  "knowledge only — you have no live search access. Every score must be traceable to " +
  "something you actually know. Prefer honesty about uncertainty over confident " +
  "fabrication; lower confidence scores are expected and correct given the lack of " +
  "live data.";

function buildAnalysisPrompt(ticker: string): string {
  // Industry profiles are determined dynamically by the model rather than
  // hardcoded, so the same five fixed categories flex to whatever indicators
  // are relevant for the company's actual industry.
  return `Conduct a comprehensive Investment Evidence Scoring Engine (IESE) analysis for the
company with stock ticker: ${ticker}.

You are working from training knowledge only — you do NOT have live web search access.
First identify the company's actual industry, then choose the two most relevant,
industry-appropriate metrics for EACH of these five fixed categories:

1. Demand — market size, customer/partner traction, adoption signals
2. Execution — product/operational delivery, management execution
3. Competition — competitive position and differentiation
4. Financial — balance sheet health, revenue, margins, cash runway
5. External — regulatory, macro, and sector-sentiment factors

All 0-100 scores use the full range. evidence_strength is 1-5. impact runs from
-100 (bearish) to 100 (bullish).

Provide 2-4 evidence items — each a specific, dated observation you are confident about
from training data, with a source name. Do not fabricate sources or URLs; leave url as an
empty string rather than guessing one. If you are not confident a claim is independently
verifiable, reflect that with a lower reliability/confidence score and verified: false.

Because you have no live data, keep confidence and reliability lower than you would with
real-time search, and treat price and market-cap figures as approximate and possibly
stale — say so in the relevant metric notes.

Finally, provide an executive summary, 2-4 key risks, 2-4 watch items, and 2-4 upcoming
catalysts.`;
}

/** Concatenate the assistant's text blocks, ignoring thinking blocks. */
function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * Run a live IESE analysis through Claude.
 *
 * Structured outputs constrain the response to `analysisSchema`, so a
 * truncated or prose-wrapped body is not a failure mode here the way it was
 * with free-form generation. Throws on any failure; callers decide whether to
 * fall back.
 */
export async function runClaudeAnalysis(ticker: string): Promise<CompanyScore> {
  if (isDemoMode()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: analysisSchema },
    },
    messages: [{ role: "user", content: buildAnalysisPrompt(ticker) }],
  });

  // Check why generation stopped before trusting the content. A refusal
  // returns HTTP 200 with empty or partial content, so indexing straight into
  // content[0] would misread a declined request as an answer.
  if (response.stop_reason === "refusal") {
    const detail = response.stop_details?.category ?? "unspecified";
    throw new Error(`Claude declined the request for ${ticker} (category: ${detail}).`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `Response for ${ticker} hit max_tokens before completing — raise max_tokens.`
    );
  }

  const text = textOf(response.content);
  if (!text) {
    throw new Error(
      `Empty response for ${ticker} (stop_reason: ${response.stop_reason}).`
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Unparseable response for ${ticker} (stop_reason: ${response.stop_reason}, ` +
        `${text.length} chars).`
    );
  }

  const categories = {
    demand: parsed.categories.demand,
    execution: parsed.categories.execution,
    competition: parsed.categories.competition,
    financial: parsed.categories.financial,
    external: parsed.categories.external,
  };

  const analyzed: CompanyScore = {
    company: { ticker, ...parsed.company },
    score: {
      overall: 0, // recomputed below from fixed weights — never trust the model's own arithmetic
      confidence: Number(parsed.score.confidence) || 50,
      trend: parsed.score.trend || "→",
      verification: parsed.score.verification || "?",
      evidence_strength: Number(parsed.score.evidence_strength) || 2,
      last_updated: new Date().toISOString(),
    },
    categories,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    summary: parsed.summary,
  };
  analyzed.score.overall = computeOverallScore(analyzed.categories);

  return analyzed;
}

/**
 * Deterministic, clearly-labeled synthetic fallback. Used when no
 * ANTHROPIC_API_KEY is configured or a live call fails. Every record it
 * produces says so in its own evidence trail and summary — a simulated record
 * must never be mistakable for real analysis.
 */
export function generateSimulatedAnalysis(
  ticker: string,
  reason = "no ANTHROPIC_API_KEY configured"
): CompanyScore {
  const cleanTicker = ticker.toUpperCase().trim();
  const seedNum = cleanTicker.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rand = (min: number, max: number, salt: number) =>
    Math.floor(min + ((seedNum * (salt + 1)) % (max - min + 1)));

  const trendFor = (score: number) =>
    score >= 85 ? "↑↑" : score >= 70 ? "↑" : score >= 55 ? "→" : score >= 40 ? "↓" : "↓↓";

  const buildCategory = (salt: number, label: string) => {
    const score = rand(35, 90, salt);
    return {
      score,
      trend: trendFor(score) as CompanyScore["categories"]["demand"]["trend"],
      metrics: [
        {
          name: `${label} indicator A`,
          value: "Simulated",
          score: rand(35, 90, salt + 1),
          trend: trendFor(rand(35, 90, salt + 1)) as any,
          notes: `Simulated metric — ${reason}.`,
        },
        {
          name: `${label} indicator B`,
          value: "Simulated",
          score: rand(35, 90, salt + 2),
          trend: trendFor(rand(35, 90, salt + 2)) as any,
          notes: `Simulated metric — ${reason}.`,
        },
      ],
    };
  };

  const categories = {
    demand: buildCategory(1, "Demand"),
    execution: buildCategory(2, "Execution"),
    competition: buildCategory(3, "Competition"),
    financial: buildCategory(4, "Financial"),
    external: buildCategory(5, "External"),
  };

  const price = Number((1.2 + (seedNum % 40) + Math.random() * 0.75).toFixed(2));
  const changePercent = Number((((seedNum % 9) - 4) + Math.random()).toFixed(2));

  const result: CompanyScore = {
    company: {
      ticker: cleanTicker,
      name: `${cleanTicker} Corporation`,
      industry: "Unclassified (simulated)",
      market_cap: "Unknown (simulated)",
      price,
      price_change_24h: changePercent,
      volume_24h: "N/A",
    },
    score: {
      overall: 0,
      confidence: rand(30, 60, 6),
      trend: trendFor(rand(35, 90, 7)) as any,
      verification: "?",
      evidence_strength: 1,
      last_updated: new Date().toISOString(),
    },
    categories,
    evidence: [
      {
        title: "No live analysis available",
        category: "external",
        description:
          `This record was generated by the offline simulation engine because ${reason}. ` +
          "It is not real analysis and must not be treated as signal.",
        date: new Date().toISOString().slice(0, 10),
        source: "StxWatch-MCMG simulation engine",
        url: "",
        reliability: 0,
        verified: false,
        independent_sources: 0,
        confidence: 0,
        impact: 0,
        expires: new Date().toISOString().slice(0, 10),
      },
    ],
    summary: {
      overall_assessment: `Simulated placeholder analysis for ${cleanTicker} (${reason}). Configure ANTHROPIC_API_KEY to run a real, evidence-based IESE analysis.`,
      key_risks: ["No live evidence available in simulation mode"],
      watch_items: ["Configure ANTHROPIC_API_KEY for real analysis"],
      next_catalysts: ["N/A — simulated record"],
    },
  };
  result.score.overall = computeOverallScore(result.categories);
  return result;
}
