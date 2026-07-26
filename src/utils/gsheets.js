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

// Fetches multiple A1 ranges from ONE spreadsheet in a single HTTP request via
// the Sheets API's `values:batchGet` endpoint. Use this instead of many
// individual fetchRange() calls when a page needs several ranges — Google
// counts every fetchRange() call as one "read request" against the
// per-minute-per-user quota, but a single batchGet() call (however many
// ranges it carries) only counts as one.
//
// `specs` is an array of { sheetName, range, skipHeader? } objects, in the
// order you want the results back. Returns an array of row-arrays in that
// same order (skipHeader defaults to false per spec, matching fetchRange's
// optsNoHeader pattern — pass skipHeader: true per-spec where the old code
// relied on fetchRange's default-true behaviour, e.g. raw option-chain sheets).
export async function fetchRanges(specs, { sheetId = SHEET_ID } = {}) {
  if (!specs || specs.length === 0) return [];
  const tabs = specs.map(s => (s.range ? `${s.sheetName}!${s.range}` : s.sheetName));
  const params = tabs.map(t => `ranges=${encodeURIComponent(t)}`).join("&");
  const url = `${BASE}/${sheetId}/values:batchGet?${params}&key=${API_KEY}&valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Sheets API ${res.status}`);
  }
  const json = await res.json();
  // valueRanges comes back in the same order the ranges were requested in,
  // so match by index rather than by the (possibly re-quoted) range string.
  const valueRanges = json.valueRanges ?? [];
  return specs.map((spec, i) => {
    const rows = valueRanges[i]?.values ?? [];
    return spec.skipHeader ? rows.slice(1) : rows;
  });
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