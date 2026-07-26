import { useEffect, useState } from "react";
import { useMarketViewData } from "../hooks/useMarketViewData";

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

// ── Accent palette (mirrors the mf-analyser app's card styling) ───────────
const ACCENT_BORDER = ["border-t-blue-600", "border-t-violet-600", "border-t-emerald-600", "border-t-orange-600"];
const ACCENT_DOT     = ["bg-blue-600", "bg-violet-600", "bg-emerald-600", "bg-orange-600"];
const ACCENT_TEXT    = ["text-blue-600", "text-violet-600", "text-emerald-600", "text-orange-600"];
const ACCENT_TINT    = ["bg-blue-50", "bg-blue-50", "bg-blue-50", "bg-blue-50"];

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

// Keeps the header row (index 0) in place but reverses the data rows below
// it — used for date series the sheet returns latest-first, so tables show
// oldest at top / latest at bottom.
function reverseDataKeepHeader(rows) {
  if (!rows || rows.length < 2) return rows;
  const [header, ...data] = rows;
  return [header, ...data.slice().reverse()];
}

// ── Number formatting helpers ──────────────────────────────────────────────
function isNumericCell(cell) {
  if (cell === undefined || cell === null || cell === "") return false;
  const cleaned = String(cell).replace(/,/g, "").trim();
  return /^-?\d+(\.\d+)?$/.test(cleaned);
}

// Generic cells (OI, volumes, buildup %, FII position counts, etc.): only
// normalize values that already look decimal to 1 decimal place; whole
// numbers (esp. large OI/volume counts) are left as whole numbers, keeping
// their comma grouping if the sheet already formatted them that way.
function smartFmt(cell) {
  if (!isNumericCell(cell)) return cell;
  const s = String(cell).trim();
  const cleaned = s.replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (cleaned.includes(".")) return num.toFixed(1);
  return s.includes(",") ? s : num.toLocaleString("en-IN");
}

// Price/percentage-type cells (LTP, CMP, Change, %Change, EMA): always force
// a uniform 1 decimal place, since these are inherently decimal fields.
function fmtPrice(v) {
  if (v === undefined || v === null || v === "") return "-";
  const cleaned = String(v).replace(/[,%₹\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return v;
  return num.toFixed(1);
}

// PCR keeps 2 decimals (its conventional precision) rather than the 1-decimal
// rule used everywhere else.
function fmtPcr(v) {
  if (v === undefined || v === null || v === "") return "-";
  const cleaned = String(v).replace(/[,%₹\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return v;
  return num.toFixed(2);
}

function fmtOi(v) {
  if (v === undefined || v === null || v === "") return "-";
  const cleaned = String(v).replace(/[,%₹\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return v;
  return Math.round(num).toLocaleString("en-IN");
}

function signOf(v) {
  const n = parseFloat(String(v).replace(/[,%₹\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function signClass(v) {
  const n = signOf(v);
  if (n > 0) return "text-green-700";
  if (n < 0) return "text-red-700";
  return "text-gray-600";
}

// ── Card shell ──────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  const hasBg = /\bbg-/.test(className);
  return (
    <div className={`rounded-xl shadow-sm border border-gray-200 p-3 print:p-1 ${hasBg ? "" : "bg-white"} ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return <div className="text-sm print:text-[8px] font-medium text-gray-700 mb-2 print:mb-1">{children}</div>;
}

function NoData() {
  return <div className="text-xs text-gray-400">No data</div>;
}

// Bare table renderer (no card wrapper) — first cell of each row is treated
// as a label (left-aligned); every other cell is right-aligned, and
// formatted with smartFmt. colWidths (percentages) locks column widths so
// tables placed side by side line up; colorSign colors numeric cells
// green/red by their own sign.
function DataTable({ rows, colWidths, colorSign }) {
  if (!rows || rows.length === 0) return <NoData />;
  return (
    <table className="text-xs print:text-[7px] w-full table-fixed">
      {colWidths && (
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
        </colgroup>
      )}
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-gray-100 last:border-0">
            {row.map((cell, j) => {
              const numeric = isNumericCell(cell);
              const cls = colorSign && numeric ? signClass(cell) : "text-gray-600";
              return (
                <td
                  key={j}
                  className={`py-1 print:py-0 px-1 print:px-0.5 whitespace-nowrap overflow-hidden text-ellipsis ${numeric ? "text-right" : "text-left"} ${cls}`}
                >
                  {smartFmt(cell)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Generic table card for data that doesn't need column-specific semantics
// (buildup, FII position tables, 52-week range, breadth, etc.)
function SimpleTable({ title, rows, colWidths, tint, colorSign }) {
  return (
    <Card className={`overflow-x-auto ${tint ?? ""}`}>
      {title && <CardTitle>{title}</CardTitle>}
      <DataTable rows={rows} colWidths={colWidths} colorSign={colorSign} />
    </Card>
  );
}

// Indices table (Broader/US/Asian Markets): first row is the header, and
// LTP/Change/%Change are colored green/red by the sign of Change, right-aligned.
function IndicesTable({ title, rows, tint }) {
  if (!rows || rows.length === 0) {
    return <Card className={tint ?? ""}>{title && <CardTitle>{title}</CardTitle>}<NoData /></Card>;
  }
  const [header, ...data] = rows;
  return (
    <Card className={`overflow-x-auto ${tint ?? ""}`}>
      {title && <CardTitle>{title}</CardTitle>}
      <table className="text-xs print:text-[7px] w-full">
        <thead>
          <tr className="border-b border-gray-200">
            {header.map((h, j) => (
              <th key={j} className={`py-1 print:py-0 px-1 print:px-0.5 font-semibold text-gray-700 whitespace-nowrap ${j === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const [name, ltp, chg, pct] = row;
            const cls = signClass(chg);
            return (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="py-1 print:py-0 px-1 print:px-0.5 text-gray-600 whitespace-nowrap text-left">{name}</td>
                <td className={`py-1 print:py-0 px-1 print:px-0.5 whitespace-nowrap text-right font-medium ${cls}`}>{fmtPrice(ltp)}</td>
                <td className={`py-1 print:py-0 px-1 print:px-0.5 whitespace-nowrap text-right ${cls}`}>{fmtPrice(chg)}</td>
                <td className={`py-1 print:py-0 px-1 print:px-0.5 whitespace-nowrap text-right ${cls}`}>{fmtPrice(pct)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// Gainers/losers table: Symbol, CMP, %Change — CMP/%Change colored by sign
// of %Change, right-aligned.
function MoversTable({ title, rows, tint }) {
  if (!rows || rows.length === 0) {
    return <Card className={tint ?? ""}>{title && <CardTitle>{title}</CardTitle>}<NoData /></Card>;
  }
  const [header, ...data] = rows;
  return (
    <Card className={`overflow-x-auto ${tint ?? ""}`}>
      {title && <CardTitle>{title}</CardTitle>}
      <table className="text-xs print:text-[7px] w-full">
        <thead>
          <tr className="border-b border-gray-200">
            {header.map((h, j) => (
              <th key={j} className={`py-1 print:py-0 px-1 print:px-0.5 font-semibold text-gray-700 whitespace-nowrap ${j === 0 ? "text-left" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const [sym, cmp, pct] = row;
            const cls = signClass(pct);
            return (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="py-1 print:py-0 px-1 print:px-0.5 text-gray-600 whitespace-nowrap text-left">{sym}</td>
                <td className={`py-1 print:py-0 px-1 print:px-0.5 whitespace-nowrap text-right font-medium ${cls}`}>{fmtPrice(cmp)}</td>
                <td className={`py-1 print:py-0 px-1 print:px-0.5 whitespace-nowrap text-right ${cls}`}>{fmtPrice(pct)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function Section({ title, accent = 0, className = "", children }) {
  return (
    <div className={`mb-6 print:mb-2 ${className}`}>
      <div className="flex items-center gap-2 mb-2 print:mb-1">
        <span className={`w-2 h-2 rounded-full ${ACCENT_DOT[accent % ACCENT_DOT.length]}`} />
        <span className="text-xs print:text-[8px] uppercase tracking-wide text-gray-500 font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Index Strip ────────────────────────────────────────────────────────────
function IndexStripItem({ label, value, change }) {
  const v = signOf(change);
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
      <span className="text-sm print:text-[8px] font-bold text-gray-800">{fmtPrice(value)}</span>
      <span className={`text-xs print:text-[7px] font-semibold ${txtClass}`}>
        {arrow} {positive ? "+" : ""}{fmtPrice(change)}
      </span>
    </div>
  );
}

// Nifty/BankNifty/Sensex spot first (each its own 3-cell row: label, value,
// change), then IndiaVIX / USDINR.
function IndexStrip({ niftySpot, bankNiftySpot, sensexSpot, usdinrVixRows }) {
  const items = [];
  const spot = (rows, fallbackLabel) => {
    const r = rows?.[0];
    if (r && r.length >= 3) items.push({ label: r[0] ?? fallbackLabel, value: r[1], change: r[2] });
  };
  spot(niftySpot, "Nifty");
  spot(bankNiftySpot, "BankNifty");
  spot(sensexSpot, "Sensex");

  const vixRow    = usdinrVixRows?.[1];
  const usdinrRow = usdinrVixRows?.[0];
  if (vixRow)    items.push({ label: "IndiaVIX", value: vixRow[1],    change: vixRow[2]    });
  if (usdinrRow) items.push({ label: "USDINR",   value: usdinrRow[1], change: usdinrRow[2] });

  if (items.length === 0) return <NoData />;
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

function IndexSentimentPanel({ label, pcr, maxOi, ema, accent = 0 }) {
  return (
    <Card className={`border-t-4 ${ACCENT_BORDER[accent % ACCENT_BORDER.length]} ${ACCENT_TINT[accent % ACCENT_TINT.length]} text-sm print:text-[8px]`}>
      <div className={`font-semibold mb-2 print:mb-1 ${ACCENT_TEXT[accent % ACCENT_TEXT.length]}`}>
        {label} — PCR: {fmtPcr(pcr)}
      </div>
      <div className="text-xs print:text-[7px] space-y-1 print:space-y-0 text-gray-700">
        <div>Max CE OI: <span className="font-medium">{maxOi?.maxCeStrike ?? "-"}</span> ({fmtOi(maxOi?.maxCeOi)})</div>
        <div>Max PE OI: <span className="font-medium">{maxOi?.maxPeStrike ?? "-"}</span> ({fmtOi(maxOi?.maxPeOi)})</div>
        <div>EMA20 (daily): <span className="font-medium">{fmtPrice(ema?.ema20)}</span></div>
        <div>EMA50 (daily): <span className="font-medium">{fmtPrice(ema?.ema50)}</span></div>
        <div>EMA200 (daily): <span className="font-medium">{fmtPrice(ema?.ema200)}</span></div>
      </div>
    </Card>
  );
}

// ── Sector Heatmap ─────────────────────────────────────────────────────────
function heatColor(pctStr) {
  const v = signOf(pctStr);
  if (isNaN(v)) return "bg-gray-50 text-gray-400";
  if (v > 1)    return "bg-green-200 text-green-900";
  if (v > 0.3)  return "bg-green-100 text-green-800";
  if (v > 0)    return "bg-green-50 text-green-700";
  if (v === 0)  return "bg-gray-50 text-gray-500";
  if (v > -0.3) return "bg-red-50 text-red-700";
  if (v > -1)   return "bg-red-100 text-red-800";
  return "bg-red-200 text-red-900";
}

// Reflowed to 2-3 columns (3-4 rows for 10 sectors) so it sits comfortably
// in a half-width column next to Sentiment.
function SectorHeatmap({ rows }) {
  const data = (rows || []).slice(1).filter(r => r[0]);
  if (data.length === 0) return <NoData />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 print:gap-1">
      {data.map((r, i) => {
        const [name, , , pct] = r;
        return (
          <div key={i} className={`rounded-lg p-3 print:p-1 text-xs print:text-[7px] ${heatColor(pct)}`}>
            <div className="font-medium truncate">{name}</div>
            <div className="mt-1 print:mt-0">{fmtPrice(pct)}%</div>
          </div>
        );
      })}
    </div>
  );
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
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .print-page-break { break-before: page; page-break-before: always; }
        }
        @page { size: A4; margin: 8mm; }
      `}</style>

      {lastUpdated && (
        <div className="hidden print:block text-xs text-gray-500 mb-2">
          Report generated: {lastUpdated.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}
        </div>
      )}

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

      <Section title="Index Strip" accent={0}>
        <IndexStrip
          niftySpot={dashboard.niftySpot}
          bankNiftySpot={dashboard.bankNiftySpot}
          sensexSpot={dashboard.sensexSpot}
          usdinrVixRows={dashboard.usdinrVix}
        />
      </Section>

      <Section title="Indices" accent={1}>
        <div className="grid grid-cols-1 md:grid-cols-4 print:grid-cols-4 gap-4 print:gap-1">
          <IndicesTable title="Broader Indices" rows={dashboard.broaderIndices} tint={ACCENT_TINT[0]} />
          <IndicesTable title="US Markets" rows={dashboard.usMarkets} tint={ACCENT_TINT[1]} />
          <IndicesTable title="Asian Markets" rows={dashboard.asianMarkets} tint={ACCENT_TINT[2]} />
          <SimpleTable title="Advance / Decline" rows={scanner.breadth} tint={ACCENT_TINT[3]} />
        </div>
      </Section>

      <Section title="Sentiment & Sector Heatmap" accent={2}>
        <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-4 print:gap-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-4 print:gap-1">
            <IndexSentimentPanel label="Nifty" pcr={sentiment.niftyPcr} maxOi={maxOi.nifty} ema={dailyEma.NIFTY} accent={0} />
            <IndexSentimentPanel label="BankNifty" pcr={sentiment.bnfPcr} maxOi={maxOi.bankNifty} ema={dailyEma.BANKNIFTY} accent={1} />
          </div>
          <SectorHeatmap rows={dashboard.sectorial} />
        </div>
      </Section>

      <Section title="Top Gainers / Top Losers (by market cap)" accent={3}>
        <div className="grid grid-cols-1 xl:grid-cols-2 print:grid-cols-2 gap-6 print:gap-1">
          <div>
            <div className="text-xs print:text-[7px] uppercase tracking-wide text-gray-400 mb-2 print:mb-1">Top Gainers</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-4 print:gap-1">
              <MoversTable title="Largecap" rows={pickCols(scanner.gainersLargecap, MOVER_COLS)} tint={ACCENT_TINT[0]} />
              <MoversTable title="Midcap" rows={pickCols(scanner.gainersMidcap, MOVER_COLS)} tint={ACCENT_TINT[1]} />
              <MoversTable title="Smallcap" rows={pickCols(scanner.gainersSmallcap, MOVER_COLS)} tint={ACCENT_TINT[2]} />
            </div>
          </div>
          <div>
            <div className="text-xs print:text-[7px] uppercase tracking-wide text-gray-400 mb-2 print:mb-1">Top Losers</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-4 print:gap-1">
              <MoversTable title="Largecap" rows={pickCols(scanner.loosersLargecap, MOVER_COLS)} tint={ACCENT_TINT[3]} />
              <MoversTable title="Midcap" rows={pickCols(scanner.loosersMidcap, MOVER_COLS)} tint={ACCENT_TINT[0]} />
              <MoversTable title="Smallcap" rows={pickCols(scanner.loosersSmallcap, MOVER_COLS)} tint={ACCENT_TINT[1]} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="52-Week Range & Stock OI Buildup" accent={0}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6 gap-4 print:gap-1">
          <SimpleTable title="Near 52-Week Low" rows={trimBlanks(pickCols(scanner.near52Low, WEEK52_COLS))} colWidths={[50, 25, 25]} tint={ACCENT_TINT[0]} />
          <SimpleTable title="Near 52-Week High" rows={trimBlanks(pickCols(scanner.near52High, WEEK52_COLS))} colWidths={[50, 25, 25]} tint={ACCENT_TINT[1]} />
          <SimpleTable title="Long Buildup" rows={buildup.longBuildup} colWidths={[65, 35]} tint={ACCENT_TINT[2]} colorSign />
          <SimpleTable title="Short Buildup" rows={buildup.shortBuildup} colWidths={[65, 35]} tint={ACCENT_TINT[3]} colorSign />
          <SimpleTable title="Short Covering" rows={buildup.shortCovering} colWidths={[65, 35]} tint={ACCENT_TINT[0]} colorSign />
          <SimpleTable title="Long Unwinding" rows={buildup.longUnwinding} colWidths={[65, 35]} tint={ACCENT_TINT[1]} colorSign />
        </div>
      </Section>

      <Section title="FII / DII Snapshot" accent={1} className="print-page-break">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4 print:gap-1 mb-4 print:mb-1">
          <Card className={ACCENT_TINT[0]}>
            <CardTitle>Index Futures (Client-wise)</CardTitle>
            <div className="mt-2 print:mt-0">
              <DataTable rows={pickCols(fii.participantPositions, PARTICIPANT_TABLE_COLS)} colorSign />
            </div>
          </Card>
          <Card className={ACCENT_TINT[1]}>
            <CardTitle>Stock Futures (Client-wise)</CardTitle>
            <div className="mt-2 print:mt-0">
              <DataTable rows={pickCols(fii.stockParticipantPositions, PARTICIPANT_TABLE_COLS)} colorSign />
            </div>
          </Card>
          <Card className={`${ACCENT_TINT[2]} overflow-x-auto`}>
            <CardTitle>Historical Net FII Positions</CardTitle>
            <div className="mt-2 print:mt-0 overflow-x-auto">
              <DataTable rows={reverseDataKeepHeader(fii.historicalNet)} colorSign />
            </div>
          </Card>
          <Card className={ACCENT_TINT[3]}>
            <CardTitle>FII Statistics</CardTitle>
            <DataTable rows={fiiStats} colorSign />
            <div className="text-sm print:text-[8px] font-medium text-gray-700 mt-3 print:mt-1 mb-2 print:mb-1">Nifty/BankNifty Net</div>
            <DataTable rows={reverseDataKeepHeader(fii.niftyBankNet)} colorSign />
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4 print:gap-1">
          <SimpleTable title="Index Futures Position" rows={fii.indexFutures} tint={ACCENT_TINT[0]} colorSign />
          <SimpleTable title="Stock Futures Position" rows={fii.stockFutures} tint={ACCENT_TINT[1]} colorSign />
        </div>
      </Section>
    </div>
  );
}