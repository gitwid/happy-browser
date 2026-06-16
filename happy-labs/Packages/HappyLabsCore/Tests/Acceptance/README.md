# Acceptance corpus

The Phase 0 acceptance test (`AcceptanceTests.testFiveHundredToTwentyPlumbing`) uses `SyntheticCorpusGenerator.defaultTemplates`:

- **20 semantic threads** (summer trip, kitchen renovation, school pickup, …)
- **25 messages per thread** = **500 total emails**
- All addresses use `example.com` only

## What passing proves

- Mbox import parses and persists immutable `RawEmail` rows
- Thread clustering yields 18–24 story candidates (target ~20)
- Each codec stage writes transformation logs (≥ 4 × story count)
- Every entity has `sourceClass == userHeld`
- Human approval is required before archive
- JSON export round-trips `provenanceID`, `sourceClass`, and `contentFingerprint`
- Coherence report emits after full pipeline with codec-stage breakdown and human-review metrics

## Coherence report (Phase 0.1)

After `runFullPipeline`, `CoherenceReportService` measures how much thread coherence
the protocol borrowed from structure:

- Funnel: messages → threads → stories → journal drafts
- Per-codec yield and duration
- Degradation signals (orphan threads, pending human resync, etc.)
- Human review metrics: resync events, recovery rate, discard ratio

The report regenerates after each human decision. Export via `CoherenceReportService.exportJSON`.

## What passing does not prove

Story quality, summarization usefulness, or real-world mailbox behavior. Those belong to Phase 0.1 manual validation on exported `.mbox` files.

## Regenerate fixture locally

```swift
import HappyLabsCore
let url = URL(fileURLWithPath: "/tmp/sample.mbox")
try SyntheticCorpusGenerator.writeFixture(to: url)
```
