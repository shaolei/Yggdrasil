# Command Error Handling Pattern

Every command handler must follow this convention for error reporting and exit behavior.

## Rules

1. **Errors go to stderr.** Never write error messages to stdout. stdout is for successful output (e.g. build-context Markdown, tree output). User messages, errors, warnings → stderr.

2. **Exit on failure.** On any error, call `process.exit(1)`. Do not throw uncaught — wrap in try/catch, write to stderr, then exit. Success exit is implicit (process.exit(0) or normal end).

3. **Message format.** `Error: <concise message>\n`. Include enough context (e.g. node path, file path) for the user to act. Avoid stack traces unless debugging.

4. **Catch at handler level.** Each command's `action` callback should have try/catch. Propagate errors from loadGraph, buildContext, etc. — catch once, report, exit.

## Example

```typescript
.action(async (options: { node: string }) => {
  try {
    const graph = await loadGraph(process.cwd());
    const pkg = await buildContext(graph, options.node);
    process.stdout.write(formatContextMarkdown(pkg));
  } catch (error) {
    process.stderr.write(`Error: ${(error as Error).message}\n`);
    process.exit(1);
  }
});
```

## Rationale

- **Scriptability:** CI and agents need exit code to detect failure. stdout/stderr separation allows piping success output while preserving errors.
- **Consistency:** All 13 commands behave the same. User knows what to expect.
