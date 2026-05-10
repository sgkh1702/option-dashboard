import { useState, useCallback } from "react";
import { fetchRange, parseRow } from "../utils/gsheets";
import { SHEETS, RAW_COLS, PCR_COLS } from "../config/sheets";

const ATM_COLS = {
  time:      0,
  ce_oi_chg: 2,
  pe_oi_chg: 12,
  ce_oi:     3,
  pe_oi:     11,
  ce_iv:     4,
  pe_iv:     10,
  pcr:       14,
};

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
      // ── 1. Fetch BNFData once as raw arrays ──────────────────────────────
      const allRaw = await fetchRange(sheetCfg.raw, "A:O")
        .then(rows => rows.filter(r => r[7] && r[0]));

      // ── 2. Latest row per strike (all strikes seen today) ─────────────────
      const byStrike = {};
      allRaw.forEach(r => {
        const parsed = parseRow(r, RAW_COLS);
        if (parsed.strike) byStrike[parsed.strike] = parsed;
      });
      const allStrikes = Object.values(byStrike).sort((a, b) => a.strike - b.strike);

      // ── 3. PCR history + spot + ATM ──────────────────────────────────────
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

      // ── 4. Slice chain to ATM±5 ──────────────────────────────────────────
      // BNFData accumulates every strike that was ever in the ±5 window
      // during the day. Without slicing, the chain grows as ATM drifts.
      // We always show exactly the current ATM±5 window.
      const chain = atm
        ? allStrikes.filter(r => Math.abs(r.strike - atm) <= WINDOW * step)
        : allStrikes;

      setData({ chain, spot, atm, rawRows: allRaw });
      setPcrHistory(pcrRows);

      // ── 5. ATM history — filter allRaw by strike, parse ATM_COLS ─────────
      // Single fetch, no separate sheet tabs.
      // Gaps appear naturally when a strike wasn't in the ±5 window.
      if (atm) {
        const filterByStrike = (strike) =>
          allRaw
            .filter(r => parseFloat(r[7]) === strike)
            .map(r => parseRow(r, ATM_COLS));

        setAtmHistory({
          p1:  filterByStrike(atm + step),
          atm: filterByStrike(atm),
          m1:  filterByStrike(atm - step),
        });
      }

      setLastUpdated(new Date());

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, pcrHistory, atmHistory, loading, error, lastUpdated, fetchData };
}