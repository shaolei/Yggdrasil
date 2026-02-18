# Drift Detector Errors

- **readDriftState**: Returns empty object on file missing/parse error; no throw.
- **File access (allPathsMissing)**: Propagates ENOENT from access().
- **hashForMapping**: Propagates read errors from hash utils.
