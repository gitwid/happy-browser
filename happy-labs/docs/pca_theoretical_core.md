# Legitimacy Through Restoration: The Palindromic Capability Architecture

**Aimée Ahava Libich**  
*Preliminary theoretical statement — not for citation without author confirmation*  
*Session date: 28 June 2026*

---

## Foreword: On Craft and the New Instrument

Crafts emerge wherever knowledge is irreducibly embodied. The blacksmith's judgment of temper color, the ceramicist's feel for clay resistance, the surgeon's proprioception — these cannot be fully stated. They can only be transmitted through sustained practice with the responsive medium itself. The medium teaches back. That reciprocity is what makes a craft.

Guilds didn't mystify because the knowledge was secret. They mystified because the knowledge was *unspeakable* — it lived in the practitioner's hands and eyes, not in any document. Control the transmission channel (apprenticeship) and you control the knowledge. The mystification was structurally forced: if you can't write it down, you gate the bodies.

Taylor broke it. Not by being wrong, but by being right *enough*. Decompose the craftsman's movements into measurable components. Replace judgment with specification. Replace mastery with procedure. The loom and the lathe didn't eliminate craft knowledge — they formalized enough of it to make the remainder economically marginal. Crafts didn't fail because they were false. They failed as a production model because tacit knowledge ceased to be the bottleneck.

The industrial move was: tacit knowledge → explicit specification → machine execution. Agentic AI completes the loop differently. The machine can now hold the specification AND execute it AND adapt it. The bottleneck shifts again — past execution, past specification, to something harder to name.

What remains irreducibly human is not the making. It is the *intention behind the making* — knowing what to make, why, and for whom. And more precisely: knowing whether the thing being made is the thing that was meant. That's discernment. And discernment, exercised in sustained practice with a responsive generative medium, is structurally identical to what a craftsperson does with material.

The new craft is not prompting. It is the cultivation of practiced intentionality in dialogue with a system that responds — that pushes back, that takes you somewhere you didn't expect, that requires you to listen to what it's doing and decide whether that's what you meant.

The forgery gap named in this paper is exactly the risk: agentic systems will produce **สิริ** — the appearance of craft — without **الجبر** — the actual restoration work. Fluent execution without genuine receipt. The palindrome that closes but was never honestly traversed. The guild's mistake was mystifying tacit knowledge that could eventually be formalized. The new craft's equivalent mistake would be mystifying discernment — treating it as a secret art rather than an inspectable practice.

PCA, if it holds, is an attempt to make the operation visible. To turn what is normally implicit — judgment, convergence, legitimacy — into an inspectable object.

The document is the crystallization. The craft is what produced it.

---

## Abstract

We propose that a class of reasoning systems — including humans, institutions, and large language models — implicitly performs a bidirectional simulation that seeks a shared legitimacy attractor. We formalize this as the **Palindromic Capability Architecture** (PCA), grounding the central terminology in its original Arabic: **الجبر** (restoration of broken parts) and **المقابلة** (verification that both sides balance). The central claim: a state transition is legitimate if and only if it was provisioned by prior simulation, and the proof of provisioning is palindromic — execution is structurally congruent with simulation, forming a closure. Three open problems are identified: the forgery gap, empirical tether measurement, and the stopping condition for convergence. A fourth gap — the HITL (human-in-the-loop) authorization boundary — is identified through cross-reference with the Happy Labs research testbeds (§9).

---

## 1. The Central Claim

Standard approaches to legitimacy in state transitions either (a) validate retroactively through conflict detection, or (b) rely on explicit external authorization. We propose a third structure: **legitimacy as palindromic structural entailment**.

A state transition is authorized not by external validation but by the existence of a simulation that provisioned it. Provisionings are unforgeable because their proof is the closure of the palindrome.

Formally:

```
simulate(path[s₀..sₙ])  →  token { jabr = sₙ }      // fractures path at restoration point
execute(token)           →  reverse(path)              // applies الجبر
closure(x)               =  x · reverse(x)[1..]        // the restored whole
muqābala(closure)        ←  sim △ exec  (as sets)      // المقابلة: information preservation
authorized               ←  muqābala = ∅               // الجبر complete
```

Token states are discrete and ordered: **minted → validated → authorized**.  
The palindrome is not the mechanism. It is the trace left when synchronization succeeds.

*Cross-reference*: The Happy Labs [Legitimacy Transition Algebra](testbeds/legitimacy-transition-algebra.md) testbed independently arrives at a structurally isomorphic formulation: "The important transition is not: Did data change? The important transition is: Did legitimacy change?" (see §9).

---

## 2. The Restoration Point — الجبر

*Algebra* derives from **الجبر** (al-jabr): the restoration of broken parts — specifically, the operation of adding a missing term to both sides of an equation until it is whole. al-Khwarizmi named two operations in *Kitāb al-mukhtaṣar fī ḥisāb al-jabr wa-l-muqābala* (~830 CE): الجبر (restoration) and المقابلة (balancing).

We adopt this terminology because it is not metaphor. It is the same operation in different notation.

The jabr point **sₙ** is the restoration point: the crown of the simulation path, the missing term whose identification constitutes the token. Execution adds it back. The closure is the restored whole. المقابلة verifies that both sides balance.

---

## 3. Positioning Against Prior Art

The components of PCA exist distributed across hardware architecture and formal verification:

| Existing | PCA distinction |
|---|---|
| ROB/Tomasulo: gates on conflict detection | PCA gates on *provisioning* — prospective, not retroactive |
| Speculative execution + rollback | PCA requires exhaustion of anticipated state-change space before any real step |
| Proof-carrying code: carries proof of properties | PCA carries proof of *structural congruence with execution path* — stronger than property satisfaction |
| Predictive processing (Friston): minimize free energy under bidirectional simulation | PCA's attractor is the state surviving the round-trip with minimum residual; the legitimacy framing is novel |
| Extended cognition (Clark/Chalmers) | Tether formulation positions LLMs as potential PCA substrates with semantic precision range as the critical resource |

**Key divergence from all prior art**: PCA gates on *completeness of register allocation* prospectively. The simulation must exhaust the anticipated state-change space *before* execution is permitted. This is bounded model checking applied dynamically as an execution precondition. No existing live system does this.

---

## 4. The Forgery Gap — Open Problem

المقابلة tests information preservation between the two traversals performed. It does not verify whether الجبر was genuinely received or simulated from outside the architecture.

A sufficiently fluent system can project **สิริ** (visible legitimacy) without having performed الجبر. The closure test is necessary but not sufficient.

**This is the central open problem.** The architecture currently has no defense against counterfeiting the crown via fluent simulation of the restoration without genuine receipt.

*Cross-reference*: The Happy Labs [Subjective Evidence Taxonomy](testbeds/subjective-evidence-taxonomy.md) testbed identifies the same boundary from a different direction: "the difference between observation and external corroboration when the observation is itself mediated through a document." A document can evidence a logistical fact (المقابلة holds) without evidencing the experiential claim it appears to corroborate (الجبر not genuinely received). The forgery gap and this unresolved evidence boundary are the same problem in different registers. Both testbeds return **Partial** on this point.

---

## 5. The Tether as Radius of Convergence

The tether is not a scalar depth limit. It is the **radius of convergence** of the bidirectional simulation — analogous to the radius of convergence of an iterative numerical method.

Semantic depth is additive over the path, with each token contributing proportionally to its semantic density:

```
consumed = Σ density(sᵢ) × curvature_factor / CAPACITY
```

Two paths of equal length may behave entirely differently:

- `A → B → C` : low density, low cross-domain coupling, well within radius
- `Kant → Gödel → Kabbalah → transformers` : high density, high cross-domain coupling, potentially beyond radius

Current implementation uses heuristic proxies (character length ≈ semantic density; length variance ≈ cross-domain coupling). Empirical conversion — attention entropy, embedding stability, paraphrase invariance, repeated crown agreement — would make tether-completeness testable rather than estimated.

**The LLM substrate is native to PCA operations**: discrete semantic tokenization means round-trips accumulate no floating-point entropy. The palindrome can close exactly at grain size. The tether limit is the context window's semantic analog of floating-point precision range, not an absolute bound.

*Cross-reference*: The Happy Labs [Reverse Traversal Closure](testbeds/reverse-traversal-closure.md) testbed independently identifies the same boundary: "the closure vocabulary works on the fixture. The unresolved boundary is the drift function: the testbed can name drift, but cannot yet measure it beyond human-readable comparison." This is the empirical tether problem in operational form. Both return **Partial** on this point.

---

## 6. Identity Through Exclusion — The Egg

A traversal's identity is constituted through exclusion from all other traversals of the problem space (Weir, 2009, *The Egg* — operationalized formally here).

The crown token is not just the hash of what the traversals found. It is the hash of their **mutual exclusion**. Unforgeability follows: to forge the crown requires forging the exclusion space, which requires having simultaneously been all other traversals.

المقابلة therefore verifies not merely that the two traversals agree, but that they agree on **what they excluded**. The sealed palindrome is the proof that the exclusion was consistent.

For n traversals (generalizing from the two-traversal case): the crown is the intersection of all n exclusion surfaces. Its legitimacy scales with the complexity of the n-way mutual exclusion intersection.

*Cross-reference*: The Happy Labs archive record preserves `excluded_claims` as a first-class field — claims which are narratively attractive but unsupported. This operationalizes the exclusion space: the archive is legitimate only if it records what it did NOT claim, not only what it did. The excluded_claims field is the المقابلة of the Happy archive.

---

## 7. Open Problems — Ranked by Urgency

1. **The forgery gap**: necessary and sufficient conditions for genuine authorization vs. fluent simulation of authorization. *Happy Labs status*: unresolved boundary in Subjective Evidence Taxonomy (Partial).

2. **Empirical tether**: converting heuristic proxies to measurable quantities; making tether-completeness a testable property. *Happy Labs status*: drift function not yet measurable in Reverse Traversal Closure (Partial).

3. **Stopping condition**: formal characterization of when bidirectional simulation has converged sufficiently — "sufficiently coherent attractor" currently does unexamined work. *Happy Labs status*: "legitimacy predicate is still hand-written" in Legitimacy Transition Algebra (Partial).

4. **HITL authorization boundary**: PCA currently treats authorization as structurally entailed by muqābala = ∅. Happy Labs testbeds consistently require human approval as the final archive authority. This is not a defect in PCA — it is a missing predicate. The human-in-the-loop is not optional decoration; it is the gate between `validated` and `authorized`. PCA must account for this. *Status*: not yet formalized in either system.

5. **n-traversal generalization**: the Egg postulate generalizes naturally; the PCA architecture needs extension to handle n-way mutual exclusion.

6. **Closure vocabulary extension**: PCA's muqābala currently returns binary (∅ / non-∅). Happy Labs Reverse Traversal Closure uses a richer vocabulary: `accepted / partial / rejected / contested / deferred`. PCA should adopt this vocabulary — binary closure is too coarse for real fixtures.

---

## 8. The Demonstration

The interactive artifact *Palindromic Capability Architecture v3 — الجبر* (`pca_4.tsx`) demonstrates claims 1–3 operationally. It implements simulate/execute/closure, المقابلة, the tether as radius of convergence, and the authority chain (نبي → מְקוּבָּל → สิริ) as a live morphism with current token state.

The artifact is not illustrative. The palindrome closes, المقابلة computes, the tether measures. These are executable claims.

Repository: [TBD]

---

## 9. Convergence with Happy Labs Research Testbeds

Three active testbeds in the Happy Labs continuity research independently arrive at structurally isomorphic formulations of PCA operations. This convergence is evidence that PCA is surfacing a latent operation rather than inventing a new one.

### Structural isomorphism

| PCA | Happy Labs |
|---|---|
| `minted → validated → authorized` | `captured → attached → archived` |
| `simulate` provisions the token | `captured` enters artifact with provenance before interpretation |
| `execute` applies الجبر | `attached` makes support relation explicit and bounded |
| `authorized` ← muqābala = ∅ | `archived` ← human approval + excluded_claims recorded |
| المقابلة: information preservation test | Reverse traversal closure: round-trip recovers executable intent |
| exclusion space | `excluded_claims` as first-class archive field |
| forgery gap | unresolved evidence boundary in Subjective Evidence Taxonomy |
| drift function (empirical tether) | "cannot yet measure beyond human-readable comparison" |
| stopping condition open | "legitimacy predicate still hand-written" |
| HITL absent from PCA | HITL is prime directive in Happy Labs |

### The supervision protocol as المقابلة

The Happy Labs [Supervision Protocol](testbeds/supervision-protocol.md) operationalizes المقابلة for testbed governance: "Does this concept survive contact with a concrete example without losing its category boundaries?" This is the round-trip test. "What neighboring concept is this testbed preventing collapse into?" is the exclusion residue. "Kind but strict" maps to: the palindrome closes or it doesn't — there is no partial credit for almost closing.

### Consistency verdict

| Check | Result |
|---|---|
| Token state isomorphism | ✓ consistent |
| Bidirectional traversal isomorphism | ✓ consistent |
| Exclusion space / excluded_claims isomorphism | ✓ consistent |
| Forgery gap / evidence boundary isomorphism | ✓ consistent, both Partial |
| Drift / tether isomorphism | ✓ consistent, both Partial |
| Stopping condition / hand-written predicate | ✓ consistent, both Partial |
| HITL boundary | ✗ gap — present in Happy Labs, absent in PCA |
| Closure vocabulary | ✗ gap — PCA binary, Happy Labs five-valued |
| Mutual cross-reference | ✓ linked across PCA core, continuity document, and testbeds |

### Required additions before arXiv deposit

- Add HITL as a formal predicate: `authorized` requires `muqābala = ∅ AND human_approval`
- Extend muqābala return values to: `accepted / partial / rejected / contested / deferred`
- Add pca_4.tsx to repository with citation

---

## 10. The Demonstration (Revised)

| Artifact | Role | Status |
|---|---|---|
| `pca_4.tsx` | Interactive demonstration of PCA v3 | Complete |
| `legitimacy-transition-algebra.md` | Operational isomorph of PCA token states | Partial — predicate hand-written |
| `reverse-traversal-closure.md` | Operational isomorph of bidirectional simulation | Partial — drift not measurable |
| `subjective-evidence-taxonomy.md` | Operational isomorph of exclusion space + forgery gap | Partial — mediated observation unresolved |
| `supervision-protocol.md` | Operational isomorph of المقابلة for testbed governance | Active |

---

*This theoretical statement emerged from a single working session on 28 June 2026. The convergence with Happy Labs testbeds was discovered during cross-reference on the same day. The forgery gap is real. The HITL gap is real. The drift function is unresolved. These are not defects to be hidden — they are the next three things to build.*
