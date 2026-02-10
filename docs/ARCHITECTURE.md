# Architecture

## High-level system

This repository is a **static frontend app + content repository + serverless API proxy**.

- **Frontend shell**: `index.html` + `app.js` + `styles.css`
- **Content source**: `content/` folders containing module metadata + markdown + CSV
- **AI backend proxy**: `functions/api/gemini.js` (Cloudflare Pages Function)
- **Routing behavior**: Cloudflare rewrite rules in `_redirects` and function routes in `_routes.json`

---

## Runtime components

### 1) Frontend app
- Entry HTML: `index.html`
- App runtime: `app.js`
- Markdown styling: `styles.css`

`index.html` loads:
- Tailwind CDN
- `marked` for markdown parsing
- `DOMPurify` for sanitized HTML
- React + ReactDOM UMD
- Babel standalone (so `app.js` can use JSX without build step)

### 2) Content system
- Global module index: `content/modules.json`
- Per module folder: `content/<slug>/`
- Required files are standardized (see `CONTENT_SYSTEM.md`)

### 3) Serverless AI endpoint
- Function path: `/api/gemini`
- Implementation: `functions/api/gemini.js`
- Env requirement: `GEMINI_API_KEY`

### 4) Edge routing
- `_redirects` sets SPA rewrites for `/module/* -> /index.html`
- `_routes.json` includes `/api/*` for Functions runtime

---

## End-to-end request flow

### Module loading
1. Browser loads `/` (or rewritten `/module/<slug>`).
2. App fetches `content/modules.json`.
3. Sidebar click updates path to `/module/<slug>`.
4. App fetches `content/<slug>/module_meta.json`.
5. App computes tabs via `buildTabsFromMeta`:
   - use `tabs[]` if present,
   - otherwise infer from `files[]` markdown files.
6. App fetches active markdown tab file and renders sanitized HTML.

### AI flow
1. User enters prompt in AI tab.
2. App `POST`s to `/api/gemini` with prompt/system/model.
3. Function reads `GEMINI_API_KEY` and calls Gemini REST.
4. Function returns parsed text payload to UI.

---

## Design decisions present in code

- **No build step** frontend: Babel transforms `app.js` in-browser.
- **Content-driven UI**: modules are data/config + markdown.
- **Schema compatibility layer**: supports both `tabs[]` and `files[]` metadata shapes.
- **No-store fetches** for content and JSON to avoid stale cache confusion during content edits.

---

## Architectural fragility points

- CDN dependency chain in `index.html` (if CDN blocked, app fails).
- Mixed legacy/new module folder patterns can drift if `modules.json` and `content/<slug>` diverge.
- Duplicate/stale directories can remain in repo without runtime use (e.g. old slug folders).
- Local static servers without rewrite support can’t deep-link `/module/<slug>` directly.
