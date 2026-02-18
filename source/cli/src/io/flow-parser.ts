import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { FlowDef } from '../model/types.js';
import { readArtifacts } from './artifact-reader.js';

export async function parseFlow(flowDir: string, flowYamlPath: string): Promise<FlowDef> {
  const content = await readFile(flowYamlPath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw.name || typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error(`flow.yaml at ${flowYamlPath}: missing or empty 'name'`);
  }

  const nodes = raw.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error(`flow.yaml at ${flowYamlPath}: 'nodes' must be a non-empty array`);
  }

  const nodePaths = (nodes as unknown[]).filter((n): n is string => typeof n === 'string');
  if (nodePaths.length === 0) {
    throw new Error(`flow.yaml at ${flowYamlPath}: 'nodes' must contain string node paths`);
  }
  const knowledge = Array.isArray(raw.knowledge)
    ? (raw.knowledge as unknown[]).filter((k): k is string => typeof k === 'string')
    : undefined;

  const artifacts = await readArtifacts(flowDir, ['flow.yaml']);

  return {
    name: (raw.name as string).trim(),
    nodes: nodePaths,
    knowledge,
    artifacts,
  };
}
