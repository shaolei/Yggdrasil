import { Command } from 'commander';
import { STANDARD_ARTIFACTS } from '../model/types.js';
import { loadGraph } from '../core/graph-loader.js';
import { detectDrift } from '../core/drift-detector.js';
import { validate } from '../core/validator.js';
import { collectEffectiveAspectIds } from '../core/context-builder.js';
import { normalizeMappingPaths } from '../utils/paths.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show graph summary')
    .action(async () => {
      try {
        const graph = await loadGraph(process.cwd());

        // Count nodes by type
        const typeCounts = new Map<string, number>();
        let blackboxCount = 0;

        for (const node of graph.nodes.values()) {
          typeCounts.set(node.meta.type, (typeCounts.get(node.meta.type) ?? 0) + 1);
          if (node.meta.blackbox) blackboxCount++;
        }

        // Count relations
        let structuralRelations = 0;
        let eventRelations = 0;
        const structuralTypes = new Set(['uses', 'calls', 'extends', 'implements']);
        let maxRelCount = 0;
        let maxRelNode = '';
        for (const node of graph.nodes.values()) {
          const relCount = (node.meta.relations ?? []).length;
          if (relCount > maxRelCount) {
            maxRelCount = relCount;
            maxRelNode = node.path;
          }
          for (const rel of node.meta.relations ?? []) {
            if (structuralTypes.has(rel.type)) structuralRelations += 1;
            else eventRelations += 1;
          }
        }

        const flowCount = graph.flows.length;

        const drift = await detectDrift(graph);
        const validation = await validate(graph, 'all');
        const errorCount = validation.issues.filter((issue) => issue.severity === 'error').length;
        const warningCount = validation.issues.filter(
          (issue) => issue.severity === 'warning',
        ).length;

        // Quality metrics
        const configuredArtifactTypes = Object.keys(STANDARD_ARTIFACTS);
        const totalSlots = graph.nodes.size * configuredArtifactTypes.length;
        let filledSlots = 0;
        let mappedNodeCount = 0;

        for (const node of graph.nodes.values()) {
          const allowed = new Set(configuredArtifactTypes);
          filledSlots += node.artifacts.filter((a) => allowed.has(a.filename)).length;
          if (normalizeMappingPaths(node.meta.mapping).length > 0) mappedNodeCount++;
        }

        let aspectCoveredNodes = 0;
        for (const node of graph.nodes.values()) {
          const effective = collectEffectiveAspectIds(graph, node.path);
          if (effective.size > 0) aspectCoveredNodes++;
        }

        process.stdout.write(`Graph: ${graph.config.name}\n`);
        const pluralize = (word: string, count: number) =>
          count === 1 ? word : word.endsWith('y') ? word.slice(0, -1) + 'ies' : word + 's';
        const typeStr = [...typeCounts.entries()]
          .map(([t, c]) => `${c} ${pluralize(t, c)}`)
          .join(', ');
        process.stdout.write(
          `Nodes: ${graph.nodes.size} (${typeStr}) + ${blackboxCount} blackbox\n`,
        );
        process.stdout.write(
          `Relations: ${structuralRelations} structural, ${eventRelations} event\n`,
        );
        process.stdout.write(
          `Aspects: ${graph.aspects.length}    Flows: ${flowCount}\n`,
        );
        process.stdout.write(
          `Drift: ${drift.sourceDriftCount} source-drift, ${drift.graphDriftCount} graph-drift, ${drift.fullDriftCount} full-drift, ${drift.missingCount} missing, ${drift.unmaterializedCount} unmaterialized, ${drift.okCount} ok\n`,
        );
        process.stdout.write(`Validation: ${errorCount} errors, ${warningCount} warnings\n`);

        // Quality section
        const fillPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
        const totalRelations = structuralRelations + eventRelations;
        const avgRel = graph.nodes.size > 0 ? (totalRelations / graph.nodes.size).toFixed(1) : '0';
        process.stdout.write(`\nQuality:\n`);
        process.stdout.write(
          `  Artifacts: ${filledSlots}/${totalSlots} slots filled (${fillPct}%) — ${configuredArtifactTypes.length} types × ${graph.nodes.size} nodes\n`,
        );
        process.stdout.write(
          `  Relations: avg ${avgRel}/node, max ${maxRelCount}${maxRelNode ? ` (${maxRelNode})` : ''}\n`,
        );
        process.stdout.write(
          `  Mapping: ${mappedNodeCount}/${graph.nodes.size} nodes mapped to source\n`,
        );
        process.stdout.write(
          `  Aspects: ${aspectCoveredNodes}/${graph.nodes.size} nodes have aspect coverage\n`,
        );
      } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
      }
    });
}
