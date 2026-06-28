# Recoverability Test Harness

Use this after creating a Recoverability packet in the iOS app.

1. Open Happy Journal in the simulator.
2. Open Recoverability Test Builder.
3. Fill the memory baseline before looking at artifacts.
4. Pick artifacts.
5. Create packet.
6. Run recovery pass.
7. Compare against baseline.
8. From the repo, run:

```sh
cd /Users/diva/Developer/happy-browser/happy-labs
scripts/check_recoverability_packet.py
```

The checker automatically finds the newest simulator packet. To inspect a specific packet:

```sh
scripts/check_recoverability_packet.py "/path/to/Recoverability Tests/packet-folder"
```

The harness checks packet anatomy, required files, generated system output, blind-test boundary declarations, comparison generation, and artifact presence.
