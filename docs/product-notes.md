# Happy Browser Product Notes

## Known Good Patterns

- `https://flowzz.com/markus-apotheke-saarbrcken?pagination%5Bpage%5D=6`
  - Correctly treats `mehr laden` as the Happy action.
- `https://shop.dransay.com/products?...`
  - At footer/end, correctly reaches the calm `End reached` state.
- `https://flowzz.com/bayreuth-cannabis?pagination%5Bpage%5D=4`
  - Testbed for inner scroll containers where top-level window scroll is not enough.
- `https://www.bluetenbude.de/cannabis-blueten/filter/lagerbestand-in/`
  - German/Magento-style pagination using `Seite Weiter` for page 2.
- `https://bavarian-cannabis.com/extrakte`
  - Thorough regression target: numbered pagination must beat blog/Ratgeber `weiterlesen`, and page 2 must advance to page 3.

## Known Issues

- Shift-click pass-through works, but the rail does not yet become transparent on Shift-hover. This makes the target under the rail hard to inspect before click-through.
- `https://flowzz.com/rhein-apotheke-im-rztehaus-mhlburg` once scrolled to the bottom after load; mitigated with a startup gesture grace period, but keep an eye on it.
- `https://flowzz.com/seo-gruene-wirkstoffe` scrolled several page lengths unrequested; watch for startup or trackpad gesture false positives.

## Future Ideas

- If a user repeatedly clicks after a failed navigation, launch a playful repair flow instead of making failure feel broken.
- "Watch me do" teaching mode: dim page, spotlight cursor, let the user click the intended control, then save an anonymized selector/context pattern.
- Add joyful success feedback when a user teaches Happy a page pattern.
- Discrete later-stage "watch me do" observation for repeated multi-site tasks, such as checking several pharmacy inventory pages after a platform search.
- Hover-scroll correction: when the pointer is over a scrollable frame/container, wheel scrolling should target the thing underneath without needing a click first.
- Possible future "click beam" / depth targeting layer if pages make hover-scroll targeting too ambiguous.
