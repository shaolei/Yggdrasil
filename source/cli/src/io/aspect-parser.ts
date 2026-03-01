import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { AspectDef } from '../model/types.js';
import { readArtifacts } from './artifact-reader.js';

export async function parseAspect(
  aspectDir: string,
  aspectYamlPath: string,
  tag: string,
): Promise<AspectDef> {
  const tagTrimmed = tag?.trim() ?? '';
  if (!tagTrimmed) {
    throw new Error(`Aspect tag must be non-empty (directory name in aspects/)`);
  }
  const content = await readFile(aspectYamlPath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw.name || typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error(`Aspect file ${aspectYamlPath}: missing or empty 'name'`);
  }

  const artifacts = await readArtifacts(aspectDir, ['aspect.yaml']);

  let implies: string[] | undefined;
  if (raw.implies !== undefined) {
    if (!Array.isArray(raw.implies)) {
      throw new Error(`Aspect file ${aspectYamlPath}: 'implies' must be an array of strings`);
    }
    implies = (raw.implies as unknown[]).filter((t): t is string => typeof t === 'string');
  }

  return {
    name: (raw.name as string).trim(),
    tag: tagTrimmed,
    implies,
    artifacts,
  };
}
