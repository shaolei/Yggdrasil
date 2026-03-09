import { describe, it, expect } from 'vitest';
import { tokenize } from '../../../src/utils/tokenizer.js';

describe('tokenize', () => {
  it('lowercases and splits on whitespace', () => {
    expect(tokenize('Fix Authentication Bug')).toEqual(['fix', 'authentication', 'bug']);
  });

  it('splits on punctuation', () => {
    expect(tokenize('order-service.payments')).toEqual(['order', 'service', 'payments']);
  });

  it('removes stop words', () => {
    expect(tokenize('fix the bug in the auth module')).toEqual(['fix', 'bug', 'auth', 'module']);
  });

  it('removes tokens shorter than 2 chars', () => {
    expect(tokenize('a b cd ef')).toEqual(['cd', 'ef']);
  });

  it('deduplicates tokens', () => {
    expect(tokenize('order order service')).toEqual(['order', 'service']);
  });

  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for stop-words-only input', () => {
    expect(tokenize('the is a an')).toEqual([]);
  });
});
