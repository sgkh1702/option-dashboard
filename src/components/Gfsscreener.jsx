import { useState, useRef, useCallback } from "react";

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

// ── RSI badge ──────────────────────────────────────────────────────────────────
function RsiBadge({ value, min = 0, max = 100, label }) {
  if (value == null) return <span className="text-gray-300 text-xs">—</span>;
  const pct   = Math.min(Math.max((value - min) / (max - min) * 100, 0), 100);
  const color = value >= 70 ? "text-emerald-700 bg-emerald-100"
              : value >= 60 ? "text-emerald-600 bg-emerald-50"
              : value >= 50 ? "text-amber-600 bg-amber-50"
              : "text-gray-400 bg-gray-50";
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
        {fmt(value, 1)}
      </span>
      <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${
          value >= 70 ? "bg-emerald-500" :
          value >= 60 ? "bg-emerald-400" :
          value >= 50 ? "bg-amber-400"   : "bg-gray-300"
        }`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Daily RSI selector ─────────────────────────────────────────────────────────
// Shows daily RSI as a coloured pill — user clicks to mark as "watching"
function DailyRsiCell({ value, watching, onToggle }) {
  if (value == null) return <span className="text-gray-300 text-xs">—</span>;
  const zone = value >= 70 ? { label: "Overbought", cls: "bg-red-100 text-red-600" }
             : value >= 60 ? { label: "Momentum",   cls: "bg-emerald-100 text-emerald-700" }
             : value >= 50 ? { label: "Neutral+",   cls: "bg-amber-100 text-amber-700" }
             : value >= 40 ? { label: "Neutral-",   cls: "bg-gray-100 text-gray-500" }
             :               { label: "Oversold",   cls: "bg-blue-100 text-blue-600" };
  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={onToggle}
        className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-all ${
          watching
            ? "border-purple-400 bg-purple-100 text-purple-700 ring-1 ring-purple-300"
            : `${zone.cls} border-transparent`
        }`}
        title={watching ? "Remove from watchlist" : "Add to watchlist"}>
        {fmt(value, 1)}
      </button>
      <span className="text-[9px] text-gray-400">{zone.label}</span>
    </div>
  );
}

// ── RS chip ────────────────────────────────────────────────────────────────────
function RsChip({ rank }) {
  if (rank == null) return <span className="text-gray-300 text-xs">—</span>;
  const cls = rank <= 20 ? "bg-emerald-100 text-emerald-800"
            : rank <= 50 ? "bg-amber-100 text-amber-800"
            :              "bg-gray-100 text-gray-500";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>
      #{rank}
    </span>
  );
}

// ── Sortable TH ───────────────────────────────────────────────────────────────
function SortTh({ col, sortCol, sortAsc, onSort, children, className = "" }) {
  return (
    <th onClick={() => onSort(col)}
      className={`py-2 px-3 text-[10px] text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none ${className}`}>
      {children}
      <span className="ml-0.5 opacity-40">
        {sortCol === col ? (sortAsc ? "↑" : "↓") : "⇅"}
      </span>
    </th>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────
const UNIVERSE_OPTS = [
  { key: "fno",  label: "F&O"       },
  { key: "n50",  label: "Nifty 50"  },
  { key: "nn50", label: "Next 50"   },
  { key: "n200", label: "Nifty 200" },
  { key: "n500", label: "Nifty 500" },
];

const DAILY_RSI_ZONES = [
  { key: "all",    label: "All"          },
  { key: "ob",     label: "≥70 OB"       },
  { key: "mo",     label: "60–70 Mo"     },
  { key: "neutral",label: "40–60 Neutral"},
  { key: "os",     label: "≤40 OS"       },
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function GfsScreener() {
  const [universe,      setUniverse]      = useState("n50");
  const [moRsiMin,      setMoRsiMin]      = useState(60);
  const [wkRsiMin,      setWkRsiMin]      = useState(60);
  const [status,        setStatus]        = useState("idle");
  const [data,          setData]          = useState([]);
  const [lastFetch,     setLastFetch]     = useState(null);
  const [sortCol,       setSortCol]       = useState("monthly_rsi");
  const [sortAsc,       setSortAsc]       = useState(false);
  const [dyRsiZone,     setDyRsiZone]     = useState("all");
  const [watchlist,     setWatchlist]     = useState(new Set());  // symbols user selected
  const [showWatchOnly, setShowWatchOnly] = useState(false);

  const fetchingRef = useRef(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const runScan = useCallback(async (uni, mo, wk) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setStatus("loading");
    try {
      const url = `${PROXY}/gfs?universe=${uni}&monthly_rsi_min=${mo}&weekly_rsi_min=${wk}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data ?? []);
      setLastFetch(new Date());
      setStatus("ok");
    } catch (e) {
      setStatus("error");
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // ── Watchlist toggle ───────────────────────────────────────────────────────
  const toggleWatch = (sym) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      return next;
    });
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(false); }
  };

  // ── Filter by daily RSI zone + watchlist ──────────────────────────────────
  const filtered = data.filter(r => {
    if (showWatchOnly && !watchlist.has(r.symbol)) return false;
    if (dyRsiZone === "ob")      return r.daily_rsi >= 70;
    if (dyRsiZone === "mo")      return r.daily_rsi >= 60 && r.daily_rsi < 70;
    if (dyRsiZone === "neutral") return r.daily_rsi >= 40 && r.daily_rsi < 60;
    if (dyRsiZone === "os")      return r.daily_rsi < 40;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = sortCol === "rs" ? (a.rs_rank ?? 999) : (a[sortCol] ?? 0);
    const bv = sortCol === "rs" ? (b.rs_rank ?? 999) : (b[sortCol] ?? 0);
    return sortAsc ? av - bv : bv - av;
  });

  const sortProps = { sortCol, sortAsc, onSort: handleSort };

  // ── Stat counts ────────────────────────────────────────────────────────────
  const obCount  = data.filter(r => r.daily_rsi >= 70).length;
  const moCount  = data.filter(r => r.daily_rsi >= 60 && r.daily_rsi < 70).length;
  const ntCount  = data.filter(r => r.daily_rsi >= 40 && r.daily_rsi < 60).length;
  const osCount  = data.filter(r => r.daily_rsi < 40).length;

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">GFS — Global Filter Screener</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {status === "ok" && lastFetch
              ? `${data.length} stocks qualify · ${lastFetch.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : status === "loading"
              ? "Fetching monthly + weekly + daily data — takes ~60-90s..."
              : "Monthly RSI filter → Weekly RSI filter → Daily RSI for entry timing"}
          </p>
        </div>
        <button onClick={() => runScan(universe, moRsiMin, wkRsiMin)}
          disabled={status === "loading"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {status === "loading" ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Scanning…
            </>
          ) : "↻ Scan"}
        </button>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-2 items-center">

        {/* Universe */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
          {UNIVERSE_OPTS.map(u => (
            <button key={u.key} onClick={() => setUniverse(u.key)}
              className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                universe === u.key ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              {u.label}
            </button>
          ))}
        </div>

        {/* Monthly RSI threshold */}
        <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-xs">
          <span className="text-gray-500 font-medium whitespace-nowrap">Monthly RSI ≥</span>
          <input type="number" value={moRsiMin} min={40} max={90} step={5}
            onChange={e => setMoRsiMin(Number(e.target.value))}
            className="w-12 text-xs font-bold text-indigo-700 border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* Weekly RSI threshold */}
        <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-xs">
          <span className="text-gray-500 font-medium whitespace-nowrap">Weekly RSI ≥</span>
          <input type="number" value={wkRsiMin} min={40} max={90} step={5}
            onChange={e => setWkRsiMin(Number(e.target.value))}
            className="w-12 text-xs font-bold text-indigo-700 border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* Watchlist toggle */}
        {watchlist.size > 0 && (
          <button onClick={() => setShowWatchOnly(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showWatchOnly
                ? "bg-purple-700 text-white border-purple-700"
                : "bg-white text-purple-700 border-purple-300 hover:bg-purple-50"
            }`}>
            ⭐ Watchlist ({watchlist.size})
          </button>
        )}
      </div>

      {/* ── Logic reminder ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
        <span>🌍 <b>Monthly RSI ≥ {moRsiMin}:</b> long-term momentum filter — only strong uptrends pass</span>
        <span>📅 <b>Weekly RSI ≥ {wkRsiMin}:</b> medium-term momentum filter — trend must be active</span>
        <span>📊 <b>Daily RSI:</b> shown for entry timing — click to add to watchlist</span>
        <span>⭐ <b>Watchlist:</b> click daily RSI to mark stocks for entry — filter with Watchlist button</span>
      </div>

      {/* ── Error ── */}
      {status === "error" && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ Scan failed. Make sure <code className="bg-red-100 px-1 rounded">screener_proxy.py</code> is running with the <code className="bg-red-100 px-1 rounded">/gfs</code> endpoint.
        </div>
      )}

      {/* ── Stat cards ── */}
      {status === "ok" && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Qualifying",   val: data.length, sub: `Mo≥${moRsiMin} Wk≥${wkRsiMin}`, color: "text-indigo-700" },
            { label: "Overbought",   val: obCount,     sub: "Daily RSI ≥ 70",                 color: "text-red-500"    },
            { label: "Momentum",     val: moCount,     sub: "Daily RSI 60–70",                color: "text-emerald-600"},
            { label: "Neutral",      val: ntCount,     sub: "Daily RSI 40–60",                color: "text-amber-600"  },
            { label: "Oversold",     val: osCount,     sub: "Daily RSI ≤ 40",                 color: "text-blue-600"   },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-gray-400 mb-1">{s.label}</div>
              <div className={`text-xl font-semibold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Daily RSI zone filter tabs ── */}
      {status === "ok" && (
        <div className="flex border-b border-gray-200 flex-wrap">
          {DAILY_RSI_ZONES.map(z => {
            const count = z.key === "all"     ? data.length
                        : z.key === "ob"      ? obCount
                        : z.key === "mo"      ? moCount
                        : z.key === "neutral" ? ntCount
                        : osCount;
            return (
              <button key={z.key} onClick={() => setDyRsiZone(z.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  dyRsiZone === z.key
                    ? "text-indigo-700 border-indigo-500"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}>
                {z.label}
                <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 font-semibold text-gray-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {status === "loading" && (
        <div className="border border-gray-200 rounded-xl overflow-hidden animate-pulse">
          <div className="h-9 bg-indigo-50" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 border-t border-gray-50 flex items-center px-4 gap-4">
              <div className="h-2.5 w-4 bg-gray-200 rounded" />
              <div className="h-2.5 w-24 bg-indigo-100 rounded" />
              <div className="ml-auto flex gap-4">
                <div className="h-2.5 w-10 bg-gray-200 rounded" />
                <div className="h-2.5 w-10 bg-gray-200 rounded" />
                <div className="h-2.5 w-10 bg-indigo-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      {status === "ok" && sorted.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-indigo-50 text-left">
                  <th className="py-2 px-3 text-[10px] text-gray-500 uppercase tracking-wide">#</th>
                  <th className="py-2 px-3 text-[10px] text-gray-500 uppercase tracking-wide">Stock</th>
                  <SortTh col="ltp" {...sortProps} className="text-right">LTP</SortTh>
                  <SortTh col="pct_change" {...sortProps} className="text-right">Day %</SortTh>
                  <SortTh col="monthly_rsi" {...sortProps} className="text-right">
                    Monthly RSI
                  </SortTh>
                  <SortTh col="weekly_rsi" {...sortProps} className="text-right">
                    Weekly RSI
                  </SortTh>
                  <SortTh col="daily_rsi" {...sortProps} className="text-right">
                    Daily RSI ✦ click
                  </SortTh>
                  <th className="py-2 px-3 text-[10px] text-gray-500 uppercase tracking-wide text-right">
                    Wk EMA20
                  </th>
                  <SortTh col="rs" {...sortProps} className="text-center">RS Rank</SortTh>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const isWatching  = watchlist.has(r.symbol);
                  const aboveWkEma  = r.ema20_weekly != null && r.ltp > r.ema20_weekly;
                  return (
                    <tr key={r.symbol}
                      className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors text-xs ${
                        isWatching ? "bg-purple-50/40" : ""
                      }`}>

                      <td className="py-2.5 px-3 text-gray-400">{i + 1}</td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {isWatching && <span className="text-purple-500 text-xs">⭐</span>}
                          <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${r.symbol}`}
                            target="_blank" rel="noopener noreferrer"
                            className="font-semibold text-sm text-blue-600 hover:underline">
                            {r.symbol}
                          </a>
                        </div>
                        <div className={`text-[9px] mt-0.5 font-medium ${aboveWkEma ? "text-emerald-500" : "text-red-400"}`}>
                          {aboveWkEma ? "▲ Above wk EMA20" : "▼ Below wk EMA20"}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium text-gray-800">
                        ₹{fmt(r.ltp)}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-semibold text-xs ${
                          r.pct_change > 0 ? "text-emerald-600" :
                          r.pct_change < 0 ? "text-red-500" : "text-gray-400"
                        }`}>
                          {r.pct_change > 0 ? "+" : ""}{fmt(r.pct_change)}%
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <RsiBadge value={r.monthly_rsi} min={40} max={90} />
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <RsiBadge value={r.weekly_rsi} min={40} max={90} />
                      </td>

                      {/* Daily RSI — clickable for watchlist */}
                      <td className="py-2.5 px-3 text-right">
                        <DailyRsiCell
                          value={r.daily_rsi}
                          watching={isWatching}
                          onToggle={() => toggleWatch(r.symbol)}
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right text-gray-500">
                        ₹{fmt(r.ema20_weekly)}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <RsChip rank={r.rs_rank} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {status === "ok" && sorted.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-2xl mb-2">📭</div>
          {showWatchOnly
            ? "No watchlist stocks in this zone. Clear the watchlist filter or change zone."
            : "No stocks pass both filters. Try lowering Monthly/Weekly RSI thresholds."}
        </div>
      )}

      {/* ── Idle ── */}
      {status === "idle" && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <div className="text-3xl mb-2">🌍</div>
          <div className="font-medium text-gray-500 mb-1">Global Filter Screener</div>
          Set universe and RSI thresholds, then click Scan.
        </div>
      )}

      {/* ── Watchlist panel ── */}
      {watchlist.size > 0 && status === "ok" && (
        <div className="border border-purple-200 bg-purple-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-purple-700">
              ⭐ Watchlist — {watchlist.size} stock{watchlist.size > 1 ? "s" : ""} selected for entry
            </span>
            <button onClick={() => setWatchlist(new Set())}
              className="text-[10px] text-purple-400 hover:text-purple-600">
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...watchlist].map(sym => {
              const r = data.find(d => d.symbol === sym);
              return (
                <div key={sym}
                  className="flex items-center gap-1.5 bg-white border border-purple-200 rounded-lg px-2 py-1">
                  <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${sym}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-600 hover:underline">
                    {sym}
                  </a>
                  {r && (
                    <span className={`text-[10px] font-semibold px-1.5 rounded-full ${
                      r.daily_rsi >= 60 ? "bg-emerald-100 text-emerald-700" :
                      r.daily_rsi >= 40 ? "bg-amber-100 text-amber-700"    :
                                          "bg-blue-100 text-blue-600"
                    }`}>
                      D:{fmt(r.daily_rsi, 1)}
                    </span>
                  )}
                  <button onClick={() => toggleWatch(sym)}
                    className="text-gray-300 hover:text-red-400 text-xs leading-none">×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      {status === "ok" && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          <span><b className="text-gray-600">Monthly RSI ≥ {moRsiMin}:</b> long-term uptrend confirmed</span>
          <span><b className="text-gray-600">Weekly RSI ≥ {wkRsiMin}:</b> medium-term momentum active</span>
          <span><b className="text-gray-600">Daily RSI:</b> click to add to watchlist · 40–60 = pullback entry · 60–70 = momentum entry · ≥70 = wait</span>
          <span><b className="text-gray-600">Wk EMA20:</b> ▲ above = trend intact · ▼ below = caution</span>
          <span><b className="text-gray-600">RS rank:</b> #1 = strongest vs Nifty · green = top 20 · amber = top 50</span>
        </div>
      )}
    </div>
  );
}