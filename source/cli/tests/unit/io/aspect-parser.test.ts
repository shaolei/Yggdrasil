import { describe, it, expect } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAspect } from '../../../src/io/aspect-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(
  __dirname,
  '../../fixtures/sample-project/.yggdrasil/aspects/audit-logging',
);

describe('aspect-parser', () => {
  it('parses valid aspect.yaml correctly', async () => {
    const aspect = await parseAspect(path.join(FIXTURE_DIR), path.join(FIXTURE_DIR, 'aspect.yaml'));

    expect(aspect.name).toBe('Audit Logging');
    expect(aspect.tag).toBe('requires-audit');
    expect(aspect.artifacts).toBeDefined();
  });

  it('throws when name is missing', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-aspect');
    await mkdir(tmpDir, { recursive: true });
    const badPath = path.join(tmpDir, 'aspect.yaml');
    await writeFile(
      badPath,
      `
tag: some-tag
`,
      'utf-8',
    );

    await expect(parseAspect(tmpDir, badPath)).rejects.toThrow("missing or empty 'name'");

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when tag is missing', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-aspect');
    await mkdir(tmpDir, { recursive: true });
    const badPath = path.join(tmpDir, 'aspect.yaml');
    await writeFile(
      badPath,
      `
name: Test Aspect
`,
      'utf-8',
    );

    await expect(parseAspect(tmpDir, badPath)).rejects.toThrow("missing or empty 'tag'");

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('defaults optional fields when missing', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-aspect');
    await mkdir(tmpDir, { recursive: true });
    const aspectPath = path.join(tmpDir, 'aspect.yaml');
    await writeFile(
      aspectPath,
      `
name: Minimal Aspect
tag: minimal-tag
`,
      'utf-8',
    );

    const aspect = await parseAspect(tmpDir, aspectPath);
    expect(aspect.name).toBe('Minimal Aspect');
    expect(aspect.tag).toBe('minimal-tag');
    expect(aspect.artifacts).toEqual([]);

    await rm(tmpDir, { recursive: true, force: true });
  });
});
