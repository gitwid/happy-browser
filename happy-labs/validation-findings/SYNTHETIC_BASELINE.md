# Synthetic baseline — Phase 0.1 reference

This documents what a **synthetic** Phase 0.1 validation run establishes. It is not a substitute for real-mailbox findings.

## How to generate

```sh
cd happy-labs
swift run HappyLabsValidate --synthetic --output /tmp/phase01-baseline
```

## Expected structural metrics (designed corpus)

| Metric | Expected range | Notes |
|--------|----------------|-------|
| Input messages | 500 | 20 threads × 25 messages |
| Story candidates | 18–24 | Target ~20 |
| Journal drafts | Same as stories | One draft per story |
| `messagesPerStory` | ~25 (±2) | Perfect reply chains |
| `orphanThreadCount` | 0 | No orphan threads in synthetic data |
| `pipelineCompletedWithoutIntervention` | true | Pipeline reaches drafts |
| `humanReview.pendingReviewCount` | = draft count | No decisions until human acts |

## Expected drift profile (extractive summarization)

The synthetic corpus uses repetitive template bodies. `ExtractiveFallbackProvider` clips from source text, so drift dispositions skew toward **stable** or **review** — not because stories are semantically brilliant, but because anchors are preserved mechanically.

On a real mailbox expect:

- Higher `revise` counts (newsletters, boilerplate, broken threads)
- Non-zero `orphanThreadCount`
- Lower `structureCoherenceRatio` when scope includes low-signal mail
- Higher `discardRatio` after human review

## What this baseline proves

- `Phase01ValidationService` runs end-to-end
- Coherence report and drift reports export together
- Qualitative checklist is present in markdown export

## What it does not prove

- Story usefulness on real mail
- Summarization quality under MIME/encoding edge cases
- Thread clustering on messy reply graphs
- Appropriate archive/discard rates for your mail

## Next step

Import a **real** `.mbox` with `lastMonth` scope, export Phase 0.1 JSON/Markdown to `Fixtures/private/findings/`, and document divergences from this table.
