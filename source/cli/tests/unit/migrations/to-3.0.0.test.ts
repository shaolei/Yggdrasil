import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { migrateTo3 } from '../../../src/migrations/to-3.0.0.js';

const TMP_DIR = path.join(import.meta.dirname, '__tmp_migrate3');

describe('to-3.0.0 migration', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });
  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it('removes artifacts section from config', async () => {
    await writeFile(
      path.join(TMP_DIR, 'yg-config.yaml'),
      `version: "2.12.0"\nname: "Test"\nartifacts:\n  responsibility.md:\n    required: always\n    description: "test"\n`,
    );
    const result = await migrateTo3(TMP_DIR);
    const content = await readFile(path.join(TMP_DIR, 'yg-config.yaml'), 'utf-8');
    expect(content).not.toContain('artifacts:');
    expect(content).toContain('name: Test');
    expect(result.actions).toContain('Removed artifacts section from yg-config.yaml');
  });

  it('warns about custom artifacts', async () => {
    await writeFile(
      path.join(TMP_DIR, 'yg-config.yaml'),
      `version: "2.12.0"\nname: "Test"\nartifacts:\n  responsibility.md:\n    required: always\n    description: "test"\n  security-analysis.md:\n    required: never\n    description: "custom"\n`,
    );
    const result = await migrateTo3(TMP_DIR);
    expect(result.warnings.some((w) => w.includes('security-analysis.md'))).toBe(true);
  });

  it('no-ops if artifacts section already absent', async () => {
    await writeFile(
      path.join(TMP_DIR, 'yg-config.yaml'),
      `version: "2.12.0"\nname: "Test"\n`,
    );
    const result = await migrateTo3(TMP_DIR);
    expect(result.actions.length).toBe(0);
  });
});
