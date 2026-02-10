# UX Recommendations (Documentation Only)

> This file documents recommended UX improvements and content presentation standards. No code changes are prescribed here.

## Current UX strengths

- Clear sidebar module navigation.
- Tabbed content consumption.
- Markdown rendering with safety sanitization.
- AI coaching panel integrated in-flow.

## Content UX standards to adopt

### 1) Single navigation pattern
- Use top tabs only.
- Avoid in-body “Jump to:” links.
- Keep tab naming consistent: `Overview, Science, Standards, Scripts, Role-Play, Worksheet, AI Lab`.

### 2) Consistent module scaffolding
Each tab should be scannable and concise:
- one clear objective (or header)
- short bullets
- one framework block
- one practical outcome

### 3) Visual hierarchy
- Standardized heading levels (`#`, `##`, `###`).
- Keep long quotes sparse and purposeful.
- Reduce repeated sections in legacy pages.

### 4) Reading ergonomics
- Keep paragraphs short (2–4 lines).
- Prefer bullets for procedures.
- Use one idea per bullet.

### 5) Learning flow enhancements (future)
- Add “mark tab complete” state.
- Add module completion percentage.
- Add search/filter across scripts and standards.
- Add quick-copy buttons for key scripts.

## UI-level recommendations (future)

- Add a sticky top mini-nav for tab + progress context.
- Improve mobile sidebar behavior (collapse/drawer + active context).
- Add “resume where you left off” across sessions for module, not only tab.
- Add lightweight loading skeletons for markdown panel.

## Accessibility recommendations

- Ensure focus-visible styles on tab and sidebar controls.
- Add aria-current or equivalent indicator on active module/tab.
- Validate heading order and contrast across generated markdown.

## Content consistency issues observed

- Legacy and modern module filename patterns coexist.
- One orphan legacy module folder exists with old slug pattern.
- Some metadata has `tabs[]`; others only `files[]`.

Recommendation: maintain backward compatibility in loader, but enforce canonical authoring standard going forward.
