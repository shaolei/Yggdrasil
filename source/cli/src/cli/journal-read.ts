import { Command } from 'commander';
import { findYggRoot } from '../utils/paths.js';
import { readJournal } from '../io/journal-store.js';

export function registerJournalReadCommand(program: Command): void {
  program
    .command('journal-read')
    .description('List pending journal entries')
    .action(async () => {
      try {
        const projectRoot = process.cwd();
        const yggRoot = await findYggRoot(projectRoot);
        const entries = await readJournal(yggRoot);

        if (entries.length === 0) {
          process.stdout.write('Session journal: empty (clean state)\n');
          return;
        }

        process.stdout.write(`Session journal (${entries.length} entries):\n\n`);
        for (const e of entries) {
          const date = e.at.slice(0, 19).replace('T', ' ');
          const target = e.target ? ` ${e.target}` : '';
          process.stdout.write(`[${date}]${target}\n  ${e.note}\n\n`);
        }
      } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
      }
    });
}
