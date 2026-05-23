# App Store Compliance Notes

This is an operational checklist, not legal advice. It records the compliance posture for Happy Browser's Safari TestFlight and later public App Store release.

## Current Position

Happy Browser is currently intended to ship first as:

- TestFlight beta
- Free distribution
- No in-app purchases
- No subscriptions
- No ads
- No third-party tracking
- No account system
- Local page analysis only

The Safari extension reads page structure locally to find visible previous, next, and load-more controls. It should not transmit browsing history, URLs, page content, form values, clicks, or navigation analysis to a remote server.

## TestFlight

For TestFlight:

- Beta builds are free.
- Apple may require beta review for external testers.
- Export compliance must be answered before builds can be tested if App Store Connect marks the build as missing compliance.
- Test information should describe the extension honestly and narrowly.

Use `docs/testflight.md` for the TestFlight upload flow.

## Export Compliance

Current code does not implement custom cryptography and does not call external services from the containing app or extension logic.

The Xcode project sets:

```text
ITSAppUsesNonExemptEncryption = NO
```

This means the app does not use non-exempt encryption. It is consistent with a build that only relies on Apple operating-system encryption or exempt/standard platform behavior.

Revisit this immediately if Happy Browser adds:

- Custom cryptography
- Non-Apple crypto libraries
- Authentication
- API calls
- Sync
- Cloud storage
- Analytics
- AI services
- Any network service controlled by the project

If App Store Connect asks export questions, answer according to the build that is actually being uploaded.

## Privacy

App Store Connect requires app privacy answers and a privacy policy URL for macOS apps.

Current intended answer:

- No data collected by Happy Browser.

Only use that answer while it remains true. If we add telemetry, reporting, teaching mode, account sync, AI APIs, or any server-side feature, update:

- `PRIVACY.md`
- App Store Connect privacy answers
- TestFlight notes
- Store listing copy

## Permissions

Safari extension page access must be explained as necessary for local navigation assistance:

Happy Browser needs access to normal web pages so it can inspect visible page controls and find previous, next, and load-more navigation targets. This analysis runs locally in the browser and is used only to provide navigation controls shown to the user.

## IP And Assets

Before public release, verify:

- Happy Browser name has no obvious trademark conflict.
- `logo.png` and generated icons are owned or properly licensed.
- Screenshots do not expose private information or third-party copyrighted content beyond ordinary, review-safe product-page context.
- Dependencies are compatible with distribution.

## Ratings

The current app should be eligible for a low age rating if it remains a utility extension that does not surface mature content, gambling, medical advice, unrestricted user-generated content, or web content inside the containing app.

Answer the rating questionnaire based on actual functionality at submission time.

## Commercial Terms

Initial App Store path should remain:

- Free
- No IAP
- No subscriptions
- No paid external unlock

If paid functionality is added later, reassess Apple payment rules, commissions, taxes, refunds, and EU trader obligations before implementation.

## EU / DSA Trader Status

For TestFlight-only beta, non-trader may be defensible if distribution is not commercial.

For public EU App Store release, reassess before submission. If Happy Browser is connected to professional activity, monetization, consulting, paid services, or a broader commercial platform strategy, trader status may be required and public contact details may appear on the EU App Store page.

## Do Not Ship Publicly Until

- Privacy policy URL is live.
- App Store privacy answers match the actual build.
- Export compliance answer matches the actual build.
- TestFlight notes are accurate.
- Store screenshots are cleared.
- Support contact is ready.
- App identifiers and signing are production-ready.
- The app has been tested from TestFlight, not just local Xcode builds.
