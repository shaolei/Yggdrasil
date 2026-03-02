# Utils Logic

## hash.ts

### hashFile

- readFile, createHash('sha256').update(content).digest('hex')

### hashPath (file or directory)

- **File**: mapped files always hashed (gitignore only applies to directory scans)
- **Directory**: collectDirectoryFileHashes (recursive, hierarchical .gitignore); sort by path; digest = sorted "path:hash" pairs joined by newline; hashString(digest)

### hashForMapping (drift hash)

- paths from mapping.paths; empty → throw "Invalid mapping for hash: no paths"
- For each path: if file → hashFile; if directory → hashPath (with projectRoot for .gitignore)
- pairs sorted by path; digest = "path:hash" joined; SHA-256 of digest

### hashTrackedFiles (drift detection)

- Loads root gitignore stack, passes to collectDirectoryFileHashes when expanding directory tracked files
- Returns canonicalHash + per-file hashes for bidirectional drift detection

### perFileHashes

- For each path: if file → { path, hash }; if directory → collectDirectoryFileHashes, prefix paths with mapping path
- Returns flat list; used for diagnoseChangedFiles

### collectDirectoryFileHashes

- On entering a directory, checks for local .gitignore and adds to gitignore stack
- readdir; for each entry: if ignored by any matcher in stack → skip; if dir → recurse (passing stack); if file → hashFile, path relative to rootDirectoryPath
- Gitignore is hierarchical: root .gitignore loaded by caller, nested .gitignore files discovered during walk; each matcher checks paths relative to its own basePath

### isIgnoredByStack

- Checks candidatePath against all GitignoreEntry matchers in the stack
- Each matcher tests path relative to its own basePath
- Returns true if any matcher ignores the path
