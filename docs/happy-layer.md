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

Happy Browser is not a notes layer over the web. Summary-first and delegation-first
browsers can be useful, but their coherence often lives in an assistant answer or
a task transcript. Happy's aim is different: it should improve the field itself.
It should reinforce coherence inside the user's own browsing surface by making
affordances, uncertainty, privilege, and action paths visible where the user is
already acting.

## Design Law

A feature belongs in the Happy family only if it satisfies all five constraints:

- User-initiated: the user asks or clearly enables the behavior.
- Previewable: the user can inspect what will happen before execution.
- Reversible: mistakes can be undone, corrected, or discarded.
- Legible: the intermediate form is visible, such as a field map, YAML query,
  candidate list, or session trace.
- Bounded: the feature repairs one class of interface friction, not "everything."

If a feature violates these constraints, it is outside the Happy model.

## Adaptive Affordance Geometry

Happy Browser should behave more like glasses than like notes. Glasses do not
summarize a room; they let the user see the room more clearly. In the same way,
Happy should not replace a page with a gist when the user's need is to act within
the page.

The working model is adaptive affordance geometry: authored DOM, rendered pixels,
accessibility semantics, and observed behavior are evidence for reconstructing a
user-owned field of action. This field can expose:

- What is surfaced, muted, grouped, sealed, trusted, or uncertain.
- Which actions are available, risky, repeated, hidden, or ambiguous.
- Where attention cost and privilege cost are being imposed.
- Whether a missing affordance is absent, hidden, withheld, ambiguous, or merely
  undiscovered.

This is not a commitment to a universal browsing UI. It is a doctrine for how
small features should mature: improve the user's action geometry first, and use
summaries only when they preserve source accountability and user judgment.

## Missing And Undiscovered

Missing is often not absent. Missing is frequently undiscoverable.

Happy should avoid collapsing all failures into "not found." A failed resolution
can mean several different things:

- Absent: the affordance, data, or action is not present.
- Undiscovered: it may exist, but the current parser, classifier, or view did not
  find it.
- Withheld: it exists behind auth, permission, scroll, interaction, rate limits,
  or other gates.
- Ambiguous: multiple candidates exist and none can be trusted.
- Unresolved: the user's intent is clear, but no safe path has been established.

The product language should reflect that distinction. "No reliable target found"
is more honest than "no target exists."

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

> Happy Browser is an at-a-glance, least-attention, least-privilege browsing
> layer that turns fragmented web interactions into coherent, inspectable,
> user-directed surfaces. It may use agents internally or locally, but only to
> improve legibility, testing, and configuration, not to replace the user's
> judgment.

Doctrine line:

> Happy Browser is not a notes layer over the web. It is an adaptive affordance
> geometry that reinforces coherence inside the user's own browsing field.
