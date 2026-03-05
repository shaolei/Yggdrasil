import { describe, it, expect } from 'vitest';
import { formatContextText } from '../../../src/formatters/context-text.js';
import type { ContextPackage, ContextLayer } from '../../../src/model/types.js';

function makePkg(layers: ContextLayer[]): ContextPackage {
  return {
    nodePath: 'test/node',
    nodeName: 'TestNode',
    layers,
    sections: [{ key: 'Test', layers }],
    mapping: null,
    tokenCount: 100,
  };
}

describe('formatContextText', () => {
  it('formats global layer', () => {
    const result = formatContextText(
      makePkg([{ type: 'global', label: 'Global Context', content: 'Project info' }]),
    );
    expect(result).toContain('<global>');
    expect(result).toContain('Project info');
    expect(result).toContain('</global>');
  });

  it('formats hierarchy layer with path and aspects', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'hierarchy',
          label: 'Module Context (orders/)',
          content: 'Orders info',
          attrs: { aspects: 'audit,logging' },
        },
      ]),
    );
    expect(result).toContain('<hierarchy path="orders" aspects="audit,logging">');
    expect(result).toContain('Orders info');
  });

  it('formats own layer with materialization target', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'own',
          label: 'Materialization Target',
          content: 'src/orders/',
        },
      ]),
    );
    expect(result).toContain('<materialization-target paths="src/orders/" />');
  });

  it('formats own layer with aspects', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'own',
          label: 'Node: OrderService',
          content: 'Own content',
          attrs: { aspects: 'audit' },
        },
      ]),
    );
    expect(result).toContain('<own-artifacts aspects="audit">');
    expect(result).toContain('Own content');
  });

  it('formats aspect layer', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'aspects',
          label: 'Audit Trail (aspect: requires-audit)',
          content: 'Audit rules',
        },
      ]),
    );
    expect(result).toContain('<aspect name="Audit Trail" id="requires-audit">');
  });

  it('formats relational layer as dependency', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'relational',
          label: 'Dep: AuthAPI',
          content: 'Auth info',
          attrs: { target: 'auth/api', type: 'calls' },
        },
      ]),
    );
    expect(result).toContain('<dependency');
    expect(result).toContain('target="auth/api"');
  });

  it('formats relational layer as event for emits/listens', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'relational',
          label: 'Event: OrderCreated',
          content: 'Event info',
          attrs: { target: 'events/bus', type: 'emits' },
        },
      ]),
    );
    expect(result).toContain('<event');
    expect(result).toContain('type="emits"');
  });

  it('formats flow layer with aspects', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'flows',
          label: 'Flow: Checkout',
          content: 'Flow desc',
          attrs: { aspects: 'idempotency' },
        },
      ]),
    );
    expect(result).toContain('<flow name="Checkout" aspects="idempotency">');
  });

  it('handles unknown layer type via default case', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'unknown' as ContextLayer['type'],
          label: 'Unknown',
          content: 'raw content',
        },
      ]),
    );
    expect(result).toContain('raw content');
  });

  it('escapes quotes in attributes', () => {
    const result = formatContextText(
      makePkg([
        {
          type: 'hierarchy',
          label: 'Module Context (orders/)',
          content: 'info',
          attrs: { aspects: 'has "quotes"' },
        },
      ]),
    );
    expect(result).toContain('has &quot;quotes&quot;');
  });
});
