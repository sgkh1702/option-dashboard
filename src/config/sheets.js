export const SHEET_ID = import.meta.env.VITE_SHEET_ID;
export const API_KEY  = import.meta.env.VITE_GSHEET_API_KEY;

export const SHEETS = {
  BANKNIFTY: { raw:"BNFData", dashboard:"Banknifty2", pcr:"BNiftyPCR", atm_m1:"BNF_ATMm1", atm:"BNF_ATM", atm_p1:"BNF_ATMp1" },
  NIFTY:     { raw:"NFData",  dashboard:"Nifty2",     pcr:"NiftyPCR",  atm_m1:"NF_ATMm1",  atm:"NF_ATM",  atm_p1:"NF_ATMp1"  },
};

// RAW sheet columns (0-indexed):
// Time, Signal, CE OI Change, CE OI, CE IV, CE Change LTP, LTP(CE), Strike,
// LTP2(PE), PE Change LTP, PE IV, PE OI, PE OI Change, PE Signal, PCR,
// CE Volume, PE Volume  (NF sheet has Expiry after these, at col 17 — see NF_EXPIRY_COL in useSheetData.js)
export const RAW_COLS = {
  time:0, signal:1, ce_oi_chg:2, ce_oi:3, ce_iv:4,
  ce_ltp_chg:5, ce_ltp:6, strike:7,
  pe_ltp:8, pe_ltp_chg:9, pe_iv:10, pe_oi:11, pe_oi_chg:12, pe_signal:13, pcr:14,
  ce_volume:15, pe_volume:16,
};

// PCR sheet: Time, CE OI Change, PE OI Change, CE OI, PE OI, Difference, Signal, Spot
export const PCR_COLS = { time:0, ce_oi_chg:1, pe_oi_chg:2, ce_oi:3, pe_oi:4, diff:5, signal:6, spot:7 };

// ATM helper: Time, CE OI Change, PE OI Change, CE OI, PE OI, CE IV, PE IV, PCR, Spot
export const ATM_COLS = { time:0, ce_oi_chg:1, pe_oi_chg:2, ce_oi:3, pe_oi:4, ce_iv:5, pe_iv:6, pcr:7, spot:8 };

// ScreenerData sheet columns (0-indexed):
// Date(0), Time(1), Bias(2), Symbol(3), LTP(4), Chg%(5), Day Open(6), Prev Close(7),
// High(8), Low(9), VWAP(10), Volume(11), Avg Vol(12), Vol Ratio(13),
// RS vs Nifty(14), Mom Score(15), Rev Score(16), ATR(17), ATR Used%(18)
export const SCREENER_SHEET = "ScreenerData";
export const SCREENER_COLS  = {
  date:0, time:1, bias:2, symbol:3, ltp:4, pct_change:5,
  day_open:6, prev_close:7, high:8, low:9, vwap:10,
  volume:11, avg_volume:12, vol_ratio:13,
  rs:14, momentum:15, reversal:16, atr:17, atr_consumed:18,
};

// ── Daily Market View — separate daily-processed workbook ────────────────────
export const MARKET_VIEW_SHEET_ID = "1t_AAtFwWPnqeNoVwDFbV8rtCIEXwQ8e3kLFHoRSlre0";

export const MARKET_VIEW_RANGES = {
  buildup: {
    tab: "Buildup",
    longBuildup:   "A53:B58",
    shortBuildup:  "F53:G58",
    shortCovering: "K53:L58",
    longUnwinding: "P53:Q58",
  },
  fii: {
    tab: "FIIData",
    indexFutures:              "B21:D23",
    stockFutures:               "G21:I23",
    participantPositions:       "B2:E6",
    stockParticipantPositions:  "G2:J6",
    historicalNet:              "L1:O8",
  },
  fiiStats: {
    tab: "FIIStat",
    range: "W2:X6",
  },
  fiiNiftyBankNet: {
    tab: "FIIStat",
    range: "S1:U8",
  },
  dashboard: {
    tab: "Dashboard",
    // Index Strip — fetched as 3 separate short rows (rather than one wide
    // C2:P2 row) since parsing a single wide row by column offset wasn't
    // rendering reliably.
    niftySpot:      "C2:E2",
    bankNiftySpot:  "H2:J2",
    sensexSpot:     "M2:O2",
    broaderIndices: "C6:F10",
    sectorial:      "H6:K16",
    usMarkets:      "M6:P9",
    asianMarkets:   "M12:P16",
    usdinrVix:      "C14:E15",
  },
  scanner: {
    tab: "scanner",
    gainersLargecap: "B110:F120",
    gainersMidcap:   "H110:L120",
    gainersSmallcap: "N110:R120",
    loosersLargecap: "B125:F135",
    loosersMidcap:   "H125:L135",
    loosersSmallcap: "N125:R135",
    near52Low:       "B88:E103",
    near52High:      "G88:J103",
    breadth:         "B140:C144",
  },
   corporateActions: { tab: "CorporateActions", range: "A2:F200" },
};