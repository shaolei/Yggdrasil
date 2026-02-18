import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import path from 'node:path';
import type { JournalEntry } from '../model/types.js';

const JOURNAL_FILE = '.journal.yaml';
const ARCHIVE_DIR = 'journals-archive';

export async function readJournal(yggRoot: string): Promise<JournalEntry[]> {
  const filePath = path.join(yggRoot, JOURNAL_FILE);
  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = parseYaml(content) as { entries?: JournalEntry[] };
    const entries = raw.entries ?? [];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export async function appendJournalEntry(
  yggRoot: string,
  note: string,
  target?: string,
): Promise<JournalEntry> {
  const entries = await readJournal(yggRoot);
  const at = new Date().toISOString();
  const entry: JournalEntry = target ? { at, target, note } : { at, note };

  entries.push(entry);

  const filePath = path.join(yggRoot, JOURNAL_FILE);
  const content = stringifyYaml({ entries });
  await writeFile(filePath, content, 'utf-8');

  return entry;
}

export async function archiveJournal(
  yggRoot: string,
): Promise<{ archiveName: string; entryCount: number } | null> {
  const journalPath = path.join(yggRoot, JOURNAL_FILE);
  try {
    await access(journalPath);
  } catch {
    return null;
  }

  const entries = await readJournal(yggRoot);
  if (entries.length === 0) return null;

  const archiveDir = path.join(yggRoot, ARCHIVE_DIR);
  await mkdir(archiveDir, { recursive: true });

  const now = new Date();
  const timestamp =
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, '0')}` +
    `${String(now.getUTCDate()).padStart(2, '0')}` +
    `-` +
    `${String(now.getUTCHours()).padStart(2, '0')}` +
    `${String(now.getUTCMinutes()).padStart(2, '0')}` +
    `${String(now.getUTCSeconds()).padStart(2, '0')}`;
  const archiveName = `.journal.${timestamp}.yaml`;
  const archivePath = path.join(archiveDir, archiveName);

  await rename(journalPath, archivePath);

  return { archiveName, entryCount: entries.length };
}
