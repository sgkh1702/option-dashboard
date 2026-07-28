import { useState, useCallback } from "react";
import { fetchRanges, parseRow } from "../utils/gsheets";
import { MARKET_VIEW_SHEET_ID, MARKET_VIEW_RANGES, SHEETS, RAW_COLS } from "../config/sheets";

const NF_EXPIRY_COL = 17;

// Computes Max CE OI / Max PE OI strike for the nearest expiry from already-
// fetched raw rows (NFData / BNFData), reusing the same layout useSheetData.js
// parses elsewhere. `rows` here already has the header row stripped.
function computeMaxOiFromRows(rows, isNiftyFlag) {
  let filtered = (rows || []).filter(r => r[7] && r[0]);

  if (isNiftyFlag) {
    const expiries = [...new Set(filtered.map(r => r[NF_EXPIRY_COL]).filter(Boolean))];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const future = expiries.filter(e => new Date(e) >= today).sort();
    const nearest = future[0] ?? expiries.sort().slice(-1)[0];
    if (nearest) filtered = filtered.filter(r => r[NF_EXPIRY_COL] === nearest);
  }

  const parsed = filtered.map(r => parseRow(r, RAW_COLS));
  const byStrike = {};
  parsed.forEach(r => { if (r.strike) byStrike[r.strike] = r; });
  const strikes = Object.values(byStrike);
  if (!strikes.length) return null;

  const maxCe = strikes.reduce((b, r) => (r.ce_oi ?? 0) > (b.ce_oi ?? 0) ? r : b, strikes[0]);
  const maxPe = strikes.reduce((b, r) => (r.pe_oi ?? 0) > (b.pe_oi ?? 0) ? r : b, strikes[0]);
  return { maxCeStrike: maxCe.strike, maxCeOi: maxCe.ce_oi, maxPeStrike: maxPe.strike, maxPeOi: maxPe.pe_oi };
}

// CorporateActions tab columns: Symbol | Company | Type | Ex-Date | Purpose/Detail | Announced Date
// (as pushed by nse_corporate_actions.py). Not numeric, so we map it directly
// rather than through parseRow (which strips to numbers).
function mapCorporateActionsRows(rows) {
  return (rows || [])
    .filter(r => r[0])
    .map(r => ({
      Symbol: r[0],
      Company: r[1],
      Type: r[2],
      "Ex-Date": r[3],
      "Purpose/Detail": r[4],
      "Announced Date": r[5],
    }));
}

export function useMarketViewData() {
  const [buildup,    setBuildup]    = useState({ longBuildup: [], shortBuildup: [], shortCovering: [], longUnwinding: [] });
  const [fii,         setFii]        = useState({
    indexFutures: [], stockFutures: [],
    participantPositions: [], stockParticipantPositions: [],
    historicalNet: [], niftyBankNet: [],
  });
  const [fiiStats,    setFiiStats]   = useState([]);
  const [dashboard,   setDashboard]  = useState({
    niftySpot: [], bankNiftySpot: [], sensexSpot: [],
    broaderIndices: [], sectorial: [], usMarkets: [], asianMarkets: [], usdinrVix: [],
  });
  const [scanner,     setScanner]    = useState({
    gainersLargecap: [], gainersMidcap: [], gainersSmallcap: [],
    loosersLargecap: [], loosersMidcap: [], loosersSmallcap: [],
    near52Low: [], near52High: [], breadth: [],
  });
  const [sentiment,   setSentiment]  = useState({ niftyPcr: null, bnfPcr: null });
  const [maxOi,       setMaxOi]      = useState({ nifty: null, bankNifty: null });
  const [corporateActions, setCorporateActions] = useState([]);
  const [loading,     setLoading]    = useState(false);
  const [errors,      setErrors]     = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const errs = [];
    const { buildup: b, fii: f, fiiStats: fs, fiiNiftyBankNet: nb, dashboard: d, scanner: s, corporateActions: ca } = MARKET_VIEW_RANGES;

    // ── Everything on the daily-processed workbook, in ONE batched request ──
    const marketViewSpecs = [
      { sheetName: b.tab, range: b.longBuildup,   skipHeader: true },
      { sheetName: b.tab, range: b.shortBuildup,  skipHeader: true },
      { sheetName: b.tab, range: b.shortCovering, skipHeader: true },
      { sheetName: b.tab, range: b.longUnwinding, skipHeader: true },
      { sheetName: f.tab, range: f.indexFutures },
      { sheetName: f.tab, range: f.stockFutures },
      { sheetName: f.tab, range: f.participantPositions },
      { sheetName: f.tab, range: f.stockParticipantPositions },
      { sheetName: f.tab, range: f.historicalNet },
      { sheetName: nb.tab, range: nb.range },
      { sheetName: fs.tab, range: fs.range },
      { sheetName: d.tab, range: d.niftySpot },
      { sheetName: d.tab, range: d.bankNiftySpot },
      { sheetName: d.tab, range: d.sensexSpot },
      { sheetName: d.tab, range: d.broaderIndices },
      { sheetName: d.tab, range: d.sectorial },
      { sheetName: d.tab, range: d.usMarkets },
      { sheetName: d.tab, range: d.asianMarkets },
      { sheetName: d.tab, range: d.usdinrVix },
      { sheetName: s.tab, range: s.gainersLargecap },
      { sheetName: s.tab, range: s.gainersMidcap },
      { sheetName: s.tab, range: s.gainersSmallcap },
      { sheetName: s.tab, range: s.loosersLargecap },
      { sheetName: s.tab, range: s.loosersMidcap },
      { sheetName: s.tab, range: s.loosersSmallcap },
      { sheetName: s.tab, range: s.near52Low },
      { sheetName: s.tab, range: s.near52High },
      { sheetName: s.tab, range: s.breadth },
      { sheetName: ca.tab, range: ca.range },  // range already starts at row 2 (A2:F200) — no header to skip
    ];

    let mv = new Array(marketViewSpecs.length).fill([]);
    try {
      mv = await fetchRanges(marketViewSpecs, { sheetId: MARKET_VIEW_SHEET_ID });
    } catch (e) {
      errs.push(`Market View sheet: ${e.message}`);
    }

    let i = 0;
    setBuildup({
      longBuildup:   mv[i++],
      shortBuildup:  mv[i++],
      shortCovering: mv[i++],
      longUnwinding: mv[i++],
    });
    setFii({
      indexFutures:              mv[i++],
      stockFutures:               mv[i++],
      participantPositions:       mv[i++],
      stockParticipantPositions:  mv[i++],
      historicalNet:              mv[i++],
      niftyBankNet:               mv[i++],
    });
    setFiiStats(mv[i++]);
    setDashboard({
      niftySpot:      mv[i++],
      bankNiftySpot:  mv[i++],
      sensexSpot:     mv[i++],
      broaderIndices: mv[i++],
      sectorial:      mv[i++],
      usMarkets:      mv[i++],
      asianMarkets:   mv[i++],
      usdinrVix:      mv[i++],
    });
    setScanner({
      gainersLargecap: mv[i++], gainersMidcap: mv[i++], gainersSmallcap: mv[i++],
      loosersLargecap: mv[i++], loosersMidcap: mv[i++], loosersSmallcap: mv[i++],
      near52Low: mv[i++], near52High: mv[i++], breadth: mv[i++],
    });
    setCorporateActions(mapCorporateActionsRows(mv[i++]));

    // ── PCR cells + raw option-chain sheets (default sheetId) — ONE more batched request ──
    const rawSpecs = [
      { sheetName: SHEETS.NIFTY.dashboard,     range: "O20:O20" },
      { sheetName: SHEETS.BANKNIFTY.dashboard, range: "O20:O20" },
      { sheetName: SHEETS.NIFTY.raw,           range: "A:R", skipHeader: true },
      { sheetName: SHEETS.BANKNIFTY.raw,       range: "A:Q", skipHeader: true },
    ];

    let raw = new Array(rawSpecs.length).fill([]);
    try {
      raw = await fetchRanges(rawSpecs);
    } catch (e) {
      errs.push(`Sentiment / Max OI: ${e.message}`);
    }

    setSentiment({
      niftyPcr: raw[0]?.[0]?.[0] ?? null,
      bnfPcr:   raw[1]?.[0]?.[0] ?? null,
    });

    try {
      setMaxOi({
        nifty:     computeMaxOiFromRows(raw[2], true),
        bankNifty: computeMaxOiFromRows(raw[3], false),
      });
    } catch (e) {
      errs.push(`Max OI: ${e.message}`);
    }

    setErrors(errs);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  return { buildup, fii, fiiStats, dashboard, scanner, sentiment, maxOi, corporateActions, loading, errors, lastUpdated, fetchAll };
}