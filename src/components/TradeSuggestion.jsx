import { useEffect, useState } from "react";
import { impliedVol } from "../utils/blackScholes";

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";
const SUPPORTED = new Set(["NIFTY", "BANKNIFTY"]);

// ATM-IV high/low cutoff. Placeholder threshold — chosen from the live IV
// range you verified during Module 2 testing (~14-18%) as a rough midpoint.
// Swap this for a real IVHistory rolling-average/percentile check once it
// has enough days accumulated (per your plan — hardcoded now, upgrade later).
const IV_HIGH_THRESHOLD = 15;

// How many strike-steps out the defined-risk leg sits on credit spreads.
// Adjustable — not something you specified, just a starting default.
const CREDIT_SPREAD_WIDTH_STEPS = 2;

// Same IV-resolution rule as OptionChain.jsx's ivFor: sheet value if present,
// else Black-Scholes-derived from ltp, else null. Duplicated here (rather than
// imported) since it isn't exported from OptionChain.jsx.
const cleanIv = v => (v === null || v === undefined || v === "" || Number(v) === 0) ? null : Number(v);
function ivFor(sheetIv, ltp, spot, K, T, type) {
  const fromSheet = cleanIv(sheetIv);
  if (fromSheet != null) return fromSheet;
  if (!spot || !T || !(Number(ltp) > 0)) return null;
  const derived = impliedVol(spot, K, T, Number(ltp), type);
  return derived > 0 ? derived : null;
}

function useFuturesSignal(symbol) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!SUPPORTED.has(symbol)) { setData(null); setError(null); return; }
    let cancelled = false;
    const fetchSignal = () => {
      fetch(`${PROXY}/futures-signal?symbol=${symbol}`)
        .then(r => r.json())
        .then(json => {
          if (cancelled) return;
          if (json.error) { setError(json.error); setData(null); }
          else { setData(json); setError(null); }
        })
        .catch(e => { if (!cancelled) setError(String(e)); });
    };
    fetchSignal();
    const id = setInterval(fetchSignal, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  return { data, error };
}

export default function TradeSuggestion({ chain, atmStrike, spot, dte, step, symbol }) {
  const { data: signal, error: signalError } = useFuturesSignal(symbol);

  if (!SUPPORTED.has(symbol)) return null;

  if (signalError) return (
    <div className="text-xs text-gray-400 italic px-3 py-2">Trade suggestion unavailable: {signalError}</div>
  );
  if (!signal || !chain?.length) return (
    <div className="text-xs text-gray-400 px-3 py-2">Loading trade suggestion…</div>
  );

  const direction = signal.light === "green" ? "bullish" : signal.light === "red" ? "bearish" : null;

  if (!direction) return (
    <div className="text-xs text-gray-400 px-3 py-2 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />
      No trade signal right now — trend/VWAP not aligned.
    </div>
  );

  const T = dte != null ? Math.max(0.001, dte / 365) : null;
  const atmRow = chain.find(r => r.strike === atmStrike);
  const ceIv = atmRow ? ivFor(atmRow.ce_iv, atmRow.ce_ltp, spot, atmStrike, T, "call") : null;
  const peIv = atmRow ? ivFor(atmRow.pe_iv, atmRow.pe_ltp, spot, atmStrike, T, "put") : null;
  const atmIv = ceIv != null && peIv != null ? (ceIv + peIv) / 2 : (ceIv ?? peIv);

  if (atmIv == null) return (
    <div className="text-xs text-gray-400 px-3 py-2">
      Trend is {direction}, but ATM IV isn't available yet to pick a spread type.
    </div>
  );

  const maxCeStrike = chain.reduce((b, r) => (r.ce_oi ?? 0) > (b.ce_oi ?? 0) ? r : b, chain[0]).strike;
  const maxPeStrike = chain.reduce((b, r) => (r.pe_oi ?? 0) > (b.pe_oi ?? 0) ? r : b, chain[0]).strike;
  const findRow = strike => chain.find(r => r.strike === strike);

  const ivLevel = atmIv >= IV_HIGH_THRESHOLD ? "high" : "low";

  // shortStrike = the leg you'd SELL, longStrike = the leg you'd BUY —
  // holds for both credit and debit spreads below.
  let label, kind, isCall, shortStrike, longStrike;
  if (direction === "bullish" && ivLevel === "high") {
    kind = "credit"; label = "Bull Put Spread"; isCall = false;
    shortStrike = maxPeStrike; longStrike = maxPeStrike - CREDIT_SPREAD_WIDTH_STEPS * step;
  } else if (direction === "bullish" && ivLevel === "low") {
    kind = "debit"; label = "Bull Call Spread"; isCall = true;
    shortStrike = maxCeStrike; longStrike = atmStrike;
  } else if (direction === "bearish" && ivLevel === "high") {
    kind = "credit"; label = "Bear Call Spread"; isCall = true;
    shortStrike = maxCeStrike; longStrike = maxCeStrike + CREDIT_SPREAD_WIDTH_STEPS * step;
  } else {
    kind = "debit"; label = "Bear Put Spread"; isCall = false;
    shortStrike = maxPeStrike; longStrike = atmStrike;
  }

  const shortRow = findRow(shortStrike);
  const longRow  = findRow(longStrike);
  const shortLtp = shortRow ? (isCall ? shortRow.ce_ltp : shortRow.pe_ltp) : null;
  const longLtp  = longRow  ? (isCall ? longRow.ce_ltp  : longRow.pe_ltp)  : null;
  const netPremium = (shortLtp != null && longLtp != null) ? (shortLtp - longLtp) : null;

  return (
    <div className="text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded font-semibold ${kind === "credit" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
          {label}
        </span>
        <span className="text-gray-400">ATM IV {atmIv.toFixed(1)}% ({ivLevel})</span>
      </div>
      <div className="text-gray-600">
        Sell {isCall ? "CE" : "PE"} {shortStrike} · Buy {isCall ? "CE" : "PE"} {longStrike}
      </div>
      {netPremium != null && (
        <div className="text-gray-400">
          Net {kind} ≈ ₹{Math.abs(netPremium).toFixed(2)}/share
        </div>
      )}
      <div className="text-gray-300 italic">Mechanical suggestion from your rules — not a recommendation, verify before entering.</div>
    </div>
  );
}
