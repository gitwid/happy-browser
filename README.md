# Happy Browser

Happy Browser adds calm, blind previous/next navigation to general websites. It detects page-level navigation targets and lets you move with arrow keys, horizontal scroll gestures, and large floating controls.

The goal is simple: when a page has a next page, previous page, gallery step, carousel step, or load-more action, you should not need to hunt for the tiny control with the pointer.

## Current Platforms

- Chrome Manifest V3 extension
- Safari Web Extension packaged in a macOS containing app

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
