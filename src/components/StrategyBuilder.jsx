import { useState, useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

// ─── Constants ────────────────────────────────────────────────────────────────
const UNDERLYINGS = [
  { label: "Bank Nifty",   value: "BANKNIFTY",  lot: 30,  type: "index" },
  { label: "Fin Nifty",    value: "FINNIFTY",   lot: 60,  type: "index" },
  { label: "Midcap Nifty", value: "MIDCPNIFTY", lot: 120, type: "index" },
  { label: "Nifty 50",     value: "NIFTY",      lot: 65,  type: "index" },
  { label: "Nifty Next 50",value: "NIFTYNXT50", lot: 25,  type: "index" },
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
  { label: "Long Straddle",       legs: [{ type:"CE", action:"BUY",  qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Short Straddle",      legs: [{ type:"CE", action:"SELL", qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Long Strangle",       legs: [{ type:"CE", action:"BUY",  qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Short Strangle",      legs: [{ type:"CE", action:"SELL", qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Bull Call Spread",    legs: [{ type:"CE", action:"BUY",  qty:1 }, { type:"CE", action:"SELL", qty:1 }] },
  { label: "Bear Put Spread",     legs: [{ type:"PE", action:"BUY",  qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Bull Put Spread",     legs: [{ type:"PE", action:"SELL", qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Bear Call Spread",    legs: [{ type:"CE", action:"SELL", qty:1 }, { type:"CE", action:"BUY",  qty:1 }] },
  { label: "Iron Condor",         legs: [{ type:"PE", action:"BUY",  qty:1 }, { type:"PE", action:"SELL", qty:1 }, { type:"CE", action:"SELL", qty:1 }, { type:"CE", action:"BUY", qty:1 }] },
  { label: "Iron Butterfly",      legs: [{ type:"PE", action:"BUY",  qty:1 }, { type:"PE", action:"SELL", qty:1 }, { type:"CE", action:"SELL", qty:1 }, { type:"CE", action:"BUY", qty:1 }] },
  { label: "Covered Call",        legs: [{ type:"FUT", action:"BUY",  qty:1 }, { type:"CE", action:"SELL", qty:1 }] },
  { label: "Protective Put",      legs: [{ type:"FUT", action:"BUY",  qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Synthetic Long",      legs: [{ type:"CE", action:"BUY",  qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Synthetic Short",     legs: [{ type:"PE", action:"BUY",  qty:1 }, { type:"CE", action:"SELL", qty:1 }] },
  { label: "Long Fut + Sell CE",  legs: [{ type:"FUT", action:"BUY",  qty:1 }, { type:"CE", action:"SELL", qty:1 }] },
  { label: "Short Fut + Sell PE", legs: [{ type:"FUT", action:"SELL", qty:1 }, { type:"PE", action:"SELL", qty:1 }] },
  { label: "Long Fut + Buy PE",   legs: [{ type:"FUT", action:"BUY",  qty:1 }, { type:"PE", action:"BUY",  qty:1 }] },
  { label: "Short Fut + Buy CE",  legs: [{ type:"FUT", action:"SELL", qty:1 }, { type:"CE", action:"BUY",  qty:1 }] },
];

const INDEX_SYMBOLS = { BANKNIFTY:1, NIFTY:1, FINNIFTY:1, MIDCPNIFTY:1, NIFTYNXT50:1 };

const emptyLeg = () => ({ id: Date.now() + Math.random(), type:"CE", action:"SELL", strike:"", premium:"", qty:1 });

const STORAGE_KEY = "strategy_journal_v1";
function loadJournal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveJournal(entries) { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }

function fmt(n) { return Math.round(n).toLocaleString("en-IN"); }

// ─── Searchable Underlying Dropdown ──────────────────────────────────────────
function UnderlyingSearch({ value, onChange }) {
  const [query, setQuery] = useState(value.label);
  const [open,  setOpen]  = useState(false);
  const ref = useRef(null);

  useEffect(() => { setQuery(value.label); }, [value.label]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = UNDERLYINGS.filter(u =>
    u.label.toLowerCase().includes(query.toLowerCase()) ||
    u.value.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 15);

  return (
    <div ref={ref} style={{ position:"relative", minWidth:180 }}>
      <input value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search symbol…"
        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full focus:outline-none focus:border-blue-400 bg-white" />
      {open && filtered.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:50, marginTop:2, maxHeight:220, overflowY:"auto" }}
          className="border border-gray-200 rounded-lg bg-white shadow-md">
          {filtered.map(u => (
            <div key={u.value} onMouseDown={() => { onChange(u); setQuery(u.label); setOpen(false); }}
              className="flex justify-between items-center px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer">
              <span className={u.value === value.value ? "font-medium text-blue-600" : "text-gray-700"}>
                {u.label}{u.type==="index" && <span className="ml-1 text-xs text-purple-500">IDX</span>}
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
function legPnlAtExpiry(leg, spot) {
  const strike = Number(leg.strike), premium = Number(leg.premium), qty = Number(leg.qty);
  const dir = leg.action === "BUY" ? 1 : -1;
  if (leg.type === "FUT") return dir * (spot - premium) * qty;
  const intrinsic = leg.type === "CE" ? Math.max(0, spot-strike) : Math.max(0, strike-spot);
  return dir * (intrinsic - premium) * qty;
}

// ─── Payoff Chart ─────────────────────────────────────────────────────────────
function PayoffChart({ legs, spot, lot }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !legs.length || !Number(spot)) return;
    const s = Number(spot), range = s * 0.15, pts = 120;
    const xs   = Array.from({ length:pts }, (_, i) => s - range + (2*range*i)/(pts-1));
    const pnls = xs.map(x => legs.reduce((sum, leg) => sum + legPnlAtExpiry(leg, x) * lot, 0));
    const maxP = Math.max(...pnls), minP = Math.min(...pnls);
    const bkes = [];
    for (let i = 1; i < pnls.length; i++) {
      if ((pnls[i-1] < 0) !== (pnls[i] < 0)) {
        bkes.push(Math.round(xs[i-1] + (xs[i]-xs[i-1]) * (-pnls[i-1]) / (pnls[i]-pnls[i-1])));
      }
    }
    const curPnl = legs.reduce((sum, leg) => sum + legPnlAtExpiry(leg, s) * lot, 0);

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: xs.map(x => Math.round(x)),
        datasets: [
          { label:"P&L", data: pnls.map(v => +v.toFixed(0)),
            segment: { borderColor: ctx => ctx.p0.parsed.y >= 0 ? "#22c55e" : "#ef4444",
                       backgroundColor: ctx => ctx.p0.parsed.y >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" },
            borderWidth:2, pointRadius:0, tension:0.2, fill:true },
          { data: xs.map(() => 0), borderColor:"rgba(0,0,0,0.15)", borderWidth:1,
            borderDash:[4,4], pointRadius:0, fill:false },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false, animation:false,
        plugins: { legend:{display:false},
          tooltip:{ callbacks:{ title:i=>`Spot: ${i[0].label}`,
            label:ctx => ctx.datasetIndex===0 ? `P&L: ₹${Number(ctx.parsed.y).toLocaleString("en-IN")}` : null }}},
        scales: {
          x: { ticks:{font:{size:9},maxTicksLimit:12,autoSkip:true}, grid:{color:"rgba(0,0,0,0.04)"},
               title:{display:true,text:"Spot at Expiry",font:{size:10}} },
          y: { ticks:{font:{size:9},callback:v=>Math.abs(v)>=1000?`${(v/1000).toFixed(1)}K`:v},
               grid:{color:ctx=>ctx.tick.value===0?"rgba(0,0,0,0.2)":"rgba(0,0,0,0.04)"},
               title:{display:true,text:"P&L (₹)",font:{size:10}} },
        },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [legs, spot, lot]);

  if (!legs.length || !Number(spot)) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
        Add legs and set spot price to see payoff chart
      </div>
    );
  }

  const s = Number(spot), range = s * 0.15, pts = 120;
  const xs   = Array.from({ length:pts }, (_, i) => s - range + (2*range*i)/(pts-1));
  const pnls = xs.map(x => legs.reduce((sum, leg) => sum + legPnlAtExpiry(leg, x) * lot, 0));
  const maxP = Math.max(...pnls), minP = Math.min(...pnls);
  const bkes = [];
  for (let i = 1; i < pnls.length; i++) {
    if ((pnls[i-1] < 0) !== (pnls[i] < 0))
      bkes.push(Math.round(xs[i-1] + (xs[i]-xs[i-1]) * (-pnls[i-1]) / (pnls[i]-pnls[i-1])));
  }
  const curPnl = legs.reduce((sum, leg) => sum + legPnlAtExpiry(leg, s) * lot, 0);

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label:"Max Profit", val: maxP > 1e6 ? "Unlimited" : `₹${fmt(maxP)}`, cls:"text-green-600" },
          { label:"Max Loss",   val: minP < -1e6 ? "Unlimited" : `₹${fmt(minP)}`, cls:"text-red-500" },
          { label:"Breakeven",  val: bkes.length ? bkes.join(" / ") : "—", cls:"text-amber-600" },
          { label:"P&L @ Spot", val: `₹${fmt(curPnl)}`, cls: curPnl >= 0 ? "text-green-600" : "text-red-500" },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
            <div className="text-xs text-gray-400 mb-0.5">{label}</div>
            <div className={`text-sm font-semibold ${cls}`}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ position:"relative", height:"200px" }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

// ─── Journal Modal ────────────────────────────────────────────────────────────
function JournalModal({ entry, onClose, onDelete, onUpdate }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4 pb-6"
      style={{ background:"rgba(0,0,0,0.5)" }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono text-gray-400">{entry.date}</span>
            <span className="font-semibold text-gray-800">{entry.underlying}</span>
            <span className="text-sm text-gray-500">{entry.name}</span>
            {entry.expiry && (
              <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                {entry.expiry}{entry.dte != null ? ` · ${entry.dte}d` : ""}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-1">×</button>
        </div>
        <div className="p-6">
          <JournalCardBody key={entry.id} entry={entry} onDelete={id => { onDelete(id); onClose(); }} onUpdate={onUpdate} inModal />
        </div>
      </div>
    </div>
  );
}

// ─── Journal Card Body ────────────────────────────────────────────────────────
function JournalCardBody({ entry, onDelete, onUpdate, inModal = false }) {
  const [editing,   setEditing]   = useState(false);
  const [exitLegs,  setExitLegs]  = useState(() => entry.exitLegs ?? entry.legs.map(l => ({ ...l, exitPremium:"" })));
  const [editLegs,  setEditLegs]  = useState(() => entry.legs.map(l => ({ ...l })));
  const [editNotes, setEditNotes] = useState(entry.notes ?? "");
  const [editDate,  setEditDate]  = useState(entry.tradeDate ?? "");
  const [status,    setStatus]    = useState(entry.status ?? "OPEN");

  useEffect(() => {
    if (!editing) {
      setExitLegs(entry.exitLegs ?? entry.legs.map(l => ({ ...l, exitPremium:"" })));
      setEditLegs(entry.legs.map(l => ({ ...l })));
      setEditNotes(entry.notes ?? "");
      setEditDate(entry.tradeDate ?? "");
      setStatus(entry.status ?? "OPEN");
    }
  }, [entry.id, entry.status, entry.legs.length, editing]);

  const isIndex = !!INDEX_SYMBOLS[entry.symbol];
  const [livePnl,  setLivePnl]  = useState(null);
  const [liveSpot, setLiveSpot] = useState(null);
  const [legCmps,  setLegCmps]  = useState({});
  const [liveLoad, setLiveLoad] = useState(false);
  const alive = useRef(true);

  const doFetchLive = async () => {
    if (!isIndex || entry.status !== "OPEN") return;
    setLiveLoad(true);
    try {
      // Step 1: get expiry — use saved expiryDate or fetch nearest from /expiries
      let expiry = entry.expiryDate || "";
      if (!expiry) {
        try {
          const eRes  = await fetch(`${PROXY}/expiries?symbol=${entry.symbol}`);
          const eJson = await eRes.json();
          expiry = eJson?.expiries?.[0]?.value ?? "";
        } catch (_) {}
      }
      if (!alive.current) return;

      // Step 2: fetch option LTP via Breeze /option_ltp (cached 5 min)
      const optLegs = entry.legs.filter(l => l.type !== "FUT" && l.strike);
      let strikeMap  = {};
      let breezeSpot = null;
      if (optLegs.length > 0 && expiry) {
        const strikes = [...new Set(optLegs.map(l => String(l.strike)))].join(",");
        const oRes    = await fetch(`${PROXY}/option_ltp?symbol=${entry.symbol}&expiry=${expiry}&strikes=${strikes}`);
        const oJson   = await oRes.json();
        strikeMap  = oJson?.data ?? {};
        breezeSpot = oJson?.spot ?? null;
      }

      // Step 3: spot — Breeze first, yfinance fallback
      let effectiveSpot = breezeSpot || 0;
      if (!effectiveSpot) {
        try {
          const qRes  = await fetch(`${PROXY}/quotes?symbols=${entry.symbol}`);
          const qJson = await qRes.json();
          effectiveSpot = qJson?.data?.[entry.symbol]?.ltp || entry.spot || 0;
        } catch (_) { effectiveSpot = entry.spot || 0; }
      }
      if (effectiveSpot) setLiveSpot(effectiveSpot);
      if (!alive.current) return;

      // Step 4: per-leg CMP and total P&L
      const cmps = {}; let total = 0;
      entry.legs.forEach((leg, i) => {
        const ep  = Number(leg.premium);
        const qty = Number(leg.qty);
        const dir = leg.action === "BUY" ? 1 : -1;
        let cmp;
        if (leg.type === "FUT") {
          cmp = effectiveSpot;  // approximate — no futures LTP endpoint
        } else {
          const sData     = strikeMap[String(leg.strike)];
          const breezeLtp = leg.type === "CE" ? sData?.ce : sData?.pe;
          if (breezeLtp != null && breezeLtp > 0) {
            cmp = breezeLtp;
          } else {
            // Fallback: intrinsic value
            cmp = leg.type === "CE"
              ? Math.max(0, effectiveSpot - Number(leg.strike))
              : Math.max(0, Number(leg.strike) - effectiveSpot);
          }
        }
        cmps[i] = Number(cmp.toFixed(2));
        total  += dir * (cmp - ep) * qty * entry.lot;
      });

      setLegCmps(cmps);
      setLivePnl(Math.round(total));
    } catch (e) {
      console.warn("Live P&L fetch failed:", e);
    } finally {
      if (alive.current) setLiveLoad(false);
    }
  };

  useEffect(() => {
    alive.current = true;
    if (isIndex && entry.status === "OPEN") doFetchLive();
    return () => { alive.current = false; };
  }, [entry.id]); // eslint-disable-line

  const addEditLeg    = () => {
    const leg = { type:"CE", action:"SELL", strike:"", premium:"", qty:1 };
    setEditLegs(l => [...l, leg]);
    setExitLegs(x => [...x, { ...leg, exitPremium:"" }]);
  };
  const removeEditLeg = i => {
    setEditLegs(l => l.filter((_,idx) => idx !== i));
    setExitLegs(x => x.filter((_,idx) => idx !== i));
  };
  const updateEditLeg = (i, f, v) => setEditLegs(l => l.map((leg,idx) => idx===i ? {...leg,[f]:v} : leg));
  const updateExitLeg = (i, v) => setExitLegs(x => x.map((leg,idx) => idx===i ? {...leg,exitPremium:v} : leg));

  const calcPnl = (legs, exits, lot) => legs.reduce((sum, leg, i) => {
    const ep = Number(leg.premium), xp = Number(exits[i]?.exitPremium);
    if (exits[i]?.exitPremium === "" || isNaN(xp)) return sum;
    return sum + (leg.action==="BUY" ? xp-ep : ep-xp) * Number(leg.qty) * lot;
  }, 0);

  const realizedPnl = calcPnl(editLegs, exitLegs, entry.lot);
  const allFilled   = exitLegs.every(l => l.exitPremium !== "" && !isNaN(Number(l.exitPremium)));
  const pnlVal      = entry.realizedPnl ?? null;
  const showLive    = entry.status === "OPEN" && isIndex && livePnl !== null;

  const saveEdit = () => {
    const dateLabel = editDate
      ? new Date(editDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })
      : entry.date;
    onUpdate(entry.id, {
      legs: editLegs, exitLegs, notes: editNotes, status,
      date: dateLabel, tradeDate: editDate,
      realizedPnl: allFilled ? realizedPnl : entry.realizedPnl,
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditLegs(entry.legs.map(l => ({...l})));
    setExitLegs(entry.exitLegs ?? entry.legs.map(l => ({...l, exitPremium:""})));
    setEditNotes(entry.notes ?? "");
    setEditDate(entry.tradeDate ?? "");
    setStatus(entry.status ?? "OPEN");
  };

  const displayLegs = editing ? editLegs : entry.legs;

  return (
    <div className="space-y-3">
      {!editing && entry.notes && (
        <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2">{entry.notes}</p>
      )}
      {editing && (
        <div className="flex gap-3 items-center flex-wrap bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Trade Date</label>
            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-blue-400" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-xs bg-white focus:outline-none">
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="ADJUSTED">Adjusted</option>
            </select>
          </div>
        </div>
      )}
      <div className={inModal ? "flex gap-4 items-start" : ""}>
        <div className={inModal ? "flex-1 min-w-0" : ""}>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-400 border-b border-gray-100 text-right">
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">B/S</th>
                  <th className="px-3 py-2">Strike</th>
                  <th className="px-3 py-2">Entry ₹</th>
                  <th className="px-3 py-2">Qty</th>
                  {!editing && isIndex && entry.status === "OPEN" && <th className="px-3 py-2 text-blue-500">CMP</th>}
                  {!editing && isIndex && entry.status === "OPEN" && <th className="px-3 py-2">Leg P&L</th>}
                  {editing && <th className="px-3 py-2">Exit ₹</th>}
                  {editing && <th className="px-2 py-2 w-6"></th>}
                  {!editing && entry.status === "CLOSED" && entry.exitLegs && <th className="px-3 py-2">Exit ₹</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayLegs.map((leg, i) => {
                  const cmp    = legCmps[i];
                  const ep     = Number(leg.premium);
                  const qty    = Number(leg.qty);
                  const dir    = leg.action === "BUY" ? 1 : -1;
                  const legPnl = cmp != null ? Math.round(dir * (cmp - ep) * qty * entry.lot) : null;
                  return (
                    <tr key={i} className="hover:bg-gray-50/50 text-right">
                      <td className="text-left px-3 py-2">
                        {editing
                          ? <select value={leg.type} onChange={e => updateEditLeg(i,"type",e.target.value)}
                              className="border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none">
                              <option>CE</option><option>PE</option><option>FUT</option>
                            </select>
                          : <span className="font-medium text-gray-700">{leg.type}</span>}
                      </td>
                      <td className="text-left px-3 py-2">
                        {editing
                          ? <select value={leg.action} onChange={e => updateEditLeg(i,"action",e.target.value)}
                              className={`border rounded px-1.5 py-1 text-xs font-medium bg-white focus:outline-none ${leg.action==="BUY"?"border-green-300 text-green-700":"border-red-300 text-red-600"}`}>
                              <option>BUY</option><option>SELL</option>
                            </select>
                          : <span className={`font-semibold ${leg.action==="BUY"?"text-green-600":"text-red-500"}`}>{leg.action}</span>}
                      </td>
                      <td className="px-3 py-2">
                        {editing
                          ? <input type="number" value={leg.strike} onChange={e => updateEditLeg(i,"strike",e.target.value)}
                              className="border border-gray-200 rounded px-1.5 py-1 text-xs w-20 text-right bg-white focus:outline-none" />
                          : (leg.strike || "—")}
                      </td>
                      <td className="px-3 py-2">
                        {editing
                          ? <input type="number" value={leg.premium} onChange={e => updateEditLeg(i,"premium",e.target.value)}
                              className="border border-gray-200 rounded px-1.5 py-1 text-xs w-20 text-right bg-white focus:outline-none" />
                          : leg.premium}
                      </td>
                      <td className="px-3 py-2">
                        {editing
                          ? <input type="number" value={leg.qty} min={1} onChange={e => updateEditLeg(i,"qty",e.target.value)}
                              className="border border-gray-200 rounded px-1.5 py-1 text-xs w-14 text-right bg-white focus:outline-none" />
                          : leg.qty}
                      </td>
                      {!editing && isIndex && entry.status === "OPEN" && (
                        <td className="px-3 py-2 text-blue-600 font-medium">
                          {cmp != null ? cmp.toLocaleString("en-IN") : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {!editing && isIndex && entry.status === "OPEN" && (
                        <td className={`px-3 py-2 font-semibold ${legPnl == null ? "text-gray-300" : legPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {legPnl != null ? `${legPnl >= 0?"+":""}₹${fmt(legPnl)}` : "—"}
                        </td>
                      )}
                      {editing && (
                        <td className="px-3 py-2">
                          <input type="number" placeholder="Exit ₹"
                            value={exitLegs[i]?.exitPremium ?? ""}
                            onChange={e => updateExitLeg(i, e.target.value)}
                            className="border border-gray-200 rounded px-1.5 py-1 text-xs w-20 text-right bg-white focus:outline-none focus:border-blue-400" />
                        </td>
                      )}
                      {editing && (
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => removeEditLeg(i)} className="text-gray-300 hover:text-red-400 text-base">✕</button>
                        </td>
                      )}
                      {!editing && entry.status === "CLOSED" && entry.exitLegs && (
                        <td className="px-3 py-2 text-gray-500">{entry.exitLegs[i]?.exitPremium || "—"}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {editing && (
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                <button onClick={addEditLeg}
                  className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50">
                  + Add Leg
                </button>
              </div>
            )}
            {!editing && showLive && (
              <div className={`flex items-center justify-between px-3 py-2 border-t border-gray-100 ${livePnl >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live @ spot {liveSpot?.toLocaleString("en-IN")}
                  <button onClick={doFetchLive} disabled={liveLoad}
                    className="text-[10px] text-blue-500 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-50 disabled:opacity-40 ml-1">
                    {liveLoad ? "…" : "↻"}
                  </button>
                </div>
                <span className={`text-sm font-bold ${livePnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {livePnl >= 0?"+":""}₹{fmt(livePnl)}
                </span>
              </div>
            )}
            {!editing && entry.status === "CLOSED" && pnlVal != null && (
              <div className={`flex justify-between px-3 py-2 border-t border-gray-100 ${pnlVal >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <span className="text-xs text-gray-500">Realized P&L</span>
                <span className={`text-sm font-bold ${pnlVal >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {pnlVal >= 0?"+":""}₹{fmt(pnlVal)}
                </span>
              </div>
            )}
          </div>
          {editing && (
            <div className="space-y-2 mt-2">
              <div className="flex gap-2 items-start">
                <label className="text-xs text-gray-500 w-14 pt-1.5">Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs resize-none bg-white focus:outline-none focus:border-blue-400" />
              </div>
              {allFilled && (
                <div className={`text-sm font-semibold px-3 py-2.5 rounded-lg ${realizedPnl >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                  Realized P&L: {realizedPnl >= 0?"+":""}₹{fmt(realizedPnl)}
                  <span className="text-xs font-normal ml-2 opacity-70">(lot {entry.lot})</span>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={saveEdit}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                  Save Changes
                </button>
                <button onClick={cancelEdit}
                  className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg hover:bg-gray-50 text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {inModal && (
          <div className="w-[400px] shrink-0">
            <PayoffChart legs={editing ? editLegs : entry.legs} spot={entry.spot || 0} lot={entry.lot} />
          </div>
        )}
      </div>
      {!inModal && !editing && (
        <PayoffChart legs={entry.legs} spot={entry.spot || 0} lot={entry.lot} />
      )}
      {!inModal && editing && (
        <PayoffChart legs={editLegs} spot={entry.spot || 0} lot={entry.lot} />
      )}
      {!editing && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
            ✏️ Edit
          </button>
          <button onClick={() => onDelete(entry.id)}
            className="px-3 py-1.5 text-xs text-red-400 border border-red-200 rounded-lg hover:bg-red-50">
            🗑 Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Journal Card ─────────────────────────────────────────────────────────────
function JournalCard({ entry, onDelete, onUpdate, onOpenModal }) {
  const pnlVal   = entry.realizedPnl ?? null;
  const isIndex  = !!INDEX_SYMBOLS[entry.symbol];
  const showOpen = entry.status === "OPEN";

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={() => onOpenModal(entry)}>
        <div className="flex items-center gap-2.5 flex-wrap">
          {entry.sr != null && <span className="text-xs font-bold text-gray-400 min-w-[24px]">#{entry.sr}</span>}
          <span className="text-xs font-mono text-gray-400 min-w-[80px]">{entry.date}</span>
          <span className="text-sm font-semibold text-gray-800">{entry.underlying}</span>
          <span className="text-xs text-gray-500">{entry.name}</span>
          {entry.expiry && (
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
              {entry.expiry}{entry.dte != null ? ` · ${entry.dte}d` : ""}
            </span>
          )}
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{entry.legs.length} legs</span>
          {entry.status === "CLOSED" && pnlVal !== null && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pnlVal >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
              {pnlVal >= 0?"+":""}₹{fmt(pnlVal)}
            </span>
          )}
          {showOpen && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">Open</span>}
          {isIndex && showOpen && <span className="text-xs text-blue-400">● Live</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onOpenModal(entry); }}
            className="text-xs text-blue-500 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50">
            Open
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }}
            className="text-xs text-red-400 hover:text-red-600 px-1.5">✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StrategyBuilder() {
  const [underlying, setUnderlying] = useState(UNDERLYINGS[0]);
  const [customLot,  setCustomLot]  = useState(100);
  const [legs,       setLegs]       = useState([emptyLeg()]);
  const [stratName,  setStratName]  = useState("Custom");
  const [notes,      setNotes]      = useState("");
  const [journal,    setJournal]    = useState(loadJournal);
  const [tab,        setTab]        = useState("builder");
  const [tradeDate,  setTradeDate]  = useState(() => new Date().toISOString().slice(0,10));
  const [modalEntry, setModalEntry] = useState(null);

  const [spot,       setSpot]       = useState("");
  const [spotLoad,   setSpotLoad]   = useState(false);
  const [spotIsLive, setSpotIsLive] = useState(false);

  const [expiries,   setExpiries]   = useState([]);
  const [expiry,     setExpiry]     = useState("");
  const [expiryLoad, setExpiryLoad] = useState(false);

  const isIndex = underlying.type === "index";
  const lot     = underlying.value === "OTHER" ? customLot : underlying.lot;

  // ── Expiry rules ──────────────────────────────────────────────────────────
  // NSE (effective Sep 2025):
  //   NIFTY        — weekly every Tuesday + monthly last Tuesday
  //   BANKNIFTY    — monthly last Tuesday only (no weekly)
  //   FINNIFTY     — monthly last Tuesday only (no weekly)
  //   MIDCPNIFTY   — monthly last Tuesday only (no weekly)
  //   NIFTYNXT50   — monthly last Tuesday only (no weekly)
  //   All stocks   — monthly last Tuesday only
  // Primary source: PROXY /expiries (Dhan API, holiday-aware)
  // Fallback: calendar computation below (not holiday-aware)
  const calendarExpiries = (sym) => {
    const today  = new Date(); today.setHours(0, 0, 0, 0);
    const result = []; const seen = new Set();

    // Only NIFTY has weekly Tuesday expiries
    const isNiftyWeekly = sym === "NIFTY";

    if (isNiftyWeekly) {
      // Every Tuesday for next 12 weeks (weekly + monthly mixed)
      const d = new Date(today);
      while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
      for (let i = 0; i < 12; i++) {
        const key = d.toISOString().slice(0, 10);
        const dl  = Math.ceil((d - today) / 86400000);
        if (!seen.has(key) && dl >= 0) {
          seen.add(key);
          result.push({
            label:    d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
            value:    key,
            daysLeft: dl,
          });
        }
        d.setDate(d.getDate() + 7);
      }
    } else {
      // BankNifty / FinNifty / MidcapNifty / NiftyNxt50 / all stocks:
      // last Tuesday of each month for next 4 months
      for (let m = 0; m < 4; m++) {
        const d = new Date(today.getFullYear(), today.getMonth() + m + 1, 0);
        while (d.getDay() !== 2) d.setDate(d.getDate() - 1);
        const key = d.toISOString().slice(0, 10);
        const dl  = Math.ceil((d - today) / 86400000);
        if (!seen.has(key) && dl >= 0) {
          seen.add(key);
          result.push({
            label:    d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
            value:    key,
            daysLeft: dl,
          });
        }
      }
    }
    return result;
  };

  // Fetch expiries — proxy first (Dhan API, holiday-aware), calendar fallback
  useEffect(() => {
    setExpiryLoad(true);
    setExpiries([]);
    setExpiry("");
    fetch(`${PROXY}/expiries?symbol=${underlying.value}`)
      .then(r => r.json())
      .then(json => {
        if (json.expiries?.length) {
          setExpiries(json.expiries);
          setExpiry(json.expiries[0].value);
        } else {
          throw new Error("empty");
        }
      })
      .catch(() => {
        const fb = calendarExpiries(underlying.value);
        if (fb.length) { setExpiries(fb); setExpiry(fb[0].value); }
      })
      .finally(() => setExpiryLoad(false));
  }, [underlying.value]);

  useEffect(() => {
    setSpotIsLive(false);
    setSpot("");
    setSpotLoad(true);
    fetch(`${PROXY}/quotes?symbols=${underlying.value}`)
      .then(r => r.json())
      .then(json => {
        const ltp = json?.data?.[underlying.value]?.ltp;
        if (ltp) { setSpot(String(ltp)); setSpotIsLive(true); return; }
        if (isIndex && expiry) {
          return fetch(`${PROXY}/option_ltp?symbol=${underlying.value}&expiry=${expiry}&strikes=`)
            .then(r => r.json())
            .then(j => { if (j.spot) { setSpot(String(j.spot)); setSpotIsLive(true); } });
        }
      })
      .catch(() => {})
      .finally(() => setSpotLoad(false));
  }, [underlying.value]);

  const refreshSpot = () => {
    setSpotIsLive(false);
    setSpotLoad(true);
    fetch(`${PROXY}/quotes?symbols=${underlying.value}`)
      .then(r => r.json())
      .then(json => {
        const ltp = json?.data?.[underlying.value]?.ltp;
        if (ltp) { setSpot(String(ltp)); setSpotIsLive(true); return; }
        if (isIndex && expiry) {
          return fetch(`${PROXY}/option_ltp?symbol=${underlying.value}&expiry=${expiry}&strikes=`)
            .then(r => r.json())
            .then(j => { if (j.spot) { setSpot(String(j.spot)); setSpotIsLive(true); } });
        }
      })
      .catch(() => {})
      .finally(() => setSpotLoad(false));
  };

  const applyPreset = name => {
    setStratName(name);
    const preset = STRATEGIES.find(s => s.label === name);
    if (!preset || !preset.legs.length) return;
    setLegs(preset.legs.map(l => ({ ...emptyLeg(), ...l })));
  };

  const addLeg    = () => setLegs(l => [...l, emptyLeg()]);
  const removeLeg = id => setLegs(l => l.filter(x => x.id !== id));
  const updateLeg = (id, field, val) => setLegs(l => l.map(x => x.id === id ? { ...x, [field]:val } : x));

  const saveToJournal = () => {
    if (!legs.length) return alert("Add at least one leg first.");
    const expiryObj = expiries.find(e => e.value === expiry) ?? expiries[0];
    const maxSr     = journal.reduce((m, e) => Math.max(m, e.sr ?? 0), 0);
    const entry = {
      id:             Date.now(),
      sr:             maxSr + 1,
      date:           new Date(tradeDate).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
      tradeDate,
      underlying:     underlying.label,
      symbol:         underlying.value,
      underlyingType: underlying.type,
      expiry:         expiryObj?.label ?? "",
      expiryDate:     expiryObj?.value ?? "",
      dte:            expiryObj?.daysLeft ?? 0,
      spot:           Number(spot) || 0,
      name:           stratName,
      lot,
      legs:           legs.map(({ id, ...rest }) => rest),
      notes,
      exitLegs:       null,
      realizedPnl:    null,
      status:         "OPEN",
    };
    const updated = [entry, ...journal];
    setJournal(updated);
    saveJournal(updated);
    setNotes("");
    alert("Saved to Journal!");
  };

  const deleteEntry = id => {
    const updated = journal.filter(e => e.id !== id);
    setJournal(updated); saveJournal(updated);
  };

  const updateJournalEntry = (id, patch) => {
    const updated = journal.map(e => e.id === id ? { ...e, ...patch } : e);
    setJournal(updated); saveJournal(updated);
    if (modalEntry?.id === id) setModalEntry(prev => ({ ...prev, ...patch }));
  };

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {[["builder","🔧 Strategy Builder"],["journal",`📓 Journal (${journal.length})`]].map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${tab===k?"border-blue-500 text-blue-600 font-medium":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Strategy Builder ── */}
      {tab === "builder" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Underlying</label>
              <UnderlyingSearch value={underlying} onChange={u => setUnderlying(u)} />
            </div>
            {underlying.value === "OTHER" && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Lot Size</label>
                <input type="number" value={customLot} onChange={e => setCustomLot(Number(e.target.value))}
                  className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-20 bg-white focus:outline-none focus:border-blue-400" />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Expiry {expiryLoad && <span className="text-blue-400 ml-1">loading…</span>}
              </label>
              <select value={expiry} onChange={e => setExpiry(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400">
                {expiries.length === 0 && <option value="">—</option>}
                {expiries.map(e => (
                  <option key={e.value} value={e.value}>{e.label} ({e.daysLeft}d)</option>
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
              Lot: <span className="font-semibold text-gray-700">{lot}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <label className="text-xs text-gray-500">Spot</label>
                {spotLoad && <span className="text-[10px] text-blue-400">fetching…</span>}
                {!spotLoad && spotIsLive && spot && <span className="text-[10px] text-emerald-500">● live</span>}
                <button onClick={refreshSpot} title="Refresh spot"
                  className="text-[10px] text-blue-400 hover:text-blue-600 border border-blue-200 rounded px-1 leading-none">↻</button>
              </div>
              <input type="number" value={spot}
                onChange={e => { setSpot(e.target.value); setSpotIsLive(false); }}
                placeholder="e.g. 54900"
                style={{ color: "#1f2937", backgroundColor: "#ffffff", opacity: 1 }}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-28 focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Trade Date</label>
              <input type="date" value={tradeDate} onChange={e => setTradeDate(e.target.value)}
                className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-400" />
            </div>
            <div className="ml-auto self-end">
              <button onClick={saveToJournal}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap">
                📓 Save to Journal
              </button>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Legs</span>
                  <button onClick={addLeg}
                    className="text-xs text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50">
                    + Add Leg
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="grid grid-cols-6 gap-2 px-3 py-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                    <span>Type</span><span>Action</span><span>Strike</span>
                    <span>Premium</span><span>Qty (lots)</span><span></span>
                  </div>
                  {legs.map(leg => (
                    <div key={leg.id} className="grid grid-cols-6 gap-2 px-3 py-2 items-center hover:bg-gray-50/50">
                      <select value={leg.type} onChange={e => updateLeg(leg.id,"type",e.target.value)}
                        className="border border-gray-200 rounded-lg px-1.5 py-1 text-sm bg-white focus:outline-none focus:border-blue-400">
                        <option>CE</option><option>PE</option><option>FUT</option>
                      </select>
                      <select value={leg.action} onChange={e => updateLeg(leg.id,"action",e.target.value)}
                        className={`border rounded-lg px-1.5 py-1 text-sm font-semibold focus:outline-none ${leg.action==="BUY"?"border-green-300 text-green-700 bg-green-50":"border-red-300 text-red-600 bg-red-50"}`}>
                        <option>BUY</option><option>SELL</option>
                      </select>
                      <input type="number" value={leg.strike}
                        onChange={e => updateLeg(leg.id,"strike",e.target.value)}
                        placeholder={leg.type==="FUT"?"—":"Strike"}
                        disabled={leg.type==="FUT"}
                        className="border border-gray-200 rounded-lg px-1.5 py-1 text-sm w-full bg-white focus:outline-none focus:border-blue-400 disabled:bg-gray-100 disabled:text-gray-400" />
                      <input type="number" value={leg.premium}
                        onChange={e => updateLeg(leg.id,"premium",e.target.value)}
                        placeholder={leg.type==="FUT"?"Entry":"Premium"}
                        className="border border-gray-200 rounded-lg px-1.5 py-1 text-sm w-full bg-white focus:outline-none focus:border-blue-400" />
                      <input type="number" value={leg.qty} min={1}
                        onChange={e => updateLeg(leg.id,"qty",e.target.value)}
                        className="border border-gray-200 rounded-lg px-1.5 py-1 text-sm w-full bg-white focus:outline-none focus:border-blue-400" />
                      <button onClick={() => removeLeg(leg.id)}
                        className="text-gray-300 hover:text-red-400 text-lg leading-none justify-self-center">✕</button>
                    </div>
                  ))}
                  {legs.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-gray-400">
                      Click "+ Add Leg" or choose a Strategy Preset above.
                    </div>
                  )}
                </div>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Notes / reasoning for this trade…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none bg-white focus:outline-none focus:border-blue-400" />
            </div>
            <div className="w-[460px] shrink-0">
              <PayoffChart legs={legs} spot={spot} lot={lot} />
            </div>
          </div>
        </div>
      )}

      {/* ── Journal ── */}
      {tab === "journal" && (() => {
        const openEntries   = [...journal].filter(e => e.status !== "CLOSED").sort((a,b) => (b.sr??0)-(a.sr??0));
        const closedEntries = [...journal].filter(e => e.status === "CLOSED").sort((a,b) => (b.sr??0)-(a.sr??0));
        const totalPnl      = closedEntries.reduce((s, e) => s + (e.realizedPnl ?? 0), 0);

        const downloadExcel = () => {
          const rows = [
            ["Date","Underlying","Strategy","Expiry","DTE","Spot","Lot","Status","Realized P&L","Notes",
             "Leg1 Type","Leg1 B/S","Leg1 Strike","Leg1 Entry","Leg1 Exit","Leg1 Qty",
             "Leg2 Type","Leg2 B/S","Leg2 Strike","Leg2 Entry","Leg2 Exit","Leg2 Qty",
             "Leg3 Type","Leg3 B/S","Leg3 Strike","Leg3 Entry","Leg3 Exit","Leg3 Qty",
             "Leg4 Type","Leg4 B/S","Leg4 Strike","Leg4 Entry","Leg4 Exit","Leg4 Qty"],
          ];
          journal.forEach(e => {
            const row = [e.date, e.underlying, e.name, e.expiry ?? "", e.dte ?? "", e.spot ?? "", e.lot,
              e.status, e.realizedPnl ?? "", e.notes ?? ""];
            for (let i = 0; i < 4; i++) {
              const leg  = e.legs[i];
              const exit = e.exitLegs?.[i];
              if (leg) row.push(leg.type, leg.action, leg.strike ?? "", leg.premium ?? "", exit?.exitPremium ?? "", leg.qty ?? "");
              else     row.push("","","","","","");
            }
            rows.push(row);
          });
          const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
          const blob = new Blob([csv], { type:"text/csv" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `journal_${new Date().toISOString().slice(0,10)}.csv`;
          a.click();
        };

        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">{journal.length} trades</span>
                <span className="text-xs text-gray-400">
                  {openEntries.length} open · {closedEntries.length} closed
                </span>
                {closedEntries.length > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${totalPnl >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                    Total: {totalPnl >= 0?"+":""}₹{fmt(totalPnl)}
                  </span>
                )}
              </div>
              <button onClick={downloadExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                ⬇ Download CSV
              </button>
            </div>

            {journal.length === 0
              ? <div className="text-center text-gray-400 text-sm py-12">
                  No strategies saved yet — build one and click "Save to Journal".
                </div>
              : <>
                  {openEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Open ({openEntries.length})</span>
                        <div className="flex-1 h-px bg-amber-100" />
                      </div>
                      <div className="space-y-1.5">
                        {openEntries.map((entry) => (
                          <JournalCard key={entry.id} entry={entry}
                            onDelete={deleteEntry}
                            onUpdate={updateJournalEntry}
                            onOpenModal={e => setModalEntry(e)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {closedEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 mt-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Closed ({closedEntries.length})</span>
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className={`text-xs font-semibold ${totalPnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {totalPnl >= 0?"+":""}₹{fmt(totalPnl)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {closedEntries.map((entry) => (
                          <JournalCard key={entry.id} entry={entry}
                            onDelete={deleteEntry}
                            onUpdate={updateJournalEntry}
                            onOpenModal={e => setModalEntry(e)} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
            }
          </div>
        );
      })()}

      {modalEntry && (
        <JournalModal
          entry={modalEntry}
          onClose={() => setModalEntry(null)}
          onDelete={id => { deleteEntry(id); setModalEntry(null); }}
          onUpdate={updateJournalEntry}
        />
      )}
    </div>
  );
}