import { getAIProvider, type AIProvider } from "@/ai";
import { logger } from "@/lib/logger";

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_BATCH_SIZE = 20;
export const MAX_RETRIES = 3;

export interface EmbeddingOptions {
  batchSize?: number;
  provider?: AIProvider;
}

export class EmbeddingService {
  /**
   * Generate embeddings for a collection of text inputs in batches with retries.
   */
  static async generateEmbeddings(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const provider = options?.provider ?? getAIProvider();
    const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;

    // 1. Sanitize & validate inputs
    const sanitized = texts.map((t, idx) => {
      const clean = (t || "").trim();
      if (!clean) {
        logger.warn("Empty input provided for embedding generation at index", { index: idx });
        return " "; // Non-empty fallback for valid embedding generation
      }
      return clean;
    });

    const allEmbeddings: number[][] = [];

    // 2. Process in controlled batches
    for (let i = 0; i < sanitized.length; i += batchSize) {
      const batch = sanitized.slice(i, i + batchSize);
      const batchEmbeddings = await this.generateBatchWithRetry(provider, batch);

      // 3. Strict dimension validation
      for (let j = 0; j < batchEmbeddings.length; j++) {
        const vec = batchEmbeddings[j];
        if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Malformed embedding returned: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vec?.length ?? 0}`
          );
        }
      }

      allEmbeddings.push(...batchEmbeddings);
    }

    return allEmbeddings;
  }

  /**
   * Execute batch generation with bounded exponential backoff.
   */
  private static async generateBatchWithRetry(
    provider: AIProvider,
    inputs: string[],
    maxRetries = MAX_RETRIES
  ): Promise<number[][]> {
    let attempt = 0;
    let delay = 500;

    while (attempt <= maxRetries) {
      try {
        return await provider.generateEmbeddings({
          model: EMBEDDING_MODEL,
          inputs,
        });
      } catch (error) {
        attempt++;
        const isLastAttempt = attempt > maxRetries;
        const errMsg = error instanceof Error ? error.message : String(error);

        logger.warn(`Embedding API failure (attempt ${attempt}/${maxRetries})`, {
          error: errMsg,
          inputBatchCount: inputs.length,
        });

        if (isLastAttempt) {
          throw new Error(
            `Failed to generate embeddings after ${maxRetries} attempts: ${errMsg}`
          );
        }

        // Exponential backoff with jitter
        await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 200));
        delay *= 2;
      }
    }

    throw new Error("Unexpected end of retry loop");
  }
}
