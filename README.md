# Focus Ledger — Task Stopwatch

An offline-first task stopwatch, built from the Focus Ledger design canvas.
Start a clock on a task, stop it, and see where your hours actually went.

- **Works with no internet.** Once it has loaded once, a service worker serves the
  whole app — HTML, CSS, JS, icons and fonts — from the device's cache.
- **Installable** as a PWA on iPhone, iPad, Android, Mac and Windows.
- **Your data stays on your device.** Tasks and sessions live in the browser's
  `localStorage`. There is no account, no server and no network call of any kind.

## What it does

| | |
|---|---|
| Active timer | One clock at a time, with a 60-dot second ring and the running total |
| Tasks | Add, rename, delete; press play to start, press again to stop |
| Today / Week | Totals, share of time and dot bars per task (weeks run Monday–Sunday) |
| Session log | The most recent sessions in the range, with start and end times |
| Backup | Export a JSON file, import it back on any device |

Starting a second task stops the first and files the session automatically.
A running clock keeps counting while the app is closed — the start time is stored,
so the elapsed time is correct when you come back.

## Install it on your phone or Mac

The app needs to be served over HTTPS once before it can be installed; after that
it runs offline. The easiest host is GitHub Pages:

1. In this repository, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the *Deploy to GitHub Pages* workflow by hand).
   Your app appears at `https://<your-username>.github.io/goal-tracker/`.

Then, on the device you want it on:

- **iPhone / iPad** — open the link in Safari, tap Share, then *Add to Home Screen*.
- **Mac, Safari** — open the link, then File → *Add to Dock*.
- **Chrome / Edge (any platform)** — use the install icon in the address bar, or the
  **INSTALL** button in the app's header.
- **Android** — Chrome menu → *Install app*.

Once installed, open it with Wi-Fi and data off; it loads and runs normally.

## Running it locally

```bash
python3 -m http.server 8137
```

Then open `http://127.0.0.1:8137/`. A service worker needs `http://localhost`,
`http://127.0.0.1` or HTTPS — opening `index.html` as a `file://` path will show the
app but will not install or cache it.

## Files

```
index.html             markup
styles.css             all styling, including the bundled @font-face rules
app.js                 state, stopwatch logic, localStorage, rendering
sw.js                  service worker: precaches the app shell for offline use
manifest.webmanifest   PWA metadata and icons
icons/                 app icons (any + maskable + apple-touch)
fonts/                 Codystar and Space Mono, self-hosted so no network is needed
```

## Notes on the data

Everything is under the single `localStorage` key `focus-ledger/v1`. That means:

- Clearing the browser's site data, or deleting the installed app, deletes the history.
- Nothing syncs between your phone and your Mac — each device keeps its own ledger.
  Use **EXPORT BACKUP** on one and **IMPORT BACKUP** on the other to move data across.
- iOS can evict data for web apps that go unused for a long time; installing it to the
  Home Screen makes that much less likely, but a periodic export is still worth it.

Fonts are [Codystar](https://fonts.google.com/specimen/Codystar) and
[Space Mono](https://fonts.google.com/specimen/Space+Mono), both under the SIL Open
Font License, bundled here so the app never reaches out to Google Fonts.
