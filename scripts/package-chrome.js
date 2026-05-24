const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const packageDir = path.join(distDir, "chrome");
const sourceDir = path.join(root, "src");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const zipName = `happy-browser-${manifest.version}-chrome.zip`;
const zipPath = path.join(distDir, zipName);

const entries = [
  "manifest.json",
  "icons",
  "PRIVACY.md"
];

const srcEntries = [
  "content.css",
  "content.js",
  "navigation-scoring.js",
  "options.css",
  "options.html",
  "options.js"
];

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

for (const entry of entries) {
  copyRecursive(path.join(root, entry), path.join(packageDir, entry));
}

for (const entry of srcEntries) {
  copyRecursive(path.join(sourceDir, entry), path.join(packageDir, "src", entry));
}

fs.rmSync(zipPath, { force: true });
const result = spawnSync("zip", ["-r", zipPath, "."], {
  cwd: packageDir,
  encoding: "utf8"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

console.log(`Created ${path.relative(root, zipPath)}`);

function copyRecursive(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
