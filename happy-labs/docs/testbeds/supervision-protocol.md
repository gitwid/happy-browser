# Testbed Supervision Protocol

Status: active  
Role: kind but strict review loop for research testbeds

This protocol defines how a Happy Labs research testbed supervises itself before
it is trusted as continuity material.

Supervision is kind because a partial result is allowed. Supervision is strict
because a blurred boundary must be named rather than hidden.

## Supervision Question

Each testbed must answer:

```text
Does this concept survive contact with a concrete example without losing its
category boundaries?
```

## Required Shape

Every immediate testbed must contain:

- Research question.
- Claim under pressure.
- Concrete fixture.
- Pass criteria.
- Failure or drift signals.
- Kudzu boundaries.
- Current result.

The current result may be `Partial`. That is not a defect if the unresolved
boundary is explicit.

## Mechanical Self-Test

Run from `happy-labs/`:

```sh
scripts/validate_research_testbeds.py
```

The validator checks that:

- The continuity document links to the immediate testbeds.
- The testbed index links to the immediate testbeds.
- Each testbed has the required sections.
- The load-bearing concepts have concrete fixture coverage.
- The testbeds preserve anti-kudzu boundaries.
- The current result is explicit rather than implied.

## Human Supervision Pass

After the mechanical check passes, review each testbed with these questions:

1. What exact claim would fail if this fixture fails?
2. What neighboring concept is this testbed preventing collapse into?
3. What evidence would upgrade `Partial` to `Pass`?
4. What implementation would be premature right now?
5. What term is becoming too elastic?

## Acceptance Rule

A testbed is good enough to carry continuity only when:

- It can be mechanically validated.
- It names its unresolved boundary.
- It blocks at least one tempting but premature implementation path.
- It preserves the distinction that made the original idea valuable.

## Rejection Rule

Reject or rewrite a testbed when:

- It reads like a product requirement.
- It requires machinery not justified by the fixture.
- It records a conclusion without a derivation path.
- It converts a poetic analogy into architecture without a predicate.
- It cannot explain what would count as failure.

