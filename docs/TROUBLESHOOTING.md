# Troubleshooting

## Symptom: “Select a module…”

### Likely causes
- `content/modules.json` failed to fetch/parse.
- Sidebar modules array is empty.

### Checks
```bash
jq . content/modules.json >/dev/null
```
Open browser console for `Failed to load modules.json` message.

---

## Symptom: “Failed to load module meta for "<slug>"”

### Likely causes
- Missing `content/<slug>/module_meta.json`
- Invalid JSON in module metadata
- Slug mismatch between route and folder

### Checks
```bash
jq . content/<slug>/module_meta.json >/dev/null
```

---

## Symptom: “Could not load <file>.md”

### Likely causes
- Tab points to missing markdown file
- `tabs[]`/`files[]` mismatch in `module_meta.json`
- Stale legacy tab config

### Checks
```bash
ls content/<slug>
jq . content/<slug>/module_meta.json
```

---

## Symptom: Deep link `/module/<slug>` 404 in local dev

### Why
Basic static servers do not apply `_redirects` rewrite rules.

### Fix
Use `http://127.0.0.1:<port>/` then click module in sidebar, or use a server that supports rewrite config.

---

## Symptom: AI tab returns error

### Likely causes
- No `GEMINI_API_KEY` in Cloudflare environment
- Upstream Gemini API error

### Checks
- Function logs in Pages dashboard
- Verify env var exists in the environment

---

## Symptom: Module appears in filesystem but not sidebar

### Why
Module is not registered in `content/modules.json`.

### Fix
Add sidebar entry with matching slug/order/title/description.

---

## Cache-related confusion

`app.js` uses `cache: "no-store"` for JSON/text fetches, so content updates are usually immediate. If stale content persists:
- hard refresh browser
- confirm deployment uploaded updated files
- verify path/slug hasn’t changed
