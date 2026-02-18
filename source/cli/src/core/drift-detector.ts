import type {
  Graph,
  DriftReport,
  DriftEntry,
  DriftStatus,
  DriftNodeState,
} from '../model/types.js';
import {
  readDriftState,
  writeDriftState,
  getCanonicalHash,
  getFileHashes,
} from '../io/drift-state-store.js';
import { hashForMapping, perFileHashes } from '../utils/hash.js';
import { normalizeMappingPaths } from '../utils/paths.js';
import { access } from 'node:fs/promises';
import path from 'node:path';

export async function detectDrift(graph: Graph, filterNodePath?: string): Promise<DriftReport> {
  const projectRoot = path.dirname(graph.rootPath);
  const driftState = await readDriftState(graph.rootPath);
  const entries: DriftEntry[] = [];

  for (const [nodePath, node] of graph.nodes) {
    if (filterNodePath && nodePath !== filterNodePath) continue;
    const mapping = node.meta.mapping;
    if (!mapping) continue;

    const mappingPaths = normalizeMappingPaths(mapping);
    if (mappingPaths.length === 0) continue;

    const storedEntry = driftState[nodePath];

    if (!storedEntry) {
      const allMissing = await allPathsMissing(projectRoot, mappingPaths);
      entries.push({
        nodePath,
        mappingPaths,
        status: allMissing ? 'unmaterialized' : 'drift',
        details: allMissing
          ? 'No drift state recorded, files do not exist'
          : 'No drift state recorded, files exist (run drift-sync after materialization)',
      });
      continue;
    }

    const storedHash = getCanonicalHash(storedEntry);
    let status: DriftStatus = 'ok';
    let details = '';

    try {
      const currentHash = await hashForMapping(projectRoot, mapping);
      if (currentHash !== storedHash) {
        status = 'drift';
        const changedFiles = await diagnoseChangedFiles(
          projectRoot,
          mapping,
          getFileHashes(storedEntry),
        );
        details =
          changedFiles.length > 0
            ? `Changed files: ${changedFiles.join(', ')}`
            : 'File(s) modified since last sync';
      }
    } catch {
      status = 'missing';
      details = 'Mapped path(s) do not exist';
    }

    entries.push({ nodePath, mappingPaths, status, details });
  }

  return {
    entries,
    totalChecked: entries.length,
    okCount: entries.filter((e) => e.status === 'ok').length,
    driftCount: entries.filter((e) => e.status === 'drift').length,
    missingCount: entries.filter((e) => e.status === 'missing').length,
    unmaterializedCount: entries.filter((e) => e.status === 'unmaterialized').length,
  };
}

async function diagnoseChangedFiles(
  projectRoot: string,
  mapping: { paths?: string[] },
  storedFileHashes: Record<string, string> | undefined,
): Promise<string[]> {
  try {
    const currentHashes = await perFileHashes(projectRoot, mapping);
    if (!storedFileHashes) {
      return currentHashes.map((h) => h.path).sort();
    }

    const changed: string[] = [];
    const storedPaths = new Set(Object.keys(storedFileHashes));

    for (const { path: filePath, hash } of currentHashes) {
      const stored = storedFileHashes[filePath];
      if (!stored || stored !== hash) {
        changed.push(filePath);
      }
      storedPaths.delete(filePath);
    }

    for (const removed of storedPaths) {
      changed.push(`${removed} (deleted)`);
    }

    return changed.sort();
  } catch {
    return [];
  }
}

async function allPathsMissing(projectRoot: string, mappingPaths: string[]): Promise<boolean> {
  for (const mp of mappingPaths) {
    const absPath = path.join(projectRoot, mp);
    try {
      await access(absPath);
      return false;
    } catch {
      // path missing
    }
  }
  return true;
}

export async function syncDriftState(
  graph: Graph,
  nodePath: string,
): Promise<{ previousHash?: string; currentHash: string }> {
  const projectRoot = path.dirname(graph.rootPath);
  const node = graph.nodes.get(nodePath);
  if (!node) throw new Error(`Node not found: ${nodePath}`);
  const mapping = node.meta.mapping;
  if (!mapping) throw new Error(`Node has no mapping: ${nodePath}`);

  const currentHash = await hashForMapping(projectRoot, mapping);
  const driftState = await readDriftState(graph.rootPath);
  const previousEntry = driftState[nodePath];
  const previousHash = previousEntry ? getCanonicalHash(previousEntry) : undefined;

  const fileHashes = await perFileHashes(projectRoot, mapping);
  const files: Record<string, string> = {};
  for (const fh of fileHashes) {
    files[fh.path] = fh.hash;
  }

  const newEntry: DriftNodeState = { hash: currentHash, files };
  driftState[nodePath] = newEntry;
  await writeDriftState(graph.rootPath, driftState);
  return { previousHash, currentHash };
}
