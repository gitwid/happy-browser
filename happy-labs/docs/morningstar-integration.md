# Morningstar witness layer

Morningstar is the evidentiary layer beneath Happy Journal. It records what was
observed, experienced, and done; the journal remains the place where evidence
becomes interpretation and narrative.

## Storage boundary

Morningstar evidence is stored in `Morningstar.sqlite`, a dedicated local
sidecar next to `HappyLabs.sqlite`. It is not flattened into `ContinuitySource`
or placed under the journal's reset and import-rollback lifecycle.

The sidecar contains:

- immutable three-channel captures
- annotations and corrections that reference, rather than edit, a capture
- explicit capture-to-journal attachment records
- an append-only event ledger

SQLite triggers reject updates and deletes on all four tables. Captures and
events use SHA-256 previous-hash chains. Verification recalculates object hashes,
chain continuity, sequence continuity, and protocol compatibility.

## Protocol contract

The Swift implementation writes Morningstar protocol/schema 0.2 and uses RFC
8785 JSON Canonicalization Scheme. Tests reproduce the Python Morningstar golden
vectors byte-for-byte, including UTF-16 key ordering and ECMAScript binary64
number formatting.

Existing protocol-era objects must never be re-hashed when a future protocol is
introduced. A later implementation must select canonicalization by the protocol
recorded on each object.

## Human-governed relationship

A capture may remain unattached. Creating an attachment always requires an
explicit user action, either while committing the capture or from the evidence
library. Time proximity and textual similarity are not treated as evidence of a
relationship.

Journal text remains a projection. Before a journal projection can change, its
current text and evidence references are recorded as an append-only
`JournalRevisionEntity`; an edit appends the next revision and only then updates
the current projection.

## Current vertical slice

1. Open Morningstar from the journal toolbar.
2. Enter observation, phenomenology, and action.
3. Review non-blocking channel-leakage flags.
4. Commit the immutable capture, optionally attaching it to a journal entry.
5. Reopen Morningstar to inspect the persisted capture and verification state.
6. Open the attached journal entry's provenance plate to inspect the original
   channels, annotations, protocol era, hashes, and attachment event.
7. Open the Connectome to see capture → interpretation → journal branches.
