import { useState, useCallback, useRef, useEffect, Fragment } from "react";
import { createChart } from "lightweight-charts";

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

// ── Formatter ──────────────────────────────────────────────────────────────────
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

// ── Pattern metadata: label, family, classic TA bias, badge colors ─────────────
// Bias is the conventional textbook reading, shown as a hint only — not a
// recommendation. Symmetrical Triangle is a continuation pattern (bias
// depends on prior trend), so it's shown neutral rather than guessing.
const PATTERN_META = {
  "Ascending Triangle":   { family: "triangle", bias: "bullish", cls: "bg-emerald-100 text-emerald-700" },
  "Descending Triangle":  { family: "triangle", bias: "bearish", cls: "bg-red-100 text-red-600" },
  "Symmetrical Triangle": { family: "triangle", bias: "neutral", cls: "bg-gray-100 text-gray-600" },
  "Rising Wedge":         { family: "wedge",    bias: "bearish", cls: "bg-red-100 text-red-600" },
  "Falling Wedge":        { family: "wedge",    bias: "bullish", cls: "bg-emerald-100 text-emerald-700" },
};

const UNIVERSE_OPTS_DAILY = [
  { key: "fno",  label: "F&O"       },
  { key: "n50",  label: "Nifty 50"  },
  { key: "nn50", label: "Next 50"   },
  { key: "n200", label: "Nifty 200" },
  { key: "n500", label: "Nifty 500" },
];

// Intraday deliberately excludes n500 — the Breeze route is scoped to the
// F&O universe (see screener_proxy.py's /pattern-scan-intraday docstring),
// and this fan-out pattern hasn't been load-tested at full-500 scale.
const UNIVERSE_OPTS_INTRADAY = [
  { key: "fno",  label: "F&O"       },
  { key: "n50",  label: "Nifty 50"  },
  { key: "nn50", label: "Next 50"   },
  { key: "n200", label: "Nifty 200" },
];

const SOURCE_OPTS = [
  { key: "daily",    label: "Daily (EOD)" },
  { key: "intraday", label: "Intraday (5m)" },
];

// ── Sortable TH ───────────────────────────────────────────────────────────────
function SortTh({ col, sortCol, sortAsc, onSort, children, className = "" }) {
  return (
    <th onClick={() => onSort(col)}
      className={`py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none ${className}`}>
      {children}
      <span className="ml-0.5 opacity-40">
        {sortCol === col ? (sortAsc ? "↑" : "↓") : "⇅"}
      </span>
    </th>
  );
}

// ── Quality chip ───────────────────────────────────────────────────────────────
function QualityChip({ value }) {
  const cls =
    value >= 80 ? "bg-emerald-100 text-emerald-700" :
    value >= 60 ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-500";
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{fmt(value, 1)}</span>;
}

// ── Pattern badge ───────────────────────────────────────────────────────────────
function PatternBadge({ pattern }) {
  const meta = PATTERN_META[pattern] ?? { cls: "bg-gray-100 text-gray-600", bias: "" };
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.cls}`}>
        {pattern}
      </span>
      {meta.bias && (
        <span className="text-[9px] text-gray-400 capitalize">{meta.bias} bias</span>
      )}
    </div>
  );
}

// ── Breakout indicator ───────────────────────────────────────────────────────────
function BreakoutTag({ breakout }) {
  if (breakout === "up")   return <span className="text-emerald-600 font-bold text-xs">▲ Broke up</span>;
  if (breakout === "down") return <span className="text-red-500 font-bold text-xs">▼ Broke down</span>;
  return <span className="text-gray-400 text-xs">Forming</span>;
}

// ── Chart panel (Phase 4) ────────────────────────────────────────────────────────
// Fetches raw OHLC from the new /candles route and draws it with Lightweight
// Charts, overlaying the two trendlines using the slope/intercept the scan
// already returned — no recomputation, just mapped onto row.dates positions
// (they're in window-local bar-index units, 0..len(row.dates)-1, per Phase 2).
function PatternChart({ row, source }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg("");

    const isIntraday = source === "intraday";
    const toChartTime = (s) => {
      if (isIntraday) {
        // "YYYY-MM-DD HH:MM" IST -> UTC unix seconds, which is what
        // Lightweight Charts wants for a UTCTimestamp on an intraday scale.
        return Math.floor(new Date(s.replace(" ", "T") + ":00+05:30").getTime() / 1000);
      }
      return s; // "YYYY-MM-DD" business-day string works directly for daily
    };

    async function load() {
      try {
        const params = new URLSearchParams({
          symbol: row.symbol,
          source,
          start_date: row.start_date,
          end_date: row.end_date,
        });
        const res  = await fetch(`${PROXY}/candles?${params}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        if (!json.candles || json.candles.length === 0) throw new Error("No candle data returned");
        renderChart(json.candles);
        if (!cancelled) setStatus("ok");
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e.message);
          setStatus("error");
        }
      }
    }

    function renderChart(candles) {
      if (!containerRef.current) return;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 320,
        layout: { background: { color: "#ffffff" }, textColor: "#374151", fontSize: 11 },
        grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
        timeScale: { borderColor: "#e5e7eb" },
        rightPriceScale: { borderColor: "#e5e7eb" },
      });
      chartRef.current = chart;

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#10b981", downColor: "#ef4444", borderVisible: false,
        wickUpColor: "#10b981", wickDownColor: "#ef4444",
      });
      candleSeries.setData(
        candles.map(c => ({
          time: toChartTime(c.time),
          open: c.open, high: c.high, low: c.low, close: c.close,
        }))
      );

      const lineFor = (line) => row.dates.map((d, i) => ({
        time: toChartTime(d),
        value: line.slope * i + line.intercept,
      }));

      const upperSeries = chart.addLineSeries({
        color: "#f59e0b", lineWidth: 2, lastValueVisible: false, priceLineVisible: false,
      });
      upperSeries.setData(lineFor(row.upper));

      const lowerSeries = chart.addLineSeries({
        color: "#3b82f6", lineWidth: 2, lastValueVisible: false, priceLineVisible: false,
      });
      lowerSeries.setData(lineFor(row.lower));

      chart.timeScale().fitContent();
    }

    load();
    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
    // row identity (symbol+window+start_date) is the effective dependency —
    // re-render whenever a different row's chart is expanded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.symbol, row.window, row.start_date, source]);

  return (
    <div className="p-3 bg-gray-50">
      {status === "loading" && (
        <div className="h-[320px] flex items-center justify-center text-xs text-gray-400">Loading chart…</div>
      )}
      {status === "error" && (
        <div className="h-[80px] flex items-center justify-center text-xs text-red-500">⚠ {errorMsg}</div>
      )}
      <div ref={containerRef} style={{ display: status === "ok" ? "block" : "none" }} />
      {status === "ok" && (
        <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-amber-500 inline-block" /> Upper trendline</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-blue-500 inline-block" /> Lower trendline</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PatternScanner() {
  const [source,      setSource]      = useState("daily");
  const [universe,    setUniverse]    = useState("n500");
  const [uniIntraday, setUniIntraday] = useState("n200");
  const [minQuality,  setMinQuality]  = useState(50);

  const [status,    setStatus]    = useState("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [data,      setData]      = useState([]);
  const [meta,      setMeta]      = useState(null);   // scanned/skipped_no_code/time from the API
  const [lastFetch, setLastFetch] = useState(null);
  const [scanSource, setScanSource] = useState("daily"); // source used for the data currently on screen

  const [familyFilter, setFamilyFilter] = useState("all"); // all | triangle | wedge
  const [sortCol, setSortCol] = useState("quality");
  const [sortAsc, setSortAsc] = useState(false);

  const [expandedKey, setExpandedKey] = useState(null); // `${symbol}-${window}-${start_date}` or null

  const fetchingRef = useRef(false);

  const activeUniverse = source === "daily" ? universe : uniIntraday;

  const runScan = useCallback(async (src, uni, minQ) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setStatus("loading");
    setErrorMsg("");
    setExpandedKey(null); // collapse any open chart — stale row keys otherwise
    try {
      const endpoint = src === "daily" ? "pattern-scan-daily" : "pattern-scan-intraday";
      const res  = await fetch(`${PROXY}/${endpoint}?universe=${uni}&min_quality=${minQ}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data ?? []);
      setMeta({ scanned: json.scanned, skippedNoCode: json.skipped_no_code, total: json.count });
      setLastFetch(new Date());
      setScanSource(src);
      setStatus("ok");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(false); }
  };

  const filtered = data.filter(r => {
    if (familyFilter === "all") return true;
    return PATTERN_META[r.pattern]?.family === familyFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (sortCol === "symbol" || sortCol === "pattern") {
      av = av ?? ""; bv = bv ?? "";
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    av = av ?? -Infinity; bv = bv ?? -Infinity;
    return sortAsc ? av - bv : bv - av;
  });

  const triangleCount = data.filter(r => PATTERN_META[r.pattern]?.family === "triangle").length;
  const wedgeCount    = data.filter(r => PATTERN_META[r.pattern]?.family === "wedge").length;

  const sortProps = { sortCol, sortAsc, onSort: handleSort };

  const rowKey = (r) => `${r.symbol}-${r.window}-${r.start_date}`;
  const toggleRow = (r) => {
    const k = rowKey(r);
    setExpandedKey(cur => (cur === k ? null : k));
  };

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Pattern Scanner</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {status === "ok" && lastFetch
              ? `${data.length} pattern(s) found across ${meta?.scanned ?? "?"} stocks scanned · ${lastFetch.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : status === "loading"
              ? source === "daily"
                ? "Fetching from yfinance — full-universe scans can take 60-90s..."
                : "Fetching 5-min candles from Breeze, per-symbol — may take a while for larger universes"
              : "Ascending/Descending/Symmetrical Triangle · Rising/Falling Wedge — trendline convergence + containment scored 0-100"}
          </p>
        </div>
        <button onClick={() => runScan(source, activeUniverse, minQuality)} disabled={status === "loading"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {status === "loading" ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Scanning…
            </>
          ) : "↻ Scan"}
        </button>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
          {SOURCE_OPTS.map(s => (
            <button key={s.key} onClick={() => setSource(s.key)}
              className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                source === s.key ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
          {(source === "daily" ? UNIVERSE_OPTS_DAILY : UNIVERSE_OPTS_INTRADAY).map(u => (
            <button key={u.key}
              onClick={() => source === "daily" ? setUniverse(u.key) : setUniIntraday(u.key)}
              className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                activeUniverse === u.key ? "bg-blue-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              {u.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Min quality</span>
          <input type="number" value={minQuality} min={0} max={100}
            onChange={e => setMinQuality(Number(e.target.value))}
            className="w-14 text-xs font-semibold text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* ── Family sub-tabs ── */}
      {status === "ok" && (
        <div className="flex border-b border-gray-100 flex-wrap">
          {[
            { key: "all",      label: "All",       count: data.length },
            { key: "triangle", label: "Triangles",  count: triangleCount },
            { key: "wedge",    label: "Wedges",     count: wedgeCount },
          ].map(f => (
            <button key={f.key} onClick={() => setFamilyFilter(f.key)}
              className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                familyFilter === f.key ? "text-blue-700 border-blue-400" : "text-gray-400 border-transparent hover:text-gray-600"
              }`}>
              {f.label}
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{f.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {status === "error" && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ {errorMsg}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {status === "loading" && (
        <div className="space-y-2 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2 border-b border-gray-50">
              <div className="h-3 w-6 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-blue-100 rounded" />
              <div className="h-3 w-14 bg-gray-200 rounded ml-auto" />
              <div className="h-3 w-10 bg-emerald-100 rounded" />
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
                <tr className="bg-blue-50 text-left">
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide">#</th>
                  <SortTh col="symbol" {...sortProps}>Stock</SortTh>
                  <SortTh col="pattern" {...sortProps}>Pattern</SortTh>
                  <SortTh col="window" {...sortProps} className="text-right">Window</SortTh>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide">Date Range</th>
                  <SortTh col="quality" {...sortProps} className="text-right">Quality</SortTh>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-center">Breakout</th>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-center">Chart</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const key = rowKey(r);
                  const isOpen = expandedKey === key;
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => toggleRow(r)}
                        className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors text-xs cursor-pointer ${isOpen ? "bg-blue-50/40" : ""}`}>
                        <td className="py-2.5 px-2 text-gray-400">{i + 1}</td>
                        <td className="py-2.5 px-2">
                          <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${r.symbol}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="font-semibold text-sm text-blue-600 hover:underline">
                            {r.symbol}
                          </a>
                        </td>
                        <td className="py-2.5 px-2"><PatternBadge pattern={r.pattern} /></td>
                        <td className="py-2.5 px-2 text-right text-gray-500">{r.window} bars</td>
                        <td className="py-2.5 px-2 text-gray-500 text-[11px]">{r.start_date} → {r.end_date}</td>
                        <td className="py-2.5 px-2 text-right"><QualityChip value={r.quality} /></td>
                        <td className="py-2.5 px-2 text-center"><BreakoutTag breakout={r.breakout} /></td>
                        <td className="py-2.5 px-2 text-center text-gray-400">
                          <span className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${key}-chart`}>
                          <td colSpan={8} className="p-0 border-b border-gray-100">
                            <PatternChart row={r} source={scanSource} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
          {data.length === 0
            ? "No patterns found. Try a wider universe or lower the min quality."
            : "No patterns in this family. Try a different filter."}
        </div>
      )}

      {/* ── Idle ── */}
      {status === "idle" && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <div className="text-3xl mb-2">📐</div>
          <div className="font-medium text-gray-500 mb-1">Chart Pattern Scanner</div>
          Set source, universe and min quality, then click Scan.
        </div>
      )}

      {/* ── Legend ── */}
      {status === "ok" && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          <span><b className="text-gray-600">Quality:</b> green ≥80 strong fit · amber 60-79 marginal · gray &lt;60 weak</span>
          <span><b className="text-gray-600">Bias:</b> classic TA reading, not a recommendation — always confirm on a chart</span>
          <span><b className="text-gray-600">Breakout:</b> only flagged once price actually closes beyond a trendline</span>
          <span><b className="text-gray-600">Chart:</b> click a row to overlay the detected trendlines on the price chart</span>
          {meta?.skippedNoCode > 0 && (
            <span><b className="text-gray-600">{meta.skippedNoCode} stock(s)</b> skipped — no Breeze code mapped</span>
          )}
        </div>
      )}

    </div>
  );
}