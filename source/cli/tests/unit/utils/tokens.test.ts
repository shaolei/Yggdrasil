import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../../../src/utils/tokens.js';

describe('tokens', () => {
  it('returns a number greater than 0 for non-empty string', () => {
    const count = estimateTokens('Hello world');
    expect(count).toBeGreaterThan(0);
    expect(typeof count).toBe('number');
  });

  it('returns 0 for empty string', () => {
    const count = estimateTokens('');
    expect(count).toBe(0);
  });

  it('estimates longer text with more tokens', () => {
    const short = estimateTokens('Hi');
    const long = estimateTokens(
      'This is a much longer piece of text that should have more tokens.',
    );
    expect(long).toBeGreaterThan(short);
  });

  it('handles unicode correctly', () => {
    const count = estimateTokens('日本語テスト');
    expect(count).toBeGreaterThan(0);
  });

  it('uses Math.ceil(text.length / 4) heuristic', () => {
    const text = 'abcdefghijklmnop'; // 16 chars → Math.ceil(16/4) = 4
    const count = estimateTokens(text);
    expect(count).toBe(4);
  });
});
