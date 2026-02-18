import { Command } from 'commander';
import chalk from 'chalk';
import { loadGraph } from '../core/graph-loader.js';
import { syncDriftState } from '../core/drift-detector.js';

export function registerDriftSyncCommand(program: Command): void {
  program
    .command('drift-sync')
    .description('Record current file hash after resolving drift')
    .requiredOption('--node <path>', 'Node path to sync')
    .action(async (options: { node: string }) => {
      try {
        const graph = await loadGraph(process.cwd());
        const nodePath = options.node.trim().replace(/\/$/, '');
        const { previousHash, currentHash } = await syncDriftState(graph, nodePath);
        process.stdout.write(chalk.green(`Synchronized: ${nodePath}\n`));
        process.stdout.write(
          `  Hash: ${previousHash ? previousHash.slice(0, 8) : 'none'} -> ${currentHash.slice(0, 8)}\n`,
        );
      } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
      }
    });
}
