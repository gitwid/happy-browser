# Happy Browser testing workflows

Use three mental buckets. They are not interchangeable.

## 1. Chrome Dev

Fast iteration on extension JavaScript, CSS, and options UI.

- **Browser:** Chrome or Chromium
- **Load from:** repository root (`manifest.json`, `src/`, `icons/`)
- **Method:** `chrome://extensions` → Developer Mode → **Load unpacked** → select repo root
- **Identity:** Chrome shows the name from root `manifest.json` (`Happy Browser`)
- **Best for:** content scripts, navigation scoring, Wikipedia peek, options page
- **Not for:** Safari packaging, TestFlight, App Store validation

Alternative after `npm run safari:sync`: load unpacked from  
`safari/Happy Browser/Happy Browser Extension/Resources` to mirror the exact Safari bundle layout.

## 2. Safari Dev

Safari-specific behavior before TestFlight.

- **Browser:** Safari
- **Build/install:** Xcode → scheme **Happy Browser** → **⌘R** (Debug)
- **Product identity (Debug only):**
  - App: **Happy Browser Dev** (`com.gitwid.happybrowser.dev`)
  - Extension: **Happy Browser Dev Extension**
- **Enable unsigned extensions:**
  - Safari → Settings → Advanced → show developer features if needed
  - Safari → Develop → **Allow Unsigned Extensions**
- **Then:** Safari → Settings → Extensions → enable **Happy Browser Dev Extension**
- **Best for:** Safari Web Extension compatibility, permissions, Wikipedia peek in Safari
- **Note:** Xcode runs a **pre-build sync** (`npm run safari:sync` with dev naming). You do not need to sync manually before every build.

Release builds from Xcode keep the production identity **Happy Browser** / **Happy Browser Extension**.

## 3. TestFlight Safari

Official beta channel.

- Install via TestFlight
- Enable in Safari → Settings → Extensions
- Built by Xcode Cloud from pushed commits
- Identity: **Happy Browser** (production)

## Practical rule

| Goal | Use |
|------|-----|
| Quick JS/CSS iteration | Chrome Dev |
| Safari-only behavior | Safari Dev (Debug) |
| Beta validation & feedback | TestFlight Safari |

## Avoiding confusion

- Debug and TestFlight extensions can look similar in Safari unless names differ — Debug uses **Happy Browser Dev** deliberately.
- Do not launch stale builds from `safari/DerivedData/`; always **⌘R** from Xcode or Product → Clean Build Folder first.
- After rebuilding, toggle the dev extension off and on in Safari Settings if behavior looks cached.
