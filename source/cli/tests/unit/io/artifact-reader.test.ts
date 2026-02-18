import { describe, it, expect } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readArtifacts } from '../../../src/io/artifact-reader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_BASE = path.join(__dirname, '../../fixtures/sample-project/.yggdrasil/model');

describe('artifact-reader', () => {
  it('reads all .md files from a directory', async () => {
    const dir = path.join(FIXTURE_BASE, 'orders');
    const artifacts = await readArtifacts(dir);

    expect(artifacts.length).toBeGreaterThanOrEqual(1);
    expect(artifacts.some((a) => a.filename.endsWith('.md'))).toBe(true);
  });

  it('excludes node.yaml by default', async () => {
    const dir = path.join(FIXTURE_BASE, 'orders');
    const artifacts = await readArtifacts(dir);

    expect(artifacts.every((a) => a.filename !== 'node.yaml')).toBe(true);
  });

  it('excludes specified files when passed', async () => {
    const dir = path.join(
      __dirname,
      '../../fixtures/sample-project/.yggdrasil/flows/checkout-flow',
    );
    const artifacts = await readArtifacts(dir, ['flow.yaml']);

    expect(artifacts.every((a) => a.filename !== 'flow.yaml')).toBe(true);
    expect(artifacts.some((a) => a.filename === 'sequence.md')).toBe(true);
  });

  it('reads only includeFiles when specified', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-artifacts');
    await mkdir(tmpDir, { recursive: true });

    await writeFile(path.join(tmpDir, 'readme.md'), '# Readme', 'utf-8');
    await writeFile(path.join(tmpDir, 'other.md'), '# Other', 'utf-8');
    await writeFile(path.join(tmpDir, 'notes.txt'), 'Notes', 'utf-8');

    const artifacts = await readArtifacts(tmpDir, [], ['readme.md']);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].filename).toBe('readme.md');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns artifacts sorted by filename', async () => {
    const dir = path.join(FIXTURE_BASE, 'orders');
    const artifacts = await readArtifacts(dir);

    const filenames = artifacts.map((a) => a.filename);
    const sorted = [...filenames].sort((a, b) => a.localeCompare(b));
    expect(filenames).toEqual(sorted);
  });

  it('reads yaml and md artifacts from node directory', async () => {
    const dir = path.join(FIXTURE_BASE, 'auth/auth-api');
    const artifacts = await readArtifacts(dir);

    expect(artifacts.length).toBeGreaterThanOrEqual(1);
    const openapi = artifacts.find((a) => a.filename === 'openapi.yaml');
    expect(openapi).toBeDefined();
    expect(openapi!.content).toContain('openapi');
  });
});
