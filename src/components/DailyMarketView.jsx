import { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);
import { useMarketViewData } from "../hooks/useMarketViewData";

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

function pickCols(rows, indices) {
  if (!rows) return rows;
  return rows.map(row => indices.map(i => row[i]));
}

// Drops rows whose first cell is blank -- used for lists with a variable
// number of entries (e.g. up to 15 stocks for 52-week range) so short lists
// don't leave a wall of empty rows.
function trimBlanks(rows) {
  if (!rows) return rows;
  return rows.filter((r, i) => i === 0 || (r[0] && String(r[0]).trim() !== ""));
}

function SimpleTable({ title, rows }) {
  return (
    <div className="p-3 print:p-1 border border-gray-200 rounded-lg overflow-x-auto">
      {title && <div className="text-sm print:text-[8px] font-medium text-gray-700 mb-2 print:mb-1">{title}</div>}
      {(!rows || rows.length === 0)
        ? <div className="text-xs text-gray-400">No data</div>
        : (
          <table className="text-xs print:text-[7px] w-full">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="py-1 print:py-0 pr-3 print:pr-1 text-gray-600 whitespace-nowrap">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6 print:mb-2">
      <div className="text-xs print:text-[8px] uppercase tracking-wide text-gray-400 mb-2 print:mb-1">{title}</div>
      {children}
    </div>
  );
}

// ── Index Strip ────────────────────────────────────────────────────────────
function IndexStripItem({ label, value, change }) {
  const v = parseFloat(change);
  const positive = v > 0;
  const negative = v < 0;
  const cardClass = positive
    ? "bg-green-50 border-green-200"
    : negative
      ? "bg-red-50 border-red-200"
      : "bg-gray-50 border-gray-200";
  const txtClass = positive ? "text-green-700" : negative ? "text-red-700" : "text-gray-500";
  const arrow = positive ? "\u25B2" : negative ? "\u25BC" : "\u2013";

  return (
    <div className={`flex items-center gap-2 px-3 py-2 print:px-1 print:py-0.5 rounded-lg border ${cardClass}`}>
      <span className="text-xs print:text-[7px] text-gray-500">{label}</span>
      <span className="text-sm print:text-[8px] font-bold text-gray-800">{value}</span>
      <span className={`text-xs print:text-[7px] font-semibold ${txtClass}`}>
        {arrow} {positive ? "+" : ""}{change}
      </span>
    </div>
  );
}

function IndexStrip({ indexStripRow, usdinrVixRows }) {
  const items = [];
  const r = indexStripRow || [];
  if (r.length > 2)  items.push({ label: r[0]  ?? "Nifty",     value: r[1],  change: r[2]  });
  if (r.length > 7)  items.push({ label: r[5]  ?? "BankNifty", value: r[6],  change: r[7]  });
  if (r.length > 12) items.push({ label: r[10] ?? "Sensex",    value: r[11], change: r[12] });

  const vixRow    = usdinrVixRows?.[1];
  const usdinrRow = usdinrVixRows?.[0];
  if (vixRow)    items.push({ label: "IndiaVIX", value: vixRow[1],    change: vixRow[2]    });
  if (usdinrRow) items.push({ label: "USDINR",   value: usdinrRow[1], change: usdinrRow[2] });

  if (items.length === 0) return <div className="text-xs text-gray-400">No data</div>;
  return (
    <div className="flex flex-wrap gap-3 print:gap-1">
      {items.map((it, i) => <IndexStripItem key={i} {...it} />)}
    </div>
  );
}

// ── Combined Sentiment + Max OI + Daily EMA panel per index ────────────────
function useDailyEma() {
  const [trend, setTrend] = useState({ NIFTY: null, BANKNIFTY: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ["NIFTY", "BANKNIFTY"].map(sym =>
        fetch(`${PROXY}/daily-ema?symbol=${sym}`).then(r => r.json()).catch(() => null)
      )
    ).then(([nifty, banknifty]) => {
      if (!cancelled) setTrend({ NIFTY: nifty, BANKNIFTY: banknifty });
    });
    return () => { cancelled = true; };
  }, []);

  return trend;
}

function IndexSentimentPanel({ label, pcr, maxOi, ema }) {
  const fmtOi  = (v) => (v == null ? "-" : Number(v).toLocaleString("en-IN"));
  const fmtEma = (v) => (v == null ? "-" : Number(v).toFixed(1));
  return (
    <div className="border border-gray-200 rounded-lg p-3 print:p-1 text-sm print:text-[8px]">
      <div className="font-semibold text-gray-700 mb-2 print:mb-1">{label} — PCR: {pcr ?? "-"}</div>
      <div className="text-xs print:text-[7px] space-y-1 print:space-y-0">
        <div>Max CE OI: <span className="font-medium">{maxOi?.maxCeStrike ?? "-"}</span> ({fmtOi(maxOi?.maxCeOi)})</div>
        <div>Max PE OI: <span className="font-medium">{maxOi?.maxPeStrike ?? "-"}</span> ({fmtOi(maxOi?.maxPeOi)})</div>
        <div>EMA20 (daily): <span className="font-medium">{fmtEma(ema?.ema20)}</span></div>
        <div>EMA50 (daily): <span className="font-medium">{fmtEma(ema?.ema50)}</span></div>
        <div>EMA200 (daily): <span className="font-medium">{fmtEma(ema?.ema200)}</span></div>
      </div>
    </div>
  );
}

// ── Sector Heatmap ─────────────────────────────────────────────────────────
function heatColor(pctStr) {
  const v = parseFloat(pctStr);
  if (isNaN(v)) return "bg-gray-50 text-gray-400";
  if (v > 1)    return "bg-green-200 text-green-900";
  if (v > 0.3)  return "bg-green-100 text-green-800";
  if (v > 0)    return "bg-green-50 text-green-700";
  if (v === 0)  return "bg-gray-50 text-gray-500";
  if (v > -0.3) return "bg-red-50 text-red-700";
  if (v > -1)   return "bg-red-100 text-red-800";
  return "bg-red-200 text-red-900";
}

function SectorHeatmap({ rows }) {
  const data = (rows || []).slice(1).filter(r => r[0]);
  if (data.length === 0) return <div className="text-xs text-gray-400">No data</div>;
  return (
    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 print:gap-1">
      {data.map((r, i) => {
        const [name, , , pct] = r;
        return (
          <div key={i} className={`rounded-lg p-3 print:p-1 text-xs print:text-[7px] ${heatColor(pct)}`}>
            <div className="font-medium truncate">{name}</div>
            <div className="mt-1 print:mt-0">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Charts (hidden on print — the tables under them carry the same data) ──
function FiiNetChart({ rows }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !rows || rows.length === 0) return;
    const data = rows.slice(1).filter(r => r[0]);
    const labels = data.map(r => r[0]);
    const net    = data.map(r => parseFloat(String(r[3]).replace(/,/g, "")) || 0);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Net FII position",
          data: net,
          borderColor: "#16a34a",
          backgroundColor: "rgba(22,163,74,0.1)",
          tension: 0.2,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [rows]);

  return <div className="relative h-40 print:hidden"><canvas ref={canvasRef} /></div>;
}

function ClientPositionChart({ rows }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !rows || rows.length === 0) return;
    const data   = rows.slice(1).filter(r => r[0]);
    const labels = data.map(r => r[0]);
    const longs  = data.map(r => parseFloat(String(r[1]).replace(/,/g, "")) || 0);
    const shorts = data.map(r => parseFloat(String(r[2]).replace(/,/g, "")) || 0);

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Long", data: longs, backgroundColor: "#2563eb" },
          { label: "Short", data: shorts, backgroundColor: "#dc2626" },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { font: { size: 9 } } } },
        scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [rows]);

  return <div className="relative h-36 print:hidden"><canvas ref={canvasRef} /></div>;
}

const MOVER_COLS  = [0, 1, 3];
const WEEK52_COLS = [0, 1, 3];
// Participant table columns as fetched: ClientType(0), Long(1), Short(2), Net(3) -> drop Net for the compact table
const PARTICIPANT_TABLE_COLS = [0, 1, 2];

export default function DailyMarketView() {
  const {
    buildup, fii, fiiStats, dashboard, scanner, sentiment, maxOi,
    loading, errors, lastUpdated, fetchAll,
  } = useMarketViewData();

  const dailyEma = useDailyEma();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div id="dmv-print-area">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #dmv-print-area, #dmv-print-area * { visibility: visible; }
          #dmv-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        @page { size: A4; margin: 8mm; }
      `}</style>

      <div className="flex items-center justify-between mb-4 print:mb-1">
        <h2 className="text-sm font-medium text-gray-700">Daily Market View</h2>
        <div className="flex items-center gap-3 no-print">
          {lastUpdated && (
            <span className="text-xs text-gray-400">Updated {lastUpdated.toLocaleTimeString("en-IN")}</span>
          )}
          <button onClick={() => window.print()}
            className="text-xs px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">
            Print (A4)
          </button>
          <button onClick={fetchAll}
            className="text-xs px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </div>

      {errors && errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 no-print">
          {errors.map((e, i) => <div key={i}>{'\u26A0'} {e}</div>)}
        </div>
      )}

      {loading && !lastUpdated && <div className="text-sm text-gray-400">Loading…</div>}

      <Section title="Index Strip">
        <IndexStrip indexStripRow={dashboard.indexStrip} usdinrVixRows={dashboard.usdinrVix} />
      </Section>

      <Section title="Indices">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:gap-1">
          <SimpleTable title="Broader Indices" rows={dashboard.broaderIndices} />
          <SimpleTable title="US Markets" rows={dashboard.usMarkets} />
          <SimpleTable title="Asian Markets" rows={dashboard.asianMarkets} />
          <SimpleTable title="Advance / Decline" rows={scanner.breadth} />
        </div>
      </Section>

      <Section title="Sentiment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-1">
          <IndexSentimentPanel label="Nifty" pcr={sentiment.niftyPcr} maxOi={maxOi.nifty} ema={dailyEma.NIFTY} />
          <IndexSentimentPanel label="BankNifty" pcr={sentiment.bnfPcr} maxOi={maxOi.bankNifty} ema={dailyEma.BANKNIFTY} />
        </div>
      </Section>

      <Section title="Sector Heatmap">
        <SectorHeatmap rows={dashboard.sectorial} />
      </Section>

      <Section title="Top Gainers (by market cap)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:gap-1">
          <SimpleTable title="Largecap" rows={pickCols(scanner.gainersLargecap, MOVER_COLS)} />
          <SimpleTable title="Midcap" rows={pickCols(scanner.gainersMidcap, MOVER_COLS)} />
          <SimpleTable title="Smallcap" rows={pickCols(scanner.gainersSmallcap, MOVER_COLS)} />
        </div>
      </Section>

      <Section title="Top Losers (by market cap)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:gap-1">
          <SimpleTable title="Largecap" rows={pickCols(scanner.loosersLargecap, MOVER_COLS)} />
          <SimpleTable title="Midcap" rows={pickCols(scanner.loosersMidcap, MOVER_COLS)} />
          <SimpleTable title="Smallcap" rows={pickCols(scanner.loosersSmallcap, MOVER_COLS)} />
        </div>
      </Section>

      <Section title="52-Week Range">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-1">
          <SimpleTable title="Near 52-Week Low" rows={trimBlanks(pickCols(scanner.near52Low, WEEK52_COLS))} />
          <SimpleTable title="Near 52-Week High" rows={trimBlanks(pickCols(scanner.near52High, WEEK52_COLS))} />
        </div>
      </Section>

      <Section title="FII / DII Snapshot">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:gap-1 mb-4 print:mb-1">
          <div className="p-3 print:p-1 border border-gray-200 rounded-lg">
            <div className="text-sm print:text-[8px] font-medium text-gray-700 mb-2 print:mb-1">Index Futures (Client-wise)</div>
            <ClientPositionChart rows={fii.participantPositions} />
            <div className="mt-2 print:mt-0">
              <SimpleTable rows={pickCols(fii.participantPositions, PARTICIPANT_TABLE_COLS)} />
            </div>
          </div>
          <div className="p-3 print:p-1 border border-gray-200 rounded-lg">
            <div className="text-sm print:text-[8px] font-medium text-gray-700 mb-2 print:mb-1">Stock Futures (Client-wise)</div>
            <ClientPositionChart rows={fii.stockParticipantPositions} />
            <div className="mt-2 print:mt-0">
              <SimpleTable rows={pickCols(fii.stockParticipantPositions, PARTICIPANT_TABLE_COLS)} />
            </div>
          </div>
          <div className="p-3 print:p-1 border border-gray-200 rounded-lg">
            <div className="text-sm print:text-[8px] font-medium text-gray-700 mb-2 print:mb-1">Historical Net FII Positions</div>
            <FiiNetChart rows={fii.historicalNet} />
            <div className="mt-2 print:mt-0">
              <SimpleTable rows={fii.historicalNet} />
            </div>
          </div>
          <div className="p-3 print:p-1 border border-gray-200 rounded-lg">
            <div className="text-sm print:text-[8px] font-medium text-gray-700 mb-2 print:mb-1">FII Statistics</div>
            <SimpleTable rows={fiiStats} />
            <div className="text-sm print:text-[8px] font-medium text-gray-700 mt-3 print:mt-1 mb-2 print:mb-1">Nifty/BankNifty Net</div>
            <SimpleTable rows={fii.niftyBankNet} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-1">
          <SimpleTable title="Index Futures Position" rows={fii.indexFutures} />
          <SimpleTable title="Stock Futures Position" rows={fii.stockFutures} />
        </div>
      </Section>

      <Section title="Stock OI Buildup">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:gap-1">
          <SimpleTable title="Long Buildup" rows={buildup.longBuildup} />
          <SimpleTable title="Short Buildup" rows={buildup.shortBuildup} />
          <SimpleTable title="Short Covering" rows={buildup.shortCovering} />
          <SimpleTable title="Long Unwinding" rows={buildup.longUnwinding} />
        </div>
      </Section>
    </div>
  );
}