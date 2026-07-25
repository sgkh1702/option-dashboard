import SwingScreener from "../components/SwingScreener";
import { useState, useCallback, useEffect } from "react";
import { INDICES, ENABLED_INDICES } from "../config/indices";
import { useSheetData }  from "../hooks/useSheetData";
import { useRefresh }    from "../hooks/useRefresh";
import IndexSelector     from "../components/IndexSelector";
import RefreshControl    from "../components/RefreshControl";
import OptionChain       from "../components/OptionChain";
import OIChart           from "../components/OIChart";
import StraddleStrangle  from "../components/StraddleStrangle";
import GreeksPanel       from "../components/GreeksPanel";
import StrategyBuilder   from "../components/StrategyBuilder";
import IntradayScreener  from "../components/IntradayScreener";
import StockRanker from "../components/StockRanker";
import DailyMarketView from "../components/DailyMarketView";

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

const TABS = ["Daily Market View", "Option Chain", "Straddle / Strangle", "OI Chart", "Greeks", "Strategy", "Intraday Screener", "Swing Screener", "Stock Ranker"];

// ALL NSE F&O expiries (index + stock) are now last Tuesday of month (since Sep 2025)
// Nifty additionally has weekly Tuesday expiries
// This function computes DTE to nearest upcoming last-Tuesday (monthly)
function calcDte() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
    while (d.getDay() !== 2) d.setDate(d.getDate() - 1); // 2 = Tuesday
    const dte = Math.ceil((d - today) / 86400000);
    if (dte >= 0) return dte;
  }
  return 0;
}

// Only Nifty has weekly expiries — for all others show nearest monthly (last Tuesday)
// If selectedExpiry is provided (Nifty dropdown), compute DTE from that
function calcDteFromExpiry(expiryDateStr) {
  if (!expiryDateStr) return calcDte();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp   = new Date(expiryDateStr);
  return Math.max(0, Math.ceil((exp - today) / 86400000));
}

const INDEX_KEYS = new Set(["BANKNIFTY", "NIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50", "SENSEX"]);

export default function Dashboard() {
  const [indexKey,       setIndexKey]       = useState(ENABLED_INDICES[0]?.key ?? "BANKNIFTY");
  const [activeTab,      setActiveTab]      = useState("Option Chain");
  const [selectedStrike, setSelectedStrike] = useState(null);

  const indexConfig = INDICES[indexKey];
  const isIndex     = INDEX_KEYS.has(indexKey) || indexConfig?.type === "index";
  const isNifty     = indexKey === "NIFTY";

  // ── Expiry for all indices ────────────────────────────────────────────────
  // Nifty: weekly dropdown (multiple expiries)
  // BNF + others: single monthly expiry from /expiries
  const [nfExpiries,     setNfExpiries]     = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState(null);
  const [expiryLoading,  setExpiryLoading]  = useState(false);

  useEffect(() => {
    setNfExpiries([]);
    setSelectedExpiry(null);
    setExpiryLoading(true);
    fetch(`${PROXY}/expiries?symbol=${indexKey}`)
      .then(r => r.json())
      .then(json => {
        if (json.expiries?.length) {
          setNfExpiries(json.expiries);
          setSelectedExpiry(json.expiries[0].value);
        }
      })
      .catch(() => {
        // Fallback: compute upcoming Tuesdays locally
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const result = [];
        const d = new Date(today);
        while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
        const count = isNifty ? 6 : 1;
        for (let i = 0; i < count; i++) {
          const key = d.toISOString().slice(0, 10);
          const dl  = Math.ceil((d - today) / 86400000);
          result.push({
            label:    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
            value:    key,
            daysLeft: dl,
          });
          d.setDate(d.getDate() + 7);
        }
        setNfExpiries(result);
        if (result.length) setSelectedExpiry(result[0].value);
      })
      .finally(() => setExpiryLoading(false));
  }, [indexKey]);

  // DTE: for Nifty use selected expiry, for others compute from last Tuesday
  const dte = isNifty
    ? calcDteFromExpiry(selectedExpiry)
    : calcDte();

  // Expiry label for non-Nifty display (last Tuesday of month)
  const nonNiftyExpiryLabel = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let m = 0; m <= 1; m++) {
      const d = new Date(today.getFullYear(), today.getMonth() + m + 1, 0);
      while (d.getDay() !== 2) d.setDate(d.getDate() - 1);
      if (Math.ceil((d - today) / 86400000) >= 0)
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    }
    return "";
  })();

  // ── Sheet data ────────────────────────────────────────────────────────────
  const { data, pcrHistory, atmHistory, loading, error, lastUpdated, fetchData } = useSheetData();

  // Pass selectedExpiry to fetchData so useSheetData can filter NFData rows
  const doFetch = useCallback(() => {
    fetchData(indexKey, indexConfig.step, isNifty ? selectedExpiry : null);
  }, [fetchData, indexKey, indexConfig, isNifty, selectedExpiry]);

  const { countdown, interval, setIntervalSecs, manualRefresh } = useRefresh(doFetch, 300);

  // Single fetch trigger: fires when indexKey changes OR when selectedExpiry becomes
  // available for Nifty. Guard: skip if Nifty but expiry not yet loaded.
  useEffect(() => {
    if (isNifty && !selectedExpiry) return;   // wait for expiry to load
    doFetch();
  }, [doFetch]);  // doFetch already captures indexKey + selectedExpiry in its deps

  useEffect(() => {
    if (data?.atm && !selectedStrike) setSelectedStrike(data.atm);
  }, [data?.atm]);

  const spot      = data?.spot;
  const chain     = data?.chain;
  const atm       = data?.atm;
  const totalCeOI = chain?.reduce((s, r) => s + (r.ce_oi ?? 0), 0) ?? 0;
  const totalPeOI = chain?.reduce((s, r) => s + (r.pe_oi ?? 0), 0) ?? 0;
  const pcr       = totalCeOI ? (totalPeOI / totalCeOI).toFixed(2) : "-";
  const sentiment = Number(pcr) > 1 ? "Bullish" : "Bearish";

  const isScreenerTab = activeTab === "Intraday Screener";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-medium text-gray-800">Options Dashboard</h1>
          {spot > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">{indexConfig.label}</span>
              <span className="font-semibold text-gray-800">{Number(spot).toLocaleString("en-IN")}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sentiment === "Bullish" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {sentiment}
              </span>
              <span className="text-gray-400 text-xs">PCR {pcr}</span>
            </div>
          )}
        </div>
        <RefreshControl interval={interval} countdown={countdown} lastUpdated={lastUpdated}
          onIntervalChange={setIntervalSecs} onManualRefresh={manualRefresh} loading={loading} />
      </header>

      {/* Hide index/DTE/expiry controls on screener tab */}
      {!isScreenerTab && (
        <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-4 flex-wrap">
          <IndexSelector selected={indexKey} onChange={k => { setIndexKey(k); setSelectedStrike(null); }} />

          <div className="flex items-center gap-3 ml-auto text-sm text-gray-500 flex-wrap">

            {/* Expiry dropdown — Nifty shows multiple, others show single */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Expiry</label>
              {expiryLoading
                ? <span className="text-xs text-blue-400">loading…</span>
                : (
                  <select
                    value={selectedExpiry ?? ""}
                    onChange={e => { setSelectedExpiry(e.target.value); setSelectedStrike(null); }}
                    className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:border-blue-400"
                  >
                    {nfExpiries.map(exp => (
                      <option key={exp.value} value={exp.value}>
                        {exp.label} ({exp.daysLeft}d)
                      </option>
                    ))}
                  </select>
                )
              }
            </div>

            {/* ── DTE — editable, auto-computed from selected expiry ── */}
            <span className="text-sm text-gray-500">DTE</span>
            <input
              type="number" value={dte} readOnly
              className="w-14 border border-gray-200 rounded-md px-2 py-1 text-sm bg-gray-50 text-gray-500 cursor-default"
              title="Days to expiry — auto-computed from selected expiry"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ {error}
          {error.toLowerCase().includes("key") && (
            <span className="block mt-1 text-xs text-red-400">Check VITE_GSHEET_API_KEY in .env</span>
          )}
        </div>
      )}

      <div className="px-6 pt-4">
        <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? tab === "Intraday Screener"
                    ? "border-emerald-500 text-emerald-600 font-medium"
                    : "border-blue-500 text-blue-600 font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {tab === "Intraday Screener" ? "📊 " + tab : tab}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          const [activeTab, setActiveTab] = useState("Daily Market View");
          {activeTab === "Option Chain" && (
            <OptionChain
              chain={chain} atmStrike={atm}
              selectedStrike={selectedStrike} onSelectStrike={setSelectedStrike}
              pcrHistory={pcrHistory}
              selectedExpiry={selectedExpiry}
              lastUpdated={lastUpdated}
              spot={spot} dte={dte}
              symbol={indexKey}
              step={indexConfig.step}
            />
          )}

          {/* StraddleStrangle: parsedRows already filtered by selectedExpiry in useSheetData */}
          {activeTab === "Straddle / Strangle" && (
            <StraddleStrangle chain={chain} atmStrike={atm} spot={spot}
              indexConfig={indexConfig} dte={dte}
              rawRows={data?.parsedRows} pcrHistory={pcrHistory} />
          )}

          {/* OIChart: rawRows already filtered by selectedExpiry in useSheetData */}
          {activeTab === "OI Chart" && (
            <OIChart rawRows={data?.rawRows} atm={atm} step={indexConfig.step} chain={chain}
              selectedExpiry={isNifty ? selectedExpiry : null} />
          )}

          {activeTab === "Greeks" && (
            <GreeksPanel chain={chain} strikeC={selectedStrike ?? atm}
              strikeP={selectedStrike ?? atm} spot={spot} dte={dte} mode="straddle" />
          )}

          {activeTab === "Strategy"          && <StrategyBuilder spot={spot} />}
          {activeTab === "Intraday Screener" && <IntradayScreener />}
          {activeTab === "Swing Screener"    && <SwingScreener />}
          {activeTab === "Stock Ranker" && <StockRanker />}
        </div>
      </div>
    </div>
  );
}