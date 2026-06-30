# Documentation index

Guide to docs in this monorepo. Happy Browser (root) and Happy Labs (`happy-labs/`) share the [Happy Layer](happy-layer.md) doctrine but ship independently in Phase 0.

## Product family

| Document | What it covers |
|----------|----------------|
| [happy-layer.md](happy-layer.md) | Family doctrine — Design Law, intent pipeline, module map (Browse, Fill, Query, Observe) |
| [happy-ai-indexer-bridge.md](happy-ai-indexer-bridge.md) | Happy Lab ↔ Happy Browser research bridge, artifact schema, graduation rules |
| [project-review-2026-06.md](project-review-2026-06.md) | Cross-cutting review — Browser, Journal, Labs, framework deductions, recommended next steps |

## Happy Browser (extension)

| Document | What it covers |
|----------|----------------|
| [../README.md](../README.md) | Features, dev setup, Chrome and Safari loading |
| [product-notes.md](product-notes.md) | Test fixture conventions (`example.com` only) |
| [release-checklist.md](release-checklist.md) | Release planning |
| [chrome-web-store.md](chrome-web-store.md) | Chrome Web Store listing |
| [safari-dev-workflow.md](safari-dev-workflow.md) | Chrome vs Safari Dev vs TestFlight |
| [safari-port.md](safari-port.md) | Safari port notes |
| [testflight.md](testflight.md) | TestFlight workflow |
| [app-store-compliance.md](app-store-compliance.md) | App Store compliance |
| [store-listing-draft.md](store-listing-draft.md) | Store listing draft copy |

## Happy Labs (Journal)

| Document | What it covers |
|----------|----------------|
| [../happy-labs/README.md](../happy-labs/README.md) | Phase 0 kernel — invariants, build, codec pipeline |
| [../happy-labs/APPENDIX_A_RESEARCH_PROGRAM_REDUCTION.md](../happy-labs/APPENDIX_A_RESEARCH_PROGRAM_REDUCTION.md) | Research program — drift metric, receipt discriminator |
| [../happy-labs/RECOVERABILITY_TEST_HARNESS.md](../happy-labs/RECOVERABILITY_TEST_HARNESS.md) | iOS blind recovery testing |
| [../happy-labs/Packages/HappyLabsCore/Tests/Acceptance/README.md](../happy-labs/Packages/HappyLabsCore/Tests/Acceptance/README.md) | 500→20 acceptance test scope |

## Concept artifacts (not build inputs)

| Location | What it is |
|----------|------------|
| `happy-browser.html` | Pearl Network concept — Browsing / Tapestry / Valet |
| `happy-browser-wikipedia.html` | Wikipedia REST proof-of-model |
| `Inspiration/` | Journal and Connectome design comps, auth UI exploration |

## Repo-wide

| Document | What it covers |
|----------|----------------|
| [../PRIVACY.md](../PRIVACY.md) | Local-first privacy posture |
| [../LICENSE.md](../LICENSE.md) | Tryware license |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution terms and PR checklist |

## Suggested reading order

**New to the family:** [happy-layer.md](happy-layer.md) → [project-review-2026-06.md](project-review-2026-06.md)

**Shipping Browser:** [../README.md](../README.md) → [safari-dev-workflow.md](safari-dev-workflow.md) → [release-checklist.md](release-checklist.md)

**Working on Labs:** [../happy-labs/README.md](../happy-labs/README.md) → Appendix A → Acceptance README

**Research → product graduation:** [happy-ai-indexer-bridge.md](happy-ai-indexer-bridge.md) → Design Law checklist in [project-review-2026-06.md](project-review-2026-06.md#recommended-next-steps-before-diving-in)
