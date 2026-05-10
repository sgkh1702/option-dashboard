export function vwapFromArray(prices) {
  let cumPV=0, cumVol=0;
  return prices.map((p,i)=>{ cumPV+=p*(i+1); cumVol+=(i+1); return cumPV/cumVol; });
}
