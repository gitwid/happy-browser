# Testbed: Reverse Traversal Closure

Status: active  
Load-bearing claim: Happy should optimize semantic invertibility, not only
execution.

## Research Question

Can an archived authority claim be traversed backwards into a reconstructable
instruction, rather than merely explained by an audit log?

## Claim Under Pressure

Forward traversal:

```text
instruction -> execution -> authority
```

Reverse traversal:

```text
authority -> authentication -> instruction
```

Round-trip closure succeeds when legitimacy can be reconstructed within bounded
semantic drift.

## Fixture

Archived authority claim:

```text
Claim C:
  "The rehabilitation process became concrete when the appointment was
  confirmed."
  state: archived
  evidence_set: [Artifact A]
  transition_path: captured -> attached -> archived
  excluded_claims:
    - "The process was emotionally resolved."
    - "The appointment definitely happened."
```

Source artifact:

```text
Artifact A:
  text: "Your rehabilitation appointment is confirmed for 2026-07-14."
```

## What Audit Alone Can Say

```text
Artifact A was imported.
Artifact A was linked to Claim C.
Claim C was approved by the human editor.
```

This is necessary, but insufficient. It records sequence without reconstructing
intent.

## What Reverse Traversal Must Recover

```text
Recovered instruction:
  Use the user-held confirmation artifact to support the claim that the
  rehabilitation process became concrete. Preserve the claim as journal
  material after human approval. Do not claim emotional resolution or final
  outcome unless separately evidenced.
```

Minimum recovered elements:

- Evidence target: confirmation artifact.
- Supported assertion: process became concrete.
- Transform path: captured, attached, archived.
- Human approval role: final archive authority.
- Boundary conditions: excluded claims.

## Closure Measurement

| Element | Expected | Recovered | Result |
|---|---|---|---|
| Evidence target | Artifact A | Artifact A | pass |
| Supported assertion | practical turning point | practical turning point | pass |
| Human approval | required for archive | required for archive | pass |
| Excluded emotional claim | not supported | not supported | pass |
| Final outcome claim | not supported | not supported | pass |

Closure result:

```text
accepted
```

Drift note:

```text
"Became concrete" and "practical turning point" are semantically close enough
for this fixture if the evidence boundary is preserved.
```

## Drift Failure Examples

Rejected:

```text
Recovered instruction claims the appointment definitely happened.
```

Attenuated:

```text
Recovered instruction finds Artifact A but loses the reason it supports the
turning point.
```

Contested:

```text
Artifact A confirms an appointment, but another artifact says the appointment
was canceled before it occurred.
```

Deferred:

```text
The archive claim references an artifact ID that is no longer present.
```

## Pass Criteria

- Reverse traversal recovers an executable intent, not just a log.
- The recovered instruction includes evidence boundaries.
- Drift can be named without pretending to be mathematically complete.
- Closure can return accepted, rejected, attenuated, contested, or deferred.

## Kudzu Boundaries

- Do not introduce a general semantic distance engine yet.
- Do not simulate agent conversations.
- Do not require perfect reconstruction.
- Do not expand beyond one archived claim until the closure vocabulary holds.

## Current Result

Partial.

The closure vocabulary works on the fixture. The unresolved boundary is the
drift function: the testbed can name drift, but cannot yet measure it beyond
human-readable comparison.

