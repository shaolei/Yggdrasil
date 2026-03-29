import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type {
  YggConfig,
  QualityConfig,
  NodeTypeConfig,
} from '../model/types.js';

const DEFAULT_QUALITY: QualityConfig = {
  min_artifact_length: 50,
  max_direct_relations: 10,
  context_budget: { warning: 10000, error: 20000, own_warning: undefined },
};

export async function parseConfig(filePath: string): Promise<YggConfig> {
  const content = await readFile(filePath, 'utf-8');
  const raw = parseYaml(content) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`yg-config.yaml: file is empty or not a valid YAML mapping`);
  }

  const version = typeof raw.version === 'string' ? raw.version.trim() : undefined;

  if (!raw.name || typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error(`yg-config.yaml: missing or invalid 'name' field`);
  }

  const nodeTypesRaw = raw.node_types;
  if (
    !nodeTypesRaw ||
    typeof nodeTypesRaw !== 'object' ||
    Array.isArray(nodeTypesRaw) ||
    Object.keys(nodeTypesRaw).length === 0
  ) {
    throw new Error(`yg-config.yaml: 'node_types' must be a non-empty object`);
  }

  const nodeTypes: Record<string, NodeTypeConfig> = {};
  for (const [typeName, val] of Object.entries(nodeTypesRaw)) {
    const entry = val as Record<string, unknown>;
    if (!entry || typeof entry !== 'object' || typeof entry.description !== 'string' || entry.description.trim() === '') {
      throw new Error(
        `yg-config.yaml: node_types.${typeName} must have a non-empty 'description' string`,
      );
    }
    const requiredAspects = Array.isArray(entry.required_aspects)
      ? (entry.required_aspects as unknown[]).filter((t): t is string => typeof t === 'string')
      : undefined;
    nodeTypes[typeName] = {
      description: entry.description as string,
      required_aspects: requiredAspects && requiredAspects.length > 0 ? requiredAspects : undefined,
    };
  }

  const qualityRaw = raw.quality as Record<string, unknown> | undefined;
  const quality: QualityConfig = qualityRaw
    ? {
        min_artifact_length:
          (qualityRaw.min_artifact_length as number) ?? DEFAULT_QUALITY.min_artifact_length,
        max_direct_relations:
          (qualityRaw.max_direct_relations as number) ?? DEFAULT_QUALITY.max_direct_relations,
        context_budget: {
          warning:
            (qualityRaw.context_budget as Record<string, number>)?.warning ??
            DEFAULT_QUALITY.context_budget.warning,
          error:
            (qualityRaw.context_budget as Record<string, number>)?.error ??
            DEFAULT_QUALITY.context_budget.error,
          own_warning: (qualityRaw.context_budget as Record<string, number | undefined>)?.own_warning,
        },
      }
    : DEFAULT_QUALITY;

  if (quality.context_budget.error < quality.context_budget.warning) {
    throw new Error(
      `yg-config.yaml: quality.context_budget.error (${quality.context_budget.error}) must be >= warning (${quality.context_budget.warning})`,
    );
  }

  if (quality.context_budget.own_warning !== undefined && quality.context_budget.own_warning <= 0) {
    throw new Error('quality.context_budget.own_warning must be a positive number');
  }

  return {
    version,
    name: (raw.name as string).trim(),
    node_types: nodeTypes,
    quality,
  };
}
