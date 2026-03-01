import { Command } from 'commander';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { findYggRoot } from '../utils/paths.js';

export function registerTagsCommand(program: Command): void {
  program
    .command('tags')
    .description('List aspect tags (directory names in aspects/)')
    .action(async () => {
      try {
        const yggRoot = await findYggRoot(process.cwd());
        const aspectsPath = path.join(yggRoot, 'aspects');

        const entries = await readdir(aspectsPath, { withFileTypes: true });
        const tags = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort((a, b) => a.localeCompare(b));

        for (const tag of tags) {
          process.stdout.write(`${tag}\n`);
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          process.stderr.write(
            `Error: No .yggdrasil/aspects/ directory found. Run 'yg init' first.\n`,
          );
        } else {
          process.stderr.write(`Error: ${(error as Error).message}\n`);
        }
        process.exit(1);
      }
    });
}
