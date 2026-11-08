# Running Focus Ledger locally

How to run the app from your own machine and install it to your Mac's Dock,
without GitHub Pages or any hosting.

**Short version:** you need the little web server running only for the *first*
load. Once the app has cached itself you can quit the server, and the installed
app keeps opening and working normally.

---

## 1. What you need

Python 3, which is already on macOS. Check it:

```bash
python3 --version
```

Nothing else — no npm install, no build step. The app is plain HTML, CSS and JS.

## 2. Get the code

```bash
git clone https://github.com/samuelvillegas/goal-tracker.git
cd goal-tracker
```

No git? Open the [repo](https://github.com/samuelvillegas/goal-tracker), press
**Code → Download ZIP**, unzip it, and `cd` into the folder.

## 3. Start the server

From inside the `goal-tracker` folder:

```bash
python3 -m http.server 8137
```

Leave that Terminal window open for now. It prints a line per request, which is
normal.

Prefer something else? Any static server works, as long as the port stays the
same each time:

```bash
npx serve -l 8137      # Node
php -S localhost:8137  # PHP
```

## 4. Open it

Go to **http://localhost:8137/** in Safari or Chrome.

Add a task, press play, and confirm the clock runs.

## 5. Install it to your Mac

- **Safari** — **File → Add to Dock**, then **Add**.
- **Chrome or Edge** — click the install icon at the right of the address bar,
  or use the **INSTALL** button in the app's own header.

You now have a Focus Ledger icon in the Dock that opens in its own window, with
no address bar and no tabs.

## 6. Quit the server

Back in Terminal, press **Ctrl+C**. Close the window.

Open the app from the Dock — it still works. A service worker cached the page,
styles, script, icons and fonts on that first visit, and answers from that cache
before it ever tries the network. Your tasks are in the browser's local storage,
and a clock left running keeps counting, because the app stores the start time
rather than a tick count.

---

## Three rules that matter

**Use `localhost`, never `file://`.** Double-clicking `index.html` in Finder
shows the page, but browsers refuse to register a service worker on a `file://`
address. Nothing gets cached and the app cannot be installed. It has to be
served over `http://localhost` (or HTTPS).

**Keep the same port forever.** `localhost:8137` *is* the app's identity. Serve
it on 8000 later and the browser treats it as a completely different app, with
its own empty task list. If you ever need to start the server again, use 8137.

**Clearing site data wipes it.** "Clear History" in Safari, or clearing site data
in Chrome, deletes both the cache and your tasks. Use **EXPORT BACKUP** in the
app now and then; **IMPORT BACKUP** restores it.

---

## Updating to a newer version

After pulling new code:

```bash
git pull
python3 -m http.server 8137
```

Then open the app and reload it. One wrinkle: the browser only looks for a new
version when `sw.js` itself changes. If you pull a change to `index.html`,
`app.js` or `styles.css` and the app still looks the same, bump the version line
at the top of `sw.js`:

```js
var VERSION = 'v2';   // was 'v1'
```

Reload, and the app shows *"A new version is ready"* with a RELOAD button. Your
tasks are untouched by this — they live in local storage, not in the cache.

While developing, it is easier to open DevTools → **Application** →
**Service Workers** and tick **Update on reload**.

---

## Troubleshooting

**`Address already in use`** — something else holds the port. Free it:

```bash
lsof -ti:8137 | xargs kill
```

**The app does not offer to install** — it needs the manifest and an active
service worker. Check DevTools → Application → Service Workers shows one
"activated and is running". Check the address really is `localhost` and not an
IP such as `127.0.0.1:8137` (that works too, but it is a *different* origin, so
install it from whichever one you intend to keep).

**It stopped working after the server was off** — open the server again on 8137
and load `http://localhost:8137/` once; it re-caches. This normally only happens
after clearing site data or a long period of disuse.

**You want it on your iPhone too** — a local server cannot do that. Enable
GitHub Pages as described in the [README](README.md); that gives you an HTTPS
URL both machines can install from.
