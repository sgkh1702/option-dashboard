import { useState, useEffect, useRef, useCallback } from "react";

//const PROXY      = "http://localhost:5000";
const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";
const REFRESH_MS = 5 * 60 * 1000;
const TOP_N      = 10;

// ── Scoring ────────────────────────────────────────────────────────────────────
function scoreSignal(q, niftyRet) {
  if (!q?.ltp || !q?.prev_close) return null;
  const { ltp, prev_close, high, low, vwap, volume, avg_volume, pct_change, day_open } = q;

  const volRatio = avg_volume > 0 ? volume / avg_volume : 0;
  const dayRange = high - low;
  const rangePct = dayRange > 0 ? ((ltp - low) / dayRange) * 100 : 50;
  const rs       = pct_change - niftyRet;
  const gapPct   = day_open > 0 ? ((ltp - day_open) / day_open) * 100 : 0;

  // Momentum score — max 10
  let mom = 0;
  if (Math.abs(pct_change) > 2)       mom += 2;
  else if (Math.abs(pct_change) > 1)  mom += 1;
  if (volRatio > 3)                   mom += 2;
  else if (volRatio > 2)              mom += 1;
  if (pct_change > 0 && gapPct > 0.5)        mom += 2;
  else if (pct_change < 0 && gapPct < -0.5)  mom += 2;
  else if (Math.abs(gapPct) > 0.2)           mom += 1;
  if (pct_change > 0 && ltp > vwap)          mom += 2;
  else if (pct_change < 0 && ltp < vwap)     mom += 2;
  else if (Math.abs(ltp - vwap) / vwap < 0.002) mom += 1;
  if (Math.abs(rs) > 1.5)             mom += 2;
  else if (Math.abs(rs) > 0.5)        mom += 1;

  // Reversal score — max 10
  let rev = 0;
  if (Math.abs(pct_change) > 4)       rev += 2;
  else if (Math.abs(pct_change) > 2.5) rev += 1;
  if (volRatio > 4)                   rev += 2;
  else if (volRatio > 2.5)            rev += 1;
  const gapFade = Math.abs(gapPct) > 1 && Math.sign(gapPct) !== Math.sign(pct_change - gapPct);
  if (gapFade)                        rev += 2;
  else if (Math.abs(gapPct) > 0.5)   rev += 1;
  if (rangePct > 90 && pct_change > 0)       rev += 2;
  else if (rangePct < 10 && pct_change < 0)  rev += 2;
  else if (rangePct > 80 || rangePct < 20)   rev += 1;
  if (Math.abs(rs) > 3)              rev += 2;
  else if (Math.abs(rs) > 2)         rev += 1;

  const isBull = pct_change > 0 && ltp > vwap && rs > 0;
  const isBear = pct_change < 0 && ltp < vwap && rs < 0;

  return {
    momentum: Math.min(mom, 10),
    reversal:  Math.min(rev, 10),
    rs:        Math.round(rs * 100) / 100,
    volRatio:  Math.round(volRatio * 10) / 10,
    rangePct,
    pct_change, ltp, vwap,
    isBull, isBear,
    bias: pct_change >= 0 ? "BULL" : "BEAR",
  };
}

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtVol(n) {
  if (!n) return "—";
  if (n >= 1e7) return (n / 1e7).toFixed(1) + "Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(1) + "L";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return n;
}

// ── Score bar ──────────────────────────────────────────────────────────────────
function ScoreBar({ score, color }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden min-w-[48px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(score / 10) * 100}%` }} />
      </div>
      <span className="text-xs font-bold w-4 text-right text-gray-600">{score}</span>
    </div>
  );
}

// ── ATR bar ────────────────────────────────────────────────────────────────────
function AtrBar({ consumed }) {
  if (consumed == null) return <span className="text-gray-300 text-xs">—</span>;
  const pct   = Math.min(consumed, 100);
  const color = pct >= 80 ? "#ef4444" : pct >= 60 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden min-w-[40px]">
        <div className="h-full rounded-full transition-all" style={{ width: pct + "%", backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold w-8 text-right" style={{ color }}>{consumed.toFixed(0)}%</span>
    </div>
  );
}

// ── Stock row ──────────────────────────────────────────────────────────────────
function StockRow({ rank, symbol, q, s }) {
  const up   = q.pct_change >= 0;
  const abvW = q.ltp >= q.vwap;
  const volR = q.avg_volume > 0 ? q.volume / q.avg_volume : 0;

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors text-xs">
      <td className="py-2 px-2 text-gray-400">{rank}</td>
      <td className="py-2 px-2">
        <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${symbol}`}
           target="_blank" rel="noopener noreferrer"
           className="font-semibold text-sm text-blue-600 hover:underline">{symbol}</a>
      </td>
      <td className="py-2 px-2 text-right">
        <div className="font-medium text-gray-800">₹{fmt(q.ltp)}</div>
        <div className={`font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
          {up ? "▲" : "▼"} {Math.abs(q.pct_change).toFixed(2)}%
        </div>
      </td>
      <td className="py-2 px-2 text-right">
        <div className="text-gray-500">₹{fmt(q.prev_close)}</div>
        <div className="text-gray-400">O {fmt(q.day_open)}</div>
      </td>
      <td className="py-2 px-2 text-right">
        <div className="text-gray-600">₹{fmt(q.vwap)}</div>
        <div className={abvW ? "text-emerald-500" : "text-red-400"}>{abvW ? "↑ above" : "↓ below"}</div>
      </td>
      <td className="py-2 px-2 text-right hidden md:table-cell">
        <div className="text-emerald-600">H {fmt(q.high)}</div>
        <div className="text-red-400">L {fmt(q.low)}</div>
      </td>
      <td className="py-2 px-2 text-right hidden md:table-cell">
        <div className={volR > 2 ? "text-amber-600 font-semibold" : "text-gray-500"}>{fmtVol(q.volume)}</div>
        <div className="text-gray-400">{volR > 0 ? volR.toFixed(1) + "x" : "—"}</div>
      </td>
      <td className="py-2 px-2 text-right">
        <span className={`font-semibold ${s.rs > 0 ? "text-emerald-600" : "text-red-500"}`}>
          {s.rs >= 0 ? "+" : ""}{s.rs}
        </span>
      </td>
      <td className="py-2 px-2 min-w-[90px]">
        <div className="text-gray-400 text-[10px] mb-0.5">₹{q.atr ? fmt(q.atr) : "—"}</div>
        <AtrBar consumed={q.atr_consumed} />
      </td>
      <td className="py-2 px-3 min-w-[80px]"><ScoreBar score={s.momentum} color="bg-blue-500" /></td>
      <td className="py-2 px-3 min-w-[80px]"><ScoreBar score={s.reversal}  color="bg-purple-400" /></td>
      <td className="py-2 px-2 text-center">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {up ? "BULL" : "BEAR"}
        </span>
      </td>
    </tr>
  );
}

// Cached/stale row (from Sheets, shown while loading)
function CachedRow({ rank, r }) {
  // Handle both Sheet-column keys (Symbol, LTP) and lowercase bg-cache keys (symbol, ltp)
  const symbol    = r.Symbol    ?? r.symbol    ?? "";
  const ltp       = parseFloat(r.LTP       ?? r.ltp       ?? 0);
  const chgPct    = parseFloat(r["Chg%"]   ?? r.pct_change ?? 0);
  const prevClose = parseFloat(r["Prev Close"] ?? r.prev_close ?? 0);
  const dayOpen   = parseFloat(r["Day Open"]   ?? r.day_open   ?? 0);
  const vwap      = parseFloat(r.VWAP      ?? r.vwap      ?? 0);
  const high      = parseFloat(r.High      ?? r.high      ?? 0);
  const low       = parseFloat(r.Low       ?? r.low       ?? 0);
  const volume    = parseInt  (r.Volume    ?? r.volume    ?? 0);
  const rs        = r["RS vs Nifty"] ?? r.rs ?? "—";
  const mom       = r["Mom Score"]   ?? r.momentum ?? "—";
  const rev       = r["Rev Score"]   ?? r.reversal  ?? "—";
  const bias      = r.Bias ?? r.bias ?? "—";
  const atr       = parseFloat(r.ATR ?? r.atr ?? 0);
  const atrUsed   = parseFloat(r["ATR Used"] ?? r.atr_consumed ?? 0);
  const volRatio  = parseFloat(r["Vol Ratio"] ?? r.vol_ratio ?? 0);
  const up        = chgPct >= 0;

  return (
    <tr className="border-b border-gray-50 text-xs opacity-60">
      <td className="py-2 px-2 text-gray-400">{rank}</td>
      <td className="py-2 px-2">
        <span className="font-semibold text-sm text-gray-500">{symbol}</span>
        <span className="ml-1 text-[10px] text-amber-500">cached</span>
      </td>
      <td className="py-2 px-2 text-right">
        <div className="font-medium text-gray-600">₹{fmt(ltp)}</div>
        <div className={`font-semibold ${up ? "text-emerald-500" : "text-red-400"}`}>
          {up ? "▲" : "▼"} {Math.abs(chgPct).toFixed(2)}%
        </div>
      </td>
      <td className="py-2 px-2 text-right">
        <div className="text-gray-500">₹{fmt(prevClose)}</div>
        <div className="text-gray-400">O {fmt(dayOpen)}</div>
      </td>
      <td className="py-2 px-2 text-right text-gray-500">₹{fmt(vwap)}</td>
      <td className="py-2 px-2 text-right hidden md:table-cell">
        <div className="text-emerald-500">H {fmt(high)}</div>
        <div className="text-red-400">L {fmt(low)}</div>
      </td>
      <td className="py-2 px-2 text-right hidden md:table-cell text-gray-400">
        <div>{fmtVol(volume)}</div>
        <div>{volRatio > 0 ? volRatio.toFixed(1) + "x" : "—"}</div>
      </td>
      <td className="py-2 px-2 text-right text-gray-400">{rs}</td>
      <td className="py-2 px-2 text-right">
        <div className="text-gray-400 text-[10px]">{atr > 0 ? "₹" + fmt(atr) : "—"}</div>
        <div className="text-gray-400 text-[10px]">{atrUsed > 0 ? atrUsed.toFixed(0) + "%" : "—"}</div>
      </td>
      <td className="py-2 px-3 text-gray-400">{mom}/10</td>
      <td className="py-2 px-3 text-gray-400">{rev}/10</td>
      <td className="py-2 px-2 text-center">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          bias === "BULL" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}>
          {bias}
        </span>
      </td>
    </tr>
  );
}

function TableHead() {
  return (
    <thead>
      <tr className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide text-right">
        <th className="py-2 px-2 text-left">#</th>
        <th className="py-2 px-2 text-left">Stock</th>
        <th className="py-2 px-2">LTP / Chg%</th>
        <th className="py-2 px-2">Prev / Open</th>
        <th className="py-2 px-2">VWAP</th>
        <th className="py-2 px-2 hidden md:table-cell">High / Low</th>
        <th className="py-2 px-2 hidden md:table-cell">Vol / Ratio</th>
        <th className="py-2 px-2">RS</th>
        <th className="py-2 px-2 text-left">ATR / Used</th>
        <th className="py-2 px-3 text-left">Mom /10</th>
        <th className="py-2 px-3 text-left">Rev /10</th>
        <th className="py-2 px-2">Bias</th>
      </tr>
    </thead>
  );
}


// ── ORB Status badge ──────────────────────────────────────────────────────────
function OrbBadge({ status }) {
  const cfg = {
    Triggered: "bg-emerald-100 text-emerald-700 border-emerald-300",
    Watching:  "bg-blue-100 text-blue-700 border-blue-300",
    Missed:    "bg-amber-100 text-amber-700 border-amber-300",
    Failed:    "bg-red-100 text-red-600 border-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

// ── ORB Table ─────────────────────────────────────────────────────────────────
function OrbTable({ rows, side }) {
  const isBull = side === "bull";
  const fmt    = v => v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const fmtPct = v => v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%";

  if (!rows.length) return (
    <div className="text-center py-8 text-gray-400 text-sm">
      No {isBull ? "bullish" : "bearish"} ORB setups today.
      <div className="text-xs mt-1 text-gray-300">
        {isBull ? "Need: ORB High > Prev Day High" : "Need: ORB Low < Prev Day Low"}
      </div>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[900px]">
        <thead>
          <tr className="bg-gray-800 text-gray-200 text-[10px] uppercase tracking-wide">
            <th className="px-2 py-2 text-left">#</th>
            <th className="px-2 py-2 text-left">Stock</th>
            <th className="px-2 py-2 text-right">LTP</th>
            <th className="px-2 py-2 text-right">Gap%</th>
            <th className="px-2 py-2 text-right">Prev {isBull ? "High" : "Low"}</th>
            <th className="px-2 py-2 text-right">ORB High</th>
            <th className="px-2 py-2 text-right">ORB Low</th>
            <th className="px-2 py-2 text-center">Status</th>
            <th className="px-2 py-2 text-center">Candle</th>
            <th className="px-2 py-2 text-right">Stop</th>
            <th className="px-2 py-2 text-right">Target</th>
            <th className="px-2 py-2 text-right">R:R</th>
            <th className="px-2 py-2 text-right">ATR</th>
            <th className="px-2 py-2 text-right">ATR%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const status  = isBull ? r.bull_status  : r.bear_status;
            const target  = isBull ? r.bull_target  : r.bear_target;
            const stop    = isBull ? r.orb_low      : r.orb_high;
            const rr      = isBull ? r.bull_rr      : r.bear_rr;
            const trigger = isBull ? r.bull_trigger_candle : r.bear_trigger_candle;
            const refLvl  = isBull ? r.prev_high    : r.prev_low;
            const isTriggered = status === "Triggered";
            const rowBg   = isTriggered
              ? (isBull ? "bg-emerald-50" : "bg-red-50")
              : "hover:bg-gray-50";

            // ATR bar color
            const atrPct   = r.atr_consumed;
            const atrColor = atrPct == null ? "#9ca3af"
                           : atrPct >= 80  ? "#ef4444"
                           : atrPct >= 60  ? "#f59e0b"
                           : "#22c55e";

            return (
              <tr key={r.symbol} className={`border-t border-gray-100 transition-colors ${rowBg}`}>
                <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                <td className="px-2 py-2">
                  <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${r.symbol}`}
                     target="_blank" rel="noopener noreferrer"
                     className="font-semibold text-blue-600 hover:underline">{r.symbol}</a>
                </td>
                <td className="px-2 py-2 text-right font-medium text-gray-800">₹{fmt(r.ltp)}</td>
                <td className={`px-2 py-2 text-right font-semibold ${r.gap_pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {fmtPct(r.gap_pct)}
                </td>
                <td className="px-2 py-2 text-right text-gray-600 font-medium">₹{fmt(refLvl)}</td>
                <td className="px-2 py-2 text-right text-blue-700 font-semibold">₹{fmt(r.orb_high)}</td>
                <td className="px-2 py-2 text-right text-pink-700 font-semibold">₹{fmt(r.orb_low)}</td>
                <td className="px-2 py-2 text-center"><OrbBadge status={status} /></td>
                <td className="px-2 py-2 text-center text-gray-500">
                  {trigger ? `C${trigger}` : "—"}
                </td>
                <td className="px-2 py-2 text-right text-red-500 font-medium">₹{fmt(stop)}</td>
                <td className="px-2 py-2 text-right text-emerald-600 font-medium">₹{fmt(target)}</td>
                <td className={`px-2 py-2 text-right font-bold ${rr >= 2 ? "text-emerald-600" : rr >= 1 ? "text-amber-600" : "text-red-500"}`}>
                  {rr ? rr.toFixed(1) + "x" : "—"}
                </td>
                <td className="px-2 py-2 text-right text-gray-500">₹{fmt(r.atr)}</td>
                <td className="px-2 py-2 text-right">
                  {atrPct != null
                    ? <span className="font-bold text-xs" style={{ color: atrColor }}>{atrPct.toFixed(0)}%</span>
                    : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── ORB Tab Panel ─────────────────────────────────────────────────────────────
function OrbPanel({ orbData, orbStatus, onRefresh }) {
  const [orbTab, setOrbTab] = useState("bull");

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex items-center gap-0 border border-gray-200 rounded-lg overflow-hidden w-fit">
        <button onClick={() => setOrbTab("bull")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            orbTab === "bull" ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
          🟢 Bullish ORB
          <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: orbTab === "bull" ? "rgba(255,255,255,0.25)" : "#f3f4f6" }}>
            {orbData.bull.length}
          </span>
        </button>
        <button onClick={() => setOrbTab("bear")}
          className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 ${
            orbTab === "bear" ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
          🔴 Bearish ORB
          <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: orbTab === "bear" ? "rgba(255,255,255,0.25)" : "#f3f4f6" }}>
            {orbData.bear.length}
          </span>
        </button>
        <button onClick={onRefresh}
          className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 border-l border-gray-200 bg-white">
          {orbStatus === "loading" ? "⟳" : "↻"}
        </button>
      </div>

      {/* Criteria reminder */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
        {orbTab === "bull" ? <>
          <span>🟢 <b>Setup:</b> ORB High &gt; Prev Day High</span>
          <span>📍 <b>Entry:</b> Break above ORB High in candle 2/3/4</span>
          <span>🛑 <b>Stop:</b> ORB Low</span>
          <span>🎯 <b>Target:</b> ORB High + 1× ATR</span>
          <span>⚠ <b>Skip if</b> ATR used &gt; 60% at entry</span>
        </> : <>
          <span>🔴 <b>Setup:</b> ORB Low &lt; Prev Day Low</span>
          <span>📍 <b>Entry:</b> Break below ORB Low in candle 2/3/4</span>
          <span>🛑 <b>Stop:</b> ORB High</span>
          <span>🎯 <b>Target:</b> ORB Low − 1× ATR</span>
          <span>⚠ <b>Skip if</b> ATR used &gt; 60% at entry</span>
        </>}
      </div>

      {/* Status badges legend */}
      <div className="flex gap-3 text-[11px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">Triggered</span> Breakout confirmed</span>
        <span className="flex items-center gap-1"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-300">Watching</span> Setup valid, waiting</span>
        <span className="flex items-center gap-1"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300">Missed</span> Triggered but ATR &gt; 80%</span>
        <span className="flex items-center gap-1"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 border border-red-300">Failed</span> Broke the other side</span>
        <span className="ml-auto text-gray-400">C2/C3/C4 = which 15min candle triggered</span>
      </div>

      {orbStatus === "loading" && (
        <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Scanning ORB setups…</div>
      )}
      {orbStatus === "error" && (
        <div className="text-center py-8 text-red-400 text-sm">⚠ ORB fetch failed — is proxy running?</div>
      )}
      {orbStatus !== "loading" && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <OrbTable rows={orbTab === "bull" ? orbData.bull : orbData.bear} side={orbTab} />
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function IntradayScreener() {
  const [tab,       setTab]       = useState("bullish");
  const [status,    setStatus]    = useState("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [scored,    setScored]    = useState([]);
  const [cached,    setCached]    = useState([]);
  const [niftyInfo, setNiftyInfo] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [snapMsg,   setSnapMsg]   = useState("");
  const [atrFilter, setAtrFilter] = useState(80);   // hide stocks where ATR consumed > this %
  const [orbData,   setOrbData]   = useState({ bull: [], bear: [] });
  const [orbStatus, setOrbStatus] = useState("idle"); // idle | loading | ok | error
  const timerRef   = useRef(null);
  const cdRef      = useRef(null);
  const mountedRef = useRef(false);

  // ── Snapshot save ─────────────────────────────────────────────────────────────
  // No deps that change — saveSnapshot is truly stable
  const saveSnapshot = useCallback(async (rows) => {
    try {
      setSnapMsg("saving…");
      const r = await fetch(PROXY + "/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const d = await r.json();
      setSnapMsg(d.ok ? `✓ ${d.written} rows saved` : `⚠ ${d.error}`);
    } catch {
      setSnapMsg("⚠ snapshot failed");
    }
    setTimeout(() => setSnapMsg(""), 4000);
  }, []); // stable — no external deps

  // ── Load last snapshot from Sheets ───────────────────────────────────────────
  // FIX: removed `niftyInfo` from deps — it caused loadCached → runScreener
  // to get new references on every fetch cycle, tearing down the interval.
  const loadCached = useCallback(async () => {
    try {
      const d = await fetch(PROXY + "/last_snapshot").then(r => r.json());
      if (d.rows?.length) {
        setCached(d.rows);
        if (d.nifty_ret !== undefined) {
          // Use functional update so we never need niftyInfo in deps
          setNiftyInfo(prev => prev ?? { current: null, nifty_ret: d.nifty_ret, _fromCache: true });
        }
      }
    } catch (_) {}
  }, []); // stable — no external deps

  // ── Main fetch ────────────────────────────────────────────────────────────────
  const runScreener = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const [niftyRes, fnoRes] = await Promise.all([
        fetch(PROXY + "/nifty").then(r => r.json()),
        fetch(PROXY + "/fno").then(r => r.json()),
      ]);

      if (fnoRes.error) throw new Error("fno.csv: " + fnoRes.error);
      const symbols = fnoRes.symbols || [];
      if (!symbols.length) throw new Error("fno.csv returned no symbols");

      setNiftyInfo(niftyRes);
      const niftyRet = (niftyRes?.day_open > 0 && niftyRes?.current > 0)
        ? ((niftyRes.current - niftyRes.day_open) / niftyRes.day_open) * 100
        : 0;

      // Batch of 50
      const BATCH = 50;
      let allQuotes = {};
      for (let i = 0; i < symbols.length; i += BATCH) {
        const batch    = symbols.slice(i, i + BATCH);
        const symParam = batch.map(s => encodeURIComponent(s)).join(",");
        const d        = await fetch(PROXY + "/quotes?symbols=" + symParam).then(r => r.json());
        allQuotes = { ...allQuotes, ...(d.data || {}) };
      }

      const rows = Object.entries(allQuotes)
        .map(([sym, q]) => {
          const s = scoreSignal(q, niftyRet);
          return s ? { symbol: sym, q, s } : null;
        })
        .filter(Boolean);

      setScored(rows);
      setCached([]); // hide stale cache once live data arrives
      setLastFetch(new Date());
      setStatus("ok");
      setCountdown(REFRESH_MS / 1000);

      // Snapshot: save ALL scored rows for backtesting
      const snapRows = rows.map(({ symbol, q, s }) => ({
        symbol,
        ltp:        q.ltp,        pct_change: q.pct_change,
        day_open:   q.day_open,   high:       q.high,
        low:        q.low,        vwap:       q.vwap,
        volume:     q.volume,     avg_volume: q.avg_volume,
        vol_ratio:  s.volRatio,   rs:         s.rs,
        momentum:   s.momentum,   reversal:   s.reversal,
        bias:       s.bias,
      }));
      saveSnapshot(snapRows);

      // ── ORB scan (runs alongside main screener) ────────────────────────
      fetchOrb();

    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  }, [saveSnapshot]);

  const fetchOrb = useCallback(async () => {
    setOrbStatus("loading");
    try {
      const d = await fetch(PROXY + "/orb").then(r => r.json());
      if (d.error) throw new Error(d.error);
      const all  = Object.values(d.data || {});
      const bull = all
        .filter(r => r.bull_setup && r.bull_status !== null)
        .sort((a, b) => {
          // Triggered first, then Watching, then others
          const order = { Triggered: 0, Watching: 1, Missed: 2, Failed: 3 };
          return (order[a.bull_status] ?? 9) - (order[b.bull_status] ?? 9);
        });
      const bear = all
        .filter(r => r.bear_setup && r.bear_status !== null)
        .sort((a, b) => {
          const order = { Triggered: 0, Watching: 1, Missed: 2, Failed: 3 };
          return (order[a.bear_status] ?? 9) - (order[b.bear_status] ?? 9);
        });
      setOrbData({ bull, bear });
      setOrbStatus("ok");
    } catch (e) {
      setOrbStatus("error");
    }
  }, []); // saveSnapshot is stable → runScreener is stable

  // ── Mount once: load cache, kick off live fetch, start interval ───────────────
  // FIX: all three deps (runScreener, loadCached, saveSnapshot) are now stable
  // useCallbacks with empty dep arrays, so this effect runs exactly once on mount
  // and the interval is never torn down mid-session.
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    loadCached().then(() => runScreener());
    timerRef.current = setInterval(runScreener, REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [runScreener, loadCached]);

  // ── Countdown ticker (independent of fetch cycle) ────────────────────────────
  useEffect(() => {
    cdRef.current = setInterval(
      () => setCountdown(c => (c <= 1 ? REFRESH_MS / 1000 : c - 1)),
      1000
    );
    return () => clearInterval(cdRef.current);
  }, []);

  // ── Filter & top N per tab ────────────────────────────────────────────────────
  // ATR filter — exclude stocks that have already consumed too much of their ATR
  const atrOk = ({ q }) => q.atr_consumed == null || q.atr_consumed <= atrFilter;

  const bullish = scored
    .filter(({ s }) => s.isBull && s.momentum >= 4)
    .filter(atrOk)
    .sort((a, b) => b.s.momentum - a.s.momentum)
    .slice(0, TOP_N);

  const bearish = scored
    .filter(({ s }) => s.isBear && s.momentum >= 4)
    .filter(atrOk)
    .sort((a, b) => b.s.momentum - a.s.momentum)
    .slice(0, TOP_N);

  const allMovers = [...scored]
    .filter(atrOk)
    .sort((a, b) => Math.abs(b.q.pct_change) - Math.abs(a.q.pct_change))
    .slice(0, 20);

  const cachedBull = cached.filter(r => (r.Bias || r.bias || "") === "BULL").slice(0, TOP_N);
  const cachedBear = cached.filter(r => (r.Bias || r.bias || "") === "BEAR").slice(0, TOP_N);
  const cachedAll  = cached.slice(0, 20);

  const isLive       = scored.length > 0;
  const showCached   = !isLive && cached.length > 0;
  const activeRows   = tab === "bullish" ? bullish : tab === "bearish" ? bearish : allMovers;
  const activeCached = tab === "bullish" ? cachedBull : tab === "bearish" ? cachedBear : cachedAll;

  const niftyRet = niftyInfo?.day_open > 0 && niftyInfo?.current > 0
    ? ((niftyInfo.current - niftyInfo.day_open) / niftyInfo.day_open) * 100
    : null;

  const tabCfg = [
    { key: "bullish", label: "🟢 Bullish",    count: isLive ? bullish.length  : cachedBull.length, active: "text-emerald-700 border-emerald-500" },
    { key: "bearish", label: "🔴 Bearish",    count: isLive ? bearish.length  : cachedBear.length, active: "text-red-700 border-red-500"         },
    { key: "movers",  label: "⚡ All Movers", count: isLive ? allMovers.length : cachedAll.length, active: "text-blue-700 border-blue-500"       },
    { key: "orb",     label: "🎯 ORB",        count: orbData.bull.length + orbData.bear.length,    active: "text-purple-700 border-purple-500"   },
  ];

  const tabDesc = {
    bullish: `Top ${TOP_N} · Chg% > 0 AND price > VWAP AND RS > 0 · momentum score ≥ 4 · sorted by momentum`,
    bearish: `Top ${TOP_N} · Chg% < 0 AND price < VWAP AND RS < 0 · momentum score ≥ 4 · sorted by momentum`,
    movers:  "Top 25 F&O stocks by absolute % change",
    orb:     "ORB High > Prev Day High (Bull) · ORB Low < Prev Day Low (Bear) · Breakout in candle 2/3/4",
  };

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Intraday F&amp;O Screener</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isLive
              ? `${scored.length} stocks scanned`
              : showCached
              ? `Showing last snapshot — ${cached[0]?.Date} ${cached[0]?.Time}`
              : "Connecting…"}
            &nbsp;· fno.csv · yfinance · 5 min refresh
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {niftyInfo?.current > 0 && (
            <div className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <span className="text-gray-500">Nifty</span>
              <span className="font-semibold text-gray-800">{Number(niftyInfo.current).toLocaleString("en-IN")}</span>
              {niftyRet !== null && (
                <span className={`font-semibold ${niftyRet >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {niftyRet >= 0 ? "+" : ""}{niftyRet.toFixed(2)}%
                </span>
              )}
            </div>
          )}
          {status === "ok" && lastFetch && (
            <span className="text-xs text-gray-400">
              {lastFetch.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              &nbsp;· next {countdown}s
              {snapMsg && <span className="ml-2 text-purple-500">{snapMsg}</span>}
            </span>
          )}
          {/* ATR filter */}
          <div className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
            <span className="text-gray-500 whitespace-nowrap">ATR filter</span>
            <select
              value={atrFilter}
              onChange={e => setAtrFilter(Number(e.target.value))}
              className="text-xs font-semibold text-gray-700 bg-transparent border-none outline-none cursor-pointer"
            >
              <option value={999}>Off</option>
              <option value={50}>≤ 50%</option>
              <option value={60}>≤ 60%</option>
              <option value={70}>≤ 70%</option>
              <option value={80}>≤ 80%</option>
              <option value={90}>≤ 90%</option>
            </select>
            <span className="text-gray-400 text-[10px]">used</span>
          </div>

          <button onClick={runScreener} disabled={status === "loading"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {status === "loading"
              ? <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg> Scanning…</>
              : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Error */}
      {status === "error" && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ {errorMsg}
          <p className="mt-1 text-xs text-red-400">
            Make sure <code className="bg-red-100 px-1 rounded">python screener_proxy.py</code> is running on port 5000.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabCfg.map(({ key, label, count, active }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key ? active + " bg-transparent" : "text-gray-500 border-transparent hover:text-gray-700"}`}>
            {label}
            <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 font-semibold text-gray-500">
              {count}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 -mt-1">{tabDesc[tab]}</p>

      {/* Loading skeleton */}
      {tab !== "orb" && status === "loading" && !isLive && !showCached && (
        <div className="border border-gray-200 rounded-xl overflow-hidden animate-pulse">
          <div className="h-9 bg-gray-100" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-11 border-t border-gray-50 flex items-center px-4 gap-3">
              <div className="h-2.5 w-4 bg-gray-200 rounded" />
              <div className="h-2.5 w-24 bg-gray-200 rounded" />
              <div className="ml-auto h-2.5 w-48 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Table — live or cached */}
      {tab !== "orb" && (isLive ? activeRows.length > 0 : activeCached.length > 0) && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {showCached && (
            <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
              ⏱ Showing last saved snapshot ({cached[0]?.Date} {cached[0]?.Time}) — live data loading…
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <TableHead />
              <tbody>
                {isLive
                  ? activeRows.map(({ symbol, q, s }, i) => (
                      <StockRow key={symbol} rank={i + 1} symbol={symbol} q={q} s={s} />
                    ))
                  : activeCached.map((r, i) => (
                      <CachedRow key={r.Symbol + i} rank={i + 1} r={r} />
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {tab !== "orb" && status === "ok" && activeRows.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          {tab === "bullish" && `No stocks meeting all 3 criteria: Chg% > 0, price > VWAP, RS > 0, momentum ≥ 4`}
          {tab === "bearish" && `No stocks meeting all 3 criteria: Chg% < 0, price < VWAP, RS < 0, momentum ≥ 4`}
          {tab === "movers"  && "No data yet — click Refresh"}
        </div>
      )}

      {/* Legend */}
      {(isLive || showCached) && tab !== "orb" && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          <span><b className="text-gray-600">Bullish criteria:</b> Chg% &gt; 0 + above VWAP + RS &gt; 0 + mom ≥ 4</span>
          <span><b className="text-gray-600">Bearish criteria:</b> Chg% &lt; 0 + below VWAP + RS &lt; 0 + mom ≥ 4</span>
          <span><b className="text-gray-600">RS</b> = stock % − Nifty % from day open</span>
          <span><b className="text-gray-600">Snapshots</b> → Google Sheets ScreenerData every 5 min · clears next day</span>
        </div>
      )}

      {/* ORB Tab */}
      {tab === "orb" && (
        <OrbPanel orbData={orbData} orbStatus={orbStatus} onRefresh={fetchOrb} />
      )}
    </div>
  );
}