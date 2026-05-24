# Happy Browser Product Notes

## Known Good Patterns

- `https://redacted`
  - Correctly treats `mehr laden` as the Happy action.
- `https://redacted...`
  - At footer/end, correctly reaches the calm `End reached` state.
- `https://redacted`
  - Testbed for inner scroll containers where top-level window scroll is not enough.
- `redacted`
  - German/Magento-style pagination using `Seite Weiter` for page 2.
- `redacted`
  - Thorough regression target: numbered pagination must beat blog/Ratgeber `weiterlesen`, and page 2 must advance to page 3.

## Known Issues

- Shift-click pass-through works, but the rail does not yet become transparent on Shift-hover. This makes the target under the rail hard to inspect before click-through.
- `redacted` once scrolled to the bottom after load; mitigated with a startup gesture grace period, but keep an eye on it.
- `redacted` scrolled several page lengths unrequested; watch for startup or trackpad gesture false positives.
- `https://tvtropes.org/pmwiki/pmwiki.php/Main/LongList` is a good ambiguous-page testbed: ordinary article links can contain words like "Next" or "Previous" without being page-level navigation. Happy should avoid claiming confidence there unless a real navigation structure is found.

## Future Ideas

- If a user repeatedly clicks after a failed navigation, launch a playful repair flow instead of making failure feel broken.
- "Watch me do" teaching mode: dim page, spotlight cursor, let the user click the intended control, then save an anonymized selector/context pattern.
- Add joyful success feedback when a user teaches Happy a page pattern.
- Discrete later-stage "watch me do" observation for repeated multi-site tasks, such as checking several pharmacy inventory pages after a platform search.
- Hover-scroll correction: when the pointer is over a scrollable frame/container, wheel scrolling should target the thing underneath without needing a click first.
- Possible future "click beam" / depth targeting layer if pages make hover-scroll targeting too ambiguous.
