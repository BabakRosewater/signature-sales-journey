# Changelog Notes (Architecture Decisions, Assumptions, Gotchas)

## Key decisions

1. **No-build frontend**
   - App runs directly from `index.html` + Babel-transpiled `app.js`.
2. **Content-driven modules**
   - Learning content is stored as markdown + CSV under `content/`.
3. **Schema compatibility in loader**
   - Module tabs support both explicit `tabs[]` and inferred `files[]`.
4. **Cloudflare-friendly routing**
   - `_redirects` and `_routes.json` support SPA routes + Functions.

## Assumptions in code

- `content/modules.json` exists and is valid JSON.
- Each sidebar slug maps to `content/<slug>/module_meta.json`.
- Markdown files are trusted but still sanitized in rendering.
- AI endpoint is optional at UI level but requires env var in production.

## Known gotchas

- Deep linking locally can fail without rewrite-capable server.
- Orphan module folders can drift unnoticed unless regularly audited.
- Inconsistent file naming across older modules requires compatibility logic.
- CDN availability is a runtime dependency for core frontend libs.

## Suggested maintenance cadence

- Monthly content audit:
  - slug/folder/meta consistency
  - required files present
  - modules.json ordering and descriptions
- Quarterly UX copy audit for consistency and readability.
- Keep docs updated when loader behavior changes.
