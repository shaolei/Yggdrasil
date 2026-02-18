// Example: command handler with error handling pattern
// From knowledge/patterns/command-error-handling

program
  .command('build-context')
  .requiredOption('--node <path>', 'Node path')
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
