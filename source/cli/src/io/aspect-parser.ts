import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { AspectDef } from '../model/types.js';
import { readArtifacts } from './artifact-reader.js';

export async function parseAspect(aspectDir: string, aspectYamlPath: string): Promise<AspectDef> {
  const content = await readFile(aspectYamlPath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw.name || typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error(`Aspect file ${aspectYamlPath}: missing or empty 'name'`);
  }
  if (!raw.tag || typeof raw.tag !== 'string' || raw.tag.trim() === '') {
    throw new Error(`Aspect file ${aspectYamlPath}: missing or empty 'tag'`);
  }

  const artifacts = await readArtifacts(aspectDir, ['aspect.yaml']);

  return {
    name: (raw.name as string).trim(),
    tag: (raw.tag as string).trim(),
    artifacts,
  };
}
