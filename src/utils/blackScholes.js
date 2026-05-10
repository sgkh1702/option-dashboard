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
