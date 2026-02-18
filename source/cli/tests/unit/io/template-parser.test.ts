import { describe, it, expect } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTemplate } from '../../../src/io/template-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('template-parser', () => {
  it('parses valid template with all fields', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-template');
    await mkdir(tmpDir, { recursive: true });
    const templatePath = path.join(tmpDir, 'service.yaml');
    await writeFile(
      templatePath,
      `
node_type: service
suggested_artifacts:
  - responsibility
  - interface
guidance: |
  Services handle business logic.
`,
      'utf-8',
    );

    const t = await parseTemplate(templatePath);

    expect(t.nodeType).toBe('service');
    expect(t.suggestedArtifacts).toEqual(['responsibility', 'interface']);
    expect(t.guidance).toContain('Services handle business logic');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('parses minimal valid template', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-template-minimal');
    await mkdir(tmpDir, { recursive: true });
    const templatePath = path.join(tmpDir, 'module.yaml');
    await writeFile(
      templatePath,
      `
node_type: module
`,
      'utf-8',
    );

    const t = await parseTemplate(templatePath);

    expect(t.nodeType).toBe('module');
    expect(t.suggestedArtifacts).toBeUndefined();
    expect(t.guidance).toBeUndefined();

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when node_type is missing', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-template-no-type');
    await mkdir(tmpDir, { recursive: true });
    const templatePath = path.join(tmpDir, 'bad.yaml');
    await writeFile(
      templatePath,
      `
suggested_artifacts: [responsibility]
`,
      'utf-8',
    );

    await expect(parseTemplate(templatePath)).rejects.toThrow("missing or empty 'node_type'");

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when node_type is empty', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-template-empty-type');
    await mkdir(tmpDir, { recursive: true });
    const templatePath = path.join(tmpDir, 'bad.yaml');
    await writeFile(
      templatePath,
      `
node_type: "   "
`,
      'utf-8',
    );

    await expect(parseTemplate(templatePath)).rejects.toThrow("missing or empty 'node_type'");

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('filters suggested_artifacts to strings only', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-template-artifacts');
    await mkdir(tmpDir, { recursive: true });
    const templatePath = path.join(tmpDir, 'service.yaml');
    await writeFile(
      templatePath,
      `
node_type: service
suggested_artifacts: [responsibility, 123, "interface"]
`,
      'utf-8',
    );

    const t = await parseTemplate(templatePath);
    expect(t.suggestedArtifacts).toEqual(['responsibility', 'interface']);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('trims node_type', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-template-trim');
    await mkdir(tmpDir, { recursive: true });
    const templatePath = path.join(tmpDir, 'service.yaml');
    await writeFile(
      templatePath,
      `
node_type: "  service  "
`,
      'utf-8',
    );

    const t = await parseTemplate(templatePath);
    expect(t.nodeType).toBe('service');

    await rm(tmpDir, { recursive: true, force: true });
  });
});
