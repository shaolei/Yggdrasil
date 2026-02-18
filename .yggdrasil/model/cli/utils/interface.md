# Utils Interface

## paths.ts

- `findYggRoot(projectRoot: string): Promise<string>` — resolves projectRoot/.yggdrasil, throws if not found
- `normalizeMappingPaths(mapping: NodeMapping | undefined): string[]` — returns path or paths array, empty if no mapping
- `normalizeProjectRelativePath(projectRoot: string, rawPath: string): string` — throws if path outside project root
- `getPackageRoot(): string` — dirname of current module (CLI package root)
- `toGraphPath(absolutePath: string, yggRoot: string): string` — relative path with / separators

## hash.ts

- `hashFile(filePath: string): Promise<string>` — SHA-256 hex of file content
- `hashString(content: string): string` — SHA-256 hex of string
- `hashForMapping(projectRoot, mapping): Promise<string>` — canonical hash for drift (file: content hash; directory: hash of sorted path:hash pairs; files: same)
- `perFileHashes(projectRoot, mapping): Promise<Array<{path, hash}>>` — per-file hashes for drift diagnostics

## tokens.ts

- `estimateTokens(text: string): number` — Math.ceil(text.length / 4), heuristic ~4 chars per token
