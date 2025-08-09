import { encode } from 'gpt-tokenizer';

/**
 * Local tokenizer utility for computing token counts without external API calls.
 * Uses the gpt-tokenizer library with cl100k_base encoding (compatible with OpenAI's text-embedding models).
 */

/**
 * Computes the number of tokens in the given text content locally.
 * This function is used during ingestion to calculate token counts for embeddings.
 *
 * @param content - The text content to tokenize
 * @returns The number of tokens in the content
 *
 * @example
 * ```typescript
 * const tokenCount = tokenizeText("Hello, world!");
 * console.log(tokenCount); // Returns the token count for "Hello, world!"
 * ```
 */
export function tokenizeText(content: string): number {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  try {
    // Use gpt-tokenizer's encode function with cl100k_base encoding
    // This is compatible with OpenAI's text-embedding-3-small model
    const tokens = encode(content);
    return tokens.length;
  } catch (error) {
    console.error('Error tokenizing text:', error);
    // Return 0 on error to prevent ingestion failures
    return 0;
  }
}

/**
 * Utility function to get token count statistics for debugging/monitoring.
 *
 * @param contents - Array of content strings to analyze
 * @returns Statistics about token counts
 */
export function getTokenStats(contents: string[]): {
  totalTokens: number;
  averageTokens: number;
  minTokens: number;
  maxTokens: number;
  contentCount: number;
} {
  if (!contents || contents.length === 0) {
    return {
      totalTokens: 0,
      averageTokens: 0,
      minTokens: 0,
      maxTokens: 0,
      contentCount: 0,
    };
  }

  const tokenCounts = contents.map(content => tokenizeText(content));
  const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

  return {
    totalTokens,
    averageTokens: Math.round(totalTokens / contents.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    contentCount: contents.length,
  };
}
