# Morningstar 0.3 — content-addressed evidence

0.3 makes journal revisions reference captures **by content** rather than by
pointer, records **who** authored each revision, and surfaces the resulting
structure as a **divergence** signal and a **navigable** evidence surface.

The four items are not independent features. Items 1–2 are prerequisites for
item 3; item 4 is what makes 3 legible; and item 1 is what makes 0.4 anchoring
possible at all.

## Data status: disposable until 1.0

`morningstar-integration.md` states that existing protocol-era objects must
never be re-hashed when a future protocol is introduced. That is a **runtime**
rule about deployed data: a future implementation must select canonicalization
by the protocol recorded on each object, rather than re-hashing old objects
under new rules.

It is not a constraint on pre-1.0 schema evolution. Applying it there would buy
permanent dual-field complexity to protect development rows that no one relies
on.

**Through 0.x, stored data is disposable.** 0.3 changes fields in place.
Existing databases are reset (`DataResetService`) and re-imported; existing
`contentFingerprint` values do not reproduce, and that is expected and
intended.

What is preserved instead:

- **Protocol history lives in git and in `docs/`**, not in dead schema fields.
  Each protocol change gets a tagged commit and a changelog entry recording
  what the era's canonicalization was.
- **The dispatch mechanism is still owed.** Per-object canonicalization
  selection must exist before any capture exists that someone would be upset
  to lose. Tracked against 0.4.

### Tripwire

This posture ends at the first of:

1. A capture exists whose loss would matter — real use, not fixtures.
2. An external anchor is published; once a root is committed elsewhere, the
   data it commits to can no longer be regenerated.
3. Any second party holds a copy.

Until then, freedom to rewrite is worth more than durability. After any of the
three, per-object canonicalization dispatch is mandatory and this section is
deleted.

---

## Item 1 — Content-addressed evidence references

### Problem

`HappyLabsApp.swift:318` builds references from `captureID.uuidString`. A UUID
names a *row*. Resolving it requires a lookup into the sidecar and trusting that
row at read time. Across a store boundary — journal in Core Data, captures in
`Morningstar.sqlite`, separate files, separate lifecycles — the reference is only
as strong as the other store.

### Change

`evidenceReferences` carries integrity hashes. No new field, no dual accessor,
no conditional fold.

- `HappyLabsApp.swift:318` — map to `capture.integrityHash` instead of
  `captureID.uuidString`
- `evidenceReferences` continues to feed `contentFingerprint`
  (`PipelineOrchestrator.swift:176`, `:197`) unchanged — the values it folds are
  now content-addressed, so revision fingerprints transitively commit to
  capture content

Schema is untouched. Existing rows hold stale UUID references and are cleared
by reset.

Navigation from a reference back to a capture is a lookup by hash rather than
by row id, which is what makes the coordinate self-verifying: the reference
cannot resolve to content other than what it names.

### Required store API

`MorningstarJournalAttachment` has no capture hash. Add to `MorningstarStore`:

```swift
public func attachedCaptures(journalEntryID: UUID) throws
    -> [(attachment: MorningstarJournalAttachment, capture: MorningstarCapture)]
```

One statement joining `attachments` to `captures`. Callers currently doing
`attachments(...).map { $0.captureID }` become
`attachedCaptures(...).map { $0.capture.integrityHash }`.

Keep the UUID in `evidenceReferences` for navigation. The hash is the
coordinate; the UUID is the address you dereference.

### Consequence

Every 0.3+ revision fingerprint transitively commits to capture *content*.
That is the cross-store Merkle link 0.4 anchoring needs — obtained here as a
side effect rather than as separate work.

---

## Item 2 — Authorship attribution on revisions

### Problem

`JournalRevisionEntity` has no author field. Every revision is anonymous, so
divergence cannot distinguish *the human reconsidered* from *an instrument
rewrote it*. That distinction is the entire agentic claim.

### Change

- `HappyLabsModel.swift:157` — add `attr("authorRaw", .stringAttributeType, optional: true)`
- New `enum JournalRevisionAuthor: String { case human, agent, pipeline }`
  - `human` — an explicit user decision
  - `agent` — drafted or edited by an instrument, however supervised
  - `pipeline` — mechanical, from mbox import with no interpretive act
- `insertJournalRevision` — accept `author:`; nil on pre-0.3 rows reads as
  `unattributed`, never silently as `human`

Attribution is recorded, not enforced. A revision may be agent-authored and
entirely correct. The point is that it is *distinguishable*.

Do this first. It is cheap now and expensive once there is history, because
past revisions can never be attributed retroactively.

---

## Item 3 — Divergence detector

### Problem

Nothing reads `evidenceReferences` back. The data has been written since the
pipeline landed and has never been examined.

### Change

New `MorningstarDivergenceService` in `HappyLabsCore`. Pure read; no writes,
no schema. For a journal entry, walk its revisions in order and report:

| Signal | Condition | Meaning |
|---|---|---|
| **Drift** | revision N cites the same captures as revision 1, but title/body fingerprint has changed across ≥3 revisions | story moved while evidence stayed fixed |
| **Abandonment** | capture cited at revision N, absent at N+1 | evidence dropped without deletion — often where a belief changed |
| **Retro-attachment** | `attachment.attachedAt` > `createdAt` of the earliest revision citing it | support gathered after the conclusion |
| **Unsupported** | revision with empty `evidenceReferences` where a prior revision had some | narrative detached from witness |
| **Orphan rate** | captures with no attachment, as a proportion | health signal; a *low* rate is suspicious, not a good one |
| **Broken coordinate** | `evidenceReferences` entry matching no capture hash | tampering or store divergence — the only hard error here |

All are observations, not errors, except the last. Report, never block —
consistent with the existing non-blocking leakage checker.

The orphan-rate row matters: real records accumulate captures that went
nowhere. A history where everything is load-bearing is the signature of
backfill.

---

## Item 4 — Content-addressed evidence navigation

Interaction grammar lifted from `upgraded-enigma` (`index.html`), which
already implements it against document fragments.

| upgraded-enigma | Morningstar |
|---|---|
| `#breath-id` fragment anchor | capture `integrityHash` as route |
| per-cell `:hover` reveal (27 rules, `style.css:209–365`) | evidence disclosed on reader attention, not pushed |
| return-to-hub glyph in every section | return-to-capture from any interpretation |
| grid cells all linking to the same next grid | traversal recorded, selection content not |

The defect to avoid is the one that layer already has: a fragment anchor is a
*positional* address. Change a section's contents and `#breath-id` still
resolves, now naming something else — the same flaw as UUID references, one
layer up.

So: routes into the evidence library key on `integrityHash`. A link into
evidence cannot be made to point at different content, and *return to origin*
means return to that content rather than to whatever occupies the slot.

Surfaces: `ProvenancePlateView` gains hover-disclosure per capture and a
hash-keyed return affordance; `ConnectomeView` renders divergence edges from
item 3.

---

## Deferred

- **0.3.5 — artifact content-hashing.** Vocal sample, notation, formula hashed
  into `statedContext`; file stored outside the chain. No protocol bump.
  Turns "I described the melody" into "this is the melody, sealed."
- **0.4 — joint-root anchoring.** Periodic Merkle root over captures,
  attachments, and revision fingerprints, externally anchored. Requires
  protocol 0.3 with per-object canonicalization dispatch. Needs the social
  half — copies outside your control — not only the cryptographic half.
- **Not planned — verifying phenomenology.** No scheme can externally verify a
  subjective report. Contemporaneity is the property; it already holds.

## Order

1. Item 2 (authorship) — cheapest, most time-sensitive
2. Item 1 (hash references) — unblocks 0.4
3. Item 3 (divergence) — needs 1 and 2
4. Item 4 (navigation) — needs 3

## Tests

- A revision's `evidenceReferences` resolve to captures by hash, and a capture
  altered out-of-band fails to resolve — the coordinate property itself
- Nil `authorRaw` reads as `unattributed`, never `human`
- Each divergence signal has a constructed fixture producing exactly it
- Existing 7 Morningstar tests continue to pass unchanged

Deliberately **not** tested: fingerprint stability across the 0.3 change.
Pre-0.3 fingerprints are expected to break. Re-introduce a stability test at
the tripwire, alongside canonicalization dispatch.
