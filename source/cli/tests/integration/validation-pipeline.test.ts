import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraph } from '../../src/core/graph-loader.js';
import { validate } from '../../src/core/validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PROJECT = path.join(__dirname, '../fixtures/sample-project');
const BROKEN_RELATION_FIXTURE = path.join(__dirname, '../fixtures/sample-project-broken-relation');

describe('validation-pipeline', () => {
  it('load fixture graph → validate → 0 issues', async () => {
    const graph = await loadGraph(FIXTURE_PROJECT);
    const result = await validate(graph);

    expect(result.nodesScanned).toBeGreaterThan(0);
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('load broken-relation fixture → validate → correct issues found', async () => {
    const graph = await loadGraph(BROKEN_RELATION_FIXTURE);
    const result = await validate(graph);

    expect(result.issues.length).toBeGreaterThan(0);
    const relationError = result.issues.find(
      (i) => i.rule === 'broken-relation' && i.message.includes('nonexistent/missing-target'),
    );
    expect(relationError).toBeDefined();
    expect(relationError?.nodePath).toBe('orders/broken-service');
  });
});
