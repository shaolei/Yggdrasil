import { describe, it, expect } from 'vitest';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '../../../src/templates');

describe('templates', () => {
  it('templates directory exists with platform and rules', async () => {
    const files = await readdir(TEMPLATES_DIR);
    expect(files).toContain('platform.ts');
    expect(files).toContain('rules.ts');
  });
});
