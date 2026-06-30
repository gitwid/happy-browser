# Happy Labs — Phase 0 Kernel

Attention management for user-held email: import a Mail.app `.mbox` export, extract story drafts, review every transformation, archive journal entries with full provenance.

Happy Labs is **independent** from [Happy Browser](../README.md). No shared code, entitlements, or linkage in Phase 0. Shared product-family doctrine lives in [docs/happy-layer.md](../docs/happy-layer.md); a cross-cutting review is in [docs/project-review-2026-06.md](../docs/project-review-2026-06.md).

## Invariants

- Human = editor. Agent = instrument. Every retention path requires explicit human approval.
- **Provenance from entity zero:** `provenanceID`, `originRef`, `sourceClass`, `codecPath`, `contentFingerprint` on every persisted entity.
- **`sourceClass`** is indexed on every entity (`userHeld | thirdParty | public`). Phase 0 uses `.userHeld` only.
- **Local-first:** no network calls. CloudKit disabled. `.mbox` file import only.
- **Discarded artifacts** keep provenance tombstones — discard is a transformation, not erasure.

## First run

1. In Mail.app, select a mailbox → **Mailbox → Export Mailbox…** → save `.mbox`.
2. Launch Happy Labs → **Import .mbox…**
3. Review drafts → **Approve**, **Edit & Archive**, **Retain**, or **Discard**.
4. Export archived entries as JSON or Markdown with provenance footer.

## Build & test

Requirements: macOS 14+, Xcode 15+ / Swift 5.9+

```sh
cd happy-labs

# Run unit + acceptance tests (500 emails → ~20 stories plumbing)
swift test --package-path Packages/HappyLabsCore

# Run the macOS app
swift run HappyLabs
```

## Architecture

```text
.mbox → MboxImportCodec → ThreadClusterCodec → StoryExtractionCodec → JournalDraftCodec
     → coherence report → human review → archive / discard (with provenance)
```

Core logic lives in `Packages/HappyLabsCore/`. SwiftUI shell in `HappyLabsApp/`.

## Research Program

Appendix A is currently reduced to legitimacy instrumentation. PCA is retained only as a speculative substrate for instruments; the active projects are the round-trip drift metric and receipt discriminator.

See [Appendix A - Research Program Reduction](APPENDIX_A_RESEARCH_PROGRAM_REDUCTION.md).

## Acceptance test scope

The `500 → 20` test uses a **designed synthetic corpus** (20 threads × 25 messages). It proves the codec chain runs and logs — **not** that stories are worth reading. Quality validation is Phase 0.1.

See [Tests/Acceptance/README.md](Packages/HappyLabsCore/Tests/Acceptance/README.md).

## Out of scope (Phase 0)

Gmail OAuth, IMAP, third-party/social ingestion, Happy Browser linkage, cloud sync, background automation without review.
