import { useEffect, useRef, useMemo, useState } from "react";
import { Chart, registerables } from "chart.js";
import { parseRow } from "../utils/gsheets";
Chart.register(...registerables);

const CE_COLOR = "#378ADD";
const PE_COLOR = "#D4537E";

const ATM_COLS = {
  time:      0,
  ce_oi_chg: 2,
  pe_oi_chg: 12,
  ce_oi:     3,
  pe_oi:     11,
  ce_iv:     4,
  pe_iv:     10,
  pcr:       14,
};

function mkDs(label, data, color) {
  return { label, data, borderColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false };
}

function baseOptions() {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}K`,
          afterBody: items => {
            const ce = items.find(i => i.dataset.label?.includes("CE"))?.parsed.y ?? null;
            const pe = items.find(i => i.dataset.label?.includes("PE"))?.parsed.y ?? null;
            if (ce !== null && pe !== null) {
              const mx = Math.max(Math.abs(ce), Math.abs(pe));
              if (mx > 0 && Math.abs(ce - pe) < mx * 0.1) return ["⚡ Crossover — possible reversal"];
            }
            return [];
          },
        },
      },
    },
    scales: {
      x: { ticks: { font: { size: 8 }, autoSkip: true, maxTicksLimit: 8, maxRotation: 45, minRotation: 45 }, grid: { color: "rgba(0,0,0,0.04)" } },
      y: { ticks: { font: { size: 8 }, callback: v => v + "K" }, title: { display: false }, grid: { color: "rgba(0,0,0,0.04)" } },
    },
  };
}

function LineChart({ canvasRef, labels, datasets }) {
  const inst = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !labels?.length) return;
    if (inst.current) inst.current.destroy();
    inst.current = new Chart(canvasRef.current, { type: "line", data: { labels, datasets }, options: baseOptions() });
    return () => inst.current?.destroy();
  }, [labels, datasets]);
  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

function DataTable({ rows }) {
  const rev  = useMemo(() => [...(rows ?? [])].reverse(), [rows]);
  const fmtK = v => v == null ? "-" : (Number(v) / 1000).toFixed(1) + "K";

  if (!rev.length) return (
    <div className="flex items-center justify-center text-gray-400 text-[10px] p-3" style={{ width: 220 }}>
      No data for this strike.
    </div>
  );

  return (
    <div className="flex flex-col overflow-hidden border-l border-gray-200" style={{ width: 220, minWidth: 220 }}>
      <div className="overflow-y-auto flex-1">
        <table className="w-full tabular-nums" style={{ fontSize: "10px" }}>
          <thead className="sticky top-0 bg-gray-800 text-gray-200">
            <tr>
              <th className="text-left px-1.5 py-1.5">Time</th>
              <th className="text-right px-1.5 py-1.5" style={{ color: "#93c5fd" }}>CE ΔOI</th>
              <th className="text-right px-1.5 py-1.5" style={{ color: "#f9a8d4" }}>PE ΔOI</th>
              <th className="text-right px-1.5 py-1.5" style={{ color: "#6ee7b7" }}>Diff</th>
            </tr>
          </thead>
          <tbody>
            {rev.map((r, i) => {
              const diff = (Number(r.pe_oi_chg) || 0) - (Number(r.ce_oi_chg) || 0);
              return (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-1.5 py-1 text-gray-500">{r.time}</td>
                  <td className="px-1.5 py-1 text-right font-medium" style={{ color: r.ce_oi_chg > 0 ? "#15803d" : "#dc2626" }}>{fmtK(r.ce_oi_chg)}</td>
                  <td className="px-1.5 py-1 text-right font-medium" style={{ color: r.pe_oi_chg > 0 ? "#15803d" : "#dc2626" }}>{fmtK(r.pe_oi_chg)}</td>
                  <td className="px-1.5 py-1 text-right font-medium" style={{ color: diff > 0 ? "#15803d" : "#dc2626" }}>{fmtK(diff)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Single chart section with strike dropdown ────────────────────────────────
function ChartSection({ label, defaultStrike, allStrikes, rawRows, canvasRef }) {
  const [strike, setStrike] = useState(defaultStrike);

  // When parent recalculates ATM (index change / refresh), reset to new default
  useEffect(() => {
    setStrike(defaultStrike);
  }, [defaultStrike]);

  // Filter rawRows for selected strike
  const rows = useMemo(() => {
    if (!rawRows?.length || !strike) return [];
    return rawRows
      .filter(r => parseFloat(r[7]) === strike)
      .map(r => parseRow(r, ATM_COLS));
  }, [rawRows, strike]);

  const labels   = useMemo(() => rows.map(r => r.time), [rows]);
  const datasets = useMemo(() => [
    mkDs("CE ΔOI", rows.map(r => (r.ce_oi_chg ?? 0) / 1000), CE_COLOR),
    mkDs("PE ΔOI", rows.map(r => (r.pe_oi_chg ?? 0) / 1000), PE_COLOR),
  ], [rows]);

  const isAtm    = strike === defaultStrike;
  const labelClr = isAtm ? "#f59e0b" : "#6366f1";

  return (
    <div className="flex flex-col flex-1 border border-gray-200 rounded-lg overflow-hidden">
      {/* Title bar with strike dropdown */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 shrink-0"
           style={{ backgroundColor: "#f8fafc" }}>

        {/* Section label (ATM+1 / ATM / ATM-1) */}
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

        {/* Reset to default */}
        {strike !== defaultStrike && (
          <button
            onClick={() => setStrike(defaultStrike)}
            className="text-[9px] px-1.5 py-0.5 rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
          >
            reset
          </button>
        )}

        <span className="flex items-center gap-1 text-[9px] text-gray-500 ml-auto">
          <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: CE_COLOR }}/>CE ΔOI
          <span className="inline-block w-3 h-0.5 rounded ml-1.5" style={{ backgroundColor: PE_COLOR }}/>PE ΔOI
        </span>
        <span className="text-[9px] text-gray-400 italic">⚡=reversal</span>
      </div>

      {/* Chart + table */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-2 overflow-hidden">
          <LineChart canvasRef={canvasRef} labels={labels} datasets={datasets} />
        </div>
        <DataTable rows={rows} />
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function OIChart({ rawRows, atm, step, chain }) {
  const refP1  = useRef(null);
  const refAtm = useRef(null);
  const refM1  = useRef(null);

  // All available strikes from today's chain data (for the dropdowns)
  const allStrikes = useMemo(() => {
    if (!rawRows?.length) return chain?.map(r => r.strike) ?? [];
    const seen = new Set();
    rawRows.forEach(r => {
      const s = parseFloat(r[7]);
      if (!isNaN(s)) seen.add(s);
    });
    return [...seen].sort((a, b) => a - b);
  }, [rawRows, chain]);

  const p1Strike  = atm ? atm + step : null;
  const m1Strike  = atm ? atm - step : null;

  if (!atm) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
      Waiting for data…
    </div>
  );

  return (
    <div className="flex flex-col gap-2" style={{ height: "calc(100vh - 195px)", minHeight: 480 }}>
      <ChartSection label="ATM+1" defaultStrike={p1Strike}  allStrikes={allStrikes} rawRows={rawRows} canvasRef={refP1}  />
      <ChartSection label="ATM"   defaultStrike={atm}        allStrikes={allStrikes} rawRows={rawRows} canvasRef={refAtm} />
      <ChartSection label="ATM−1" defaultStrike={m1Strike}  allStrikes={allStrikes} rawRows={rawRows} canvasRef={refM1}  />
    </div>
  );
}