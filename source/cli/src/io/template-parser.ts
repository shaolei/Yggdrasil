import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { TemplateDef } from '../model/types.js';

export async function parseTemplate(filePath: string): Promise<TemplateDef> {
  const content = await readFile(filePath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw.node_type || typeof raw.node_type !== 'string' || raw.node_type.trim() === '') {
    throw new Error(`template at ${filePath}: missing or empty 'node_type'`);
  }

  const suggestedArtifacts = Array.isArray(raw.suggested_artifacts)
    ? (raw.suggested_artifacts as unknown[]).filter((a): a is string => typeof a === 'string')
    : undefined;

  return {
    nodeType: (raw.node_type as string).trim(),
    suggestedArtifacts:
      suggestedArtifacts && suggestedArtifacts.length > 0 ? suggestedArtifacts : undefined,
    guidance: typeof raw.guidance === 'string' ? raw.guidance : undefined,
  };
}
