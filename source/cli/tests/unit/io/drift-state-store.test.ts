import { describe, it, expect } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readDriftState,
  writeDriftState,
  getCanonicalHash,
  getFileHashes,
} from '../../../src/io/drift-state-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('drift-state-store', () => {
  it('reads existing drift state (v2.2 flat format)', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-read');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(
      path.join(tmpDir, '.drift-state'),
      'orders/order-service: abc123def456\nauth/auth-api: fff789\n',
      'utf-8',
    );

    const state = await readDriftState(tmpDir);

    expect(state['orders/order-service']).toBe('abc123def456');
    expect(state['auth/auth-api']).toBe('fff789');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty when file does not exist', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-none');
    await mkdir(tmpDir, { recursive: true });

    const state = await readDriftState(tmpDir);

    expect(Object.keys(state)).toHaveLength(0);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writeDriftState creates/updates file correctly', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-write');
    await mkdir(tmpDir, { recursive: true });

    const state: Record<string, string> = {
      'test/node': 'abc123',
    };

    await writeDriftState(tmpDir, state);

    const content = await readFile(path.join(tmpDir, '.drift-state'), 'utf-8');
    expect(content).toContain('test/node');
    expect(content).toContain('abc123');

    const readBack = await readDriftState(tmpDir);
    expect(readBack['test/node']).toBe('abc123');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('handles drift state with empty object', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-empty');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, '.drift-state'), '{}\n', 'utf-8');

    const state = await readDriftState(tmpDir);
    expect(Object.keys(state)).toHaveLength(0);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('handles drift-state file with no entries key', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-no-entries');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, '.drift-state'), 'some_other_field: true\n', 'utf-8');

    const state = await readDriftState(tmpDir);
    expect(Object.keys(state)).toHaveLength(0);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('handles completely empty drift-state file', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-empty-file');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, '.drift-state'), '', 'utf-8');

    const state = await readDriftState(tmpDir);
    expect(Object.keys(state)).toHaveLength(0);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('getCanonicalHash: string entry returns as-is', () => {
    expect(getCanonicalHash('abc123def456')).toBe('abc123def456');
  });

  it('getCanonicalHash: DriftNodeState returns entry.hash', () => {
    expect(getCanonicalHash({ hash: 'sha256xyz', files: { 'a.ts': 'h1' } })).toBe('sha256xyz');
  });

  it('getFileHashes: string entry returns undefined', () => {
    expect(getFileHashes('abc123')).toBeUndefined();
  });

  it('getFileHashes: DriftNodeState returns entry.files', () => {
    const files = { 'src/a.ts': 'h1', 'src/b.ts': 'h2' };
    expect(getFileHashes({ hash: 'x', files })).toEqual(files);
  });

  it('readDriftState: v2.2 object format', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-v22');
    await mkdir(tmpDir, { recursive: true });
    await writeFile(
      path.join(tmpDir, '.drift-state'),
      `orders/order-service:
  hash: 28f3c41611792a2e0cc8a4fdffc9b2294aa49d46
  files:
    src/orders/order.service.ts: 28f3c41611792a2e0cc8a4fdffc9b2294aa49d46
auth/auth-api: flat-hash-abc
`,
      'utf-8',
    );

    const state = await readDriftState(tmpDir);

    expect(state['orders/order-service']).toEqual({
      hash: '28f3c41611792a2e0cc8a4fdffc9b2294aa49d46',
      files: {
        'src/orders/order.service.ts': '28f3c41611792a2e0cc8a4fdffc9b2294aa49d46',
      },
    });
    expect(state['auth/auth-api']).toBe('flat-hash-abc');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('write and read roundtrip', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-roundtrip');
    await mkdir(tmpDir, { recursive: true });

    const state: Record<string, string> = {
      'multi/svc': 'sha256abc123',
      'other/node': 'sha256def456',
    };

    await writeDriftState(tmpDir, state);
    const readBack = await readDriftState(tmpDir);
    expect(readBack['multi/svc']).toBe('sha256abc123');
    expect(readBack['other/node']).toBe('sha256def456');

    await rm(tmpDir, { recursive: true, force: true });
  });
});
