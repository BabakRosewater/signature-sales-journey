# Module Loader

## Entry points involved

- `index.html` mounts the app and loads `app.js`.
- `app.js` contains all module-loading logic.

## Routing and module selection

### Slug resolution
`getSlugFromPath()` reads slug from:
1. path `/module/<slug>`
2. fallback hash `#/module/<slug>`

### Navigation action
`navigateToModule(slug)` pushes `/module/<slug>` into history and dispatches `popstate` to trigger reload.

## Content loading flow (end-to-end)

1. **Initial sidebar load**
   - fetch `/content/modules.json`
   - sort by `order`
   - if no slug in URL, auto-navigate to first module slug

2. **Module metadata load**
   - fetch `/content/<slug>/module_meta.json`
   - store metadata with `__slug` marker to prevent stale fetch race

3. **Tab normalization (`buildTabsFromMeta`)**
   - if `tabs[]` exists:
     - normalize each entry with `type` default:
       - `markdown` if tab has `file`
       - `ai` otherwise
   - else if `files[]` exists:
     - infer markdown tabs from `.md` files
     - append AI tab
   - fallback to `overview.md` tab

4. **Default tab selection**
   - read `localStorage` key `ssj_tab_<slug>`
   - if saved tab exists in current module tabs, use it
   - else use first tab

5. **Tab content fetch**
   - only for markdown tabs
   - fetch `/content/<slug>/<tab.file>`
   - parse with `marked`
   - sanitize with `DOMPurify`
   - render with `dangerouslySetInnerHTML`

6. **AI tab flow**
   - `POST /api/gemini` with prompt/system/model
   - show returned text

## `tabs[]` vs `files[]` compatibility rules

### Preferred today
Use `files[]` with canonical filenames in `module_meta.json`.

### Supported legacy
`tabs[]` is still supported, including tabs missing `type` (auto-normalized).

### If both are present
Loader prioritizes `tabs[]`.

## Fragility / coupling

- If `modules.json.slug` does not match folder name and `module_meta.slug`, module will not load correctly.
- If active tab points to missing file, UI shows `Could not load <file>.md`.
- Deep links depend on deployment rewrite support.

## Optional fixes (documented, not applied)

- **Potential duplicate line in reading-progress block** near `app.js` around progress calculation (`return;` appears duplicated in current file snapshot). Functionally harmless but should be cleaned for readability.
- Add unit-level smoke assertions for tab normalization logic to prevent regressions.
