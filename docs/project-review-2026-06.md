# Project Review — June 2026

Cross-cutting review of Happy Browser, Happy Labs (Journal), early concept artifacts, and the Happy Layer framework. Written after a full pass over production code, tests, and design docs.

## Executive assessment

This monorepo has advanced well on two axes that are hard to keep aligned:

1. **Execution** — Early samples have graduated into testable, bounded implementations.
2. **Doctrine** — The Happy Layer framework is not decorative; it shows up in scoring thresholds, codec provenance, human-review gates, and failure taxonomy.

The gap between concept (`happy-browser.html` Pearl Network / Tapestry / Valet) and product (`src/content.js` navigation rail) is large by design. That restraint is itself a pragmatic deduction: ship the trustworthy slice first; let Lab findings graduate only when they become deterministic rules.

## The framework: Happy Layer and its deductions

The reusable pipeline is defined in [happy-layer.md](happy-layer.md):

```text
Human Intent
   -> Intent Schema
   -> Resolver Adapter
   -> Candidate Set
   -> Validation Rules
   -> Preview Surface
   -> User Action
   -> Correction Memory
```

**Design Law** (user-initiated, previewable, reversible, legible, bounded) is enforced in code, not only in prose.

| Deduction | Browser manifestation | Labs manifestation |
|-----------|----------------------|-------------------|
| Decline over pretend | Strong (≥95) vs tentative (≥55) thresholds; `state: "none"` when unsure | Coherence report measures funnel loss; acceptance test does not claim story quality |
| Missing ≠ absent | `getReadinessState` → `happy` / `tentative` / `none` | Orphan thread count, discard tombstones |
| Correction memory | `failedSelectors` + `preNavigationSnapshot` outcome check | `TransformationLog` + `codecPath` on every entity |
| Human receipt | User must click rail / key / gesture; no auto-nav | `HumanReviewService.applyDecision` gates archive |
| Local-first | In-tab DOM analysis, `chrome.storage` only | CloudKit off, `.mbox` import only |

The **adaptive affordance geometry** metaphor ("glasses, not notes") is the philosophical spine. The shipped Browser improves the field of action on the page; the concept HTML explores summary/delegation modes (Tapestry, Valet) that are explicitly *not* in the extension yet.

**Appendix A** ([happy-labs/APPENDIX_A_RESEARCH_PROGRAM_REDUCTION.md](../happy-labs/APPENDIX_A_RESEARCH_PROGRAM_REDUCTION.md)) adds a Labs-specific deduction:

> The framework exists to produce instruments. The instruments do not exist to defend the framework.

That is measurement-over-belief applied to research scope. PCA is demoted; round-trip drift and receipt discriminator are promoted.

## Browser: concept to constrained product

### Early samples

| Artifact | Role |
|----------|------|
| `happy-browser.html` | Self-contained Canvas 2D concept — Browsing, Tapestry, Valet modes; Pearl Network / the-foam |
| `happy-browser-wikipedia.html` | Pre-prototype via Wikipedia REST API (real article structure, no WebView) |
| `Inspiration/` | Static design comps; not wired into builds |

These are **design references**, not build inputs. That separation is correct.

### Production implementation

The shipped extension is focused:

- **`src/navigation-scoring.js`** — Testable IIFE module with multilingual positive/negative lexicons, structure hints, query-pagination fallback, confidence tiers.
- **`src/content.js`** — UI rail, gestures, keyboard, toggle, failed-click memory, pre-navigation snapshot verification.

Tests in `tests/navigation-scoring.test.js` use neutral `example.com` fixtures and cover: `rel=prev/next`, JS-only carousels (tentative), unrelated controls (none), query pagination fallback.

The **correction memory** loop in `content.js` closes intent and outcome without claiming omniscience: if a click does not advance the page (href, title, body length, or active element change), the selector is temporarily excluded. That is legible, reversible, bounded learning — Design Law in runtime form.

### Bridge to Labs

[happy-ai-indexer-bridge.md](happy-ai-indexer-bridge.md) defines graduation rules: Lab findings become Browser behavior only when inspectable, bounded, and compatible with least-privilege. `BrowserContextIngestCodec` in Labs anticipates a future continuity link without coupling Phase 0.

**Verdict:** Advanced well. Concept → product narrowing is disciplined. Scoring is test-covered. Main risk: `content.js` size (~1,200 lines) — UI, gesture, and navigation logic could split before Happy Fill lands.

## Journal: design comp to provenance-first UI

### Early samples

`Inspiration/bespoke-journal-design/` holds static HTML comps (`Journal.dc.html`, `Connectome.dc.html`). These informed the SwiftUI shell without being wired into builds.

### Production implementation

The macOS app centers on `JournalRootView` with a codec pipeline:

```text
.mbox → MboxImportCodec → ThreadClusterCodec → StoryExtractionCodec → JournalDraftCodec
     → coherence report → human review → archive / discard (with provenance)
```

**`HappyCodec`** is the framework abstraction — versioned, provenance-bearing transforms. Every codec writes `TransformationLog` entries and propagates `ProvenanceFields` with `contentFingerprint`. The UI makes this legible in `ProvenancePlateView`.

**Human = editor, agent = instrument** is enforced structurally: archive requires `HumanReviewService.applyDecision`. Discard keeps tombstones. The acceptance test (`500 → ~20`) proves plumbing, not quality — and the README says so explicitly.

**Verdict:** Advanced well for Phase 0. The codec chain mirrors the Browser intent pipeline. Provenance is first-class in persistence and UI. The honest scope boundary (synthetic corpus proves plumbing, not usefulness) is a strength.

## Labs: research plane with engineering teeth

Happy Labs serves two roles:

1. **Phase 0 kernel** — Email → journal with full provenance.
2. **Research / conformance plane** — Appendix A instruments, recoverability harness, KnowledgeRTX bindings.

The **Lab vs Browser split** is one of the project's best architectural decisions. Labs can use WebView, screenshots, and agentic analysis; Browser stays least-attention and least-privilege. Findings graduate through YAML artifacts (`happy_lab_artifact`) only when they satisfy Design Law.

Appendix A's **receipt discriminator** and **round-trip drift metric** are the Labs analogue of Browser's `preNavigationSnapshot` check — asking whether a transition actually happened, not whether it was claimed.

**Verdict:** Advanced well as a conformance plane. Appendix A reduction (instruments over theory) shows mature scope control. Phase 0 boundaries (no Gmail OAuth, no Browser linkage) are clear and respected.

## Cross-cutting strengths

1. **Doctrine → code isomorphism** — Design Law appears in thresholds, gates, and failure taxonomies, not only in docs.
2. **Honest epistemology** — "No reliable target found" vs "no target exists"; acceptance tests that state what they do *not* prove.
3. **Local-first everywhere** — Browser analyzes in-tab; Labs has no network.
4. **Monorepo, loose coupling** — Shared philosophy, no shared code in Phase 0.
5. **Test hygiene** — Neutral domains (`example.com`, `.test`); real commercial sites kept out of fixtures.
6. **Triple Safari sync path** — Canonical `src/` → `safari-extension/` → Xcode via npm scripts.

## Gaps and risks

| Area | Risk | Severity |
|------|------|----------|
| Concept ↔ product gap | Pearl Network vision may outpace shipped Browser for a long time | Medium (manageable if roadmap discipline holds) |
| `content.js` monolith | Harder to extend for Happy Fill / Query without refactor | Medium |
| Story quality | Phase 0 proves plumbing; summarization usefulness is unvalidated | Expected at this stage |
| Browser ↔ Labs bridge | `BrowserContextIngestCodec` exists but no product integration yet | Low (explicitly out of scope) |
| Research instruments | Drift metric and receipt discriminator are specified but not yet productized | Low (correctly gated) |
| iOS vs macOS | HappyJournaliOS is test harness; macOS is primary shell | Low |

## Recommended next steps (before diving in)

Organizing priorities derived from this review. These are sequencing suggestions, not a commitment to implement everything immediately.

### 1. Keep the narrowing discipline

Concept HTML (`happy-browser.html`, Inspiration/) should remain inspiration, not a backlog disguised as a prototype. New features must pass Design Law before entering either product surface.

### 2. Extract a small Browser kernel (pre–Happy Fill)

Before adding Happy Fill or Happy Query, split `content.js` into:

- Scoring / analysis (already separate: `navigation-scoring.js`)
- Outcome observation (`capturePageSnapshot`, `observeNavigationOutcome`, `failedSelectors`)
- UI shell (rail, toggle, gestures)

This preserves the intent pipeline pattern for future modules without growing a monolith.

### 3. Promote failure taxonomy to user-visible language

Browser already distinguishes strong / tentative / none internally. Surfacing richer states from [happy-layer.md](happy-layer.md) — undiscovered, withheld, ambiguous — in rail status text would align UI with doctrine.

### 4. Run Phase 0.1 manual validation (Journal)

Import real `.mbox` exports (not only synthetic corpus). Document coherence report findings. That is the next legitimacy checkpoint for Journal story quality.

### 5. Formalize Lab → Browser graduation gate

When a Lab artifact becomes a Browser rule, require:

- A matching `example.com` or `.test` fixture
- A Design Law checklist entry in the PR
- No committed real-site URLs or private journeys

See [happy-ai-indexer-bridge.md](happy-ai-indexer-bridge.md) for the artifact shape.

## Summary

The project has advanced well because it treats **framework and execution as the same problem**. The Happy Layer is not a manifesto sitting above the code; it is the scoring threshold, the pre-navigation snapshot, the codec provenance chain, the human-review gate, and the acceptance test that refuses to overclaim.

The early samples for Browser, Journal, and Labs each found their level: concept artifacts explore breadth; production code explores depth in one bounded domain; Labs holds research instruments that may eventually graduate. The pragmatic deductions — decline over pretend, receipt over forgery, instruments over theory, discard over erasure — recur at every layer without being named the same way twice.

The main work ahead is not more doctrine; it is continuing to let doctrine constrain scope while the next modules earn their place through the graduation rules already written down.
