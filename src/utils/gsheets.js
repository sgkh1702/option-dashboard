import { SHEET_ID, API_KEY } from "../config/sheets";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export async function fetchRange(sheetName, range = "", { sheetId = SHEET_ID, skipHeader = true } = {}) {
  const tab = range ? `${sheetName}!${range}` : sheetName;
  const url = `${BASE}/${sheetId}/values/${encodeURIComponent(tab)}?key=${API_KEY}&valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Sheets API ${res.status}`);
  }
  const json = await res.json();
  const rows = json.values ?? [];
  return skipHeader ? rows.slice(1) : rows;
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
    out[key] = isNaN(num) ? null : num;
  }
  return out;
}