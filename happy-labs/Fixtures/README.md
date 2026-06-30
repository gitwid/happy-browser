# Fixtures

## Public / committed

Nothing in this directory is committed by default except this README.

The **synthetic corpus** is generated at test/runtime:

```swift
import HappyLabsCore
let url = URL(fileURLWithPath: "/tmp/sample.mbox")
try SyntheticCorpusGenerator.writeFixture(to: url)
```

## Private / local only (gitignored)

Use `private/` for material that must never enter the repository:

```text
Fixtures/private/
  mailboxes/          # Mail.app .mbox exports
  findings/           # Phase 0.1 JSON/Markdown exports with qualitative notes
```

Add your own mailboxes here. Happy Labs reads them only when you pass the path to `HappyLabsValidate` or import via the GUI.

## Naming convention

```text
{mailbox-name}-{scope}-{YYYY-MM-DD}.mbox
phase01-{mailbox-name}-{timestamp}.json
phase01-{mailbox-name}-{timestamp}.md
```

## Redaction before sharing

If you need to share findings externally:

- Replace display names and addresses with `example.com` placeholders
- Drop full paths; keep scope and counts only
- Never commit raw `.mbox` files
