import { stringify } from 'yaml';
import type { ContextMapOutput } from '../model/types.js';

/**
 * Format a ContextMapOutput as YAML (paths-only, default mode).
 */
export function formatContextYaml(data: ContextMapOutput): string {
  const output: Record<string, unknown> = {
    meta: {
      'token-count': data.meta.tokenCount,
      'budget-status': data.meta.budgetStatus,
    },
    project: data.project,
    node: data.node,
    hierarchy: data.hierarchy.length > 0 ? data.hierarchy : undefined,
    dependencies: data.dependencies.length > 0 ? data.dependencies : undefined,
    artifacts: data.artifacts,
  };

  // Remove undefined keys
  for (const key of Object.keys(output)) {
    if (output[key] === undefined) delete output[key];
  }

  return stringify(output, { lineWidth: 0 });
}

/**
 * Format the --full content section: file contents in XML-style tags.
 * Appended after YAML section with --- separator.
 */
export function formatFullContent(
  files: Array<{ path: string; content: string }>,
): string {
  if (files.length === 0) return '';
  let out = '---\n\n';
  for (const file of files) {
    out += `<${file.path}>\n${file.content}\n</${file.path}>\n\n`;
  }
  return out;
}
