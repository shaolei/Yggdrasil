import { readFile, writeFile } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import path from 'node:path';
import type { DriftState, DriftNodeState } from '../model/types.js';

const DRIFT_STATE_FILE = '.drift-state';

export function getCanonicalHash(entry: string | DriftNodeState): string {
  return typeof entry === 'string' ? entry : entry.hash;
}

export function getFileHashes(entry: string | DriftNodeState): Record<string, string> | undefined {
  return typeof entry === 'object' ? entry.files : undefined;
}

export async function readDriftState(yggRoot: string): Promise<DriftState> {
  const filePath = path.join(yggRoot, DRIFT_STATE_FILE);
  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = parseYaml(content);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const result: DriftState = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof k === 'string' && typeof v === 'string') {
          result[k] = v;
        } else if (typeof k === 'string' && typeof v === 'object' && v !== null && 'hash' in v) {
          result[k] = v as DriftNodeState;
        }
      }
      return result;
    }
    return {};
  } catch {
    return {};
  }
}

export async function writeDriftState(yggRoot: string, state: DriftState): Promise<void> {
  const filePath = path.join(yggRoot, DRIFT_STATE_FILE);
  const content = stringifyYaml(state);
  await writeFile(filePath, content, 'utf-8');
}
