import { REFRESH_OPTIONS } from "../config/indices";
export default function RefreshControl({ interval, countdown, lastUpdated, onIntervalChange, onManualRefresh, loading }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <select value={interval} onChange={e=>onIntervalChange(Number(e.target.value))}
        className="border border-gray-300 rounded-md px-2 py-1 bg-white text-sm focus:outline-none focus:border-blue-400">
        {REFRESH_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {interval>0 && <span className="text-gray-400 tabular-nums w-12">{countdown}s</span>}
      <button onClick={onManualRefresh} disabled={loading}
        className="px-3 py-1 rounded-md border border-gray-300 hover:border-blue-400 text-gray-600 disabled:opacity-40 transition-colors">
        {loading?"...":"↻ Refresh"}
      </button>
      {lastUpdated && <span className="text-gray-400">{lastUpdated.toLocaleTimeString("en-IN")}</span>}
    </div>
  );
}
