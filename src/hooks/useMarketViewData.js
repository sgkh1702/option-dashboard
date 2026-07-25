import { useState, useCallback } from "react";
import { fetchRange, parseRow } from "../utils/gsheets";
import { MARKET_VIEW_SHEET_ID, MARKET_VIEW_RANGES, SHEETS, PCR_COLS } from "../config/sheets";

const opts         = { sheetId: MARKET_VIEW_SHEET_ID };                     // header row present -> skip it
const optsNoHeader = { sheetId: MARKET_VIEW_SHEET_ID, skipHeader: false }; // show raw incl. any header/title rows

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
  const [error,       setError]      = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { buildup: b, fii: f, fiiStats: fs, dashboard: d, scanner: s } = MARKET_VIEW_RANGES;

      const [longBuildup, shortBuildup, shortCovering, longUnwinding] = await Promise.all([
        fetchRange(b.tab, b.longBuildup, opts),
        fetchRange(b.tab, b.shortBuildup, opts),
        fetchRange(b.tab, b.shortCovering, opts),
        fetchRange(b.tab, b.longUnwinding, opts),
      ]);

      const [indexFutures, stockFutures, participantPositions, stockParticipantPositions, historicalNet] = await Promise.all([
        fetchRange(f.tab, f.indexFutures, optsNoHeader),
        fetchRange(f.tab, f.stockFutures, optsNoHeader),
        fetchRange(f.tab, f.participantPositions, optsNoHeader),
        fetchRange(f.tab, f.stockParticipantPositions, optsNoHeader),
        fetchRange(f.tab, f.historicalNet, optsNoHeader),
      ]);

      const fiiStatsRows = await fetchRange(fs.tab, fs.range, optsNoHeader);

      const [indexStrip, broaderIndices, sectorial, usMarkets, asianMarkets, usdinrVix] = await Promise.all([
        fetchRange(d.tab, d.indexStrip, optsNoHeader),
        fetchRange(d.tab, d.broaderIndices, optsNoHeader),
        fetchRange(d.tab, d.sectorial, optsNoHeader),
        fetchRange(d.tab, d.usMarkets, optsNoHeader),
        fetchRange(d.tab, d.asianMarkets, optsNoHeader),
        fetchRange(d.tab, d.usdinrVix, optsNoHeader),
      ]);

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

      // Sentiment strip: latest PCR from your existing NiftyPCR / BNiftyPCR tabs (original sheet, default sheetId)
      const [niftyPcrRows, bnfPcrRows] = await Promise.all([
        fetchRange(SHEETS.NIFTY.pcr, "A:H"),
        fetchRange(SHEETS.BANKNIFTY.pcr, "A:H"),
      ]);
      const niftyPcr = niftyPcrRows.length ? parseRow(niftyPcrRows[niftyPcrRows.length - 1], PCR_COLS).pcr : null;
      const bnfPcr   = bnfPcrRows.length   ? parseRow(bnfPcrRows[bnfPcrRows.length - 1], PCR_COLS).pcr   : null;

      setBuildup({ longBuildup, shortBuildup, shortCovering, longUnwinding });
      setFii({ indexFutures, stockFutures, participantPositions, stockParticipantPositions, historicalNet });
      setFiiStats(fiiStatsRows);
      setDashboard({ indexStrip, broaderIndices, sectorial, usMarkets, asianMarkets, usdinrVix });
      setScanner({
        gainersLargecap, gainersMidcap, gainersSmallcap,
        loosersLargecap, loosersMidcap, loosersSmallcap,
        near52Low, near52High, breadth,
      });
      setSentiment({ niftyPcr, bnfPcr });
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { buildup, fii, fiiStats, dashboard, scanner, sentiment, loading, error, lastUpdated, fetchAll };
}