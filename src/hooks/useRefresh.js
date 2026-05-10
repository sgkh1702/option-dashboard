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
