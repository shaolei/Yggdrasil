import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadGraph } from '../../src/core/graph-loader.js';
import { detectDrift } from '../../src/core/drift-detector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PROJECT = path.join(__dirname, '../fixtures/sample-project');
const CLI_ROOT = path.join(__dirname, '../..');
const BIN_PATH = path.join(CLI_ROOT, 'dist', 'bin.js');
const distExists = existsSync(BIN_PATH);

function supportsAbsorbAllOption(): boolean {
  if (!distExists) return false;
  const help = spawnSync('node', [BIN_PATH, 'drift', '--help'], {
    cwd: FIXTURE_PROJECT,
    encoding: 'utf-8',
  });
  return help.status === 0 && help.stdout.includes('--absorb-all');
}

describe('drift-pipeline', () => {
  it('load fixture graph → detectDrift → verify correct states per node', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const report = await detectDrift(graph);

    expect(report.totalChecked).toBeGreaterThan(0);
    expect(report.entries.length).toBe(report.totalChecked);

    // OK: auth/auth-api has matching hash
    const okEntry = report.entries.find((e) => e.nodePath === 'auth/auth-api' && e.status === 'ok');
    expect(okEntry).toBeDefined();

    // DRIFT: orders/order-service has different hash
    const driftEntry = report.entries.find(
      (e) => e.nodePath === 'orders/order-service' && e.status === 'drift',
    );
    expect(driftEntry).toBeDefined();
    expect(driftEntry?.details).toContain('Changed files:');

    // users/missing-service: missing or unmaterialized (no drift state + file does not exist)
    const missingEntry = report.entries.find((e) => e.nodePath === 'users/missing-service');
    expect(missingEntry).toBeDefined();
    expect(['missing', 'unmaterialized']).toContain(missingEntry!.status);

    // UNMATERIALIZED or OK: auth/auth-api (we have drift state for it)
    const authApiEntry = report.entries.find((e) => e.nodePath === 'auth/auth-api');
    expect(authApiEntry).toBeDefined();

    // Counts match
    expect(report.driftCount).toBe(report.entries.filter((e) => e.status === 'drift').length);
    expect(report.missingCount).toBe(report.entries.filter((e) => e.status === 'missing').length);
    expect(report.unmaterializedCount).toBe(
      report.entries.filter((e) => e.status === 'unmaterialized').length,
    );
    expect(report.okCount).toBe(report.entries.filter((e) => e.status === 'ok').length);
  });

  it('drift --absorb-all reports JSON summary fields', async () => {
    if (!supportsAbsorbAllOption()) return;

    const fixtureCopyRoot = await mkdtemp(path.join(tmpdir(), 'ygg-drift-absorb-'));
    const copiedFixture = path.join(fixtureCopyRoot, 'sample-project');
    await cp(FIXTURE_PROJECT, copiedFixture, { recursive: true });

    try {
      const result = spawnSync('node', [BIN_PATH, 'drift', '--absorb-all', '--format', 'json'], {
        cwd: copiedFixture,
        encoding: 'utf-8',
      });

      const payload = JSON.parse(result.stdout);
      expect(payload).toHaveProperty('absorbedNodes');
      expect(payload).toHaveProperty('skippedMissingNodes');
      expect(payload).toHaveProperty('failedNodes');
      expect(Array.isArray(payload.absorbedNodes)).toBe(true);
      expect(Array.isArray(payload.skippedMissingNodes)).toBe(true);
      expect(Array.isArray(payload.failedNodes)).toBe(true);
    } finally {
      await rm(fixtureCopyRoot, { recursive: true, force: true });
    }
  });

  it('drift --absorb-all exits 1 when absorb attempt fails', async () => {
    if (!supportsAbsorbAllOption()) return;

    const projectRoot = await mkdtemp(path.join(tmpdir(), 'ygg-drift-fail-'));
    const yggRoot = path.join(projectRoot, '.yggdrasil');
    const modelDir = path.join(yggRoot, 'model');
    const nodeDir = path.join(modelDir, 'svc', 'failing');

    await mkdir(nodeDir, { recursive: true });
    await writeFile(
      path.join(yggRoot, 'config.yaml'),
      'name: X\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\ntags: []',
    );
    await writeFile(path.join(modelDir, 'svc', 'node.yaml'), 'name: svc\ntype: module\n');
    await writeFile(
      path.join(nodeDir, 'node.yaml'),
      'name: failing\ntype: service\nmapping:\n  type: file\n  path: src/not-existing.ts\n',
    );
    await writeFile(path.join(nodeDir, 'description.md'), 'x');
    await writeFile(path.join(yggRoot, '.drift-state'), '{}\n');

    try {
      const result = spawnSync('node', [BIN_PATH, 'drift', '--absorb-all', '--format', 'json'], {
        cwd: projectRoot,
        encoding: 'utf-8',
      });

      expect(result.status).toBe(1);
      if (result.stdout.trim()) {
        const payload = JSON.parse(result.stdout);
        expect(payload.failedNodes?.length ?? 0).toBeGreaterThan(0);
      }
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('drift --format <invalid> returns validation error', async () => {
    if (!distExists) return;

    const result = spawnSync('node', [BIN_PATH, 'drift', '--format', 'yaml'], {
      cwd: FIXTURE_PROJECT,
      encoding: 'utf-8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/unknown option|--format/);
  });
});
