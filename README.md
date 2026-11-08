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
it runs offline. This repository is set up for **Netlify**, which is free and can
deploy straight from GitHub without making the repository public.

1. Sign in at [netlify.com](https://app.netlify.com) with GitHub.
2. **Add new site → Import an existing project**, and pick this repository.
3. Leave the build settings as they are — `netlify.toml` already says to publish
   the repository root, and there is no build step.
4. **Deploy**. You get a URL like `https://goal-tracker.netlify.app`, and every
   push to `main` redeploys it.

In a hurry, or no GitHub connection? Drag this folder onto
[app.netlify.com/drop](https://app.netlify.com/drop) instead; that publishes it in
seconds, though you need an account for the URL to be permanent.

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

Then open `http://localhost:8137/`. A service worker needs `http://localhost`,
`http://127.0.0.1` or HTTPS — opening `index.html` as a `file://` path will show the
app but will not install or cache it.

You only need the server for the first load: once the app has cached itself you can
stop the server and the installed app keeps working. Full walkthrough, including
installing it to the Mac Dock, is in **[LOCAL-SETUP.md](LOCAL-SETUP.md)**.

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
