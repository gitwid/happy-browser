const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const sourceLogo = path.join(root, "logo.png");
const extensionIconDirs = [
  path.join(root, "icons"),
  path.join(root, "safari-extension", "icons"),
  path.join(root, "safari", "Happy Browser", "Happy Browser Extension", "Resources", "icons")
];
const appIconDir = path.join(root, "safari", "Happy Browser", "Happy Browser", "Assets.xcassets", "AppIcon.appiconset");
const largeIconDir = path.join(root, "safari", "Happy Browser", "Happy Browser", "Assets.xcassets", "LargeIcon.imageset");
const safariLandingIcon = path.join(root, "safari", "Happy Browser", "Happy Browser", "Resources", "Icon.png");

if (!fs.existsSync(sourceLogo)) {
  console.error("Missing logo.png. Add the source logo at the project root before generating icons.");
  process.exit(1);
}

for (const dir of extensionIconDirs) {
  fs.mkdirSync(dir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    resizePng(size, path.join(dir, `icon-${size}.png`));
  }
}

fs.mkdirSync(appIconDir, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  resizePng(size, path.join(appIconDir, `mac-icon-${size}@1x.png`));
  resizePng(size * 2, path.join(appIconDir, `mac-icon-${size}@2x.png`));
}

fs.mkdirSync(largeIconDir, { recursive: true });
resizePng(128, path.join(largeIconDir, "large-icon.png"));
resizePng(256, path.join(largeIconDir, "large-icon@2x.png"));
resizePng(384, path.join(largeIconDir, "large-icon@3x.png"));
resizePng(128, safariLandingIcon);

console.log("Generated Happy Browser icons from logo.png");

function resizePng(size, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = spawnSync("sips", [
    "--resampleHeightWidth",
    String(size),
    String(size),
    sourceLogo,
    "--out",
    outputPath
  ], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}
