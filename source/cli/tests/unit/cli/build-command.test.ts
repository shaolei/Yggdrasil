import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(__dirname, '../../..');
const BIN_PATH = path.join(CLI_ROOT, 'dist', 'bin.js');
const FIXTURE = path.join(CLI_ROOT, 'tests', 'fixtures', 'sample-project');

async function withFixtureCopy<T>(fn: (cwd: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(path.join(tmpdir(), 'ygg-build-command-'));
  await cp(FIXTURE, root, { recursive: true });
  return fn(root);
}

describe('build-context command (unit-like CLI contract)', () => {
  it('requires --node', async () => {
    await withFixtureCopy(async (cwd) => {
      const result = spawnSync('node', [BIN_PATH, 'build-context'], {
        cwd,
        encoding: 'utf-8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/required option|--node/);
    });
  });

  it('build-context --node prints to stdout', async () => {
    await withFixtureCopy(async (cwd) => {
      const nodePath = 'orders/order-service';
      const result = spawnSync('node', [BIN_PATH, 'build-context', '--node', nodePath], {
        cwd,
        encoding: 'utf-8',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('## Global');
      expect(result.stdout).toContain('## Hierarchy');
    });
  });

  it('build-context --node prints context package to stdout', async () => {
    await withFixtureCopy(async (cwd) => {
      const result = spawnSync(
        'node',
        [BIN_PATH, 'build-context', '--node', 'orders/order-service'],
        {
          cwd,
          encoding: 'utf-8',
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('## Global');
      expect(result.stdout).toContain('## Dependencies');

      const buildDir = path.join(cwd, '.yggdrasil', '_build');
      const exists = await access(buildDir).then(
        () => true,
        () => false,
      );
      expect(exists).toBe(false);
    });
  });

  it('build-context --node <bad> returns missing-node error', async () => {
    await withFixtureCopy(async (cwd) => {
      const result = spawnSync('node', [BIN_PATH, 'build-context', '--node', 'does/not/exist'], {
        cwd,
        encoding: 'utf-8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Node not found');
    });
  });
});
