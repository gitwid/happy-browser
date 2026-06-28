#!/usr/bin/env python3
import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_FILES = [
    "artifact-index.md",
    "timeline.md",
    "recovered-story.md",
    "meaning-summary.md",
    "uncertainties.md",
]
TOP_LEVEL_FILES = [
    "baseline.md",
    "artifact-inventory.md",
    "comparison.md",
]
BLIND_BOUNDARY_TEXT = "baseline.md`, `comparison.md`, and `human-context/` were not used"


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate the anatomy of a Happy Journal Recoverability Test packet."
    )
    parser.add_argument(
        "packet",
        nargs="?",
        help="Path to a packet folder. If omitted, the newest simulator packet is used.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable check results.",
    )
    parser.add_argument(
        "--allow-empty-artifacts",
        action="store_true",
        help="Allow zero artifacts for smoke-test packets created by UI tests.",
    )
    args = parser.parse_args()

    packet = Path(args.packet).expanduser() if args.packet else newest_simulator_packet()
    if packet is None:
        print("No Recoverability Tests packet found in CoreSimulator app containers.", file=sys.stderr)
        return 2

    packet = packet.resolve()
    checks = run_checks(packet, allow_empty_artifacts=args.allow_empty_artifacts)
    failed = [check for check in checks if not check.passed]

    if args.json:
        print(json.dumps({
            "packet": str(packet),
            "passed": not failed,
            "checks": [check.__dict__ for check in checks],
        }, indent=2))
    else:
        print(f"Recoverability packet: {packet}")
        for check in checks:
            marker = "PASS" if check.passed else "FAIL"
            print(f"[{marker}] {check.name}: {check.detail}")
        print()
        if failed:
            print(f"Recoverability packet check failed: {len(failed)} issue(s).", file=sys.stderr)
        else:
            print("Recoverability packet check passed.")

    return 1 if failed else 0


def newest_simulator_packet() -> Path | None:
    devices = Path.home() / "Library/Developer/CoreSimulator/Devices"
    if not devices.exists():
        return None

    candidates = list(devices.glob("*/data/Containers/Data/Application/*/Documents/Recoverability Tests/*"))
    packet_dirs = [path for path in candidates if path.is_dir()]
    if not packet_dirs:
        return None
    return max(packet_dirs, key=lambda path: path.stat().st_mtime)


def run_checks(packet: Path, allow_empty_artifacts: bool) -> list[Check]:
    checks: list[Check] = []

    checks.append(Check(
        "packet folder",
        packet.is_dir(),
        "exists" if packet.is_dir() else "missing or not a directory",
    ))
    if not packet.is_dir():
        return checks

    for filename in TOP_LEVEL_FILES:
        checks.append(file_exists(packet / filename, filename))

    artifacts_dir = packet / "artifacts"
    output_dir = packet / "system-output"
    human_context_dir = packet / "human-context"
    checks.append(dir_exists(artifacts_dir, "artifacts/"))
    checks.append(dir_exists(output_dir, "system-output/"))
    checks.append(dir_exists(human_context_dir, "human-context/"))
    checks.append(file_exists(human_context_dir / "artifact-annotations.md", "human-context/artifact-annotations.md"))

    artifact_count = len([path for path in artifacts_dir.iterdir() if path.is_file()]) if artifacts_dir.exists() else 0
    checks.append(Check(
        "artifact count",
        artifact_count > 0 or allow_empty_artifacts,
        f"{artifact_count} artifact file(s) found",
    ))

    for filename in OUTPUT_FILES:
        output_file = output_dir / filename
        checks.append(file_exists(output_file, f"system-output/{filename}"))
        if output_file.exists():
            text = output_file.read_text(encoding="utf-8", errors="replace")
            pending = "Pending system pass." in text
            checks.append(Check(
                f"{filename} generated",
                not pending,
                "not pending" if not pending else "still contains pending placeholder",
            ))
            checks.append(Check(
                f"{filename} blind boundary",
                BLIND_BOUNDARY_TEXT in text,
                "declares blind input scope" if BLIND_BOUNDARY_TEXT in text else "missing blind input scope declaration",
            ))

    comparison = packet / "comparison.md"
    if comparison.exists():
        text = comparison.read_text(encoding="utf-8", errors="replace")
        checks.append(Check(
            "comparison generated",
            "Score: /10" not in text and "Comparison Method" in text,
            "generated report present" if "Comparison Method" in text else "still appears to be the blank template",
        ))

    baseline = packet / "baseline.md"
    if baseline.exists():
        text = baseline.read_text(encoding="utf-8", errors="replace")
        memory = extract_section("## Memory Baseline", text)
        checks.append(Check(
            "baseline contains memory",
            bool(memory and memory != "_"),
            "memory baseline is filled" if memory and memory != "_" else "memory baseline is blank",
        ))

    return checks


def file_exists(path: Path, label: str) -> Check:
    return Check(label, path.is_file(), "exists" if path.is_file() else "missing")


def dir_exists(path: Path, label: str) -> Check:
    return Check(label, path.is_dir(), "exists" if path.is_dir() else "missing")


def extract_section(heading: str, markdown: str) -> str:
    start = markdown.find(heading)
    if start == -1:
        return ""
    rest = markdown[start + len(heading):]
    end = rest.find("\n## ")
    if end != -1:
        rest = rest[:end]
    return rest.strip()


if __name__ == "__main__":
    raise SystemExit(main())
