# Happy AI Indexer Bridge

SwiftAIIndexer should be treated as **Happy Lab**: the research and QA plane for
Happy Browser. It is not a user-facing Happy Browser module yet.

Happy Browser remains the released, user-facing layer:

> Happy Browser is an at-a-glance, least-attention, least-privilege browsing
> layer that turns fragmented web interactions into coherent, inspectable,
> user-directed surfaces.

Happy Lab may use broader local automation, WebView orchestration, screenshot
capture, and agentic analysis because it is a controlled research environment.
That work can inform Happy Browser only when the resulting behavior stays
user-initiated, previewable, reversible, legible, and bounded.

## Role Split

### Happy Browser

Happy Browser is the product surface. It should stay focused on least-attention
and least-privilege browsing for real users.

Its release-facing behavior should:

- Normalize inconsistent page navigation.
- Show visible controls and confidence through the UI.
- Avoid hidden autonomy.
- Keep user browsing data local wherever feasible.
- Decline low-confidence behavior rather than pretending certainty.

### Happy Lab

Happy Lab is the research and conformance environment. SwiftAIIndexer is the
current candidate substrate because it already contains useful primitives:

- `Intent` for click, type, scroll, navigate, wait, pause, and resume actions.
- `WebViewManager` for WKWebView-based "Pearl" instances.
- Screenshot streaming and capture.
- `ClickAnalyzer` for before/after visual and behavioral comparison.
- `DLBInspectionResult` as a golden-record artifact for conformance analysis.
- Video ingestion and primitive extraction for recorded UI surfaces.

Happy Lab can run controlled experiments that would be too powerful or too
ambiguous for the public extension.

## Safe Inputs

Happy Lab may use:

- Public pages.
- Local fixtures.
- Synthetic forms.
- Dummy accounts.
- Dummy addresses and contact data.
- Recorded videos intentionally created for testing.
- Neutral example domains and `.test` fixtures.

## Forbidden Inputs

Happy Lab must not ingest or store:

- Real credentials.
- User auth tokens.
- Private user journeys.
- Private pages.
- Personal data.
- Payment data.
- Health, identity, financial, or other high-liability data.
- Site-specific private debugging URLs in committed fixtures.

Private real-site debugging, when unavoidable, must stay outside the repository
and must be reduced to abstract rules before anything is committed.

## Core Artifact Shape

The core bridge artifact should describe one tested interaction:

```yaml
happy_lab_artifact:
  version: 1
  intent:
    action: click | type | scroll | navigate | wait
    target: "human-readable target description"
  target_surface:
    source: local_fixture | public_page | synthetic_form | recorded_video
    url_policy: redacted_or_example_only
  before_snapshot:
    kind: screenshot
    storage: local_or_redacted
  executed_action:
    method: selector | coordinates | script | native_webview
    result: executed | deferred | error
  after_snapshot:
    kind: screenshot
    storage: local_or_redacted
  visual_delta:
    detected: true
    summary: "brief observable change"
  behavioral_classification:
    navigation: false
    state_change: true
    description: "what changed"
  confidence: 0.0
  failure_class: success | phantom_click | offset_hit | semantic_drift | low_confidence_success | false_positive
  proposed_happy_output:
    kind: rule | fixture | negative_fixture | bug_report | no_change
    summary: "what Happy Browser could learn"
```

The artifact is evidence, not an automatic product change. It should preserve
failed discovery states instead of flattening them into absence. A bridge artifact
may record that an affordance was absent, undiscovered, withheld, ambiguous, or
unresolved.

## First Use Case

The first bridge scenario should be neutral conformance testing for Happy
Browser navigation and simple action behavior.

Use a local fixture page containing:

- A previous link.
- A next link.
- A load-more button.
- A text input.
- A harmless state-changing button.
- Decoy links that should not be treated as page navigation.

Happy Lab should execute one intent at a time, capture before/after state, and
emit an inspection artifact. The resulting artifact can become:

- A Happy Browser scoring fixture.
- A negative navigation fixture.
- A regression note.
- A proposed rule adjustment.

## Graduation Rules

A Happy Lab finding can influence Happy Browser only if it becomes:

- A small deterministic rule.
- A neutral test fixture.
- A confidence adjustment.
- A user-visible warning.
- A documented non-goal.

It must not graduate as opaque automation or hidden browsing behavior.

## Non-Goals

This bridge is not:

- Autonomous real-user browsing.
- Credential handling.
- A replacement for the user.
- A crawler for private pages.
- Security-by-complexity.
- A path to copy site look-and-feel into Happy-owned surfaces.

## Near-Term Work

1. Keep Happy Browser v1 release-focused.
2. Stabilize SwiftAIIndexer test/build health before relying on it.
3. Add one neutral local fixture scenario in Happy Lab.
4. Emit one JSON or YAML inspection artifact for a simple interaction.
5. Convert only the inspectable lesson into a Happy Browser rule or fixture.
