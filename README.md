# Signature Sales Journey Training Hub

> **What this repo does:** Hosts a browser-based training hub that loads sales training modules from markdown/CSV content folders, renders them in tabbed learning flows, and provides an AI coaching panel via a Cloudflare Pages Function proxy.
>
> **How to run:** Serve the repo as a static site (`python3 -m http.server 4173`) and open `http://127.0.0.1:4173/`.
>
> **Where content lives:** `content/<module-slug>/` with `module_meta.json` + markdown tab files + `overview.csv`.

---

## Quick Start

### Prerequisites
- Python 3 (for quick local static server), or any static file server.
- Optional: Cloudflare Pages/Functions for `/api/gemini` runtime.

### Run locally (content + UI)
```bash
python3 -m http.server 4173
```
Open:
- `http://127.0.0.1:4173/`

> Note: direct deep links like `/module/<slug>` require rewrite support; with basic `http.server`, always start from `/`.

### Run AI endpoint (production-style)
Deploy on Cloudflare Pages with Functions enabled and set:
- `GEMINI_API_KEY`

See full deployment details: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## How the app works (short version)
1. `index.html` loads React/Babel/CDN libs and mounts `app.js`.
2. `app.js` fetches `content/modules.json` for sidebar modules.
3. Selecting a module fetches `content/<slug>/module_meta.json`.
4. Tabs are derived from either `tabs[]` or inferred from `files[]` markdown entries.
5. Active markdown tab fetches `content/<slug>/<tab-file>.md`, renders with `marked`, sanitizes with `DOMPurify`.
6. AI Lab posts to `/api/gemini` (Cloudflare Pages Function proxy) which calls Gemini REST.

Detailed flow: [`docs/MODULE_LOADER.md`](docs/MODULE_LOADER.md).

---

## Documentation Index
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Repo map: [`docs/REPO_MAP.md`](docs/REPO_MAP.md)
- Content system: [`docs/CONTENT_SYSTEM.md`](docs/CONTENT_SYSTEM.md)
- Module loader details: [`docs/MODULE_LOADER.md`](docs/MODULE_LOADER.md)
- Deployment: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Troubleshooting: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
- UX recommendations: [`docs/UX_RECOMMENDATIONS.md`](docs/UX_RECOMMENDATIONS.md)
- Change/gotcha notes: [`docs/CHANGELOG_NOTES.md`](docs/CHANGELOG_NOTES.md)

---

## How to add a new module

1. Create module folder:
   - `content/<slug>/`
2. Add required files:
   - `module_meta.json`
   - `1_overview.md`
   - `2_science.md`
   - `3_standards.md`
   - `4_scripts.md`
   - `5_roleplay.md`
   - `6_worksheet.md`
   - `overview.csv`
3. In `module_meta.json`, set:
   - `slug` exactly equal to folder name.
   - `files[]` listing the markdown/csv file names above.
4. Register sidebar entry in `content/modules.json`:
   - `order`, `slug`, `title`, `description`.
5. Validate:
```bash
jq . content/<slug>/module_meta.json
for f in 1_overview.md 2_science.md 3_standards.md 4_scripts.md 5_roleplay.md 6_worksheet.md overview.csv; do test -f content/<slug>/$f; done
jq '.[] | select(.slug=="<slug>")' content/modules.json
```
6. Start server and click module in sidebar to verify render.

Full standard + checklists: [`docs/CONTENT_SYSTEM.md`](docs/CONTENT_SYSTEM.md).

---

## Common failures and why

- **“Select a module…” shows**
  - Usually `modules.json` failed to load, or module list empty.
- **“Failed to load module meta for …”**
  - Missing/invalid `content/<slug>/module_meta.json`.
- **“Could not load <file>.md”**
  - Tab points to missing file or stale tab state/slug mismatch.
- **Deep-link 404 to `/module/<slug>` in local server**
  - Local server lacks rewrite rules (`/module/* -> /index.html`).
- **AI call fails with misconfigured server message**
  - `GEMINI_API_KEY` missing in Cloudflare env.

See full diagnostic matrix: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).
