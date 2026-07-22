import { useMemo } from "react";
import { greeks, impliedVol } from "../utils/blackScholes";
const Row=({label,ce,pe,combined,fmt})=>(
  <tr className="border-b border-gray-50 hover:bg-gray-50">
    <td className="py-1.5 px-3 text-gray-500 text-xs">{label}</td>
    <td className="text-right py-1.5 px-3 text-blue-600 text-xs tabular-nums">{fmt(ce)}</td>
    <td className="text-right py-1.5 px-3 text-pink-600 text-xs tabular-nums">{fmt(pe)}</td>
    <td className="text-right py-1.5 px-3 font-medium text-xs tabular-nums">{fmt(combined)}</td>
  </tr>
);
// IV is never legitimately 0 in a real market — treat 0, null, undefined, and "" all as "missing"
// and fall back. `??` alone doesn't catch 0 or "", which was the root cause of Delta/Gamma/Vega
// breaking (iv=0 -> sigma=0 -> division by zero in Black-Scholes).
const cleanIv = v => (v === null || v === undefined || v === "" || Number(v) === 0) ? null : Number(v);

// Resolves IV in priority order: (1) sheet-provided IV if present and non-zero,
// (2) Black-Scholes inversion from ltp — real per-strike IV, since Breeze never
// returns IV directly, (3) 14% static fallback only if ltp is missing/unusable
// or inversion can't find a solution. Returns {iv, source} so the UI can show
// which tier was used.
function resolveIv(sheetIv, S, K, T, ltp, type) {
  const fromSheet = cleanIv(sheetIv);
  if (fromSheet != null) return { iv: fromSheet, source: "sheet" };
  const price = Number(ltp);
  if (price > 0) {
    const derived = impliedVol(S, K, T, price, type);
    if (derived > 0) return { iv: derived, source: "derived" };
  }
  return { iv: 14, source: "fallback" };
}

const SOURCE_LABEL = {
  sheet: "From Breeze (sheet)",
  derived: "Derived via Black-Scholes inversion from LTP (Breeze doesn't provide IV directly)",
  fallback: "Fallback estimate — no usable price to derive IV from",
};
const SOURCE_DOT = { sheet: "#22c55e", derived: "#3b82f6", fallback: "#f59e0b" };

export default function GreeksPanel({ chain, strikeC, strikeP, spot, dte, mode="straddle" }) {
  const result=useMemo(()=>{
    if(!spot||!strikeC||!chain?.length)return null;
    const ceRow=chain.find(r=>r.strike===strikeC), peRow=chain.find(r=>r.strike===(mode==="strangle"?strikeP:strikeC));
    const T=Math.max(0.001,dte/365);
    const kC=strikeC, kP=mode==="strangle"?strikeP:strikeC;
    const { iv: ivC, source: srcC } = resolveIv(ceRow?.ce_iv, spot, kC, T, ceRow?.ce_ltp, "call");
    const { iv: ivP, source: srcP } = resolveIv(peRow?.pe_iv, spot, kP, T, peRow?.pe_ltp, "put");
    return { ce:greeks(spot,kC,T,ivC,"call"), pe:greeks(spot,kP,T,ivP,"put"), ivC, ivP, srcC, srcP };
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
          <td className="text-right py-1.5 px-3 text-blue-600 text-xs" title={SOURCE_LABEL[result.srcC]}>
            {result.ivC.toFixed(2)}%
            <span className="inline-block w-1.5 h-1.5 rounded-full ml-1" style={{backgroundColor:SOURCE_DOT[result.srcC]}}/>
          </td>
          <td className="text-right py-1.5 px-3 text-pink-600 text-xs" title={SOURCE_LABEL[result.srcP]}>
            {result.ivP.toFixed(2)}%
            <span className="inline-block w-1.5 h-1.5 rounded-full ml-1" style={{backgroundColor:SOURCE_DOT[result.srcP]}}/>
          </td>
          <td className="text-right py-1.5 px-3 text-xs text-gray-600">{((result.ivC+result.ivP)/2).toFixed(2)}%</td>
        </tr>
      </tbody>
    </table>
  );
}