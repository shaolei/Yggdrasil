const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'this', 'that', 'it', 'its', 'or', 'and', 'but', 'if',
  'not', 'no', 'so', 'up', 'out', 'about', 'which', 'what', 'when',
  'where', 'who', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'some', 'any', 'other', 'than', 'too', 'very', 'just', 'also',
]);

export function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  return [...new Set(tokens)];
}
