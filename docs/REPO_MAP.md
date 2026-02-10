# Repo Map

## Concise tree

```text
.
├── index.html                      # App HTML shell, CDN script loaders
├── app.js                          # React app (routing, module loading, tabs, AI panel)
├── styles.css                      # Markdown/content presentation styles
├── _redirects                      # Cloudflare SPA rewrite + root redirects
├── _routes.json                    # Cloudflare Functions route include for /api/*
├── functions/
│   └── api/
│       └── gemini.js               # Serverless proxy to Gemini REST API
├── content/
│   ├── modules.json                # Sidebar registry + order + slugs
│   ├── <module-slug>/              # One folder per module
│   │   ├── module_meta.json
│   │   ├── 1_overview.md ... 6_worksheet.md
│   │   └── overview.csv
│   └── ...
└── docs/
    ├── ARCHITECTURE.md
    ├── REPO_MAP.md
    ├── CONTENT_SYSTEM.md
    ├── MODULE_LOADER.md
    ├── DEPLOYMENT.md
    ├── TROUBLESHOOTING.md
    ├── UX_RECOMMENDATIONS.md
    └── CHANGELOG_NOTES.md
```

## Key folders

### `/content`
Primary source of truth for training content.

### `/functions/api`
Cloudflare Pages Functions API handlers.

### Root SPA files
- `index.html` bootstraps frontend dependencies.
- `app.js` handles all runtime behavior.
- `styles.css` handles markdown readability.

## “Other app” check
No separate bundled sub-apps or multi-page frontend apps are present. This repo currently hosts one SPA plus one API function endpoint.
