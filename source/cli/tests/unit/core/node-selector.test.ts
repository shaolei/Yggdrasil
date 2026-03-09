import { describe, it, expect } from 'vitest';
import { selectNodes } from '../../../src/core/node-selector.js';
import { loadGraph } from '../../../src/core/graph-loader.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PROJECT = path.join(__dirname, '../../fixtures/sample-project');

describe('selectNodes', () => {
  it('returns nodes matching task keywords', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const results = selectNodes(graph, 'order lifecycle management', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node).toBe('orders/order-service');
  });

  it('scores responsibility.md higher than other artifacts', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const results = selectNodes(graph, 'authentication module', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node).toBe('auth');
  });

  it('returns empty array when no keywords match', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const results = selectNodes(graph, 'quantum blockchain singularity', 5);
    expect(results).toEqual([]);
  });

  it('respects limit parameter', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const results = selectNodes(graph, 'order', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('sorts by score descending', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const results = selectNodes(graph, 'order service', 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('scores interface.md with x2 weight', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    // "cancelOrder" and "refund" only appear in interface.md of order-service
    const results = selectNodes(graph, 'cancel refund', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node).toBe('orders/order-service');
  });

  it('includes node name in results', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const results = selectNodes(graph, 'order lifecycle', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBeDefined();
    expect(typeof results[0].name).toBe('string');
  });

  it('returns empty array for empty task string', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const results = selectNodes(graph, '', 5);
    expect(results).toEqual([]);
  });

  it('returns empty array for stop-words-only task', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const results = selectNodes(graph, 'the is a', 5);
    expect(results).toEqual([]);
  });

  describe('S2 flow-based fallback', () => {
    it('falls back to flow matching when no nodes match directly', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      // "checkout" doesn't appear in any node responsibility/artifacts, but IS in the flow name/description
      const results = selectNodes(graph, 'checkout process', 5);
      expect(results.length).toBeGreaterThan(0);
      const nodePaths = results.map((r) => r.node);
      expect(nodePaths).toContain('orders/order-service');
    });

    it('returns empty when neither S1 nor S2 match', async () => {
      const graph = await loadGraph(FIXTURE_PROJECT);
      const results = selectNodes(graph, 'quantum blockchain', 5);
      expect(results).toEqual([]);
    });
  });
});
