# Safari TestFlight Prep

Happy Browser's Safari build is a macOS containing app with an embedded Safari Web Extension.

## Bundle Identifiers

- Containing app: `com.gitwid.happybrowser`
- Safari extension: `com.gitwid.happybrowser.Extension`

These identifiers must exist in the Apple Developer account before App Store Connect upload.

## Current Xcode Settings

- Scheme: `Happy Browser`
- Configuration for archive: `Release`
- Version: `1.1`
- Build: `3`
- Minimum macOS: `14.0`
- Hardened Runtime: enabled
- App Sandbox: enabled

The containing app does not request outgoing network sandbox access. The extension still declares web page access in its WebExtension manifest because DOM-level page analysis is the core feature.

## One-Time Apple Setup

1. Enroll in the Apple Developer Program.
2. In Certificates, Identifiers & Profiles, create:
   - App ID for `com.gitwid.happybrowser`
   - App Extension ID for `com.gitwid.happybrowser.Extension`
3. In App Store Connect, create a new macOS app record:
   - Name: `Happy Browser`
   - Bundle ID: `com.gitwid.happybrowser`
   - SKU: `happy-browser-macos`
4. In Xcode, set the Team for both targets:
   - `Happy Browser`
   - `Happy Browser Extension`

## Archive For TestFlight

Preferred command-line flow:

```sh
./scripts/upload-testflight.sh
```

Equivalent npm shortcut:

```sh
npm run testflight:upload
```

The script syncs the Safari extension assets, installs npm dependencies if needed, runs the scoring tests, archives the macOS app with automatic signing, and uploads the archive to App Store Connect for TestFlight processing.

Manual Xcode fallback:

1. Open `safari/Happy Browser/Happy Browser.xcodeproj`.
2. Select the `Happy Browser` scheme.
3. Select destination `Any Mac` or `My Mac`.
4. Confirm signing team is set for both targets.
5. Choose **Product > Archive**.
6. In Organizer, choose **Distribute App**.
7. Choose **App Store Connect**.
8. Upload.

## Local Preflight

Run these before archiving:

```sh
npm test
npm run safari:sync
xcodebuild -project "safari/Happy Browser/Happy Browser.xcodeproj" -scheme "Happy Browser" -configuration Release -derivedDataPath safari/DerivedData CODE_SIGNING_ALLOWED=NO build
```

The command-line build disables signing so it only verifies that the project compiles. TestFlight uploads require Apple signing. `scripts/upload-testflight.sh` uses automatic signing with the configured team and may need the Apple Developer account to be available in Xcode or through App Store Connect API credentials.

## App Store Connect Metadata

Use the copy in `docs/store-listing-draft.md` as a starting point.

Privacy posture:

- Page analysis happens locally in Safari.
- No browsing history, page content, form values, clicks, or navigation analysis are sent to a server.
- Preferences are stored locally through browser/extension storage.

Permission explanation:

Happy Browser needs access to normal web pages so it can inspect visible page controls and find previous, next, and load-more navigation targets. This analysis runs locally in the browser and is used only to provide navigation controls shown to the user.

Compliance notes:

- See `docs/app-store-compliance.md`.
- The Xcode project sets `INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO`.
- If Happy Browser adds API calls, sync, analytics, AI services, accounts, telemetry, or custom cryptography, revisit export compliance and privacy answers before uploading another build.

## First TestFlight Goal

The first TestFlight build should prove:

- The containing app installs.
- Safari lists the extension.
- The extension can be enabled.
- The floating controls appear on `https` pages.
- The on/off toggle works.
- Basic navigation works on a known-good listing page.
