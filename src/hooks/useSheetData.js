import { useState, useCallback } from "react";
import { fetchRange, parseRow } from "../utils/gsheets";
import { SHEETS, RAW_COLS, PCR_COLS, ATM_COLS } from "../config/sheets";

const WINDOW = 5; // ATM +/- 5 strikes shown in chain

// Col index of Expiry in NF raw sheet (col P = index 15)
// BNF has no Expiry column — stays at A:O (15 cols)
const NF_EXPIRY_COL = 15;

export function useSheetData() {
  const [data,        setData]        = useState(null);
  const [pcrHistory,  setPcrHistory]  = useState([]);
  const [atmHistory,  setAtmHistory]  = useState({ m1: [], atm: [], p1: [] });
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // selectedExpiry: "YYYY-MM-DD" — only used for NIFTY to filter NFData rows.
  // For BNF and all others pass null — no filtering applied.
  const fetchData = useCallback(async (indexKey, step, selectedExpiry = null) => {
    const sheetCfg = SHEETS[indexKey];
    if (!sheetCfg) { setError(`No sheet config for ${indexKey}`); return; }

    setLoading(true);
    setError(null);

    try {
      const isNifty = indexKey === "NIFTY";

      // ── 1. Fetch raw sheet ────────────────────────────────────────────────
      // NF: A:P (16 cols — col P = Expiry)
      // BNF + others: A:O (15 cols)
      const range  = isNifty ? "A:P" : "A:O";
      let   allRaw = await fetchRange(sheetCfg.raw, range)
        .then(rows => rows.filter(r => r[7] && r[0]));

      // ── 2. For Nifty: filter by selectedExpiry ────────────────────────────
      if (isNifty && selectedExpiry) {
        const hasExpiryCol = allRaw.some(r => r[NF_EXPIRY_COL] && r[NF_EXPIRY_COL].trim() !== "");
        // Only skip filtering if NO rows have expiry col at all (old sheet format)
        // If sheet has expiry col, always filter — even if 0 rows match (avoids mixing expiries)
        allRaw = hasExpiryCol
          ? allRaw.filter(r => r[NF_EXPIRY_COL] === selectedExpiry)
          : allRaw;
      }

      // ── 3. Parse all rows ─────────────────────────────────────────────────
      const allParsed = allRaw.map(r => parseRow(r, RAW_COLS));

      // ── 4. Latest row per strike -> chain ─────────────────────────────────
      const byStrike  = {};
      allParsed.forEach(r => { if (r.strike) byStrike[r.strike] = r; });
      const allStrikes = Object.values(byStrike).sort((a, b) => a.strike - b.strike);

      // ── 5. PCR history + spot + ATM ───────────────────────────────────────
      const pcrRows = await fetchRange(sheetCfg.pcr, "A:H")
        .then(rows => rows.filter(r => r[0]).map(r => parseRow(r, PCR_COLS)));

      const spot    = pcrRows[pcrRows.length - 1]?.spot ?? 0;
      const rounded = Math.round(spot / step) * step;
      const atm     = allStrikes.find(r => r.strike === rounded)?.strike
        ?? allStrikes.reduce((b, r) =>
            Math.abs(r.strike - spot) < Math.abs(b.strike - spot) ? r : b,
            allStrikes[0]
          )?.strike;

      // ── 6. Chain: ATM +/- WINDOW strikes ─────────────────────────────────
      const chain = atm
        ? allStrikes.filter(r => Math.abs(r.strike - atm) <= WINDOW * step)
        : allStrikes;

      // ── 7. ATM history — always derived from rawRows ──────────────────────
      // ATM sheets (BNF_ATM etc.) removed — no longer written or read.
      // deriveFromRaw filters allRaw by strike and includes CE/PE LTP.
      // This correctly tracks current ATM even if ATM shifted during the day.
      const deriveFromRaw = (strike) =>
        allRaw
          .filter(r => parseFloat(r[7]) === strike)
          .map(r => ({
            time:      r[0]  ?? "",
            ce_oi_chg: parseFloat(r[2])  || 0,
            pe_oi_chg: parseFloat(r[12]) || 0,
            ce_oi:     parseFloat(r[3])  || 0,
            pe_oi:     parseFloat(r[11]) || 0,
            ce_iv:     parseFloat(r[4])  || 0,
            pe_iv:     parseFloat(r[10]) || 0,
            pcr:       parseFloat(r[14]) || 0,
            ce_ltp:    parseFloat(r[6])  || 0,   // col G — CE LTP
            pe_ltp:    parseFloat(r[8])  || 0,   // col I — PE LTP (LTP2)
            spot:      0,
          }));

      if (atm) {
        setAtmHistory({
          m1:  deriveFromRaw(atm - step),
          atm: deriveFromRaw(atm),
          p1:  deriveFromRaw(atm + step),
        });
      }

      // rawRows    = raw string arrays  -> OIChart (uses r[7] index access)
      // parsedRows = parsed objects     -> StraddleStrangle (uses r.ce_ltp named access)
      setData({ chain, spot, atm, rawRows: allRaw, parsedRows: allParsed });
      setPcrHistory(pcrRows);
      setLastUpdated(new Date());

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, pcrHistory, atmHistory, loading, error, lastUpdated, fetchData };
}