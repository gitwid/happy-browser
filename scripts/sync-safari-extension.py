#!/usr/bin/env python3
import json
import os
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "src"
SOURCE_MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
DEV_MODE = os.environ.get("HAPPY_BROWSER_DEV") == "1"
MANIFEST_NAME = "Happy Browser Dev" if DEV_MODE else "Happy Browser"
TARGETS = [
    {
        "label": "Safari extension staging",
        "src_dir": ROOT / "safari-extension" / "src",
        "manifest": ROOT / "safari-extension" / "manifest.json",
    },
    {
        "label": "Safari Xcode resources",
        "src_dir": ROOT
        / "safari"
        / "Happy Browser"
        / "Happy Browser Extension"
        / "Resources"
        / "src",
        "manifest": ROOT
        / "safari"
        / "Happy Browser"
        / "Happy Browser Extension"
        / "Resources"
        / "manifest.json",
    },
]


def sync_target(target):
    src_dir = target["src_dir"]
    shutil.rmtree(src_dir, ignore_errors=True)
    src_dir.mkdir(parents=True, exist_ok=True)

    for entry in SOURCE_DIR.iterdir():
        if entry.is_file():
            shutil.copy2(entry, src_dir / entry.name)

    manifest_path = target["manifest"]
    target_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    target_manifest["name"] = MANIFEST_NAME
    target_manifest["version"] = SOURCE_MANIFEST["version"]
    target_manifest["description"] = SOURCE_MANIFEST["description"]
    target_manifest["content_scripts"] = SOURCE_MANIFEST["content_scripts"]
    if "background" in SOURCE_MANIFEST:
        target_manifest["background"] = SOURCE_MANIFEST["background"]
    else:
        target_manifest.pop("background", None)
    if "web_accessible_resources" in SOURCE_MANIFEST:
        target_manifest["web_accessible_resources"] = SOURCE_MANIFEST["web_accessible_resources"]
    else:
        target_manifest.pop("web_accessible_resources", None)

    manifest_path.write_text(
        json.dumps(target_manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print("Synced {} to {} ({})".format(target["label"], src_dir.relative_to(ROOT), MANIFEST_NAME))


for target in TARGETS:
    sync_target(target)
