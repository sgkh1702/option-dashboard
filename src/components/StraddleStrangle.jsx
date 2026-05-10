import { useState, useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import { greeks } from "../utils/blackScholes";
Chart.register(...registerables);

const StatCard = ({ label, value, color }) => (
  <div className="bg-gray-50 rounded-lg px-3 py-2">
    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
    <div className={`text-lg font-medium ${color ?? "text-gray-800"}`}>{value}</div>
  </div>
);

// VWAP using OI as volume proxy
function calcVwap(ticks) {
  const result = [];
  let cumPV = 0, cumV = 0;
  ticks.forEach(t => {
    const price  = t.ce + t.pe;
    const volume = (t.ceoi ?? 0) + (t.peoi ?? 0);
    cumPV += price * volume;
    cumV  += volume;
    result.push(cumV > 0 ? +(cumPV / cumV).toFixed(2) : price);
  });
  return result;
}

// ─── Market Regime from pcrHistory ───────────────────────────────────────────
function getRegime(pcrHistory) {
  if (!pcrHistory?.length) return null;

  // Use last 3 ticks (or fewer if not available)
  const recent = pcrHistory.slice(-3);
  if (recent.length < 2) return null;

  const ceChgs  = recent.map(r => r.ce_oi_chg ?? 0);
  const peChgs  = recent.map(r => r.pe_oi_chg ?? 0);
  const diffs   = recent.map(r => r.diff ?? (r.ce_oi_chg - r.pe_oi_chg));

  const last    = recent[recent.length - 1];
  const prev    = recent[recent.length - 2];

  const cePos   = ceChgs.every(v => v > 0);   // CE writers adding consistently
  const pePos   = peChgs.every(v => v > 0);   // PE writers adding consistently
  const ceNeg   = ceChgs.every(v => v < 0);
  const peNeg   = peChgs.every(v => v < 0);

  const lastDiff = diffs[diffs.length - 1];
  const prevDiff = diffs[diffs.length - 2];
  const diffFlip = (lastDiff > 0 && prevDiff < 0) || (lastDiff < 0 && prevDiff > 0);

  const avgAbsDiff = diffs.reduce((s, v) => s + Math.abs(v), 0) / diffs.length;
  const totalOI    = (last.ce_oi ?? 0) + (last.pe_oi ?? 0);
  const diffPct    = totalOI > 0 ? avgAbsDiff / totalOI * 100 : 0;

  // Regime logic
  if (diffFlip) return {
    label: "Sentiment Shift",
    sub:   "OI Difference flipped — possible reversal",
    color: "bg-purple-50 border-purple-300 text-purple-700",
    dot:   "bg-purple-500",
    action: "Exit / Reduce position",
    actionColor: "text-purple-700",
  };

  if (cePos && pePos && diffPct < 15) return {
    label: "Sideways",
    sub:   "Both CE & PE writers active, OI balanced",
    color: "bg-green-50 border-green-300 text-green-700",
    dot:   "bg-green-500",
    action: "✅ Sell Straddle / Strangle — theta decay favourable",
    actionColor: "text-green-700",
  };

  if (cePos && peNeg) return {
    label: "Bearish Trend",
    sub:   "CE OI building, PE OI unwinding",
    color: "bg-red-50 border-red-300 text-red-700",
    dot:   "bg-red-500",
    action: "⚠ Avoid selling — or sell CE only (bear spread)",
    actionColor: "text-red-600",
  };

  if (pePos && ceNeg) return {
    label: "Bullish Trend",
    sub:   "PE OI building, CE OI unwinding",
    color: "bg-blue-50 border-blue-300 text-blue-700",
    dot:   "bg-blue-500",
    action: "⚠ Avoid selling — or sell PE only (bull spread)",
    actionColor: "text-blue-600",
  };

  if (ceNeg && peNeg) return {
    label: "Short Covering",
    sub:   "Both CE & PE OI unwinding — volatile move likely",
    color: "bg-orange-50 border-orange-300 text-orange-700",
    dot:   "bg-orange-500",
    action: "🚫 Avoid selling — exit existing positions",
    actionColor: "text-orange-700",
  };

  return {
    label: "Neutral",
    sub:   "Mixed signals — wait for clarity",
    color: "bg-gray-50 border-gray-300 text-gray-600",
    dot:   "bg-gray-400",
    action: "Wait for 1-2 more ticks",
    actionColor: "text-gray-500",
  };
}

// ─── Regime Panel UI ─────────────────────────────────────────────────────────
function RegimePanel({ pcrHistory }) {
  const regime = getRegime(pcrHistory);
  if (!regime) return (
    <div className="mb-3 p-2 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-400">
      Market Regime — waiting for data (needs 2+ ticks)
    </div>
  );

  const last   = pcrHistory[pcrHistory.length - 1];
  const ceChg  = last?.ce_oi_chg ?? 0;
  const peChg  = last?.pe_oi_chg ?? 0;
  const diff   = last?.diff ?? (ceChg - peChg);

  return (
    <div className={`mb-3 p-3 rounded-lg border ${regime.color}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${regime.dot}`} />
          <span className="font-semibold text-sm">{regime.label}</span>
          <span className="text-xs opacity-75">{regime.sub}</span>
        </div>
        <div className="flex gap-3 text-xs opacity-80">
          <span>CE ΔOI: <b>{(ceChg/1000).toFixed(1)}K</b></span>
          <span>PE ΔOI: <b>{(peChg/1000).toFixed(1)}K</b></span>
          <span>Diff: <b>{(diff/1000).toFixed(1)}K</b></span>
        </div>
      </div>
      <div className={`mt-1.5 text-xs font-medium ${regime.actionColor}`}>
        {regime.action}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StraddleStrangle({ chain, atmStrike, spot, indexConfig, dte, rawRows, pcrHistory }) {
  const [mode,      setMode]      = useState("straddle");
  const [strikeC,   setStrikeC]  = useState(atmStrike);
  const [strikeP,   setStrikeP]  = useState(atmStrike);
  const [direction, setDirection] = useState("short"); // "short" | "long"
  const [overlays,  setOverlays]  = useState({ vwap: true, theta: false, be: true });
  const chartRef = useRef(null), chartInst = useRef(null);

  useEffect(() => { if (atmStrike) { setStrikeC(atmStrike); setStrikeP(atmStrike); } }, [atmStrike]);

  const ticks = (() => {
    if (!rawRows?.length || !strikeC) return [];
    const peK = mode === "strangle" ? strikeP : strikeC;
    const byTime = {};
    rawRows.forEach(r => {
      if (!byTime[r.time]) byTime[r.time] = {};
      byTime[r.time][r.strike] = r;
    });
    return Object.entries(byTime)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, strikes]) => {
        const ce = strikes[strikeC], pe = strikes[peK];
        if (!ce || !pe) return null;
        return { time, ce: ce.ce_ltp ?? 0, pe: pe.pe_ltp ?? 0, spot: spot ?? 0, ceoi: ce.ce_oi ?? 0, peoi: pe.pe_oi ?? 0 };
      }).filter(Boolean);
  })();

  useEffect(() => {
    if (!chartRef.current || ticks.length < 2) return;
    const combined = ticks.map(t => +(t.ce + t.pe).toFixed(2));
    const vwapArr  = calcVwap(ticks);
    const premiumVals = [...combined, ...vwapArr];
    const pMin = Math.min(...premiumVals);
    const pMax = Math.max(...premiumVals);
    const pPad = Math.max((pMax - pMin) * 0.3, 50);

    const datasets = [{
      label: "Combined", data: combined,
      borderColor: "#378ADD", borderWidth: 2,
      pointRadius: 3, pointHoverRadius: 5,
      tension: 0.3, yAxisID: "y", fill: false,
    }];

    if (overlays.vwap) datasets.push({
      label: "VWAP", data: vwapArr,
      borderColor: "#EF9F27", borderWidth: 1.5,
      borderDash: [6, 3], pointRadius: 0,
      tension: 0.3, yAxisID: "y", fill: false,
    });

    if (overlays.theta) {
      const T = Math.max(0.001, dte / 365);
      const ceRow = chain?.find(r => r.strike === strikeC);
      const peRow = chain?.find(r => r.strike === (mode === "strangle" ? strikeP : strikeC));
      const thetas = ticks.map((t, i) => +(
        greeks(t.spot || spot, strikeC, T - i * 0.001, ceRow?.ce_iv ?? 14, "call").theta +
        greeks(t.spot || spot, mode === "strangle" ? strikeP : strikeC, T - i * 0.001, peRow?.pe_iv ?? 14, "put").theta
      ).toFixed(2));
      datasets.push({ label: "Theta", data: thetas, borderColor: "#D4537E", borderWidth: 1.5, borderDash: [2, 2], pointRadius: 0, tension: 0.3, yAxisID: "y", fill: false });
    }

    const scales = {
      x: { ticks: { font: { size: 10 }, autoSkip: true, maxTicksLimit: 10 }, grid: { color: "rgba(0,0,0,0.04)" } },
      y: { position: "left", title: { display: true, text: "Premium", font: { size: 10 } }, ticks: { font: { size: 10 } }, min: Math.floor(pMin - pPad), max: Math.ceil(pMax + pPad), grid: { color: "rgba(0,0,0,0.04)" } },
    };

    if (overlays.be) {
      const beUpper = ticks.map((_, i) => strikeC + combined[i]);
      const beLower = ticks.map((_, i) => (mode === "strangle" ? strikeP : strikeC) - combined[i]);
      const allY2   = [...beUpper, ...beLower];
      const y2Min   = Math.min(...allY2), y2Max = Math.max(...allY2);
      const y2Pad   = Math.max((y2Max - y2Min) * 0.1, 200);
      scales.y2 = { position: "right", title: { display: true, text: "Breakeven", font: { size: 10 } }, ticks: { font: { size: 10 } }, min: Math.floor(y2Min - y2Pad), max: Math.ceil(y2Max + y2Pad), grid: { drawOnChartArea: false } };
      datasets.push(
        { label: "BE upper", data: beUpper, borderColor: "rgba(99,153,34,0.7)", borderWidth: 1, borderDash: [4, 2], pointRadius: 0, tension: 0.3, yAxisID: "y2", fill: false },
        { label: "BE lower", data: beLower, borderColor: "rgba(99,153,34,0.7)", borderWidth: 1, borderDash: [4, 2], pointRadius: 0, tension: 0.3, yAxisID: "y2", fill: "-1", backgroundColor: "rgba(99,153,34,0.07)" }
      );
    }

    if (chartInst.current) chartInst.current.destroy();
    chartInst.current = new Chart(chartRef.current, {
      type: "line",
      data: { labels: ticks.map(t => t.time), datasets },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}` } } }, scales, animation: false },
    });
    return () => chartInst.current?.destroy();
  }, [ticks, overlays, strikeC, strikeP, mode, dte, chain, spot]);

  const combined  = ticks.map(t => t.ce + t.pe);
  const curr      = combined[combined.length - 1] ?? 0;
  const vwapArr   = calcVwap(ticks);
  const vwapCurr  = vwapArr[vwapArr.length - 1] ?? 0;
  const vsVwap    = +(curr - vwapCurr).toFixed(1);
  // For short: negative vsVwap = premium decayed = profit (green)
  // For long:  positive vsVwap = premium expanded = profit (green)
  const vsVwapFav = direction === "short" ? vsVwap <= 0 : vsVwap >= 0;
  const lastTick = ticks[ticks.length - 1];
  const pcr  = lastTick ? (lastTick.peoi / (lastTick.ceoi || 1)).toFixed(2) : "-";
  const strikes = [...new Set(chain?.map(r => r.strike) ?? [])].sort((a, b) => a - b);
  const toggleO = key => setOverlays(o => ({ ...o, [key]: !o[key] }));

  return (
    <div>
      {/* Market Regime Panel */}
      <RegimePanel pcrHistory={pcrHistory} />

      <div className="flex gap-2 mb-3 items-center">
        {["straddle", "strangle"].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 text-sm rounded-md border capitalize transition-colors ${mode === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
            {m}
          </button>
        ))}
        <div className="flex ml-2 rounded-md border border-gray-300 overflow-hidden text-xs">
          {["short", "long"].map(d => (
            <button key={d} onClick={() => setDirection(d)}
              className={`px-3 py-1.5 capitalize transition-colors ${direction === d
                ? d === "short" ? "bg-red-500 text-white" : "bg-green-500 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mb-3 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">CE Strike</span>
          <select value={strikeC} onChange={e => setStrikeC(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 bg-white text-sm focus:outline-none focus:border-blue-400">
            {strikes.map(s => <option key={s} value={s}>{s}{s === atmStrike ? " (ATM)" : ""}</option>)}
          </select>
        </div>
        {mode === "strangle" && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">PE Strike</span>
            <select value={strikeP} onChange={e => setStrikeP(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 bg-white text-sm focus:outline-none focus:border-blue-400">
              {strikes.map(s => <option key={s} value={s}>{s}{s === atmStrike ? " (ATM)" : ""}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatCard label="Combined"  value={curr.toFixed(1)} />
        <StatCard label="VWAP"      value={vwapCurr.toFixed(1)} color="text-amber-600" />
        <StatCard label={`vs VWAP (${direction === "short" ? "Short" : "Long"})`}
          value={(vsVwap >= 0 ? "+" : "") + vsVwap}
          color={vsVwapFav ? "text-green-600" : "text-red-500"} />
        <StatCard label="PCR"       value={pcr} color={Number(pcr) > 1 ? "text-green-600" : "text-red-500"} />
      </div>

      <div className="flex gap-2 flex-wrap mb-2">
        {[{ key: "vwap", label: "VWAP", c: "bg-amber-400" }, { key: "theta", label: "Theta", c: "bg-pink-400" }, { key: "be", label: "Breakeven", c: "bg-green-400" }].map(({ key, label, c }) => (
          <button key={key} onClick={() => toggleO(key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-colors ${overlays[key] ? "border-gray-300 bg-white" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
            <span className={`w-2 h-2 rounded-sm ${overlays[key] ? c : "bg-gray-300"}`} />{label}
          </button>
        ))}
      </div>

      <div style={{ position: "relative", height: "260px" }}>
        {ticks.length < 2
          ? <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Needs at least 2 data points — data refreshes every 5 min
            </div>
          : <canvas ref={chartRef} />
        }
      </div>

      {ticks.length > 0 && (
        <div className="mt-3 overflow-auto max-h-48">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-1 px-2">Time</th>
                <th className="text-right py-1 px-2">CE</th>
                <th className="text-right py-1 px-2">PE</th>
                <th className="text-right py-1 px-2">Combined</th>
                <th className="text-right py-1 px-2">VWAP</th>
                <th className="text-right py-1 px-2">vs VWAP</th>

              </tr>
            </thead>
            <tbody>
              {ticks.map((t, i) => {
                const comb = +(t.ce + t.pe).toFixed(1);
                const vw   = +vwapArr[i].toFixed(1);
                const diff = +(comb - vw).toFixed(1);
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1 px-2 text-gray-500">{t.time}</td>
                    <td className="text-right py-1 px-2 text-blue-600">{t.ce}</td>
                    <td className="text-right py-1 px-2 text-pink-600">{t.pe}</td>
                    <td className="text-right py-1 px-2 font-medium">{comb}</td>
                    <td className="text-right py-1 px-2 text-amber-600">{vw}</td>
                    <td className={`text-right py-1 px-2 ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : ""}`}>{diff > 0 ? "+" : ""}{diff}</td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
