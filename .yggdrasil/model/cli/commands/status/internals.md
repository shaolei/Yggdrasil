## Logic

# Status Command Logic

1. `loadGraph(process.cwd())`, `detectDrift(graph)`, `validate(graph, 'all')`
2. Count nodes by type (`typeCounts` Map); count blackbox nodes
3. Count relations: structural (uses/calls/extends/implements) vs event (emits/listens)
4. Compute quality metrics:
   - Artifact fill rate: for each node, count existing artifact files vs STANDARD_ARTIFACTS keys
   - Relations per node: avg and max (track which node has max)
   - Mapping coverage: nodes with non-empty mapping.paths / total nodes
   - Aspect coverage: for each node, `collectEffectiveAspectIds`; count nodes with >=1 effective aspect
5. Output all sections with chalk formatting
6. Pluralize: singular when count === 1
