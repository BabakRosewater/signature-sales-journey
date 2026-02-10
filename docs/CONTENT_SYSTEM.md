# Content System

## Canonical module structure (living standard)

Every module should use this structure:

```text
content/<slug>/
  module_meta.json
  1_overview.md
  2_science.md
  3_standards.md
  4_scripts.md
  5_roleplay.md
  6_worksheet.md
  overview.csv
```

## Canonical `module_meta.json` fields

Required (recommended canonical):
- `module_number` (number)
- `slug` (string, must equal folder name)
- `title` (string)
- `brand` (string)
- `version` (string)
- `last_updated` (ISO date string)
- `objective` (string)
- `position_in_journey` (string)
- `estimated_time_minutes` (number)
- `prerequisites` (string[])
- `learning_outcomes` (string[])
- `files` (string[]; include 6 md + csv)
- `tags` (string[])

Optional compatibility fields:
- `description`
- `tabs` (legacy/explicit tab config)
- `ai` (AI config object)

## Sidebar registration rules (`content/modules.json`)

Each module shown in UI must have one object with:
- `order` (unique integer sequence)
- `slug` (**must match folder name and `module_meta.slug`**)
- `title`
- `description`
- optional `blurb`

## Publish checklist (content author)

1. Create `content/<slug>/` folder.
2. Add all required files.
3. Ensure `module_meta.slug === <slug>`.
4. Ensure `module_meta.files[]` contains all required filenames.
5. Add sidebar entry in `content/modules.json`.
6. Validate JSON and file existence.
7. Click module in app and verify each tab renders.

## Validation checklist (developer)

```bash
# 1) Validate sidebar JSON
jq . content/modules.json >/dev/null

# 2) Validate all module_meta.json files
for m in content/*/module_meta.json; do jq . "$m" >/dev/null; done

# 3) Detect modules.json slugs missing folders
python - <<'PY'
import json, pathlib
root=pathlib.Path('content')
mods=json.loads((root/'modules.json').read_text())
for m in mods:
    p=root/m['slug']
    if not p.exists():
        print('MISSING FOLDER:', m['slug'])
PY

# 4) Verify canonical file set for one module
slug="<slug>"
for f in 1_overview.md 2_science.md 3_standards.md 4_scripts.md 5_roleplay.md 6_worksheet.md overview.csv; do
  test -f "content/$slug/$f" || echo "missing: $f"
done
```

## Current inconsistencies observed

- Legacy folder still exists with old slug pattern:
  - `content/post-sale-follow-up-and-loyalty/` (not referenced by `modules.json`)
- Some early modules use non-canonical filenames:
  - `2_the_science.md`, `5_role_play.md`, `3_greetings.md`, `4_roleplay.md`, `5_worksheet.md`
  - loader compatibility currently handles this via `tabs[]` or label inference fallback.
