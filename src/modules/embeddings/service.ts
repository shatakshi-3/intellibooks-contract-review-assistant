import { getAIProvider, type AIProvider } from "@/ai";
import { logger } from "@/lib/logger";

export const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = parseInt(process.env.AI_EMBEDDING_DIMENSIONS || "1536", 10);
export const DEFAULT_BATCH_SIZE = 20;
export const MAX_RETRIES = 3;

export type EmbeddingInputType = "passage" | "query";

export interface EmbeddingOptions {
  batchSize?: number;
  provider?: AIProvider;
  model?: string;
  expectedDimensions?: number;
  inputType?: EmbeddingInputType;
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
    const model = options?.model ?? EMBEDDING_MODEL;
    const expectedDimensions = options?.expectedDimensions ?? EMBEDDING_DIMENSIONS;
    const inputType = options?.inputType;

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
      const batchEmbeddings = await this.generateBatchWithRetry(
        provider,
        batch,
        model,
        expectedDimensions,
        inputType
      );

      // 3. Strict dimension validation
      for (let j = 0; j < batchEmbeddings.length; j++) {
        const vec = batchEmbeddings[j];
        if (!Array.isArray(vec) || vec.length !== expectedDimensions) {
          throw new Error(
            `Malformed embedding returned: expected ${expectedDimensions} dimensions, got ${vec?.length ?? 0}`
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
    model: string,
    expectedDimensions: number,
    inputType?: EmbeddingInputType,
    maxRetries = MAX_RETRIES
  ): Promise<number[][]> {
    let attempt = 0;
    let delay = 500;

    while (attempt <= maxRetries) {
      try {
        return await provider.generateEmbeddings({
          model,
          inputs,
          dimensions: expectedDimensions,
          inputType,
        });
      } catch (error) {
        attempt++;
        const isLastAttempt = attempt > maxRetries;
        const errMsg = error instanceof Error ? error.message : String(error);

        logger.warn(`Embedding API failure (attempt ${attempt}/${maxRetries})`, {
          error: errMsg,
          inputBatchCount: inputs.length,
          model,
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
