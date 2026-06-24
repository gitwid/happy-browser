#!/usr/bin/env python3
"""Phase Lambda advisory audit for KnowledgeRTX.

This probe treats polysemy as a membrane input: ambiguity is allowed to exist,
but it must be measured before an artifact crosses into operational state.
The script is stdlib-only so it can run anywhere the existing Happy Labs
validation script runs.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
USDA = ROOT / "KnowledgeRTX.usda"
BINDINGS = ROOT / "knowledgertx-bindings.yaml"
VALIDATOR = ROOT / "scripts" / "validate_knowledgertx.py"
REPORT = ROOT / "lambda-report.json"
HAPPY_HASH = ROOT / "happy-hash.txt"
HITL_DISPOSITION = ROOT / "lambda-hitl-disposition.json"

SCORE_PROPERTIES = [
    "hkrtx:weight",
    "hkrtx:confidence",
    "hkrtx:staleness",
    "hkrtx:convergenceScore",
    "hkrtx:uncertaintyScore",
    "hkrtx:activeReflectionCount",
]

POLYSEMY_TERMS = [
    {
        "term": "dilution",
        "polysemy_score": 8.5,
        "severity": 5,
        "possible_interpretations": [
            "material concentration loss",
            "information signal degradation",
            "economic value or quality erosion",
            "institutional goal displacement",
            "ecological resource weakening",
            "energetic usefulness loss",
        ],
        "conserved_quantity_required": True,
        "membrane_risk": "high if admitted as settled operational state",
    },
    {
        "term": "scale",
        "polysemy_score": 8.0,
        "severity": 4,
        "possible_interpretations": [
            "spatial scale",
            "temporal scale",
            "organizational scale",
            "economic scale",
            "computational scale",
            "deployment scale",
        ],
        "conserved_quantity_required": True,
        "membrane_risk": "high if simulation scope and deployment scope are conflated",
    },
    {
        "term": "convergence",
        "polysemy_score": 7.0,
        "severity": 4,
        "possible_interpretations": [
            "statistical agreement",
            "human decision readiness",
            "runtime suitability",
            "institutional consensus",
            "semantic collapse",
        ],
        "conserved_quantity_required": True,
        "membrane_risk": "high if readiness is treated as execution authority",
    },
    {
        "term": "reference",
        "polysemy_score": 6.5,
        "severity": 3,
        "possible_interpretations": [
            "benchmark",
            "dataset",
            "calibration standard",
            "social norm",
            "institutional metric",
            "reality anchor",
        ],
        "conserved_quantity_required": False,
        "membrane_risk": "medium if calibration and norm-setting are merged",
    },
    {
        "term": "tracking",
        "polysemy_score": 5.0,
        "severity": 3,
        "possible_interpretations": [
            "observation",
            "audit",
            "surveillance",
            "prediction",
            "feedback control",
        ],
        "conserved_quantity_required": False,
        "membrane_risk": "medium if observation silently becomes control",
    },
]


def load_text(path: Path) -> str:
    if not path.is_file():
        raise FileNotFoundError(path)
    return path.read_text(encoding="utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_digest(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def run_command(args: list[str], cwd: Path) -> dict[str, Any]:
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=False)
    return {
        "command": args,
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
        "passed": result.returncode == 0,
    }


def parse_usda_graph(text: str) -> dict[str, Any]:
    stack: list[str] = []
    prims: set[str] = set()
    relation_nodes: list[str] = []

    for line in text.splitlines():
        close_count = len(re.findall(r"^\s*}", line))
        for _ in range(close_count):
            if stack:
                stack.pop()

        match = re.match(r'^\s*def\s+\w+\s+"([^"]+)"', line)
        if match:
            stack.append(match.group(1))
            path = "/" + "/".join(stack)
            prims.add(path)
            if path.startswith("/KnowledgeRTX/Relations/"):
                relation_nodes.append(path)

    targets = ["/" + item.lstrip("/") for item in re.findall(r"<([^>]+)>", text)]
    unresolved_targets = sorted({target for target in targets if target not in prims})

    return {
        "prim_count": len(prims),
        "relation_node_count": len(relation_nodes),
        "relationship_target_count": len(targets),
        "unique_relationship_target_count": len(set(targets)),
        "unresolved_targets": unresolved_targets,
        "relation_nodes": sorted(relation_nodes),
    }


def parse_binding_statuses(text: str) -> dict[str, str]:
    statuses: dict[str, str] = {}
    current_path = ""
    in_bindings = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if line == "bindings:":
            in_bindings = True
            continue
        if line in {"gaps:", "changelog:", "status_baseline:"}:
            in_bindings = False
            current_path = ""
            continue
        if not in_bindings:
            continue
        if line.startswith("- path:"):
            current_path = line.split(":", 1)[1].strip()
            continue
        if current_path and line.startswith("status:"):
            statuses[current_path] = line.split(":", 1)[1].strip()

    return statuses


def score_guardrails(usda: str, graph: dict[str, Any]) -> list[dict[str, Any]]:
    score_lines = [
        line.strip()
        for line in usda.splitlines()
        if any(prop in line for prop in SCORE_PROPERTIES)
    ]
    missing_score_modes = 0
    for line in score_lines:
        before = usda[: usda.find(line)]
        block_start = before.rfind("{")
        block_end = usda.find("}", usda.find(line))
        block = usda[block_start:block_end] if block_start != -1 and block_end != -1 else ""
        if "hkrtx:scoreMode" not in block or "hkrtx:scoreAuthority" not in block:
            missing_score_modes += 1

    reflection_names = [
        "Reflection_CorpusStructure",
        "Reflection_UserIntent",
        "Reflection_ProvenanceIntegrity",
        "Reflection_KnownUnknowns",
        "Reflection_RuntimeFit",
    ]
    missing_origin_rels = [
        name for name in reflection_names
        if not re.search(rf'def\s+Xform\s+"{name}"[\s\S]*?rel hkrtx:origin = <', usda)
    ]

    return [
        {
            "name": "unresolved_relation_targets",
            "passed": not graph["unresolved_targets"],
            "severity": "hard_stop",
            "detail": graph["unresolved_targets"],
        },
        {
            "name": "provenance_origin_is_machine_traceable",
            "passed": not missing_origin_rels,
            "severity": "hard_stop",
            "detail": missing_origin_rels,
        },
        {
            "name": "scores_declare_mode_and_authority",
            "passed": missing_score_modes == 0,
            "severity": "hard_stop",
            "detail": {"score_lines": len(score_lines), "missing_score_modes": missing_score_modes},
        },
        {
            "name": "human_review_gate_present",
            "passed": "rel hkrtx:evaluatedBy = </KnowledgeRTX/HumanInLoop>" in usda
            and "rel hkrtx:authorizes = </KnowledgeRTX/Action>" in usda,
            "severity": "hard_stop",
            "detail": "ConvergenceField -> HumanInLoop -> Action",
        },
        {
            "name": "confidence_computation_still_open",
            "passed": "Gap_ConfidenceComputation" in usda,
            "severity": "execution_blocker",
            "detail": "Scores are explicit placeholders; sandbox execution remains unauthorized.",
        },
    ]


def membrane_findings(usda: str, statuses: dict[str, str]) -> list[dict[str, Any]]:
    convergence_status = statuses.get("/ConvergenceField", "unknown")
    action_status = statuses.get("/Action", "unknown")
    reflection_gaps = sorted(
        path for path, status in statuses.items()
        if path.startswith("/Reflections/") and status == "gap"
    )
    return [
        {
            "membrane": "ConvergenceField",
            "boundary_function": "interpretive evidence enters review-ready state",
            "status": convergence_status,
            "dilution_risk": "medium",
            "reason": "Convergence exists, but scores remain illustrative and reflection bindings are gaps.",
        },
        {
            "membrane": "HumanInLoop",
            "boundary_function": "human disposition gates action authorization",
            "status": statuses.get("/HumanInLoop", "unknown"),
            "dilution_risk": "low",
            "reason": "Human review node is bound and structurally required before action.",
        },
        {
            "membrane": "Action",
            "boundary_function": "review state would become operational state",
            "status": action_status,
            "dilution_risk": "high_without_explicit_disposition",
            "reason": "Action is only partial and execution remains blocked by unresolved scoring policy.",
        },
        {
            "membrane": "Reflections",
            "boundary_function": "raw/imported evidence becomes interpreted evidence",
            "status": "gap" if reflection_gaps else "partial_or_bound",
            "dilution_risk": "high",
            "reason": "Reflection rows are not yet computed truth.",
            "open_reflection_gaps": reflection_gaps,
        },
    ]


def load_hitl_disposition() -> dict[str, Any]:
    if not HITL_DISPOSITION.is_file():
        return {
            "validated_by_human": False,
            "source": str(HITL_DISPOSITION.relative_to(ROOT)),
            "status": "missing",
            "meaning": "No human disposition record exists for this Lambda report.",
        }

    try:
        disposition = json.loads(HITL_DISPOSITION.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {
            "validated_by_human": False,
            "source": str(HITL_DISPOSITION.relative_to(ROOT)),
            "status": "invalid_json",
            "error": str(exc),
        }

    return {
        "validated_by_human": bool(disposition.get("validated_by_human")),
        "source": str(HITL_DISPOSITION.relative_to(ROOT)),
        "status": str(disposition.get("status", "present")),
        "reviewer": str(disposition.get("reviewer", "")),
        "disposition": str(disposition.get("disposition", "")),
        "rationale": str(disposition.get("rationale", "")),
    }


def presentation_boundary_status(hitl_validated: bool) -> dict[str, Any]:
    if hitl_validated:
        return {
            "name": "presentation_boundary",
            "status": "human_validated",
            "allowed_claim_status": "validated_fact",
            "blocked_reasons": [],
            "rule": "Presentation may describe Lambda findings as HITL-validated for this artifact.",
        }

    return {
        "name": "presentation_boundary",
        "status": "pre_hitl",
        "allowed_claim_status": "provisional_observation_only",
        "blocked_reasons": ["missing_hitl_disposition_for_validated_fact_claim"],
        "rule": "Presentation must not describe advisory Lambda findings as validated facts before HITL disposition.",
    }


def classify_exit_state(hard_stop_failures: list[str], hitl_validated: bool) -> str:
    if hard_stop_failures:
        return "lambda_blocked_by_guardrail"
    if not hitl_validated:
        return "lambda_pre_hitl_observation"
    return "lambda_hitl_validated_observation"


def summarize_polysemy() -> dict[str, Any]:
    max_severity = max(item["severity"] for item in POLYSEMY_TERMS)
    weighted = sum(item["polysemy_score"] * item["severity"] for item in POLYSEMY_TERMS)
    weights = sum(item["severity"] for item in POLYSEMY_TERMS)
    return {
        "terms": POLYSEMY_TERMS,
        "overall_polysemy_score": round(weighted / weights, 2),
        "max_polysemy_severity": max_severity,
        "primary_collapse_question": "What conserved quantity is being protected at the membrane?",
    }


def make_report() -> dict[str, Any]:
    usda = load_text(USDA)
    bindings = load_text(BINDINGS)
    graph = parse_usda_graph(usda)
    statuses = parse_binding_statuses(bindings)
    validation = {
        "usdchecker": run_command(["usdchecker", str(USDA)], ROOT),
        "knowledgertx_validator": run_command([sys.executable, str(VALIDATOR)], ROOT),
    }
    guardrails = score_guardrails(usda, graph)
    polysemy = summarize_polysemy()
    membranes = membrane_findings(usda, statuses)
    hard_stop_failures = [
        item["name"] for item in guardrails
        if item["severity"] == "hard_stop" and not item["passed"]
    ]
    execution_blockers = [
        item["name"] for item in guardrails
        if item["severity"] == "execution_blocker" and item["passed"]
    ]
    hitl_disposition = load_hitl_disposition()
    hitl_validated = bool(hitl_disposition.get("validated_by_human"))
    presentation_boundary = presentation_boundary_status(hitl_validated)
    exit_state = classify_exit_state(hard_stop_failures, hitl_validated)

    report = {
        "phase": "lambda",
        "classification": "advisory_membrane_instrumentation",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifacts": {
            "usda": str(USDA.relative_to(ROOT)),
            "bindings": str(BINDINGS.relative_to(ROOT)),
            "validator": str(VALIDATOR.relative_to(ROOT)),
            "digests": {
                "usda_sha256": file_digest(USDA),
                "bindings_sha256": file_digest(BINDINGS),
                "validator_sha256": file_digest(VALIDATOR),
            },
        },
        "structural_validation": validation,
        "graph": graph,
        "polysemy_profile": polysemy,
        "membrane_profile": membranes,
        "guardrails": guardrails,
        "state_dilution_risk": "high_if_action_boundary_is_crossed_without_scoring_policy",
        "hitl_required": True,
        "hitl_validated": hitl_validated,
        "hitl_disposition": hitl_disposition,
        "presentation_boundary": presentation_boundary,
        "execution_authorized": False,
        "exit_state": exit_state,
        "next_allowed_action": "human_review_required_before_presenting_as_validated_fact",
        "blocked_execution_reasons": hard_stop_failures + execution_blockers + presentation_boundary["blocked_reasons"],
    }
    report["happy_hash"] = make_happy_hash(report)
    return report


def make_happy_hash(report: dict[str, Any]) -> dict[str, Any]:
    hash_input = {
        "phase": report["phase"],
        "classification": report["classification"],
        "artifact_digests": report["artifacts"]["digests"],
        "graph": {
            "prim_count": report["graph"]["prim_count"],
            "relation_node_count": report["graph"]["relation_node_count"],
            "relationship_target_count": report["graph"]["relationship_target_count"],
            "unique_relationship_target_count": report["graph"]["unique_relationship_target_count"],
            "unresolved_targets": report["graph"]["unresolved_targets"],
        },
        "polysemy_profile": report["polysemy_profile"],
        "membrane_profile": report["membrane_profile"],
        "guardrails": report["guardrails"],
        "hitl_required": report["hitl_required"],
        "hitl_validated": report["hitl_validated"],
        "presentation_boundary": report["presentation_boundary"],
        "execution_authorized": report["execution_authorized"],
        "exit_state": report["exit_state"],
        "next_allowed_action": report["next_allowed_action"],
    }
    canonical = json.dumps(hash_input, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "algorithm": "sha256",
        "value": sha256_bytes(canonical),
        "meaning": "non-cryptographic semantic checksum over Phase Lambda validation trace",
    }


def main() -> int:
    try:
        report = make_report()
    except (FileNotFoundError, OSError) as exc:
        print(f"Phase Lambda audit failed: {exc}", file=sys.stderr)
        return 1

    REPORT.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    HAPPY_HASH.write_text(report["happy_hash"]["value"] + "\n", encoding="utf-8")
    print(f"Phase Lambda audit written to {REPORT.relative_to(ROOT)}")
    print(f"Happy Hash: {report['happy_hash']['value']}")
    print(f"Exit state: {report['exit_state']}")
    print(f"HITL validated: {str(report['hitl_validated']).lower()}")
    print(f"Execution authorized: {str(report['execution_authorized']).lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
