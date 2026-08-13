/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Search,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Compass,
  Activity,
  RefreshCw,
  ArrowRight,
  Info,
  Star,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  CompanyScore,
  TrendArrow,
  VerificationRating,
  Freshness,
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  getFreshness,
  getScoreLabel,
  getConfidenceLabel,
  getHealthState,
} from "./types";

const TREND_COLORS: Record<TrendArrow, string> = {
  "↑↑": "text-emerald-600 bg-emerald-50 border-emerald-100",
  "↑": "text-blue-600 bg-blue-50 border-blue-100",
  "→": "text-amber-600 bg-amber-50 border-amber-100",
  "↓": "text-orange-600 bg-orange-50 border-orange-100",
  "↓↓": "text-rose-600 bg-rose-50 border-rose-100",
};

const VERIFICATION_COLORS: Record<VerificationRating, string> = {
  "++": "text-emerald-700 bg-emerald-100/80 border-emerald-200",
  "+": "text-blue-700 bg-blue-100/80 border-blue-200",
  "○": "text-slate-600 bg-slate-100/80 border-slate-200",
  "?": "text-amber-700 bg-amber-100/80 border-amber-200",
  X: "text-rose-700 bg-rose-100/80 border-rose-200",
};

const FRESHNESS_COLORS: Record<Freshness, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
};

const HEALTH_COLORS: Record<string, { stroke: string; text: string; bg: string; border: string }> = {
  excellent: { stroke: "stroke-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  strong: { stroke: "stroke-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  positive: { stroke: "stroke-sky-500", text: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200" },
  neutral: { stroke: "stroke-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  "at-risk": { stroke: "stroke-rose-500", text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
};

const QUICK_PRESETS = ["ASTS", "RENE", "BMEA", "LUNA", "QUBT"];

function EvidenceStars({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" id="evidence-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= count ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
        />
      ))}
    </span>
  );
}

export default function App() {
  const [stocks, setStocks] = useState<CompanyScore[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [selectedStock, setSelectedStock] = useState<CompanyScore | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [demoMode, setDemoMode] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toUTCString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStocks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/stocks");
      if (res.ok) setStocks(await res.json());
    } catch (err) {
      console.error("Failed to load stocks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => cfg && setDemoMode(!!cfg.demoMode))
      .catch(() => {});
  }, []);

  const handleAnalyze = async (tickerToAnalyze?: string) => {
    const targetTicker = (tickerToAnalyze || searchInput).toUpperCase().trim();
    if (!targetTicker) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/stocks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: targetTicker }),
      });

      if (res.ok) {
        const newStock: CompanyScore = await res.json();
        setStocks((prev) => {
          const exists = prev.findIndex((s) => s.company.ticker === newStock.company.ticker);
          if (exists !== -1) {
            const next = [...prev];
            next[exists] = newStock;
            return next;
          }
          return [newStock, ...prev];
        });
        setSelectedStock(newStock);
        setEvidenceExpanded(false);
        setSearchInput("");
      } else {
        const errData = await res.json();
        setAnalysisError(errData.error || "Analysis failed. Please try again.");
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setAnalysisError("Server connection error. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const averageScore = stocks.length
    ? Math.round(stocks.reduce((sum, s) => sum + s.score.overall, 0) / stocks.length)
    : 0;

  const topPerformer = stocks.length
    ? [...stocks].sort((a, b) => b.score.overall - a.score.overall)[0]
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-800" id="main-container">
      {/* Upper Utility Navbar */}
      <div className="bg-slate-900 text-slate-400 py-2 px-4 md:px-8 flex flex-col sm:flex-row justify-between items-center text-xs border-b border-slate-800" id="top-utility-bar">
        <div className="flex items-center gap-2 mb-1 sm:mb-0" id="brand-indicator">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" id="pulse-dot"></span>
          <span className="font-semibold tracking-wider text-slate-200" id="brand-label">IESE EVIDENCE ENGINE — LIVE</span>
        </div>
        <div className="flex items-center gap-4 font-mono" id="time-indicator">
          <span className="flex items-center gap-1" id="clock-wrapper">
            <Clock className="w-3.5 h-3.5 text-slate-500" id="clock-icon" />
            {currentTime || "Loading UTC time..."}
          </span>
        </div>
      </div>

      {/* Main Header / Banner Hero */}
      <header className="bg-white border-b border-slate-200 py-8 px-4 md:px-8" id="header-container">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6" id="header-content">
          <div id="title-section">
            <div className="flex items-center gap-2.5 mb-1" id="logo-badge-container">
              <span className="bg-blue-600 text-white font-mono font-black px-2 py-0.5 rounded text-sm" id="logo-badge">SW</span>
              <span className="text-xs uppercase tracking-widest font-mono text-slate-500 font-bold" id="version-label">StxWatch-MCMG · IESE v1.0</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900" id="app-title">
              Micro-Cap Trend &amp; Valuation Engine
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xl" id="app-description">
              Evidence-based scoring across five fixed categories — Demand, Execution, Competition,
              Financial, and External — with every score traceable back to a dated, sourced observation.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200" id="quick-stats-block">
            <div className="text-center md:text-left" id="stat-count">
              <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider" id="stat-count-lbl">Tracked</span>
              <span className="text-xl font-extrabold text-slate-800" id="stat-count-val">{stocks.length} Tickers</span>
            </div>
            <div className="text-center md:text-left border-x border-slate-200 px-3 md:px-6" id="stat-avg">
              <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider" id="stat-avg-lbl">Avg Score</span>
              <span className="text-xl font-extrabold text-blue-600" id="stat-avg-val">{averageScore}/100</span>
            </div>
            <div className="text-center md:text-left" id="stat-top">
              <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider" id="stat-top-lbl">Top Index</span>
              <span className="text-xl font-extrabold text-emerald-600" id="stat-top-val">
                {topPerformer ? topPerformer.company.ticker : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8" id="main-workspace">
        {/* Search and Analyze Interface */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8" id="search-section">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2" id="search-section-title">
            <Compass className="w-5 h-5 text-blue-600" id="compass-icon" /> Run an IESE Analysis on a New Company
          </h2>

          <div className="flex flex-col md:flex-row gap-3" id="search-form-container">
            <div className="relative flex-grow" id="input-relative-container">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none" id="search-icon-wrapper">
                <Search className="h-5 w-5 text-slate-400" id="search-icon" />
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                placeholder="Enter a ticker (e.g. ASTS, RENE, BMEA, LUNA, QUBT)..."
                className="block w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-slate-900 placeholder-slate-400 font-medium outline-none transition-all focus:ring-4 focus:ring-blue-100"
                id="ticker-search-input"
                disabled={isAnalyzing}
              />
            </div>
            <button
              onClick={() => handleAnalyze()}
              disabled={isAnalyzing || !searchInput.trim()}
              className="px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center justify-center gap-2 min-w-[140px] focus:ring-4 focus:ring-slate-200 active:scale-95"
              id="analyze-submit-button"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" id="spin-icon" /> Analyzing...
                </>
              ) : (
                <>
                  Analyze Ticker <ArrowRight className="w-4 h-4" id="arrow-icon" />
                </>
              )}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2" id="hot-tags-container">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider" id="tags-lbl">Tracked Presets:</span>
            {QUICK_PRESETS.map((sym) => (
              <button
                key={sym}
                onClick={() => {
                  setSearchInput(sym);
                  handleAnalyze(sym);
                }}
                disabled={isAnalyzing}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded text-xs font-mono font-semibold text-slate-600 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
                id={`preset-tag-${sym}`}
              >
                +{sym}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {analysisError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-sm flex items-start gap-3"
                id="error-banner"
              >
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" id="alert-icon" />
                <div>
                  <span className="font-bold block" id="err-title">Analysis Interrupted</span>
                  <p id="err-desc">{analysisError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {demoMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800 flex items-start gap-3" id="demo-mode-alert">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Demo Sandbox Mode</p>
              <p>
                No <strong>ANTHROPIC_API_KEY</strong> is configured, so new analyses are generated by
                the offline simulation engine rather than by the model. Set a real key in your
                environment to enable evidence-based analysis.
              </p>
            </div>
          </div>
        )}

        {/* Stock Grid Layout */}
        <section id="companies-grid-section">
          <div className="flex justify-between items-center mb-6" id="grid-header">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2" id="grid-title">
              <Activity className="w-5 h-5 text-emerald-600" id="activity-icon" /> Tracked Companies
            </h3>
            <button
              onClick={fetchStocks}
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 transition-all cursor-pointer"
              id="refresh-grid-button"
            >
              <RefreshCw className="w-3 h-3" id="refresh-icon" /> Reload Grid
            </button>
          </div>

          {isLoading ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center" id="grid-loader">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" id="spin-grid" />
              <p className="text-sm text-slate-500 font-medium" id="load-grid-text">Consulting local persistence store...</p>
            </div>
          ) : stocks.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200" id="grid-empty">
              <p className="text-sm text-slate-500" id="empty-grid-text">No companies currently tracked. Search a ticker above to initiate analysis!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="stock-grid">
              {stocks.map((stock) => {
                const freshness = getFreshness(stock.score.last_updated);
                return (
                  <motion.div
                    layoutId={`stock-card-${stock.company.ticker}`}
                    key={stock.company.ticker}
                    onClick={() => {
                      setSelectedStock(stock);
                      setEvidenceExpanded(false);
                    }}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-300 p-6 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
                    id={`card-${stock.company.ticker}`}
                  >
                    <div id={`card-header-${stock.company.ticker}`}>
                      <div className="flex justify-between items-start gap-2 mb-3" id={`badge-row-${stock.company.ticker}`}>
                        <div className="flex items-center gap-2" id={`sym-box-${stock.company.ticker}`}>
                          <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-sm rounded-lg" id={`ticker-badge-${stock.company.ticker}`}>
                            {stock.company.ticker}
                          </span>
                          <span className={`px-2 py-0.5 border text-[11px] font-bold rounded-full ${TREND_COLORS[stock.score.trend]}`} id={`trend-badge-${stock.company.ticker}`}>
                            {stock.score.trend}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 border text-xs font-bold rounded-full ${VERIFICATION_COLORS[stock.score.verification]}`}
                          id={`verification-badge-${stock.company.ticker}`}
                          title="Verification rating"
                        >
                          {stock.score.verification}
                        </span>
                      </div>

                      <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1" id={`name-${stock.company.ticker}`}>
                        {stock.company.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium" id={`industry-${stock.company.ticker}`}>{stock.company.industry}</p>

                      <div className="flex items-baseline gap-2 mt-1.5 mb-3" id={`price-row-${stock.company.ticker}`}>
                        <span className="text-2xl font-black text-slate-900" id={`price-text-${stock.company.ticker}`}>
                          ${stock.company.price.toFixed(2)}
                        </span>
                        <span
                          className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                            stock.company.price_change_24h >= 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                          }`}
                          id={`change-text-${stock.company.ticker}`}
                        >
                          {stock.company.price_change_24h >= 0 ? "+" : ""}
                          {stock.company.price_change_24h.toFixed(2)}%
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4" id={`summary-${stock.company.ticker}`}>
                        {stock.summary.overall_assessment}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between" id={`card-footer-${stock.company.ticker}`}>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold" id={`score-lbl-${stock.company.ticker}`}>IESE Score</span>
                        <span className="text-2xl font-black text-slate-900" id={`score-val-${stock.company.ticker}`}>
                          {stock.score.overall}<span className="text-xs text-slate-400 font-normal">/100</span>
                        </span>
                        <div className="mt-0.5" id={`stars-${stock.company.ticker}`}>
                          <EvidenceStars count={stock.score.evidence_strength} />
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5" id={`sparkline-${stock.company.ticker}`}>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold" id={`freshness-${stock.company.ticker}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${FRESHNESS_COLORS[freshness]}`}></span>
                          {new Date(stock.score.last_updated).toLocaleDateString()}
                        </span>
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden" id={`progress-bg-${stock.company.ticker}`}>
                          <div
                            className={`h-full rounded-full ${
                              stock.score.overall >= 85 ? "bg-emerald-500" : stock.score.overall >= 70 ? "bg-blue-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${stock.score.overall}%` }}
                            id={`progress-fill-${stock.company.ticker}`}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Full Analysis Modal */}
      <AnimatePresence>
        {selectedStock && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6" id="modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              layoutId={`stock-card-${selectedStock.company.ticker}`}
              className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              id="analysis-modal"
            >
              {/* Modal Sticky Header */}
              <div className="bg-slate-950 text-white p-6 border-b border-slate-800 flex justify-between items-start" id="modal-header">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2" id="modal-tag-row">
                    <span className="px-2.5 py-0.5 bg-blue-600 text-white font-mono font-bold text-xs rounded" id="modal-ticker-badge">
                      {selectedStock.company.ticker}
                    </span>
                    <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full ${TREND_COLORS[selectedStock.score.trend]}`} id="modal-trend-badge">
                      {selectedStock.score.trend}
                    </span>
                    <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full ${VERIFICATION_COLORS[selectedStock.score.verification]}`} id="modal-verification-badge">
                      {selectedStock.score.verification} Verification
                    </span>
                  </div>
                  <h3 className="text-2xl font-black tracking-tight" id="modal-company-name">
                    {selectedStock.company.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-slate-400 text-sm" id="modal-price-meta">
                    <span className="font-mono text-white text-base font-bold" id="modal-price-val">
                      ${selectedStock.company.price.toFixed(2)}
                    </span>
                    <span
                      className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                        selectedStock.company.price_change_24h >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                      id="modal-change-val"
                    >
                      {selectedStock.company.price_change_24h >= 0 ? "+" : ""}
                      {selectedStock.company.price_change_24h.toFixed(2)}%
                    </span>
                    <span className="text-slate-500" id="modal-sep-1">|</span>
                    <span className="text-xs" id="modal-industry">{selectedStock.company.industry} · {selectedStock.company.market_cap}</span>
                    <span className="text-slate-500" id="modal-sep-2">|</span>
                    <span className="flex items-center gap-1.5 text-xs" id="modal-updated-at">
                      <span className={`w-1.5 h-1.5 rounded-full ${FRESHNESS_COLORS[getFreshness(selectedStock.score.last_updated)]}`}></span>
                      Last Updated: {new Date(selectedStock.score.last_updated).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStock(null)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  id="modal-close-button"
                >
                  <X className="w-5 h-5" id="close-icon" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-grow bg-slate-50" id="modal-scrollable-content">
                {/* Business Health Meter + Confidence + Executive Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="modal-top-dashboard-row">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center justify-center text-center" id="radial-score-card">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3" id="rating-lbl">Business Health Meter</span>
                    {(() => {
                      const health = getHealthState(selectedStock.score.overall);
                      const colors = HEALTH_COLORS[health];
                      return (
                        <>
                          <div className="relative flex items-center justify-center mb-2" id="svg-meter-container">
                            <svg className="w-24 h-24 transform -rotate-90" id="score-meter-svg">
                              <circle cx="48" cy="48" r="40" className="stroke-slate-100" strokeWidth="8" fill="transparent" id="bg-circle" />
                              <circle
                                cx="48"
                                cy="48"
                                r="40"
                                className={colors.stroke}
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * selectedStock.score.overall) / 100}
                                strokeLinecap="round"
                                id="fill-circle"
                              />
                            </svg>
                            <div className="absolute text-center" id="score-text-overlay">
                              <span className="text-3xl font-black text-slate-900" id="modal-score-num">{selectedStock.score.overall}</span>
                              <span className="block text-[10px] text-slate-400 font-bold" id="max-scale">/100</span>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`} id="health-label">
                            {getScoreLabel(selectedStock.score.overall)}
                          </span>
                        </>
                      );
                    })()}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5" id="confidence-card">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block mb-3" id="confidence-lbl">Confidence &amp; Verification</span>
                    <div className="space-y-3" id="confidence-body">
                      <div id="confidence-row">
                        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                          <span>Confidence</span>
                          <span>{selectedStock.score.confidence}/100</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${selectedStock.score.confidence}%` }}></div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{getConfidenceLabel(selectedStock.score.confidence)}</p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100" id="verification-row">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Verification</span>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${VERIFICATION_COLORS[selectedStock.score.verification]}`}>
                          {selectedStock.score.verification}
                        </span>
                      </div>
                      <div className="flex items-center justify-between" id="evidence-strength-row">
                        <span className="text-xs font-semibold text-slate-600">Evidence Strength</span>
                        <EvidenceStars count={selectedStock.score.evidence_strength} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 md:col-span-1" id="summary-card">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block mb-1.5" id="summary-lbl">Executive Summary</span>
                    <p className="text-sm text-slate-700 leading-relaxed font-normal" id="summary-text">
                      {selectedStock.summary.overall_assessment}
                    </p>
                  </div>
                </div>

                {/* Category Scores */}
                <div className="bg-white rounded-xl border border-slate-200 p-5" id="category-scores-section">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2" id="category-scores-title">
                    Category Scores
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="category-grid">
                    {CATEGORY_KEYS.map((key) => {
                      const cat = selectedStock.categories[key];
                      return (
                        <div key={key} className="space-y-2" id={`category-box-${key}`}>
                          <div className="flex justify-between items-baseline" id={`category-lbl-row-${key}`}>
                            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              {CATEGORY_LABELS[key]}
                              <span className={`px-1.5 py-0 border text-[10px] font-bold rounded-full ${TREND_COLORS[cat.trend]}`}>{cat.trend}</span>
                            </span>
                            <span className="text-sm font-bold text-blue-600">{cat.score}/100</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                cat.score >= 80 ? "bg-emerald-500" : cat.score >= 60 ? "bg-blue-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${cat.score}%` }}
                            ></div>
                          </div>
                          <ul className="space-y-1 pt-1">
                            {cat.metrics.map((m, idx) => (
                              <li key={idx} className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0"></span>
                                <span>
                                  <span className="font-semibold text-slate-700">{m.name}:</span> {m.value} — {m.notes}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Key Drivers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="key-drivers-row">
                  <div className="bg-white rounded-xl border border-emerald-100 p-5" id="positive-drivers-container">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 mb-3 border-b border-emerald-50 pb-2" id="positive-title">
                      <CheckCircle className="w-4 h-4 text-emerald-600" id="positive-icon" /> Top Positive Factors
                    </h5>
                    <ul className="space-y-3" id="positive-list">
                      {selectedStock.evidence
                        .filter((e) => e.impact > 0)
                        .sort((a, b) => b.impact - a.impact)
                        .map((e, idx) => (
                          <li key={idx} className="text-xs text-slate-600 flex items-start gap-2.5 leading-relaxed" id={`positive-item-${idx}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                            <p>{e.description}</p>
                          </li>
                        ))}
                      {selectedStock.evidence.filter((e) => e.impact > 0).length === 0 && (
                        <li className="text-xs text-slate-400 italic">No positive-impact evidence recorded yet.</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-white rounded-xl border border-rose-100 p-5" id="negative-drivers-container">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5 mb-3 border-b border-rose-50 pb-2" id="negative-title">
                      <AlertCircle className="w-4 h-4 text-rose-600" id="negative-icon" /> Top Negative Factors
                    </h5>
                    <ul className="space-y-3" id="negative-list">
                      {selectedStock.evidence
                        .filter((e) => e.impact <= 0)
                        .sort((a, b) => a.impact - b.impact)
                        .map((e, idx) => (
                          <li key={idx} className="text-xs text-slate-600 flex items-start gap-2.5 leading-relaxed" id={`negative-item-${idx}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></span>
                            <p>{e.description}</p>
                          </li>
                        ))}
                      {selectedStock.evidence.filter((e) => e.impact <= 0).length === 0 && (
                        <li className="text-xs text-slate-400 italic">No negative-impact evidence recorded yet.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Risks / Watch Items / Catalysts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="risks-watch-catalysts-row">
                  <div className="bg-white rounded-xl border border-slate-200 p-5" id="risks-card">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 border-b border-slate-100 pb-2">Key Risks</h5>
                    <ul className="space-y-2">
                      {selectedStock.summary.key_risks.map((r, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0"></span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5" id="watch-card">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 border-b border-slate-100 pb-2">Watch Items</h5>
                    <ul className="space-y-2">
                      {selectedStock.summary.watch_items.map((r, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0"></span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-5" id="catalysts-card">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 border-b border-slate-100 pb-2">Next Catalysts</h5>
                    <ul className="space-y-2">
                      {selectedStock.summary.next_catalysts.map((r, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0"></span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Evidence Trail (expandable) */}
                <div className="bg-white rounded-xl border border-slate-200 p-5" id="evidence-trail-section">
                  <button
                    className="w-full flex items-center justify-between text-sm font-bold text-slate-900 uppercase tracking-wider cursor-pointer"
                    onClick={() => setEvidenceExpanded((v) => !v)}
                    id="evidence-trail-toggle"
                  >
                    <span>Evidence Trail ({selectedStock.evidence.length})</span>
                    {evidenceExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <AnimatePresence>
                    {evidenceExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pt-4 space-y-3 overflow-hidden"
                        id="evidence-trail-body"
                      >
                        {selectedStock.evidence.map((e, idx) => (
                          <div key={idx} className="border border-slate-100 rounded-lg p-3" id={`evidence-item-${idx}`}>
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="text-xs font-bold text-slate-800">{e.title}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${e.verified ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"}`}>
                                {e.verified ? "Verified" : "Unverified"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{e.description}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 font-medium">
                              <span>Source: <span className="text-slate-600 font-semibold">{e.source}</span></span>
                              <span>Date: {e.date}</span>
                              <span>Reliability: {e.reliability}/100</span>
                              <span>Confidence: {e.confidence}/100</span>
                              <span>Independent sources: {e.independent_sources}</span>
                              {e.url && (
                                <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  View source →
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 flex flex-wrap gap-1.5" id="research-sources-chips">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Sources referenced:</span>
                          {[...new Set(selectedStock.evidence.map((e) => e.source))].map((s, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 font-medium">{s}</span>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-white border-t border-slate-100 p-4 flex justify-between items-center text-xs text-slate-400 font-semibold" id="modal-footer">
                <span className="flex items-center gap-1" id="footer-grounding-notice">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" id="grounding-success-icon" />
                  {demoMode ? "Simulated Analysis Mode" : "Training-Knowledge Analysis (no live search)"}
                </span>
                <button
                  onClick={() => setSelectedStock(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-all cursor-pointer"
                  id="modal-close-footer-button"
                >
                  Dismiss Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
