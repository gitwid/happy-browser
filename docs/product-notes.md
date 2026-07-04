# Product Notes

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
- Known behavior to carve out: on social-media image carousel pages reached from another site, the browser back action can become ambiguous after scrolling. Once the page scrolls back to the original post, a left swipe may advance the carousel and also trigger browser history back to the previous external page. Treat carousel navigation and page-history navigation as separate gestures before adding platform-specific fixes.
