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
