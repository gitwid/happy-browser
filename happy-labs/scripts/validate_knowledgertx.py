#!/usr/bin/env python3
"""Validate KnowledgeRTX.usda against knowledgertx-bindings.yaml (stdlib only)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USDA = ROOT / "KnowledgeRTX.usda"
BINDINGS = ROOT / "knowledgertx-bindings.yaml"

REQUIRED_NODES = [
    "KnowledgeRTX",
    "Question",
    "AttentionRays",
    "ConvergenceField",
    "HumanInLoop",
    "Action",
]

REFLECTIVE_ENTITIES = [
    "Resource_DocumentCorpus",
    "Resource_UserContext",
    "Resource_SourceChain",
    "Resource_ModelBoundary",
    "Resource_RuntimeObservation",
]

GAP_NODES = [
    "Gap_RuntimeSourceBindings",
    "Gap_ConfidenceComputation",
    "Gap_CustomSchemaPlugin",
]

STATUS_RANK = {
    "bound": 5,
    "partial": 4,
    "optional": 3,
    "rewrite": 3,
    "gap": 2,
}


def load_text(path: Path) -> str:
    if not path.is_file():
        raise FileNotFoundError(path)
    return path.read_text(encoding="utf-8")


def parse_bindings(text: str) -> tuple[list[dict[str, str]], dict[str, str], list[dict[str, str]], dict[str, str]]:
    bindings: list[dict[str, str]] = []
    gaps: dict[str, str] = {}
    changelog: list[dict[str, str]] = []
    baseline: dict[str, str] = {}

    section = None
    current: dict[str, str] = {}
    changelog_current: dict[str, str] = {}

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line == "bindings:":
            section = "bindings"
            continue
        if line == "gaps:":
            if current:
                bindings.append(current)
                current = {}
            section = "gaps"
            continue
        if line == "changelog:":
            section = "changelog"
            continue
        if line == "status_baseline:":
            section = "baseline"
            continue

        if section == "bindings" and line.startswith("- path:"):
            if current:
                bindings.append(current)
            current = {"path": line.split(":", 1)[1].strip()}
            continue
        if section == "bindings" and line.startswith("swift:"):
            current["swift"] = line.split(":", 1)[1].strip().strip('"')
            continue
        if section == "bindings" and line.startswith("status:"):
            current["status"] = line.split(":", 1)[1].strip()
            continue

        if section == "changelog" and line.startswith("- path:"):
            if changelog_current:
                changelog.append(changelog_current)
            changelog_current = {"path": line.split(":", 1)[1].strip()}
            continue
        if section == "changelog" and line.startswith("from:"):
            changelog_current["from"] = line.split(":", 1)[1].strip()
            continue
        if section == "changelog" and line.startswith("to:"):
            changelog_current["to"] = line.split(":", 1)[1].strip()
            continue
        if section == "changelog" and line.startswith("note:"):
            changelog_current["note"] = line.split(":", 1)[1].strip().strip('"')
            continue

        if section == "gaps" and ":" in line and not line.startswith("-"):
            key, value = line.split(":", 1)
            gaps[key.strip()] = value.strip()
            continue

        if section == "baseline" and ":" in line:
            key, value = line.split(":", 1)
            baseline[key.strip()] = value.strip()

    if current:
        bindings.append(current)
    if changelog_current:
        changelog.append(changelog_current)

    return bindings, gaps, changelog, baseline


def assert_required_usd_nodes(usda: str) -> list[str]:
    errors: list[str] = []
    for name in REQUIRED_NODES:
        if not re.search(rf'\bdef\s+\w+\s+"{re.escape(name)}"', usda):
            errors.append(f"missing required USD node: {name}")
    for name in REFLECTIVE_ENTITIES:
        if name not in usda:
            errors.append(f"missing ReflectiveEntity: {name}")
    for name in GAP_NODES:
        if name not in usda:
            errors.append(f"missing Gap node: {name}")
    return errors


def assert_reflective_entity_mappings(bindings: list[dict[str, str]]) -> list[str]:
    errors: list[str] = []
    paths = [row.get("path", "") for row in bindings]
    for entity in REFLECTIVE_ENTITIES:
        if not any(entity in path for path in paths):
            errors.append(f"no binding row for ReflectiveEntity {entity}")
    return errors


def assert_gap_statuses(gaps: dict[str, str]) -> list[str]:
    errors: list[str] = []
    for name in GAP_NODES:
        if name not in gaps:
            errors.append(f"missing sprint status for {name}")
    return errors


def assert_no_regression_without_changelog(
    bindings: list[dict[str, str]],
    baseline: dict[str, str],
    changelog: list[dict[str, str]],
) -> list[str]:
    errors: list[str] = []
    for row in bindings:
        path = row.get("path", "")
        current = str(row.get("status", "")).lower()
        expected = str(baseline.get(path, current)).lower()
        if not current or not expected:
            continue
        current_rank = STATUS_RANK.get(current)
        expected_rank = STATUS_RANK.get(expected)
        if current_rank is None or expected_rank is None:
            errors.append(f"unknown status for {path}: {current!r} or baseline {expected!r}")
            continue
        if current_rank >= expected_rank:
            continue
        documented = any(entry.get("path") == path for entry in changelog)
        if not documented:
            errors.append(
                f"binding regression {path}: {expected} -> {current} without changelog entry"
            )
    return errors


def main() -> int:
    errors: list[str] = []
    try:
        usda = load_text(USDA)
        bindings_text = load_text(BINDINGS)
        bindings, gaps, changelog, baseline = parse_bindings(bindings_text)
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    errors.extend(assert_required_usd_nodes(usda))
    errors.extend(assert_reflective_entity_mappings(bindings))
    errors.extend(assert_gap_statuses(gaps))
    errors.extend(assert_no_regression_without_changelog(bindings, baseline, changelog))

    if errors:
        print("KnowledgeRTX validation failed:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print("KnowledgeRTX validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
