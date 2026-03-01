import { Command } from 'commander';
import { loadGraph } from '../core/graph-loader.js';
import { buildContext } from '../core/context-builder.js';
import { validate } from '../core/validator.js';
import { formatContextText } from '../formatters/context-text.js';

export function registerBuildCommand(program: Command): void {
  program
    .command('build-context')
    .description('Assemble a context package for one node')
    .requiredOption('--node <node-path>', 'Node path relative to .yggdrasil/model/')
    .action(async (options: { node: string }) => {
      try {
        const graph = await loadGraph(process.cwd());
        const validationResult = await validate(graph, 'all');
        const structuralErrors = validationResult.issues.filter(
          (issue) => issue.severity === 'error',
        );
        if (structuralErrors.length > 0) {
          process.stderr.write(
            `Error: build-context requires a structurally valid graph (${structuralErrors.length} errors found).\n`,
          );
          process.exit(1);
        }

        const nodePath = options.node.trim().replace(/\/$/, '');
        const pkg = await buildContext(graph, nodePath);
        const warningThreshold = graph.config.quality?.context_budget.warning ?? 5000;
        const errorThreshold = graph.config.quality?.context_budget.error ?? 10000;
        const budgetStatus =
          pkg.tokenCount >= errorThreshold
            ? 'error'
            : pkg.tokenCount >= warningThreshold
              ? 'warning'
              : 'ok';

        let output = formatContextText(pkg);
        output += `Budget status: ${budgetStatus}\n`;
        process.stdout.write(output);

        if (budgetStatus === 'error') {
          process.stderr.write(
            `Error: context package exceeds error budget (${pkg.tokenCount} >= ${errorThreshold}).\n`,
          );
          process.exit(1);
        }
      } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
      }
    });
}
