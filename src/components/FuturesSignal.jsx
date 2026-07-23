import { useEffect, useState } from "react";

const PROXY = import.meta.env.VITE_PROXY_URL ?? "http://localhost:5000";

// Only Nifty/BankNifty futures are in scope for the credit-spread strategy
// (stocks excluded for liquidity/no-weekly-expiry reasons, per the strategy spec).
const SUPPORTED = new Set(["NIFTY", "BANKNIFTY"]);

const LIGHT_STYLE = {
  green: "bg-green-100 text-green-700 border border-green-200",
  red:   "bg-red-100 text-red-700 border border-red-200",
  amber: "bg-amber-100 text-amber-700 border border-amber-200",
};

const LIGHT_LABEL = { green: "Bullish", red: "Bearish", amber: "No signal" };

export default function FuturesSignal({ symbol }) {
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
    const id = setInterval(fetchSignal, 60_000); // 5-min bars — no need to poll faster
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  if (!SUPPORTED.has(symbol)) return null;

  if (error) return (
    <span className="text-[11px] text-gray-400 italic ml-2" title={error}>
      Signal unavailable
    </span>
  );

  if (!data) return (
    <span className="text-[11px] text-gray-400 ml-2">Loading signal…</span>
  );

  return (
    <span className="flex items-center gap-2 ml-2">
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${LIGHT_STYLE[data.light]}`}>
        {LIGHT_LABEL[data.light]}
      </span>
      <span className="text-[10px] text-gray-400" title="EMA20 / EMA50 / VWAP">
        E20 {data.ema20 ?? "-"} · E50 {data.ema50 ?? "-"} · VWAP {data.vwap ?? "-"}
        {data.vol_declining != null && (
          <span className={data.vol_declining ? "text-green-500" : "text-gray-400"}>
            {" "}· Vol {data.vol_declining ? "↓" : "↑"}
          </span>
        )}
      </span>
    </span>
  );
}
