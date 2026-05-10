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

const TABS = ["Option Chain", "Straddle / Strangle", "OI Chart", "Greeks", "Strategy", "Intraday Screener"];

function calcDte(isIndex) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = isIndex ? 4 : 2;
  for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
    while (d.getDay() !== targetDay) d.setDate(d.getDate() - 1);
    const dte = Math.ceil((d - today) / 86400000);
    if (dte >= 0) return dte;
  }
  return 0;
}

function calcExpiryLabel(isIndex) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDay = isIndex ? 4 : 2;
  for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);
    while (d.getDay() !== targetDay) d.setDate(d.getDate() - 1);
    if (Math.ceil((d - today) / 86400000) >= 0)
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  return "";
}

const INDEX_KEYS = new Set(["BANKNIFTY", "NIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50", "SENSEX"]);

export default function Dashboard() {
  const [indexKey,       setIndexKey]       = useState(ENABLED_INDICES[0]?.key ?? "BANKNIFTY");
  const [activeTab,      setActiveTab]      = useState("Option Chain");
  const [selectedStrike, setSelectedStrike] = useState(null);

  const indexConfig = INDICES[indexKey];
  const isIndex     = INDEX_KEYS.has(indexKey) || indexConfig?.type === "index";

  const [dte, setDte] = useState(() => calcDte(true));
  useEffect(() => { setDte(calcDte(isIndex)); }, [indexKey]);

  const { data, pcrHistory, atmHistory, loading, error, lastUpdated, fetchData } = useSheetData();
  const doFetch = useCallback(() => fetchData(indexKey, indexConfig.step), [fetchData, indexKey, indexConfig]);
  const { countdown, interval, setIntervalSecs, manualRefresh } = useRefresh(doFetch, 300);
  useEffect(() => { doFetch(); }, [indexKey]);
  useEffect(() => { if (data?.atm && !selectedStrike) setSelectedStrike(data.atm); }, [data?.atm]);

  const spot      = data?.spot;
  const chain     = data?.chain;
  const atm       = data?.atm;
  const totalCeOI = chain?.reduce((s, r) => s + (r.ce_oi ?? 0), 0) ?? 0;
  const totalPeOI = chain?.reduce((s, r) => s + (r.pe_oi ?? 0), 0) ?? 0;
  const pcr       = totalCeOI ? (totalPeOI / totalCeOI).toFixed(2) : "-";
  const sentiment = Number(pcr) > 1 ? "Bullish" : "Bearish";
  const expiryLabel = calcExpiryLabel(isIndex);

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

      {/* Hide index/DTE controls on screener tab */}
      {!isScreenerTab && (
        <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-4 flex-wrap">
          <IndexSelector selected={indexKey} onChange={k => { setIndexKey(k); setSelectedStrike(null); }} />
          <div className="flex items-center gap-2 ml-auto text-sm text-gray-500">
            {expiryLabel && (
              <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">
                Expiry: {expiryLabel} ({isIndex ? "last Thu" : "last Tue"})
              </span>
            )}
            DTE
            <input
              type="number" value={dte} min={0} max={90}
              onChange={e => setDte(Number(e.target.value))}
              className="w-14 border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-blue-400"
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
          {activeTab === "Option Chain"        && <OptionChain chain={chain} atmStrike={atm} selectedStrike={selectedStrike} onSelectStrike={setSelectedStrike} pcrHistory={pcrHistory} />}
          {activeTab === "Straddle / Strangle" && <StraddleStrangle chain={chain} atmStrike={atm} spot={spot} indexConfig={indexConfig} dte={dte} rawRows={data?.rawRows} pcrHistory={pcrHistory} />}
          {activeTab === "OI Chart"            && <OIChart rawRows={data?.rawRows} atm={atm} step={indexConfig.step} chain={chain} />}
          {activeTab === "Greeks"              && <GreeksPanel chain={chain} strikeC={selectedStrike ?? atm} strikeP={selectedStrike ?? atm} spot={spot} dte={dte} mode="straddle" />}
          {activeTab === "Strategy"            && <StrategyBuilder spot={spot} />}
          {activeTab === "Intraday Screener" && <IntradayScreener />}
        </div>
      </div>
    </div>
  );
}