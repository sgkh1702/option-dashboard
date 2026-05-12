import { useState, useEffect, useRef, useCallback } from "react";

const PROXY      = "http://localhost:5000";
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

  // Strict directional bias:
  // BULL = positive %, above VWAP, AND positive RS vs Nifty
  // BEAR = negative %, below VWAP, AND negative RS vs Nifty
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
    // For snapshot: purely directional, not filtered
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
  const up = parseFloat(r["Chg%"]) >= 0;
  return (
    <tr className="border-b border-gray-50 text-xs opacity-60">
      <td className="py-2 px-2 text-gray-400">{rank}</td>
      <td className="py-2 px-2">
        <span className="font-semibold text-sm text-gray-500">{r.Symbol}</span>
        <span className="ml-1 text-[10px] text-amber-500">cached</span>
      </td>
      <td className="py-2 px-2 text-right">
        <div className="font-medium text-gray-600">₹{fmt(parseFloat(r.LTP))}</div>
        <div className={`font-semibold ${up ? "text-emerald-500" : "text-red-400"}`}>
          {up ? "▲" : "▼"} {Math.abs(parseFloat(r["Chg%"])).toFixed(2)}%
        </div>
      </td>
      <td className="py-2 px-2 text-right text-gray-500">₹{fmt(parseFloat(r.VWAP))}</td>
      <td className="py-2 px-2 text-right hidden md:table-cell">
        <div className="text-emerald-500">H {fmt(parseFloat(r.High))}</div>
        <div className="text-red-400">L {fmt(parseFloat(r.Low))}</div>
      </td>
      <td className="py-2 px-2 text-right hidden md:table-cell text-gray-400">{fmtVol(parseInt(r.Volume))}</td>
      <td className="py-2 px-2 text-right text-gray-400">{r["RS vs Nifty"]}</td>
      <td className="py-2 px-3 text-gray-400">{r["Mom Score"]}/10</td>
      <td className="py-2 px-3 text-gray-400">{r["Rev Score"]}/10</td>
      <td className="py-2 px-2 text-center">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          r.Bias === "BULL" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}>
          {r.Bias}
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
        <th className="py-2 px-2">VWAP</th>
        <th className="py-2 px-2 hidden md:table-cell">High / Low</th>
        <th className="py-2 px-2 hidden md:table-cell">Vol / Ratio</th>
        <th className="py-2 px-2">RS</th>
        <th className="py-2 px-3 text-left">Mom /10</th>
        <th className="py-2 px-3 text-left">Rev /10</th>
        <th className="py-2 px-2">Bias</th>
      </tr>
    </thead>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function IntradayScreener() {
  const [tab,       setTab]       = useState("bullish");
  const [status,    setStatus]    = useState("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [scored,    setScored]    = useState([]);
  const [cached,    setCached]    = useState([]);   // last snapshot rows from Sheets
  const [niftyInfo, setNiftyInfo] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const timerRef = useRef(null);
  const cdRef    = useRef(null);

  // ── Load last snapshot from Sheets (for instant display) ─────────────────────
  const loadCached = useCallback(async () => {
    try {
      const d = await fetch(PROXY + "/last_snapshot").then(r => r.json());
      if (d.rows?.length) {
        setCached(d.rows);
        // Also set nifty info from cache if available
        if (d.nifty_ret !== undefined && !niftyInfo) {
          setNiftyInfo({ current: null, nifty_ret: d.nifty_ret, _fromCache: true });
        }
      }
    } catch (_) {}
  }, [niftyInfo]);



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
        const batch = symbols.slice(i, i + BATCH);
        const symParam = batch.map(s => encodeURIComponent(s)).join(",");
        const d = await fetch(PROXY + "/quotes?symbols=" + symParam).then(r => r.json());
        allQuotes = { ...allQuotes, ...(d.data || {}) };
      }

      const rows = Object.entries(allQuotes)
        .map(([sym, q]) => {
          const s = scoreSignal(q, niftyRet);
          return s ? { symbol: sym, q, s } : null;
        })
        .filter(Boolean);

      setScored(rows);
      setCached([]);   // clear cached display once live data is ready
      setLastFetch(new Date());
      setStatus("ok");
      setCountdown(REFRESH_MS / 1000);


    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  }, []);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    // Load cached first (instant), then start live fetch
    loadCached().then(() => runScreener());
    timerRef.current = setInterval(runScreener, REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [runScreener, loadCached]);

  useEffect(() => {
    cdRef.current = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_MS / 1000 : c - 1), 1000);
    return () => clearInterval(cdRef.current);
  }, []);

  // ── Filter & top 10 per tab ───────────────────────────────────────────────────
  // Bullish: positive %, above VWAP, positive RS — sorted by momentum, top 10
  const bullish = scored
    .filter(({ s }) => s.isBull && s.momentum >= 4)
    .sort((a, b) => b.s.momentum - a.s.momentum)
    .slice(0, TOP_N);

  // Bearish: negative %, below VWAP, negative RS — sorted by momentum, top 10
  const bearish = scored
    .filter(({ s }) => s.isBear && s.momentum >= 4)
    .sort((a, b) => b.s.momentum - a.s.momentum)
    .slice(0, TOP_N);

  // All movers: top 25 by abs % change
  const allMovers = [...scored]
    .sort((a, b) => Math.abs(b.q.pct_change) - Math.abs(a.q.pct_change))
    .slice(0, 20);

  // Cached fallback filtered per tab
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
    { key: "bullish", label: "🟢 Bullish",   count: isLive ? bullish.length   : cachedBull.length, active: "text-emerald-700 border-emerald-500" },
    { key: "bearish", label: "🔴 Bearish",   count: isLive ? bearish.length   : cachedBear.length, active: "text-red-700 border-red-500"         },
    { key: "movers",  label: "⚡ All Movers",count: isLive ? allMovers.length  : cachedAll.length,  active: "text-blue-700 border-blue-500"       },
  ];

  const tabDesc = {
    bullish: `Top ${TOP_N} · Chg% > 0 AND price > VWAP AND RS > 0 · momentum score ≥ 4 · sorted by momentum`,
    bearish: `Top ${TOP_N} · Chg% < 0 AND price < VWAP AND RS < 0 · momentum score ≥ 4 · sorted by momentum`,
    movers:  "Top 25 F&O stocks by absolute % change",
  };

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Intraday F&amp;O Screener</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isLive ? `${scored.length} stocks scanned` : showCached ? `Showing last snapshot — ${cached[0]?.Date} ${cached[0]?.Time}` : "Connecting…"}
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
            </span>
          )}
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
      {status === "loading" && !isLive && !showCached && (
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
      {(isLive ? activeRows.length > 0 : activeCached.length > 0) && (
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
      {status === "ok" && activeRows.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          {tab === "bullish" && `No stocks meeting all 3 criteria: Chg% > 0, price > VWAP, RS > 0, momentum ≥ 4`}
          {tab === "bearish" && `No stocks meeting all 3 criteria: Chg% < 0, price < VWAP, RS < 0, momentum ≥ 4`}
          {tab === "movers"  && "No data yet — click Refresh"}
        </div>
      )}

      {/* Legend */}
      {(isLive || showCached) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          <span><b className="text-gray-600">Bullish criteria:</b> Chg% &gt; 0 + above VWAP + RS &gt; 0 + mom ≥ 4</span>
          <span><b className="text-gray-600">Bearish criteria:</b> Chg% &lt; 0 + below VWAP + RS &lt; 0 + mom ≥ 4</span>
          <span><b className="text-gray-600">RS</b> = stock % − Nifty % from day open</span>
          <span><b className="text-gray-600">Snapshots</b> → Google Sheets ScreenerData every 5 min · clears next day</span>
        </div>
      )}
    </div>
  );
}