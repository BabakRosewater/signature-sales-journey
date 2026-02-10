# Gemini Coding Partner Brief

Use this brief to onboard Gemini Coding Partner quickly and generate safe, incremental improvements for this repository.

## Objective

Design and implement a polished, scalable **Training Application v2** while preserving current behavior and content compatibility.

## Repository snapshot

### Stack and runtime
- Frontend is a **no-build SPA**:
  - `index.html` loads React (UMD), Babel standalone, Tailwind CDN, `marked`, and `DOMPurify`, then mounts `app.js`.
- Main app logic is in `app.js`.
- AI endpoint is Cloudflare Pages Function at `/api/gemini` in `functions/api/gemini.js`.

### Routing model
- Module routes are path-based (`/module/<slug>`) with hash fallback parsing in `getSlugFromPath()`.
- Navigation updates history via `navigateToModule()`.
- Cloudflare rewrites `/module/*` to `/index.html` in `_redirects`.
- Functions routing includes `/api/*` in `_routes.json`.

### Content loading flow
- Sidebar data loads from `content/modules.json`.
- Module metadata loads from `content/<slug>/module_meta.json`.
- Tabs are normalized from:
  - explicit `tabs[]` (legacy + supported), or
  - inferred from `files[]` markdown entries + auto AI tab.
- Markdown tab content fetches as `/content/<slug>/<tab.file>`, then `marked` + `DOMPurify`.

### Module content contract
- Canonical module structure and checklist are in `docs/CONTENT_SYSTEM.md`.
- README includes “How to add a module” and quick checks.

### Known constraints
- Local deep links can 404 if the local server does not apply rewrite rules.
- Mixed legacy/new content naming still exists; loader compatibility currently handles it.
- There is an orphan legacy folder not used by sidebar.

## Prompt template for Gemini

```md
You are helping me evolve a training web app repository.

## Objective
Design and implement a polished, scalable “Training Application v2” while preserving current behavior and content compatibility.

## Current repository facts (must honor)
- Frontend is no-build: index.html + app.js + styles.css (React UMD + Babel standalone).
- Content is filesystem-driven under /content.
- Sidebar source: /content/modules.json.
- Per-module metadata: /content/<slug>/module_meta.json.
- Tab logic must support BOTH:
  1) legacy tabs[] metadata
  2) modern files[] metadata (infer markdown tabs + AI tab)
- Markdown rendering uses marked + DOMPurify.
- AI endpoint is Cloudflare Pages Function at /api/gemini requiring GEMINI_API_KEY.
- SPA routes: /module/<slug> (Cloudflare rewrite via _redirects).

## Deliverables
1) Propose architecture improvements WITHOUT breaking current content.
2) Provide phased implementation plan (Phase 1 minimal risk, Phase 2 medium, Phase 3 advanced).
3) Add acceptance criteria per phase.
4) Include migration strategy for legacy modules and filename inconsistencies.
5) Include tests/check scripts for:
   - modules.json ↔ folder ↔ module_meta.slug consistency
   - required module files
   - broken tab file references
6) Improve UX to feel more app-like:
   - consistent layout system
   - mobile-first sidebar behavior
   - learner progress UX
   - accessibility baseline (focus states, aria-current, heading structure)
7) Keep deployment target Cloudflare Pages + Functions.
8) Return exact code diffs and file-by-file changes.

## Non-goals
- Do not remove compatibility for existing modules.
- Do not assume a bundler unless you also provide a migration fallback.
- Do not rewrite all content copy.

## First response format
- Section A: Repo understanding summary
- Section B: Risks and fragile couplings
- Section C: Recommended v2 architecture
- Section D: Phase plan with effort/risk
- Section E: Exact first PR proposal (small, safe, high-impact)
```

## Recommended execution order
1. Build validator scripts first (slug/file/meta consistency).
2. Stabilize the content contract (`files[]` canonical while retaining `tabs[]` compatibility).
3. Ship UX upgrades in small PRs (responsive sidebar, active states, progress UX).
4. Consider platform migration (optional) only after contracts and checks are stable.

## Questions to ask Gemini for better output
- “Show me the smallest first PR that improves UX with near-zero risk.”
- “Give me rollback plan for each phase.”
- “List breaking-change checkpoints before each PR.”
- “Generate scripts/validate-content.py plus expected CLI output examples.”
- “Provide accessibility acceptance checks (keyboard nav, focus, contrast, headings).”
