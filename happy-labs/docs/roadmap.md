# Roadmap

Planned work and the reasoning behind it. Decisions land in
`protocol-history.md` once shipped; this file holds what is intended and why,
including the parts still open.

## Position

**0.3 — content-addressed evidence.** Spec: `morningstar-0.3-spec.md`.
Landed: revision authorship; content-addressed evidence references.
Remaining: divergence detection, content-addressed evidence navigation.

**0.3.5 — artifact content-hashing.** Vocal sample, notation, formula hashed
into `statedContext`, file stored outside the chain. No protocol bump. Turns
"I described the melody" into "this is the melody, sealed." Unblocks the
inventor/artist case.

---

## 0.4/0.5 — Multi-party capture

### The reframe

Multi-party capture is not a feature sitting beside external anchoring. It is
an implementation of it.

Every domain that solved external verification — notarized notebooks, trial
registries, Certificate Transparency, git — converged on the same primitive:
**copies existing outside the author's control**, with cryptography serving
only to make that cheaper. Multi-party captures are that, natively. If B's
chain references A's capture hash, A cannot rewrite history without B's copy
contradicting it. The counterparty is the witness.

Consequence: the 0.3 tripwire condition *"any second party holds a copy"* and
the 0.4 goal *"an external anchor exists"* are the same event. Which raises an
open question — whether multi-party **replaces** the planned Merkle-root
anchoring rather than following it. A blockchain or timestamp service may be
unnecessary for a system whose participants already hold each other's roots.
Undecided; see Open decisions.

### Prerequisite: identity becomes mandatory

Captures currently record no author. `commitCapture` takes a `captureSource`
string and nothing binding the capture to a person. Single-user this is fine —
the store *is* the identity.

With two participants, "two parties" and "one person writing two captures"
become indistinguishable without cryptographic identity. **Signing, previously
deferred and possibly-never, becomes a hard prerequisite.** This is the real
cost of the direction and should be priced before designing around it.

### Channel asymmetry

The three channels do not take corroboration evenly. This was not designed for
and falls out of the existing split:

| Channel | Corroborable | Disclosed to counterparty |
|---|---|---|
| Observation | yes — independent witness of the externally observable | full text |
| Action | yes, and cross-wise: A's "I did X" against B's "A did X" | full text |
| Phenomenology | **never** — no participant has access to another's interior | hash only |

The second column is the design consequence: a multi-party capture should
**commit** phenomenology without **revealing** it. The party can later prove
what they had written, without exposing interiority to a counterparty. Sealing
and disclosure are separable, and the channel split already tells us where to
separate them.

### Independence must be enforced, not assumed

Two accounts that agree are worth something only if neither was written having
seen the other. Coordinated captures are theater that *looks* corroborated —
strictly worse than a solo capture, because it carries unearned weight.

Requires commit-then-reveal: each party seals a hash of their capture; both
reveal only after both have committed. Makes "written blind" checkable rather
than asserted. Requires strict, observable commit ordering — if A can see B's
commitment and still amend their own, the property is void.

### Consent is a first-class state

B may decline to attest, or attest differently. A capture where one party's
account exists and the other's does not is a meaningful state, and possibly a
contested one — non-participation must not be renderable as implied agreement
or implied guilt. Needs explicit modelling, not a null.

### Sybil: candidate mechanism, not solved

The anchoring claim above holds **only if the second party is genuinely
separate**, and nothing cryptographic establishes that. Keypairs are free; one
person operating two identities manufactures corroboration at no cost.

The framing was originally a two-way choice — self-generated keys (free,
Sybil-open) or external identity attestation (Sybil-resistant, reintroduces the
third party multi-party was meant to remove). There is a third path, from
`thepearlnetwork/noetic-poc/pearl-architecture.md`:

> Witnessing: ≥ 2 independent identities · Different spatial positions ·
> Different transport paths
>
> Each attests: Phase shift · Latency · Fidelity · Reconstruction cost

Independence established by **physical measurement rather than identity claim**.
Witnesses do not need anyone to vouch for them; the attestations are themselves
evidence of separateness, because only genuinely distinct positions and paths
produce those measurements. Same family as distance-bounding protocols. No
third-party attester required.

**This prices Sybil; it does not eliminate it.** Two hosts in different
datacenters produce genuinely distinct paths and latencies. The cost moves from
zero to acquiring real network separation — a meaningful change in the curve,
not a proof. Do not describe it as solved.

Transport-agnostic by construction: phase shift and latency are properties of
whatever carries the traffic. A broker may **relay without being an oracle** —
ordering and delivering messages while all evidentiary weight stays in the
parties' cross-attestations. Morningstar's local-first property survives; the
mechanism does not bind us to any particular broker.

### Related prior art in Pearl

`pearl-architecture.md` also states *"Divergence is guaranteed and
measurable. Divergence is data, not error"* and *"Stored, not resolved"* —
independently arriving at open decision 4 below.

One distinction not to collapse: Pearl's divergence is **perceptual**,
guaranteed by position and path, carrying no blame and resolvable to physics.
Cross-party divergence here is **testimonial** — two people disagreeing about
what happened. The principle transfers; the innocence of it does not.

And from `INVARIANTS.md`: *"What exists is separate from how it looks."*
Witness versus interpretation, stated for a rendering system.

---

## Adversarial model

Written before the design, to be extended as the design lands. Each entry is a
pen-test target.

| Attack | Description | Current answer |
|---|---|---|
| **Sybil** | One person, two identities, manufactured corroboration | **Candidate: physical attestation** (distinct position/path, phase shift, latency) — raises cost without a third-party attester. Not solved: distinct hosts defeat it. Attack first. |
| **Collusion** | Two real parties agree a false account, then commit "blind" | **Accepted limit.** Corroboration raises fabrication cost; it does not establish truth. State plainly; do not claim otherwise. |
| **Coordination as independence** | A shows B their capture before B commits | Commit-reveal with strict observable ordering |
| **Split view / chain forking** | A maintains divergent chains, shows different ones to different counterparties | CT's problem exactly; CT's answer was gossip — counterparties comparing observed heads. Needs design. |
| **Selective disclosure** | A withholds reveal until B's is known, or claims their capture was never made | Commitments exchanged before any reveal; non-reveal recorded as an event, not silence |
| **Replay across sessions** | A presents a capture from one interaction as belonging to another | Session binding — a shared identifier both parties commit to |
| **Reveal-timing advantage** | A delays reveal to gain information | Reveal deadlines; expiry recorded |
| **Key compromise** | A's key is stolen; captures become forgeable | Key rotation recorded in-chain; compromise cannot retroactively invalidate prior-era signatures |
| **Key loss** | A can never again extend their chain | Chain becomes read-only and verifiable but not extensible; must be a supported terminal state, not corruption |
| **Coerced attestation** | A party is pressured into corroborating | Out of scope technically; note it, do not pretend the protocol addresses it |

Privacy is a live concern throughout: B's capture contains claims about A, and
exchanging chains means exchanging personal content. The phenomenology
hash-only rule is a start, not a complete answer.

---

## Open decisions

1. Does multi-party **replace** Merkle-root anchoring, or complement it? If a
   participant set is small and possibly collusive, an external root may still
   be worth having.
2. Identity: self-generated keys (cheap, Sybil-open), attested identity
   (Sybil-resistant, reintroduces a third party), or physical attestation
   (raises cost, needs no attester, defeated by genuinely distinct hosts). This
   is the fork the whole direction turns on. Physical attestation is the only
   option that keeps the local-first property intact, and the only one requiring
   synchronous co-presence — which may not suit asynchronous capture.
3. Is a one-sided capture — committed, never corroborated — weaker than a solo
   capture, or identical to one? Affects whether inviting a counterparty is
   ever risk-free.
4. Does the divergence detector extend across parties? Two accounts of one
   event diverging in the observation channel is *data*, not error — the same
   detector applied across participants rather than across time. Probably the
   cheapest genuinely new capability here.

## Not planned

- **Verifying phenomenology.** No scheme verifies a subjective report.
  Contemporaneity is the property, and it already holds.
- **Adjudicating truth.** The system records what was claimed, by whom, when,
  and whether accounts agree. It does not decide who is right.
