# Phase 0.1 — Journal Manual Validation

Phase 0 proves the codec chain runs on a **designed synthetic corpus** (500 messages → ~20 stories). Phase 0.1 asks whether the pipeline produces **worth-reading drafts** on **real Mail.app exports**.

Structural metrics alone cannot answer that. This runbook combines:

1. **Coherence report** — funnel, codec yield, degradation signals, human-review stats
2. **Round-trip drift** — per-draft anchor preservation (source thread bodies → journal draft)
3. **Qualitative review** — human checklist per draft (readable, faithful, useful)

## Prerequisites

- macOS 14+, Xcode 15+ / Swift 5.9+
- A Mail.app `.mbox` export (or mailbox folder) you are allowed to process locally
- No network required — validation runs entirely on-device

## Export a mailbox from Mail.app

1. In Mail.app, select a mailbox (start small: one project folder or sent mail).
2. **Mailbox → Export Mailbox…** and save the `.mbox`.
3. Keep the file **outside the repository**. See [Fixtures/README.md](Fixtures/README.md).

Recommended first scope: **Last month** (`lastMonth`). Use **Everything** only after a smaller scope looks sane.

## Headless validation (CLI)

From `happy-labs/`:

```sh
# Real mailbox (path stays local — never commit)
./scripts/run_phase_0_1.sh ~/Downloads/INBOX.mbox

# Optional scope and output directory
./scripts/run_phase_0_1.sh ~/Downloads/INBOX.mbox --scope lastMonth --output /tmp/phase01

# Synthetic baseline (no personal data — safe to compare in CI/docs)
swift run HappyLabsValidate --synthetic --output /tmp/phase01-baseline
```

Outputs:

| File | Contents |
|------|----------|
| `phase01-*.json` | Full `Phase01ValidationReport` — coherence + per-draft drift |
| `phase01-*.md` | Human-readable report with qualitative checklist per draft |

## GUI validation (macOS app)

1. `swift run HappyLabs` or open the Xcode project.
2. **Import .mbox…** → choose scope → review drafts.
3. After each Archive / Keep / Discard, the coherence report **refreshes** automatically.
4. Export coherence JSON/Markdown from the toolbar menu.
5. Fill in qualitative notes in the exported Phase 0.1 markdown (or a separate findings doc).

## What to document (findings template)

For each validation run, record:

### Run metadata

- Date, mailbox display name (not full path if sharing), import scope
- Message count, thread count, draft count
- Whether this is a first import or a re-run

### Structural findings (from coherence JSON)

| Signal | What to note |
|--------|----------------|
| `orphanThreadCount` | Single-message threads with no reply graph |
| `messagesPerStory` | Very high → over-merging; very low → under-clustering |
| `degradationSignals` | `lowThreadYield`, `noJournalDrafts`, `awaitingHumanResync` |
| Codec `yieldRatio` | Which stage collapses the funnel |
| `humanReview` | Pending count, discard ratio after you review |

### Drift findings (from Phase 0.1 JSON)

| Field | Interpretation |
|-------|----------------|
| `disposition: stable` | Anchor preservation acceptable for a first pass |
| `disposition: review` | Missing anchors — read draft against thread |
| `disposition: revise` | Likely unfaithful summary — edit or discard |
| `meanDriftScore` | Aggregate; compare across runs, not absolute truth |

### Qualitative findings (per draft)

Answer for each draft you actually read:

- Readable without opening the source thread?
- Faithful to thread intent?
- Useful enough to archive, edit, or discard?
- What broke? (newsletter noise, auto-reply, wrong thread merge, encoding, etc.)

Store findings in a **local, gitignored** directory (e.g. `Fixtures/private/findings/`) unless redacted.

## Synthetic baseline

The designed corpus should produce ~20 drafts with high structural coherence. See [validation-findings/SYNTHETIC_BASELINE.md](validation-findings/SYNTHETIC_BASELINE.md) for what the synthetic run proves vs what it cannot prove.

Run locally:

```sh
swift run HappyLabsValidate --synthetic --output /tmp/phase01-baseline
```

Compare your real-mailbox exports against this baseline. Large divergences in orphan count, drift dispositions, or discard ratio are expected — that is the point of Phase 0.1.

## Privacy

- Do **not** commit `.mbox` files, validation JSON, or markdown exports with real addresses.
- Redact before sharing findings externally.
- Phase 0.1 CLI uses an **in-memory store** by default — nothing persists after the process exits unless you use the GUI app.

## What Phase 0.1 does not prove

- Legal admissibility or archival compliance
- Perfect threading on broken real-world mail
- Semantic quality beyond anchor-based drift (drift is an instrument, not truth)

## Related docs

- [README.md](README.md) — Phase 0 kernel invariants
- [Packages/HappyLabsCore/Tests/Acceptance/README.md](Packages/HappyLabsCore/Tests/Acceptance/README.md) — 500→20 plumbing scope
- [APPENDIX_A_RESEARCH_PROGRAM_REDUCTION.md](APPENDIX_A_RESEARCH_PROGRAM_REDUCTION.md) — drift metric as legitimacy instrument
