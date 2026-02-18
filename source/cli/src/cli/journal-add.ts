import { Command } from 'commander';
import { findYggRoot } from '../utils/paths.js';
import { appendJournalEntry, readJournal } from '../io/journal-store.js';

export function registerJournalAddCommand(program: Command): void {
  program
    .command('journal-add')
    .description('Add a note to the session journal')
    .requiredOption('--note <text>', 'Note content')
    .option('--target <node-path>', 'Node path this note relates to')
    .action(async (options: { note: string; target?: string }) => {
      try {
        const projectRoot = process.cwd();
        const yggRoot = await findYggRoot(projectRoot);
        await appendJournalEntry(yggRoot, options.note, options.target);
        const entries = await readJournal(yggRoot);
        process.stdout.write(`Note added to journal (${entries.length} entries total)\n`);
      } catch (error) {
        process.stderr.write(`Error: ${(error as Error).message}\n`);
        process.exit(1);
      }
    });
}
