export const SHEET_ID = import.meta.env.VITE_SHEET_ID;
export const API_KEY  = import.meta.env.VITE_GSHEET_API_KEY;

export const SHEETS = {
  BANKNIFTY: { raw:"BNFData", dashboard:"Banknifty2", pcr:"BNiftyPCR", atm_m1:"BNF_ATMm1", atm:"BNF_ATM", atm_p1:"BNF_ATMp1" },
  NIFTY:     { raw:"NFData",  dashboard:"Nifty2",     pcr:"NiftyPCR",  atm_m1:"NF_ATMm1",  atm:"NF_ATM",  atm_p1:"NF_ATMp1"  },
};

// RAW sheet columns (0-indexed):
// Time, Signal, CE OI Change, CE OI, CE IV, CE Change LTP, LTP(CE), Strike,
// LTP2(PE), PE Change LTP, PE IV, PE OI, PE OI Change, PE Signal, PCR
export const RAW_COLS = {
  time:0, signal:1, ce_oi_chg:2, ce_oi:3, ce_iv:4,
  ce_ltp_chg:5, ce_ltp:6, strike:7,
  pe_ltp:8, pe_ltp_chg:9, pe_iv:10, pe_oi:11, pe_oi_chg:12, pe_signal:13, pcr:14,
};

// PCR sheet: Time, CE OI Change, PE OI Change, CE OI, PE OI, Difference, Signal, Spot
export const PCR_COLS = { time:0, ce_oi_chg:1, pe_oi_chg:2, ce_oi:3, pe_oi:4, diff:5, signal:6, spot:7 };

// ATM helper: Time, CE OI Change, PE OI Change, CE OI, PE OI, CE IV, PE IV, PCR, Spot
export const ATM_COLS = { time:0, ce_oi_chg:1, pe_oi_chg:2, ce_oi:3, pe_oi:4, ce_iv:5, pe_iv:6, pcr:7, spot:8 };
