# Testbed: Legitimacy Transition Algebra

Status: active  
Load-bearing claim: business logic governs legitimate state transition, not
mere computation or data mutation.

## Research Question

Can `Captured -> Attached -> Archived` classify a concrete artifact lifecycle
without collapsing into UI state, event history, or storage state?

## Claim Under Pressure

The important transition is not:

```text
Did data change?
```

The important transition is:

```text
Did legitimacy change?
```

If this testbed fails, "provenance as business logic" remains poetic rather
than architectural.

## Fixture

Synthetic artifact:

```text
Artifact A:
  kind: email export fragment
  source_class: userHeld
  content: "Your rehabilitation appointment is confirmed for 2026-07-14."
  origin_ref: local mbox import
  content_fingerprint: sha256:example-only
```

Synthetic assertion:

```text
Assertion B:
  text: "The rehabilitation process became concrete when the appointment was
  confirmed."
  asserted_by: human editor
  projection: journal
```

## Transition Harness

### 1. Captured

Question:

```text
Can the system show that Artifact A entered the substrate with provenance
before it was interpreted?
```

Minimum record:

```text
state: captured
artifact_id: A
source_class: userHeld
origin_ref: local mbox import
content_fingerprint: sha256:example-only
codec_path: MboxImportCodec
captured_at: timestamp
```

Legitimacy predicate:

```text
Captured is legitimate if the artifact has an origin reference, source class,
codec path, and content fingerprint before downstream interpretation.
```

Failure signal:

- The artifact can be interpreted without source provenance.
- Capture is treated as "file exists" rather than "evidence entered with
  provenance."

### 2. Attached

Question:

```text
Can the system show why Artifact A is allowed to support Assertion B?
```

Minimum record:

```text
state: attached
artifact_id: A
assertion_id: B
attachment_reason: confirmation text directly supports the appointment becoming concrete
attached_by: human editor
transform: human review
uncertainty: artifact confirms appointment, not emotional meaning
```

Legitimacy predicate:

```text
Attached is legitimate if the support relation is explicit, reviewable, and
bounded by what the artifact can actually evidence.
```

Failure signal:

- The attachment silently promotes a document fact into a broader life-story
  claim.
- The assertion does not identify what the artifact supports.
- The system stores a link but not the reason the link became legitimate.

### 3. Archived

Question:

```text
Can the system show why Assertion B became durable journal material?
```

Minimum record:

```text
state: archived
assertion_id: B
evidence_set: [A]
approved_by: human editor
approval_reason: evidence supports the practical turning point
excluded_claims:
  - "The process was emotionally resolved."
  - "The appointment definitely happened."
archive_projection: journal
archived_at: timestamp
```

Legitimacy predicate:

```text
Archived is legitimate if human approval records both what is being preserved
and which tempting claims remain unsupported.
```

Failure signal:

- Archive means "saved" rather than "approved for durable continuity."
- Unsupported claims become durable because they are narratively attractive.
- Excluded claims are not preserved.

## Round-Trip Check

Given the archived assertion, reverse traversal should recover:

```text
Instruction:
  Find the user-held artifact that directly supports the claim that the
  rehabilitation process became concrete, verify the support relation, preserve
  the assertion as journal material, and exclude unsupported emotional or final
  outcome claims.
```

Closure result:

```text
accepted: if the reconstructed instruction would produce the same authority claim
partial: if the evidence is found but the attachment reason is weaker
rejected: if the archived assertion cannot be traced to Artifact A
contested: if Artifact A supports multiple incompatible interpretations
```

## Pass Criteria

- Each transition changes legitimacy, not just location or UI state.
- Each transition records the predicate that made it legitimate.
- The archive decision can preserve excluded claims as boundaries.
- Reverse traversal can reconstruct a plausible instruction.

## Kudzu Boundaries

- Do not add more states until this three-state path fails on multiple fixtures.
- Do not add scoring until predicates are explicit.
- Do not introduce autonomous agent roles.
- Do not treat this as a Core Data schema.

## Current Result

Partial.

The three-state path can classify the fixture, but the legitimacy predicate is
still hand-written. The next pressure point is whether one predicate shape can
cover multiple projections without becoming vague.

