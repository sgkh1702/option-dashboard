import { useState, useCallback } from "react";
import { fetchRange, parseRow } from "../utils/gsheets";
import { SHEETS, RAW_COLS, PCR_COLS, ATM_COLS } from "../config/sheets";

const WINDOW = 5; // ATM ± 5 strikes shown in chain

export function useSheetData() {
  const [data,        setData]        = useState(null);
  const [pcrHistory,  setPcrHistory]  = useState([]);
  const [atmHistory,  setAtmHistory]  = useState({ m1: [], atm: [], p1: [] });
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (indexKey, step) => {
    const sheetCfg = SHEETS[indexKey];
    if (!sheetCfg) { setError(`No sheet config for ${indexKey}`); return; }

    setLoading(true);
    setError(null);

    try {
      // ── 1. Fetch raw sheet as arrays ──────────────────────────────────────
      // allRaw kept as raw string arrays — OIChart uses r[7] index access
      const allRaw = await fetchRange(sheetCfg.raw, "A:O")
        .then(rows => rows.filter(r => r[7] && r[0]));

      // ── 2. Parse ALL rows once — StraddleStrangle needs r.ce_ltp etc ──────
      // THIS was the bug: Dashboard passed rawRows (arrays) to StraddleStrangle
      // which expected parsed objects → ce_ltp was always undefined → combined=0
      const allParsed = allRaw.map(r => parseRow(r, RAW_COLS));

      // ── 3. Latest parsed row per strike → chain ───────────────────────────
      const byStrike = {};
      allParsed.forEach(r => {
        if (r.strike) byStrike[r.strike] = r;
      });
      const allStrikes = Object.values(byStrike).sort((a, b) => a.strike - b.strike);

      // ── 4. PCR history + spot + ATM ──────────────────────────────────────
      const pcrRows = await fetchRange(sheetCfg.pcr, "A:H")
        .then(rows => rows
          .filter(r => r[0])
          .map(r => parseRow(r, PCR_COLS))
        );

      const spot    = pcrRows[pcrRows.length - 1]?.spot ?? 0;
      const rounded = Math.round(spot / step) * step;
      const atm     = allStrikes.find(r => r.strike === rounded)?.strike
        ?? allStrikes.reduce((b, r) =>
            Math.abs(r.strike - spot) < Math.abs(b.strike - spot) ? r : b,
            allStrikes[0]
          )?.strike;

      // ── 5. Slice chain to ATM±5 ──────────────────────────────────────────
      const chain = atm
        ? allStrikes.filter(r => Math.abs(r.strike - atm) <= WINDOW * step)
        : allStrikes;

      // ── 6. ATM history — dedicated helper sheets first, raw fallback ──────
      // gsheet_bnf.py writes BNF_ATM / BNF_ATMm1 / BNF_ATMp1 every 5 min.
      // ATM_COLS from sheets.js: {time,ce_oi_chg,pe_oi_chg,ce_oi,pe_oi,ce_iv,pe_iv,pcr,spot}
      const fetchAtmSheet = async (sheetName) => {
        try {
          const rows = await fetchRange(sheetName, "A:I")
            .then(r => r.filter(row => row[0]));
          if (rows.length) return rows.map(r => parseRow(r, ATM_COLS));
        } catch (_) {}
        return null; // signal fallback needed
      };

      // Fallback: derive from allRaw filtered by strike (same shape as ATM_COLS)
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
            spot:      0,
          }));

      if (atm) {
        const [atmM1, atmC, atmP1] = await Promise.all([
          fetchAtmSheet(sheetCfg.atm_m1),
          fetchAtmSheet(sheetCfg.atm),
          fetchAtmSheet(sheetCfg.atm_p1),
        ]);
        setAtmHistory({
          m1:  atmM1 ?? deriveFromRaw(atm - step),
          atm: atmC  ?? deriveFromRaw(atm),
          p1:  atmP1 ?? deriveFromRaw(atm + step),
        });
      }

      // rawRows    = raw string arrays → OIChart (uses r[7] index access)
      // parsedRows = parsed objects   → StraddleStrangle (uses r.ce_ltp named access)
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