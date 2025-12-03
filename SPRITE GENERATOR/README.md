# Sprite Generator - Local Run

This adds a minimal local runner to view `sprite.js` (adapted as `sprite.jsx`) in the browser.

Files added:
- `index.html` — HTML page that loads React, Babel and `sprite.jsx`.
- `sprite.jsx` — JSX copy of `sprite.js`, adjusted to run in-browser (uses a small inline icon instead of `lucide-react`).
- `run_server.py` — Simple Python HTTP server that opens `http://localhost:8000/`.

New: Animated GIF downloads
- When the "Animated" checkbox is enabled, the "Download PNG" button will produce an animated GIF instead of a PNG. The code captures several frames from the canvas and encodes them client-side using `gif.js`.
- `index.html` now includes `gif.js` from a CDN to support this feature.

How to run:

1. Make sure you have Python 3 installed.
2. From this folder run (PowerShell):

```powershell
python .\run_server.py
```

3. Your default browser should open `http://localhost:8000/`. If not, open it manually.

Notes:
- This uses in-browser Babel to transpile JSX. It's convenient for local testing but not intended for production.
- The original `sprite.js` remains unchanged; `sprite.jsx` is a runnable adaptation for local preview.

If you want, I can modify the app to use a proper bundler (Vite/esbuild) instead. Would you like that?