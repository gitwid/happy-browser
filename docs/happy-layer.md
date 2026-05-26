# Happy Layer

Happy Browser is the first member of a broader product family: small,
transparent intent-normalization tools for broken digital environments.

The core claim is simple:

> Happy Browser does not browse for you. It makes browsing answerable to you.

Happy tools are not autonomous agents. They do not pre-empt the user, hide task
chains, or ask for broad trust in opaque decisions. They receive intent, make it
legible, test it against inconsistent interfaces, and expose a previewable path
for the user to accept, correct, or discard.

## Product Category

Happy Apps are transparent intent attenuators: local-first tools that help
humans express, correct, and carry intent across broken digital surfaces without
surrendering agency to autonomous agents.

A Happy module does four things:

1. Receives human intent.
2. Normalizes it into a structured intermediate form.
3. Tests it against a hostile or inconsistent interface.
4. Learns from failed resolution without stealing agency.

This makes Happy Browser less a "browser helper" than an intent-normalization
layer. Its first public module handles page navigation, but the same pattern can
apply to autofill, query construction, usage observability, and other bounded
interface failures.

## Design Law

A feature belongs in the Happy family only if it satisfies all five constraints:

- User-initiated: the user asks or clearly enables the behavior.
- Previewable: the user can inspect what will happen before execution.
- Reversible: mistakes can be undone, corrected, or discarded.
- Legible: the intermediate form is visible, such as a field map, YAML query,
  candidate list, or session trace.
- Bounded: the feature repairs one class of interface friction, not "everything."

If a feature violates these constraints, it is outside the Happy model.

## Core Architecture

The reusable structure is:

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

For existing page navigation:

```text
"I want to move through this sequence"
   -> Navigation Intent
   -> DOM Link/Button Adapter
   -> Previous/Next/Load-More Candidates
   -> Confidence + Exclusion Rules
   -> Floating Controls / Keyboard / Gesture Surface
   -> User Activates
   -> Failed-Click Exclusion Memory
```

For future address autofill:

```text
"I want to fill my address"
   -> Address Schema
   -> DOM Field Adapter
   -> Field Candidates
   -> Confidence + Warnings
   -> Preview Fill Map
   -> User Confirms
   -> Local Site Pattern Memory
```

For future music or catalog queries:

```text
"I want ontologically distinct covers"
   -> Playlist Intent YAML
   -> Catalog Resolver Adapters
   -> Candidate Tracks
   -> Curation Filters
   -> Draft Playlist YAML
   -> User Resolves / Prunes
   -> Resolver Failure Memory
```

## Module Map

### Happy Browse

The current product surface.

Purpose: preserve coherence across multi-page browsing.

Functions:

- Detect previous, next, and load-more controls.
- Normalize arrows, gestures, and floating controls.
- Avoid low-confidence page actions.
- Remember failed candidates locally.

### Happy Fill

Future autofill correction.

Purpose: make badly programmed forms legible and fillable.

Initial scope:

- Address and low-risk contact data only.
- No passwords, payment cards, identity documents, health data, or other
  high-liability fields.
- Explicit preview before filling.
- Local correction memory.
- Country-aware address schemas.

### Happy Query

Future resolver grammar and query-draft tool.

Purpose: convert high-level categorical intent into transparent query drafts.

Possible early form:

- Local script or small web UI.
- YAML in, resolver attempts out.
- Failed-query learning.
- Cross-catalog adaptation.
- Disposable playlist, media, product, paper, or reference drafts.

### Happy Observe

Usage and accounting observability.

Purpose: make opaque usage systems legible.

Functions:

- Local logs.
- Cost and activity summaries.
- Exportable reports.
- Budget boundaries.
- Anomaly surfacing.

## Roadmap Discipline

The immediate priority is to ship Happy Browser v1 without expanding the review
surface.

Recommended sequence:

1. Ship Happy Browser v1 as navigation normalization.
2. Define Happy Fill as v1.1 or v1.2, starting with address/contact fields only.
3. Prototype Happy Query separately as a YAML/resolver log tool.
4. Keep all modules local-first and explicit wherever feasible.

The strategic pattern is to ship the small, trustworthy thing first, then let
each later module prove the same principle in a new interface domain.

## Public Language

Store-safe description:

> Happy Browser helps people navigate badly structured websites with visible,
> user-controlled controls. It does not browse for you; it makes browsing more
> legible and easier to direct.

Internal north star:

> Happy Browser makes broken interfaces answerable to human intent.
