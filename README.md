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

Install dependencies:

```sh
npm install
```

Run tests:

```sh
npm test
```

Sync the Safari extension resources:

```sh
npm run safari:sync
```

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

## Loading In Safari

The Safari version lives in `safari/Happy Browser`. Build and run the containing app in Xcode, then enable the extension in Safari Extensions preferences.

For unsigned development builds, Safari's unsigned extension support must be enabled from Safari's developer settings.

## Release Notes

Release planning lives in [docs/release-checklist.md](docs/release-checklist.md).

## License

Happy Browser is source-available tryware. You may inspect, run, and modify the project for evaluation and personal testing, but commercial use, redistribution, store publication, and public distribution require permission from the project maintainers. See [LICENSE.md](LICENSE.md).

Contributions are welcome under the terms in [CONTRIBUTING.md](CONTRIBUTING.md). Direct contributions will be attributed where practical, and contributors grant the project the rights needed to include those contributions in official Happy Browser builds and distribution efforts.
