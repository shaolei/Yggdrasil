import { Command } from 'commander';
import { loadGraph } from '../core/graph-loader.js';
import { detectDrift } from '../core/drift-detector.js';
import { validate } from '../core/validator.js';

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
        for (const node of graph.nodes.values()) {
          for (const rel of node.meta.relations ?? []) {
            if (structuralTypes.has(rel.type)) structuralRelations += 1;
            else eventRelations += 1;
          }
        }

        const flowCount = graph.flows.length;
        const knowledgeCount = graph.knowledge.length;

        const drift = await detectDrift(graph);
        const validation = await validate(graph, 'all');
        const errorCount = validation.issues.filter((issue) => issue.severity === 'error').length;
        const warningCount = validation.issues.filter(
          (issue) => issue.severity === 'warning',
        ).length;

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
          `Aspects: ${graph.aspects.length}    Flows: ${flowCount}    Knowledge: ${knowledgeCount}\n`,
        );
        process.stdout.write(
          `Drift: ${drift.driftCount} drift, ${drift.missingCount} missing, ${drift.unmaterializedCount} unmaterialized, ${drift.okCount} ok\n`,
        );
        process.stdout.write(`Validation: ${errorCount} errors, ${warningCount} warnings\n`);
      } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
      }
    });
}
