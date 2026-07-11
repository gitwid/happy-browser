#!/bin/sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR/../Packages/HappyLabsCore"
swift test

cd "$SCRIPT_DIR/.."
if command -v xcodegen >/dev/null 2>&1; then
    xcodegen generate
fi
xcodebuild \
    -project HappyJournal.xcodeproj \
    -scheme HappyJournal \
    -destination 'generic/platform=iOS Simulator' \
    build
scripts/validate_research_testbeds.py
scripts/validate_knowledgertx.py
scripts/lambda_polysemy_audit.py
scripts/check_recoverability_packet.py --allow-empty-artifacts
