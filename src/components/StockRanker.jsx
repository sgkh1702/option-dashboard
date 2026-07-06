import { useState, useEffect, useCallback } from "react";

/**
 * StockRanker.jsx
 * ---------------------------------------------------------------
 * Reads bull/bear shortlist from the DailyShortlist Google Sheet tab
 * (via /stock-ranks Flask endpoint), ranks stocks two ways:
 *   - Momentum:    RSI + EMA alignment + ADX trend strength
 *   - Retracement: proximity to 20 EMA + RSI cool-off (pullback entries)
 *
 * Indicator scoring (RSI/EMA/ADX) is computed on previous day's completed
 * EOD candle only — ignores current day's intraday movement. CMP is a
 * separate live quote shown for reference alongside the score, and never
 * affects the score itself.
 *
 * Wiring into Dashboard.jsx:
 *   import StockRanker from "../components/StockRanker";
 *   const TABS = [..., "Stock Ranker"];
 *   {activeTab === "Stock Ranker" && <StockRanker />}
 */

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

export default function StockRanker() {
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [tab, setTab]                 = useState("mom"); // 'mom' | 'ret'
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchRanks = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${PROXY}/stock-ranks`)
      .then(r => r.json())
      .then(json => {
        if (json.error) {
          setError(json.error);
          setData([]);
        } else {
          setData(json.data || []);
          setLastUpdated(json.time ? new Date(json.time) : new Date());
        }
      })
      .catch(e => {
        setError(e.message || "Failed to fetch");
        setData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-fetch on tab mount
  useEffect(() => { fetchRanks(); }, [fetchRanks]);

  const bulls = data.filter(d => d.bias === "bull");
  const bears = data.filter(d => d.bias === "bear");

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-base font-medium text-gray-800">Stock Ranker</h2>
          <span className="text-xs text-gray-400">
            F&amp;O buildup shortlist · Scores from EOD data · CMP live
            {lastUpdated && (
              <> · {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</>
            )}
          </span>
        </div>
        <button
          onClick={fetchRanks}
          disabled={loading}
          className="px-4 py-1.5 text-sm font-medium rounded-md bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh ↻"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ Couldn't load ranks: {error}. Check the DailyShortlist sheet tab has symbols, then refresh.
        </div>
      )}

      {!error && !loading && data.length === 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
          No stocks scored yet. Add symbols to the DailyShortlist sheet tab (Column A = Bullish, Column B = Bearish) and refresh.
        </div>
      )}

      {data.length > 0 && (
        <>
          <div className="flex gap-1 border-b border-gray-200 mb-3">
            <button
              onClick={() => setTab("mom")}
              className={`px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === "mom" ? "border-blue-500 text-blue-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Momentum rank
            </button>
            <button
              onClick={() => setTab("ret")}
              className={`px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === "ret" ? "border-blue-500 text-blue-600 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Retracement rank
            </button>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 border-l-2 border-gray-300 rounded px-3 py-2 mb-4">
            {tab === "mom" ? (
              <><b>Momentum:</b> Strongest trend stocks — high RSI, aligned EMAs, strong ADX. Trade in direction of trend on open.</>
            ) : (
              <><b>Retracement:</b> Stocks pulled back near 20 EMA after buildup — better risk/reward. Wait for bounce/rejection candle.</>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <RankSection title="📈 Bullish" rows={bulls} bias="bull" tab={tab} borderColor="border-l-green-600" />
            <RankSection title="📉 Bearish" rows={bears} bias="bear" tab={tab} borderColor="border-l-red-600" />
          </div>
        </>
      )}
    </div>
  );
}

function RankSection({ title, rows, bias, tab, borderColor }) {
  const scoreKey = tab === "mom" ? "mom_score" : "ret_score";
  const sorted = [...rows].sort((a, b) => b[scoreKey] - a[scoreKey]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className={`px-4 py-2.5 border-b border-gray-100 border-l-4 ${borderColor}`}>
        <span className="text-sm font-semibold text-gray-800">
          {title} <span className="font-normal text-gray-400 text-xs">({rows.length} stocks)</span>
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="p-5 text-xs text-gray-400 text-center">No stocks</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left w-7 border-b border-gray-100">#</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left border-b border-gray-100">Symbol</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right border-b border-gray-100">CMP</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right border-b border-gray-100">Prev Close</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right border-b border-gray-100">ATR</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left border-b border-gray-100">RSI(14)</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left border-b border-gray-100">EMA Trend</th>
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left border-b border-gray-100">
                  {tab === "mom" ? "ADX(14)" : "Proximity"}
                </th>
                <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right w-20 border-b border-gray-100">Score</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <Row key={d.symbol} rank={i} d={d} bias={bias} tab={tab} scoreKey={scoreKey} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ rank, d, bias, tab, scoreKey }) {
  const [rsiTxt, rsiColor]     = rsiPill(d.rsi, bias);
  const [emaTxt, emaColor]     = emaPill(d, bias);
  const [thirdTxt, thirdColor] = tab === "mom" ? adxPill(d.adx) : proxPill(d.dist_ema20, bias);

  const fmtPrice = (v) => (v == null ? "—" : v >= 1000 ? `₹${Math.round(v).toLocaleString("en-IN")}` : `₹${v.toFixed(1)}`);
  const cmpStr      = fmtPrice(d.cmp);
  const prevStr     = fmtPrice(d.prev_close);
  const atrStr      = d.atr == null ? "—" : d.atr.toFixed(1);
  const cmpVsPrev    = d.cmp != null && d.prev_close ? ((d.cmp - d.prev_close) / d.prev_close) * 100 : null;
  const cmpChgColor  = cmpVsPrev == null ? "text-gray-400" : cmpVsPrev >= 0 ? "text-green-700" : "text-red-700";

  const badgeCls = rank === 0 ? "bg-yellow-200 text-yellow-900"
    : rank === 1 ? "bg-gray-200 text-gray-700"
    : rank === 2 ? "bg-orange-200 text-orange-900"
    : "bg-gray-100 text-gray-500";

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-2 py-2">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${badgeCls}`}>
          {rank + 1}
        </span>
      </td>
      <td className="px-2 py-2">
        <a
          href={`https://www.tradingview.com/chart/?symbol=NSE%3A${d.symbol}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sm text-blue-600 hover:underline"
        >
          {d.symbol}
        </a>
      </td>
      <td className="px-2 py-2 text-right">
        <div className="font-mono text-xs font-semibold text-gray-800">{cmpStr}</div>
        {cmpVsPrev != null && (
          <div className={`text-[10px] font-semibold ${cmpChgColor}`}>
            {cmpVsPrev >= 0 ? "+" : ""}{cmpVsPrev.toFixed(2)}%
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        <div className="font-mono text-xs text-gray-500">{prevStr}</div>
      </td>
      <td className="px-2 py-2 text-right">
        <div className="font-mono text-xs text-gray-500">{atrStr}</div>
      </td>
      <td className="px-2 py-2"><Pill text={rsiTxt} color={rsiColor} /></td>
      <td className="px-2 py-2"><Pill text={emaTxt} color={emaColor} /></td>
      <td className="px-2 py-2"><Pill text={thirdTxt} color={thirdColor} /></td>
      <td className="px-2 py-2 text-right"><ScoreBar score={d[scoreKey]} bias={bias} /></td>
    </tr>
  );
}

function Pill({ text, color }) {
  const colorCls = {
    green:  "bg-green-100 text-green-700",
    red:    "bg-red-100 text-red-700",
    yellow: "bg-yellow-100 text-yellow-800",
    grey:   "bg-gray-100 text-gray-500",
  }[color];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${colorCls}`}>{text}</span>;
}

function ScoreBar({ score, bias }) {
  const w = Math.round(Math.min(100, score) * 0.6);
  const barColor = bias === "bull" ? "bg-green-600" : "bg-red-600";
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <div className={`h-1.5 rounded ${barColor}`} style={{ width: `${w}px`, minWidth: "2px" }} />
      <span className="font-mono text-xs font-bold w-6 text-right">{Math.round(score)}</span>
    </div>
  );
}

// ── Scoring → pill label helpers ──────────────────────────────────────────

function rsiPill(rsi, bias) {
  if (bias === "bull") {
    if (rsi >= 70) return [`${Math.round(rsi)} · Strong`, "green"];
    if (rsi >= 60) return [`${Math.round(rsi)} · Good`, "green"];
    if (rsi >= 50) return [`${Math.round(rsi)} · Neutral`, "grey"];
    return [`${Math.round(rsi)} · Weak`, "red"];
  }
  if (rsi <= 30) return [`${Math.round(rsi)} · Strong`, "red"];
  if (rsi <= 40) return [`${Math.round(rsi)} · Good`, "red"];
  if (rsi <= 50) return [`${Math.round(rsi)} · Neutral`, "grey"];
  return [`${Math.round(rsi)} · Weak`, "green"];
}

function emaPill(d, bias) {
  const { ltp, ema20, ema50 } = d;
  if (bias === "bull") {
    if (ltp > ema20 && ema20 > ema50) return ["Aligned ↑", "green"];
    if (ltp > ema20) return ["Above 20", "yellow"];
    if (ltp > ema50) return ["Caution", "yellow"];
    return ["Below both", "red"];
  }
  if (ltp < ema20 && ema20 < ema50) return ["Aligned ↓", "red"];
  if (ltp < ema20) return ["Below 20", "yellow"];
  if (ltp < ema50) return ["Caution", "yellow"];
  return ["Above both", "green"];
}

function adxPill(adx) {
  if (adx >= 30) return [`ADX ${Math.round(adx)} · Strong`, "green"];
  if (adx >= 25) return [`ADX ${Math.round(adx)} · Mod`, "yellow"];
  return [`ADX ${Math.round(adx)} · Weak`, "grey"];
}

function proxPill(dist, bias) {
  if (bias === "bull") {
    if (dist >= 0 && dist <= 2) return ["At 20 EMA", "green"];
    if (dist <= 4) return ["Near 20 EMA", "green"];
    if (dist <= 7) return ["OK", "yellow"];
    if (dist > 7) return ["Extended", "red"];
    return ["Below 20 EMA", "red"];
  }
  if (dist <= 0 && dist >= -2) return ["At 20 EMA", "green"];
  if (dist >= -4) return ["Near 20 EMA", "green"];
  if (dist >= -7) return ["OK", "yellow"];
  if (dist < -7) return ["Extended", "red"];
  return ["Above 20 EMA", "red"];
}