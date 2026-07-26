import { useState, useCallback } from "react";
import { fetchRange, parseRow } from "../utils/gsheets";
import { MARKET_VIEW_SHEET_ID, MARKET_VIEW_RANGES, SHEETS, RAW_COLS } from "../config/sheets";

const opts         = { sheetId: MARKET_VIEW_SHEET_ID };
const optsNoHeader = { sheetId: MARKET_VIEW_SHEET_ID, skipHeader: false };

const NF_EXPIRY_COL = 17;

async function safeSection(errors, label, fn) {
  try {
    return await fn();
  } catch (e) {
    errors.push(`${label}: ${e.message}`);
    return null;
  }
}

// Computes Max CE OI / Max PE OI strike for the nearest expiry, reusing the
// same raw-sheet layout as useSheetData.js.
async function computeMaxOi(sheetCfg, isNiftyFlag) {
  const range = isNiftyFlag ? "A:R" : "A:Q";
  let rows = await fetchRange(sheetCfg.raw, range).then(rs => rs.filter(r => r[7] && r[0]));

  if (isNiftyFlag) {
    const expiries = [...new Set(rows.map(r => r[NF_EXPIRY_COL]).filter(Boolean))];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const future = expiries.filter(e => new Date(e) >= today).sort();
    const nearest = future[0] ?? expiries.sort().slice(-1)[0];
    if (nearest) rows = rows.filter(r => r[NF_EXPIRY_COL] === nearest);
  }

  const parsed = rows.map(r => parseRow(r, RAW_COLS));
  const byStrike = {};
  parsed.forEach(r => { if (r.strike) byStrike[r.strike] = r; });
  const strikes = Object.values(byStrike);
  if (!strikes.length) return null;

  const maxCe = strikes.reduce((b, r) => (r.ce_oi ?? 0) > (b.ce_oi ?? 0) ? r : b, strikes[0]);
  const maxPe = strikes.reduce((b, r) => (r.pe_oi ?? 0) > (b.pe_oi ?? 0) ? r : b, strikes[0]);
  return { maxCeStrike: maxCe.strike, maxCeOi: maxCe.ce_oi, maxPeStrike: maxPe.strike, maxPeOi: maxPe.pe_oi };
}

export function useMarketViewData() {
  const [buildup,    setBuildup]    = useState({ longBuildup: [], shortBuildup: [], shortCovering: [], longUnwinding: [] });
  const [fii,         setFii]        = useState({
    indexFutures: [], stockFutures: [],
    participantPositions: [], stockParticipantPositions: [],
    historicalNet: [], niftyBankNet: [],
  });
  const [fiiStats,    setFiiStats]   = useState([]);
  const [dashboard,   setDashboard]  = useState({ indexStrip: [], broaderIndices: [], sectorial: [], usMarkets: [], asianMarkets: [], usdinrVix: [] });
  const [scanner,     setScanner]    = useState({
    gainersLargecap: [], gainersMidcap: [], gainersSmallcap: [],
    loosersLargecap: [], loosersMidcap: [], loosersSmallcap: [],
    near52Low: [], near52High: [], breadth: [],
  });
  const [sentiment,   setSentiment]  = useState({ niftyPcr: null, bnfPcr: null });
  const [maxOi,       setMaxOi]      = useState({ nifty: null, bankNifty: null });
  const [loading,     setLoading]    = useState(false);
  const [errors,      setErrors]     = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const errs = [];
    const { buildup: b, fii: f, fiiStats: fs, fiiNiftyBankNet: nb, dashboard: d, scanner: s } = MARKET_VIEW_RANGES;

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
      const [indexFutures, stockFutures, participantPositions, stockParticipantPositions, historicalNet, niftyBankNet] = await Promise.all([
        fetchRange(f.tab, f.indexFutures, optsNoHeader),
        fetchRange(f.tab, f.stockFutures, optsNoHeader),
        fetchRange(f.tab, f.participantPositions, optsNoHeader),
        fetchRange(f.tab, f.stockParticipantPositions, optsNoHeader),
        fetchRange(f.tab, f.historicalNet, optsNoHeader),
        fetchRange(nb.tab, nb.range, optsNoHeader),
      ]);
      return { indexFutures, stockFutures, participantPositions, stockParticipantPositions, historicalNet, niftyBankNet };
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

    // PCR: single cell O20 on Nifty2 / Banknifty2 tabs (original sheet, default sheetId)
    const sentimentResult = await safeSection(errs, "Sentiment (PCR)", async () => {
      const [niftyRows, bnfRows] = await Promise.all([
        fetchRange(SHEETS.NIFTY.dashboard, "O20:O20", { skipHeader: false }),
        fetchRange(SHEETS.BANKNIFTY.dashboard, "O20:O20", { skipHeader: false }),
      ]);
      const niftyPcr = niftyRows?.[0]?.[0] ?? null;
      const bnfPcr   = bnfRows?.[0]?.[0] ?? null;
      return { niftyPcr, bnfPcr };
    });
    if (sentimentResult) setSentiment(sentimentResult);

    const maxOiResult = await safeSection(errs, "Max OI", async () => {
      const [nifty, bankNifty] = await Promise.all([
        computeMaxOi(SHEETS.NIFTY, true),
        computeMaxOi(SHEETS.BANKNIFTY, false),
      ]);
      return { nifty, bankNifty };
    });
    if (maxOiResult) setMaxOi(maxOiResult);

    setErrors(errs);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  return { buildup, fii, fiiStats, dashboard, scanner, sentiment, maxOi, loading, errors, lastUpdated, fetchAll };
}