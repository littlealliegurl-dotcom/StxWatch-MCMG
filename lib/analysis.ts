/**
 * StxWatch-MCMG — IESE analysis engine (shared)
 *
 * Extracted from server.ts so both the local dev server and the Vercel
 * serverless function can run the same code path. Nothing here touches the
 * filesystem, an HTTP server, or Vite — it must stay importable inside a
 * serverless function.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { CompanyScore, computeOverallScore } from "../src/types";

export const TREND_ENUM = ["↑↑", "↑", "→", "↓", "↓↓"];
export const VERIFICATION_ENUM = ["++", "+", "○", "?", "X"];

const GEMINI_MODEL = "gemini-3.5-flash";

/** True when no usable Gemini key is configured, so the app runs simulated. */
export function isDemoMode(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return !apiKey || apiKey === "MY_GEMINI_API_KEY";
}

function categoryBlockSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.INTEGER },
      trend: { type: Type.STRING, enum: TREND_ENUM },
      metrics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            value: { type: Type.STRING },
            score: { type: Type.INTEGER },
            trend: { type: Type.STRING, enum: TREND_ENUM },
            notes: { type: Type.STRING },
          },
          required: ["name", "value", "score", "trend", "notes"],
        },
      },
    },
    required: ["score", "trend", "metrics"],
  };
}

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    company: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        industry: { type: Type.STRING },
        market_cap: { type: Type.STRING },
        price: { type: Type.NUMBER },
        price_change_24h: { type: Type.NUMBER },
        volume_24h: { type: Type.STRING },
      },
      required: ["name", "industry", "market_cap", "price", "price_change_24h", "volume_24h"],
    },
    score: {
      type: Type.OBJECT,
      properties: {
        confidence: { type: Type.INTEGER },
        trend: { type: Type.STRING, enum: TREND_ENUM },
        verification: { type: Type.STRING, enum: VERIFICATION_ENUM },
        evidence_strength: { type: Type.INTEGER },
      },
      required: ["confidence", "trend", "verification", "evidence_strength"],
    },
    categories: {
      type: Type.OBJECT,
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
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { type: Type.STRING },
          description: { type: Type.STRING },
          date: { type: Type.STRING },
          source: { type: Type.STRING },
          url: { type: Type.STRING },
          reliability: { type: Type.INTEGER },
          verified: { type: Type.BOOLEAN },
          independent_sources: { type: Type.INTEGER },
          confidence: { type: Type.INTEGER },
          impact: { type: Type.INTEGER },
          expires: { type: Type.STRING },
        },
        required: [
          "title", "category", "description", "date", "source", "url",
          "reliability", "verified", "independent_sources", "confidence", "impact", "expires",
        ],
      },
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        overall_assessment: { type: Type.STRING },
        key_risks: { type: Type.ARRAY, items: { type: Type.STRING } },
        watch_items: { type: Type.ARRAY, items: { type: Type.STRING } },
        next_catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["overall_assessment", "key_risks", "watch_items", "next_catalysts"],
    },
  },
  required: ["company", "score", "categories", "evidence", "summary"],
};

function buildAnalysisPrompt(ticker: string): string {
  // 4DATA — industry profiles are determined dynamically by the model rather
  // than hardcoded, so the same five fixed categories flex to whatever
  // indicators are relevant for the company's actual industry.
  return `Conduct a comprehensive Investment Evidence Scoring Engine (IESE) analysis for the
company with stock ticker: ${ticker}.

You are working from your training knowledge only — you do NOT have live web search access
for this analysis. First identify the company's actual industry, then choose the two most
relevant, industry-appropriate metrics for EACH of these five fixed categories:

1. Demand — market size, customer/partner traction, adoption signals
2. Execution — product/operational delivery, management execution
3. Competition — competitive position and differentiation
4. Financial — balance sheet health, revenue, margins, cash runway
5. External — regulatory, macro, and sector-sentiment factors

For each category, provide a 0-100 score, a trend arrow, and exactly two metrics (name, a
short display value, a 0-100 score, a trend arrow, and a one-sentence note).

Provide 2-4 evidence items — each one a specific, dated observation you are confident about
from training data, with a source name and a URL if you know one. Do not fabricate sources or
URLs. If you are not confident a claim is independently verifiable, reflect that with a lower
reliability/confidence score and verified: false. Leave url as an empty string rather than
guessing one.

Because you have no live data, keep "confidence" and "reliability" lower than you would with
real-time search, and treat price/market-cap figures as approximate and possibly stale — say
so in the relevant metric notes.

Finally, provide an executive summary, 2-4 key risks, 2-4 watch items, and 2-4 upcoming
catalysts.`;
}

/**
 * Run a live IESE analysis through Gemini.
 *
 * Note: Google Search grounding is deliberately NOT enabled. Grounded requests
 * hit 429 RESOURCE_EXHAUSTED immediately on the free tier — the same reason
 * scorer.ts dropped it. Both call sites now run on training knowledge.
 * Throws on any failure; callers decide whether to fall back.
 */
export async function runGeminiAnalysis(ticker: string): Promise<CompanyScore> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "stxwatch-mcmg" } },
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildAnalysisPrompt(ticker),
    config: {
      systemInstruction:
        "You are a rigorous, evidence-based equities research engine working from training " +
        "knowledge only (no live search access). Every score must be traceable to something " +
        "you actually know. Prefer honesty about uncertainty over confident fabrication — " +
        "lower confidence scores are expected and correct given the lack of live data.",
      responseMimeType: "application/json",
      responseSchema: analysisResponseSchema,
    },
  });

  const responseText = response.text ? response.text.trim() : "";
  if (!responseText) {
    const finishReason = response.candidates?.[0]?.finishReason ?? "(none reported)";
    throw new Error(`Empty response returned from Gemini (finishReason: ${finishReason}).`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    const finishReason = response.candidates?.[0]?.finishReason ?? "(none reported)";
    throw new Error(
      `Unparseable Gemini response for ${ticker} (finishReason: ${finishReason}, ` +
        `${responseText.length} chars).`
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
 * GEMINI_API_KEY is configured or a live call fails. Every record it produces
 * says so in its own evidence trail and summary — a simulated record must
 * never be mistakable for real analysis.
 */
export function generateSimulatedAnalysis(
  ticker: string,
  reason = "no GEMINI_API_KEY configured"
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
      overall_assessment: `Simulated placeholder analysis for ${cleanTicker} (${reason}). Configure GEMINI_API_KEY to run a real, evidence-based IESE analysis.`,
      key_risks: ["No live evidence available in simulation mode"],
      watch_items: ["Configure GEMINI_API_KEY for real analysis"],
      next_catalysts: ["N/A — simulated record"],
    },
  };
  result.score.overall = computeOverallScore(result.categories);
  return result;
}
