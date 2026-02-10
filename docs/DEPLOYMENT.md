# Deployment (Cloudflare Pages)

## Runtime model

- Static assets served by Cloudflare Pages.
- Serverless function at `/api/gemini` via Pages Functions.

## Files controlling deployment behavior

- `_redirects`
  - redirects `/` and `/module` variants to `/module/overview-and-framework`
  - rewrites `/module/*` to `/index.html` (SPA route handling)
- `_routes.json`
  - includes `/api/*` for Functions

## Build settings

This repo has no bundler config or `package.json` build pipeline.

Recommended Pages settings:
- **Framework preset:** None
- **Build command:** *(empty)*
- **Build output directory:** `/` (repo root)
- **Functions directory:** `functions`

## Environment variables

Required for AI endpoint:
- `GEMINI_API_KEY`

Without it, `/api/gemini` returns 500 with explicit error.

## Preview vs Production notes

- Preview should include same env var if AI testing is needed.
- If AI is optional for preview, UI still loads modules; only AI tab will fail.

## Common deployment pitfalls

- Missing `GEMINI_API_KEY`.
- Misconfigured output directory causing missing `content/` files.
- Missing rewrite rules leading to 404 on deep links `/module/<slug>`.
- CDN dependency failures (`react`, `marked`, etc.) due network/policy restrictions.
