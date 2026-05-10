// Screener API — calls local yfinance proxy (localhost:5000)
const PROXY_BASE = "http://localhost:5000";

export async function fetchAllQuotes() {
  const res = await fetch(`${PROXY_BASE}/quotes`);
  if (!res.ok) throw new Error(`Proxy error ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data ?? {};
}

export async function fetchNiftyFromProxy() {
  const res = await fetch(`${PROXY_BASE}/nifty`);
  if (!res.ok) throw new Error(`Nifty proxy error ${res.status}`);
  return await res.json(); // { current, prev_close, day_open }
}

// Keep for option chain (unchanged)
export async function fetchDhanToken() {
  const SHEET_ID = "1R6M0MtF4ImEv4s7_KsLwkFlbd_cea47aAZVt_eZOdIs";
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Token&range=B1`;
  const res = await fetch(url);
  const text = await res.text();
  const token = text.trim().replace(/^"|"$/g, "");
  if (!token) throw new Error("Token!B1 is empty in GSheet");
  return token;
}