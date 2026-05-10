#!/usr/bin/env bash
set -e

echo ""
echo "================================================"
echo "  Options Dashboard — Project Setup"
echo "  Data source: Google Sheets (Dhan API backend)"
echo "================================================"
echo ""

mkdir -p src/config src/hooks src/components src/pages src/utils public
echo "✓ Folders created"

# .env
cat > .env << 'EOF'
VITE_GSHEET_API_KEY=YOUR_GOOGLE_SHEETS_API_KEY_HERE
VITE_SHEET_ID=1R6M0MtF4ImEv4s7_KsLwkFlbd_cea47aAZVt_eZOdIs
EOF
echo "✓ .env"

# src/config/sheets.js
cat > src/config/sheets.js << 'EOF'
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
EOF
echo "✓ src/config/sheets.js"

# src/config/indices.js
cat > src/config/indices.js << 'EOF'
export const INDICES = {
  BANKNIFTY:  { label:"Bank Nifty",   sheetKey:"BANKNIFTY", lot:30,  step:100, enabled:true  },
  NIFTY:      { label:"Nifty 50",     sheetKey:"NIFTY",     lot:65,  step:50,  enabled:true  },
  FINNIFTY:   { label:"Fin Nifty",    sheetKey:"FINNIFTY",  lot:40,  step:50,  enabled:false },
  MIDCPNIFTY: { label:"Midcap Nifty", sheetKey:"MIDCP",     lot:50,  step:25,  enabled:false },
};
export const ENABLED_INDICES = Object.entries(INDICES).filter(([,v])=>v.enabled).map(([k,v])=>({key:k,...v}));
export const REFRESH_OPTIONS = [
  {label:"30 sec",value:30},{label:"1 min",value:60},{label:"2 min",value:120},
  {label:"5 min",value:300},{label:"Manual",value:0},
];
EOF
echo "✓ src/config/indices.js"

# src/utils/gsheets.js
cat > src/utils/gsheets.js << 'EOF'
import { SHEET_ID, API_KEY } from "../config/sheets";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export async function fetchRange(sheetName, range="") {
  const tab = range ? `${sheetName}!${range}` : sheetName;
  const url = `${BASE}/${SHEET_ID}/values/${encodeURIComponent(tab)}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err?.error?.message ?? `Sheets API ${res.status}`);
  }
  const json = await res.json();
  return (json.values ?? []).slice(1); // skip header row
}

export function parseRow(row, colMap) {
  const out = {};
  for (const [key,idx] of Object.entries(colMap)) {
    const raw = row[idx];
    const num = parseFloat(raw);
    out[key] = isNaN(num) ? (raw ?? "") : num;
  }
  return out;
}
EOF
echo "✓ src/utils/gsheets.js"

# src/utils/vwap.js
cat > src/utils/vwap.js << 'EOF'
export function vwapFromArray(prices) {
  let cumPV=0, cumVol=0;
  return prices.map((p,i)=>{ cumPV+=p*(i+1); cumVol+=(i+1); return cumPV/cumVol; });
}
EOF
echo "✓ src/utils/vwap.js"

# src/utils/blackScholes.js
cat > src/utils/blackScholes.js << 'EOF'
const erf=x=>{const t=1/(1+0.3275911*Math.abs(x));const p=t*(0.254829592+t*(-0.284496736+t*(1.421413741+t*(-1.453152027+t*1.061405429))));const r=1-p*Math.exp(-x*x);return x>=0?r:-r;};
const N=x=>0.5*(1+erf(x/Math.sqrt(2)));
const pdf=x=>Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);
export function greeks(S,K,T,iv,type,r=0.065){
  if(T<=0)return{delta:0,gamma:0,theta:0,vega:0,rho:0};
  const s=iv/100,sq=Math.sqrt(T),d1=(Math.log(S/K)+(r+0.5*s*s)*T)/(s*sq),d2=d1-s*sq,disc=Math.exp(-r*T);
  return{
    delta: type==="call"?N(d1):N(d1)-1,
    gamma: pdf(d1)/(S*s*sq),
    theta: type==="call"?(-(S*pdf(d1)*s)/(2*sq)-r*K*disc*N(d2))/365:(-(S*pdf(d1)*s)/(2*sq)+r*K*disc*N(-d2))/365,
    vega:  (S*pdf(d1)*sq)/100,
    rho:   type==="call"?(K*T*disc*N(d2))/100:(-K*T*disc*N(-d2))/100,
  };
}
EOF
echo "✓ src/utils/blackScholes.js"

# src/hooks/useSheetData.js
cat > src/hooks/useSheetData.js << 'EOF'
import { useState, useCallback } from "react";
import { fetchRange, parseRow } from "../utils/gsheets";
import { SHEETS, RAW_COLS, PCR_COLS, ATM_COLS } from "../config/sheets";

export function useSheetData() {
  const [data,        setData]        = useState(null);
  const [pcrHistory,  setPcrHistory]  = useState([]);
  const [atmHistory,  setAtmHistory]  = useState({m1:[],atm:[],p1:[]});
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (indexKey, step) => {
    const sheetCfg = SHEETS[indexKey];
    if (!sheetCfg) { setError(`No sheet config for ${indexKey}`); return; }
    setLoading(true); setError(null);
    try {
      // Raw chain
      const rawRows = await fetchRange(sheetCfg.raw, "A:O")
        .then(rows => rows.map(r => parseRow(r, RAW_COLS)));

      // Group latest row per strike for chain view
      const byStrike = {};
      rawRows.forEach(r => { byStrike[r.strike] = r; });
      const chain = Object.values(byStrike).sort((a,b)=>a.strike-b.strike);

      // Spot from last raw row PCR data
      const pcrRows = await fetchRange(sheetCfg.pcr, "A:H")
        .then(rows => rows.map(r => parseRow(r, PCR_COLS)));
      const spot = pcrRows[pcrRows.length-1]?.spot ?? 0;

      // ATM
      const rounded = Math.round(spot / step) * step;
      const atm = chain.find(r=>r.strike===rounded)?.strike
        ?? chain.reduce((b,r)=>Math.abs(r.strike-spot)<Math.abs(b.strike-spot)?r:b, chain[0])?.strike;

      setData({ chain, spot, atm, rawRows });
      setPcrHistory(pcrRows);

      const [m1,atmRows,p1] = await Promise.all([
        fetchRange(sheetCfg.atm_m1,"A:I").then(rows=>rows.map(r=>parseRow(r,ATM_COLS))),
        fetchRange(sheetCfg.atm,   "A:I").then(rows=>rows.map(r=>parseRow(r,ATM_COLS))),
        fetchRange(sheetCfg.atm_p1,"A:I").then(rows=>rows.map(r=>parseRow(r,ATM_COLS))),
      ]);
      setAtmHistory({m1,atm:atmRows,p1});
      setLastUpdated(new Date());
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, pcrHistory, atmHistory, loading, error, lastUpdated, fetchData };
}
EOF
echo "✓ src/hooks/useSheetData.js"

# src/hooks/useRefresh.js
cat > src/hooks/useRefresh.js << 'EOF'
import { useState, useEffect, useRef, useCallback } from "react";
export function useRefresh(onRefresh, init=300) {
  const [countdown, setCountdown] = useState(init);
  const [interval_,  setInterval_]  = useState(init);
  const tRef=useRef(null), cRef=useRef(null);
  const clearAll=useCallback(()=>{ clearInterval(tRef.current); clearInterval(cRef.current); },[]);
  const start=useCallback((s)=>{
    s=s??interval_; clearAll(); if(!s)return; setCountdown(s);
    tRef.current=setInterval(()=>{ onRefresh(); setCountdown(s); },s*1000);
    cRef.current=setInterval(()=>setCountdown(c=>Math.max(0,c-1)),1000);
  },[interval_,onRefresh,clearAll]);
  const setIntervalSecs=useCallback(s=>{ setInterval_(s); start(s); },[start]);
  const manualRefresh=useCallback(()=>{ onRefresh(); if(interval_>0)start(interval_); },[onRefresh,interval_,start]);
  useEffect(()=>{ start(init); return clearAll; },[]); // eslint-disable-line
  return { countdown, interval:interval_, setIntervalSecs, manualRefresh };
}
EOF
echo "✓ src/hooks/useRefresh.js"

# src/components/IndexSelector.jsx
cat > src/components/IndexSelector.jsx << 'EOF'
import { ENABLED_INDICES } from "../config/indices";
export default function IndexSelector({ selected, onChange }) {
  return (
    <div className="flex gap-2">
      {ENABLED_INDICES.map(idx=>(
        <button key={idx.key} onClick={()=>onChange(idx.key)}
          className={`px-4 py-1.5 text-sm rounded-md border transition-colors ${selected===idx.key?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
          {idx.label}
        </button>
      ))}
    </div>
  );
}
EOF
echo "✓ src/components/IndexSelector.jsx"

# src/components/RefreshControl.jsx
cat > src/components/RefreshControl.jsx << 'EOF'
import { REFRESH_OPTIONS } from "../config/indices";
export default function RefreshControl({ interval, countdown, lastUpdated, onIntervalChange, onManualRefresh, loading }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <select value={interval} onChange={e=>onIntervalChange(Number(e.target.value))}
        className="border border-gray-300 rounded-md px-2 py-1 bg-white text-sm focus:outline-none focus:border-blue-400">
        {REFRESH_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {interval>0 && <span className="text-gray-400 tabular-nums w-12">{countdown}s</span>}
      <button onClick={onManualRefresh} disabled={loading}
        className="px-3 py-1 rounded-md border border-gray-300 hover:border-blue-400 text-gray-600 disabled:opacity-40 transition-colors">
        {loading?"...":"↻ Refresh"}
      </button>
      {lastUpdated && <span className="text-gray-400">{lastUpdated.toLocaleTimeString("en-IN")}</span>}
    </div>
  );
}
EOF
echo "✓ src/components/RefreshControl.jsx"

# src/components/OptionChain.jsx
cat > src/components/OptionChain.jsx << 'EOF'
const SIG = { SB:"bg-red-100 text-red-700", LB:"bg-green-100 text-green-700", SC:"bg-yellow-100 text-yellow-700", LU:"bg-purple-100 text-purple-700" };
export default function OptionChain({ chain, atmStrike, selectedStrike, onSelectStrike }) {
  if (!chain?.length) return <div className="text-gray-400 text-sm p-6 text-center">No data yet — run the Python script first.</div>;
  const fmt  = v=>v==null||v===""?"-":Number(v).toLocaleString("en-IN",{maximumFractionDigits:2});
  const fmtK = v=>v==null||v===""?"-":(Number(v)/1000).toFixed(1)+"K";
  return (
    <div className="overflow-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs tabular-nums">
        <thead>
          <tr className="bg-gray-50 text-gray-500 font-normal">
            <th className="text-center px-2 py-2">Sig</th>
            <th className="text-right px-3 py-2">CE ΔOI</th><th className="text-right px-3 py-2">CE OI</th>
            <th className="text-right px-3 py-2">CE IV</th><th className="text-right px-3 py-2 text-blue-600">CE LTP</th>
            <th className="text-center px-3 py-2 bg-yellow-50 text-gray-700 font-medium">Strike</th>
            <th className="text-right px-3 py-2 text-pink-600">PE LTP</th><th className="text-right px-3 py-2">PE IV</th>
            <th className="text-right px-3 py-2">PE OI</th><th className="text-right px-3 py-2">PE ΔOI</th>
            <th className="text-center px-2 py-2">PE Sig</th><th className="text-right px-3 py-2">PCR</th>
          </tr>
        </thead>
        <tbody>
          {chain.map(row=>{
            const isATM=row.strike===atmStrike, isSel=row.strike===selectedStrike;
            return (
              <tr key={row.strike} onClick={()=>onSelectStrike(row.strike)}
                className={`cursor-pointer border-t border-gray-100 transition-colors ${isATM?"bg-yellow-50 font-medium":"hover:bg-gray-50"} ${isSel?"ring-1 ring-inset ring-blue-400":""}`}>
                <td className="text-center px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${SIG[row.signal]??""}`}>{row.signal||"-"}</span></td>
                <td className={`text-right px-3 py-1.5 ${row.ce_oi_chg>0?"text-green-600":"text-red-500"}`}>{fmtK(row.ce_oi_chg)}</td>
                <td className="text-right px-3 py-1.5 text-blue-700">{fmtK(row.ce_oi)}</td>
                <td className="text-right px-3 py-1.5 text-gray-500">{fmt(row.ce_iv)}</td>
                <td className="text-right px-3 py-1.5 text-blue-600 font-medium">{fmt(row.ce_ltp)}</td>
                <td className={`text-center px-3 py-1.5 font-medium ${isATM?"text-orange-600":"text-gray-700"}`}>{row.strike}{isATM&&<span className="ml-1 text-orange-400 text-xs">ATM</span>}</td>
                <td className="text-right px-3 py-1.5 text-pink-600 font-medium">{fmt(row.pe_ltp)}</td>
                <td className="text-right px-3 py-1.5 text-gray-500">{fmt(row.pe_iv)}</td>
                <td className="text-right px-3 py-1.5 text-pink-700">{fmtK(row.pe_oi)}</td>
                <td className={`text-right px-3 py-1.5 ${row.pe_oi_chg>0?"text-green-600":"text-red-500"}`}>{fmtK(row.pe_oi_chg)}</td>
                <td className="text-center px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-xs font-medium ${SIG[row.pe_signal]??""}`}>{row.pe_signal||"-"}</span></td>
                <td className={`text-right px-3 py-1.5 font-medium ${row.pcr>1?"text-green-600":"text-red-500"}`}>{fmt(row.pcr)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
EOF
echo "✓ src/components/OptionChain.jsx"

# src/components/OIChart.jsx
cat > src/components/OIChart.jsx << 'EOF'
import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);
export default function OIChart({ chain, atmStrike }) {
  const ref=useRef(null), inst=useRef(null);
  useEffect(()=>{
    if(!chain?.length||!ref.current)return;
    const ATM=atmStrike??chain[Math.floor(chain.length/2)]?.strike;
    const nearby=chain.filter(r=>Math.abs(r.strike-ATM)<=(ATM>30000?1500:800));
    if(inst.current)inst.current.destroy();
    inst.current=new Chart(ref.current,{
      type:"bar",
      data:{
        labels:nearby.map(r=>r.strike),
        datasets:[
          {label:"CE OI", data:nearby.map(r=>(r.ce_oi??0)/1000),  backgroundColor:"rgba(55,138,221,0.55)",borderColor:"#378ADD",borderWidth:0.5,stack:"oi"},
          {label:"PE OI", data:nearby.map(r=>(r.pe_oi??0)/1000),  backgroundColor:"rgba(212,83,126,0.55)",borderColor:"#D4537E",borderWidth:0.5,stack:"oi"},
          {label:"CE ΔOI",data:nearby.map(r=>(r.ce_oi_chg??0)/1000),borderColor:"#378ADD",borderWidth:1.5,type:"line",pointRadius:0,tension:0.3,yAxisID:"y2",fill:false},
          {label:"PE ΔOI",data:nearby.map(r=>(r.pe_oi_chg??0)/1000),borderColor:"#D4537E",borderWidth:1.5,type:"line",pointRadius:0,tension:0.3,yAxisID:"y2",fill:false},
        ],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:"index",intersect:false},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}K`}}},
        scales:{
          x:{ticks:{font:{size:10},autoSkip:true,maxTicksLimit:15},grid:{color:"rgba(0,0,0,0.04)"}},
          y:{ticks:{font:{size:10},callback:v=>v+"K"},title:{display:true,text:"OI (K)",font:{size:10}},grid:{color:"rgba(0,0,0,0.04)"}},
          y2:{position:"right",ticks:{font:{size:10},callback:v=>v+"K"},title:{display:true,text:"ΔOI (K)",font:{size:10}},grid:{drawOnChartArea:false}},
        },
      },
    });
    return()=>inst.current?.destroy();
  },[chain,atmStrike]);
  return (
    <div>
      <div className="flex gap-4 mb-2 text-xs text-gray-500">
        {[["CE OI","bg-blue-500"],["PE OI","bg-pink-500"],["CE ΔOI","bg-blue-300"],["PE ΔOI","bg-pink-300"]].map(([l,c])=>(
          <span key={l} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-sm inline-block ${c} opacity-70`}></span>{l}</span>
        ))}
      </div>
      <div style={{position:"relative",height:"240px"}}><canvas ref={ref}/></div>
    </div>
  );
}
EOF
echo "✓ src/components/OIChart.jsx"

# src/components/PCRChart.jsx
cat > src/components/PCRChart.jsx << 'EOF'
import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

function LineChart({ canvasRef, data, options }) {
  const inst=useRef(null);
  useEffect(()=>{
    if(!canvasRef.current||!data)return;
    if(inst.current)inst.current.destroy();
    inst.current=new Chart(canvasRef.current,{type:"line",data,options});
    return()=>inst.current?.destroy();
  },[data]);
  return <div style={{position:"relative",height:"220px"}}><canvas ref={canvasRef}/></div>;
}

export default function PCRChart({ pcrHistory, atmHistory }) {
  const pcrRef=useRef(null), atmRef=useRef(null);
  const pcrInst=useRef(null), atmInst=useRef(null);

  useEffect(()=>{
    if(!pcrHistory?.length||!pcrRef.current)return;
    if(pcrInst.current)pcrInst.current.destroy();
    pcrInst.current=new Chart(pcrRef.current,{
      type:"line",
      data:{
        labels:pcrHistory.map(r=>r.time),
        datasets:[
          {label:"CE OI Chg",data:pcrHistory.map(r=>r.ce_oi_chg/1000),borderColor:"#378ADD",borderWidth:2,pointRadius:0,tension:0.3,fill:false},
          {label:"PE OI Chg",data:pcrHistory.map(r=>r.pe_oi_chg/1000),borderColor:"#D4537E",borderWidth:2,pointRadius:0,tension:0.3,fill:false},
          {label:"Spot",     data:pcrHistory.map(r=>r.spot),           borderColor:"#1D9E75",borderWidth:1.5,pointRadius:0,tension:0.3,yAxisID:"y2",fill:false,borderDash:[4,2]},
        ],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:"index",intersect:false},
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{font:{size:10},autoSkip:true,maxTicksLimit:10},grid:{color:"rgba(0,0,0,0.04)"}},
          y:{ticks:{font:{size:10},callback:v=>v+"K"},title:{display:true,text:"OI Chg (K)",font:{size:10}},grid:{color:"rgba(0,0,0,0.04)"}},
          y2:{position:"right",ticks:{font:{size:10}},title:{display:true,text:"Spot",font:{size:10}},grid:{drawOnChartArea:false}},
        },
      },
    });
    return()=>pcrInst.current?.destroy();
  },[pcrHistory]);

  useEffect(()=>{
    if(!atmHistory?.atm?.length||!atmRef.current)return;
    if(atmInst.current)atmInst.current.destroy();
    atmInst.current=new Chart(atmRef.current,{
      type:"line",
      data:{
        labels:atmHistory.atm.map(r=>r.time),
        datasets:[
          {label:"ATM-1 CE",data:atmHistory.m1.map(r=>r.ce_oi_chg/1000), borderColor:"rgba(55,138,221,0.5)", borderWidth:1.5,pointRadius:0,tension:0.3,fill:false},
          {label:"ATM-1 PE",data:atmHistory.m1.map(r=>r.pe_oi_chg/1000), borderColor:"rgba(212,83,126,0.5)", borderWidth:1.5,pointRadius:0,tension:0.3,fill:false},
          {label:"ATM CE",  data:atmHistory.atm.map(r=>r.ce_oi_chg/1000),borderColor:"#378ADD",              borderWidth:2,  pointRadius:2,tension:0.3,fill:false},
          {label:"ATM PE",  data:atmHistory.atm.map(r=>r.pe_oi_chg/1000),borderColor:"#D4537E",              borderWidth:2,  pointRadius:2,tension:0.3,fill:false},
          {label:"ATM+1 CE",data:atmHistory.p1.map(r=>r.ce_oi_chg/1000), borderColor:"rgba(55,138,221,0.5)", borderWidth:1.5,pointRadius:0,tension:0.3,fill:false,borderDash:[3,2]},
          {label:"ATM+1 PE",data:atmHistory.p1.map(r=>r.pe_oi_chg/1000), borderColor:"rgba(212,83,126,0.5)", borderWidth:1.5,pointRadius:0,tension:0.3,fill:false,borderDash:[3,2]},
        ],
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:"index",intersect:false},
        plugins:{legend:{position:"bottom",labels:{font:{size:10},boxWidth:12}}},
        scales:{
          x:{ticks:{font:{size:10},autoSkip:true,maxTicksLimit:10},grid:{color:"rgba(0,0,0,0.04)"}},
          y:{ticks:{font:{size:10},callback:v=>v+"K"},title:{display:true,text:"OI Chg (K)",font:{size:10}},grid:{color:"rgba(0,0,0,0.04)"}},
        },
      },
    });
    return()=>atmInst.current?.destroy();
  },[atmHistory]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Overall CE / PE OI Change + Spot</div>
        <div className="flex gap-4 mb-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-6 h-0.5 inline-block bg-blue-500"></span>CE OI Chg</span>
          <span className="flex items-center gap-1"><span className="w-6 h-0.5 inline-block bg-pink-500"></span>PE OI Chg</span>
          <span className="flex items-center gap-1"><span className="w-6 h-0.5 inline-block bg-teal-500"></span>Spot</span>
        </div>
        <div style={{position:"relative",height:"220px"}}><canvas ref={pcrRef}/></div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">ATM ± 1 Strike OI Change</div>
        <div style={{position:"relative",height:"220px"}}><canvas ref={atmRef}/></div>
      </div>
    </div>
  );
}
EOF
echo "✓ src/components/PCRChart.jsx"

# src/components/StraddleStrangle.jsx
cat > src/components/StraddleStrangle.jsx << 'EOF'
import { useState, useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import { vwapFromArray } from "../utils/vwap";
import { greeks } from "../utils/blackScholes";
Chart.register(...registerables);

const StatCard = ({ label, value, color }) => (
  <div className="bg-gray-50 rounded-lg px-3 py-2">
    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
    <div className={`text-lg font-medium ${color??"text-gray-800"}`}>{value}</div>
  </div>
);

export default function StraddleStrangle({ chain, atmStrike, spot, indexConfig, dte, rawRows }) {
  const [mode,    setMode]    = useState("straddle");
  const [strikeC, setStrikeC] = useState(atmStrike);
  const [strikeP, setStrikeP] = useState(atmStrike);
  const [overlays,setOverlays]= useState({vwap:true,theta:true,be:true,spot:true});
  const chartRef=useRef(null), chartInst=useRef(null);

  useEffect(()=>{ if(atmStrike){setStrikeC(atmStrike);setStrikeP(atmStrike);} },[atmStrike]);

  // Build ticks from rawRows history
  const ticks = (() => {
    if(!rawRows?.length||!strikeC)return[];
    const peK=mode==="strangle"?strikeP:strikeC;
    const byTime={};
    rawRows.forEach(r=>{
      if(!byTime[r.time])byTime[r.time]={};
      byTime[r.time][r.strike]=r;
    });
    return Object.entries(byTime).sort(([a],[b])=>a.localeCompare(b)).map(([time,strikes])=>{
      const ce=strikes[strikeC], pe=strikes[peK];
      if(!ce||!pe)return null;
      return { time, ce:ce.ce_ltp??0, pe:pe.pe_ltp??0, spot:spot??0, ceoi:ce.ce_oi??0, peoi:pe.pe_oi??0 };
    }).filter(Boolean);
  })();

  useEffect(()=>{
    if(!chartRef.current||ticks.length<2)return;
    const combined=ticks.map(t=>+(t.ce+t.pe).toFixed(2));
    const vwapArr=vwapFromArray(combined);
    const datasets=[
      {label:"Combined",data:combined,borderColor:"#378ADD",borderWidth:2,pointRadius:3,tension:0.35,yAxisID:"y",fill:false},
    ];
    if(overlays.vwap) datasets.push({label:"VWAP",data:vwapArr.map(v=>+v.toFixed(2)),borderColor:"#EF9F27",borderWidth:1.5,borderDash:[6,3],pointRadius:0,tension:0.3,yAxisID:"y",fill:false});
    if(overlays.be){
      datasets.push(
        {label:"BE upper",data:ticks.map((_,i)=>+(strikeC+combined[i]).toFixed(0)),borderColor:"rgba(99,153,34,0.7)",borderWidth:1,borderDash:[4,2],pointRadius:0,tension:0.3,yAxisID:"y2",fill:false},
        {label:"BE lower",data:ticks.map((_,i)=>+((mode==="strangle"?strikeP:strikeC)-combined[i]).toFixed(0)),borderColor:"rgba(99,153,34,0.7)",borderWidth:1,borderDash:[4,2],pointRadius:0,tension:0.3,yAxisID:"y2",fill:"-1",backgroundColor:"rgba(99,153,34,0.07)"},
      );
    }
    if(overlays.spot) datasets.push({label:"Spot",data:ticks.map(t=>t.spot),borderColor:"#1D9E75",borderWidth:1.5,borderDash:[3,3],pointRadius:0,tension:0.3,yAxisID:"y2",fill:false});
    if(overlays.theta){
      const T=Math.max(0.001,dte/365);
      const ceRow=chain?.find(r=>r.strike===strikeC), peRow=chain?.find(r=>r.strike===(mode==="strangle"?strikeP:strikeC));
      const thetas=ticks.map((t,i)=>+(
        greeks(t.spot||spot,strikeC,T-i*0.001,ceRow?.ce_iv??14,"call").theta+
        greeks(t.spot||spot,mode==="strangle"?strikeP:strikeC,T-i*0.001,peRow?.pe_iv??14,"put").theta
      ).toFixed(2));
      datasets.push({label:"Theta",data:thetas,borderColor:"#D4537E",borderWidth:1.5,borderDash:[2,2],pointRadius:0,tension:0.3,yAxisID:"y",fill:false});
    }
    if(chartInst.current)chartInst.current.destroy();
    chartInst.current=new Chart(chartRef.current,{
      type:"line",
      data:{labels:ticks.map(t=>t.time),datasets},
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:"index",intersect:false},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`}}},
        scales:{
          x:{ticks:{font:{size:10},autoSkip:true,maxTicksLimit:10},grid:{color:"rgba(0,0,0,0.04)"}},
          y:{position:"left",title:{display:true,text:"Premium",font:{size:10}},ticks:{font:{size:10}},grid:{color:"rgba(0,0,0,0.04)"}},
          y2:{position:"right",title:{display:true,text:"Spot / BE",font:{size:10}},ticks:{font:{size:10}},grid:{drawOnChartArea:false}},
        },
      },
    });
    return()=>chartInst.current?.destroy();
  },[ticks,overlays,strikeC,strikeP,mode,dte,chain,spot]);

  const combined=ticks.map(t=>t.ce+t.pe);
  const curr=combined[combined.length-1]??0, entry=combined[0]??0;
  const vwapArr=vwapFromArray(combined), vwapCurr=vwapArr[vwapArr.length-1]??0;
  const lot=indexConfig?.lot??1, pnl=(curr-entry)*lot;
  const lastTick=ticks[ticks.length-1];
  const pcr=lastTick?(lastTick.peoi/(lastTick.ceoi||1)).toFixed(2):"-";
  const strikes=[...new Set(chain?.map(r=>r.strike)??[])].sort((a,b)=>a-b);
  const toggleO=key=>setOverlays(o=>({...o,[key]:!o[key]}));

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {["straddle","strangle"].map(m=>(
          <button key={m} onClick={()=>setMode(m)}
            className={`px-4 py-1.5 text-sm rounded-md border capitalize transition-colors ${mode===m?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>{m}</button>
        ))}
      </div>
      <div className="flex gap-4 mb-3 flex-wrap text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">CE Strike</span>
          <select value={strikeC} onChange={e=>setStrikeC(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 bg-white text-sm focus:outline-none focus:border-blue-400">
            {strikes.map(s=><option key={s} value={s}>{s}{s===atmStrike?" (ATM)":""}</option>)}
          </select>
        </div>
        {mode==="strangle"&&(
          <div className="flex items-center gap-2">
            <span className="text-gray-500">PE Strike</span>
            <select value={strikeP} onChange={e=>setStrikeP(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 bg-white text-sm focus:outline-none focus:border-blue-400">
              {strikes.map(s=><option key={s} value={s}>{s}{s===atmStrike?" (ATM)":""}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2 mb-3">
        <StatCard label="Combined"        value={curr.toFixed(1)} />
        <StatCard label="VWAP"            value={vwapCurr.toFixed(1)} color="text-amber-600" />
        <StatCard label="vs VWAP"         value={(curr-vwapCurr).toFixed(1)} color={curr>=vwapCurr?"text-green-600":"text-red-500"} />
        <StatCard label={`P&L (${lot}L)`} value={`${pnl>=0?"+":""}${Math.round(pnl)}`} color={pnl>=0?"text-green-600":"text-red-500"} />
        <StatCard label="PCR"             value={pcr} color={Number(pcr)>1?"text-green-600":"text-red-500"} />
      </div>
      <div className="flex gap-2 flex-wrap mb-2">
        {[{key:"vwap",label:"VWAP",c:"bg-amber-400"},{key:"theta",label:"Theta",c:"bg-pink-400"},{key:"be",label:"Breakeven",c:"bg-green-400"},{key:"spot",label:"Spot",c:"bg-teal-500"}].map(({key,label,c})=>(
          <button key={key} onClick={()=>toggleO(key)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-colors ${overlays[key]?"border-gray-300 bg-white":"border-gray-200 bg-gray-50 text-gray-400"}`}>
            <span className={`w-2 h-2 rounded-sm ${overlays[key]?c:"bg-gray-300"}`}></span>{label}
          </button>
        ))}
      </div>
      <div style={{position:"relative",height:"280px"}}>
        {ticks.length<2
          ?<div className="flex items-center justify-center h-full text-gray-400 text-sm">Needs at least 2 data points — data refreshes every 5 min from Python script</div>
          :<canvas ref={chartRef}/>
        }
      </div>
      {ticks.length>0&&(
        <div className="mt-3 overflow-auto max-h-48">
          <table className="w-full text-xs tabular-nums">
            <thead><tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left py-1 px-2">Time</th>
              <th className="text-right py-1 px-2">CE</th><th className="text-right py-1 px-2">PE</th>
              <th className="text-right py-1 px-2">Combined</th><th className="text-right py-1 px-2">VWAP</th>
              <th className="text-right py-1 px-2">vs VWAP</th><th className="text-right py-1 px-2">Spot</th>
            </tr></thead>
            <tbody>
              {ticks.map((t,i)=>{
                const comb=+(t.ce+t.pe).toFixed(1), vw=+vwapArr[i].toFixed(1), diff=+(comb-vw).toFixed(1);
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1 px-2 text-gray-500">{t.time}</td>
                    <td className="text-right py-1 px-2 text-blue-600">{t.ce}</td>
                    <td className="text-right py-1 px-2 text-pink-600">{t.pe}</td>
                    <td className="text-right py-1 px-2 font-medium">{comb}</td>
                    <td className="text-right py-1 px-2 text-amber-600">{vw}</td>
                    <td className={`text-right py-1 px-2 ${diff>0?"text-green-600":diff<0?"text-red-500":""}`}>{diff>0?"+":""}{diff}</td>
                    <td className="text-right py-1 px-2 text-gray-600">{t.spot}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
EOF
echo "✓ src/components/StraddleStrangle.jsx"

# src/components/GreeksPanel.jsx
cat > src/components/GreeksPanel.jsx << 'EOF'
import { useMemo } from "react";
import { greeks } from "../utils/blackScholes";
const Row=({label,ce,pe,combined,fmt})=>(
  <tr className="border-b border-gray-50 hover:bg-gray-50">
    <td className="py-1.5 px-3 text-gray-500 text-xs">{label}</td>
    <td className="text-right py-1.5 px-3 text-blue-600 text-xs tabular-nums">{fmt(ce)}</td>
    <td className="text-right py-1.5 px-3 text-pink-600 text-xs tabular-nums">{fmt(pe)}</td>
    <td className="text-right py-1.5 px-3 font-medium text-xs tabular-nums">{fmt(combined)}</td>
  </tr>
);
export default function GreeksPanel({ chain, strikeC, strikeP, spot, dte, mode="straddle" }) {
  const result=useMemo(()=>{
    if(!spot||!strikeC||!chain?.length)return null;
    const ceRow=chain.find(r=>r.strike===strikeC), peRow=chain.find(r=>r.strike===(mode==="strangle"?strikeP:strikeC));
    const ivC=ceRow?.ce_iv??14, ivP=peRow?.pe_iv??14, T=Math.max(0.001,dte/365);
    return { ce:greeks(spot,strikeC,T,ivC,"call"), pe:greeks(spot,mode==="strangle"?strikeP:strikeC,T,ivP,"put"), ivC, ivP };
  },[chain,strikeC,strikeP,spot,dte,mode]);
  if(!result)return <div className="text-gray-400 text-sm p-4">Select a strike to view Greeks.</div>;
  const {ce,pe}=result, f4=v=>v==null?"-":v.toFixed(4);
  return (
    <table className="w-full">
      <thead><tr className="text-gray-400 font-normal border-b border-gray-100 text-xs">
        <th className="text-left py-1.5 px-3">Greek</th><th className="text-right py-1.5 px-3">CE</th>
        <th className="text-right py-1.5 px-3">PE</th><th className="text-right py-1.5 px-3">Combined</th>
      </tr></thead>
      <tbody>
        <Row label="Delta"     ce={ce.delta} pe={pe.delta} combined={ce.delta+pe.delta} fmt={f4}/>
        <Row label="Gamma"     ce={ce.gamma} pe={pe.gamma} combined={ce.gamma+pe.gamma} fmt={f4}/>
        <Row label="Theta/day" ce={ce.theta} pe={pe.theta} combined={ce.theta+pe.theta} fmt={f4}/>
        <Row label="Vega"      ce={ce.vega}  pe={pe.vega}  combined={ce.vega+pe.vega}   fmt={f4}/>
        <Row label="Rho"       ce={ce.rho}   pe={pe.rho}   combined={ce.rho+pe.rho}     fmt={f4}/>
        <tr className="border-b border-gray-50">
          <td className="py-1.5 px-3 text-gray-500 text-xs">IV</td>
          <td className="text-right py-1.5 px-3 text-blue-600 text-xs">{result.ivC.toFixed(2)}%</td>
          <td className="text-right py-1.5 px-3 text-pink-600 text-xs">{result.ivP.toFixed(2)}%</td>
          <td className="text-right py-1.5 px-3 text-xs text-gray-600">{((result.ivC+result.ivP)/2).toFixed(2)}%</td>
        </tr>
      </tbody>
    </table>
  );
}
EOF
echo "✓ src/components/GreeksPanel.jsx"

# src/pages/Dashboard.jsx
cat > src/pages/Dashboard.jsx << 'EOF'
import { useState, useCallback, useEffect } from "react";
import { INDICES, ENABLED_INDICES } from "../config/indices";
import { useSheetData }  from "../hooks/useSheetData";
import { useRefresh }    from "../hooks/useRefresh";
import IndexSelector     from "../components/IndexSelector";
import RefreshControl    from "../components/RefreshControl";
import OptionChain       from "../components/OptionChain";
import OIChart           from "../components/OIChart";
import PCRChart          from "../components/PCRChart";
import StraddleStrangle  from "../components/StraddleStrangle";
import GreeksPanel       from "../components/GreeksPanel";

const TABS = ["Option Chain","Straddle / Strangle","OI Chart","PCR / ATM OI","Greeks"];

export default function Dashboard() {
  const [indexKey,       setIndexKey]       = useState(ENABLED_INDICES[0]?.key??"BANKNIFTY");
  const [activeTab,      setActiveTab]      = useState("Option Chain");
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [dte,            setDte]            = useState(7);
  const indexConfig = INDICES[indexKey];
  const { data, pcrHistory, atmHistory, loading, error, lastUpdated, fetchData } = useSheetData();
  const doFetch = useCallback(()=>fetchData(indexKey, indexConfig.step),[fetchData,indexKey,indexConfig]);
  const { countdown, interval, setIntervalSecs, manualRefresh } = useRefresh(doFetch, 300);
  useEffect(()=>{ doFetch(); },[indexKey]);
  useEffect(()=>{ if(data?.atm&&!selectedStrike)setSelectedStrike(data.atm); },[data?.atm]);

  const spot=data?.spot, chain=data?.chain, atm=data?.atm;
  const totalCeOI=chain?.reduce((s,r)=>s+(r.ce_oi??0),0)??0;
  const totalPeOI=chain?.reduce((s,r)=>s+(r.pe_oi??0),0)??0;
  const pcr=totalCeOI?(totalPeOI/totalCeOI).toFixed(2):"-";
  const sentiment=Number(pcr)>1?"Bullish":"Bearish";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-medium text-gray-800">Options Dashboard</h1>
          {spot>0&&(
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">{indexConfig.label}</span>
              <span className="font-semibold text-gray-800">{Number(spot).toLocaleString("en-IN")}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sentiment==="Bullish"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{sentiment}</span>
              <span className="text-gray-400 text-xs">PCR {pcr}</span>
            </div>
          )}
        </div>
        <RefreshControl interval={interval} countdown={countdown} lastUpdated={lastUpdated}
          onIntervalChange={setIntervalSecs} onManualRefresh={manualRefresh} loading={loading}/>
      </header>
      <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-4 flex-wrap">
        <IndexSelector selected={indexKey} onChange={k=>{ setIndexKey(k); setSelectedStrike(null); }}/>
        <div className="flex items-center gap-2 ml-auto text-sm text-gray-500">
          DTE <input type="number" value={dte} min={0} max={90} onChange={e=>setDte(Number(e.target.value))}
            className="w-14 border border-gray-300 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-blue-400"/>
        </div>
      </div>
      {error&&(
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          ⚠ {error}
          {error.toLowerCase().includes("key")&&(
            <span className="block mt-1 text-xs text-red-400">Check VITE_GSHEET_API_KEY in .env — get one from console.cloud.google.com</span>
          )}
        </div>
      )}
      <div className="px-6 pt-4">
        <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
          {TABS.map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              className={`px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${activeTab===tab?"border-blue-500 text-blue-600 font-medium":"border-transparent text-gray-500 hover:text-gray-700"}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {activeTab==="Option Chain"        &&<OptionChain chain={chain} atmStrike={atm} selectedStrike={selectedStrike} onSelectStrike={setSelectedStrike}/>}
          {activeTab==="Straddle / Strangle" &&<StraddleStrangle chain={chain} atmStrike={atm} spot={spot} indexConfig={indexConfig} dte={dte} rawRows={data?.rawRows}/>}
          {activeTab==="OI Chart"            &&<OIChart chain={chain} atmStrike={atm}/>}
          {activeTab==="PCR / ATM OI"        &&<PCRChart pcrHistory={pcrHistory} atmHistory={atmHistory}/>}
          {activeTab==="Greeks"              &&<GreeksPanel chain={chain} strikeC={selectedStrike??atm} strikeP={selectedStrike??atm} spot={spot} dte={dte} mode="straddle"/>}
        </div>
      </div>
    </div>
  );
}
EOF
echo "✓ src/pages/Dashboard.jsx"

# Remaining simple files
cat > src/App.jsx << 'EOF'
import Dashboard from "./pages/Dashboard";
export default function App() { return <Dashboard />; }
EOF
echo "✓ src/App.jsx"

cat > src/main.jsx << 'EOF'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
EOF
echo "✓ src/main.jsx"

cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
EOF
echo "✓ src/index.css"

cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Options Dashboard</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
EOF
echo "✓ index.html"

cat > package.json << 'EOF'
{
  "name": "options-dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": { "dev":"vite", "build":"vite build", "preview":"vite preview" },
  "dependencies": { "chart.js":"^4.4.1", "react":"^18.2.0", "react-dom":"^18.2.0" },
  "devDependencies": { "@vitejs/plugin-react":"^4.2.1", "autoprefixer":"^10.4.17", "postcss":"^8.4.35", "tailwindcss":"^3.4.1", "vite":"^5.1.0" }
}
EOF
echo "✓ package.json"

cat > vite.config.js << 'EOF'
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });
EOF
echo "✓ vite.config.js"

cat > tailwind.config.js << 'EOF'
export default { content:["./index.html","./src/**/*.{js,jsx}"], theme:{extend:{}}, plugins:[] };
EOF
echo "✓ tailwind.config.js"

cat > postcss.config.js << 'EOF'
export default { plugins: { tailwindcss:{}, autoprefixer:{} } };
EOF
echo "✓ postcss.config.js"

cat > netlify.toml << 'EOF'
[build]
  command = "npm run build"
  publish = "dist"
[[redirects]]
  from="/*" to="/index.html" status=200
EOF
echo "✓ netlify.toml"

cat > README.md << 'EOF'
# Options Dashboard
Data flow: Dhan API → Python script → Google Sheets → React Dashboard

## One-time setup

1. Google Sheets API key
   - console.cloud.google.com → Enable Google Sheets API → Credentials → API key
   - Paste into .env as VITE_GSHEET_API_KEY

2. Make your Google Sheet public (read-only)
   - Share → Anyone with the link → Viewer

3. Run locally
   npm install && npm run dev

4. Deploy
   netlify init && netlify deploy --prod
   Add VITE_GSHEET_API_KEY and VITE_SHEET_ID as Netlify env vars.
EOF
echo "✓ README.md"

echo ""
echo "================================================"
echo "  Done! All files created."
echo ""
echo "  Before running:"
echo "  1. Open .env — paste your Google Sheets API key"
echo "  2. Make your Google Sheet public (Viewer)"
echo "  3. npm install"
echo "  4. npm run dev"
echo "================================================"
echo ""
