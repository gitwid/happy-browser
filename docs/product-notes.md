# Product Notes

## Browser Kernel Modules

Content scripts load in this order (see `manifest.json`):

| Module | Role |
|--------|------|
| `navigation-scoring.js` | DOM analysis, candidate ranking, confidence tiers |
| `navigation-outcome.js` | Page snapshots, failed-click memory, navigation outcome observation |
| `navigation-rail.js` | Shadow-DOM rail UI — buttons, toggle, status, inspector |
| `content.js` | Orchestrator — settings, listeners, navigate, scroll fallback |

Future Happy Fill / Query modules should follow the same pattern: isolated adapter + legible preview surface, wired from a thin `content.js` orchestrator.

## Neutral Test Fixtures

Use reserved example domains in public docs and tests. Avoid naming real commercial sites, customer pages, pharmacies, shops, or partner organizations in committed fixtures.

Representative scenarios to keep covered:

- Query-string pagination on listing pages.
- Button-only load-more controls.
- Numbered pagination links.
- Footer or partner links that should not be treated as page navigation.
- Ambiguous article pages where ordinary links can contain words like "Next" or "Previous" without being page-level navigation.
- Inner scroll containers where top-level window scroll is not enough.
- Startup and trackpad gesture false positives near page load.
- Shift-click pass-through and rail hover transparency.

## Manual Regression Notes

- Keep examples generic when adding new reproduction cases.
- If a real site is needed for private debugging, keep the URL outside the repository.
- Public fixtures should use `example.com`, `example.net`, `example.org`, or `.test` hostnames.
