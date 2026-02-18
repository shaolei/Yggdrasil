import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { loadGraph } from './graph-loader.js';
import type { Graph } from '../model/types.js';

/**
 * Load graph from a git ref (e.g. HEAD) by extracting .yggdrasil to temp dir.
 * Returns null if not a git repo, ref doesn't exist, or .yggdrasil not in ref.
 */
export async function loadGraphFromRef(
  projectRoot: string,
  ref: string = 'HEAD',
): Promise<Graph | null> {
  const yggPath = '.yggdrasil';
  let tmpDir: string | null = null;

  try {
    execSync(`git rev-parse ${ref}`, { cwd: projectRoot, stdio: 'pipe' });
  } catch {
    return null;
  }

  try {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'ygg-git-'));
    const archivePath = path.join(tmpDir, 'archive.tar');
    execSync(`git archive ${ref} ${yggPath} -o "${archivePath}"`, {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    execSync(`tar -xf "${archivePath}" -C "${tmpDir}"`, { stdio: 'pipe' });
    const graph = await loadGraph(tmpDir);
    return graph;
  } catch {
    return null;
  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}
