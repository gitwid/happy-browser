# Happy Browser

Happy Browser adds calm, blind previous/next navigation to general websites. It detects page-level navigation targets and lets you move with arrow keys, horizontal scroll gestures, and large floating controls.

The goal is simple: when a page has a next page, previous page, gallery step, carousel step, or load-more action, you should not need to hunt for the tiny control with the pointer.

## Current Platforms

This repository contains both current Happy Browser extension targets:

- Chrome Manifest V3 extension, rooted at `manifest.json`, `src/`, and `icons/`.
- Safari Web Extension, with shared extension resources in `safari-extension/` and the packaged macOS containing app in `safari/Happy Browser`.

Planned distribution channels include browser extension stores, app stores, and direct distribution where appropriate, including the Chrome Web Store, Apple App Store / Mac App Store, Microsoft Store, and direct downloads.

## Features

- Left and right arrow navigation in safe contexts
- Horizontal two-finger scroll gesture navigation
- Large draggable previous/next rail buttons
- Draggable semi-transparent on/off toggle
- `Alt+Shift+H` shortcut to toggle Happy Browser
- Local page analysis for likely previous/next targets
- Load-more detection for common product and listing pages
- Scroll fallback when no reliable page-level target exists
- New-tab search page for Chrome

## Privacy

Happy Browser analyzes the current page locally in the browser. It does not transmit browsing history, page content, or navigation analysis to a server. See [PRIVACY.md](PRIVACY.md).

## Development

### Extension identity (Trillian / Fenchurch)

The extension's manifest `name` is the **dev** identity **Trillian**, and the root `manifest.json` in this repo carries that dev name on purpose. Packaging for production swaps it to **Fenchurch** through the Safari sync scripts (`HAPPY_BROWSER_DEV=1` keeps Trillian; the plain `safari:sync` and release builds emit Fenchurch). A consequence worth knowing: a **Load unpacked** Chrome build always runs as the dev identity **Trillian**, since it uses the root manifest verbatim. This is intentional, not a bug. (The macOS containing app uses a separate pair of names — **Happy Browser Dev** for Debug, **Happy Browser** for Release.)

Install dependencies:

```sh
npm install
```

Run tests:

```sh
npm test
```

### Content-script modules

The main-world content script is split into focused files that load in order and cooperate through a shared `window.HappyBrowser` namespace (see `content_scripts` in `manifest.json`):

- `src/navigation-scoring.js` — page-analysis engine (previous/next/load-more scoring).
- `src/site-filter.js` — reusable, site-agnostic filter primitives (`window.HappyBrowser.siteFilter`): request pacing, anti-bot fail-fast, evidence excerpts, confirmed-signal storage.
- `src/link-tray.js` — the Link Tray (`registerLinkTray`).
- `src/work-tree.js` — the read-only Automator Work Tree (`registerWorkTree`).
- `src/ra-filter.js` — the Resident Advisor queer-event filter (`registerRaFilter`), built on `site-filter`.
- `src/content.js` — the core rail, gestures, navigation, and inspector. It owns the shared `state` object and helpers, and calls each feature module's `registerX(ctx)` to wire it in.

Feature modules only *define* their `register*` factory at load; every cross-reference resolves at call time (during `content.js` init), so load order among the feature files is not fragile. Add a new module by dropping it into the `content_scripts` list before `content.js` and (for tests) the `moduleFiles` array in `tests/content-media-signature.test.js`.

### Single source of truth

`src/` is the **only** tracked copy of the extension source. The Safari staging
copy (`safari-extension/src/`) and the Xcode resources copy
(`safari/Happy Browser/.../Resources/src/`) are **generated** from `src/` and are
git-ignored — never edit or commit them. Regenerate them with the sync command
below; the Xcode project also runs the sync automatically in its **Sync Extension
Resources** build phase, and it references `Resources/src` as a folder, so new files
added under `src/` are picked up without editing the Xcode project. (Node or Python 3
must be on `PATH` for the sync to run.)

Sync the Safari extension resources manually when needed outside Xcode:

```sh
npm run safari:sync
```

For Safari temporary extension loading (Safari 26+), use dev naming:

```sh
npm run safari:sync:dev
```

Then Safari → Settings → Developer → **Add Temporary Extension…** → select `safari-extension/`.

Xcode Debug builds run this automatically via a **Sync Extension Resources** build phase.

Package the Chrome extension:

```sh
npm run package:chrome
```

The Chrome ZIP is written to `dist/`.

## Loading In Chrome

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Choose **Load unpacked**.
4. Select this project folder.

See [docs/safari-dev-workflow.md](docs/safari-dev-workflow.md) for Chrome vs Safari Dev vs TestFlight workflows.

## Loading In Safari

The Safari version lives in `safari/Happy Browser`.

1. Open `safari/Happy Browser/Happy Browser.xcodeproj` in Xcode.
2. Select the shared scheme **Happy Browser** and destination **My Mac**.
3. **⌘R** (Debug) installs **Happy Browser Dev** and registers **Happy Browser Dev Extension**.
4. Enable unsigned extensions in Safari → Develop → **Allow Unsigned Extensions**.
5. Enable the extension in Safari → Settings → Extensions.

Release/Archive builds keep the production identity **Happy Browser**.

For unsigned development builds, Safari's unsigned extension support must be enabled from Safari's developer settings.

## Release Notes

Release planning lives in [docs/release-checklist.md](docs/release-checklist.md).

## License

Happy Browser is source-available tryware. You may inspect, run, and modify the project for evaluation and personal testing, but commercial use, redistribution, store publication, and public distribution require permission from the project maintainers. See [LICENSE.md](LICENSE.md).

Contributions are welcome under the terms in [CONTRIBUTING.md](CONTRIBUTING.md). Direct contributions will be attributed where practical, and contributors grant the project the rights needed to include those contributions in official Happy Browser builds and distribution efforts.
