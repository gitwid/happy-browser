const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src");
const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const devMode = process.env.HAPPY_BROWSER_DEV === "1";
const manifestName = devMode ? "Trillian" : "Fenchurch";
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
  targetManifest.name = manifestName;
  targetManifest.version = sourceManifest.version;
  targetManifest.description = sourceManifest.description;
  targetManifest.permissions = sourceManifest.permissions;
  targetManifest.host_permissions = sourceManifest.host_permissions;
  targetManifest.content_scripts = sourceManifest.content_scripts;
  targetManifest.commands = sourceManifest.commands;
  targetManifest.action = sourceManifest.action ? { ...sourceManifest.action, default_title: manifestName } : undefined;
  targetManifest.options_ui = sourceManifest.options_ui;
  if (sourceManifest.background) {
    targetManifest.background = sourceManifest.background;
  } else {
    delete targetManifest.background;
  }
  if (sourceManifest.web_accessible_resources) {
    targetManifest.web_accessible_resources = sourceManifest.web_accessible_resources;
  } else {
    delete targetManifest.web_accessible_resources;
  }
  fs.writeFileSync(target.manifest, `${JSON.stringify(targetManifest, null, 2)}\n`);
  console.log(`Synced ${target.label} to ${path.relative(root, target.srcDir)} (${manifestName})`);
}
