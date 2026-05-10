import { useState, useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

// ─── Constants ────────────────────────────────────────────────────────────────
const UNDERLYINGS = [
  { label: "Bank Nifty", value: "BANKNIFTY", lot: 30, type: "index" },
  { label: "Fin Nifty", value: "FINNIFTY", lot: 60, type: "index" },
  { label: "Midcap Nifty", value: "MIDCPNIFTY", lot: 120, type: "index" },
  { label: "Nifty 50", value: "NIFTY", lot: 65, type: "index" },
  { label: "Nifty Next 50", value: "NIFTYNXT50", lot: 25, type: "index" },
  { label: "360ONE", value: "360ONE", lot: 500, type: "stock" },
  { label: "ABB", value: "ABB", lot: 125, type: "stock" },
  { label: "ABCAPITAL", value: "ABCAPITAL", lot: 3100, type: "stock" },
  { label: "ADANIENSOL", value: "ADANIENSOL", lot: 675, type: "stock" },
  { label: "ADANIENT", value: "ADANIENT", lot: 309, type: "stock" },
  { label: "ADANIGREEN", value: "ADANIGREEN", lot: 600, type: "stock" },
  { label: "ADANIPORTS", value: "ADANIPORTS", lot: 475, type: "stock" },
  { label: "ADANIPOWER", value: "ADANIPOWER", lot: 3550, type: "stock" },
  { label: "ALKEM", value: "ALKEM", lot: 125, type: "stock" },
  { label: "AMBER", value: "AMBER", lot: 100, type: "stock" },
  { label: "AMBUJACEM", value: "AMBUJACEM", lot: 1050, type: "stock" },
  { label: "ANGELONE", value: "ANGELONE", lot: 2500, type: "stock" },
  { label: "APLAPOLLO", value: "APLAPOLLO", lot: 350, type: "stock" },
  { label: "APOLLOHOSP", value: "APOLLOHOSP", lot: 125, type: "stock" },
  { label: "ASHOKLEY", value: "ASHOKLEY", lot: 5000, type: "stock" },
  { label: "Asian Paints", value: "ASIANPAINT", lot: 250, type: "stock" },
  { label: "ASTRAL", value: "ASTRAL", lot: 425, type: "stock" },
  { label: "AUBANK", value: "AUBANK", lot: 1000, type: "stock" },
  { label: "AUROPHARMA", value: "AUROPHARMA", lot: 550, type: "stock" },
  { label: "Axis Bank", value: "AXISBANK", lot: 625, type: "stock" },
  { label: "Bajaj Finserv", value: "BAJAJFINSV", lot: 250, type: "stock" },
  { label: "BAJAJHLDNG", value: "BAJAJHLDNG", lot: 50, type: "stock" },
  { label: "Bajaj Finance", value: "BAJFINANCE", lot: 750, type: "stock" },
  { label: "BANDHANBNK", value: "BANDHANBNK", lot: 3600, type: "stock" },
  { label: "BANKBARODA", value: "BANKBARODA", lot: 2925, type: "stock" },
  { label: "BANKINDIA", value: "BANKINDIA", lot: 5200, type: "stock" },
  { label: "BDL", value: "BDL", lot: 350, type: "stock" },
  { label: "BEL", value: "BEL", lot: 1425, type: "stock" },
  { label: "BHARATFORG", value: "BHARATFORG", lot: 500, type: "stock" },
  { label: "BHARTIARTL", value: "BHARTIARTL", lot: 475, type: "stock" },
  { label: "BHEL", value: "BHEL", lot: 2625, type: "stock" },
  { label: "BIOCON", value: "BIOCON", lot: 2500, type: "stock" },
  { label: "BLUESTARCO", value: "BLUESTARCO", lot: 325, type: "stock" },
  { label: "BOSCHLTD", value: "BOSCHLTD", lot: 25, type: "stock" },
  { label: "BPCL", value: "BPCL", lot: 1975, type: "stock" },
  { label: "BRITANNIA", value: "BRITANNIA", lot: 125, type: "stock" },
  { label: "BSE", value: "BSE", lot: 375, type: "stock" },
  { label: "CAMS", value: "CAMS", lot: 750, type: "stock" },
  { label: "CANBK", value: "CANBK", lot: 6750, type: "stock" },
  { label: "CDSL", value: "CDSL", lot: 475, type: "stock" },
  { label: "CGPOWER", value: "CGPOWER", lot: 850, type: "stock" },
  { label: "CHOLAFIN", value: "CHOLAFIN", lot: 625, type: "stock" },
  { label: "CIPLA", value: "CIPLA", lot: 375, type: "stock" },
  { label: "COALINDIA", value: "COALINDIA", lot: 1350, type: "stock" },
  { label: "COCHINSHIP", value: "COCHINSHIP", lot: 400, type: "stock" },
  { label: "COFORGE", value: "COFORGE", lot: 375, type: "stock" },
  { label: "COLPAL", value: "COLPAL", lot: 225, type: "stock" },
  { label: "CONCOR", value: "CONCOR", lot: 1250, type: "stock" },
  { label: "CROMPTON", value: "CROMPTON", lot: 1800, type: "stock" },
  { label: "CUMMINSIND", value: "CUMMINSIND", lot: 200, type: "stock" },
  { label: "DABUR", value: "DABUR", lot: 1250, type: "stock" },
  { label: "DALBHARAT", value: "DALBHARAT", lot: 325, type: "stock" },
  { label: "DELHIVERY", value: "DELHIVERY", lot: 2075, type: "stock" },
  { label: "DIVISLAB", value: "DIVISLAB", lot: 100, type: "stock" },
  { label: "DIXON", value: "DIXON", lot: 50, type: "stock" },
  { label: "DLF", value: "DLF", lot: 825, type: "stock" },
  { label: "DMART", value: "DMART", lot: 150, type: "stock" },
  { label: "DRREDDY", value: "DRREDDY", lot: 625, type: "stock" },
  { label: "EICHERMOT", value: "EICHERMOT", lot: 100, type: "stock" },
  { label: "ETERNAL", value: "ETERNAL", lot: 2425, type: "stock" },
  { label: "EXIDEIND", value: "EXIDEIND", lot: 1800, type: "stock" },
  { label: "FEDERALBNK", value: "FEDERALBNK", lot: 2500, type: "stock" },
  { label: "FORCEMOT", value: "FORCEMOT", lot: 25, type: "stock" },
  { label: "FORTIS", value: "FORTIS", lot: 775, type: "stock" },
  { label: "GAIL", value: "GAIL", lot: 3150, type: "stock" },
  { label: "GLENMARK", value: "GLENMARK", lot: 375, type: "stock" },
  { label: "GMRAIRPORT", value: "GMRAIRPORT", lot: 6975, type: "stock" },
  { label: "GODFRYPHLP", value: "GODFRYPHLP", lot: 275, type: "stock" },
  { label: "GODREJCP", value: "GODREJCP", lot: 500, type: "stock" },
  { label: "GODREJPROP", value: "GODREJPROP", lot: 275, type: "stock" },
  { label: "GRASIM", value: "GRASIM", lot: 250, type: "stock" },
  { label: "HAL", value: "HAL", lot: 150, type: "stock" },
  { label: "HAVELLS", value: "HAVELLS", lot: 500, type: "stock" },
  { label: "HCLTECH", value: "HCLTECH", lot: 350, type: "stock" },
  { label: "HDFCAMC", value: "HDFCAMC", lot: 300, type: "stock" },
  { label: "HDFC Bank", value: "HDFCBANK", lot: 550, type: "stock" },
  { label: "HDFCLIFE", value: "HDFCLIFE", lot: 1100, type: "stock" },
  { label: "HEROMOTOCO", value: "HEROMOTOCO", lot: 150, type: "stock" },
  { label: "HINDALCO", value: "HINDALCO", lot: 700, type: "stock" },
  { label: "HINDPETRO", value: "HINDPETRO", lot: 2025, type: "stock" },
  { label: "HUL", value: "HINDUNILVR", lot: 300, type: "stock" },
  { label: "HINDZINC", value: "HINDZINC", lot: 1225, type: "stock" },
  { label: "HYUNDAI", value: "HYUNDAI", lot: 275, type: "stock" },
  { label: "ICICI Bank", value: "ICICIBANK", lot: 700, type: "stock" },
  { label: "ICICIGI", value: "ICICIGI", lot: 325, type: "stock" },
  { label: "ICICIPRULI", value: "ICICIPRULI", lot: 925, type: "stock" },
  { label: "IDEA", value: "IDEA", lot: 71475, type: "stock" },
  { label: "IDFCFIRSTB", value: "IDFCFIRSTB", lot: 9275, type: "stock" },
  { label: "IEX", value: "IEX", lot: 3750, type: "stock" },
  { label: "INDHOTEL", value: "INDHOTEL", lot: 1000, type: "stock" },
  { label: "INDIANB", value: "INDIANB", lot: 1000, type: "stock" },
  { label: "INDIGO", value: "INDIGO", lot: 150, type: "stock" },
  { label: "INDUSINDBK", value: "INDUSINDBK", lot: 700, type: "stock" },
  { label: "INDUSTOWER", value: "INDUSTOWER", lot: 1700, type: "stock" },
  { label: "Infosys", value: "INFY", lot: 400, type: "stock" },
  { label: "INOXWIND", value: "INOXWIND", lot: 3575, type: "stock" },
  { label: "IOC", value: "IOC", lot: 4875, type: "stock" },
  { label: "IREDA", value: "IREDA", lot: 3450, type: "stock" },
  { label: "IRFC", value: "IRFC", lot: 4250, type: "stock" },
  { label: "ITC", value: "ITC", lot: 1600, type: "stock" },
  { label: "JINDALSTEL", value: "JINDALSTEL", lot: 625, type: "stock" },
  { label: "JIOFIN", value: "JIOFIN", lot: 2350, type: "stock" },
  { label: "JSWENERGY", value: "JSWENERGY", lot: 1000, type: "stock" },
  { label: "JSWSTEEL", value: "JSWSTEEL", lot: 675, type: "stock" },
  { label: "JUBLFOOD", value: "JUBLFOOD", lot: 1250, type: "stock" },
  { label: "KALYANKJIL", value: "KALYANKJIL", lot: 1175, type: "stock" },
  { label: "KAYNES", value: "KAYNES", lot: 100, type: "stock" },
  { label: "KEI", value: "KEI", lot: 175, type: "stock" },
  { label: "KFINTECH", value: "KFINTECH", lot: 500, type: "stock" },
  { label: "Kotak Bank", value: "KOTAKBANK", lot: 2000, type: "stock" },
  { label: "KPITTECH", value: "KPITTECH", lot: 425, type: "stock" },
  { label: "LAURUSLABS", value: "LAURUSLABS", lot: 850, type: "stock" },
  { label: "LICHSGFIN", value: "LICHSGFIN", lot: 1000, type: "stock" },
  { label: "LICI", value: "LICI", lot: 700, type: "stock" },
  { label: "LODHA", value: "LODHA", lot: 450, type: "stock" },
  { label: "L&T", value: "LT", lot: 175, type: "stock" },
  { label: "LTF", value: "LTF", lot: 2250, type: "stock" },
  { label: "LTM", value: "LTM", lot: 150, type: "stock" },
  { label: "LUPIN", value: "LUPIN", lot: 425, type: "stock" },
  { label: "M&M", value: "M&M", lot: 200, type: "stock" },
  { label: "MANAPPURAM", value: "MANAPPURAM", lot: 3000, type: "stock" },
  { label: "MANKIND", value: "MANKIND", lot: 225, type: "stock" },
  { label: "MARICO", value: "MARICO", lot: 1200, type: "stock" },
  { label: "Maruti", value: "MARUTI", lot: 50, type: "stock" },
  { label: "MAXHEALTH", value: "MAXHEALTH", lot: 525, type: "stock" },
  { label: "MAZDOCK", value: "MAZDOCK", lot: 200, type: "stock" },
  { label: "MCX", value: "MCX", lot: 625, type: "stock" },
  { label: "MFSL", value: "MFSL", lot: 400, type: "stock" },
  { label: "MOTHERSON", value: "MOTHERSON", lot: 6150, type: "stock" },
  { label: "MOTILALOFS", value: "MOTILALOFS", lot: 775, type: "stock" },
  { label: "MPHASIS", value: "MPHASIS", lot: 275, type: "stock" },
  { label: "MUTHOOTFIN", value: "MUTHOOTFIN", lot: 275, type: "stock" },
  { label: "NAM-INDIA", value: "NAM-INDIA", lot: 625, type: "stock" },
  { label: "NATIONALUM", value: "NATIONALUM", lot: 1875, type: "stock" },
  { label: "NAUKRI", value: "NAUKRI", lot: 375, type: "stock" },
  { label: "NBCC", value: "NBCC", lot: 6500, type: "stock" },
  { label: "NESTLEIND", value: "NESTLEIND", lot: 500, type: "stock" },
  { label: "NHPC", value: "NHPC", lot: 6400, type: "stock" },
  { label: "NMDC", value: "NMDC", lot: 6750, type: "stock" },
  { label: "NTPC", value: "NTPC", lot: 1500, type: "stock" },
  { label: "NUVAMA", value: "NUVAMA", lot: 500, type: "stock" },
  { label: "NYKAA", value: "NYKAA", lot: 3125, type: "stock" },
  { label: "OBEROIRLTY", value: "OBEROIRLTY", lot: 350, type: "stock" },
  { label: "OFSS", value: "OFSS", lot: 75, type: "stock" },
  { label: "OIL", value: "OIL", lot: 1400, type: "stock" },
  { label: "ONGC", value: "ONGC", lot: 2250, type: "stock" },
  { label: "PAGEIND", value: "PAGEIND", lot: 15, type: "stock" },
  { label: "PATANJALI", value: "PATANJALI", lot: 900, type: "stock" },
  { label: "PAYTM", value: "PAYTM", lot: 725, type: "stock" },
  { label: "PERSISTENT", value: "PERSISTENT", lot: 100, type: "stock" },
  { label: "PETRONET", value: "PETRONET", lot: 1900, type: "stock" },
  { label: "PFC", value: "PFC", lot: 1300, type: "stock" },
  { label: "PGEL", value: "PGEL", lot: 950, type: "stock" },
  { label: "PHOENIXLTD", value: "PHOENIXLTD", lot: 350, type: "stock" },
  { label: "PIDILITIND", value: "PIDILITIND", lot: 500, type: "stock" },
  { label: "PIIND", value: "PIIND", lot: 175, type: "stock" },
  { label: "PNB", value: "PNB", lot: 8000, type: "stock" },
  { label: "PNBHOUSING", value: "PNBHOUSING", lot: 650, type: "stock" },
  { label: "POLICYBZR", value: "POLICYBZR", lot: 350, type: "stock" },
  { label: "POLYCAB", value: "POLYCAB", lot: 125, type: "stock" },
  { label: "POWERGRID", value: "POWERGRID", lot: 1900, type: "stock" },
  { label: "POWERINDIA", value: "POWERINDIA", lot: 25, type: "stock" },
  { label: "PREMIERENE", value: "PREMIERENE", lot: 575, type: "stock" },
  { label: "PRESTIGE", value: "PRESTIGE", lot: 450, type: "stock" },
  { label: "RBLBANK", value: "RBLBANK", lot: 3175, type: "stock" },
  { label: "RECLTD", value: "RECLTD", lot: 1400, type: "stock" },
  { label: "Reliance", value: "RELIANCE", lot: 500, type: "stock" },
  { label: "RVNL", value: "RVNL", lot: 1525, type: "stock" },
  { label: "SAIL", value: "SAIL", lot: 4700, type: "stock" },
  { label: "SAMMAANCAP", value: "SAMMAANCAP", lot: 4300, type: "stock" },
  { label: "SBICARD", value: "SBICARD", lot: 800, type: "stock" },
  { label: "SBILIFE", value: "SBILIFE", lot: 375, type: "stock" },
  { label: "SBI", value: "SBIN", lot: 750, type: "stock" },
  { label: "SHREECEM", value: "SHREECEM", lot: 25, type: "stock" },
  { label: "SHRIRAMFIN", value: "SHRIRAMFIN", lot: 825, type: "stock" },
  { label: "SIEMENS", value: "SIEMENS", lot: 175, type: "stock" },
  { label: "SOLARINDS", value: "SOLARINDS", lot: 50, type: "stock" },
  { label: "SONACOMS", value: "SONACOMS", lot: 1225, type: "stock" },
  { label: "SRF", value: "SRF", lot: 200, type: "stock" },
  { label: "SUNPHARMA", value: "SUNPHARMA", lot: 350, type: "stock" },
  { label: "SUPREMEIND", value: "SUPREMEIND", lot: 175, type: "stock" },
  { label: "SUZLON", value: "SUZLON", lot: 9025, type: "stock" },
  { label: "SWIGGY", value: "SWIGGY", lot: 1300, type: "stock" },
  { label: "TATACONSUM", value: "TATACONSUM", lot: 550, type: "stock" },
  { label: "TATAELXSI", value: "TATAELXSI", lot: 100, type: "stock" },
  { label: "TATAPOWER", value: "TATAPOWER", lot: 1450, type: "stock" },
  { label: "TATASTEEL", value: "TATASTEEL", lot: 2750, type: "stock" },
  { label: "TCS", value: "TCS", lot: 175, type: "stock" },
  { label: "TECHM", value: "TECHM", lot: 600, type: "stock" },
  { label: "TIINDIA", value: "TIINDIA", lot: 200, type: "stock" },
  { label: "Titan", value: "TITAN", lot: 175, type: "stock" },
  { label: "TMPV", value: "TMPV", lot: 800, type: "stock" },
  { label: "TORNTPHARM", value: "TORNTPHARM", lot: 125, type: "stock" },
  { label: "TRENT", value: "TRENT", lot: 100, type: "stock" },
  { label: "TVSMOTOR", value: "TVSMOTOR", lot: 175, type: "stock" },
  { label: "ULTRACEMCO", value: "ULTRACEMCO", lot: 50, type: "stock" },
  { label: "UNIONBANK", value: "UNIONBANK", lot: 4425, type: "stock" },
  { label: "UNITDSPR", value: "UNITDSPR", lot: 400, type: "stock" },
  { label: "UNOMINDA", value: "UNOMINDA", lot: 550, type: "stock" },
  { label: "UPL", value: "UPL", lot: 1355, type: "stock" },
  { label: "VBL", value: "VBL", lot: 1125, type: "stock" },
  { label: "VEDL", value: "VEDL", lot: 1150, type: "stock" },
  { label: "VMM", value: "VMM", lot: 4850, type: "stock" },
  { label: "VOLTAS", value: "VOLTAS", lot: 375, type: "stock" },
  { label: "WAAREEENER", value: "WAAREEENER", lot: 175, type: "stock" },
  { label: "Wipro", value: "WIPRO", lot: 3000, type: "stock" },
  { label: "YESBANK", value: "YESBANK", lot: 31100, type: "stock" },
  { label: "ZYDUSLIFE", value: "ZYDUSLIFE", lot: 900, type: "stock" },
  { label: "Other", value: "OTHER", lot: 100, type: "stock" },
];

const STRATEGIES = [
  { label: "Custom",              legs: [] },
  // ── Pure Options ──
  { label: "Long Straddle",       legs: [{ type:"CE", action:"BUY",  qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Short Straddle",      legs: [{ type:"CE", action:"SELL", qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Long Strangle",       legs: [{ type:"CE", action:"BUY",  qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Short Strangle",      legs: [{ type:"CE", action:"SELL", qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Bull Call Spread",    legs: [{ type:"CE", action:"BUY",  qty:1 }, { type:"CE", action:"SELL", qty:1 }] },
  { label: "Bear Put Spread",     legs: [{ type:"PE", action:"BUY",  qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Bull Put Spread",     legs: [{ type:"PE", action:"SELL", qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Bear Call Spread",    legs: [{ type:"CE", action:"SELL", qty:1 }, { type:"CE", action:"BUY",  qty:1 }] },
  { label: "Iron Condor",         legs: [{ type:"PE", action:"BUY",  qty:1 }, { type:"PE", action:"SELL", qty:1 }, { type:"CE", action:"SELL", qty:1 }, { type:"CE", action:"BUY",  qty:1 }] },
  { label: "Iron Butterfly",      legs: [{ type:"PE", action:"BUY",  qty:1 }, { type:"PE", action:"SELL", qty:1 }, { type:"CE", action:"SELL", qty:1 }, { type:"CE", action:"BUY",  qty:1 }] },
  // ── Futures + Options ──
  { label: "Covered Call",        legs: [{ type:"FUT", action:"BUY",  qty:1 }, { type:"CE", action:"SELL", qty:1 }] },
  { label: "Protective Put",      legs: [{ type:"FUT", action:"BUY",  qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Synthetic Long",      legs: [{ type:"CE", action:"BUY",  qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Synthetic Short",     legs: [{ type:"PE", action:"BUY",  qty:1 }, { type:"CE", action:"SELL", qty:1 }] },
  { label: "Long Fut + Sell CE",  legs: [{ type:"FUT", action:"BUY",  qty:1 }, { type:"CE", action:"SELL", qty:1 }] },
  { label: "Short Fut + Sell PE", legs: [{ type:"FUT", action:"SELL", qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Long Fut + Buy PE",   legs: [{ type:"FUT", action:"BUY",  qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Short Fut + Buy CE",  legs: [{ type:"FUT", action:"SELL", qty:1 }, { type:"CE", action:"BUY",  qty:1 }] },
];

// ─── NSE Expiry Generator ─────────────────────────────────────────────────────
// Indices: last Thursday of month | Stocks: last Tuesday of month
function getNSEExpiries(isIndex, monthsAhead = 3) {
  const expiries = [];
  const today = new Date();
  for (let m = 0; m < monthsAhead; m++) {
    const year  = today.getFullYear();
    const month = today.getMonth() + m;
    const d = new Date(year, month + 1, 0); // last day of month
    const targetDay = isIndex ? 4 : 2; // 4=Thursday, 2=Tuesday
    while (d.getDay() !== targetDay) d.setDate(d.getDate() - 1);
    expiries.push(new Date(d));
  }
  // Also include weekly expiries for Bank Nifty (every Wednesday — skip for now, monthly only)
  return expiries.map(d => ({
    label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    value: d.toISOString().slice(0, 10),
    daysLeft: Math.ceil((d - new Date()) / 86400000),
  }));
}


// ─── Fetch live spot price via Dhan API (proxied through Vite) ───────────────
// Security IDs from Dhan's scrip master for NSE EQ segment
const DHAN_SECURITY_IDS = {
  RELIANCE: "2885", HDFCBANK: "1333", ICICIBANK: "4963", INFY: "1594",
  TCS: "11536", WIPRO: "3787", SBIN: "3045", AXISBANK: "5900",
  KOTAKBANK: "1922", LT: "11483", BAJFINANCE: "317", BAJAJFINSV: "16675",
  HINDUNILVR: "1394", ITC: "1660", MARUTI: "10999", ASIANPAINT: "236",
  TITAN: "3506", ULTRACEMCO: "11532", NESTLEIND: "17963", POWERGRID: "14977",
  NTPC: "11630", ONGC: "11723", BPCL: "526", COALINDIA: "20374",
  TATASTEEL: "3499", JSWSTEEL: "11723", HINDALCO: "1363", VEDL: "3063",
  SUNPHARMA: "3351", DRREDDY: "881", CIPLA: "694", DIVISLAB: "15414",
  APOLLOHOSP: "157", BHARTIARTL: "10604", TECHM: "13538", HCLTECH: "7229",
  LTIM: "17818", ADANIENT: "25", ADANIPORTS: "15083", DLF: "14732",
  INDUSINDBK: "5258", HEROMOTOCO: "1348",
  EICHERMOT: "10738", TATAMOTOR: "3456", "M&M": "2031", ZOMATO: "21296",
  IRCTC: "13611", MUTHOOTFIN: "13923", CHOLAFIN: "1023", SRF: "3273",
  PIDILITIND: "2664", TATACONSUM: "3432", BRITANNIA: "547", INDIGO: "11195",
  GODREJPROP: "13209", BEL: "383", HAL: "541", PFC: "14299", RECLTD: "11390",
  CANBK: "10794", SBICARD: "18143", SIEMENS: "3347", SONACOMS: "19183",
};

async function fetchSpotPrice(symbol, isIndex, token, clientId) {
  if (isIndex || symbol === "OTHER") return null;
  const secId = DHAN_SECURITY_IDS[symbol];
  if (!secId || !token) return null;
  try {
    const res = await fetch("/dhan-api/v2/quotes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": token,
        "client-id": clientId,
      },
      body: JSON.stringify({
        securities: { NSE_EQ: [secId] }
      }),
    });
    const json = await res.json();
    const price = json?.data?.NSE_EQ?.[secId]?.last_price;
    return price ? Math.round(price * 100) / 100 : null;
  } catch {
    return null;
  }
}

const emptyLeg = () => ({ id: Date.now() + Math.random(), type: "CE", action: "SELL", strike: "", premium: "", qty: 1 });

// ─── Searchable Underlying Dropdown ───────────────────────────────────────────
function UnderlyingSearch({ value, onChange }) {
  const [query, setQuery] = useState(value.label);
  const [open,  setOpen]  = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value.label); }, [value]);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = UNDERLYINGS.filter(u =>
    u.label.toLowerCase().includes(query.toLowerCase()) ||
    u.value.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 15);

  const select = u => { onChange(u); setQuery(u.label); setOpen(false); };

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 180 }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search symbol…"
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full focus:outline-none focus:border-blue-400"
      />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: 2, maxHeight: 220, overflowY: "auto" }}
          className="border border-gray-200 rounded-lg bg-white shadow-md">
          {filtered.map(u => (
            <div key={u.value} onMouseDown={() => select(u)}
              className="flex justify-between items-center px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer">
              <span className={u.value === value.value ? "font-medium text-blue-600" : "text-gray-700"}>
                {u.label}
                {u.type === "index" && <span className="ml-1 text-xs text-purple-500">IDX</span>}
              </span>
              <span className="text-xs text-gray-400">lot {u.lot}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── P&L at expiry for one leg ────────────────────────────────────────────────
function legPnl(leg, spot) {
  const strike  = Number(leg.strike);
  const premium = Number(leg.premium);
  const qty     = Number(leg.qty);
  const dir     = leg.action === "BUY" ? 1 : -1;
  if (leg.type === "FUT") {
    const entryPrice = premium; // premium field = futures entry price
    return dir * (spot - entryPrice) * qty;
  }
  const intrinsic = leg.type === "CE"
    ? Math.max(0, spot - strike)
    : Math.max(0, strike - spot);
  return dir * (intrinsic - premium) * qty;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEY = "strategy_journal_v1";
function loadJournal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}
function saveJournal(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ─── Payoff Chart ─────────────────────────────────────────────────────────────
function PayoffChart({ legs, spot, lot }) {
  const ref = useRef(null), inst = useRef(null);

  useEffect(() => {
    if (!ref.current || !legs.length || !spot) return;
    const s = Number(spot);
    const range = s * 0.15;
    const points = 120;
    const xs = Array.from({ length: points }, (_, i) => s - range + (2 * range * i) / (points - 1));

    const pnls = xs.map(x => legs.reduce((sum, leg) => sum + legPnl(leg, x) * lot, 0));

    const maxPnl  = Math.max(...pnls);
    const minPnl  = Math.min(...pnls);
    const maxIdx  = pnls.indexOf(maxPnl);
    const minIdx  = pnls.indexOf(minPnl);

    // Breakevens — where pnl crosses 0
    const breakevens = [];
    for (let i = 1; i < pnls.length; i++) {
      if ((pnls[i - 1] < 0 && pnls[i] >= 0) || (pnls[i - 1] >= 0 && pnls[i] < 0)) {
        const x = xs[i - 1] + (xs[i] - xs[i - 1]) * (-pnls[i - 1]) / (pnls[i] - pnls[i - 1]);
        breakevens.push(Math.round(x));
      }
    }

    if (inst.current) inst.current.destroy();
    inst.current = new Chart(ref.current, {
      type: "line",
      data: {
        labels: xs.map(x => Math.round(x)),
        datasets: [
          {
            label: "P&L at Expiry",
            data: pnls.map(v => +v.toFixed(0)),
            borderColor: ctx => {
              const v = ctx.parsed?.y ?? 0;
              return v >= 0 ? "#22c55e" : "#ef4444";
            },
            segment: {
              borderColor: ctx => ctx.p0.parsed.y >= 0 ? "#22c55e" : "#ef4444",
              backgroundColor: ctx => ctx.p0.parsed.y >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            },
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.2,
            fill: true,
          },
          {
            label: "Zero line",
            data: xs.map(() => 0),
            borderColor: "rgba(0,0,0,0.15)",
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => `Spot: ${items[0].label}`,
              label: ctx => ctx.datasetIndex === 0 ? `P&L: ₹${Number(ctx.parsed.y).toLocaleString("en-IN")}` : null,
            },
          },
          annotation: {},
        },
        scales: {
          x: {
            ticks: { font: { size: 9 }, maxTicksLimit: 12, autoSkip: true },
            grid: { color: "rgba(0,0,0,0.04)" },
            title: { display: true, text: "Spot at Expiry", font: { size: 10 } },
          },
          y: {
            ticks: {
              font: { size: 9 },
              callback: v => v >= 1000 || v <= -1000 ? `${(v/1000).toFixed(1)}K` : v,
            },
            grid: { color: ctx => ctx.tick.value === 0 ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)" },
            title: { display: true, text: "P&L (₹)", font: { size: 10 } },
          },
        },
      },
    });
    return () => inst.current?.destroy();
  }, [legs, spot, lot]);

  if (!legs.length || !spot) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
      Add legs and set spot price to see payoff chart
    </div>
  );

  // Summary stats
  const s = Number(spot);
  const range = s * 0.15;
  const points = 120;
  const xs = Array.from({ length: points }, (_, i) => s - range + (2 * range * i) / (points - 1));
  const pnls = xs.map(x => legs.reduce((sum, leg) => sum + legPnl(leg, x) * lot, 0));
  const maxPnl = Math.max(...pnls);
  const minPnl = Math.min(...pnls);
  const breakevens = [];
  for (let i = 1; i < pnls.length; i++) {
    if ((pnls[i-1] < 0 && pnls[i] >= 0) || (pnls[i-1] >= 0 && pnls[i] < 0)) {
      const x = xs[i-1] + (xs[i]-xs[i-1]) * (-pnls[i-1]) / (pnls[i]-pnls[i-1]);
      breakevens.push(Math.round(x));
    }
  }
  const currentPnl = legs.reduce((sum, leg) => sum + legPnl(leg, s) * lot, 0);

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: "Max Profit", value: maxPnl > 1e6 ? "Unlimited" : `₹${Math.round(maxPnl).toLocaleString("en-IN")}`, color: "text-green-600" },
          { label: "Max Loss",   value: minPnl < -1e6 ? "Unlimited" : `₹${Math.round(minPnl).toLocaleString("en-IN")}`, color: "text-red-500" },
          { label: "Breakeven",  value: breakevens.length ? breakevens.join(" / ") : "—", color: "text-amber-600" },
          { label: "P&L @ Spot", value: `₹${Math.round(currentPnl).toLocaleString("en-IN")}`, color: currentPnl >= 0 ? "text-green-600" : "text-red-500" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-gray-400 mb-0.5">{label}</div>
            <div className={`text-sm font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "relative", height: "220px" }}>
        <canvas ref={ref} />
      </div>
    </div>
  );
}

// ─── Journal Entry Card ───────────────────────────────────────────────────────
function JournalCard({ entry, onDelete, onUpdate }) {
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState(false);
  const [exitLegs, setExitLegs] = useState(
    entry.exitLegs ?? entry.legs.map(l => ({ ...l, exitPremium: "" }))
  );
  const [editNotes, setEditNotes] = useState(entry.notes ?? "");
  const [status, setStatus] = useState(entry.status ?? "OPEN");

  const calcRealizedPnl = (legs, exits, lot) => {
    return legs.reduce((sum, leg, i) => {
      const exit   = exits[i];
      const entryP = Number(leg.premium);
      const exitP  = Number(exit?.exitPremium);
      if (!exitP && exitP !== 0) return sum;
      const qty = Number(leg.qty);
      let pnl = 0;
      if (leg.action === "BUY") {
        // Long: profit when exit > entry
        pnl = (exitP - entryP) * qty * lot;
      } else {
        // Short (SELL): profit when exit < entry (bought back cheaper)
        pnl = (entryP - exitP) * qty * lot;
      }
      return sum + pnl;
    }, 0);
  };

  const realizedPnl = calcRealizedPnl(entry.legs, exitLegs, entry.lot);
  const allFilled = exitLegs.every(l => l.exitPremium !== "" && !isNaN(Number(l.exitPremium)));

  const saveEdit = () => {
    onUpdate(entry.id, {
      exitLegs,
      notes: editNotes,
      status,
      realizedPnl: allFilled ? realizedPnl : entry.realizedPnl,
    });
    setEditing(false);
  };

  const pnlVal = entry.realizedPnl ?? null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono text-gray-400">{entry.date}</span>
          <span className="text-sm font-medium text-gray-700">{entry.underlying}</span>
          <span className="text-xs text-gray-500">{entry.name}</span>
          {entry.expiry && (
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded">
              {entry.expiry}{entry.dte != null ? ` · ${entry.dte}d` : ""}
            </span>
          )}
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{entry.legs.length} legs</span>
          {entry.status === "CLOSED" && (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${pnlVal >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
              {pnlVal >= 0 ? "+" : ""}₹{Math.round(pnlVal).toLocaleString("en-IN")}
            </span>
          )}
          {entry.status === "OPEN" && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded">Open</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); setEditing(true); setOpen(true); }}
            className="text-xs text-blue-500 hover:text-blue-700 px-2 border border-blue-200 rounded hover:bg-blue-50">
            Edit
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }}
            className="text-xs text-red-400 hover:text-red-600 px-2">✕</button>
          <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div className="p-3">
          {/* Notes */}
          {!editing && entry.notes && <p className="text-xs text-gray-500 mb-2 italic">{entry.notes}</p>}

          {/* Legs table */}
          <table className="w-full text-xs mb-3">
            <thead><tr className="text-gray-400 border-b">
              <th className="text-left py-1">Type</th>
              <th className="text-left py-1">B/S</th>
              <th className="text-right py-1">Strike</th>
              <th className="text-right py-1">Entry</th>
              <th className="text-right py-1">Qty</th>
              {editing && <th className="text-right py-1">Exit Price</th>}
              {!editing && entry.exitLegs && <th className="text-right py-1">Exit</th>}
            </tr></thead>
            <tbody>
              {entry.legs.map((leg, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1 font-medium">{leg.type}</td>
                  <td className={`py-1 font-medium ${leg.action==="BUY"?"text-green-600":"text-red-500"}`}>{leg.action}</td>
                  <td className="text-right py-1">{leg.strike || "—"}</td>
                  <td className="text-right py-1">{leg.premium}</td>
                  <td className="text-right py-1">{leg.qty}</td>
                  {editing && (
                    <td className="text-right py-1">
                      <input
                        type="number"
                        placeholder="Exit ₹"
                        value={exitLegs[i]?.exitPremium ?? ""}
                        onChange={e => {
                          const updated = [...exitLegs];
                          updated[i] = { ...updated[i], exitPremium: e.target.value };
                          setExitLegs(updated);
                        }}
                        className="border border-gray-200 rounded px-1.5 py-0.5 w-20 text-right focus:outline-none focus:border-blue-400"
                      />
                    </td>
                  )}
                  {!editing && entry.exitLegs && (
                    <td className="text-right py-1 text-gray-500">{entry.exitLegs[i]?.exitPremium || "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Edit controls */}
          {editing && (
            <div className="space-y-2 mb-3">
              <div className="flex gap-2 items-center">
                <label className="text-xs text-gray-500 w-16">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400">
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed / Squared Off</option>
                  <option value="ADJUSTED">Adjusted</option>
                </select>
              </div>
              <div className="flex gap-2 items-start">
                <label className="text-xs text-gray-500 w-16 pt-1">Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs resize-none focus:outline-none focus:border-blue-400" />
              </div>
              {allFilled && (
                <div className={`text-sm font-semibold px-3 py-2 rounded-lg ${realizedPnl >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                  Realized P&L: {realizedPnl >= 0 ? "+" : ""}₹{Math.round(realizedPnl).toLocaleString("en-IN")}
                  <span className="text-xs font-normal ml-2 opacity-70">({entry.lot} lot size)</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={saveEdit}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                  Save Changes
                </button>
                <button onClick={() => { setEditing(false); setExitLegs(entry.exitLegs ?? entry.legs.map(l => ({ ...l, exitPremium: "" }))); setEditNotes(entry.notes ?? ""); }}
                  className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg hover:bg-gray-50 text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Payoff chart — show only when not editing */}
          {!editing && <PayoffChart legs={entry.legs} spot={entry.spot || 0} lot={entry.lot} />}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StrategyBuilder({ spot: liveSpot = 0 }) {
  const [underlying, setUnderlying] = useState(UNDERLYINGS[0]);
  const [customLot,  setCustomLot]  = useState(100);
  const [legs,       setLegs]       = useState([emptyLeg()]);
  const [stratName,  setStratName]  = useState("Custom");
  const [notes,      setNotes]      = useState("");
  const [journal,    setJournal]    = useState(loadJournal);
  const [tab,        setTab]        = useState("builder");
  const [editingId,  setEditingId]  = useState(null);
  const [spot,       setSpot]       = useState("");
  const [spotLoading, setSpotLoading] = useState(false);
  const [dhanToken,   setDhanToken]   = useState("");

  // isIndex must be derived before useEffects that depend on it
  const isIndex  = underlying.type === "index";

  // Load Dhan token from Google Sheet (Token!B1) once on mount
  useEffect(() => {
    import("../utils/gsheets").then(({ fetchRange }) => {
      fetchRange("Token", "B1:B1").then(rows => {
        const t = rows?.[0]?.[0];
        if (t) setDhanToken(t.trim());
      }).catch(() => {});
    });
  }, []);
  const expiries = getNSEExpiries(isIndex, 3);
  const [expiry, setExpiry] = useState(() => getNSEExpiries(true, 3)[0].value);

  // Reset expiry when underlying type changes (index ↔ stock)
  useEffect(() => {
    setExpiry(getNSEExpiries(isIndex, 3)[0].value);
  }, [isIndex]);

  const lot = underlying.value === "OTHER" ? customLot : underlying.lot;

  // Apply preset strategy template
  const applyPreset = (name) => {
    setStratName(name);
    const preset = STRATEGIES.find(s => s.label === name);
    if (!preset || !preset.legs.length) return;
    setLegs(preset.legs.map(l => ({ ...emptyLeg(), ...l })));
  };

  const addLeg    = ()     => setLegs(l => [...l, emptyLeg()]);
  const removeLeg = (id)   => setLegs(l => l.filter(x => x.id !== id));
  const updateLeg = (id, field, val) => setLegs(l => l.map(x => x.id === id ? { ...x, [field]: val } : x));

  const saveToJournal = () => {
    if (!legs.length) return alert("Add at least one leg first.");
    const expiryObj = expiries.find(e => e.value === expiry) || expiries[0];
    const entry = {
      id:         Date.now(),
      date:       new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
      underlying: underlying.label,
      symbol:     underlying.value,
      expiry:     expiryObj.label,
      expiryDate: expiryObj.value,
      dte:        expiryObj.daysLeft,
      spot:       Number(spot) || 0,
      name:       stratName,
      lot,
      legs:       legs.map(({ id, ...rest }) => rest),
      notes,
      exitLegs:   null,
      realizedPnl: null,
      status:     "OPEN",
    };
    const updated = [entry, ...journal];
    setJournal(updated);
    saveJournal(updated);
    setNotes("");
    alert("Strategy saved to journal!");
  };

  const deleteEntry = (id) => {
    const updated = journal.filter(e => e.id !== id);
    setJournal(updated);
    saveJournal(updated);
  };

  const updateJournalEntry = (id, patch) => {
    const updated = journal.map(e => e.id === id ? { ...e, ...patch } : e);
    setJournal(updated);
    saveJournal(updated);
  };

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {["builder", "journal"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${tab===t?"border-blue-500 text-blue-600 font-medium":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t === "journal" ? `📓 Journal (${journal.length})` : "🔧 Strategy Builder"}
          </button>
        ))}
      </div>

      {tab === "builder" && (
        <div className="space-y-4">
          {/* Top controls */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Underlying</label>
              <UnderlyingSearch value={underlying} onChange={setUnderlying} />
            </div>
            {underlying.value === "OTHER" && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Lot Size</label>
                <input type="number" value={customLot} onChange={e => setCustomLot(Number(e.target.value))}
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-20 focus:outline-none focus:border-blue-400" />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Expiry <span className="text-gray-400">({isIndex ? "last Thu" : "last Tue"})</span>
              </label>
              <select value={expiry} onChange={e => setExpiry(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400">
                {expiries.map(e => (
                  <option key={e.value} value={e.value}>
                    {e.label} ({e.daysLeft}d)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Strategy Preset</label>
              <select value={stratName} onChange={e => applyPreset(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400">
                {STRATEGIES.map(s => <option key={s.label}>{s.label}</option>)}
              </select>
            </div>
            <div className="text-xs text-gray-400 self-end pb-2">
              Lot: <span className="font-semibold text-gray-600">{lot}</span>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Spot {spotLoading && <span className="text-blue-400">fetching…</span>}
                {!spotLoading && spot && <span className="text-green-500">● live</span>}
              </label>
              <input type="number" value={spot} onChange={e => setSpot(e.target.value)}
                placeholder={spotLoading ? "fetching..." : "e.g. 54900"}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-28 focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          {/* Legs table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Legs</span>
              <button onClick={addLeg}
                className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50">
                + Add Leg
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 px-3 py-1.5 text-xs text-gray-400 font-medium">
                <span>Type</span><span>Action</span><span>Strike</span>
                <span>Premium / Price</span><span>Qty (lots)</span><span></span>
              </div>
              {legs.map(leg => (
                <div key={leg.id} className="grid grid-cols-6 gap-2 px-3 py-2 items-center">
                  <select value={leg.type} onChange={e => updateLeg(leg.id, "type", e.target.value)}
                    className="border border-gray-200 rounded px-1.5 py-1 text-sm bg-white focus:outline-none focus:border-blue-400">
                    <option>CE</option><option>PE</option><option>FUT</option>
                  </select>
                  <select value={leg.action} onChange={e => updateLeg(leg.id, "action", e.target.value)}
                    className={`border rounded px-1.5 py-1 text-sm font-medium focus:outline-none ${leg.action==="BUY"?"border-green-300 text-green-700 bg-green-50":"border-red-300 text-red-600 bg-red-50"}`}>
                    <option>BUY</option><option>SELL</option>
                  </select>
                  <input type="number" value={leg.strike} onChange={e => updateLeg(leg.id, "strike", e.target.value)}
                    placeholder={leg.type==="FUT"?"—":"Strike"}
                    disabled={leg.type==="FUT"}
                    className="border border-gray-200 rounded px-1.5 py-1 text-sm w-full focus:outline-none focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-300" />
                  <input type="number" value={leg.premium} onChange={e => updateLeg(leg.id, "premium", e.target.value)}
                    placeholder={leg.type==="FUT"?"Entry price":"Premium"}
                    className="border border-gray-200 rounded px-1.5 py-1 text-sm w-full focus:outline-none focus:border-blue-400" />
                  <input type="number" value={leg.qty} min={1} onChange={e => updateLeg(leg.id, "qty", e.target.value)}
                    className="border border-gray-200 rounded px-1.5 py-1 text-sm w-16 focus:outline-none focus:border-blue-400" />
                  <button onClick={() => removeLeg(leg.id)}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none justify-self-center">✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Payoff chart */}
          <PayoffChart legs={legs} spot={spot} lot={lot} />

          {/* Save to journal */}
          <div className="flex gap-3 items-start pt-2 border-t border-gray-100">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Notes / reasoning for this trade..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400" />
            <button onClick={saveToJournal}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
              📓 Save to Journal
            </button>
          </div>
        </div>
      )}

      {tab === "journal" && (
        <div className="space-y-2">
          {journal.length === 0
            ? <div className="text-center text-gray-400 text-sm py-12">No strategies saved yet — build one and save it.</div>
            : journal.map(entry => <JournalCard key={entry.id} entry={entry} onDelete={deleteEntry} onUpdate={updateJournalEntry} />)
          }
        </div>
      )}
    </div>
  );
}