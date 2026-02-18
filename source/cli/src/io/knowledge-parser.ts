import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { KnowledgeItem } from '../model/types.js';
import { readArtifacts } from './artifact-reader.js';

export type KnowledgeScope = 'global' | { tags: string[] } | { nodes: string[] };

export async function parseKnowledge(
  knowledgeDir: string,
  knowledgeYamlPath: string,
  category: string,
  relativePath: string,
): Promise<KnowledgeItem> {
  const content = await readFile(knowledgeYamlPath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw.name || typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error(`knowledge.yaml at ${knowledgeYamlPath}: missing or empty 'name'`);
  }

  const scope = parseScope(raw.scope, knowledgeYamlPath);

  const artifacts = await readArtifacts(knowledgeDir, ['knowledge.yaml']);

  return {
    name: (raw.name as string).trim(),
    scope,
    category,
    path: relativePath,
    artifacts,
  };
}

function parseScope(raw: unknown, filePath: string): KnowledgeItem['scope'] {
  if (raw === 'global') {
    return 'global';
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.tags)) {
      const tags = (obj.tags as unknown[]).filter((t): t is string => typeof t === 'string');
      if (tags.length === 0) {
        throw new Error(`knowledge.yaml at ${filePath}: scope.tags must be a non-empty array`);
      }
      return { tags };
    }
    if (Array.isArray(obj.nodes)) {
      const nodes = (obj.nodes as unknown[]).filter((n): n is string => typeof n === 'string');
      if (nodes.length === 0) {
        throw new Error(`knowledge.yaml at ${filePath}: scope.nodes must be a non-empty array`);
      }
      return { nodes };
    }
  }

  throw new Error(`knowledge.yaml at ${filePath}: invalid 'scope' value`);
}
