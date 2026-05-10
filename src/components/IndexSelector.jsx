import { ENABLED_INDICES } from "../config/indices";
export default function IndexSelector({ selected, onChange }) {
  return (
    <div className="flex gap-2">
      {ENABLED_INDICES.map(idx=>(
        <button key={idx.key} onClick={()=>onChange(idx.key)}
          className={`px-4 py-1.5 text-sm rounded-md border transition-colors ${selected===idx.key?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
          {idx.label}
        </button>
      ))}
    </div>
  );
}
