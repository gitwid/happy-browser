# Testbed: Subjective Evidence Taxonomy

Status: active  
Kudzu risk: subjective evidence can collapse into either objective fact or
unbounded personal narrative.

## Research Question

Can Happy preserve subjective continuity without promoting it to external fact
or dismissing it as non-evidence?

## Claim Under Pressure

Subjective continuity is legitimate evidence. It is not identical to externally
verified fact.

## Fixture

Synthetic journal-like claim:

```text
"I felt dismissed by the doctor, and later the insurance letter confirmed the
appointment was delayed."
```

Synthetic supporting artifacts:

```text
Artifact A:
  kind: personal note
  text: "I felt dismissed after the appointment."
  source_class: userHeld

Artifact B:
  kind: insurance letter
  text: "The appointment has been delayed."
  source_class: userHeld
```

## Evidence Classification

| Clause | Evidence Class | What It Can Legitimately Support | What It Cannot Support |
|---|---|---|---|
| "I felt dismissed" | Experience | The user experienced the appointment as dismissive. | The doctor objectively intended dismissal. |
| "by the doctor" | Interpretation | The experience was attributed to the doctor's conduct. | A verified account of the doctor's motive or internal state. |
| "later" | Inference | A temporal relation if artifact timestamps support it. | Exact sequence without provenance. |
| "the insurance letter confirmed" | External corroboration | A document exists that can corroborate a logistical fact. | Corroboration of the emotional experience. |
| "the appointment was delayed" | Observation / external corroboration | The appointment delay was documented. | Why the delay happened unless the letter states why. |

## Transition Harness

### Captured

Legitimate capture requires each artifact to enter with source class, origin,
codec path, and fingerprint.

### Attached

Attachment must preserve different support relations:

```text
Artifact A supports:
  - experience: user felt dismissed
  - interpretation: user attributed that feeling to the doctor encounter

Artifact B supports:
  - external corroboration: appointment delay
```

Attachment must not merge these into one truth claim.

### Archived

The durable journal entry may say:

```text
The user experienced the appointment as dismissive. A later insurance letter
documented that the appointment was delayed.
```

The durable journal entry may not say:

```text
The doctor dismissed the user and caused the delay.
```

unless independent evidence supports those claims.

## Pass Criteria

- Experience remains legitimate evidence.
- External corroboration remains separate from experience.
- Interpretation is stored without being upgraded to fact.
- The system can preserve the human meaning without overstating the external
  record.

## Failure Signals

- "I experienced" becomes "it objectively occurred."
- External corroboration of one clause is used to validate the whole narrative.
- The system refuses to preserve experience because it lacks external proof.
- The system stores only confidence scores and loses evidence class.

## Kudzu Boundaries

- Do not create an exhaustive psychology taxonomy.
- Do not classify every sentence recursively unless a transition depends on it.
- Do not make the model judge whether the feeling was justified.
- Do not collapse evidence class into sentiment.

## Current Result

Partial.

The five classes are sufficient for the fixture. The unresolved boundary is the
difference between "observation" and "external corroboration" when the
observation is itself mediated through a document.
