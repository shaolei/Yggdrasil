import { Command } from 'commander';
import { stringify as yamlStringify } from 'yaml';
import { loadGraph } from '../core/graph-loader.js';
import { selectNodes } from '../core/node-selector.js';
import { findYggRoot } from '../utils/paths.js';

export function registerSelectCommand(program: Command): void {
  program
    .command('select')
    .description('Find graph nodes relevant to a task description')
    .requiredOption('--task <description>', 'Natural-language task description')
    .option('--limit <n>', 'Maximum nodes to return', '5')
    .action(async (options: { task: string; limit: string }) => {
      try {
        const yggRoot = await findYggRoot(process.cwd());
        const graph = await loadGraph(yggRoot);
        const limit = parseInt(options.limit, 10);
        if (isNaN(limit) || limit < 1) {
          process.stderr.write('Error: --limit must be a positive integer\n');
          process.exit(1);
        }
        const results = selectNodes(graph, options.task, limit);
        process.stdout.write(yamlStringify(results));
      } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
      }
    });
}
