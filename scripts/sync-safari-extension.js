const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src");
const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const targets = [
  {
    label: "Safari extension staging",
    srcDir: path.join(root, "safari-extension", "src"),
    manifest: path.join(root, "safari-extension", "manifest.json")
  },
  {
    label: "Safari Xcode resources",
    srcDir: path.join(root, "safari", "Happy Browser", "Happy Browser Extension", "Resources", "src"),
    manifest: path.join(root, "safari", "Happy Browser", "Happy Browser Extension", "Resources", "manifest.json")
  }
];

for (const target of targets) {
  fs.rmSync(target.srcDir, { recursive: true, force: true });
  fs.mkdirSync(target.srcDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir)) {
    const source = path.join(sourceDir, entry);
    const destination = path.join(target.srcDir, entry);
    if (fs.statSync(source).isFile()) {
      fs.copyFileSync(source, destination);
    }
  }

  const targetManifest = JSON.parse(fs.readFileSync(target.manifest, "utf8"));
  targetManifest.version = sourceManifest.version;
  targetManifest.description = sourceManifest.description;
  targetManifest.content_scripts = sourceManifest.content_scripts;
  fs.writeFileSync(target.manifest, `${JSON.stringify(targetManifest, null, 2)}\n`);
  console.log(`Synced ${target.label} to ${path.relative(root, target.srcDir)}`);
}
