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

## Automator Work Tree

The link Tray suggests a broader "watch me do" workflow layer for repeated browser work. The first target scenario is a chronological review queue: open the oldest tray link, read a generated report, resolve conflicts manually in the web editor, return to the item, run review, choose the merge style, wait for the item state icon to settle, then reopen the next tray link.

The product shape should be native-feeling and reviewable, not a hidden macro recorder. Happy Browser observes visible user intent signals: clicked links and buttons, hover dwell, focused controls, DOM changes under the cursor, state icons, disabled/enabled transitions, and post-action checksums of the relevant local DOM region. It then renders those as a compact work tree where each step remains inspectable before replay.

Repeated passes should collapse only when the visible structure and state transitions match. Identical actions at different vertical positions can become one grouped step with an internal count, such as many repeated conflict choices. Decision steps stay explicit: offer fast navigation, number-key choices, and all-A/all-B/all-C style bulk selection for truly identical prompts. Non-decision steps may collapse further when the prior step's output resolves to the same next checksum.

The key safety rule is that collapse follows evidence, not wishful similarity. A replayable branch needs a stable target signature, a before state, an after state, and a visible recovery path if the page no longer matches. The UI can feel like a pill box or blister pack: compact, tactile, and sequential, with iOS Liquid Glass as the interaction reference.

## Happy Browser Apps

Some pages contain a clearly bounded app inside an otherwise incidental website. A service widget, online reception panel, booking surface, checkout flow, or support console can often be separated from the page chrome by DOM structure, fixed positioning, iframe boundaries, role landmarks, visual containment, interaction density, and repeated button groups. The goal is to recognize "the actual app" and the irrelevant website portion as distinct layers.

Once identified, Happy Browser can treat the app as a first-class surface rather than a yesterday-style widget. Possible behaviors include releasing the app into a focused frame pop-up when browser policy, site terms, and user intent make that lawful; docking it like the Tray; or lifting it into a navigable Happy Browser layer while preserving the original DOM relationship and origin boundaries.

The 3D version is the more interesting direction. If app surfaces can be re-rendered onto 3D elements, the extracted app becomes its own navigable layer with remapped controls, re-honeycombed buttoning, depth, and spatial affordances. The source page remains available as provenance and context, but the user drives the useful application surface directly. Think spaceships and space-shuttles: web apps detached from page clutter, still grounded in the real DOM.

Implementation notes: app extraction should be explainable and reversible. The system should show the detected app boundary, the signals that made it confident, and any cross-origin or policy constraints. It must not spoof origin, bypass access controls, hide material disclosures, or detach a surface in a way that changes the user's legal or privacy relationship with the original service.
