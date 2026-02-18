import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { loadGraph } from '../../../src/core/graph-loader.js';
import { detectDrift, syncDriftState } from '../../../src/core/drift-detector.js';
import {
  readDriftState,
  writeDriftState,
  getCanonicalHash,
} from '../../../src/io/drift-state-store.js';
import { hashString } from '../../../src/utils/hash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PROJECT = path.join(__dirname, '../../fixtures/sample-project');

describe('drift-detector', () => {
  describe('detectDrift', () => {
    it('reports OK when file hash matches stored hash', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      const report = await detectDrift(graph);

      const okEntry = report.entries.find(
        (e) => e.nodePath === 'auth/auth-api' && e.status === 'ok',
      );
      expect(okEntry).toBeDefined();
      expect(okEntry?.mappingPaths).toContain('src/auth/auth.controller.ts');
    });

    it('reports DRIFT when file hash differs from stored hash', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      const report = await detectDrift(graph);

      const driftEntry = report.entries.find(
        (e) => e.nodePath === 'orders/order-service' && e.status === 'drift',
      );
      expect(driftEntry).toBeDefined();
      expect(driftEntry?.details).toContain('Changed files:');
    });

    it('reports MISSING or UNMATERIALIZED when mapped file does not exist', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      const missingNode = graph.nodes.get('users/missing-service');
      expect(missingNode).toBeDefined();
      expect(missingNode?.meta.mapping).toBeDefined();

      const report = await detectDrift(graph);
      const entry = report.entries.find((e) => e.nodePath === 'users/missing-service');
      expect(entry).toBeDefined();
      expect(['missing', 'unmaterialized']).toContain(entry!.status);
      if (entry!.status === 'missing') {
        expect(entry!.details).toContain('do not exist');
      } else {
        expect(entry!.details).toContain('No drift state recorded');
      }
    });

    it('reports UNMATERIALIZED when no drift-state entry and files do not exist', async () => {
      const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-unmaterialized');
      const yggRoot = path.join(tmpDir, '.yggdrasil');
      const modelDir = path.join(yggRoot, 'model');
      const nodeDir = path.join(modelDir, 'svc', 'new-service');

      await mkdir(nodeDir, { recursive: true });
      await writeFile(
        path.join(yggRoot, 'config.yaml'),
        'name: Test\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\nknowledge_categories: []\ntags: []',
      );
      await writeFile(path.join(modelDir, 'svc', 'node.yaml'), 'name: Svc\ntype: module\n');
      await writeFile(
        path.join(nodeDir, 'node.yaml'),
        'name: NewService\ntype: service\nmapping:\n  paths:\n    - src/svc/new.ts',
      );
      await writeFile(path.join(yggRoot, '.drift-state'), '{}');

      try {
        const graph = await loadGraph(tmpDir);
        const report = await detectDrift(graph);
        const unmaterializedEntry = report.entries.find(
          (e) => e.nodePath === 'svc/new-service' && e.status === 'unmaterialized',
        );
        expect(unmaterializedEntry).toBeDefined();
        expect(unmaterializedEntry?.details).toContain('No drift state recorded');
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('multi-file mapping: flags drift if any file changed', async () => {
      const tmpDir = path.join(__dirname, '../../fixtures/drift-multi-file');
      const yggRoot = path.join(tmpDir, '.yggdrasil');
      const srcDir = path.join(tmpDir, 'src');
      const nodeDir = path.join(yggRoot, 'model', 'multi', 'multi-service');

      await mkdir(path.join(srcDir, 'multi'), { recursive: true });
      await mkdir(nodeDir, { recursive: true });

      await writeFile(
        path.join(yggRoot, 'config.yaml'),
        'name: Test\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\nknowledge_categories: []\ntags: []',
      );
      await writeFile(
        path.join(yggRoot, 'model', 'multi', 'node.yaml'),
        'name: Multi\ntype: module\n',
      );
      await writeFile(
        path.join(nodeDir, 'node.yaml'),
        `name: MultiService
type: service
mapping:
  paths:
    - src/multi/file-a.ts
    - src/multi/file-b.ts
`,
      );
      await writeFile(path.join(srcDir, 'multi', 'file-a.ts'), '// file-a');
      await writeFile(path.join(srcDir, 'multi', 'file-b.ts'), '// file-b');

      const hashA = hashString('// file-a');
      const hashB = hashString('// file-b');
      const digestInput = `src/multi/file-a.ts:${hashA}\nsrc/multi/file-b.ts:${hashB}`;
      const combinedHash = hashString(digestInput);

      await writeFile(path.join(yggRoot, '.drift-state'), `multi/multi-service: ${combinedHash}\n`);

      const graph = await loadGraph(tmpDir);
      const reportBefore = await detectDrift(graph);
      const okBefore = reportBefore.entries.find((e) => e.nodePath === 'multi/multi-service');
      expect(okBefore?.status).toBe('ok');

      await writeFile(path.join(srcDir, 'multi', 'file-a.ts'), '// file-a MODIFIED');

      const reportAfter = await detectDrift(graph);
      const driftAfter = reportAfter.entries.find((e) => e.nodePath === 'multi/multi-service');
      expect(driftAfter?.status).toBe('drift');
      expect(driftAfter?.details).toContain('Changed files:');
    });

    it('--node filter: only checks specified node', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      const report = await detectDrift(graph, 'orders/order-service');

      expect(report.entries).toHaveLength(1);
      expect(report.entries[0].nodePath).toBe('orders/order-service');
    });

    it('checks nodes with mapping', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      const report = await detectDrift(graph);
      const withMapping = report.entries.filter((e) =>
        [
          'auth/auth-api',
          'orders/order-service',
          'users/user-repo',
          'users/missing-service',
        ].includes(e.nodePath),
      );
      expect(withMapping.length).toBeGreaterThan(0);
    });
  });

  describe('syncDriftState', () => {
    it('updates .drift-state with current hashes', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      const orderServicePath = path.join(FIXTURE_PROJECT, 'src/orders/order.service.ts');

      const reportBefore = await detectDrift(graph);
      const driftBefore = reportBefore.entries.find((e) => e.nodePath === 'orders/order-service');
      expect(driftBefore?.status).toBe('drift');

      await syncDriftState(graph, 'orders/order-service');

      const driftState = await readDriftState(graph.rootPath);
      const storedEntry = driftState['orders/order-service'];
      expect(storedEntry).toBeDefined();

      const storedHash = getCanonicalHash(storedEntry!);
      const currentContent = await readFile(orderServicePath, 'utf-8');
      const fileHash = hashString(currentContent);
      const expectedHash = hashString(`src/orders/order.service.ts:${fileHash}`);
      expect(storedHash).toBe(expectedHash);

      const reportAfter = await detectDrift(graph);
      const okAfter = reportAfter.entries.find((e) => e.nodePath === 'orders/order-service');
      expect(okAfter?.status).toBe('ok');

      const { writeDriftState } = await import('../../../src/io/drift-state-store.js');
      driftState['orders/order-service'] = {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        files: {
          'src/orders/order.service.ts':
            '0000000000000000000000000000000000000000000000000000000000000000',
        },
      };
      await writeDriftState(graph.rootPath, driftState);
    });

    it('throws when node not found', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      await expect(syncDriftState(graph, 'nonexistent/node')).rejects.toThrow('Node not found');
    });

    it('throws when node has no mapping', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      await expect(syncDriftState(graph, 'auth')).rejects.toThrow('Node has no mapping');
    });
  });

  it('skips nodes without mapping during drift detection', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const report = await detectDrift(graph);

    const nodePathsChecked = report.entries.map((e) => e.nodePath);
    expect(nodePathsChecked).not.toContain('auth');
    expect(nodePathsChecked).not.toContain('orders');
    expect(nodePathsChecked).not.toContain('users');
  });

  it('diagnoseChangedFiles returns single path for file mapping when drift', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-file-diagnose');
    const yggRoot = path.join(tmpDir, '.yggdrasil');
    const srcDir = path.join(tmpDir, 'src');
    await mkdir(path.join(yggRoot, 'model', 'svc', 'file-svc'), { recursive: true });
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(yggRoot, 'config.yaml'),
      'name: T\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\nknowledge_categories: []\ntags: []',
    );
    await writeFile(path.join(yggRoot, 'model', 'svc', 'node.yaml'), 'name: S\ntype: module\n');
      await writeFile(
        path.join(yggRoot, 'model', 'svc', 'file-svc', 'node.yaml'),
        'name: FS\ntype: service\nmapping:\n  paths:\n    - src/file.ts',
      );
    await writeFile(path.join(srcDir, 'file.ts'), 'v1');

    const fileHash = hashString('v1');
    const aggregateHash = hashString(`src/file.ts:${fileHash}`);
    await writeDriftState(yggRoot, {
      'svc/file-svc': { hash: aggregateHash, files: { 'src/file.ts': fileHash } },
    });

    try {
      const graph = await loadGraph(tmpDir);
      const reportBefore = await detectDrift(graph);
      const okBefore = reportBefore.entries.find((e) => e.nodePath === 'svc/file-svc');
      expect(okBefore?.status).toBe('ok');

      await writeFile(path.join(srcDir, 'file.ts'), 'v2');

      const reportAfter = await detectDrift(graph);
      const driftAfter = reportAfter.entries.find((e) => e.nodePath === 'svc/file-svc');
      expect(driftAfter?.status).toBe('drift');
      expect(driftAfter?.details).toContain('src/file.ts');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports drift with deleted file in directory mapping', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-deleted');
    const yggRoot = path.join(tmpDir, '.yggdrasil');
    const srcDir = path.join(tmpDir, 'src', 'dir');
    await mkdir(path.join(yggRoot, 'model', 'svc', 'dir-svc'), { recursive: true });
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, 'a.ts'), 'a');
    await writeFile(
      path.join(yggRoot, 'config.yaml'),
      'name: T\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\nknowledge_categories: []\ntags: []',
    );
    await writeFile(path.join(yggRoot, 'model', 'svc', 'node.yaml'), 'name: S\ntype: module\n');
    await writeFile(
      path.join(yggRoot, 'model', 'svc', 'dir-svc', 'node.yaml'),
      'name: DS\ntype: service\nmapping:\n  paths:\n    - src/dir',
    );

    const hashA = hashString('a');
    const dirDigest = `a.ts:${hashA}\ndeleted.ts:${hashA}`;
    const origHash = hashString(dirDigest);
    await writeDriftState(yggRoot, {
      'svc/dir-svc': {
        hash: origHash,
        files: { 'src/dir/a.ts': hashA, 'src/dir/deleted.ts': hashA },
      },
    });

    try {
      const graph = await loadGraph(tmpDir);
      const report = await detectDrift(graph);
      const entry = report.entries.find((e) => e.nodePath === 'svc/dir-svc');
      expect(entry?.status).toBe('drift');
      expect(entry?.details).toContain('deleted');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports drift when no drift-state but files exist', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-no-state');
    const yggRoot = path.join(tmpDir, '.yggdrasil');
    const srcDir = path.join(tmpDir, 'src');
    await mkdir(path.join(yggRoot, 'model', 'svc', 'exist-svc'), { recursive: true });
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, 'exist.ts'), 'content');
    await writeFile(
      path.join(yggRoot, 'config.yaml'),
      'name: T\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\nknowledge_categories: []\ntags: []',
    );
    await writeFile(path.join(yggRoot, 'model', 'svc', 'node.yaml'), 'name: S\ntype: module\n');
    await writeFile(
      path.join(yggRoot, 'model', 'svc', 'exist-svc', 'node.yaml'),
      'name: ES\ntype: service\nmapping:\n  paths:\n    - src/exist.ts',
    );
    await writeFile(path.join(yggRoot, '.drift-state'), '{}');

    try {
      const graph = await loadGraph(tmpDir);
      const report = await detectDrift(graph);
      const entry = report.entries.find((e) => e.nodePath === 'svc/exist-svc');
      expect(entry?.status).toBe('drift');
      expect(entry?.details).toContain('files exist');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports drift when stored entry has no files (legacy format)', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-legacy');
    const yggRoot = path.join(tmpDir, '.yggdrasil');
    const srcDir = path.join(tmpDir, 'src');
    await mkdir(path.join(yggRoot, 'model', 'svc', 'legacy-svc'), { recursive: true });
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(yggRoot, 'config.yaml'),
      'name: T\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\nknowledge_categories: []\ntags: []',
    );
    await writeFile(path.join(yggRoot, 'model', 'svc', 'node.yaml'), 'name: S\ntype: module\n');
    await writeFile(
      path.join(yggRoot, 'model', 'svc', 'legacy-svc', 'node.yaml'),
      'name: L\ntype: service\nmapping:\n  paths:\n    - src/legacy.ts',
    );
    await writeFile(path.join(srcDir, 'legacy.ts'), 'content');

    const contentHash = hashString('content');
    const aggregateHash = hashString(`src/legacy.ts:${contentHash}`);
    await writeDriftState(yggRoot, { 'svc/legacy-svc': { hash: aggregateHash } });

    try {
      const graph = await loadGraph(tmpDir);
      const report = await detectDrift(graph);
      const entry = report.entries.find((e) => e.nodePath === 'svc/legacy-svc');
      expect(entry?.status).toBe('ok');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('diagnoseChangedFiles returns empty when perFileHashes throws (catch block)', async () => {
    const hashModule = await import('../../../src/utils/hash.js');
    const perFileHashesSpy = vi.spyOn(hashModule, 'perFileHashes').mockRejectedValueOnce(new Error('read failed'));

    const tmpDir = path.join(__dirname, '../../fixtures/tmp-drift-catch');
    const yggRoot = path.join(tmpDir, '.yggdrasil');
    const srcDir = path.join(tmpDir, 'src');
    await mkdir(path.join(yggRoot, 'model', 'svc', 'catch-svc'), { recursive: true });
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, 'file.ts'), 'v1');
    await writeFile(
      path.join(yggRoot, 'config.yaml'),
      'name: T\nnode_types: [service]\nartifacts:\n  responsibility:\n    required: always\n    description: x\nknowledge_categories: []\ntags: []',
    );
    await writeFile(path.join(yggRoot, 'model', 'svc', 'node.yaml'), 'name: S\ntype: module\n');
    await writeFile(
      path.join(yggRoot, 'model', 'svc', 'catch-svc', 'node.yaml'),
      'name: CS\ntype: service\nmapping:\n  paths:\n    - src/file.ts',
    );

    const hashV1 = hashString('v1');
    const origHash = hashString(`src/file.ts:${hashV1}`);
    await writeDriftState(yggRoot, {
      'svc/catch-svc': {
        hash: origHash,
        files: { 'src/file.ts': hashV1 },
      },
    });

    try {
      await writeFile(path.join(srcDir, 'file.ts'), 'v2');
      const graph = await loadGraph(tmpDir);
      const report = await detectDrift(graph);
      const entry = report.entries.find((e) => e.nodePath === 'svc/catch-svc');
      expect(entry).toBeDefined();
      expect(entry?.status).toBe('drift');
      expect(entry?.details).toContain('File(s) modified');
    } finally {
      perFileHashesSpy.mockRestore();
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports correct totals in drift summary', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const report = await detectDrift(graph);

    expect(report.totalChecked).toBe(report.entries.length);
    expect(report.okCount).toBe(report.entries.filter((e) => e.status === 'ok').length);
    expect(report.driftCount).toBe(report.entries.filter((e) => e.status === 'drift').length);
    expect(report.missingCount).toBe(report.entries.filter((e) => e.status === 'missing').length);
    expect(report.unmaterializedCount).toBe(
      report.entries.filter((e) => e.status === 'unmaterialized').length,
    );
  });
});
