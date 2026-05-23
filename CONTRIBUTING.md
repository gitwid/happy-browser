# Contributing

Thank you for helping make Happy Browser calmer, kinder, and more useful.

## Contribution Terms

By intentionally submitting a contribution, you agree to the contribution terms in [LICENSE.md](LICENSE.md). In short:

- You have the right to contribute the material.
- You grant the project maintainers the rights needed to use, modify, sublicense, and distribute the contribution as part of Happy Browser.
- Official Happy Browser distribution may include app stores, browser extension stores, direct downloads, and future official channels.
- Direct contributions will be attributed where practical.

If you cannot agree to those terms, please do not submit code, assets, documentation, or other materials.

## What This Repo Contains

This repository contains both:

- A Chrome Manifest V3 extension.
- A Safari Web Extension packaged inside a macOS containing app.

Future official builds may target additional extension stores or app stores.

## Before Opening A Pull Request

- Keep changes focused.
- Run `npm test`.
- If extension assets changed, run `npm run package:chrome`.
- If Safari resources changed, run `npm run safari:sync` and build the Xcode project where possible.
- Avoid adding user-specific build products such as `DerivedData`, `.DS_Store`, or Xcode user state.

## Privacy Posture

Happy Browser's core navigation analysis should remain local-first. Changes that collect, transmit, or persist browsing data need explicit discussion before implementation.
