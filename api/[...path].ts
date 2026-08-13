/**
 * Vercel serverless entry point.
 *
 * Vercel's catch-all convention routes every /api/* request here with the
 * original URL preserved, so the Express app below matches its own route
 * paths (/api/stocks, /api/config, /api/stocks/analyze) unchanged.
 *
 * An Express app is itself an (req, res) handler, so exporting it directly is
 * all the Node runtime needs. Nothing in this import graph touches the
 * filesystem or opens a port — that is what makes it serverless-safe.
 */

import { createApiApp } from "../lib/api";

export default createApiApp();
