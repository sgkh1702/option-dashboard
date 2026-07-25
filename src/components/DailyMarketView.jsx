import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);
import { useMarketViewData } from "../hooks/useMarketViewData";

function pickCols(rows, indices) {
  if (!rows) return rows;
  return rows.map(row => indices.map(i => row[i]));
}

function SimpleTable({ title, rows }) {
  return (
    <div className="p-3 border border-gray-200 rounded-lg overflow-x-auto">
      <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      {(!rows || rows.length === 0)
        ? <div className="text-xs text-gray-400">No data</div>
        : (
          <table className="text-xs w-full">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="py-1 pr-3 text-gray-600 whitespace-nowrap">{cell}</td>
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
    <div className="mb-6">
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">{title}</div>
      {children}
    </div>
  );
}

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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {data.map((r, i) => {
        const [name, , , pct] = r;
        return (
          <div key={i} className={`rounded-lg p-3 text-xs ${heatColor(pct)}`}>
            <div className="font-medium truncate">{name}</div>
            <div className="mt-1">{pct}%</div>
          </div>
        );
      })}
    </div>
  );
}

function SentimentStrip({ niftyPcr, bnfPcr, usdinrVixRows }) {
  const vixRow = usdinrVixRows?.[1];
  const vixChange = vixRow ? parseFloat(vixRow[2]) : null;
  const vixArrow = vixChange > 0 ? "\u25B2" : vixChange < 0 ? "\u25BC" : "\u2013";
  const vixColor = vixChange > 0 ? "text-red-600" : vixChange < 0 ? "text-green-600" : "text-gray-500";

  return (
    <div className="flex gap-6 items-center p-3 border border-gray-200 rounded-lg text-sm flex-wrap">
      <div><span className="text-gray-400 text-xs">Nifty PCR</span> <span className="font-medium ml-1">{niftyPcr ?? "-"}</span></div>
      <div><span className="text-gray-400 text-xs">BankNifty PCR</span> <span className="font-medium ml-1">{bnfPcr ?? "-"}</span></div>
      <div>
        <span className="text-gray-400 text-xs">India VIX</span>
        <span className={`font-medium ml-1 ${vixColor}`}>
          {vixRow?.[1] ?? "-"} {vixArrow} {vixRow?.[2] ?? ""}
        </span>
      </div>
    </div>
  );
}

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
        scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [rows]);

  return <div style={{ position: "relative", height: "200px" }}><canvas ref={canvasRef} /></div>;
}

function ClientPositionChart({ title, rows }) {
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
        plugins: { legend: { position: "bottom", labels: { font: { size: 10 } } } },
        scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [rows]);

  return (
    <div className="p-3 border border-gray-200 rounded-lg">
      <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
      <div style={{ position: "relative", height: "180px" }}><canvas ref={canvasRef} /></div>
    </div>
  );
}

const MOVER_COLS  = [0, 1, 3];
const WEEK52_COLS = [0, 1, 3];

export default function DailyMarketView() {
  const {
    buildup, fii, fiiStats, dashboard, scanner, sentiment,
    loading, errors, lastUpdated, fetchAll,
  } = useMarketViewData();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-700">Daily Market View</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">Updated {lastUpdated.toLocaleTimeString("en-IN")}</span>
          )}
          <button onClick={fetchAll}
            className="text-xs px-3 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </div>

      {errors && errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {errors.map((e, i) => <div key={i}>{'\u26A0'} {e}</div>)}
        </div>
      )}

      {loading && !lastUpdated && <div className="text-sm text-gray-400">Loading…</div>}

      <Section title="Index Strip">
        <SimpleTable title="Nifty / BankNifty / Sensex" rows={dashboard.indexStrip} />
      </Section>

      <Section title="Sentiment">
        <SentimentStrip
          niftyPcr={sentiment.niftyPcr}
          bnfPcr={sentiment.bnfPcr}
          usdinrVixRows={dashboard.usdinrVix}
        />
      </Section>

      <Section title="Sector Heatmap">
        <SectorHeatmap rows={dashboard.sectorial} />
      </Section>

      <Section title="Indices">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SimpleTable title="Broader Indices" rows={dashboard.broaderIndices} />
          <SimpleTable title="USD/INR + India VIX" rows={dashboard.usdinrVix} />
        </div>
      </Section>

      <Section title="Global Markets">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SimpleTable title="US Markets" rows={dashboard.usMarkets} />
          <SimpleTable title="Asian Markets" rows={dashboard.asianMarkets} />
        </div>
      </Section>

      <Section title="Market Breadth">
        <SimpleTable title="Advance / Decline" rows={scanner.breadth} />
      </Section>

      <Section title="Top Gainers (by market cap)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SimpleTable title="Largecap" rows={pickCols(scanner.gainersLargecap, MOVER_COLS)} />
          <SimpleTable title="Midcap" rows={pickCols(scanner.gainersMidcap, MOVER_COLS)} />
          <SimpleTable title="Smallcap" rows={pickCols(scanner.gainersSmallcap, MOVER_COLS)} />
        </div>
      </Section>

      <Section title="Top Losers (by market cap)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SimpleTable title="Largecap" rows={pickCols(scanner.loosersLargecap, MOVER_COLS)} />
          <SimpleTable title="Midcap" rows={pickCols(scanner.loosersMidcap, MOVER_COLS)} />
          <SimpleTable title="Smallcap" rows={pickCols(scanner.loosersSmallcap, MOVER_COLS)} />
        </div>
      </Section>

      <Section title="52-Week Range">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SimpleTable title="Near 52-Week Low" rows={pickCols(scanner.near52Low, WEEK52_COLS)} />
          <SimpleTable title="Near 52-Week High" rows={pickCols(scanner.near52High, WEEK52_COLS)} />
        </div>
      </Section>

      <Section title="FII / DII Snapshot">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ClientPositionChart title="Index Futures (Client-wise)" rows={fii.participantPositions} />
          <ClientPositionChart title="Stock Futures (Client-wise)" rows={fii.stockParticipantPositions} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <SimpleTable title="FII — Index Futures (net)" rows={fii.indexFutures} />
          <SimpleTable title="FII — Stock Futures (net)" rows={fii.stockFutures} />
        </div>
        <div className="mb-4">
          <SimpleTable title="FII Derivatives Statistics" rows={fiiStats} />
        </div>
        <div className="p-3 border border-gray-200 rounded-lg">
          <div className="text-sm font-medium text-gray-700 mb-2">Historical Net FII Positions</div>
          <FiiNetChart rows={fii.historicalNet} />
        </div>
      </Section>

      <Section title="Stock OI Buildup">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SimpleTable title="Long Buildup" rows={buildup.longBuildup} />
          <SimpleTable title="Short Buildup" rows={buildup.shortBuildup} />
          <SimpleTable title="Short Covering" rows={buildup.shortCovering} />
          <SimpleTable title="Long Unwinding" rows={buildup.longUnwinding} />
        </div>
      </Section>
    </div>
  );
}