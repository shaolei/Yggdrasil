import { describe, it, expect } from 'vitest';
import { formatContextYaml, formatFullContent } from '../../../src/formatters/context-text.js';
import type { ContextMapOutput } from '../../../src/model/types.js';
import { parse as yamlParse } from 'yaml';

function makeMinimalOutput(): ContextMapOutput {
  return {
    meta: { tokenCount: 100, budgetStatus: 'ok', breakdown: { own: 50, hierarchy: 20, aspects: 10, flows: 10, dependencies: 10, total: 100 } },
    project: 'TestProject',
    glossary: {
      aspects: {
        deterministic: {
          name: 'Determinism',
          files: ['aspects/deterministic/content.md'],
        },
      },
      flows: {},
    },
    node: {
      path: 'test/node',
      name: 'TestNode',
      type: 'library',
      mappings: ['src/test.ts'],
      aspects: [{ id: 'deterministic' }],
      flows: [],
      files: ['model/test/node/responsibility.md'],
    },
    hierarchy: [],
    dependencies: [],
  };
}

describe('formatContextYaml', () => {
  it('produces valid YAML', () => {
    const output = formatContextYaml(makeMinimalOutput());
    const parsed = yamlParse(output);
    expect(parsed.node.path).toBe('test/node');
  });

  it('includes meta section with breakdown', () => {
    const output = formatContextYaml(makeMinimalOutput());
    const parsed = yamlParse(output);
    expect(parsed.meta['token-count']).toBe(100);
    expect(parsed.meta['budget-status']).toBe('ok');
    expect(parsed.meta.breakdown).toBeDefined();
    expect(parsed.meta.breakdown.own).toBe(50);
    expect(parsed.meta.breakdown.total).toBe(100);
  });

  it('includes project name', () => {
    const output = formatContextYaml(makeMinimalOutput());
    const parsed = yamlParse(output);
    expect(parsed.project).toBe('TestProject');
  });

  it('includes node with aspects, mappings, and files', () => {
    const output = formatContextYaml(makeMinimalOutput());
    const parsed = yamlParse(output);
    expect(parsed.node.name).toBe('TestNode');
    expect(parsed.node.type).toBe('library');
    expect(parsed.node.mappings).toEqual(['src/test.ts']);
    expect(parsed.node.aspects[0].id).toBe('deterministic');
    expect(parsed.node.files).toContain('model/test/node/responsibility.md');
  });

  it('includes glossary with aspect files', () => {
    const output = formatContextYaml(makeMinimalOutput());
    const parsed = yamlParse(output);
    expect(parsed.glossary.aspects.deterministic.name).toBe('Determinism');
    expect(parsed.glossary.aspects.deterministic.files).toContain(
      'aspects/deterministic/content.md',
    );
  });

  it('omits hierarchy and dependencies when empty', () => {
    const output = formatContextYaml(makeMinimalOutput());
    const parsed = yamlParse(output);
    expect(parsed.hierarchy).toBeUndefined();
    expect(parsed.dependencies).toBeUndefined();
  });

  it('includes hierarchy when non-empty', () => {
    const data = makeMinimalOutput();
    data.hierarchy = [{ path: 'parent', name: 'Parent', type: 'module', aspects: [], files: ['model/parent/responsibility.md'] }];
    const output = formatContextYaml(data);
    const parsed = yamlParse(output);
    expect(parsed.hierarchy).toHaveLength(1);
    expect(parsed.hierarchy[0].path).toBe('parent');
    expect(parsed.hierarchy[0].files).toContain('model/parent/responsibility.md');
  });

  it('renders dependency with hierarchy, aspects, and files', () => {
    const data = makeMinimalOutput();
    data.dependencies = [{
      path: 'dep/svc',
      name: 'DepService',
      type: 'service',
      relation: 'uses',
      consumes: ['doThing'],
      aspects: ['deterministic'],
      hierarchy: [{
        path: 'dep',
        name: 'Dep',
        type: 'module',
        aspects: ['deterministic'],
        files: ['model/dep/responsibility.md'],
      }],
      files: ['model/dep/svc/responsibility.md', 'model/dep/svc/interface.md'],
    }];

    const output = formatContextYaml(data);
    const parsed = yamlParse(output);
    expect(parsed.dependencies[0].path).toBe('dep/svc');
    expect(parsed.dependencies[0].hierarchy[0].path).toBe('dep');
    expect(parsed.dependencies[0].files).toHaveLength(2);
  });

  it('renders flow in glossary with path as key', () => {
    const data = makeMinimalOutput();
    data.node.flows = [{
      path: 'checkout',
      aspects: ['deterministic'],
    }];
    data.glossary.flows = {
      checkout: {
        name: 'Checkout Flow',
        participants: ['test/node'],
        aspects: ['deterministic'],
        files: ['flows/checkout/description.md'],
      },
    };

    const output = formatContextYaml(data);
    const parsed = yamlParse(output);
    expect(parsed.glossary.flows.checkout.name).toBe('Checkout Flow');
    expect(parsed.glossary.flows.checkout.participants).toContain('test/node');
  });

  it('renders aspect with implies', () => {
    const data = makeMinimalOutput();
    data.glossary.aspects['cli-command-contract'] = {
      name: 'CLI Command Contract',
      implies: ['deterministic'],
      files: [
        'aspects/cli-command-contract/content.md',
      ],
    };

    const output = formatContextYaml(data);
    const parsed = yamlParse(output);
    expect(parsed.glossary.aspects['cli-command-contract'].implies).toEqual(['deterministic']);
  });

  it('glossary appears before node in raw output', () => {
    const output = formatContextYaml(makeMinimalOutput());
    const glossaryIdx = output.indexOf('glossary:');
    const nodeIdx = output.indexOf('node:');
    expect(glossaryIdx).toBeGreaterThan(-1);
    expect(nodeIdx).toBeGreaterThan(-1);
    expect(glossaryIdx).toBeLessThan(nodeIdx);
  });

  it('meta appears after node in raw output', () => {
    const output = formatContextYaml(makeMinimalOutput());
    const nodeIdx = output.indexOf('node:');
    const metaIdx = output.indexOf('meta:');
    expect(metaIdx).toBeGreaterThan(nodeIdx);
  });

  it('YAML comments are present in raw output', () => {
    const data = makeMinimalOutput();
    data.hierarchy = [{ path: 'parent', name: 'Parent', type: 'module', aspects: [] }];
    data.dependencies = [{
      path: 'dep/svc',
      name: 'DepService',
      type: 'service',
      relation: 'uses',
      aspects: [],
      hierarchy: [],
      files: ['model/dep/svc/responsibility.md'],
    }];
    const output = formatContextYaml(data);
    expect(output).toContain('# Glossary:');
    expect(output).toContain('# Target node:');
    expect(output).toContain('# Hierarchy:');
    expect(output).toContain('# Dependencies:');
  });
});

describe('formatFullContent', () => {
  it('returns empty string for no files', () => {
    const output = formatFullContent([]);
    expect(output).toBe('');
  });

  it('wraps file contents in XML-style tags after --- separator', () => {
    const output = formatFullContent([
      { path: 'model/test/node/responsibility.md', content: 'Test content' },
    ]);
    expect(output).toContain('---');
    expect(output).toContain('<model/test/node/responsibility.md>');
    expect(output).toContain('Test content');
    expect(output).toContain('</model/test/node/responsibility.md>');
  });

  it('renders multiple files in order', () => {
    const output = formatFullContent([
      { path: 'model/a/responsibility.md', content: 'First' },
      { path: 'aspects/x/content.md', content: 'Second' },
    ]);
    const firstIdx = output.indexOf('<model/a/responsibility.md>');
    const secondIdx = output.indexOf('<aspects/x/content.md>');
    expect(firstIdx).toBeLessThan(secondIdx);
  });
});
