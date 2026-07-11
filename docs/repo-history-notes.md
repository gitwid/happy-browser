# Repo history notes

Small annotations about the Git history that the commit messages themselves get
wrong or leave ambiguous. Recorded here rather than rewriting published history.

## `cfbd393` — message says "plugin discovery", diff is the Link Tray

Commit `cfbd393` is titled **"Add browser plugin discovery and install support,"**
but its diff is entirely the **Link Tray** feature (link + DOM-control capture into
a persistent tray). There is no plugin-discovery code in the tree — `grep -ri plugin src`
finds nothing. If you use `git log` to reconstruct when a feature landed, treat the Link
Tray as having arrived in `cfbd393` (2026-07-08), and disregard the "plugin discovery"
wording.
