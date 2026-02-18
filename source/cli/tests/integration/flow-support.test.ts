import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadGraph } from '../../src/core/graph-loader.js';
import { validate } from '../../src/core/validator.js';
import { buildContext } from '../../src/core/context-builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PROJECT = path.join(__dirname, '../fixtures/sample-project');
const CLI_ROOT = path.join(__dirname, '../..');

describe('flow-support integration (v2.2)', () => {
  it('scenario 1: flows load from flows/ directory', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);

    expect(graph.flows).toHaveLength(1);
    expect(graph.flows[0].name).toBe('Checkout Flow');
    expect(graph.flows[0].nodes).toContain('auth/auth-api');
    expect(graph.flows[0].nodes).toContain('orders/order-service');
  });

  it('scenario 2: status counting finds flows', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);

    expect(graph.flows.length).toBe(1);
  });

  it('scenario 3: check validation passes for valid fixture', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const result = await validate(graph);

    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('scenario 4: build-context includes flow artifacts through Flows layer', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const pkg = await buildContext(graph, 'orders/order-service');

    const flowLayers = pkg.layers.filter((layer) => layer.type === 'flows');
    expect(flowLayers.length).toBeGreaterThan(0);
    expect(flowLayers.some((l) => l.label.includes('Checkout'))).toBe(true);
  });

  it('scenario 5: flow references model nodes', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const checkoutFlow = graph.flows.find((f) => f.name === 'Checkout Flow');

    expect(checkoutFlow).toBeDefined();
    for (const nodePath of checkoutFlow!.nodes) {
      expect(graph.nodes.has(nodePath)).toBe(true);
    }
  });

  it('scenario 6: v2.2 uses FlowDef and graph.flows', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    expect(graph.flows).toBeDefined();
    expect(Array.isArray(graph.flows)).toBe(true);
  });

  it('tree output shows model hierarchy', () => {
    const distBin = path.join(CLI_ROOT, 'dist', 'bin.js');
    const result = spawnSync('node', [distBin, 'tree'], {
      cwd: FIXTURE_PROJECT,
      encoding: 'utf-8',
    });

    if (result.error?.message?.includes('ENOENT')) {
      return;
    }

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('auth');
    expect(result.stdout).toContain('orders');
    expect(result.stdout).toContain('order-service');
  });
});
