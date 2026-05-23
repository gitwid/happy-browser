#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/safari/Happy Browser/Happy Browser.xcodeproj"
SCHEME="Happy Browser"
ARCHIVE_PATH="$ROOT/safari/build/Happy Browser.xcarchive"
EXPORT_PATH="$ROOT/safari/build/TestFlightUpload"
EXPORT_OPTIONS="$ROOT/safari/ExportOptions-TestFlight.plist"

echo "Syncing Safari extension assets..."
npm run safari:sync

echo "Running navigation scorer tests..."
npm test

echo "Archiving Happy Browser for App Store Connect..."
xcodebuild archive \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=macOS" \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates

echo "Uploading archive to App Store Connect/TestFlight..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -allowProvisioningUpdates

echo "Upload submitted. App Store Connect may take a few minutes to process the build."
