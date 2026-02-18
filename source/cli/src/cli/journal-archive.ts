import { Command } from 'commander';
import { findYggRoot } from '../utils/paths.js';
import { archiveJournal } from '../io/journal-store.js';

export function registerJournalArchiveCommand(program: Command): void {
  program
    .command('journal-archive')
    .description('Archive journal after consolidating notes to graph')
    .action(async () => {
      try {
        const projectRoot = process.cwd();
        const yggRoot = await findYggRoot(projectRoot);
        const result = await archiveJournal(yggRoot);

        if (!result) {
          process.stdout.write('No active journal - nothing to archive.\n');
          return;
        }

        process.stdout.write(
          `Archived journal (${result.entryCount} entries) -> journals-archive/${result.archiveName}\n`,
        );
      } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
      }
    });
}
