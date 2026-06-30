import { useState, useEffect, useRef, useCallback } from "react";

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

// ── Divergence badge ───────────────────────────────────────────────────────────
function DivBadge({ value }) {
  if (!value) return null;
  const isBull = value === "bull_div";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
      isBull ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
    }`}>
      {isBull ? "↗" : "↘"} {isBull ? "Bull div" : "Bear div"}
    </span>
  );
}

// ── RSI band pill ──────────────────────────────────────────────────────────────
function RsiBand({ value, lo, hi, isBull }) {
  if (value == null) return <span className="text-gray-300 text-xs">—</span>;
  const inBand = value > lo && value < hi;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`font-semibold text-xs ${
        inBand
          ? isBull ? "text-emerald-600" : "text-red-500"
          : "text-gray-400"
      }`}>
        {fmt(value, 1)}
      </span>
      {inBand && (
        <span className={`text-[9px] font-bold px-1.5 rounded-full ${
          isBull ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
        }`}>
          in band
        </span>
      )}
    </div>
  );
}

// ── Distance bar ───────────────────────────────────────────────────────────────
function DistBar({ distPct, isBull }) {
  if (distPct == null) return <span className="text-gray-300 text-xs">—</span>;
  const fill   = Math.min(Math.abs(distPct) / 5 * 100, 100);
  const isNear = Math.abs(distPct) <= 1.5;
  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex-1 rounded-full h-1.5 overflow-hidden min-w-[40px] ${
        isBull ? "bg-emerald-50" : "bg-red-50"
      }`}>
        <div
          className={`h-full rounded-full ${isBull ? "bg-emerald-400" : "bg-red-400"}`}
          style={{ width: `${fill}%` }}
        />
      </div>
      <span className={`text-[11px] font-bold min-w-[38px] text-right ${
        isNear
          ? isBull ? "text-emerald-600" : "text-red-500"
          : "text-gray-400"
      }`}>
        {Math.abs(distPct).toFixed(2)}%
      </span>
    </div>
  );
}

// ── RS rank chip ───────────────────────────────────────────────────────────────
function RsChip({ rank }) {
  if (rank == null) return <span className="text-gray-300 text-xs">—</span>;
  const cls =
    rank <= 20 ? "bg-emerald-100 text-emerald-800" :
    rank <= 50 ? "bg-amber-100 text-amber-800" :
                 "bg-gray-100 text-gray-500";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${cls}`}>
      #{rank}
    </span>
  );
}

// ── Stock row ──────────────────────────────────────────────────────────────────
function SwingRow({ rank, r, isBull, rsiLo, rsiHi }) {
  const entryLevel = isBull ? r.prev_high : r.prev_low;
  const distPct = r.ltp != null && entryLevel != null
    ? isBull
      ? ((entryLevel - r.ltp) / r.ltp) * 100
      : ((r.ltp - entryLevel) / r.ltp) * 100
    : null;

  const entryColor = isBull ? "text-emerald-600" : "text-red-500";
  const entryArrow = isBull ? "▲" : "▼";

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors text-xs">
      <td className="py-2 px-2 text-gray-400">{rank}</td>
      <td className="py-2 px-2">
        <div className="flex flex-col gap-0.5">
          <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${r.symbol}`}
            target="_blank" rel="noopener noreferrer"
            className="font-semibold text-sm text-blue-600 hover:underline">
            {r.symbol}
          </a>
          <DivBadge value={r.divergence} />
        </div>
      </td>
      <td className="py-2 px-2 text-center">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isBull ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
        }`}>
          {isBull ? "BULL" : "BEAR"}
        </span>
      </td>
      <td className="py-2 px-2 text-right">
        <div className="font-medium text-gray-800">₹{fmt(r.ltp)}</div>
        <div className="text-[10px] text-gray-400">EMA20: ₹{fmt(r.ema20)}</div>
      </td>
      <td className="py-2 px-2 text-right">
        <span className={`font-semibold ${entryColor}`}>
          {entryArrow} ₹{fmt(entryLevel)}
        </span>
      </td>
      <td className="py-2 px-2 min-w-[100px]">
        <DistBar distPct={distPct} isBull={isBull} />
      </td>
      <td className="py-2 px-2 text-right">
        <span className={`font-semibold text-xs ${
          isBull
            ? r.rsi_trade < 55 ? "text-emerald-600" : "text-amber-500"
            : r.rsi_trade > 45 ? "text-red-500"     : "text-amber-500"
        }`}>
          {fmt(r.rsi_trade, 1)}
        </span>
      </td>
      <td className="py-2 px-2 text-right">
        <RsiBand value={r.rsi_lower} lo={rsiLo} hi={rsiHi} isBull={isBull} />
      </td>
      <td className="py-2 px-2 text-center">
        <RsChip rank={r.rs_rank} />
      </td>
    </tr>
  );
}

// ── BB Momentum row ────────────────────────────────────────────────────────────
function BbRow({ rank, r }) {
  const isBull = r.signal === "bull";
  const posLabel = {
    above_upper:  "Above upper BB",
    riding_upper: "Riding upper BB",
    below_lower:  "Below lower BB",
    riding_lower: "Riding lower BB",
  }[r.bb_position] ?? r.bb_position;

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors text-xs">
      <td className="py-2 px-2 text-gray-400">{rank}</td>
      <td className="py-2 px-2">
        <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${r.symbol}`}
          target="_blank" rel="noopener noreferrer"
          className="font-semibold text-sm text-blue-600 hover:underline">
          {r.symbol}
        </a>
        <div className={`text-[9px] font-semibold mt-0.5 ${isBull ? "text-emerald-600" : "text-red-500"}`}>
          {posLabel}
        </div>
      </td>
      <td className="py-2 px-2 text-center">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isBull ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
        }`}>
          {isBull ? "BULL" : "BEAR"}
        </span>
      </td>
      <td className="py-2 px-2 text-right">
        <div className="font-medium text-gray-800">₹{fmt(r.ltp)}</div>
        <div className="text-[10px] text-gray-400">EMA20: ₹{fmt(r.ema20)}</div>
      </td>
      <td className="py-2 px-2 text-right text-[10px] leading-5">
        <span className="text-emerald-600 font-medium">₹{fmt(r.bb_upper)}</span>
        {" / "}
        <span className="text-gray-500">₹{fmt(r.bb_mid)}</span>
        {" / "}
        <span className="text-red-400">₹{fmt(r.bb_lower)}</span>
      </td>
      <td className="py-2 px-2 text-right">
        <span className={`font-semibold ${
          r.bb_width > 10 ? "text-purple-700" :
          r.bb_width > 5  ? "text-purple-500" : "text-gray-400"
        }`}>
          {r.bb_width != null ? `${r.bb_width}%` : "—"}
        </span>
      </td>
      <td className="py-2 px-2 text-center">
        {r.bb_expanding === true
          ? <span className="text-emerald-600 font-bold">↗ Yes</span>
          : r.bb_expanding === false
          ? <span className="text-red-400">↘ No</span>
          : <span className="text-gray-300">—</span>}
      </td>
      <td className="py-2 px-2 text-right">
        <span className={`font-semibold ${
          isBull
            ? r.rsi >= 55 && r.rsi <= 75 ? "text-emerald-600" : "text-gray-400"
            : r.rsi >= 25 && r.rsi <= 45 ? "text-red-500"     : "text-gray-400"
        }`}>
          {fmt(r.rsi, 1)}
        </span>
      </td>
      <td className="py-2 px-2 text-center">
        <RsChip rank={r.rs_rank} />
      </td>
    </tr>
  );
}

// ── RSI band input pair ────────────────────────────────────────────────────────
function RsiBandInput({ label, lo, hi, onLoChange, onHiChange, color }) {
  return (
    <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white">
      <span className={`text-xs font-medium whitespace-nowrap ${color}`}>{label} RSI</span>
      <span className="text-gray-300 text-xs">|</span>
      <span className="text-[10px] text-gray-400">lower TF</span>
      <input type="number" value={lo} min={1} max={99}
        onChange={e => onLoChange(Number(e.target.value))}
        className="w-12 text-xs font-semibold text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-blue-400"
      />
      <span className="text-gray-400 text-xs">–</span>
      <input type="number" value={hi} min={1} max={99}
        onChange={e => onHiChange(Number(e.target.value))}
        className="w-12 text-xs font-semibold text-gray-700 border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-blue-400"
      />
    </div>
  );
}

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

// ── Constants ──────────────────────────────────────────────────────────────────
const UNIVERSE_OPTS = [
  { key: "fno",  label: "F&O"       },
  { key: "n50",  label: "Nifty 50"  },
  { key: "nn50", label: "Next 50"   },
  { key: "n200", label: "Nifty 200" },
  { key: "n500", label: "Nifty 500" },
];

const TF_OPTS = [
  { key: "monthly", tradeTf: "Monthly", lowerTf: "Weekly" },
  { key: "weekly",  tradeTf: "Weekly",  lowerTf: "Daily"  },
  { key: "daily",   tradeTf: "Daily",   lowerTf: "75 min" },
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function SwingScreener() {
  // Swing state
  const [tab,       setTab]       = useState("bullish");
  const [tf,        setTf]        = useState("weekly");
  const [universe,  setUniverse]  = useState("n50");
  const [status,    setStatus]    = useState("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [data,      setData]      = useState([]);
  const [lastFetch, setLastFetch] = useState(null);
  const [sortCol,   setSortCol]   = useState("dist");
  const [sortAsc,   setSortAsc]   = useState(true);
  const [bullRsiLo, setBullRsiLo] = useState(65);
  const [bullRsiHi, setBullRsiHi] = useState(67);
  const [bearRsiLo, setBearRsiLo] = useState(33);
  const [bearRsiHi, setBearRsiHi] = useState(35);

  // BB Momentum state
  const [bbData,       setBbData]       = useState([]);
  const [bbStatus,     setBbStatus]     = useState("idle");
  const [bbUniverse,   setBbUniverse]   = useState("fno");
  const [bbLastFetch,  setBbLastFetch]  = useState(null);
  const [bbSortCol,    setBbSortCol]    = useState("bb_width");
  const [bbSortAsc,    setBbSortAsc]    = useState(false);
  const [bbSignalFilter, setBbSignalFilter] = useState("all"); // "all" | "bull" | "bear"

  // GFS state
  const [gfsData,       setGfsData]       = useState([]);
  const [gfsStatus,     setGfsStatus]     = useState("idle");
  const [gfsUniverse,   setGfsUniverse]   = useState("n50");
  const [gfsLastFetch,  setGfsLastFetch]  = useState(null);
  const [gfsMoMin,      setGfsMoMin]      = useState(60);
  const [gfsWkMin,      setGfsWkMin]      = useState(60);
  const [gfsSortCol,    setGfsSortCol]    = useState("monthly_rsi");
  const [gfsSortAsc,    setGfsSortAsc]    = useState(false);
  const [gfsDyZone,     setGfsDyZone]     = useState("all");
  const [gfsWatchlist,  setGfsWatchlist]  = useState(new Set());
  const [gfsWatchOnly,  setGfsWatchOnly]  = useState(false);

  const mountRef      = useRef(false);
  const fetchingRef   = useRef(false);
  const bbFetchingRef = useRef(false);
  const gfsFetchRef   = useRef(false);

  const tfConfig = TF_OPTS.find(t => t.key === tf) ?? TF_OPTS[1];

  // ── Swing fetch ────────────────────────────────────────────────────────────
  const runScreener = useCallback(async (uni, tfKey) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res  = await fetch(`${PROXY}/swing?universe=${uni}&tf=${tfKey}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data ?? []);
      setLastFetch(new Date());
      setStatus("ok");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // ── BB Momentum fetch ──────────────────────────────────────────────────────
  const runBbScreener = useCallback(async (uni) => {
    if (bbFetchingRef.current) return;
    bbFetchingRef.current = true;
    setBbStatus("loading");
    try {
      const res  = await fetch(`${PROXY}/bb_momentum?universe=${uni}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setBbData(json.data ?? []);
      setBbLastFetch(new Date());
      setBbStatus("ok");
    } catch (e) {
      setBbStatus("error");
    } finally {
      bbFetchingRef.current = false;
    }
  }, []);

  // ── GFS fetch ──────────────────────────────────────────────────────────────
  const runGfs = useCallback(async (uni, mo, wk) => {
    if (gfsFetchRef.current) return;
    gfsFetchRef.current = true;
    setGfsStatus("loading");
    try {
      const json = await fetch(`${PROXY}/gfs?universe=${uni}&monthly_rsi_min=${mo}&weekly_rsi_min=${wk}`).then(r => r.json());
      if (json.error) throw new Error(json.error);
      setGfsData(json.data ?? []);
      setGfsLastFetch(new Date());
      setGfsStatus("ok");
    } catch { setGfsStatus("error"); }
    finally { gfsFetchRef.current = false; }
  }, []);

  // ── Mount — do NOT auto-fetch, user clicks Refresh ───────────────────────
  useEffect(() => {
    mountRef.current = true;
  }, []);

  // ── Re-fetch swing when universe or TF changes (only after first manual fetch) ──
  const prevUniRef = useRef(universe);
  const prevTfRef  = useRef(tf);
  useEffect(() => {
    if (status === "idle") return;  // don't fetch if never manually triggered
    if (universe === prevUniRef.current && tf === prevTfRef.current) return;
    prevUniRef.current = universe;
    prevTfRef.current  = tf;
    runScreener(universe, tf);
  }, [universe, tf, runScreener]);

  // ── Swing filter + sort ────────────────────────────────────────────────────
  const qualifies = (r) => {
    const bull =
      r.ltp > r.ema20 &&
      r.rsi_trade < 65 &&
      r.rsi_lower > bullRsiLo &&
      r.rsi_lower < bullRsiHi;
    const bear =
      r.ltp < r.ema20 &&
      r.rsi_trade > 35 &&
      r.rsi_lower < bearRsiHi &&
      r.rsi_lower > bearRsiLo;
    if (tab === "bullish")  return bull ? "bull" : null;
    if (tab === "bearish")  return bear ? "bear" : null;
    if (tab === "bull_div") return (r.divergence === "bull_div") ? "bull" : null;
    if (tab === "bear_div") return (r.divergence === "bear_div") ? "bear" : null;
    if (bull) return "bull";
    if (bear) return "bear";
    return null;
  };

  const withType = data
    .map(r => ({ ...r, _type: qualifies(r) }))
    .filter(r => r._type != null)
    .map(r => ({
      ...r,
      _dist: r.ltp != null
        ? r._type === "bull"
          ? (r.prev_high != null ? ((r.prev_high - r.ltp) / r.ltp) * 100 : 999)
          : (r.prev_low  != null ? ((r.ltp - r.prev_low)  / r.ltp) * 100 : 999)
        : 999,
    }));

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  };

  const sorted = [...withType].sort((a, b) => {
    const av = sortCol === "dist" ? a._dist : sortCol === "rs" ? (a.rs_rank ?? 999) : sortCol === "rsi_lower" ? (a.rsi_lower ?? 0) : (a[sortCol] ?? 0);
    const bv = sortCol === "dist" ? b._dist : sortCol === "rs" ? (b.rs_rank ?? 999) : sortCol === "rsi_lower" ? (b.rsi_lower ?? 0) : (b[sortCol] ?? 0);
    return sortAsc ? av - bv : bv - av;
  });

  // ── Counts ─────────────────────────────────────────────────────────────────
  const allTyped   = data.map(r => ({ ...r, _type: (() => {
    const bull = r.ltp > r.ema20 && r.rsi_trade < 65 && r.rsi_lower > bullRsiLo && r.rsi_lower < bullRsiHi;
    const bear = r.ltp < r.ema20 && r.rsi_trade > 35 && r.rsi_lower < bearRsiHi && r.rsi_lower > bearRsiLo;
    if (bull) return "bull"; if (bear) return "bear"; return null;
  })() }));
  const bullCount  = allTyped.filter(r => r._type === "bull").length;
  const bearCount  = allTyped.filter(r => r._type === "bear").length;
  const nearCount  = withType.filter(r => r._dist <= 1.5).length;
  const bullDivCnt = data.filter(r => r.divergence === "bull_div").length;
  const bearDivCnt = data.filter(r => r.divergence === "bear_div").length;

  // ── BB sort ────────────────────────────────────────────────────────────────
  const handleBbSort = (col) => {
    if (bbSortCol === col) setBbSortAsc(a => !a);
    else { setBbSortCol(col); setBbSortAsc(false); }
  };

  const bbFiltered = bbData.filter(r =>
    bbSignalFilter === "all" ? true : r.signal === bbSignalFilter
  );

  const bbSorted = [...bbFiltered].sort((a, b) => {
    const av = bbSortCol === "rs"       ? (a.rs_rank ?? 999)
             : bbSortCol === "bb_width" ? (a.bb_width ?? 0)
             : bbSortCol === "rsi"      ? (a.rsi ?? 0)
             : (a[bbSortCol] ?? 0);
    const bv = bbSortCol === "rs"       ? (b.rs_rank ?? 999)
             : bbSortCol === "bb_width" ? (b.bb_width ?? 0)
             : bbSortCol === "rsi"      ? (b.rsi ?? 0)
             : (b[bbSortCol] ?? 0);
    return bbSortAsc ? av - bv : bv - av;
  });

  const bbSortProps = { sortCol: bbSortCol, sortAsc: bbSortAsc, onSort: handleBbSort };
  const bbBullN = bbData.filter(r => r.signal === "bull").length;
  const bbBearN = bbData.filter(r => r.signal === "bear").length;

  // ── GFS sort + filter ─────────────────────────────────────────────────────
  const handleGfsSort = (col) => { if (gfsSortCol === col) setGfsSortAsc(a => !a); else { setGfsSortCol(col); setGfsSortAsc(false); } };
  const toggleGfsWatch = (sym) => setGfsWatchlist(prev => { const n = new Set(prev); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });
  const gfsFiltered = gfsData.filter(r => {
    if (gfsWatchOnly && !gfsWatchlist.has(r.symbol)) return false;
    if (gfsDyZone === "ob")      return r.daily_rsi >= 70;
    if (gfsDyZone === "mo")      return r.daily_rsi >= 60 && r.daily_rsi < 70;
    if (gfsDyZone === "neutral") return r.daily_rsi >= 40 && r.daily_rsi < 60;
    if (gfsDyZone === "os")      return r.daily_rsi < 40;
    return true;
  });
  const gfsSorted = [...gfsFiltered].sort((a, b) => {
    const av = gfsSortCol === "rs" ? (a.rs_rank ?? 999) : (a[gfsSortCol] ?? 0);
    const bv = gfsSortCol === "rs" ? (b.rs_rank ?? 999) : (b[gfsSortCol] ?? 0);
    return gfsSortAsc ? av - bv : bv - av;
  });
  const gfsSortProps = { sortCol: gfsSortCol, sortAsc: gfsSortAsc, onSort: handleGfsSort };
  const gfsObN = gfsData.filter(r => r.daily_rsi >= 70).length;
  const gfsMoN = gfsData.filter(r => r.daily_rsi >= 60 && r.daily_rsi < 70).length;
  const gfsNtN = gfsData.filter(r => r.daily_rsi >= 40 && r.daily_rsi < 60).length;
  const gfsOsN = gfsData.filter(r => r.daily_rsi < 40).length;

  // ── Tab config ─────────────────────────────────────────────────────────────
  const tabCfg = [
    { key: "bullish",     label: "🟢 Bullish",     count: bullCount,            active: "text-emerald-700 border-emerald-500" },
    { key: "bearish",     label: "🔴 Bearish",     count: bearCount,            active: "text-red-600 border-red-500"         },
    { key: "both",        label: "⚡ Both",         count: bullCount + bearCount, active: "text-blue-700 border-blue-500"      },
    { key: "bull_div",    label: "↗ Bull Div",     count: bullDivCnt,           active: "text-emerald-700 border-emerald-400" },
    { key: "bear_div",    label: "↘ Bear Div",     count: bearDivCnt,           active: "text-red-600 border-orange-400"      },
    { key: "bb_momentum", label: "📊 BB Momentum", count: bbData.length,        active: "text-purple-700 border-purple-500"   },
    { key: "gfs",         label: "🌍 GFS",         count: gfsData.length,       active: "text-indigo-700 border-indigo-500"   },
  ];

  const sortProps  = { sortCol, sortAsc, onSort: handleSort };
  const isBbTab    = tab === "bb_momentum";
  const isGfsTab   = tab === "gfs";
  const isSwingTab = !isBbTab && !isGfsTab;

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            {isGfsTab ? "GFS — Global Filter Screener" : "Swing Screener"}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isSwingTab && status === "ok" && lastFetch
              ? `${data.length} stocks scanned · ${lastFetch.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : isSwingTab && status === "loading"
              ? "Fetching from yfinance — this takes ~60-90s for large universes..."
              : isGfsTab && gfsStatus === "ok" && gfsLastFetch
              ? `${gfsData.length} stocks qualify · ${gfsLastFetch.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : isGfsTab && gfsStatus === "loading"
              ? "Fetching monthly + weekly + daily — ~60-90s..."
              : isGfsTab
              ? "Monthly RSI filter → Weekly RSI filter → Daily RSI for entry timing"
              : "Bollinger Band momentum scanner · Daily timeframe · 20 EMA + RSI filter"}
          </p>
        </div>
        {isSwingTab && (
          <button onClick={() => runScreener(universe, tf)} disabled={status === "loading"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            {status === "loading" ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Scanning…
              </>
            ) : "↻ Refresh"}
          </button>
        )}
        {isGfsTab && (
          <button onClick={() => runGfs(gfsUniverse, gfsMoMin, gfsWkMin)} disabled={gfsStatus === "loading"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {gfsStatus === "loading" ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Scanning…
              </>
            ) : "↻ Scan"}
          </button>
        )}
      </div>

      {/* ── Swing controls (hidden on BB tab) ── */}
      {isSwingTab && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            {TF_OPTS.map(t => (
              <button key={t.key} onClick={() => setTf(t.key)}
                className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                  tf === t.key ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}>
                {t.tradeTf}
              </button>
            ))}
          </div>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            {UNIVERSE_OPTS.map(u => (
              <button key={u.key} onClick={() => setUniverse(u.key)}
                className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                  universe === u.key ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}>
                {u.label}
              </button>
            ))}
          </div>
          {(tab === "bullish" || tab === "both" || tab === "bull_div") && (
            <RsiBandInput label="Bull" lo={bullRsiLo} hi={bullRsiHi}
              onLoChange={setBullRsiLo} onHiChange={setBullRsiHi} color="text-emerald-600" />
          )}
          {(tab === "bearish" || tab === "both" || tab === "bear_div") && (
            <RsiBandInput label="Bear" lo={bearRsiLo} hi={bearRsiHi}
              onLoChange={setBearRsiLo} onHiChange={setBearRsiHi} color="text-red-500" />
          )}
        </div>
      )}

      {/* ── BB controls (only on BB tab) ── */}
      {isBbTab && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            {UNIVERSE_OPTS.map(u => (
              <button key={u.key} onClick={() => setBbUniverse(u.key)}
                className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                  bbUniverse === u.key ? "bg-purple-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}>
                {u.label}
              </button>
            ))}
          </div>
          <button onClick={() => runBbScreener(bbUniverse)} disabled={bbStatus === "loading"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50">
            {bbStatus === "loading" ? "Scanning…" : "↻ Scan"}
          </button>
          {/* Signal filter */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            {[{ key: "all", label: "All" }, { key: "bull", label: "🟢 Bull" }, { key: "bear", label: "🔴 Bear" }].map(f => (
              <button key={f.key} onClick={() => setBbSignalFilter(f.key)}
                className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
                  bbSignalFilter === f.key ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          {bbLastFetch && (
            <span className="text-[11px] text-gray-400">
              {bbData.length} signals · {bbLastFetch.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* ── GFS controls ── */}
      {isGfsTab && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
            {UNIVERSE_OPTS.map(u => (
              <button key={u.key} onClick={() => setGfsUniverse(u.key)}
                className={`px-3 py-1.5 font-medium border-r border-gray-200 last:border-r-0 transition-colors ${gfsUniverse === u.key ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {u.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-xs">
            <span className="text-gray-500 font-medium whitespace-nowrap">Monthly RSI ≥</span>
            <input type="number" value={gfsMoMin} min={40} max={90} step={5} onChange={e => setGfsMoMin(Number(e.target.value))}
              className="w-12 text-xs font-bold text-indigo-700 border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-indigo-400" />
          </div>
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-xs">
            <span className="text-gray-500 font-medium whitespace-nowrap">Weekly RSI ≥</span>
            <input type="number" value={gfsWkMin} min={40} max={90} step={5} onChange={e => setGfsWkMin(Number(e.target.value))}
              className="w-12 text-xs font-bold text-indigo-700 border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:border-indigo-400" />
          </div>
          {gfsWatchlist.size > 0 && (
            <button onClick={() => setGfsWatchOnly(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${gfsWatchOnly ? "bg-purple-700 text-white border-purple-700" : "bg-white text-purple-700 border-purple-300 hover:bg-purple-50"}`}>
              ⭐ Watchlist ({gfsWatchlist.size})
            </button>
          )}
          {gfsLastFetch && <span className="text-[11px] text-gray-400">{gfsData.length} qualify · {gfsLastFetch.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
        </div>
      )}

      {/* ── Logic reminder ── */}
      {isSwingTab && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          {(tab === "bull_div" || tab === "bear_div") ? (
            <>
              <span>↗ <b>Bull div:</b> price lower low + RSI higher low → reversal up</span>
              <span>↘ <b>Bear div:</b> price higher high + RSI lower high → reversal down</span>
              <span>⚠ Divergence tabs show <b>all stocks with div signal</b>, ignoring RSI band filter</span>
            </>
          ) : <>
            {tab !== "bearish" && <>
              <span>🟢 <b>Bull:</b> LTP &gt; 20 EMA</span>
              <span>📊 {tfConfig.tradeTf} RSI &lt; 65</span>
              <span>⚡ {tfConfig.lowerTf} RSI {bullRsiLo}–{bullRsiHi}</span>
              <span>📍 Entry: break above prev {tfConfig.tradeTf.toLowerCase()} high</span>
            </>}
            {tab === "both" && <span className="text-gray-300">|</span>}
            {tab !== "bullish" && <>
              <span>🔴 <b>Bear:</b> LTP &lt; 20 EMA</span>
              <span>📊 {tfConfig.tradeTf} RSI &gt; 35</span>
              <span>⚡ {tfConfig.lowerTf} RSI {bearRsiLo}–{bearRsiHi}</span>
              <span>📍 Entry: break below prev {tfConfig.tradeTf.toLowerCase()} low</span>
            </>}
          </>}
        </div>
      )}
      {isBbTab && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
          <span>📊 <b>Bull:</b> Price above/riding upper BB + bands expanding + LTP &gt; EMA20 + RSI 55–75</span>
          <span>📊 <b>Bear:</b> Price below/riding lower BB + bands expanding + LTP &lt; EMA20 + RSI 25–45</span>
          <span>📏 <b>BB Width%:</b> higher = more volatility expansion = stronger momentum</span>
        </div>
      )}
      {isGfsTab && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
          <span>🌍 <b>Monthly RSI ≥ {gfsMoMin}:</b> long-term uptrend confirmed</span>
          <span>📅 <b>Weekly RSI ≥ {gfsWkMin}:</b> medium-term momentum active</span>
          <span>📊 <b>Daily RSI:</b> click to add to watchlist — 40–60 pullback · 60–70 momentum · ≥70 wait</span>
        </div>
      )}

      {/* ── Error ── */}
      {status === "error" && isSwingTab && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ {errorMsg}
          <p className="mt-1 text-xs text-red-400">
            Make sure <code className="bg-red-100 px-1 rounded">python screener_proxy.py</code> is running.
          </p>
        </div>
      )}

      {/* ── Swing stat cards ── */}
      {isSwingTab && status === "ok" && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Scanned",    val: data.length,              sub: `${tfConfig.tradeTf} TF`, color: "text-gray-800"    },
            { label: "Bullish",    val: bullCount,                 sub: "LTP > 20EMA",            color: "text-emerald-600" },
            { label: "Bearish",    val: bearCount,                 sub: "LTP < 20EMA",            color: "text-red-500"     },
            { label: "Near entry", val: nearCount,                 sub: "≤ 1.5% away",            color: "text-amber-600"   },
            { label: "Divergence", val: bullDivCnt + bearDivCnt,  sub: `${bullDivCnt}↗ ${bearDivCnt}↘`, color: "text-purple-600" },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-gray-400 mb-1">{s.label}</div>
              <div className={`text-xl font-semibold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── BB stat cards ── */}
      {isBbTab && bbStatus === "ok" && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Total signals", val: bbData.length, sub: "Daily TF",        color: "text-purple-700" },
            { label: "Bull BB",       val: bbBullN,        sub: "Riding upper BB", color: "text-emerald-600" },
            { label: "Bear BB",       val: bbBearN,        sub: "Riding lower BB", color: "text-red-500"     },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-gray-400 mb-1">{s.label}</div>
              <div className={`text-xl font-semibold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── GFS stat cards ── */}
      {isGfsTab && gfsStatus === "ok" && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Qualifying", val: gfsData.length, sub: `Mo≥${gfsMoMin} Wk≥${gfsWkMin}`, color: "text-indigo-700"  },
            { label: "OB Daily",   val: gfsObN,          sub: "RSI ≥ 70 — wait",               color: "text-red-500"     },
            { label: "Momentum",   val: gfsMoN,          sub: "RSI 60–70 — entry",             color: "text-emerald-600" },
            { label: "Neutral",    val: gfsNtN,          sub: "RSI 40–60 — pullback",          color: "text-amber-600"   },
            { label: "Oversold",   val: gfsOsN,          sub: "RSI ≤ 40 — deep pull",          color: "text-blue-600"    },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-gray-400 mb-1">{s.label}</div>
              <div className={`text-xl font-semibold ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200 flex-wrap">
        {tabCfg.map(({ key, label, count, active }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? active + " bg-transparent"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}>
            {label}
            <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 font-semibold text-gray-500">
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Swing loading skeleton ── */}
      {isSwingTab && status === "loading" && (
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

      {/* ── BB loading skeleton ── */}
      {isBbTab && bbStatus === "loading" && (
        <div className="border border-gray-200 rounded-xl overflow-hidden animate-pulse">
          <div className="h-9 bg-purple-50" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-11 border-t border-gray-50 flex items-center px-4 gap-3">
              <div className="h-2.5 w-4 bg-gray-200 rounded" />
              <div className="h-2.5 w-24 bg-purple-100 rounded" />
              <div className="ml-auto h-2.5 w-48 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* ── Swing table ── */}
      {isSwingTab && status === "ok" && sorted.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide">#</th>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide">Stock</th>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-center">Setup</th>
                  <SortTh col="ltp" {...sortProps} className="text-right">LTP / EMA20</SortTh>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-right">
                    Prev {tfConfig.tradeTf} high / low
                  </th>
                  <SortTh col="dist" {...sortProps} className="text-left">Distance</SortTh>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-right">
                    {tfConfig.tradeTf} RSI
                  </th>
                  <SortTh col="rsi_lower" {...sortProps} className="text-right">
                    {tfConfig.lowerTf} RSI
                  </SortTh>
                  <SortTh col="rs" {...sortProps} className="text-center">RS rank</SortTh>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <SwingRow key={r.symbol} rank={i + 1} r={r}
                    isBull={r._type === "bull"}
                    rsiLo={r._type === "bull" ? bullRsiLo : bearRsiLo}
                    rsiHi={r._type === "bull" ? bullRsiHi : bearRsiHi}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── BB table ── */}
      {isBbTab && bbStatus === "ok" && bbSorted.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="bg-purple-50 text-left">
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide">#</th>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide">Stock</th>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-center">Signal</th>
                  <SortTh col="ltp" {...bbSortProps} className="text-right">LTP / EMA20</SortTh>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-right">BB Upper / Mid / Lower</th>
                  <SortTh col="bb_width" {...bbSortProps} className="text-right">BB Width%</SortTh>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-center">Expanding</th>
                  <SortTh col="rsi" {...bbSortProps} className="text-right">RSI</SortTh>
                  <SortTh col="rs" {...bbSortProps} className="text-center">RS Rank</SortTh>
                </tr>
              </thead>
              <tbody>
                {bbSorted.map((r, i) => (
                  <BbRow key={r.symbol} rank={i + 1} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── BB idle ── */}
      {isBbTab && bbStatus === "idle" && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-2xl mb-2">📊</div>
          Select universe and click Scan to find BB Momentum setups.
        </div>
      )}

      {/* ── BB empty ── */}
      {isBbTab && bbStatus === "ok" && bbSorted.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-2xl mb-2">📭</div>
          No BB momentum signals found. Try a wider universe or change the signal filter.
        </div>
      )}

      {/* ── Swing empty ── */}
      {isSwingTab && status === "ok" && sorted.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-2xl mb-2">📭</div>
          No stocks match current filters.
          <div className="text-xs mt-1 text-gray-300">
            Try widening the RSI band, switching universe / timeframe, or check the Divergence tabs.
          </div>
        </div>
      )}

      {/* ── Swing idle ── */}
      {isSwingTab && status === "idle" && (
        <div className="text-center py-10 text-gray-400 text-sm">
          Click Refresh to scan.
        </div>
      )}

      {/* ── Swing legend ── */}
      {isSwingTab && status === "ok" && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          <span><b className="text-gray-600">Entry trigger:</b> LTP breaks prev {tfConfig.tradeTf.toLowerCase()} high (bull) / prev low (bear)</span>
          <span><b className="text-gray-600">Distance:</b> sort ascending to find stocks nearest breakout</span>
          <span><b className="text-gray-600">RSI band:</b> lower TF RSI in your set range = momentum igniting</span>
          <span><b className="text-gray-600">RS rank:</b> #1 = strongest vs Nifty · green = top 20 · amber = top 50</span>
          <span><b className="text-gray-600">↗ Bull div:</b> price new low + RSI higher low · <b className="text-gray-600">↘ Bear div:</b> price new high + RSI lower high</span>
        </div>
      )}

      {/* ── BB legend ── */}
      {isBbTab && bbStatus === "ok" && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          <span><b className="text-gray-600">BB Width%:</b> (upper−lower)/mid×100 · higher = stronger momentum</span>
          <span><b className="text-gray-600">Expanding:</b> BB width now &gt; width 5 bars ago</span>
          <span><b className="text-gray-600">Stop:</b> EMA20 or middle BB (same level)</span>
          <span><b className="text-gray-600">RS rank:</b> #1 = strongest vs Nifty · green = top 20 · amber = top 50</span>
        </div>
      )}

      {/* ── GFS loading skeleton ── */}
      {isGfsTab && gfsStatus === "loading" && (
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

      {/* ── GFS daily RSI zone sub-tabs ── */}
      {isGfsTab && gfsStatus === "ok" && (
        <div className="flex border-b border-gray-100 flex-wrap">
          {[
            { key: "all",     label: "All",            count: gfsData.length },
            { key: "ob",      label: "≥70 OB",         count: gfsObN         },
            { key: "mo",      label: "60–70 Momentum", count: gfsMoN         },
            { key: "neutral", label: "40–60 Neutral",  count: gfsNtN         },
            { key: "os",      label: "≤40 Oversold",   count: gfsOsN         },
          ].map(z => (
            <button key={z.key} onClick={() => setGfsDyZone(z.key)}
              className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors ${gfsDyZone === z.key ? "text-indigo-700 border-indigo-400" : "text-gray-400 border-transparent hover:text-gray-600"}`}>
              {z.label}
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{z.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── GFS table ── */}
      {isGfsTab && gfsStatus === "ok" && gfsSorted.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-indigo-50 text-left">
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide">#</th>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide">Stock</th>
                  <SortTh col="ltp" {...gfsSortProps} className="text-right">LTP</SortTh>
                  <SortTh col="pct_change" {...gfsSortProps} className="text-right">Day %</SortTh>
                  <SortTh col="monthly_rsi" {...gfsSortProps} className="text-right">Monthly RSI</SortTh>
                  <SortTh col="weekly_rsi" {...gfsSortProps} className="text-right">Weekly RSI</SortTh>
                  <SortTh col="daily_rsi" {...gfsSortProps} className="text-right">Daily RSI ✦ click</SortTh>
                  <th className="py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wide text-right">Wk EMA20</th>
                  <SortTh col="rs_rank" {...gfsSortProps} className="text-center">RS Rank</SortTh>
                </tr>
              </thead>
              <tbody>
                {gfsSorted.map((r, i) => {
                  const isWatching = gfsWatchlist.has(r.symbol);
                  const aboveWkEma = r.ema20_weekly != null && r.ltp > r.ema20_weekly;
                  const dyZone = r.daily_rsi >= 70 ? { cls: "bg-red-100 text-red-600",         label: "Overbought" }
                               : r.daily_rsi >= 60 ? { cls: "bg-emerald-100 text-emerald-700",  label: "Momentum"   }
                               : r.daily_rsi >= 50 ? { cls: "bg-amber-100 text-amber-700",      label: "Neutral+"   }
                               : r.daily_rsi >= 40 ? { cls: "bg-gray-100 text-gray-500",        label: "Neutral-"   }
                               :                     { cls: "bg-blue-100 text-blue-600",         label: "Oversold"   };
                  return (
                    <tr key={r.symbol} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors text-xs ${isWatching ? "bg-purple-50/40" : ""}`}>
                      <td className="py-2.5 px-2 text-gray-400">{i + 1}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1.5">
                          {isWatching && <span className="text-purple-500">⭐</span>}
                          <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${r.symbol}`} target="_blank" rel="noopener noreferrer"
                            className="font-semibold text-sm text-blue-600 hover:underline">{r.symbol}</a>
                        </div>
                        <div className={`text-[9px] mt-0.5 font-medium ${aboveWkEma ? "text-emerald-500" : "text-red-400"}`}>
                          {aboveWkEma ? "▲ Above wk EMA20" : "▼ Below wk EMA20"}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-medium text-gray-800">₹{fmt(r.ltp)}</td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={`font-semibold text-xs ${r.pct_change > 0 ? "text-emerald-600" : r.pct_change < 0 ? "text-red-500" : "text-gray-400"}`}>
                          {r.pct_change > 0 ? "+" : ""}{fmt(r.pct_change)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.monthly_rsi >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-emerald-50 text-emerald-600"}`}>
                          {fmt(r.monthly_rsi, 1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.weekly_rsi >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-emerald-50 text-emerald-600"}`}>
                          {fmt(r.weekly_rsi, 1)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <button onClick={() => toggleGfsWatch(r.symbol)}
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border transition-all ${isWatching ? "border-purple-400 bg-purple-100 text-purple-700 ring-1 ring-purple-300" : `${dyZone.cls} border-transparent`}`}
                          title={isWatching ? "Remove from watchlist" : "Add to watchlist"}>
                          {fmt(r.daily_rsi, 1)}
                        </button>
                        <div className="text-[9px] text-gray-400 mt-0.5 text-right">{dyZone.label}</div>
                      </td>
                      <td className="py-2.5 px-2 text-right text-gray-500 text-xs">₹{fmt(r.ema20_weekly)}</td>
                      <td className="py-2.5 px-2 text-center"><RsChip rank={r.rs_rank} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GFS watchlist panel ── */}
      {isGfsTab && gfsWatchlist.size > 0 && gfsStatus === "ok" && (
        <div className="border border-purple-200 bg-purple-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-purple-700">⭐ Watchlist — {gfsWatchlist.size} stock{gfsWatchlist.size > 1 ? "s" : ""} selected for entry</span>
            <button onClick={() => setGfsWatchlist(new Set())} className="text-[10px] text-purple-400 hover:text-purple-600">Clear all</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...gfsWatchlist].map(sym => {
              const r = gfsData.find(d => d.symbol === sym);
              return (
                <div key={sym} className="flex items-center gap-1.5 bg-white border border-purple-200 rounded-lg px-2 py-1">
                  <a href={`https://www.tradingview.com/chart/?symbol=NSE%3A${sym}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-600 hover:underline">{sym}</a>
                  {r && (
                    <span className={`text-[10px] font-semibold px-1.5 rounded-full ${r.daily_rsi >= 60 ? "bg-emerald-100 text-emerald-700" : r.daily_rsi >= 40 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-600"}`}>
                      D:{fmt(r.daily_rsi, 1)}
                    </span>
                  )}
                  <button onClick={() => toggleGfsWatch(sym)} className="text-gray-300 hover:text-red-400 text-xs">×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── GFS empty ── */}
      {isGfsTab && gfsStatus === "ok" && gfsSorted.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-2xl mb-2">📭</div>
          {gfsWatchOnly ? "No watchlist stocks in this zone." : "No stocks pass both filters. Try lowering RSI thresholds."}
        </div>
      )}

      {/* ── GFS idle ── */}
      {isGfsTab && gfsStatus === "idle" && (
        <div className="text-center py-12 text-gray-400 text-sm">
          <div className="text-3xl mb-2">🌍</div>
          <div className="font-medium text-gray-500 mb-1">Global Filter Screener</div>
          Set universe and RSI thresholds, then click Scan.
        </div>
      )}

      {/* ── GFS legend ── */}
      {isGfsTab && gfsStatus === "ok" && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-100">
          <span><b className="text-gray-600">Monthly RSI ≥ {gfsMoMin}:</b> long-term uptrend confirmed</span>
          <span><b className="text-gray-600">Weekly RSI ≥ {gfsWkMin}:</b> medium-term momentum active</span>
          <span><b className="text-gray-600">Daily RSI:</b> click pill to watchlist · 40–60 pullback · 60–70 momentum · ≥70 wait</span>
          <span><b className="text-gray-600">Wk EMA20:</b> ▲ above = trend intact · ▼ below = caution</span>
          <span><b className="text-gray-600">RS rank:</b> #1 = strongest vs Nifty · green = top 20 · amber = top 50</span>
        </div>
      )}

    </div>
  );
}