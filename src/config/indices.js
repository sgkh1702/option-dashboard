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
