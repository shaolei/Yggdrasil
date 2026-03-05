import { describe, it, expect } from 'vitest';
import { validate } from '../../../src/core/validator.js';
import type { Graph, GraphNode, YggConfig } from '../../../src/model/types.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeConfig(overrides?: Partial<YggConfig>): YggConfig {
  return {
    name: 'test',
    stack: {},
    standards: '',
    node_types: [{ name: 'service' }],
    artifacts: {},
    ...overrides,
  };
}

function makeGraph(nodes: Map<string, GraphNode>, rootPath: string): Graph {
  return {
    config: makeConfig(),
    nodes,
    aspects: [],
    flows: [],
    schemas: [
      { schemaType: 'node' },
      { schemaType: 'aspect' },
      { schemaType: 'flow' },
    ],
    rootPath,
  };
}

function makeNode(
  nodePath: string,
  overrides?: Partial<GraphNode['meta']>,
): GraphNode {
  return {
    path: nodePath,
    meta: {
      name: nodePath.split('/').pop() ?? nodePath,
      type: 'service',
      ...overrides,
    },
    artifacts: [],
    children: [],
    parent: null,
  };
}

describe('anchor validation', () => {
  it('W014: warns when anchor not found in source files', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-anchor-w014');
    const srcDir = path.join(tmpDir, 'src');
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, 'service.ts'), 'export function otherFunction() {}', 'utf-8');

    const rootPath = path.join(tmpDir, '.yggdrasil');
    await mkdir(rootPath, { recursive: true });

    const nodes = new Map<string, GraphNode>();
    nodes.set('my-service', makeNode('my-service', {
      aspects: ['my-aspect'],
      anchors: { 'my-aspect': ['missingFunction'] },
      mapping: { paths: ['src/service.ts'] },
    }));

    const graph = makeGraph(nodes, rootPath);
    graph.aspects = [{ id: 'my-aspect', name: 'My Aspect', artifacts: [] }];

    const result = await validate(graph);
    const w014 = result.issues.filter((i) => i.code === 'W014');
    expect(w014).toHaveLength(1);
    expect(w014[0].rule).toBe('anchor-not-found');
    expect(w014[0].message).toContain('missingFunction');
    expect(w014[0].nodePath).toBe('my-service');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('W014: no warning when anchor IS found in source file', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-anchor-found');
    const srcDir = path.join(tmpDir, 'src');
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, 'service.ts'),
      'export function lockTeamCollection() { return "FOR UPDATE"; }',
      'utf-8',
    );

    const rootPath = path.join(tmpDir, '.yggdrasil');
    await mkdir(rootPath, { recursive: true });

    const nodes = new Map<string, GraphNode>();
    nodes.set('my-service', makeNode('my-service', {
      aspects: ['locking'],
      anchors: { 'locking': ['lockTeamCollection', 'FOR UPDATE'] },
      mapping: { paths: ['src/service.ts'] },
    }));

    const graph = makeGraph(nodes, rootPath);
    graph.aspects = [{ id: 'locking', name: 'Locking', artifacts: [] }];

    const result = await validate(graph);
    const w014 = result.issues.filter((i) => i.code === 'W014');
    expect(w014).toHaveLength(0);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('W014: searches recursively in directory mappings', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-anchor-dir');
    const srcDir = path.join(tmpDir, 'src', 'sub');
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      path.join(srcDir, 'deep.ts'),
      'const MAX_RETRIES = 3;',
      'utf-8',
    );

    const rootPath = path.join(tmpDir, '.yggdrasil');
    await mkdir(rootPath, { recursive: true });

    const nodes = new Map<string, GraphNode>();
    nodes.set('my-service', makeNode('my-service', {
      aspects: ['retry'],
      anchors: { 'retry': ['MAX_RETRIES'] },
      mapping: { paths: ['src/'] },
    }));

    const graph = makeGraph(nodes, rootPath);
    graph.aspects = [{ id: 'retry', name: 'Retry', artifacts: [] }];

    const result = await validate(graph);
    const w014 = result.issues.filter((i) => i.code === 'W014');
    expect(w014).toHaveLength(0);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('E019: error when anchors key references aspect not in node aspects', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-anchor-e019');
    await mkdir(tmpDir, { recursive: true });

    const rootPath = path.join(tmpDir, '.yggdrasil');
    await mkdir(rootPath, { recursive: true });

    const nodes = new Map<string, GraphNode>();
    nodes.set('my-service', makeNode('my-service', {
      aspects: ['real-aspect'],
      anchors: { 'nonexistent-aspect': ['somePattern'] },
    }));

    const graph = makeGraph(nodes, rootPath);
    graph.aspects = [{ id: 'real-aspect', name: 'Real', artifacts: [] }];

    const result = await validate(graph);
    const e019 = result.issues.filter((i) => i.code === 'E019');
    expect(e019).toHaveLength(1);
    expect(e019[0].rule).toBe('invalid-anchor-ref');
    expect(e019[0].message).toContain('nonexistent-aspect');
    expect(e019[0].nodePath).toBe('my-service');

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('skips nodes without anchors', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-anchor-skip');
    await mkdir(tmpDir, { recursive: true });

    const rootPath = path.join(tmpDir, '.yggdrasil');
    await mkdir(rootPath, { recursive: true });

    const nodes = new Map<string, GraphNode>();
    nodes.set('no-anchors', makeNode('no-anchors', {
      aspects: ['some-aspect'],
    }));

    const graph = makeGraph(nodes, rootPath);
    graph.aspects = [{ id: 'some-aspect', name: 'Some', artifacts: [] }];

    const result = await validate(graph);
    const anchorIssues = result.issues.filter(
      (i) => i.code === 'W014' || i.code === 'E019',
    );
    expect(anchorIssues).toHaveLength(0);

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('W014: skips when node has no mapping', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-anchor-nomap');
    await mkdir(tmpDir, { recursive: true });

    const rootPath = path.join(tmpDir, '.yggdrasil');
    await mkdir(rootPath, { recursive: true });

    const nodes = new Map<string, GraphNode>();
    nodes.set('no-mapping', makeNode('no-mapping', {
      aspects: ['my-aspect'],
      anchors: { 'my-aspect': ['somePattern'] },
    }));

    const graph = makeGraph(nodes, rootPath);
    graph.aspects = [{ id: 'my-aspect', name: 'My', artifacts: [] }];

    const result = await validate(graph);
    const w014 = result.issues.filter((i) => i.code === 'W014');
    expect(w014).toHaveLength(0);

    await rm(tmpDir, { recursive: true, force: true });
  });
});
