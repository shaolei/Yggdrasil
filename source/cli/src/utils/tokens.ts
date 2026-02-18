/**
 * Estimate token count for a string.
 * Heuristic: ~4 characters per token (no tokenizer dependency).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
