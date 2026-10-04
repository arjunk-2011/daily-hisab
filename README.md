# Daily Hisab by AK / ડેઇલી હિસાબ by AK

A simple, free, privacy-first expense tracker app. Works in **English** and **ગુજરાતી (Gujarati)**.

## Features

- Full English + Gujarati (every screen, button, message, date, and the Excel report headers)
- Language switch button at the top (ગુ / EN) and in Settings
- **Editable logo**: upload your own logo, change the logo symbol, app name and tagline in Settings
- Home dashboard, quick-add buttons, add / edit / delete expenses
- Categories, today / week / month overview, search and filters
- Monthly Excel-compatible CSV export
- JSON backup and restore (includes your logo and name)
- Installable app (PWA), works offline
- No account, no ads, no backend

## Run locally

```bash
python -m http.server 8000
```
Open http://localhost:8000

## Publish for free (GitHub Pages)

1. Create a free GitHub account and a new public repository.
2. Upload all files from this folder (do not upload personal backups).
3. Repository Settings -> Pages -> Deploy from branch `main` / root.
4. Open the link GitHub gives you on your phone, then tap **Install app** / **Add to Home screen**.

## Android APK (optional, free)

After publishing, go to https://www.pwabuilder.com, paste your website link, and choose Android to download an APK.

## Change wording

All text is in `i18n.js`. Edit the English or Gujarati text there.

## Privacy

Expenses and settings are saved in the browser's localStorage on your device. Nothing is sent to a server. Back up regularly from the Excel tab.
