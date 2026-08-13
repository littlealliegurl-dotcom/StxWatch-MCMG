/**
 * StxWatch-MCMG — local development / self-hosted server.
 *
 * The API itself lives in lib/api.ts so that the same routes can be served
 * both from here and from the Vercel serverless function in api/. This file
 * adds only the things a long-running host needs and a serverless function
 * must not have: Vite middleware in development, static file serving in
 * production, and a listening port.
 *
 * Production on Vercel does NOT run this file — see api/[...path].ts.
 */

import path from "path";
import express from "express";
import dotenv from "dotenv";
import { createApiApp } from "./lib/api";

dotenv.config();

async function startServer() {
  const app = createApiApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== "production") {
    // Imported dynamically so Vite is never pulled into a production bundle.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StxWatch-MCMG server running on port ${PORT}`);
  });
}

startServer();
