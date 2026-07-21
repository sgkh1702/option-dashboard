import { SHEET_ID, API_KEY } from "../config/sheets";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export async function fetchRange(sheetName, range = "") {
  const tab = range ? `${sheetName}!${range}` : sheetName;
  const url = `${BASE}/${SHEET_ID}/values/${encodeURIComponent(tab)}?key=${API_KEY}&valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Sheets API ${res.status}`);
  }
  const json = await res.json();
  return (json.values ?? []).slice(1);
}

export function parseRow(row, colMap) {
  const out = {};
  for (const [key, idx] of Object.entries(colMap)) {
    const raw = row[idx];
    if (key === "time") {
      out[key] = raw ?? "";
      continue;
    }
    // FORMATTED_VALUE can include commas/%/currency symbols — strip them before parsing
    const cleaned = typeof raw === "string" ? raw.replace(/[,%₹\s]/g, "") : raw;
    const num = parseFloat(cleaned);
    // Return null (not "") when unparseable, so downstream `??` fallbacks work correctly.
    // A blank/missing cell should read as "no data", not silently become 0 in arithmetic.
    out[key] = isNaN(num) ? null : num;
  }
  return out;
}
