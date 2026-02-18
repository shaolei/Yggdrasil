import { describe, it, expect } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKnowledge } from '../../../src/io/knowledge-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('knowledge-parser', () => {
  it('parses valid knowledge.yaml with scope global', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-knowledge');
    await mkdir(tmpDir, { recursive: true });
    const knowledgeYaml = path.join(tmpDir, 'knowledge.yaml');
    await writeFile(
      knowledgeYaml,
      `
name: Example Decision
scope: global
`,
      'utf-8',
    );

    const item = await parseKnowledge(tmpDir, knowledgeYaml, 'decisions', 'decisions/001-example');

    expect(item.name).toBe('Example Decision');
    expect(item.scope).toBe('global');
    expect(item.category).toBe('decisions');
    expect(item.path).toBe('decisions/001-example');
    expect(item.artifacts).toBeDefined();

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('parses valid knowledge.yaml with scope tags', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-knowledge-tags');
    await mkdir(tmpDir, { recursive: true });
    const knowledgeYaml = path.join(tmpDir, 'knowledge.yaml');
    await writeFile(
      knowledgeYaml,
      `
name: Tag-scoped
scope:
  tags: [requires-auth, public-api]
`,
      'utf-8',
    );

    const item = await parseKnowledge(tmpDir, knowledgeYaml, 'patterns', 'patterns/auth-pattern');

    expect(item.name).toBe('Tag-scoped');
    expect(item.scope).toEqual({ tags: ['requires-auth', 'public-api'] });

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('parses valid knowledge.yaml with scope nodes', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-knowledge-nodes');
    await mkdir(tmpDir, { recursive: true });
    const knowledgeYaml = path.join(tmpDir, 'knowledge.yaml');
    await writeFile(
      knowledgeYaml,
      `
name: Node-scoped
scope:
  nodes: [orders/order-service, auth/auth-api]
`,
      'utf-8',
    );

    const item = await parseKnowledge(
      tmpDir,
      knowledgeYaml,
      'invariants',
      'invariants/order-invariant',
    );

    expect(item.name).toBe('Node-scoped');
    expect(item.scope).toEqual({
      nodes: ['orders/order-service', 'auth/auth-api'],
    });

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when name is missing', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-knowledge-no-name');
    await mkdir(tmpDir, { recursive: true });
    const knowledgeYaml = path.join(tmpDir, 'knowledge.yaml');
    await writeFile(
      knowledgeYaml,
      `
scope: global
`,
      'utf-8',
    );

    await expect(parseKnowledge(tmpDir, knowledgeYaml, 'decisions', 'decisions/x')).rejects.toThrow(
      "missing or empty 'name'",
    );

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when scope.tags is empty array', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-knowledge-empty-tags');
    await mkdir(tmpDir, { recursive: true });
    const knowledgeYaml = path.join(tmpDir, 'knowledge.yaml');
    await writeFile(
      knowledgeYaml,
      `
name: Test
scope:
  tags: []
`,
      'utf-8',
    );

    await expect(parseKnowledge(tmpDir, knowledgeYaml, 'decisions', 'decisions/x')).rejects.toThrow(
      'scope.tags must be a non-empty array',
    );

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when scope.nodes is empty array', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-knowledge-empty-nodes');
    await mkdir(tmpDir, { recursive: true });
    const knowledgeYaml = path.join(tmpDir, 'knowledge.yaml');
    await writeFile(
      knowledgeYaml,
      `
name: Test
scope:
  nodes: []
`,
      'utf-8',
    );

    await expect(parseKnowledge(tmpDir, knowledgeYaml, 'decisions', 'decisions/x')).rejects.toThrow(
      'scope.nodes must be a non-empty array',
    );

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when scope is invalid', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-knowledge-invalid-scope');
    await mkdir(tmpDir, { recursive: true });
    const knowledgeYaml = path.join(tmpDir, 'knowledge.yaml');
    await writeFile(
      knowledgeYaml,
      `
name: Test
scope: invalid
`,
      'utf-8',
    );

    await expect(parseKnowledge(tmpDir, knowledgeYaml, 'decisions', 'decisions/x')).rejects.toThrow(
      "invalid 'scope' value",
    );

    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws when scope is missing', async () => {
    const tmpDir = path.join(__dirname, '../../fixtures/tmp-knowledge-no-scope');
    await mkdir(tmpDir, { recursive: true });
    const knowledgeYaml = path.join(tmpDir, 'knowledge.yaml');
    await writeFile(
      knowledgeYaml,
      `
name: Test
`,
      'utf-8',
    );

    await expect(parseKnowledge(tmpDir, knowledgeYaml, 'decisions', 'decisions/x')).rejects.toThrow(
      "invalid 'scope' value",
    );

    await rm(tmpDir, { recursive: true, force: true });
  });
});
