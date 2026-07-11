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

**Implementation status (2026-07-10): read-only slice landed.** `src/work-tree.js` is a first, deliberately non-replaying slice. It passively observes visible intent — clicked links, buttons, and focusable controls — and renders them as a compact, inspectable work tree in the rail (a blister-pack list with a per-step count). Consecutive identical actions collapse into one counted step, collapse following evidence (identical target signature) only. It records and displays; it never replays, honouring the preview-before-act rule. Replay stays a later, separate slice that will add before/after state signatures and a recovery path. State is in-memory per page load — no persistence, no keystroke capture.

## Site-filter module

The hard parts of the RA queer-event filter — rate-limited detail scanning, anti-bot fail-fast, human-readable evidence excerpts, and persisted human-confirmed signals — are the machinery a general "one filter per site" surface (and Seam Surfing) needs. As of 2026-07-10 these are extracted, dependency-free, into `src/site-filter.js` (`window.HappyBrowser.siteFilter`); `src/ra-filter.js` now supplies only the RA-specific patterns, selectors, storage key, and state slots, delegating the reusable machinery. A second site filter should be able to reuse the module rather than re-derive it.

## Happy Browser Apps

Some pages contain a clearly bounded app inside an otherwise incidental website. A service widget, online reception panel, booking surface, checkout flow, or support console can often be separated from the page chrome by DOM structure, fixed positioning, iframe boundaries, role landmarks, visual containment, interaction density, and repeated button groups. The goal is to recognize "the actual app" and the irrelevant website portion as distinct layers.

Once identified, Happy Browser can treat the app as a first-class surface rather than a yesterday-style widget. Possible behaviors include releasing the app into a focused frame pop-up when browser policy, site terms, and user intent make that lawful; docking it like the Tray; or lifting it into a navigable Happy Browser layer while preserving the original DOM relationship and origin boundaries.

The 3D version is the more interesting direction. If app surfaces can be re-rendered onto 3D elements, the extracted app becomes its own navigable layer with remapped controls, re-honeycombed buttoning, depth, and spatial affordances. The source page remains available as provenance and context, but the user drives the useful application surface directly. Think spaceships and space-shuttles: web apps detached from page clutter, still grounded in the real DOM.

Implementation notes: app extraction should be explainable and reversible. The system should show the detected app boundary, the signals that made it confident, and any cross-origin or policy constraints. It must not spoof origin, bypass access controls, hide material disclosures, or detach a surface in a way that changes the user's legal or privacy relationship with the original service.

## Seam Surfing

Happy Browser can also support expressive seasonal and preference-shaped browsing modes. A holiday mode might tune an image or video feed toward spooky posts, cute posts, or an alternating trick/treat rhythm, but the deeper product idea is not a binary content filter. Seam surfing means exploring content along the oscillation between dualities: scary and cute, serious and playful, precise and loose, familiar and strange.

The system should infer candidate seams from visible content, user behavior, and optional human-in-the-loop validation. Once a seam is learned, navigation can move along it deliberately: hold one side, alternate sides, drift through the middle, or surface delightful contrast. The UI should make the current seam legible and reversible so the user feels accompanied by a taste-aware browser, not trapped in an opaque recommender.

This should remain local-first wherever possible. Seasonal or playful modes can be whimsical at the surface, but the underlying contract is serious: show why an item was considered one side of a seam, let the user correct it, and treat delight as a learned preference with consent rather than a default assumption.

## Spatial Web Composer

Some messy web apps already contain the structure of a better interface: a navigation rail, a primary content stream, side recommendations, a chat window, utility controls, and status surfaces. Happy Browser should be able to decompose that page into movable tiles, then recompose it as a spatial scene. A common first layout is a three-panel triptych: primary content in the center, supporting panels on either side, with the outside panels slightly angled inward in 3D space.

This is a web-native descendant of Quartz Composer, but more approachable. DOM regions become tiles that can be rearranged, resized, linked, slid aside, or pinned into their own surface. Connections between tiles should stay live: a selected post can drive the chat tile, a tray item can open into the center tile, a side panel can become a honeycombed control surface, and captured actions can remain attached to the tile they came from.

The composition layer should preserve provenance. Each tile needs to know its source DOM region, origin, interaction permissions, and current self-test state. Rearrangement must not break the user's understanding of where an action will happen. The delight comes from turning a flat cluttered page into a legible cockpit, not from disguising the original web app.
