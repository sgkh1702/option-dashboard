"""
nse_corporate_actions.py

Fetches upcoming/recent corporate actions from NSE India for the F&O / Nifty 500
universe and pushes them into a "CorporateActions" tab in the daily-processed
Google Sheet, alongside your existing Buildup/FIIData/FII Stat tabs.

WHY THIS RUNS AS A SEPARATE SCRIPT (not a Render Flask route):
NSE has already blocked/rate-limited Render's datacenter IP for other data in
this project (that's why Breeze_bnf_gsheet.py and the futures pipeline run from
your home IP). NSE's own corporate-actions/board-meetings endpoints are behind
the same kind of bot protection (they require a warm session cookie from
nseindia.com's homepage before the API will respond), so this should run
wherever Breeze_bnf_gsheet.py runs — same Task Scheduler machine, same IP.

WHAT IT FETCHES (per your requested scope):
- Dividends
- Bonus / Splits
- Rights issues
- Board meetings (forthcoming meetings scheduled to consider results, etc.)
- Declared financial results (NEW - see below)
covering CE + upcoming, filtered to your Nifty 500 / F&O universe.

--------------------------------------------------------------------------
CHANGE LOG (this revision): fixes the "sheet doesn't match Moneycontrol's
earnings calendar" mismatch.

Root cause #1: NSE's corporate-board-meetings endpoint only returns
FORTHCOMING meetings (NSE's own description). Once a company's board
actually meets and results are filed, it disappears from that endpoint -
so a company that reported today never showed up in the old script at all,
before or after. Moneycontrol's earnings calendar is sourced from the
*declared results* feed, not the *scheduled meeting* feed - two different
NSE datasets. Added fetch_declared_results() to pull the missing one
(https://www.nseindia.com/api/corporates-financial-results).

Root cause #2: push_to_sheet()'s "drop anything dated before today" filter
is correct for ex-dates (dividends, upcoming board meetings) but wrong for
declared results, whose date is inherently today-or-recent. Under the old
uniform filter, a result declared today would vanish from the sheet on
tomorrow's run. Added a separate grace-window (RESULTS_GRACE_DAYS below)
so declared results stay visible for a few days after filing instead of
disappearing same-day.

FIELD NAMES: confirmed against a live sample row on 2026-07-30 (companyName,
symbol, broadCastDate, relatingTo, consolidated, audited - see
fetch_declared_results() docstring for details, including why toDate is
NOT the right field to use for the filing date).

Also discovered from that same live run: the raw feed returns a broad
history, not just recent filings (a stale Dec-2024-quarter correction filed
Jun-2026 came back in the 502-symbol universe, inflating the match count to
943). fetch_declared_results() now filters to RESULTS_LOOKBACK_DAYS and
dedupes to one row per symbol (latest filing) to fix that.
--------------------------------------------------------------------------

SETUP NEEDED FROM YOU:
1. pip install requests gspread google-auth
2. Point SHEET_ID / SERVICE_ACCOUNT_JSON / SYMBOL_LIST_SOURCE below at your
   actual setup (see the three TODOs marked below) - I don't have your
   existing script's exact gspread auth pattern in front of me, so I've
   written this using a service-account JSON file, which is the standard
   gspread pattern. If Breeze_bnf_gsheet.py already authenticates gspread a
   different way (e.g. oauth token), swap get_gsheet_client() to match it -
   everything else is independent of that.
3. Add a "CorporateActions" tab to your daily-processed sheet
   (ID 1t_AAtFwWPnqeNoVwDFbV8rtCIEXwQ8e3kLFHoRSlre0) - the script will create
   headers on first run if the tab is empty.
4. Schedule it once a day (corporate actions don't change intraday) - e.g.
   add a line to run_all.bat, or a separate daily Task Scheduler entry.

OUTPUT SHEET FORMAT (tab: CorporateActions):
  Symbol | Company | Type | Ex-Date | Purpose/Detail | Announced Date
  Type is one of: Dividend, Bonus, Split, Rights, Board Meeting,
                  Results, Results (Declared)
  Sorted by Ex-Date ascending. Ex-dated rows older than today are dropped
  each run; "Results (Declared)" rows are kept for RESULTS_GRACE_DAYS days
  after their date instead.
"""

import time
import datetime as dt
import requests
import gspread
from google.oauth2.service_account import Credentials

# ── CONFIG (TODO: adjust these three to match your actual setup) ──────────
SHEET_ID = "1t_AAtFwWPnqeNoVwDFbV8rtCIEXwQ8e3kLFHoRSlre0"  # your daily-processed sheet
SERVICE_ACCOUNT_JSON = "optionchain-494805-d75aa6f9c7a0.json"  # TODO: path to your gspread service account key
TAB_NAME = "CorporateActions"

# How many days a declared-results row stays on the sheet after its date,
# before it's dropped like any other past-dated row. Bump this up if you
# want a longer look-back window (e.g. "results declared this week").
RESULTS_GRACE_DAYS = 3

# How far back fetch_declared_results() looks into NSE's raw feed before
# even considering a row (the feed itself returns old/corrected filings
# too, not just recent ones - see fetch_declared_results docstring). Keep
# this >= RESULTS_GRACE_DAYS since push_to_sheet() trims further anyway.
RESULTS_LOOKBACK_DAYS = 10

# ── F&O earnings calendar (separate, smaller universe + separate tab) ─────
# This is the "don't get caught trading into an earnings print" list:
# F&O stocks only, upcoming board meetings for results within the next
# EARNINGS_LOOKAHEAD_DAYS, plus anything declared in the last couple of
# days (still fresh enough to be causing volatility).
FNO_CSV = "fno.csv"
EARNINGS_TAB_NAME = "FnoEarningsCalendar"
EARNINGS_LOOKAHEAD_DAYS = 7
EARNINGS_DECLARED_LOOKBACK_DAYS = 2


def load_fno_universe():
    """fno.csv is a single column of ticker symbols, no header row."""
    import csv
    try:
        with open(FNO_CSV, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            symbols = [row[0].strip().upper() for row in reader if row and row[0].strip()]
    except FileNotFoundError:
        print(f"[fno-earnings] ERROR: {FNO_CSV} not found in the working folder - "
              f"skipping F&O earnings calendar this run.")
        return []
    print(f"[fno-earnings] Loaded {len(symbols)} F&O symbols from {FNO_CSV}: "
          f"{symbols[:5]}{'...' if len(symbols) > 5 else ''}")
    return symbols

# TODO: point this at wherever Nifty500List.csv actually lives in your repo
# (e.g. same folder as this script, or a shared /data folder used by other
# tools). Format: header row "Symbol,Company Name,Industry", one row per stock.
NIFTY500_CSV = "Nifty500List.csv"

def load_symbol_universe():
    import csv
    try:
        with open(NIFTY500_CSV, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            return [row["Symbol"].strip().upper() for row in reader if row.get("Symbol")]
    except FileNotFoundError:
        print(f"[corp-actions] WARNING: {NIFTY500_CSV} not found — falling back to live NSE fetch")
        return fetch_nifty500_from_nse()

# ── NSE session handling ────────────────────────────────────────────────
NSE_HOME = "https://www.nseindia.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
}


def get_nse_session(referer=None):
    """NSE requires a warmed-up session cookie before its API endpoints will
    respond (returns 401/403/404 otherwise). Visiting just the homepage isn't
    always enough — visiting the actual page that would normally call the API
    (and setting Referer to match) is more reliable."""
    s = requests.Session()
    s.headers.update(HEADERS)
    s.get(NSE_HOME, timeout=10)
    time.sleep(1)
    if referer:
        s.get(referer, timeout=10)
        s.headers.update({"Referer": referer})
        time.sleep(1)
    return s


def fetch_nifty500_from_nse():
    referer = "https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY%20500"
    s = get_nse_session(referer=referer)
    url = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20500"
    r = s.get(url, timeout=15)
    r.raise_for_status()
    data = r.json()
    return [row["symbol"] for row in data.get("data", []) if row.get("symbol") != "NIFTY 500"]


def fetch_corp_actions(session, symbols):
    """NSE's corporate-actions endpoint. Called once for the whole exchange
    (not per-symbol) then filtered locally - much cheaper than N calls."""
    url = "https://www.nseindia.com/api/corporates-corporateActions?index=equities"
    r = session.get(url, timeout=15)
    r.raise_for_status()
    rows = r.json()
    out = []
    symset = set(symbols)
    for row in rows:
        sym = row.get("symbol", "")
        if sym not in symset:
            continue
        subject = row.get("subject", "") or ""
        purpose = classify_action(subject)
        if purpose is None:
            continue
        out.append({
            "Symbol": sym,
            "Company": row.get("comp", ""),
            "Type": purpose,
            "Ex-Date": row.get("exDate", ""),
            "Purpose/Detail": subject,
            "Announced Date": row.get("anDate", ""),
        })
    return out


def fetch_board_meetings(session, symbols):
    """Forthcoming board meetings (NSE's own description: 'all forthcoming
    board meetings'). This is a SCHEDULING feed - once the meeting happens
    and results are filed, the row drops off this endpoint entirely, which
    is why fetch_declared_results() below exists as a separate call."""
    url = "https://www.nseindia.com/api/corporate-board-meetings?index=equities"
    r = session.get(url, timeout=15)
    r.raise_for_status()
    rows = r.json()
    out = []
    symset = set(symbols)
    for row in rows:
        sym = row.get("bm_symbol", "")
        if sym not in symset:
            continue
        purpose = row.get("bm_purpose", "") or ""
        out.append({
            "Symbol": sym,
            "Company": row.get("sm_name", ""),
            "Type": "Results" if "financial result" in purpose.lower() else "Board Meeting",
            "Ex-Date": row.get("bm_date", ""),
            "Purpose/Detail": purpose,
            "Announced Date": row.get("bm_timestamp", ""),
        })
    return out


def parse_nse_datetime(s: str):
    """Parses NSE's timestamp fields, which show up with or without seconds
    depending on the field (e.g. broadCastDate has seconds, filingDate
    doesn't)."""
    if not s:
        return None
    for fmt in ("%d-%b-%Y %H:%M:%S", "%d-%b-%Y %H:%M", "%d-%b-%Y"):
        try:
            return dt.datetime.strptime(s.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None


def fetch_declared_results(session, symbols):
    """Actual FILED quarterly results - this is what Moneycontrol's earnings
    calendar shows (results already out, with same-day price reaction),
    and it's a genuinely different NSE dataset from fetch_board_meetings()
    above.

    Field names confirmed against a live sample row (2026-07-30):
      companyName, symbol, broadCastDate ('25-Jun-2026 16:39:17' - has
      seconds, this is the actual filing/disclosure timestamp), relatingTo
      ('Third Quarter'), consolidated, audited, toDate (quarter-END date,
      NOT the filing date - don't use this one for Ex-Date).

    The endpoint returns a broad history, not just recent filings (a real
    sample came back with a Dec-2024-quarter result filed in Jun-2026 - a
    late correction, not something you'd want on a "who reported recently"
    view). So this filters client-side to RESULTS_LOOKBACK_DAYS and dedupes
    to the latest filing per symbol (a symbol can have >1 row - e.g.
    standalone and consolidated filed the same day)."""
    url = "https://www.nseindia.com/api/corporates-financial-results?index=equities&period=Quarterly"
    r = session.get(url, timeout=15)
    r.raise_for_status()
    rows = r.json()

    symset = set(symbols)
    cutoff = dt.datetime.now() - dt.timedelta(days=RESULTS_LOOKBACK_DAYS)

    latest_by_symbol = {}
    for row in rows:
        sym = row.get("symbol", "")
        if sym not in symset:
            continue
        broadcast_raw = row.get("broadCastDate") or row.get("filingDate") or row.get("exchdisstime") or ""
        broadcast_dt = parse_nse_datetime(broadcast_raw)
        if broadcast_dt is None or broadcast_dt < cutoff:
            continue
        existing = latest_by_symbol.get(sym)
        if existing is None or broadcast_dt > existing[0]:
            latest_by_symbol[sym] = (broadcast_dt, broadcast_raw, row)

    out = []
    for sym, (broadcast_dt, broadcast_raw, row) in latest_by_symbol.items():
        relating_to = row.get("relatingTo", "") or ""
        consolidated = row.get("consolidated", "") or ""
        audited = row.get("audited", "") or ""
        detail_bits = [b for b in (relating_to, consolidated, audited) if b]
        out.append({
            "Symbol": sym,
            "Company": row.get("companyName", ""),
            "Type": "Results (Declared)",
            "Ex-Date": broadcast_dt.strftime("%d-%b-%Y"),
            "Purpose/Detail": "Results filed - " + ", ".join(detail_bits) if detail_bits else "Results filed",
            "Announced Date": broadcast_raw,
        })
    print(f"[corp-actions] DEBUG: {len(rows)} raw rows from corporates-financial-results, "
          f"{len(out)} after universe filter + {RESULTS_LOOKBACK_DAYS}-day window + dedupe")
    return out


def classify_action(subject: str):
    """Map NSE's free-text subject line to one of our four buckets.
    Returns None to drop actions outside our requested scope
    (e.g. 'Annual General Meeting' with no dividend/bonus/split/rights)."""
    s = subject.lower()
    if "dividend" in s:
        return "Dividend"
    if "bonus" in s:
        return "Bonus"
    if "split" in s or "sub-division" in s or "subdivision" in s:
        return "Split"
    if "rights" in s:
        return "Rights"
    return None


def parse_nse_date(s: str):
    """NSE dates come as 'DD-Mon-YYYY' (e.g. '15-Aug-2026'), sometimes with
    a time component."""
    if not s:
        return None
    for fmt in ("%d-%b-%Y", "%d-%b-%Y %H:%M:%S"):
        try:
            return dt.datetime.strptime(s.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


# ── Google Sheets push ─────────────────────────────────────────────────
def get_gsheet_client():
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_JSON, scopes=scopes)
    return gspread.authorize(creds)


def push_to_sheet(rows):
    gc = get_gsheet_client()
    sh = gc.open_by_key(SHEET_ID)
    try:
        ws = sh.worksheet(TAB_NAME)
    except gspread.exceptions.WorksheetNotFound:
        ws = sh.add_worksheet(title=TAB_NAME, rows=500, cols=6)

    headers = ["Symbol", "Company", "Type", "Ex-Date", "Purpose/Detail", "Announced Date"]

    today = dt.date.today()
    grace_cutoff = today - dt.timedelta(days=RESULTS_GRACE_DAYS)

    filtered = []
    for row in rows:
        d = parse_nse_date(row["Ex-Date"])
        if row["Type"] == "Results (Declared)":
            # Keep declared results for a short look-back window instead of
            # the standard "upcoming from today" cutoff - a result filed
            # today or a couple of days ago is still useful to see.
            if d is None or d >= grace_cutoff:
                filtered.append((d or dt.date.max, row))
        else:
            # Standard ex-date behaviour: drop anything already in the past,
            # sheet always shows "upcoming from today onward".
            if d is None or d >= today:
                filtered.append((d or dt.date.max, row))
    filtered.sort(key=lambda t: t[0])

    values = [headers] + [
        [r["Symbol"], r["Company"], r["Type"], r["Ex-Date"], r["Purpose/Detail"], r["Announced Date"]]
        for _, r in filtered
    ]

    ws.clear()
    ws.update(range_name="A1", values=values)
    print(f"[corp-actions] Pushed {len(values) - 1} rows to '{TAB_NAME}' tab.")


def fetch_upcoming_earnings(session, fno_symbols):
    """Forthcoming board meetings scheduled specifically to consider
    financial results (Type == 'Results', not other agenda items like
    buybacks/fundraises), for the F&O universe only, within
    EARNINGS_LOOKAHEAD_DAYS. This is the forward-looking half of the
    caution list."""
    meetings = fetch_board_meetings(session, fno_symbols)
    today = dt.date.today()
    horizon = today + dt.timedelta(days=EARNINGS_LOOKAHEAD_DAYS)
    out = []
    for row in meetings:
        if row["Type"] != "Results":
            continue
        d = parse_nse_date(row["Ex-Date"])
        if d is None or d < today or d > horizon:
            continue
        out.append({**row, "Status": "Upcoming", "Days": (d - today).days})
    return out


def fetch_recently_declared_fno(session, fno_symbols):
    """Results already declared in the last EARNINGS_DECLARED_LOOKBACK_DAYS
    days, for the F&O universe only - the backward-looking half: still
    fresh enough to be moving the stock/its options."""
    declared = fetch_declared_results(session, fno_symbols)
    today = dt.date.today()
    earliest = today - dt.timedelta(days=EARNINGS_DECLARED_LOOKBACK_DAYS)
    out = []
    for row in declared:
        d = parse_nse_date(row["Ex-Date"])
        if d is None or d < earliest or d > today:
            continue
        out.append({**row, "Status": "Declared", "Days": (d - today).days})
    return out


def push_earnings_calendar(rows):
    gc = get_gsheet_client()
    sh = gc.open_by_key(SHEET_ID)
    try:
        ws = sh.worksheet(EARNINGS_TAB_NAME)
    except gspread.exceptions.WorksheetNotFound:
        ws = sh.add_worksheet(title=EARNINGS_TAB_NAME, rows=200, cols=6)

    headers = ["Symbol", "Company", "Status", "Date", "Days", "Detail"]
    rows_sorted = sorted(rows, key=lambda r: r["Days"])
    values = [headers] + [
        [r["Symbol"], r["Company"], r["Status"], r["Ex-Date"], r["Days"], r["Purpose/Detail"]]
        for r in rows_sorted
    ]

    ws.clear()
    ws.update(range_name="A1", values=values)
    print(f"[fno-earnings] Pushed {len(values) - 1} rows to '{EARNINGS_TAB_NAME}' tab.")


def main():
    symbols = load_symbol_universe()
    print(f"[corp-actions] Universe: {len(symbols)} symbols")

    session = get_nse_session()
    actions = fetch_corp_actions(session, symbols)
    print(f"[corp-actions] Dividends/Bonus/Split/Rights matched: {len(actions)}")

    meetings = fetch_board_meetings(session, symbols)
    print(f"[corp-actions] Forthcoming board meetings/Results matched: {len(meetings)}")

    declared = fetch_declared_results(session, symbols)
    print(f"[corp-actions] Declared results matched: {len(declared)}")

    all_rows = actions + meetings + declared
    push_to_sheet(all_rows)

    # ── F&O earnings calendar (separate, smaller universe + tab) ──────────
    fno_symbols = load_fno_universe()
    if fno_symbols:
        upcoming = fetch_upcoming_earnings(session, fno_symbols)
        declared_recent = fetch_recently_declared_fno(session, fno_symbols)
        print(f"[fno-earnings] Upcoming (next {EARNINGS_LOOKAHEAD_DAYS}d): {len(upcoming)}, "
              f"Recently declared (last {EARNINGS_DECLARED_LOOKBACK_DAYS}d): {len(declared_recent)}")
        push_earnings_calendar(upcoming + declared_recent)
    else:
        print("[fno-earnings] Skipped - no F&O universe loaded.")


if __name__ == "__main__":
    main()