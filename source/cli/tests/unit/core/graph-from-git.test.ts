import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { loadGraphFromRef } from '../../../src/core/graph-from-git.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('graph-from-git', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when not a git repo', async () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const result = await loadGraphFromRef('/tmp/empty');

    expect(result).toBeNull();
    expect(execSync).toHaveBeenCalledWith(
      'git rev-parse HEAD',
      expect.objectContaining({ cwd: '/tmp/empty' }),
    );
  });

  it('returns null when ref does not exist', async () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('bad revision');
    });

    const result = await loadGraphFromRef('/tmp/repo', 'nonexistent-ref');

    expect(result).toBeNull();
    expect(execSync).toHaveBeenCalledWith('git rev-parse nonexistent-ref', expect.any(Object));
  });

  it('returns null when git archive fails', async () => {
    vi.mocked(execSync)
      .mockImplementationOnce(() => Buffer.from('abc123'))
      .mockImplementationOnce(() => {
        throw new Error('path not found in archive');
      });

    const result = await loadGraphFromRef('/tmp/repo');

    expect(result).toBeNull();
  });

  it('returns null when tar extract fails', async () => {
    vi.mocked(execSync)
      .mockImplementationOnce(() => Buffer.from('abc123'))
      .mockImplementationOnce(() => Buffer.from(''))
      .mockImplementationOnce(() => {
        throw new Error('tar failed');
      });

    const result = await loadGraphFromRef('/tmp/repo');

    expect(result).toBeNull();
  });

  it('returns null when loadGraph throws after extract', async () => {
    const path = await import('node:path');
    const { mkdirSync, writeFileSync } = await import('node:fs');

    vi.mocked(execSync)
      .mockImplementationOnce(() => Buffer.from('abc123'))
      .mockImplementationOnce(() => Buffer.from(''))
      .mockImplementationOnce((cmd: string) => {
        const match = cmd.match(/-C "([^"]+)"/);
        const extractDir = match?.[1];
        if (extractDir) {
          const yggRoot = path.join(extractDir, '.yggdrasil');
          mkdirSync(path.join(yggRoot, 'model'), { recursive: true });
          writeFileSync(path.join(yggRoot, 'config.yaml'), 'invalid: yaml: [[[');
        }
        return Buffer.from('');
      });

    const result = await loadGraphFromRef('/tmp/repo');
    expect(result).toBeNull();
  });

  it('returns graph when git archive and extract succeed', async () => {
    const path = await import('node:path');
    const { mkdirSync, writeFileSync } = await import('node:fs');

    vi.mocked(execSync)
      .mockImplementationOnce(() => Buffer.from('abc123'))
      .mockImplementationOnce(() => Buffer.from(''))
      .mockImplementationOnce((cmd: string) => {
        const match = cmd.match(/-C "([^"]+)"/);
        const extractDir = match?.[1];
        if (extractDir) {
          const yggRoot = path.join(extractDir, '.yggdrasil');
          mkdirSync(path.join(yggRoot, 'model', 'svc'), { recursive: true });
          writeFileSync(
            path.join(yggRoot, 'config.yaml'),
            'name: T\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\nknowledge_categories: []\ntags: []',
          );
          writeFileSync(
            path.join(yggRoot, 'model', 'svc', 'node.yaml'),
            'name: S\ntype: service\n',
          );
        }
        return Buffer.from('');
      });

    const result = await loadGraphFromRef('/tmp/repo');
    expect(result).not.toBeNull();
    expect(result?.nodes.size).toBeGreaterThan(0);
  });
});
