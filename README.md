# Options Dashboard
Data flow: Dhan API → Python script → Google Sheets → React Dashboard

## One-time setup

1. Google Sheets API key
   - console.cloud.google.com → Enable Google Sheets API → Credentials → API key
   - Paste into .env as VITE_GSHEET_API_KEY

2. Make your Google Sheet public (read-only)
   - Share → Anyone with the link → Viewer

3. Run locally
   npm install && npm run dev

4. Deploy
   netlify init && netlify deploy --prod
   Add VITE_GSHEET_API_KEY and VITE_SHEET_ID as Netlify env vars.
