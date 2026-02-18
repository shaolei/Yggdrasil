import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLastCommitTimestamp } from '../../../src/utils/git.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(__dirname, '../../fixtures/sample-project');

describe('git', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  describe('getLastCommitTimestamp', () => {
    it('returns timestamp when git log succeeds with valid output', () => {
      vi.mocked(execSync).mockReturnValue('1730000000\n' as unknown as Buffer);
      const result = getLastCommitTimestamp(FIXTURE_ROOT, '.yggdrasil/config.yaml');
      expect(result).toBe(1730000000);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git log -1 --format=%ct'),
        expect.any(Object),
      );
    });

    it('returns null when git log returns non-numeric output', () => {
      vi.mocked(execSync).mockReturnValue('' as unknown as Buffer);
      const result = getLastCommitTimestamp(FIXTURE_ROOT, 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when parseInt produces NaN', () => {
      vi.mocked(execSync).mockReturnValue('not-a-number' as unknown as Buffer);
      const result = getLastCommitTimestamp(FIXTURE_ROOT, 'some/path');
      expect(result).toBeNull();
    });

    it('returns null when execSync throws (not a git repo or path has no commits)', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });
      const result = getLastCommitTimestamp('/tmp/not-a-repo', 'any/path');
      expect(result).toBeNull();
    });

    it('normalizes Windows-style paths to forward slashes', () => {
      vi.mocked(execSync).mockReturnValue('1730000000\n' as unknown as Buffer);
      getLastCommitTimestamp(FIXTURE_ROOT, 'path\\with\\backslashes');
      expect(execSync).toHaveBeenCalledWith(
        expect.stringMatching(/path\/with\/backslashes/),
        expect.any(Object),
      );
    });
  });
});
