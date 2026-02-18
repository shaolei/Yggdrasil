# Drift Detector Interface

- `detectDrift(graph: Graph, filterNodePath?: string): Promise<DriftReport>`
  - For each mapped node: compute current hash, compare with readDriftState. Returns entries with status ok|drift|missing|unmaterialized.
