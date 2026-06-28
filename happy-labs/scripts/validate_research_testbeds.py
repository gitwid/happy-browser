#!/usr/bin/env python3
"""Validate Happy Labs research testbeds (stdlib only)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
TESTBEDS = DOCS / "testbeds"
CONTINUITY = DOCS / "research-continuity.md"
INDEX = TESTBEDS / "README.md"
SUPERVISION = TESTBEDS / "supervision-protocol.md"

TESTBED_FILES = {
    "legitimacy-transition-algebra.md": {
        "title": "Legitimacy Transition Algebra",
        "required_sections": [
            "Research Question",
            "Claim Under Pressure",
            "Fixture",
            "Transition Harness",
            "Round-Trip Check",
            "Pass Criteria",
            "Kudzu Boundaries",
            "Current Result",
        ],
        "required_terms": [
            "Captured",
            "Attached",
            "Archived",
            "Legitimacy predicate:",
            "Failure signal:",
            "excluded_claims",
        ],
    },
    "subjective-evidence-taxonomy.md": {
        "title": "Subjective Evidence Taxonomy",
        "required_sections": [
            "Research Question",
            "Claim Under Pressure",
            "Fixture",
            "Evidence Classification",
            "Transition Harness",
            "Pass Criteria",
            "Failure Signals",
            "Kudzu Boundaries",
            "Current Result",
        ],
        "required_terms": [
            "Observation",
            "Experience",
            "Interpretation",
            "Inference",
            "External corroboration",
            "What It Cannot Support",
        ],
    },
    "reverse-traversal-closure.md": {
        "title": "Reverse Traversal Closure",
        "required_sections": [
            "Research Question",
            "Claim Under Pressure",
            "Fixture",
            "What Audit Alone Can Say",
            "What Reverse Traversal Must Recover",
            "Closure Measurement",
            "Drift Failure Examples",
            "Pass Criteria",
            "Kudzu Boundaries",
            "Current Result",
        ],
        "required_terms": [
            "accepted",
            "Rejected:",
            "Attenuated:",
            "Contested:",
            "Deferred:",
            "bounded",
        ],
    },
}

FORBIDDEN_ROLE_LABELS = [
    "Savant 1",
    "Savant 2",
    "Savant Omega",
    "Savant Alpha",
]


def load_text(path: Path) -> str:
    if not path.is_file():
        raise FileNotFoundError(path)
    return path.read_text(encoding="utf-8")


def has_heading(text: str, heading: str) -> bool:
    pattern = rf"^##\s+{re.escape(heading)}\s*$"
    return re.search(pattern, text, flags=re.MULTILINE) is not None


def current_result_section(text: str) -> str:
    match = re.search(
        r"^## Current Result\s*\n(?P<body>.*?)(?:\n## |\Z)",
        text,
        flags=re.MULTILINE | re.DOTALL,
    )
    return match.group("body").strip() if match else ""


def assert_links(source_name: str, text: str, links: list[str]) -> list[str]:
    errors: list[str] = []
    for link in links:
        if link not in text:
            errors.append(f"{source_name} missing link target {link}")
    return errors


def assert_testbed_shape(filename: str, text: str, config: dict[str, object]) -> list[str]:
    errors: list[str] = []

    expected_title = f"# Testbed: {config['title']}"
    if expected_title not in text:
        errors.append(f"{filename} missing title {expected_title!r}")

    for section in config["required_sections"]:  # type: ignore[index]
        if not has_heading(text, str(section)):
            errors.append(f"{filename} missing section: {section}")

    for term in config["required_terms"]:  # type: ignore[index]
        if str(term) not in text:
            errors.append(f"{filename} missing required term: {term}")

    result = current_result_section(text)
    if not result:
        errors.append(f"{filename} has no Current Result body")
    if "Partial." not in result and "Pass." not in result and "Fail." not in result:
        errors.append(f"{filename} Current Result must state Partial, Pass, or Fail")
    if "unresolved boundary" not in result.lower() and "pressure point" not in result.lower():
        errors.append(f"{filename} Current Result must name an unresolved boundary or pressure point")

    if "```text" not in text:
        errors.append(f"{filename} needs at least one concrete text fixture block")

    for label in FORBIDDEN_ROLE_LABELS:
        if label in text:
            errors.append(f"{filename} introduces role label too early: {label}")

    if "TODO" in text:
        errors.append(f"{filename} contains TODO instead of a named boundary")

    return errors


def assert_supervision_protocol(text: str) -> list[str]:
    errors: list[str] = []
    required_sections = [
        "Supervision Question",
        "Required Shape",
        "Mechanical Self-Test",
        "Human Supervision Pass",
        "Acceptance Rule",
        "Rejection Rule",
    ]
    for section in required_sections:
        if not has_heading(text, section):
            errors.append(f"supervision-protocol.md missing section: {section}")
    if "scripts/validate_research_testbeds.py" not in text:
        errors.append("supervision-protocol.md missing self-test command")
    return errors


def main() -> int:
    errors: list[str] = []

    try:
        continuity = load_text(CONTINUITY)
        index = load_text(INDEX)
        supervision = load_text(SUPERVISION)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    testbed_links = list(TESTBED_FILES.keys())
    errors.extend(assert_links("research-continuity.md", continuity, [f"testbeds/{link}" for link in testbed_links]))
    errors.extend(assert_links("testbeds/README.md", index, testbed_links))
    errors.extend(assert_links("testbeds/README.md", index, ["supervision-protocol.md"]))
    errors.extend(assert_supervision_protocol(supervision))

    for filename, config in TESTBED_FILES.items():
        path = TESTBEDS / filename
        try:
            text = load_text(path)
        except FileNotFoundError as exc:
            errors.append(f"missing testbed file: {exc}")
            continue
        errors.extend(assert_testbed_shape(filename, text, config))

    if errors:
        print("Research testbed validation failed:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print("Research testbed validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

