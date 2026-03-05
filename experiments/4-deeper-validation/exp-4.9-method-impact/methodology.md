# Experiment 4.9: Method-Level Impact Filtering

## Objective

Measure whether the `--method` flag on `yg impact` meaningfully reduces blast radius
compared to node-level impact, and quantify the precision improvement for agent
decision-making.

## Hypothesis

When a developer modifies a single method within a high-fan-in node, full node-level
impact analysis overstates the blast radius. Method-level filtering should reduce the
"Directly dependent" set to only those nodes that actually consume the changed method,
enabling agents to skip unnecessary inspection and update work.

## What We Measured

1. **Direct dependent count**: Number of nodes in the "Directly dependent" section.
2. **Transitive dependent count**: Number of nodes in the "Transitively dependent" section.
3. **Total scope** (as reported by the CLI): The combined node count including transitive.
4. **Blast radius reduction**: `1 - (filtered_direct / full_direct)`, expressed as a
   percentage.
5. **Precision**: `filtered_direct / full_direct` -- the fraction of the full blast
   radius that is actually relevant.

Note: The `--method` flag filters only the "Directly dependent" section. Transitively
dependent nodes are derived from the filtered direct set. Aspects, flows, and
nodes-sharing-aspects sections are NOT filtered by method (by design -- aspects and flows
apply to the node as a whole, not to individual methods).

## Repositories Tested

| Repository | Nodes | Relations with `consumes` | Domain |
|---|---|---|---|
| Hoppscotch | 16 | 14 relations across 7 source nodes | NestJS backend services |
| Yggdrasil | 26 | 43 relations across 18 source nodes | CLI tool (TypeScript) |
| Medusa | 4 | 1 relation | E-commerce payment module |
| Django | 8 | 5 relations across 3 source nodes | Python web framework |

## Target Node Selection

We selected target nodes (the nodes being impacted) based on **fan-in** -- the number of
distinct nodes that depend on them. Higher fan-in means more potential for method-level
filtering to differentiate consumers.

### Hoppscotch Targets

| Target Node | Full Direct Dependents | Distinct Methods Consumed |
|---|---|---|
| user/user-service | 4 | 19 unique methods across 4 consumers |
| team/team-service | 5 | 18 unique methods across 5 consumers |
| team-collections/team-collection-service | 2 | 4 unique methods across 2 consumers |
| team-request/team-request-service | 1 | 2 methods from 1 consumer |
| team-environments/team-environments-service | 1 | 1 method from 1 consumer |
| team-invitation/team-invitation-service | 1 | 3 methods from 1 consumer |

### Yggdrasil Targets

| Target Node | Full Direct Dependents | Distinct Methods Consumed |
|---|---|---|
| cli/model | 12 | 28 unique types across 12 consumers |
| cli/core/loader | 11 | 2 functions across 11 consumers |
| cli/utils | 10 | 7 functions across 10 consumers |
| cli/io | 4 | 11 functions across 4 consumers |
| cli/core/context | 4 | 3 functions across 4 consumers |
| cli/core/validator | 4 | 1 function across 4 consumers |

## Method Selection Strategy

For each target node, we selected methods with varying levels of consumer specificity:

- **Universal methods**: Consumed by all or nearly all dependents (expect no/minimal
  reduction).
- **Partial methods**: Consumed by a subset of dependents (expect moderate reduction).
- **Exclusive methods**: Consumed by exactly one dependent (expect maximum reduction).

This gives us the full spectrum of filtering effectiveness.

## Procedure

For each target node:

1. Run `yg impact --node <path>` to establish baseline (full blast radius).
2. For each selected method, run `yg impact --node <path> --method <name>`.
3. Extract the "Directly dependent" count and "Total scope" from each output.
4. Compute blast radius reduction percentage.
5. Also tested edge case: non-existent method name (should return 0 dependents).

## Environment

- CLI: `/workspaces/Yggdrasil/source/cli/dist/bin.js` (development build)
- Node.js runtime on Linux (OrbStack)
- All repositories local with fully materialized `.yggdrasil/` graphs
- All relations in both primary repos (Hoppscotch, Yggdrasil) have explicit `consumes`
  lists (100% coverage)
