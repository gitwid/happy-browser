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

## 2. Safari Dev

Safari-specific behavior before TestFlight.

### Fast path: Safari temporary extension (Safari 26+)

Best for quick JS/CSS iteration without Xcode.

1. Sync dev resources: `npm run safari:sync:dev`
2. Safari → Settings → **Developer** → **Add Temporary Extension…**
3. Select the **`safari-extension/`** folder (the one that contains `manifest.json`)
4. Enable the extension in Safari → Settings → Extensions

Use `safari-extension/` deliberately. It has no spaces in the path, so Safari accepts it reliably. Do **not** point Safari at `DerivedData/.../Debug`, `Happy Browser Dev.app`, or other Xcode build folders — Safari treats each path segment as a separate extension and shows errors like `"Debug" cannot be used as an extension`.

### Full path: Xcode wrapper app

Best for entitlements, signing, and App Store packaging checks.

- **Browser:** Safari
- **Build/install:** Xcode → scheme **Happy Browser** → **⌘R** (Debug)
- **Product identity (Debug only):**
  - App: **Happy Browser Dev** (`com.gitwid.happybrowser.dev`, bundle `HappyBrowserDev.app`)
  - Extension: **Happy Browser Dev Extension**
- **Enable unsigned extensions:**
  - Safari → Settings → Advanced → show developer features if needed
  - Safari → Develop → **Allow Unsigned Extensions**
- **Then:** Safari → Settings → Extensions → enable **Happy Browser Dev Extension**
- **Best for:** Safari Web Extension compatibility, permissions, Wikipedia peek in Safari
- **Note:** Xcode runs a **pre-build sync** with dev naming. You do not need to sync manually before every build.

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
| Quick JS/CSS iteration | Chrome Dev or Safari temporary extension (`safari-extension/`) |
| Safari-only behavior | Safari Dev (Debug via Xcode) |
| Beta validation & feedback | TestFlight Safari |

## Avoiding confusion

- Debug and TestFlight extensions can look similar in Safari unless names differ — Debug uses **Happy Browser Dev** deliberately.
- Do not launch stale builds from `safari/DerivedData/`; always **⌘R** from Xcode or Product → Clean Build Folder first.
- After rebuilding, toggle the dev extension off and on in Safari Settings if behavior looks cached.
- If Safari says `"Debug"`, `"4"`, or another single word **cannot be used as an extension**, you selected a build folder or path segment instead of an extension root folder. Go back to `safari-extension/` after `npm run safari:sync:dev`.
