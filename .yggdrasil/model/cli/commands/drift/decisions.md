# Drift Command Decisions

**Separate drift and drift-sync commands:** Detection and resolution are intentionally distinct operations. `drift` is read-only analysis that can run safely in CI or at conversation start. `drift-sync` is a deliberate write action that records the current state as the new baseline. Merging them would risk accidental baseline resets during routine checks.

**--drifted-only flag:** The default output shows all nodes including those with `ok` status, which is useful for comprehensive audits. The `--drifted-only` flag hides ok entries to produce cleaner output for CI pipelines and automated checks where only actionable drift matters. The hidden count is still reported in the summary line.
