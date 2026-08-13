/**
 * StxWatch-MCMG — API routes
 *
 * Returns a bare Express app carrying only the JSON API. Deliberately knows
 * nothing about Vite, static assets, ports or the filesystem, so the same app
 * can be mounted by the local dev server (server.ts) and exported directly as
 * a Vercel serverless function (api/index.ts).
 */

import express, { type Express, type Request, type Response } from "express";
import { generateSimulatedAnalysis, isDemoMode, runGeminiAnalysis } from "./analysis";
import { isAirtableConfigured, listStocks, saveStock } from "./store";

export function createApiApp(): Express {
  const app = express();

  app.use(express.json());

  // GET /api/stocks — every tracked company, newest first.
  app.get("/api/stocks", async (_req: Request, res: Response) => {
    try {
      res.json(await listStocks());
    } catch (error) {
      console.error("GET /api/stocks failed:", error);
      res.status(500).json({ error: "Failed to load tracked companies." });
    }
  });

  // GET /api/health — deliberately depends on NOTHING: no env vars, no network,
  // no Airtable, no model call. Its only job is to prove the serverless function
  // is mounted and routing, so a routing failure can be told apart from a
  // missing-credential failure without guessing. If this returns HTML or 404,
  // the problem is vercel.json, not your keys.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "stxwatch-mcmg",
      node: process.version,
      time: new Date().toISOString(),
      // Booleans only — never the values themselves.
      env: {
        GEMINI_API_KEY: !isDemoMode(),
        AIRTABLE_PAT: isAirtableConfigured(),
      },
    });
  });

  // GET /api/config — tells the client whether it is running against live
  // Gemini analysis or the offline simulation. See CONFLICTS.md item 7:
  // process.env isn't reliably available in the Vite client bundle, so this
  // replaces the AI Studio export's client-side env var check.
  app.get("/api/config", (_req: Request, res: Response) => {
    // `missing` names exactly which credentials still need to be set, so a
    // half-configured deploy reports what is wrong instead of silently
    // degrading to simulated data.
    const missing: string[] = [];
    if (isDemoMode()) missing.push("GEMINI_API_KEY");
    if (!isAirtableConfigured()) missing.push("AIRTABLE_PAT");

    res.json({
      demoMode: isDemoMode(),
      persistence: isAirtableConfigured() ? "airtable" : "memory",
      ready: missing.length === 0,
      missing,
    });
  });

  // POST /api/stocks/analyze — run a fresh IESE analysis.
  app.post("/api/stocks/analyze", async (req: Request, res: Response) => {
    const ticker = req.body?.ticker ? String(req.body.ticker).toUpperCase().trim() : "";
    if (!ticker) {
      return res.status(400).json({ error: "Stock ticker is required." });
    }

    console.log(`Running IESE analysis for ticker: ${ticker}`);

    let result;
    let dataSource: "live" | "simulated";

    if (isDemoMode()) {
      console.log("GEMINI_API_KEY not configured — returning simulated analysis.");
      result = generateSimulatedAnalysis(ticker);
      dataSource = "simulated";
    } else {
      try {
        result = await runGeminiAnalysis(ticker);
        dataSource = "live";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Gemini analysis failed for ${ticker}:`, message);
        result = generateSimulatedAnalysis(ticker, `live analysis failed — ${message}`);
        dataSource = "simulated";
      }
    }

    const persisted = await saveStock(result, dataSource);

    // The client is told what it is actually looking at. A simulated record
    // that reads as real is the failure this project keeps re-learning.
    res.json({ ...result, _meta: { dataSource, persisted } });
  });

  return app;
}
