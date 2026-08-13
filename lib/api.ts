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

  // GET /api/config — tells the client whether it is running against live
  // Gemini analysis or the offline simulation. See CONFLICTS.md item 7:
  // process.env isn't reliably available in the Vite client bundle, so this
  // replaces the AI Studio export's client-side env var check.
  app.get("/api/config", (_req: Request, res: Response) => {
    res.json({
      demoMode: isDemoMode(),
      persistence: isAirtableConfigured() ? "airtable" : "memory",
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
