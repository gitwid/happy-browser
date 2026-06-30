#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  exec swift run HappyLabsValidate --help
fi

if [[ $# -eq 0 ]]; then
  echo "Usage: ./scripts/run_phase_0_1.sh /path/to/export.mbox [--scope lastMonth] [--output DIR]" >&2
  echo "       ./scripts/run_phase_0_1.sh --synthetic [--output DIR]" >&2
  echo "See PHASE_0_1_VALIDATION.md" >&2
  exit 1
fi

if [[ "${1:-}" == "--synthetic" ]]; then
  shift
  exec swift run HappyLabsValidate --synthetic "$@"
fi

MBOX="$1"
shift
exec swift run HappyLabsValidate --mbox "$MBOX" "$@"
