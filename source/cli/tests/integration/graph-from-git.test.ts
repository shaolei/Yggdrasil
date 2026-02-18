import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphFromRef } from '../../src/core/graph-from-git.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../..');

describe('graph-from-git integration', () => {
  it('loads graph from real git repo', async () => {
    const result = await loadGraphFromRef(REPO_ROOT, 'HEAD');
    expect(result).not.toBeNull();
    expect(result!.nodes.size).toBeGreaterThan(0);
    expect(result!.config.name).toBeDefined();
  });
});
