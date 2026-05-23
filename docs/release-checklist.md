# Release Checklist

## Repo

- [ ] Confirm `.gitignore` excludes local state, build products, and Xcode user data.
- [ ] Decide whether `docs/product-notes.md` should remain in the public repository.
- [ ] Confirm README states that the repository contains both Chrome and Safari extension targets.
- [ ] Confirm `LICENSE.md` and `CONTRIBUTING.md` reflect source-available tryware and contribution terms.
- [ ] Run `npm test`.
- [ ] Run `npm run package:chrome`.
- [ ] Build the Safari containing app in Xcode.
- [ ] Tag the release, for example `v0.1.0-beta`.

## Chrome Web Store

- [ ] Create or confirm Chrome Web Store developer account.
- [ ] Package the Chrome extension ZIP from `dist/`.
- [ ] Prepare a short description.
- [ ] Prepare a detailed description focused on the single purpose: local page navigation assistance.
- [ ] Prepare screenshots showing the rail, toggle, keyboard shortcut, and options page.
- [ ] Add privacy policy URL.
- [ ] Complete data disclosure: local page analysis, local preferences, no sale, no third-party sharing, no remote code.
- [ ] Explain broad host access: Happy Browser must inspect normal web pages locally to find navigation controls.
- [ ] Submit as unlisted or trusted tester release first.
- [ ] Test install/update path from the Web Store listing.

## Apple App Store / Safari

- [ ] Confirm Apple Developer Program membership.
- [ ] Set production bundle identifiers for the containing app and extension.
- [ ] Configure signing team and capabilities in Xcode.
- [ ] Replace development copy and screenshots with App Store-ready copy.
- [ ] Archive the macOS containing app in Xcode.
- [ ] Upload to App Store Connect.
- [ ] Complete privacy nutrition labels consistently with `PRIVACY.md`.
- [ ] Submit to TestFlight first.
- [ ] Verify Safari permission prompts, extension enablement, and page injection from a TestFlight build.
- [ ] Submit for App Review.

## Store Copy Themes

- Happy Browser gives pages predictable previous/next controls.
- It works locally in your browser.
- It does not collect or sell browsing data.
- It is designed for shopping pages, galleries, search results, archives, and listings.
- It can be turned off instantly from the page toggle or options.

## Review Risk Notes

- Broad host access is necessary for the product, but it must be justified clearly.
- Avoid promising automation or hidden clicking; v1 performs local analysis and user-triggered navigation.
- Keep the single purpose narrow: navigation assistance.
- Do not mention future teaching/reporting features in store copy until they are implemented and disclosed.
