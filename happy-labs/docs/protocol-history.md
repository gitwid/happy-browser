# Morningstar protocol history

The archive of the protocol's evolution. Under the 0.x disposability posture
(`morningstar-0.3-spec.md`), stored data is discarded across protocol changes —
so the history lives here and in git, not in the schema.

Every protocol change gets an entry here and a tagged commit. An entry records
what canonicalization the era used, what changed, and where an exhibit of that
era is preserved.

## Rule

Objects are hashed under the protocol recorded on them. A later implementation
selects canonicalization by that recorded protocol; it never re-hashes an
earlier era's objects under newer rules.

This is a **runtime** rule about how code reads data. It is not a constraint on
pre-1.0 schema evolution — see the tripwire in `morningstar-0.3-spec.md` for
when 0.x freedom to rewrite ends.

Per-object canonicalization dispatch is **not yet implemented**. It is owed
before the first tripwire condition is met.

---

## Eras

### 0.2 — first shipped era

| | |
|---|---|
| Protocol / schema | `0.2` / `0.2` |
| Canonicalization | RFC 8785 JCS → SHA-256 |
| Genesis hash | 64 zeros |
| Status | current |

Three-channel captures (observation / phenomenology / action). Append-only via
SQLite triggers rejecting UPDATE and DELETE. Capture and event previous-hash
chains. Annotations reference captures rather than editing them. Attachments to
journal entries require an explicit human act.

Swift implementation reproduces the Python Morningstar golden vectors
byte-for-byte, including UTF-16 key ordering and ECMAScript binary64 number
formatting.

Journal revisions reference captures by **UUID** — a pointer to a row, not a
content address.

**Exhibit:** `Fixtures/private/protocol-era/0.2/` (gitignored — real content).

| | |
|---|---|
| Snapshot SHA-256 | `5a2c62aa73265da867986664ea7db124c6241fb952a76013ab9638328a3be348` |
| Captures | 1 (sequence 1, genesis previous-hash) |
| Chain head | `70ada3452823…` |
| Committed | 2026-07-19T04:49:21.361Z |

The first capture committed in this system. Retained as the regression fixture
for the 0.2 canonicalization path.

---

### 0.3 — content-addressed evidence (in progress)

Spec: `morningstar-0.3-spec.md`.

Capture canonicalization is **unchanged** from 0.2. What changes is the journal
side: revisions reference captures by `integrity_hash` rather than UUID, and
carry an author attribution. Because `contentFingerprint` folds evidence
references in, revision fingerprints computed under 0.2 do not reproduce — this
is expected, and stored data is reset rather than migrated.

Landed so far:

- Revision authorship (`human` / `agent` / `pipeline`; absent reads as
  unattributed)
- Content-addressed references — a journal entry's evidence references carry
  each capture's `integrity_hash` rather than its UUID, so revision
  fingerprints transitively commit to capture content

Remaining: divergence detection, content-addressed evidence navigation.
