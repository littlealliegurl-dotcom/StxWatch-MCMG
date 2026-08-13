import type { CompanyScore } from "../src/types";

/**
 * Baseline example data for local development and the offline demo. A record
 * here is replaced the moment a user re-runs analysis on the same ticker.
 * See CONFLICTS.md item 2 for why this basket replaces the AI Studio export's
 * sub-$10 growth list.
 */
export const PRE_SEEDED_STOCKS: CompanyScore[] = [
  {
    company: {
      ticker: "ASTS",
      name: "AST SpaceMobile, Inc.",
      industry: "Satellite Telecommunications",
      market_cap: "~$17B",
      price: 58.5,
      price_change_24h: 6.32,
      volume_24h: "30.6M",
    },
    score: {
      overall: 0,
      confidence: 68,
      trend: "↑",
      verification: "+",
      evidence_strength: 4,
      last_updated: new Date().toISOString(),
    },
    categories: {
      demand: {
        score: 82,
        trend: "↑↑",
        metrics: [
          { name: "MNO partnership pipeline", value: "AT&T, Verizon, T-Mobile", score: 88, trend: "↑↑", notes: "Direct-to-device joint venture commitments from major US carriers." },
          { name: "Spectrum access", value: "~1,150 MHz partner + owned", score: 76, trend: "↑", notes: "Combined partner spectrum plus owned L-band/S-band rights." },
        ],
      },
      execution: {
        score: 71,
        trend: "↑",
        metrics: [
          { name: "Satellite launch cadence", value: "BlueBird 8-10 in progress", score: 74, trend: "↑", notes: "Next-generation satellite launches actively scheduled." },
          { name: "Manufacturing vertical integration", value: "~95%", score: 80, trend: "→", notes: "In-house manufacturing reduces supply chain risk." },
        ],
      },
      competition: {
        score: 69,
        trend: "→",
        metrics: [
          { name: "Direct-to-device rivals", value: "Starlink Direct to Cell, Globalstar", score: 62, trend: "↓", notes: "Competing constellations targeting the same use case." },
          { name: "Technical differentiation", value: "Unmodified smartphone compatibility", score: 78, trend: "↑", notes: "No special hardware required on the handset side." },
        ],
      },
      financial: {
        score: 48,
        trend: "↓",
        metrics: [
          { name: "Cash burn / capital raises", value: "$1B convertible notes (2034)", score: 40, trend: "↓", notes: "Recent large capital raise signals continued pre-revenue burn." },
          { name: "Revenue growth", value: "+1,505% YoY (off small base)", score: 58, trend: "↑", notes: "Early commercial revenue growing quickly but still small in absolute terms." },
        ],
      },
      external: {
        score: 60,
        trend: "→",
        metrics: [
          { name: "Regulatory (FCC/spectrum)", value: "Ongoing approvals", score: 62, trend: "→", notes: "Spectrum and licensing approvals remain a gating factor." },
          { name: "Sector volatility", value: "Space stocks ~5x market volatility", score: 45, trend: "↓", notes: "Sector-wide swings independent of company fundamentals." },
        ],
      },
    },
    evidence: [
      { title: "AT&T/Verizon/T-Mobile direct-to-device JV", category: "demand", description: "Major US carriers announced a joint venture to extend mobile coverage via satellite, with ASTS positioned as a key network enabler.", date: "2026-06-01", source: "Company/press coverage", url: "https://www.stocktitan.net/news/ASTS/", reliability: 78, verified: true, independent_sources: 3, confidence: 74, impact: 62, expires: "2026-12-01" },
      { title: "$1B convertible senior notes offering", category: "financial", description: "Company priced a $1 billion private offering of convertible senior notes due 2034, raising near-term dilution and leverage questions.", date: "2026-07-16", source: "TipRanks/CNN Markets", url: "https://www.cnn.com/markets/stocks/ASTS", reliability: 80, verified: true, independent_sources: 2, confidence: 78, impact: -35, expires: "2026-10-16" },
      { title: "Analyst coverage split", category: "external", description: "Piper Sandler initiated coverage naming ASTS its preferred space stock, while other commentary flagged 'stay away' concerns the same week.", date: "2026-07-15", source: "TipRanks", url: "https://www.cnn.com/markets/stocks/ASTS", reliability: 55, verified: false, independent_sources: 2, confidence: 50, impact: 5, expires: "2026-09-15" },
    ],
    summary: {
      overall_assessment: "A high-conviction demand story — real carrier commitments and vertically integrated manufacturing — offset by heavy capital intensity and a stock price that has round-tripped sharply in recent months.",
      key_risks: ["Continued cash burn ahead of meaningful commercial revenue", "Execution risk on satellite launch cadence", "High sector-wide volatility unrelated to fundamentals"],
      watch_items: ["BlueBird 8/9/10 launch outcomes", "FCC spectrum approvals", "Convertible note dilution impact"],
      next_catalysts: ["Additional MNO commercial launches", "Q3 2026 earnings", "Next satellite batch launch window"],
    },
  },
  {
    company: {
      ticker: "RENE",
      name: "Reneo Pharmaceuticals, Inc.",
      industry: "Clinical-Stage Biopharmaceuticals",
      market_cap: "Micro-cap",
      price: 1.1,
      price_change_24h: -2.1,
      volume_24h: "0.4M",
    },
    score: {
      overall: 0,
      confidence: 42,
      trend: "↓",
      verification: "?",
      evidence_strength: 2,
      last_updated: new Date().toISOString(),
    },
    categories: {
      demand: {
        score: 55,
        trend: "→",
        metrics: [
          { name: "Target indication size", value: "Rare mitochondrial/metabolic disease", score: 58, trend: "→", notes: "Small but underserved patient population with limited approved therapies." },
          { name: "Unmet need", value: "High within indication", score: 65, trend: "→", notes: "Few or no approved disease-modifying treatments in the space." },
        ],
      },
      execution: {
        score: 40,
        trend: "↓",
        metrics: [
          { name: "Pipeline stage", value: "Clinical-stage, pre-approval", score: 45, trend: "↓", notes: "No approved product generating revenue yet." },
          { name: "Trial/regulatory timeline risk", value: "Elevated", score: 35, trend: "↓", notes: "Clinical-stage biopharma carries binary trial-outcome risk." },
        ],
      },
      competition: {
        score: 50,
        trend: "→",
        metrics: [
          { name: "Competing programs", value: "Limited direct competition", score: 60, trend: "→", notes: "Narrow indication reduces crowding, but larger players could enter." },
          { name: "IP protection", value: "Standard biopharma patent estate", score: 50, trend: "→", notes: "Typical patent runway for a clinical-stage asset." },
        ],
      },
      financial: {
        score: 33,
        trend: "↓",
        metrics: [
          { name: "Cash runway", value: "Limited, pre-revenue", score: 30, trend: "↓", notes: "Typical of small clinical-stage biotechs; dilution risk is real." },
          { name: "Burn rate", value: "High relative to market cap", score: 35, trend: "↓", notes: "R&D and trial costs outpace any near-term revenue." },
        ],
      },
      external: {
        score: 40,
        trend: "↓",
        metrics: [
          { name: "Regulatory pathway", value: "FDA orphan/rare disease track", score: 48, trend: "→", notes: "Orphan drug pathways can accelerate review but are not guaranteed." },
          { name: "Biotech sector sentiment", value: "Weak for pre-revenue micro-caps", score: 32, trend: "↓", notes: "Capital markets currently unfavorable to cash-burning clinical names." },
        ],
      },
    },
    evidence: [
      { title: "Pre-revenue clinical-stage status", category: "financial", description: "Company remains in clinical development with no approved commercial product, typical of the micro-cap biopharma risk profile.", date: "2026-05-01", source: "General sector research", url: "https://www.sec.gov/edgar/search/", reliability: 50, verified: false, independent_sources: 1, confidence: 40, impact: -25, expires: "2026-08-01" },
    ],
    summary: {
      overall_assessment: "A speculative, pre-revenue clinical-stage name whose fate is tied almost entirely to trial readouts and cash runway rather than current fundamentals. Evidence base is thin — treat this record as a starting point, not a verdict.",
      key_risks: ["Binary clinical trial outcomes", "Dilutive financing risk", "Weak biotech sector sentiment for micro-caps"],
      watch_items: ["Upcoming trial readout dates", "Cash runway updates in quarterly filings"],
      next_catalysts: ["Clinical trial data releases", "Potential partnership or financing announcements"],
    },
  },
  {
    company: {
      ticker: "BMEA",
      name: "Biomea Fusion, Inc.",
      industry: "Clinical-Stage Biotechnology",
      market_cap: "Micro-cap",
      price: 1.8,
      price_change_24h: 1.4,
      volume_24h: "1.1M",
    },
    score: {
      overall: 0,
      confidence: 45,
      trend: "→",
      verification: "?",
      evidence_strength: 2,
      last_updated: new Date().toISOString(),
    },
    categories: {
      demand: {
        score: 58,
        trend: "→",
        metrics: [
          { name: "Target market", value: "Diabetes / genetically-defined diseases", score: 62, trend: "→", notes: "Focus on covalent small-molecule 'menin inhibitor' programs." },
          { name: "Unmet need", value: "Moderate-to-high in target subgroups", score: 55, trend: "→", notes: "Existing standard-of-care leaves room for differentiated mechanisms." },
        ],
      },
      execution: {
        score: 42,
        trend: "→",
        metrics: [
          { name: "Clinical pipeline maturity", value: "Early-to-mid stage", score: 42, trend: "→", notes: "No approved products; multiple programs in early clinical trials." },
          { name: "Manufacturing / CMC readiness", value: "Standard for stage", score: 42, trend: "→", notes: "Typical clinical-stage manufacturing partnerships." },
        ],
      },
      competition: {
        score: 52,
        trend: "→",
        metrics: [
          { name: "Menin inhibitor competitive field", value: "Several other developers active", score: 45, trend: "↓", notes: "Multiple companies pursuing overlapping mechanisms." },
          { name: "Differentiation", value: "Covalent binding approach", score: 58, trend: "→", notes: "Claimed durability advantage versus reversible inhibitors." },
        ],
      },
      financial: {
        score: 35,
        trend: "↓",
        metrics: [
          { name: "Cash position vs. burn", value: "Multi-quarter runway, pre-revenue", score: 38, trend: "↓", notes: "Standard clinical-stage burn profile." },
          { name: "Dilution history", value: "Periodic equity raises", score: 32, trend: "↓", notes: "Typical financing pattern for the sector." },
        ],
      },
      external: {
        score: 45,
        trend: "→",
        metrics: [
          { name: "Regulatory pathway", value: "Standard FDA review track", score: 48, trend: "→", notes: "No unusual regulatory designations confirmed." },
          { name: "Biotech capital markets sentiment", value: "Mixed", score: 42, trend: "→", notes: "Sentiment swings with broader biotech risk appetite." },
        ],
      },
    },
    evidence: [
      { title: "Clinical-stage, pre-revenue profile", category: "execution", description: "Company's programs remain in clinical development without an approved product on the market.", date: "2026-05-15", source: "General sector research", url: "https://www.sec.gov/edgar/search/", reliability: 50, verified: false, independent_sources: 1, confidence: 42, impact: -15, expires: "2026-08-15" },
    ],
    summary: {
      overall_assessment: "An early-stage biotech with a differentiated mechanism thesis but limited independently verified evidence in this record. Best treated as a watchlist name pending clinical catalysts.",
      key_risks: ["Clinical trial failure risk", "Competitive mechanism-of-action field", "Continued need for dilutive financing"],
      watch_items: ["Trial enrollment and readout timing", "Competitor trial data"],
      next_catalysts: ["Interim or topline trial data", "Conference presentations"],
    },
  },
  {
    company: {
      ticker: "LUNA",
      name: "Luna Innovations Incorporated",
      industry: "Photonics & Fiber-Optic Sensing Technology",
      market_cap: "Micro-cap",
      price: 4.6,
      price_change_24h: 0.9,
      volume_24h: "0.3M",
    },
    score: {
      overall: 0,
      confidence: 60,
      trend: "→",
      verification: "+",
      evidence_strength: 3,
      last_updated: new Date().toISOString(),
    },
    categories: {
      demand: {
        score: 62,
        trend: "→",
        metrics: [
          { name: "End markets", value: "Aerospace, defense, telecom test", score: 65, trend: "→", notes: "Diversified customer base across industrial sensing applications." },
          { name: "Backlog trend", value: "Stable-to-growing", score: 58, trend: "→", notes: "Order backlog broadly steady per recent filings." },
        ],
      },
      execution: {
        score: 60,
        trend: "→",
        metrics: [
          { name: "Product commercialization", value: "Established, revenue-generating", score: 68, trend: "→", notes: "Unlike the biotech names above, Luna has shipping commercial products." },
          { name: "Operational efficiency initiatives", value: "Ongoing cost actions", score: 52, trend: "→", notes: "Company has pursued restructuring/cost actions in recent periods." },
        ],
      },
      competition: {
        score: 55,
        trend: "→",
        metrics: [
          { name: "Niche positioning", value: "Specialized fiber-optic sensing", score: 60, trend: "→", notes: "Smaller, specialized competitive set versus broad-line test & measurement firms." },
          { name: "Customer concentration", value: "Moderate", score: 50, trend: "→", notes: "Some concentration in defense/government contracts." },
        ],
      },
      financial: {
        score: 52,
        trend: "→",
        metrics: [
          { name: "Revenue stability", value: "Established recurring base", score: 58, trend: "→", notes: "More mature revenue base than the pre-revenue names in this list." },
          { name: "Profitability", value: "Historically thin/negative margins", score: 42, trend: "→", notes: "Margin improvement has been an ongoing management focus." },
        ],
      },
      external: {
        score: 55,
        trend: "→",
        metrics: [
          { name: "Government/defense budget exposure", value: "Meaningful", score: 55, trend: "→", notes: "Revenue tied in part to defense and government R&D budgets." },
          { name: "Micro-cap liquidity risk", value: "Elevated", score: 45, trend: "↓", notes: "Thin trading volume typical of sub-$500M float." },
        ],
      },
    },
    evidence: [
      { title: "Diversified commercial sensing business", category: "execution", description: "Company generates recurring revenue across aerospace, defense, and telecom test-and-measurement customers, distinguishing it from pre-revenue peers in this basket.", date: "2026-04-20", source: "General sector research", url: "https://www.sec.gov/edgar/search/", reliability: 55, verified: false, independent_sources: 1, confidence: 55, impact: 20, expires: "2026-07-20" },
    ],
    summary: {
      overall_assessment: "A more mature, revenue-generating micro-cap than most in this basket, with steady niche demand offset by thin liquidity and historically modest margins.",
      key_risks: ["Micro-cap trading liquidity", "Margin pressure", "Customer/government budget concentration"],
      watch_items: ["Quarterly margin trends", "Defense budget allocations"],
      next_catalysts: ["Next quarterly earnings", "New contract awards"],
    },
  },
  {
    company: {
      ticker: "QUBT",
      name: "Quantum Computing Inc.",
      industry: "Quantum Computing Hardware & Photonics",
      market_cap: "Micro-cap",
      price: 12.4,
      price_change_24h: 4.2,
      volume_24h: "18.9M",
    },
    score: {
      overall: 0,
      confidence: 38,
      trend: "↑",
      verification: "?",
      evidence_strength: 2,
      last_updated: new Date().toISOString(),
    },
    categories: {
      demand: {
        score: 70,
        trend: "↑↑",
        metrics: [
          { name: "Sector momentum", value: "High retail & institutional interest", score: 80, trend: "↑↑", notes: "Quantum computing names have seen strong speculative inflows sector-wide." },
          { name: "Commercial revenue base", value: "Early / limited", score: 40, trend: "→", notes: "Revenue remains small relative to market capitalization." },
        ],
      },
      execution: {
        score: 45,
        trend: "→",
        metrics: [
          { name: "Technology maturity", value: "Early-stage photonic approach", score: 42, trend: "→", notes: "Photonic quantum + reservoir computing approach still maturing versus larger peers." },
          { name: "Manufacturing scale-up", value: "Limited", score: 40, trend: "→", notes: "Small-scale production relative to sector leaders." },
        ],
      },
      competition: {
        score: 40,
        trend: "↓",
        metrics: [
          { name: "Competitive field", value: "IonQ, Rigetti, D-Wave, IBM, others", score: 35, trend: "↓", notes: "Crowded field with better-capitalized competitors." },
          { name: "Differentiation clarity", value: "Unclear vs. peers", score: 40, trend: "→", notes: "Value proposition versus larger quantum players not clearly established." },
        ],
      },
      financial: {
        score: 30,
        trend: "↓",
        metrics: [
          { name: "Valuation vs. revenue", value: "Elevated multiple", score: 22, trend: "↓", notes: "Market cap significantly outpaces current commercial revenue." },
          { name: "Share dilution history", value: "Frequent equity issuance", score: 28, trend: "↓", notes: "History of raising capital via share issuance." },
        ],
      },
      external: {
        score: 48,
        trend: "→",
        metrics: [
          { name: "Government quantum funding", value: "Favorable federal tailwinds", score: 60, trend: "↑", notes: "Public-sector quantum computing investment has been a sector tailwind." },
          { name: "Speculative-flow sensitivity", value: "High", score: 30, trend: "↓", notes: "Price action closely tracks sector-wide speculative sentiment rather than company-specific news." },
        ],
      },
    },
    evidence: [
      { title: "Quantum sector-wide speculative rally", category: "external", description: "Broad government and institutional interest in quantum computing has lifted an entire basket of names, this one included, independent of company-specific fundamentals.", date: "2026-06-01", source: "Sector news aggregation", url: "https://www.webull.com/quote/nasdaq-qtum", reliability: 45, verified: false, independent_sources: 2, confidence: 40, impact: 30, expires: "2026-09-01" },
    ],
    summary: {
      overall_assessment: "Momentum-driven micro-cap whose price action is dominated by sector-wide quantum computing enthusiasm rather than company-specific commercial traction. High speculative risk.",
      key_risks: ["Valuation disconnected from current revenue", "Crowded, better-funded competitive field", "High sensitivity to sector sentiment swings"],
      watch_items: ["Commercial contract announcements", "Cash runway / dilution filings"],
      next_catalysts: ["Product milestone announcements", "Sector-wide quantum computing news flow"],
    },
  },
];
