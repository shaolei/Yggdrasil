import { describe, it, expect } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJournal, appendJournalEntry, archiveJournal } from '../../../src/io/journal-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('journal-store', () => {
  it('readJournal: file missing returns []', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-read');
    await mkdir(tmpDir, { recursive: true });

    const entries = await readJournal(tmpDir);

    expect(entries).toEqual([]);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('readJournal: valid YAML returns entries', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-valid');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(
      path.join(tmpDir, '.journal.yaml'),
      `
entries:
  - at: "2026-01-15T10:00:00.000Z"
    note: First note
  - at: "2026-01-15T11:00:00.000Z"
    target: orders/order-service
    note: Second note
`,
      'utf-8',
    );

    const entries = await readJournal(tmpDir);

    expect(entries).toHaveLength(2);
    expect(entries[0].note).toBe('First note');
    expect(entries[0].target).toBeUndefined();
    expect(entries[1].target).toBe('orders/order-service');
    expect(entries[1].note).toBe('Second note');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('readJournal: malformed YAML returns []', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-malformed');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, '.journal.yaml'), 'invalid: yaml: [[[', 'utf-8');

    const entries = await readJournal(tmpDir);

    expect(entries).toEqual([]);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('readJournal: entries not array returns []', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-not-array');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, '.journal.yaml'), 'entries: {}', 'utf-8');

    const entries = await readJournal(tmpDir);

    expect(entries).toEqual([]);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('readJournal: entries null uses default empty array', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-null');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, '.journal.yaml'), 'entries: null', 'utf-8');

    const entries = await readJournal(tmpDir);

    expect(entries).toEqual([]);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('appendJournalEntry: creates file and adds entry', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-append');
    await mkdir(tmpDir, { recursive: true });

    const entry = await appendJournalEntry(tmpDir, 'Test note');

    expect(entry.note).toBe('Test note');
    expect(entry.at).toBeDefined();
    expect(entry.target).toBeUndefined();

    const entries = await readJournal(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].note).toBe('Test note');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('appendJournalEntry: with target adds target', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-target');
    await mkdir(tmpDir, { recursive: true });

    await appendJournalEntry(tmpDir, 'Fix auth', 'auth/auth-api');

    const entries = await readJournal(tmpDir);
    expect(entries[0].target).toBe('auth/auth-api');
    expect(entries[0].note).toBe('Fix auth');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('appendJournalEntry: appends to existing', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-append-multi');
    await mkdir(tmpDir, { recursive: true });

    await appendJournalEntry(tmpDir, 'First');
    await appendJournalEntry(tmpDir, 'Second');

    const entries = await readJournal(tmpDir);
    expect(entries).toHaveLength(2);
    expect(entries[0].note).toBe('First');
    expect(entries[1].note).toBe('Second');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('archiveJournal: file missing returns null', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-archive-none');
    await mkdir(tmpDir, { recursive: true });

    const result = await archiveJournal(tmpDir);

    expect(result).toBeNull();

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('archiveJournal: empty entries returns null', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-archive-empty');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, '.journal.yaml'), 'entries: []', 'utf-8');

    const result = await archiveJournal(tmpDir);

    expect(result).toBeNull();

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('archiveJournal: moves to journals-archive with timestamp', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-journal-archive');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(
      path.join(tmpDir, '.journal.yaml'),
      'entries:\n  - at: "2026-01-15T10:00:00.000Z"\n    note: x',
      'utf-8',
    );

    const result = await archiveJournal(tmpDir);

    expect(result).not.toBeNull();
    expect(result!.archiveName).toMatch(/^\.journal\.\d{8}-\d{6}\.yaml$/);
    expect(result!.entryCount).toBe(1);

    const archivePath = path.join(tmpDir, 'journals-archive', result!.archiveName);
    const content = await readFile(archivePath, 'utf-8');
    expect(content).toContain('note: x');

    await rm(tmpDir, { recursive: true, force: true });
  });
});
