import { useRef, useMemo, useEffect } from "react";
import { Chart, registerables } from "chart.js";
import { impliedVol } from "../utils/blackScholes";
import FuturesSignal from "./FuturesSignal";
Chart.register(...registerables);

const CE_COLOR  = "#378ADD";
const PE_COLOR  = "#D4537E";

const SIG = {
  SB: "bg-rose-200 text-rose-800",
  LB: "bg-green-200 text-green-800",
  SC: "bg-amber-200 text-amber-800",
  LU: "bg-purple-200 text-purple-800",
};

const SIG_DOT = { SB: "#fca5a5", LB: "#86efac", SC: "#fcd34d", LU: "#d8b4fe" };

// Same "0/null/''/undefined all mean missing" rule as GreeksPanel.jsx's cleanIv.
const cleanIv = v => (v === null || v === undefined || v === "" || Number(v) === 0) ? null : Number(v);

// Resolves a row's IV: sheet value if present, else Black-Scholes-derived from
// ltp (when spot/T are available), else null (renders as "-"). Mirrors the
// priority order used in GreeksPanel.jsx's resolveIv.
function ivFor(sheetIv, ltp, spot, K, T, type) {
  const fromSheet = cleanIv(sheetIv);
  if (fromSheet != null) return { iv: fromSheet, derived: false };
  if (!spot || !T || !(Number(ltp) > 0)) return { iv: null, derived: false };
  const derived = impliedVol(spot, K, T, Number(ltp), type);
  return derived > 0 ? { iv: derived, derived: true } : { iv: null, derived: false };
}

function mkDs(label, data, color) {
  return { label, data, borderColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false };
}

// ── Overall CE/PE ΔOI chart ──────────────────────────────────────────────────
function OverallChart({ pcrHistory }) {
  const canvasRef = useRef(null);
  const inst      = useRef(null);
  const labels    = useMemo(() => pcrHistory?.map(r => r.time) ?? [], [pcrHistory]);
  const datasets  = useMemo(() => [
    mkDs("CE ΔOI", pcrHistory?.map(r => (r.ce_oi_chg ?? 0) / 1000) ?? [], CE_COLOR),
    mkDs("PE ΔOI", pcrHistory?.map(r => (r.pe_oi_chg ?? 0) / 1000) ?? [], PE_COLOR),
  ], [pcrHistory]);

  useEffect(() => {
    if (!canvasRef.current || !labels.length) return;
    if (inst.current) inst.current.destroy();
    inst.current = new Chart(canvasRef.current, {
      type: "line",
      data: { labels, datasets },
      options: {
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
                  if (mx > 0 && Math.abs(ce - pe) < mx * 0.1) return ["⚡ Crossover"];
                }
                return [];
              },
            },
          },
        },
        scales: {
          x: { ticks: { font: { size: 8 }, autoSkip: true, maxTicksLimit: 7, maxRotation: 45, minRotation: 45 }, grid: { color: "rgba(0,0,0,0.04)" } },
          y: { ticks: { font: { size: 8 }, callback: v => v + "K" }, grid: { color: "rgba(0,0,0,0.04)" } },
        },
      },
    });
    return () => inst.current?.destroy();
  }, [labels, datasets]);

  return (
    <div className="border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-100" style={{ backgroundColor: "#f8fafc" }}>
        <span className="text-[10px] font-semibold text-gray-700">Overall CE/PE ΔOI</span>
        <span className="flex items-center gap-1 text-[9px] text-gray-500 ml-auto">
          <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: CE_COLOR }}/>CE
          <span className="inline-block w-3 h-0.5 rounded ml-1" style={{ backgroundColor: PE_COLOR }}/>PE
        </span>
        <span className="text-[9px] text-gray-400 italic">⚡=reversal</span>
      </div>
      <div className="px-2 pt-1 pb-2" style={{ height: 160 }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}

// ── PCR history table ────────────────────────────────────────────────────────
function PcrTable({ rows }) {
  const rev  = useMemo(() => [...(rows ?? [])].reverse(), [rows]);
  const fmtK = v => v == null || v === "" ? "-" : (Number(v) / 1000).toFixed(1) + "K";
  const fmt2 = v => v == null || v === "" ? "-" : Number(v).toFixed(2);

  if (!rev.length) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-[11px]">No PCR data yet.</div>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-2 py-1 border-b border-gray-100 text-[10px] font-semibold text-gray-600 shrink-0"
           style={{ backgroundColor: "#f8fafc" }}>
        PCR History <span className="text-gray-400 font-normal">(latest first)</span>
      </div>
      <div className="overflow-y-auto flex-1">
        <table className="w-full tabular-nums" style={{ fontSize: "10px" }}>
          <thead className="sticky top-0 bg-gray-800 text-gray-200">
            <tr>
              <th className="text-left px-1.5 py-1.5">Time</th>
              <th className="text-right px-1.5 py-1.5" style={{ color: "#93c5fd" }}>CE ΔOI</th>
              <th className="text-right px-1.5 py-1.5" style={{ color: "#f9a8d4" }}>PE ΔOI</th>
              <th className="text-right px-1.5 py-1.5" style={{ color: "#6ee7b7" }}>Diff</th>
              <th className="text-center px-1.5 py-1.5" style={{ color: "#fde047" }}>Sig</th>
              <th className="text-right px-1.5 py-1.5" style={{ color: "#fde047" }}>PCR</th>
            </tr>
          </thead>
          <tbody>
            {rev.map((r, i) => {
              const diff = (Number(r.pe_oi_chg) || 0) - (Number(r.ce_oi_chg) || 0);
              const sig  = r.signal ?? "";
              return (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-1.5 py-1 text-gray-500">{r.time}</td>
                  <td className="px-1.5 py-1 text-right font-medium" style={{ color: r.ce_oi_chg > 0 ? "#15803d" : "#dc2626" }}>{fmtK(r.ce_oi_chg)}</td>
                  <td className="px-1.5 py-1 text-right font-medium" style={{ color: r.pe_oi_chg > 0 ? "#15803d" : "#dc2626" }}>{fmtK(r.pe_oi_chg)}</td>
                  <td className="px-1.5 py-1 text-right font-medium" style={{ color: diff > 0 ? "#15803d" : "#dc2626" }}>{fmtK(diff)}</td>
                  <td className="px-1.5 py-1 text-center">
                    {sig ? (
                      <span className="px-1 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: SIG_DOT[sig] ?? "#e5e7eb", color: "#1f2937" }}>{sig}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-1.5 py-1 text-right font-semibold" style={{ color: r.pcr > 1 ? "#15803d" : "#dc2626" }}>{fmt2(r.pcr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Option chain table ───────────────────────────────────────────────────────
function ChainTable({ chain, atmStrike, selectedStrike, onSelectStrike, spot, dte }) {
  const fmt  = v => v == null || v === "" ? "-" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const fmtK = v => v == null || v === "" ? "-" : (Number(v) / 1000).toFixed(1) + "K";
  const T    = dte != null ? Math.max(0.001, dte / 365) : null;

  if (!chain?.length) return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">No chain data.</div>
  );

  const maxCeStrike = chain.reduce((b, r) => (r.ce_oi ?? 0) > (b.ce_oi ?? 0) ? r : b, chain[0]).strike;
  const maxPeStrike = chain.reduce((b, r) => (r.pe_oi ?? 0) > (b.pe_oi ?? 0) ? r : b, chain[0]).strike;
  // Max OI *change* — today's freshest writing, distinct from stale accumulated OI above.
  // Only considers positive buildup (ignores unwinding) since fresh writing is what forms a new wall.
  const maxCeChgStrike = chain.reduce((b, r) => (r.ce_oi_chg ?? 0) > (b.ce_oi_chg ?? 0) ? r : b, chain[0]).strike;
  const maxPeChgStrike = chain.reduce((b, r) => (r.pe_oi_chg ?? 0) > (b.pe_oi_chg ?? 0) ? r : b, chain[0]).strike;

  const ceBg = s => s === atmStrike ? "#fefce8" : s < atmStrike ? "#dcfce7" : "#fee2e2";
  const peBg = s => s === atmStrike ? "#fefce8" : s > atmStrike ? "#dcfce7" : "#fee2e2";

  const totCeOi    = chain.reduce((s, r) => s + (Number(r.ce_oi)     || 0), 0);
  const totPeOi    = chain.reduce((s, r) => s + (Number(r.pe_oi)     || 0), 0);
  const totCeOiChg = chain.reduce((s, r) => s + (Number(r.ce_oi_chg) || 0), 0);
  const totPeOiChg = chain.reduce((s, r) => s + (Number(r.pe_oi_chg) || 0), 0);
  const totCeVol   = chain.reduce((s, r) => s + (Number(r.ce_volume) || 0), 0);
  const totPeVol   = chain.reduce((s, r) => s + (Number(r.pe_volume) || 0), 0);
  const totPcr     = totCeOi ? (totPeOi / totCeOi).toFixed(2) : "-";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 border-b border-gray-200 text-[9px] text-gray-500 shrink-0"
           style={{ backgroundColor: "#f8fafc" }}>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm border border-green-400 inline-block" style={{ backgroundColor: "#dcfce7" }}/>ITM CE</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm border border-yellow-500 inline-block" style={{ backgroundColor: "#fef9c3" }}/>ATM</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm border border-red-400 inline-block" style={{ backgroundColor: "#fee2e2" }}/>OTM CE</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: "#93c5fd" }}/>Max CE</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: "#fdba74" }}/>Max PE</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block border-2" style={{ borderColor: "#1d4ed8" }}/>Max CE ΔOI</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block border-2" style={{ borderColor: "#c2410c" }}/>Max PE ΔOI</span>
        <span className="flex items-center gap-1 italic text-gray-400">~ = derived IV (Breeze has no IV feed)</span>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full tabular-nums" style={{ fontSize: "10px" }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ backgroundColor: "#1e293b", color: "#e2e8f0", fontSize: "9px" }} className="uppercase tracking-wide">
              <th className="text-center px-1 py-1.5">Sig</th>
              <th className="text-right px-1 py-1.5">CE ΔOI</th>
              <th className="text-right px-1 py-1.5">CE OI</th>
              <th className="text-right px-1 py-1.5">CE Vol</th>
              <th className="text-right px-1 py-1.5">CE IV</th>
              <th className="text-right px-1 py-1.5" style={{ color: "#93c5fd" }}>CE LTP</th>
              <th className="text-center px-1.5 py-1.5" style={{ backgroundColor: "#0f172a", color: "#fde047" }}>Strike</th>
              <th className="text-right px-1 py-1.5" style={{ color: "#f9a8d4" }}>PE LTP</th>
              <th className="text-right px-1 py-1.5">PE IV</th>
              <th className="text-right px-1 py-1.5">PE Vol</th>
              <th className="text-right px-1 py-1.5">PE OI</th>
              <th className="text-right px-1 py-1.5">PE ΔOI</th>
              <th className="text-center px-1 py-1.5">PE Sig</th>
              <th className="text-right px-1 py-1.5">PCR</th>
            </tr>
          </thead>
          <tbody>
            {chain.map(row => {
              const isATM      = row.strike === atmStrike;
              const isMaxCe    = row.strike === maxCeStrike;
              const isMaxPe    = row.strike === maxPeStrike;
              const isMaxCeChg = row.strike === maxCeChgStrike && (row.ce_oi_chg ?? 0) > 0;
              const isMaxPeChg = row.strike === maxPeChgStrike && (row.pe_oi_chg ?? 0) > 0;
              const ceIv = ivFor(row.ce_iv, row.ce_ltp, spot, row.strike, T, "call");
              const peIv = ivFor(row.pe_iv, row.pe_ltp, spot, row.strike, T, "put");
              return (
                <tr key={row.strike} onClick={() => onSelectStrike(row.strike)}
                  className="cursor-pointer border-t border-gray-100 hover:brightness-95 transition-all"
                  style={isATM ? { borderTop: "2px solid #ca8a04", borderBottom: "2px solid #ca8a04" } : {}}>
                  <td className="text-center px-1 py-1" style={{ backgroundColor: ceBg(row.strike) }}>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${SIG[row.signal] ?? "text-gray-400"}`}>{row.signal || "—"}</span>
                  </td>
                  <td className="text-right px-1 py-1 font-medium" style={{ backgroundColor: ceBg(row.strike), color: row.ce_oi_chg > 0 ? "#15803d" : "#dc2626", ...(isMaxCeChg ? { border: "2px solid #1d4ed8" } : {}) }}>{fmtK(row.ce_oi_chg)}</td>
                  <td className="text-right px-1 py-1 font-medium" style={isMaxCe ? { backgroundColor: "#93c5fd", color: "#1e3a8a" } : { backgroundColor: ceBg(row.strike), color: "#1d4ed8" }}>{fmtK(row.ce_oi)}</td>
                  <td className="text-right px-1 py-1 text-gray-500" style={{ backgroundColor: ceBg(row.strike) }}>{fmtK(row.ce_volume)}</td>
                  <td className="text-right px-1 py-1 text-gray-500" style={{ backgroundColor: ceBg(row.strike) }} title={ceIv.derived ? "Derived via Black-Scholes inversion from LTP" : undefined}>
                    {ceIv.iv == null ? "-" : `${ceIv.derived ? "~" : ""}${ceIv.iv.toFixed(1)}%`}
                  </td>
                  <td className="text-right px-1 py-1 font-semibold" style={{ backgroundColor: ceBg(row.strike), color: "#2563eb" }}>{fmt(row.ce_ltp)}</td>
                  <td className="text-center px-1.5 py-1 font-bold" style={isATM ? { backgroundColor: "#fef9c3", color: "#92400e" } : { backgroundColor: "#fff", color: "#374151" }}>
                    {row.strike.toLocaleString("en-IN")}
                    {isATM && <span className="ml-0.5 text-[7px] font-black px-0.5 rounded" style={{ backgroundColor: "#fde047", color: "#78350f" }}>ATM</span>}
                  </td>
                  <td className="text-right px-1 py-1 font-semibold" style={{ backgroundColor: peBg(row.strike), color: "#be185d" }}>{fmt(row.pe_ltp)}</td>
                  <td className="text-right px-1 py-1 text-gray-500" style={{ backgroundColor: peBg(row.strike) }} title={peIv.derived ? "Derived via Black-Scholes inversion from LTP" : undefined}>
                    {peIv.iv == null ? "-" : `${peIv.derived ? "~" : ""}${peIv.iv.toFixed(1)}%`}
                  </td>
                  <td className="text-right px-1 py-1 text-gray-500" style={{ backgroundColor: peBg(row.strike) }}>{fmtK(row.pe_volume)}</td>
                  <td className="text-right px-1 py-1 font-medium" style={isMaxPe ? { backgroundColor: "#fdba74", color: "#7c2d12" } : { backgroundColor: peBg(row.strike), color: "#9d174d" }}>{fmtK(row.pe_oi)}</td>
                  <td className="text-right px-1 py-1 font-medium" style={{ backgroundColor: peBg(row.strike), color: row.pe_oi_chg > 0 ? "#15803d" : "#dc2626", ...(isMaxPeChg ? { border: "2px solid #c2410c" } : {}) }}>{fmtK(row.pe_oi_chg)}</td>
                  <td className="text-center px-1 py-1" style={{ backgroundColor: peBg(row.strike) }}>
                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${SIG[row.pe_signal] ?? "text-gray-400"}`}>{row.pe_signal || "—"}</span>
                  </td>
                  <td className="text-right px-1 py-1 font-semibold" style={{ backgroundColor: "#fff", color: row.pcr > 1 ? "#15803d" : "#dc2626" }}>{fmt(row.pcr)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold" style={{ backgroundColor: "#f1f5f9", fontSize: "10px" }}>
              <td className="text-center px-1 py-1 text-gray-400 uppercase text-[8px]">Tot</td>
              <td className="text-right px-1 py-1" style={{ color: totCeOiChg > 0 ? "#15803d" : "#dc2626" }}>{fmtK(totCeOiChg)}</td>
              <td className="text-right px-1 py-1 text-blue-700">{fmtK(totCeOi)}</td>
              <td className="text-right px-1 py-1 text-gray-500">{fmtK(totCeVol)}</td>
              <td colSpan={2} />
              <td className="text-center px-1 py-1 text-gray-400 uppercase text-[8px]" style={{ backgroundColor: "#e2e8f0" }}>Tot</td>
              <td colSpan={2} />
              <td className="text-right px-1 py-1 text-gray-500">{fmtK(totPeVol)}</td>
              <td className="text-right px-1 py-1 text-pink-700">{fmtK(totPeOi)}</td>
              <td className="text-right px-1 py-1" style={{ color: totPeOiChg > 0 ? "#15803d" : "#dc2626" }}>{fmtK(totPeOiChg)}</td>
              <td />
              <td className="text-right px-1 py-1 font-bold" style={{ backgroundColor: "#fff", color: Number(totPcr) > 1 ? "#15803d" : "#dc2626" }}>{totPcr}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function OptionChain({
  chain, atmStrike,
  selectedStrike, onSelectStrike,
  pcrHistory,
  selectedExpiry,
  lastUpdated,
  spot, dte,
  symbol,
}) {
  if (!chain?.length) return (
    <div className="text-gray-400 text-sm p-6 text-center">
      No data yet — run the Python collector script first.
    </div>
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Status bar — sheets data + futures signal (Nifty/BankNifty only) */}
      <div className="flex items-center gap-3 px-3 py-1 bg-blue-50 border border-blue-100 rounded-lg mb-2 text-xs text-blue-600">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"/>
        Sheets data · {selectedExpiry ?? ""}
        {lastUpdated && (
          <span className="text-blue-400 ml-1">
            · updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <FuturesSignal symbol={symbol} />
      </div>

      <div className="flex gap-0 border border-gray-200 rounded-lg overflow-hidden"
           style={{ height: "calc(100vh - 220px)", minHeight: 480 }}>
        <div className="flex flex-col overflow-hidden border-r border-gray-200" style={{ flex: "0 0 60%" }}>
          <ChainTable chain={chain} atmStrike={atmStrike}
            selectedStrike={selectedStrike} onSelectStrike={onSelectStrike}
            spot={spot} dte={dte} />
        </div>
        <div className="flex flex-col overflow-hidden" style={{ flex: "0 0 40%" }}>
          <OverallChart pcrHistory={pcrHistory} />
          <PcrTable rows={pcrHistory} />
        </div>
      </div>
    </div>
  );
}