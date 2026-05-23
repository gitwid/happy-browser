const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const safariRoot = path.join(root, "safari-extension");
const sourceDir = path.join(root, "src");
const targetDir = path.join(safariRoot, "src");

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

for (const entry of fs.readdirSync(sourceDir)) {
  const source = path.join(sourceDir, entry);
  const target = path.join(targetDir, entry);
  if (fs.statSync(source).isFile()) {
    fs.copyFileSync(source, target);
  }
}

console.log(`Synced Safari extension resources to ${path.relative(root, targetDir)}`);
