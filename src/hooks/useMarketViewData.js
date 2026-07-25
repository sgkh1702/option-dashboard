import { useState, useCallback } from "react";
import { fetchRange, parseRow } from "../utils/gsheets";
import { MARKET_VIEW_SHEET_ID, MARKET_VIEW_RANGES, SHEETS, PCR_COLS } from "../config/sheets";

const opts         = { sheetId: MARKET_VIEW_SHEET_ID };
const optsNoHeader = { sheetId: MARKET_VIEW_SHEET_ID, skipHeader: false };

// Runs a section's fetches; on failure, logs the error into `errors` but doesn't
// throw — so one bad range can't blank out sections that succeeded.
async function safeSection(errors, label, fn) {
  try {
    return await fn();
  } catch (e) {
    errors.push(`${label}: ${e.message}`);
    return null;
  }
}

export function useMarketViewData() {
  const [buildup,    setBuildup]    = useState({ longBuildup: [], shortBuildup: [], shortCovering: [], longUnwinding: [] });
  const [fii,         setFii]        = useState({
    indexFutures: [], stockFutures: [],
    participantPositions: [], stockParticipantPositions: [],
    historicalNet: [],
  });
  const [fiiStats,    setFiiStats]   = useState([]);
  const [dashboard,   setDashboard]  = useState({ indexStrip: [], broaderIndices: [], sectorial: [], usMarkets: [], asianMarkets: [], usdinrVix: [] });
  const [scanner,     setScanner]    = useState({
    gainersLargecap: [], gainersMidcap: [], gainersSmallcap: [],
    loosersLargecap: [], loosersMidcap: [], loosersSmallcap: [],
    near52Low: [], near52High: [], breadth: [],
  });
  const [sentiment,   setSentiment]  = useState({ niftyPcr: null, bnfPcr: null });
  const [loading,     setLoading]    = useState(false);
  const [errors,      setErrors]     = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const errs = [];
    const { buildup: b, fii: f, fiiStats: fs, dashboard: d, scanner: s } = MARKET_VIEW_RANGES;

    const buildupResult = await safeSection(errs, "Buildup", async () => {
      const [longBuildup, shortBuildup, shortCovering, longUnwinding] = await Promise.all([
        fetchRange(b.tab, b.longBuildup, opts),
        fetchRange(b.tab, b.shortBuildup, opts),
        fetchRange(b.tab, b.shortCovering, opts),
        fetchRange(b.tab, b.longUnwinding, opts),
      ]);
      return { longBuildup, shortBuildup, shortCovering, longUnwinding };
    });
    if (buildupResult) setBuildup(buildupResult);

    const fiiResult = await safeSection(errs, "FII Data", async () => {
      const [indexFutures, stockFutures, participantPositions, stockParticipantPositions, historicalNet] = await Promise.all([
        fetchRange(f.tab, f.indexFutures, optsNoHeader),
        fetchRange(f.tab, f.stockFutures, optsNoHeader),
        fetchRange(f.tab, f.participantPositions, optsNoHeader),
        fetchRange(f.tab, f.stockParticipantPositions, optsNoHeader),
        fetchRange(f.tab, f.historicalNet, optsNoHeader),
      ]);
      return { indexFutures, stockFutures, participantPositions, stockParticipantPositions, historicalNet };
    });
    if (fiiResult) setFii(fiiResult);

    const fiiStatsResult = await safeSection(errs, "FII Stat", async () =>
      fetchRange(fs.tab, fs.range, optsNoHeader)
    );
    if (fiiStatsResult) setFiiStats(fiiStatsResult);

    const dashboardResult = await safeSection(errs, "Dashboard", async () => {
      const [indexStrip, broaderIndices, sectorial, usMarkets, asianMarkets, usdinrVix] = await Promise.all([
        fetchRange(d.tab, d.indexStrip, optsNoHeader),
        fetchRange(d.tab, d.broaderIndices, optsNoHeader),
        fetchRange(d.tab, d.sectorial, optsNoHeader),
        fetchRange(d.tab, d.usMarkets, optsNoHeader),
        fetchRange(d.tab, d.asianMarkets, optsNoHeader),
        fetchRange(d.tab, d.usdinrVix, optsNoHeader),
      ]);
      return { indexStrip, broaderIndices, sectorial, usMarkets, asianMarkets, usdinrVix };
    });
    if (dashboardResult) setDashboard(dashboardResult);

    const scannerResult = await safeSection(errs, "Scanner", async () => {
      const [
        gainersLargecap, gainersMidcap, gainersSmallcap,
        loosersLargecap, loosersMidcap, loosersSmallcap,
        near52Low, near52High, breadth,
      ] = await Promise.all([
        fetchRange(s.tab, s.gainersLargecap, optsNoHeader),
        fetchRange(s.tab, s.gainersMidcap, optsNoHeader),
        fetchRange(s.tab, s.gainersSmallcap, optsNoHeader),
        fetchRange(s.tab, s.loosersLargecap, optsNoHeader),
        fetchRange(s.tab, s.loosersMidcap, optsNoHeader),
        fetchRange(s.tab, s.loosersSmallcap, optsNoHeader),
        fetchRange(s.tab, s.near52Low, optsNoHeader),
        fetchRange(s.tab, s.near52High, optsNoHeader),
        fetchRange(s.tab, s.breadth, optsNoHeader),
      ]);
      return {
        gainersLargecap, gainersMidcap, gainersSmallcap,
        loosersLargecap, loosersMidcap, loosersSmallcap,
        near52Low, near52High, breadth,
      };
    });
    if (scannerResult) setScanner(scannerResult);

    const sentimentResult = await safeSection(errs, "Sentiment (PCR)", async () => {
      const [niftyPcrRows, bnfPcrRows] = await Promise.all([
        fetchRange(SHEETS.NIFTY.pcr, "A:H"),
        fetchRange(SHEETS.BANKNIFTY.pcr, "A:H"),
      ]);
      const niftyPcr = niftyPcrRows.length ? parseRow(niftyPcrRows[niftyPcrRows.length - 1], PCR_COLS).pcr : null;
      const bnfPcr   = bnfPcrRows.length   ? parseRow(bnfPcrRows[bnfPcrRows.length - 1], PCR_COLS).pcr   : null;
      return { niftyPcr, bnfPcr };
    });
    if (sentimentResult) setSentiment(sentimentResult);

    setErrors(errs);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  return { buildup, fii, fiiStats, dashboard, scanner, sentiment, loading, errors, lastUpdated, fetchAll };
}