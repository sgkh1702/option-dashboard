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

// Black-Scholes price given IV (iv in percentage points, e.g. 14 = 14%). Same
// convention as greeks() above — used internally by impliedVol() below.
function price(S,K,T,iv,type,r=0.065){
  if(T<=0)return type==="call"?Math.max(S-K,0):Math.max(K-S,0);
  const s=iv/100,sq=Math.sqrt(T),d1=(Math.log(S/K)+(r+0.5*s*s)*T)/(s*sq),d2=d1-s*sq,disc=Math.exp(-r*T);
  return type==="call"?S*N(d1)-K*disc*N(d2):K*disc*N(-d2)-S*N(-d1);
}

// Inverts Black-Scholes from a market price (ltp) to implied vol, since Breeze
// never returns IV directly. Returns IV as a percentage point (e.g. 14, not 0.14)
// to match the existing greeks()/price() convention. T is time-to-expiry in years.
export function impliedVol(S,K,T,marketPrice,type,r=0.065){
  if(T<=0||marketPrice<=0)return 0;

  // No time value left (deep ITM near expiry, or bad/stale ltp) — IV undefined.
  const intrinsic=type==="call"?Math.max(S-K,0):Math.max(K-S,0);
  if(marketPrice<=intrinsic+1e-4)return 0;

  // Newton-Raphson: fast when it converges, but can diverge or blow up where
  // vega is tiny (deep ITM/OTM), so it's capped at 25 iterations and bailed
  // out of early if vega collapses or a step goes non-finite / out of range.
  let iv=20; // 20% starting guess
  for(let i=0;i<25;i++){
    const diff=price(S,K,T,iv,type,r)-marketPrice;
    if(Math.abs(diff)<1e-4)return Math.max(iv,0.01);
    const vega=greeks(S,K,T,iv,type,r).vega;
    if(!vega||vega<1e-8)break;
    const next=iv-diff/vega;
    if(!isFinite(next)||next<=0||next>500)break;
    iv=next;
  }

  // Bisection fallback: slower but guaranteed to converge if a solution
  // exists inside [0.01%, 300%]. If the market price can't be bracketed in
  // that range, there's no valid IV for it (bad data) — return 0.
  let lo=0.01,hi=300;
  let pLo=price(S,K,T,lo,type,r)-marketPrice;
  const pHi=price(S,K,T,hi,type,r)-marketPrice;
  if(pLo*pHi>0)return 0;
  for(let i=0;i<60;i++){
    const mid=(lo+hi)/2;
    const pMid=price(S,K,T,mid,type,r)-marketPrice;
    if(Math.abs(pMid)<1e-4)return mid;
    if(pLo*pMid<0)hi=mid;else{lo=mid;pLo=pMid;}
  }
  return (lo+hi)/2;
}