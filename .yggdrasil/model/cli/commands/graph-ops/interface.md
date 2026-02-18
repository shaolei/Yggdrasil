# Graph Ops Commands Interface

| Function | Command | Key options / behavior |
| -------- | ------- | ----------------------- |
| `registerStatusCommand` | status | No options. Summary: nodes, relations, aspects, flows, knowledge, drift counts, validation counts. |
| `registerTreeCommand` | tree | --root \<path\>, --depth N. |
| `registerOwnerCommand` | owner | --file \<path\>. Resolves via mapping (file, directory, files). |
| `registerDepsCommand` | deps | --node \<path\>, --depth N, --type structural\|event\|all. |
| `registerImpactCommand` | impact | --node \<path\>, --simulate. Simulate: compare context packages (HEAD vs current graph), report drift status of mapped source files for each affected node. |

Errors to stderr, process.exit(1) on failure.
