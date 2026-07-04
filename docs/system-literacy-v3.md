# System Literacy v3: Core Tenets, Domain Applications, Forgery-Gap Lens

> **Repository note (not part of the v3 text):** This document is carried in the
> Happy Browser repo as fixed background doctrine alongside
> [`happy-layer.md`](happy-layer.md). Where the two touch, `happy-layer.md`
> governs product/store language and this document governs method (testing,
> calibration, classification discipline). Concrete anchors in the shipped
> extension: failed-click exclusion memory is suppression-not-deletion (Tenet V),
> the RA filter's "unknown" card state is a null-manifold entry rather than a
> silent rejection (Tenet VII), and the RA per-request check vs. re-run sweep is
> a live instance of the dual-clock seam (Tenet VI). Do not resolve the open
> items below inside feature work; surface them.

Supersedes all prior versions. Self-contained — assume no access to the conversations that produced this.

Maintain fluency before solvency. Interrupt false closure. Personal/identity content is out of scope for this document by design — do not import it as architecture, even if it recurs in conversation.

---

## 0. SEED

A classifier that cannot fail is not a classifier. It must be falsifiable, must not delete what it rejects, and must be calibrated against an available instrument before it is formalized. Calibration precedes invariants; invariants precede the system; the system precedes bias-as-a-formal-concept. Applied to adversarial contexts: the same test must be able to return "forged" as a live outcome, not a foregone pass — and must stay falsifiable exactly at the high-novelty, high-complexity region an adversary will target, since that is where fast classification quietly stops being falsifiable. Every failure below occurred at a seam between these stages.

---

# PART A — CORE TENETS (apply universally, not domain-specific)

## I. Conversational Programming

*Dialogue as a state-transforming medium.*

Conversation is not just a channel reporting thought; it can be the mechanism performing it. A proposition enters exchange, meets resistance or reformulation, and the next thought is conditioned by that transition, not merely restated. Some cognition is natively dialogical — claimant/critic, planner/executor, system/auditor — and a person-machine pair can supply the functional separation (persistence, resistance, external memory, stable turn boundary) that one mind alone can't hold. Established by example: naming something ("false fork," "institutional compiler") changes what it structurally is. Not established: how much of this originates internally vs. is socially learned vs. is machine-mediation artifact.

## II. Fork Integrity

*A fork is only real if a formal test can fail it.*

Re-run test: resolve the branch one way, then the other; compare downstream states. Reconvergence regardless of resolution = noise. Divergence that doesn't reconverge = fork. Established by precedent (McKay's null ELS-decoding result on *Moby Dick*) and confirmed once, live, in this project (a metaphor misclassified as decorative, recovered only by external re-injection, not self-correction). Next step, still open: apply the test to one logged cognitive attention-switch — this has never actually been done, only argued.

## III. Instrumentation Before Invariants

*Calibration doesn't wait on the metric it will produce.*

Correction made and retained: bias is a property of a fitted system checked against known cases — it presupposes a system exists. During pure calibration (an instrument, human or otherwise, producing raw trial data), there is no system yet to be biased. What matters at that stage is instrument diversity/variance, not bias — a single calibration source's idiosyncrasy can masquerade as an invariant if no second instrument ever checks it. **Flag:** this section was dropped from the most recent working document without acknowledgment and is restored here. Next step: run a second instrument (a second guinea pig) — not yet done. Current calibration count remains N=1; treat all self-derived thresholds as baseline, not validated.

## IV. Topology Over Taxonomy

*Classify by behavior under test, not by label.*

Systems from different domains can share topology (dependency, reversibility, penalty pattern) despite different names. Established by product reframing (two differently-named consulting products sharing one underlying mechanism) and by institutional example (unrelated bureaucracies sharing a reconvergence pattern). Not established: no divergence function has been fixed for any domain — encoding, cognitive, or institutional. Per Section III, this should be fit from accumulated trials, not specified in advance.

## V. Non-Collapse as Default State

*Suppression is not deletion.*

Nothing is fully pruned; retention is soft-threshold, and coupling between distant, currently-dissimilar states can persist via an intermediate propagating medium — **teleconnection** (Pacific plankton responding to an Atlantic disturbance via Rossby-wave propagation) is the retained analogy because it's mechanistic, not decorative. A branch classified "noise" stays provisionally so, indefinitely. Confirmed live: a dropped conversational thread returned unprompted two exchanges later, recovered by external re-injection, not internal correction — direct evidence for this section, not a separate finding.

## VI. Dual-Clock Processing

*Immediate response and scheduled re-evaluation are structurally distinct operations.*

Event-driven: react on arrival (a control-test failure, an attention trigger, a discovered exploit). Scheduled: periodic full re-evaluation of accumulated state. **Load-bearing seam, explicitly prioritized as the top open item:** does the scheduled sweep's baseline reflect live interim updates, or freeze until sweep time? This determines whether the system built on these tenets is a reactive monitor, a periodic auditor, or a versioned state machine — three different architectures, not stylistic variants. Undecided in every domain this has touched so far.

## VII. The Null Manifold

*What noise looks like is an accumulating, reusable object.*

Rejected/null cases aren't discarded — they form a growing reference manifold, letting new candidates be rejected by proximity instead of a fresh control run each time. This is the mechanism behind legitimate "recognition at a glance." **Sharpened by the forgery-gap application (Section XV):** an adversarial forger is specifically optimized to sit at high novelty/high complexity — exactly where fast proximity-rejection stops being falsifiable. This is not a hypothetical risk imported by analogy; it is the standard adversarial-evasion problem restated in this vocabulary. Open: organic accumulation vs. a deliberate generator producing matched-complexity null candidates ahead of anticipated novelty — undecided, and now understood to be adversarially exploitable if left undecided.

## VIII. The Self-Referential Failure

*A monitor cannot audit itself by discussion.*

Surfacing "candidate forks" as neutral is itself a selection act — generated by inference, not exposed by it. Turn-by-turn clarification doesn't fix this; it's another unaudited collapse each time. The fix has to be a specified, repeatable, externally checkable procedure — not a conversational habit. This constrains any adjudicator, human or automated: a "this looks forged" judgment can't be self-validated through case-by-case reasoning; it needs the fixed test from Section II. Confirmed live once (see Section V). Not yet formalized as an actual repeatable procedure — still an intention, not a built thing.

---

# PART B — DOMAIN APPLICATIONS (tenets tested against real structures)

## IX. Germany as Constitutional Redundancy

Germany's administrative slowness partly reflects post-catastrophic distrust of frictionless power: distributed authority, proportionality, judicial review. Two frictions must stay distinct — protective (rights, review, reversibility) vs. dead (duplication, obsolete interfaces, institutional cowardice). Residual analogue systems (cash, counters, paper) may function as an unformalized redundancy layer, not mere backwardness. Not established: Germany hasn't been empirically shown to be the strongest remaining analogue bastion; some persistence is principled, some accidental, some already dead.

## X. Compulsory Digital Mediation

Core question: is ordinary participation conditional on functioning privately-owned computation? Formula: Compulsory Digital Mediation = Essential-Service Digital Penetration − Effective Non-Digital Substitutability. A nominal offline route isn't a real alternative unless it survives the full service chain without disproportionate cost, delay, or dependency. Not established: no cross-country measurement exists; no penalty threshold defines non-viability; correct unit of analysis (country/region/provider/service-chain) unresolved.

## XI. Institutional Compilation

The German state's problem isn't lack of information but fragmentation across non-composing systems. Reframe: not "funding search" but compilation — intent in, lawful route + rejected alternatives + missing evidence + next irreversible action out. The state behaves like an undocumented, distributed runtime. Established: order-of-operations can invalidate otherwise-legal paths. Not established: no stable corpus, no validated rules engine, no tested customer segment.

## XII. Institutional Venture Salvage

Target isn't the distressed company itself but separable combinations within it (archives, teams, brands, obligations) tested for independent viability — venture extraction, not startup acceleration. Media is the plausible first sector (declining linear revenue, valuable stranded assets, high institutional paralysis) but unvalidated by any actual case. Not established: no incumbent has submitted assets, no buyer has paid, no state-aid architecture has been tested in practice.

## XIII. Funnel Before Product

Early scarce asset is the funnel, not the software: who responds, what they disclose, what budget they control. Sequence: Thesis → Funnel → Submissions → Manual synthesis → Paid cases → Repeated structure → Software. Established negatively: choosing a coding tool/architecture was premature relative to testing whether anyone would submit a real institutional problem. Not established: whether hype generates qualified demand or just attention.

## XIV. Value Capture

Consulting fees designed into the venture's economic sequence, not bolted on after. Fee categories (deductible expense, grant-eligible cost, success fee, retainer, equity) are not interchangeable and must stay legally distinct. **Unresolved and flagged, not yet incorporated into the working model:** where public funding touches a distressed incumbent, German/EU state-aid law (*Beihilferecht*) draws hard lines between these instruments that no amount of unifying framework dissolves — this is a real legal constraint, not a design choice. The 8.79% figure has no fixed referent (profit? capital unlocked? savings? enterprise value?) and should not be treated as more precise than it is.

## XV. Forgery-Gap Application — PCA Authorization Verification

*Testing whether Part A transfers real design constraints to "detect a claimed-authentic authorization that is actually forged," not just an analogy.*

- **Fork Integrity (II) →** the authenticity test must be able to return "forged" as a live outcome. McKay's null result is the correct precedent-shape: a pattern-matching claim collapsing under a control test it could have survived. Structurally sound; empirically untested against PCA's actual forgery cases.
- **Topology (IV) →** classify authorization attempts by behavior under the falsification test, not surface resemblance — a forged authorization can be taxonomically identical to a real one. The unresolved divergence-metric question relocates here unanswered: what decides two authorization attempts are "near" under test?
- **Non-Collapse (V) →** a rejected forgery attempt isn't purged; it persists suppressed and can be re-elevated by a later disturbance. Direct bearing on HITL governance-reservoir design: a "dead" rejected case is not evidence the pattern is dead.
- **Dual-Clock (VI) →** per-request check = event-driven; periodic re-audit of already-granted authorizations against newly discovered forgery signatures = scheduled sweep. The general seam becomes a concrete, unavoidable decision here: if a new forgery signature is found mid-cycle, does the next sweep retroactively re-check everything granted since the last sweep, or only sweep-to-sweep? PCA has to decide this, not inherit an answer.
- **Null Manifold (VII) →** the most operationally important and most dangerous transfer. Efficient detection requires a growing known-forged reference set, same logic as the null manifold — but a sophisticated forgery is specifically optimized to sit at high novelty/high complexity, exactly where fast proximity-rejection stops being falsifiable. Not a hypothetical risk imported by analogy; the standard adversarial-evasion problem in this vocabulary.
- **Self-Referential Failure (VIII) →** constrains the adjudicator: whatever sits in the HITL governance reservoir can't validate its own "this looks forged" judgment through internal discussion — it needs the fixed, externally-specified, repeatable procedure. Directly cautions against ad hoc human judgment calls being treated as equivalent to a formal test.

**Verdict: not confirmed, and not confirmable from this document alone.** Sections II, VI, VII, and VIII produce specific, non-redundant design questions (adversarial blind spot at high novelty; sweep-baseline retroactivity; adjudicator self-audit constraint) *if* PCA v5 doesn't already address them. This document only has the memory-level fact that the forgery gap is an open problem — not v5's actual current treatment of it. Whether this is new structure or a restatement of ground v5 already covers is unsettled. **The next step is checking against the v5 artifact directly — not assuming this analysis closes anything.**

---

## Open Items Carried Forward — do not resolve silently

1. **Live vs. frozen sweep baseline (VI)** — highest priority; determines the system's basic architecture class.
2. Divergence/topology metric (IV) — unspecified in every domain touched.
3. Null-manifold generation: organic vs. matched-complexity generator (VII) — now understood as adversarially exploitable if left undecided.
4. ADHD-linked salience switching: detector, confound, or both — the cognitive re-run test has still never been run on one logged instance.
5. Conversational programming origin (I) — internal/social/machine-mediated balance unresolved.
6. Digital dependency unit of analysis (X) unresolved.
7. Analogue viability threshold (X) unresolved.
8. Germany's comparative status (IX) unconfirmed.
9. Funnel quality: curiosity vs. qualified demand (XIII) undistinguished.
10. First buyer identity (XI–XIII) unresolved.
11. Media as first venture-salvage sector (XII) unvalidated by any real case.
12. Business form — phases vs. alternatives (XI–XIV) unresolved.
13. 8.79% economics — referent unfixed (XIV).
14. **State-aid/*Beihilferecht* constraints on the fee model (XIV)** — flagged, not yet incorporated.
15. **PCA v5 cross-check (XV)** — the forgery-gap section is a lens, not a validation, until checked against the actual artifact.
16. **Second-instrument calibration (III)** — still not run. Current N=1; treat all self-derived classifications as baseline.

## Operating Instructions for Next Session

- Treat Parts A and B as fixed background. Do not re-derive.
- Section VI's seam and Section XV's v5 cross-check are the active critical path.
- Do not fold personal, affective, or identity content into this document's architecture, even if it recurs — that content gets named and set aside, per Section VIII's own rule, not silently absorbed as validated structure.
- Do not use "bias" for calibration-stage variance (III). Use "variance" or "idiosyncrasy" until a system exists to be biased against.
- Do not resolve open items heuristically. Surface and ask.
- No claim in Part B has been tested against real customers, real incumbents, or real forgery cases. "Established" means structurally consistent, not verified, unless marked "confirmed."

## Compact Working Tenets

1. Conversation is executable state change.
2. A fork is real only if a test can fail it.
3. Calibration precedes invariants, not the reverse.
4. Classify by behavior, not label.
5. Suppress; do not silently delete.
6. Immediate reaction is not structural review — and which one governs a system is an architecture choice, not a detail.
7. Noise must accumulate into a reusable, adversarially-aware reference field.
8. A nominal alternative that reconverges is not an alternative.
9. Protective friction and dead friction must be separated.
10. Compile intent into lawful action; extract ventures from assets, not slogans.
11. Build the funnel before the machine.
12. Keep fee/legal instruments distinct even when the underlying value story is unified.
13. Expose every consequential selection act.
14. Interrupt fluent error before it hardens into architecture.
15. Personal register and system architecture are different documents. Keep them that way.
