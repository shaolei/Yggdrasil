import type { ContextPackage, ContextLayer } from '../model/types.js';

function escapeAttr(val: string): string {
  return val.replace(/"/g, '&quot;');
}

function formatLayer(layer: ContextLayer): string {
  switch (layer.type) {
    case 'global':
      return `<global>\n${layer.content}\n</global>`;
    case 'hierarchy': {
      const pathMatch = layer.label.match(/\((.+)\/\)/);
      const pathAttr = pathMatch ? ` path="${escapeAttr(pathMatch[1])}"` : '';
      const aspectsAttr = layer.attrs?.aspects ? ` aspects="${escapeAttr(layer.attrs.aspects)}"` : '';
      return `<hierarchy${pathAttr}${aspectsAttr}>\n${layer.content}\n</hierarchy>`;
    }
    case 'own': {
      if (layer.label === 'Materialization Target') {
        return `<materialization-target paths="${escapeAttr(layer.content)}" />`;
      }
      const ownAspectsAttr = layer.attrs?.aspects ? ` aspects="${escapeAttr(layer.attrs.aspects)}"` : '';
      return `<own-artifacts${ownAspectsAttr}>\n${layer.content}\n</own-artifacts>`;
    }
    case 'aspects': {
      const nameMatch = layer.label.match(/^(.+?) \(tag: (.+)\)$/);
      const name = nameMatch ? escapeAttr(nameMatch[1]) : '';
      const tag = nameMatch ? escapeAttr(nameMatch[2]) : '';
      return `<aspect name="${name}" tag="${tag}">\n${layer.content}\n</aspect>`;
    }
    case 'relational': {
      const attrs = layer.attrs ?? {};
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
        .join('');
      const tagName = attrs.type && ['emits', 'listens'].includes(attrs.type) ? 'event' : 'dependency';
      return `<${tagName}${attrStr}>\n${layer.content}\n</${tagName}>`;
    }
    case 'flows': {
      const flowName = layer.label.replace(/^Flow: /, '').trim();
      const flowAspectsAttr = layer.attrs?.aspects ? ` aspects="${escapeAttr(layer.attrs.aspects)}"` : '';
      return `<flow name="${escapeAttr(flowName)}"${flowAspectsAttr}>\n${layer.content}\n</flow>`;
    }
    default:
      return layer.content;
  }
}

export function formatContextText(pkg: ContextPackage): string {
  const attrs = [
    `node-path="${escapeAttr(pkg.nodePath)}"`,
    `node-name="${escapeAttr(pkg.nodeName)}"`,
    `token-count="${pkg.tokenCount}"`,
  ].join(' ');

  let out = `<context-package ${attrs}>\n\n`;

  for (const section of pkg.sections) {
    for (const layer of section.layers) {
      out += formatLayer(layer) + '\n\n';
    }
  }

  out += '</context-package>';
  return out;
}
