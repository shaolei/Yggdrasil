import path from 'node:path';
import type { Graph, GraphNode, DriftCategory, FlowDef } from '../model/types.js';
import { normalizeMappingPaths } from '../utils/paths.js';
import { collectAncestors, resolveAspects } from './context-builder.js';

export interface TrackedFile {
  path: string;           // relative to project root
  category: DriftCategory;  // 'source' or 'graph'
}

const STRUCTURAL_RELATION_TYPES = new Set(['uses', 'calls', 'extends', 'implements']);

/**
 * Collect all files tracked by a node's context package.
 * Mirrors the traversal of build-context but returns file paths
 * instead of rendered content. This is the core function for
 * bidirectional drift detection.
 *
 * Synchronous — no I/O needed; all data comes from the loaded Graph.
 */
export function collectTrackedFiles(node: GraphNode, graph: Graph): TrackedFile[] {
  const seen = new Set<string>();
  const result: TrackedFile[] = [];

  // Compute the .yggdrasil prefix relative to project root.
  // graph.rootPath is absolute path to .yggdrasil/; project root is its parent.
  const projectRoot = path.dirname(graph.rootPath);
  const yggPrefix = path.relative(projectRoot, graph.rootPath);
  // Normalize to forward slashes for consistency
  const yggPrefixNormalized = yggPrefix.split(path.sep).join('/');

  const configArtifactKeys = new Set(Object.keys(graph.config.artifacts ?? {}));

  function addFile(filePath: string, category: DriftCategory): void {
    if (seen.has(filePath)) return;
    seen.add(filePath);
    result.push({ path: filePath, category });
  }

  function graphPath(...segments: string[]): string {
    return [yggPrefixNormalized, ...segments].join('/');
  }

  function addNodeFiles(n: GraphNode): void {
    // node.yaml
    addFile(graphPath('model', n.path, 'node.yaml'), 'graph');
    // artifacts filtered by config
    for (const art of n.artifacts) {
      if (configArtifactKeys.has(art.filename)) {
        addFile(graphPath('model', n.path, art.filename), 'graph');
      }
    }
  }

  // 1. OWN — node.yaml + config-filtered artifacts
  addNodeFiles(node);

  // 2. HIERARCHICAL — ancestors from root to parent
  const ancestors = collectAncestors(node);
  for (const ancestor of ancestors) {
    addNodeFiles(ancestor);
  }

  // 3. ASPECTS — resolve all aspects from own + ancestors + flows (with recursive implies)
  // First, collect all aspect ids from own node and ancestors
  const allAspectIds = new Set<string>();

  for (const id of node.meta.aspects ?? []) {
    allAspectIds.add(id);
  }
  for (const ancestor of ancestors) {
    for (const id of ancestor.meta.aspects ?? []) {
      allAspectIds.add(id);
    }
  }

  // Collect participating flows (same logic as build-context)
  const participatingFlows = collectParticipatingFlows(graph, node, ancestors);

  // Add flow-propagated aspects
  for (const flow of participatingFlows) {
    for (const id of flow.aspects ?? []) {
      allAspectIds.add(id);
    }
  }

  // Resolve with recursive implies
  const resolvedAspects = resolveAspects(allAspectIds, graph.aspects);
  for (const aspect of resolvedAspects) {
    addFile(graphPath('aspects', aspect.id, 'aspect.yaml'), 'graph');
    for (const art of aspect.artifacts) {
      addFile(graphPath('aspects', aspect.id, art.filename), 'graph');
    }
  }

  // 4. RELATIONAL-DEPS — structural relations (uses/calls/extends/implements)
  for (const relation of node.meta.relations ?? []) {
    if (!STRUCTURAL_RELATION_TYPES.has(relation.type)) continue;
    const target = graph.nodes.get(relation.target);
    if (!target) continue;

    // Determine which artifacts to include from the target
    const structuralFilenames = Object.entries(graph.config.artifacts ?? {})
      .filter(([, c]) => c.structural_context)
      .map(([filename]) => filename);

    // Check if the target actually has any of the structural_context artifacts
    const structuralArts = structuralFilenames.filter((filename) =>
      target.artifacts.some((a) => a.filename === filename),
    );

    if (structuralArts.length > 0) {
      // Use only structural_context artifacts that exist on target
      for (const filename of structuralArts) {
        addFile(graphPath('model', target.path, filename), 'graph');
      }
    } else {
      // Fallback: all config-allowed artifacts
      for (const art of target.artifacts) {
        if (configArtifactKeys.has(art.filename)) {
          addFile(graphPath('model', target.path, art.filename), 'graph');
        }
      }
    }
  }

  // 5. RELATIONAL-FLOWS — flow.yaml + flow artifacts for participating flows
  for (const flow of participatingFlows) {
    addFile(graphPath('flows', flow.path, 'flow.yaml'), 'graph');
    for (const art of flow.artifacts) {
      addFile(graphPath('flows', flow.path, art.filename), 'graph');
    }
  }

  // 6. SOURCE — files from mapping.paths
  const mappingPaths = normalizeMappingPaths(node.meta.mapping);
  for (const p of mappingPaths) {
    addFile(p, 'source');
  }

  return result;
}

/**
 * Find all flows where the node or any of its ancestors is a participant.
 * Same logic as collectParticipatingFlows in context-builder.ts.
 */
function collectParticipatingFlows(
  graph: Graph,
  node: GraphNode,
  ancestors: GraphNode[],
): FlowDef[] {
  const paths = new Set<string>([node.path, ...ancestors.map((a) => a.path)]);
  return graph.flows.filter((f) => f.nodes.some((n) => paths.has(n)));
}
