import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { MigrationResult } from '../core/migrator.js';

const STANDARD_ARTIFACT_NAMES = new Set([
  'responsibility.md',
  'interface.md',
  'internals.md',
]);

export async function migrateTo3(yggRoot: string): Promise<MigrationResult> {
  const actions: string[] = [];
  const warnings: string[] = [];

  const configPath = path.join(yggRoot, 'yg-config.yaml');
  const content = await readFile(configPath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (raw.artifacts && typeof raw.artifacts === 'object') {
    const artifactKeys = Object.keys(raw.artifacts as Record<string, unknown>);
    const custom = artifactKeys.filter((k) => !STANDARD_ARTIFACT_NAMES.has(k));
    if (custom.length > 0) {
      warnings.push(
        `Custom artifacts removed from config: ${custom.join(', ')}. Files remain on disk but CLI will ignore them.`,
      );
    }

    delete raw.artifacts;
    await writeFile(configPath, stringifyYaml(raw, { lineWidth: 0 }), 'utf-8');
    actions.push('Removed artifacts section from yg-config.yaml');
  }

  return { actions, warnings };
}
