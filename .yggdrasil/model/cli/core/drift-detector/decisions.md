# Drift Detector Decisions

**Bidirectional drift (source vs graph):** Either side of the code-graph relationship can change independently. Source files may be edited without updating graph artifacts, or graph artifacts may be updated without changing source. Detecting both directions separately enables the agent rules to prescribe different resolution strategies: source-drift means "update graph to match code," graph-drift means "review if code needs updating."

**Per-file hashing alongside canonical hash:** The canonical hash (SHA-256 of sorted path:hash pairs) determines whether any drift exists. Per-file hashes (`DriftNodeState.files`) enable granular reporting of exactly which files changed, categorized as source or graph. Without per-file tracking, the system could only report "something changed" without identifying which files drifted.
