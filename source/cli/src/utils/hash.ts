import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { type Ignore, type Options as IgnoreOptions } from 'ignore';
import type { TrackedFile } from '../core/context-files.js';

const require = createRequire(import.meta.url);
const ignoreFactory = require('ignore') as (options?: IgnoreOptions) => Ignore;

type HashPathOptions = {
  projectRoot?: string;
};

export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export async function hashPath(targetPath: string, options: HashPathOptions = {}): Promise<string> {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : undefined;
  const gitignoreMatcher = await loadGitignoreMatcher(projectRoot);
  const targetStat = await stat(targetPath);

  if (targetStat.isFile()) {
    // Mapped files are always hashed — gitignore only applies to directory scans.
    return hashFile(targetPath);
  }

  if (targetStat.isDirectory()) {
    const fileHashes = await collectDirectoryFileHashes(targetPath, targetPath, {
      projectRoot,
      gitignoreMatcher,
    });
    const digestInput = fileHashes
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((entry) => `${entry.path}:${entry.hash}`)
      .join('\n');
    return hashString(digestInput);
  }

  throw new Error(`Unsupported mapping path type: ${targetPath}`);
}

async function collectDirectoryFileHashes(
  directoryPath: string,
  rootDirectoryPath: string,
  options: { projectRoot?: string; gitignoreMatcher?: Ignore },
): Promise<Array<{ path: string; hash: string }>> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const result: Array<{ path: string; hash: string }> = [];

  for (const entry of entries) {
    const absoluteChildPath = path.join(directoryPath, entry.name);

    if (isIgnoredPath(absoluteChildPath, options.projectRoot, options.gitignoreMatcher)) {
      continue;
    }

    if (entry.isDirectory()) {
      const nested = await collectDirectoryFileHashes(
        absoluteChildPath,
        rootDirectoryPath,
        options,
      );
      for (const nestedEntry of nested) {
        result.push({
          path: path.relative(rootDirectoryPath, path.join(absoluteChildPath, nestedEntry.path)),
          hash: nestedEntry.hash,
        });
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    result.push({
      path: path.relative(rootDirectoryPath, absoluteChildPath),
      hash: await hashFile(absoluteChildPath),
    });
  }

  return result;
}

async function loadGitignoreMatcher(projectRoot?: string): Promise<Ignore | undefined> {
  if (!projectRoot) {
    return undefined;
  }

  try {
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const gitignoreContent = await readFile(gitignorePath, 'utf-8');
    const matcher = ignoreFactory();
    matcher.add(gitignoreContent);
    return matcher;
  } catch {
    return undefined;
  }
}

function isIgnoredPath(candidatePath: string, projectRoot?: string, matcher?: Ignore): boolean {
  if (!projectRoot || !matcher) {
    return false;
  }

  const relativePath = path.relative(projectRoot, candidatePath);
  if (relativePath === '' || relativePath.startsWith('..')) {
    return false;
  }

  return matcher.ignores(relativePath) || matcher.ignores(relativePath + '/');
}

export function hashString(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Compute per-file hashes for a mapping. Used for diagnostics (which files changed). */
export async function perFileHashes(
  projectRoot: string,
  mapping: { paths?: string[] },
): Promise<Array<{ path: string; hash: string }>> {
  const root = path.resolve(projectRoot);
  const paths = mapping.paths ?? [];
  if (paths.length === 0) return [];

  const result: Array<{ path: string; hash: string }> = [];
  const gitignoreMatcher = await loadGitignoreMatcher(root);

  for (const p of paths) {
    const absPath = path.join(root, p);
    const st = await stat(absPath);
    if (st.isFile()) {
      result.push({ path: p, hash: await hashFile(absPath) });
    } else if (st.isDirectory()) {
      const hashes = await collectDirectoryFileHashes(absPath, absPath, {
        projectRoot: root,
        gitignoreMatcher,
      });
      for (const h of hashes) {
        result.push({
          path: path.join(p, h.path).split(path.sep).join('/'),
          hash: h.hash,
        });
      }
    }
  }

  return result;
}

/** Compute drift hash for a node mapping. Returns hex. */
export async function hashForMapping(
  projectRoot: string,
  mapping: { paths?: string[] },
): Promise<string> {
  const root = path.resolve(projectRoot);
  const paths = mapping.paths ?? [];
  if (paths.length === 0) throw new Error('Invalid mapping for hash: no paths');

  const pairs: Array<{ path: string; hash: string }> = [];

  for (const p of paths) {
    const absPath = path.join(root, p);
    const st = await stat(absPath);
    if (st.isFile()) {
      pairs.push({ path: p, hash: await hashFile(absPath) });
    } else if (st.isDirectory()) {
      const dirHash = await hashPath(absPath, { projectRoot: root });
      pairs.push({ path: p, hash: dirHash });
    }
  }

  const digestInput = pairs
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => `${e.path}:${e.hash}`)
    .join('\n');
  return createHash('sha256').update(digestInput).digest('hex');
}

/**
 * Hash all tracked files (source + graph) for bidirectional drift detection.
 * Directories in the tracked list are expanded to their contained files.
 * Returns a canonical hash (sorted path:hash digest) and per-file hashes.
 */
export async function hashTrackedFiles(
  projectRoot: string,
  trackedFiles: TrackedFile[],
): Promise<{ canonicalHash: string; fileHashes: Record<string, string> }> {
  const fileHashes: Record<string, string> = {};

  for (const tf of trackedFiles) {
    const absPath = path.join(projectRoot, tf.path);
    try {
      const st = await stat(absPath);
      if (st.isDirectory()) {
        // Expand directory (for source mapping directories)
        const dirHashes = await collectDirectoryFileHashes(absPath, absPath, { projectRoot });
        for (const entry of dirHashes) {
          const fullRelPath = path.join(tf.path, entry.path).replace(/\\/g, '/');
          fileHashes[fullRelPath] = entry.hash;
        }
      } else {
        fileHashes[tf.path] = await hashFile(absPath);
      }
    } catch {
      // File doesn't exist — skip (will be caught by drift detection)
      continue;
    }
  }

  // Canonical hash: sorted path:hash pairs
  const sorted = Object.entries(fileHashes).sort(([a], [b]) => a.localeCompare(b));
  const digest = sorted.map(([p, h]) => `${p}:${h}`).join('\n');
  const canonicalHash = hashString(digest);

  return { canonicalHash, fileHashes };
}
