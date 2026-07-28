import { useEffect, useRef, useMemo, useState } from "react";
import { Chart, registerables } from "chart.js";
import { parseRow } from "../utils/gsheets";
Chart.register(...registerables);

const CE_COLOR     = "#378ADD";
const PE_COLOR     = "#D4537E";
const CE_LTP_COLOR = "#60a5fa";   // light blue — CE LTP secondary axis
const PE_LTP_COLOR = "#f472b6";   // light pink — PE LTP secondary axis

// Column indices in raw BNFData/NFData sheet rows (A=0)
const ATM_COLS = {
  time:      0,
  ce_oi_chg: 2,
  pe_oi_chg: 12,
  ce_oi:     3,
  pe_oi:     11,
  ce_iv:     4,
  pe_iv:     10,
  pcr:       14,
  ce_ltp:    6,   // col G
  pe_ltp:    8,   // col I (LTP2)
};

function mkDs(label, data, color, yAxisID = "y", extra = {}) {
  return {
    label, data, borderColor: color, borderWidth: 2,
    pointRadius: 0, pointHoverRadius: 4,
    tension: 0.3, fill: false,
    yAxisID,
    ...extra,
  };
}

function mkLtpDs(label, data, color) {
  return mkDs(label, data, color, "y2", {
    borderDash: [4, 3],
    borderWidth: 1.5,
  });
}

function baseOptions(showLtp) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => {
            if (ctx.dataset.yAxisID === "y2")
              return `${ctx.dataset.label}: ₹${ctx.parsed.y.toFixed(1)}`;
            return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}K`;
          },
          afterBody: items => {
            const ce = items.find(i => i.dataset.label === "CE ΔOI")?.parsed.y ?? null;
            const pe = items.find(i => i.dataset.label === "PE ΔOI")?.parsed.y ?? null;
            if (ce !== null && pe !== null) {
              const mx = Math.max(Math.abs(ce), Math.abs(pe));
              if (mx > 0 && Math.abs(ce - pe) < mx * 0.1)
                return ["⚡ Crossover — possible reversal"];
            }
            return [];
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { font: { size: 8 }, autoSkip: true, maxTicksLimit: 8, maxRotation: 45, minRotation: 45 },
        grid:  { color: "rgba(0,0,0,0.04)" },
      },
      y: {
        position: "left",
        ticks: { font: { size: 8 }, callback: v => v + "K" },
        title: { display: false },
        grid:  { color: "rgba(0,0,0,0.04)" },
      },
      y2: {
        display: showLtp,
        position: "right",
        ticks: { font: { size: 8 }, callback: v => "₹" + v },
        title: { display: false },
        grid:  { drawOnChartArea: false },
      },
    },
  };
}

function LineChart({ canvasRef, labels, datasets, showLtp }) {
  const inst = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !labels?.length) return;
    if (inst.current) inst.current.destroy();
    inst.current = new Chart(canvasRef.current, {
      type: "line",
      data: { labels, datasets },
      options: baseOptions(showLtp),
    });
    return () => inst.current?.destroy();
  }, [labels, datasets, showLtp]);
  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

function DataTable({ rows }) {
  const rev  = useMemo(() => [...(rows ?? [])].reverse(), [rows]);
  const fmtK = v => v == null ? "-" : (Number(v) / 1000).toFixed(1) + "K";
  const fmtP = v => v == null ? "-" : "₹" + Number(v).toFixed(1);

  if (!rev.length) return (
    <div className="flex items-center justify-center text-gray-400 text-[10px] p-3" style={{ width: 240 }}>
      No data for this strike.
    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden border-l border-gray-200" style={{ width: 300, minWidth: 300 }}>
      <div className="overflow-y-auto flex-1">
        <table className="w-full tabular-nums" style={{ fontSize: "11px" }}>
          <thead className="sticky top-0 bg-gray-800 text-gray-200">
            <tr>
              <th className="text-left px-2 py-2">Time</th>
              <th className="text-right px-2 py-2" style={{ color: "#93c5fd" }}>CE ΔOI</th>
              <th className="text-right px-2 py-2" style={{ color: "#f9a8d4" }}>PE ΔOI</th>
              <th className="text-right px-2 py-2" style={{ color: "#6ee7b7" }}>Diff</th>
              <th className="text-right px-2 py-2" style={{ color: CE_LTP_COLOR }}>CE₹</th>
              <th className="text-right px-2 py-2" style={{ color: PE_LTP_COLOR }}>PE₹</th>
            </tr>
          </thead>
          <tbody>
            {rev.map((r, i) => {
              const diff = (Number(r.pe_oi_chg) || 0) - (Number(r.ce_oi_chg) || 0);
              return (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1.5 text-gray-500">{r.time}</td>
                  <td className="px-2 py-1.5 text-right font-medium"
                    style={{ color: r.ce_oi_chg > 0 ? "#15803d" : "#dc2626" }}>
                    {fmtK(r.ce_oi_chg)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium"
                    style={{ color: r.pe_oi_chg > 0 ? "#15803d" : "#dc2626" }}>
                    {fmtK(r.pe_oi_chg)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium"
                    style={{ color: diff > 0 ? "#15803d" : "#dc2626" }}>
                    {fmtK(diff)}
                  </td>
                  <td className="px-2 py-1.5 text-right" style={{ color: CE_LTP_COLOR }}>
                    {fmtP(r.ce_ltp)}
                  </td>
                  <td className="px-2 py-1.5 text-right" style={{ color: PE_LTP_COLOR }}>
                    {fmtP(r.pe_ltp)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Single chart section with strike dropdown ──────────────────────────────
// NOTE: rawRows arrives already filtered by selectedExpiry upstream in
// useSheetData.js (which uses the correct expiry column index, NF_EXPIRY_COL
// = 17). This component previously re-filtered by expiry using the wrong
// column index (r[15], which is CE Volume, not Expiry) — that mismatch meant
// every Nifty row got filtered out on days it ran, while Bank Nifty was
// unaffected only because it's never passed a selectedExpiry. Fixed by
// dropping the redundant re-filter and trusting the upstream filtering.
function ChartSection({ label, defaultStrike, allStrikes, rawRows, canvasRef }) {
  const [strike,  setStrike]  = useState(defaultStrike);
  const [showLtp, setShowLtp] = useState(true);

  useEffect(() => { setStrike(defaultStrike); }, [defaultStrike]);

  const rows = useMemo(() => {
    if (!rawRows?.length || !strike) return [];
    return rawRows
      .filter(r => parseFloat(r[7]) === strike)
      .map(r => parseRow(r, ATM_COLS));
  }, [rawRows, strike]);

  const labels   = useMemo(() => rows.map(r => r.time), [rows]);
  const datasets = useMemo(() => {
    const ds = [
      mkDs("CE ΔOI", rows.map(r => (r.ce_oi_chg ?? 0) / 1000), CE_COLOR, "y"),
      mkDs("PE ΔOI", rows.map(r => (r.pe_oi_chg ?? 0) / 1000), PE_COLOR, "y"),
    ];
    if (showLtp) {
      ds.push(mkLtpDs("CE LTP", rows.map(r => r.ce_ltp ?? 0), CE_LTP_COLOR));
      ds.push(mkLtpDs("PE LTP", rows.map(r => r.pe_ltp ?? 0), PE_LTP_COLOR));
    }
    return ds;
  }, [rows, showLtp]);

  const isAtm    = strike === defaultStrike;
  const labelClr = isAtm ? "#f59e0b" : "#6366f1";

  return (
    <div className="flex flex-col flex-1 border border-gray-200 rounded-lg overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 shrink-0"
           style={{ backgroundColor: "#f8fafc" }}>

        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: isAtm ? "#fef3c7" : "#ede9fe", color: labelClr }}>
          {label}
        </span>

        {/* Strike dropdown */}
        <select
          value={strike ?? ""}
          onChange={e => setStrike(Number(e.target.value))}
          className="text-[11px] font-semibold border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-700 focus:outline-none focus:border-blue-400 cursor-pointer"
        >
          {allStrikes.map(s => (
            <option key={s} value={s}>
              {s.toLocaleString("en-IN")}
              {s === defaultStrike ? " ◆" : ""}
            </option>
          ))}
        </select>

        {strike !== defaultStrike && (
          <button
            onClick={() => setStrike(defaultStrike)}
            className="text-[9px] px-1.5 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
          >
            reset
          </button>
        )}

        {/* Legend */}
        <span className="flex items-center gap-1.5 text-[9px] text-gray-500 ml-auto">
          <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: CE_COLOR }}/>CE ΔOI
          <span className="inline-block w-3 h-0.5 rounded ml-1" style={{ backgroundColor: PE_COLOR }}/>PE ΔOI
          {showLtp && <>
            <span className="inline-block w-4 border-t border-dashed ml-1" style={{ borderColor: CE_LTP_COLOR }}/>CE₹
            <span className="inline-block w-4 border-t border-dashed ml-0.5" style={{ borderColor: PE_LTP_COLOR }}/>PE₹
          </>}
        </span>

        {/* LTP toggle */}
        <button
          onClick={() => setShowLtp(v => !v)}
          className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
            showLtp
              ? "border-blue-300 text-blue-600 bg-blue-50"
              : "border-gray-300 text-gray-400 bg-white"
          }`}
          title="Toggle CE/PE LTP on chart"
        >
          LTP
        </button>

        <span className="text-[9px] text-gray-400 italic">⚡=reversal</span>
      </div>

      {/* Chart + table */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-2 overflow-hidden">
          <LineChart canvasRef={canvasRef} labels={labels} datasets={datasets} showLtp={showLtp} />
        </div>
        <DataTable rows={rows} />
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function OIChart({ rawRows, atm, step, chain, selectedExpiry }) {
  const refP1  = useRef(null);
  const refAtm = useRef(null);
  const refM1  = useRef(null);

  const allStrikes = useMemo(() => {
    if (!rawRows?.length) return chain?.map(r => r.strike) ?? [];
    const seen = new Set();
    rawRows.forEach(r => {
      const s = parseFloat(r[7]);
      if (!isNaN(s)) seen.add(s);
    });
    return [...seen].sort((a, b) => a - b);
  }, [rawRows, chain]);

  const p1Strike = atm ? atm + step : null;
  const m1Strike = atm ? atm - step : null;

  if (!atm) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
      Waiting for data…
    </div>
  );

  return (
    <div className="flex flex-col gap-2" style={{ height: "calc(100vh - 195px)", minHeight: 480 }}>
      <ChartSection label="ATM+1" defaultStrike={p1Strike} allStrikes={allStrikes} rawRows={rawRows} canvasRef={refP1}  />
      <ChartSection label="ATM"   defaultStrike={atm}      allStrikes={allStrikes} rawRows={rawRows} canvasRef={refAtm} />
      <ChartSection label="ATM-1" defaultStrike={m1Strike} allStrikes={allStrikes} rawRows={rawRows} canvasRef={refM1}  />
    </div>
  );
}