# Safari Port

Happy Browser now has a macOS Safari Web Extension prototype.

## Structure

- `safari-extension/` is the Safari-specific WebExtension source folder.
- `safari/Happy Browser/` is the generated Xcode wrapper project.
- `icons/` and `safari-extension/icons/` contain generated PNG icons.
- Shared extension logic still lives in `src/`.

## Refresh Safari Extension Resources

After changing files in `src/`, sync the Safari source copy:

```sh
npm run safari:sync
```

If icons need to be regenerated:

```sh
npm run icons
```

## Package Safari Wrapper

The wrapper was generated with:

```sh
xcrun safari-web-extension-packager \
  --project-location safari \
  --app-name "Happy Browser" \
  --bundle-identifier com.happybrowser.extension \
  --swift \
  --macos-only \
  --copy-resources \
  --no-open \
  --no-prompt \
  --force \
  safari-extension
```

The generated project needed one bundle identifier correction:

- Parent app: `com.happybrowser.Happy-Browser`
- Extension: `com.happybrowser.Happy-Browser.Extension`

The extension bundle identifier must be prefixed by the parent app bundle identifier or Xcode fails `ValidateEmbeddedBinary`.

## Build Check

This build command succeeded locally:

```sh
xcodebuild \
  -project "safari/Happy Browser/Happy Browser.xcodeproj" \
  -scheme "Happy Browser" \
  -configuration Debug \
  -derivedDataPath safari/DerivedData \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Xcode may print simulator and cache warnings in sandboxed terminals. The relevant result is `** BUILD SUCCEEDED **`.

## Current Safari Caveats

- The Chrome new-tab override is not included in the Safari manifest yet.
- The generated app is a local debug wrapper, not a signed distributable.
- Safari gesture behavior still needs real browser testing on the same regression URLs used for Chrome.
