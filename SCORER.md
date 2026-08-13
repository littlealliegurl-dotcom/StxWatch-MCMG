# StxWatch-MCMG Scoring Automation

## Overview

The IESE Automation Scorer (`scorer.ts`) runs the Investment Evidence Scoring Engine against your seed basket of five micro-cap tickers and writes results to Airtable for tracking, analysis, and momentum calculation.

**Seed basket:** ASTS, RENE, BMEA, LUNA, QUBT

## Run Modes

### Development (Local)
```bash
npm run score
```
Runs via `tsx` directly. Good for testing and development. Logs output to console.

### Build for Production
```bash
npm run score:build
```
Bundles `scorer.ts` into `dist/scorer.cjs` (CommonJS format). Can be deployed to a cron service or CI/CD platform.

### Production Execution
```bash
npm run score:prod
```
Runs the bundled scorer with `NODE_ENV=production`.

### Automated (GitHub Actions)
The workflow `.github/workflows/daily-score.yml` runs automatically every day at **09:00 UTC** (4 AM EST, before market open).

To trigger manually:
1. Go to GitHub repo → Actions → Daily IESE Scoring
2. Click "Run workflow" → "Run workflow"

## What the Scorer Does

1. **Analyzes each ticker** — calls the Claude API with a prompt to evaluate demand, execution, competition, financial health, and external factors
2. **Falls back gracefully** — if the Anthropic key is not set or the API fails, generates a deterministic simulated score
3. **Computes category scores** — produces 0–100 values for each of the five IESE categories
4. **Writes to Airtable** — if AIRTABLE_PAT is configured, stores records in the `tblScores` table

## Configuration

### Environment Variables

**Required for full automation:**
- `ANTHROPIC_API_KEY` — Anthropic API key (get from https://console.anthropic.com)
- `AIRTABLE_PAT` — Airtable Personal Access Token with `data.records:write` scope

**Optional:**
- `NODE_ENV` — set to `production` to skip Vite dev middleware (auto in CI/CD)

### Setting Secrets in GitHub

1. Go to repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `ANTHROPIC_API_KEY`, Value: your Anthropic key
4. Name: `AIRTABLE_PAT`, Value: your Airtable PAT
5. Save

The workflow will automatically use these when running.

## Airtable Integration

### Table: `tblScores`
Stores one record per ticker per run. Fields:

| Field | Type | Notes |
|-------|------|-------|
| Ticker | Single line text | ASTS, RENE, BMEA, LUNA, or QUBT |
| Overall Score | Number | 0–100 |
| Confidence | Number | 0–100 |
| Last Updated | Date | ISO 8601 timestamp |
| Demand | Number | Category score 0–100 |
| Execution | Number | Category score 0–100 |
| Competition | Number | Category score 0–100 |
| Financial | Number | Category score 0–100 |
| External | Number | Category score 0–100 |
| Evidence Count | Number | Count of evidence items found |

### Creating the Table

If the `tblScores` table doesn't exist yet, you can create it manually in Airtable or the scorer will log an error. To create it:

1. Open your StxWatch-MCMG Airtable base
2. Click "+" to add a table
3. Name it (system will assign an ID like `tblXXXXXXXXXXXXXX`)
4. Add the fields listed above
5. Update `AIRTABLE_SCORES_TABLE_ID` in `scorer.ts` to match your table ID

## Score History & Momentum

Currently, the scorer writes one record per run. To implement **score history** (12–15 entries per ticker) with **momentum indicator** (↑↑, ↑, →, ↓, ↓↓):

1. Create a separate `tblScoreHistory` table with:
   - Ticker (link to `tblScores`)
   - Overall Score
   - Date
   - Trend (single-select: ↑↑, ↑, →, ↓, ↓↓)

2. Modify `scorer.ts` to:
   - Fetch last 15 scores for each ticker
   - Calculate trend by comparing latest to previous
   - Append new score to history, trim to 15 records

This is a planned feature — flag if you want it prioritized.

## Troubleshooting

### "AIRTABLE_PAT not set"
The scorer runs but doesn't write to Airtable. Set the environment variable:
```bash
export AIRTABLE_PAT="your_token_here"
npm run score
```

### "Airtable API error (401)"
Your token is invalid or expired. Generate a new one at https://airtable.com/account/tokens.

### "Could not parse Claude response"
The response did not parse as JSON. Check `scorer-debug.txt` (committed on every run) — it records the `stop_reason` and response length alongside the raw text. Structured outputs constrain generation to the schema, so this should not happen; if it does, the scorer falls back to simulation and marks the row `simulated` in Airtable's Data Source column.

### A note on live data
The scorer runs off Claude's training knowledge — it has no live web search. Analysis therefore does not reflect current market or news data, and the prompt tells the model to keep confidence scores conservative and flag price/market-cap figures as possibly stale. Rows written without live analysis are marked `simulated` in the Data Source column so they are never mistaken for real signal.

### "Table not found (404)"
The `tblScores` table ID in `scorer.ts` doesn't exist in your Airtable base. Either create the table or update the ID.

## Next Steps

- [ ] Set Anthropic and Airtable secrets in GitHub
- [ ] Test manually: `npm run score`
- [ ] Verify records appear in Airtable
- [ ] Monitor first automated run at next daily trigger (09:00 UTC)
- [ ] Implement score history & momentum tracking
- [ ] Build dashboard to visualize score trends
