#!/bin/sh
set -euo pipefail
cd "$(dirname "$0")/../Packages/HappyLabsCore"
swift test
