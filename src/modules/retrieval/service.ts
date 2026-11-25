/**
 * Scoped vector retrieval service.
 *
 * Implements tenant-isolated semantic search using pgvector cosine similarity.
 * Enforces embedding model consistency: rejects queries when contract chunks
 * were embedded with a different model than the currently configured model,
 * preventing silent cross-model vector distance corruption.
 * Every vector search strictly enforces WHERE user_id = $userId AND contract_id = $contractId.
 */

import { db } from "@/lib/db";
import { documentChunks } from "@/lib/db/schema";
import { and, eq, cosineDistance, asc, sql } from "drizzle-orm";
import {
  EmbeddingService,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from "@/modules/embeddings";

export class IncompatibleEmbeddingModelError extends Error {
  readonly storedModel: string | null;
  readonly configuredModel: string;

  constructor(message: string, storedModel: string | null, configuredModel: string) {
    super(message);
    this.name = "IncompatibleEmbeddingModelError";
    this.storedModel = storedModel;
    this.configuredModel = configuredModel;
  }
}

export interface RetrievedChunk {
  id: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  startCharOffset: number | null;
  endCharOffset: number | null;
  similarity: number;
  embeddingModel?: string | null;
}

export interface RetrievalOptions {
  limit?: number;
  minSimilarity?: number;
  model?: string;
}

export class RetrievalService {
  /**
   * Search for document chunks semantically similar to a query text.
   * Strictly isolated to the authenticated user and contract.
   * Enforces model consistency before generating query vectors.
   */
  static async searchSimilarChunks(
    queryText: string,
    contractId: string,
    userId: string,
    options?: RetrievalOptions
  ): Promise<RetrievedChunk[]> {
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.0;
    const configuredModel = options?.model ?? EMBEDDING_MODEL;

    // 1. Verify embedding model consistency across ALL distinct chunks for this contract
    const storedChunks = await db
      .selectDistinct({ embeddingModel: documentChunks.embeddingModel })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.contractId, contractId),
          eq(documentChunks.userId, userId)
        )
      );

    if (storedChunks.length === 0) {
      return [];
    }

    const distinctModels = Array.from(
      new Set(storedChunks.map((c) => c.embeddingModel).filter((m): m is string => Boolean(m)))
    );

    if (distinctModels.length > 1) {
      throw new IncompatibleEmbeddingModelError(
        `Inconsistent embedding models detected across chunks for contract ${contractId} (${distinctModels.join(", ")}). Chunks must be re-embedded before retrieval.`,
        distinctModels.join(", "),
        configuredModel
      );
    }

    const storedModel = distinctModels[0] || null;
    if (!storedModel || storedModel !== configuredModel) {
      throw new IncompatibleEmbeddingModelError(
        `Incompatible embedding model: contract chunks were indexed with "${storedModel ?? "unknown"}", but current configuration is "${configuredModel}". Chunks must be re-embedded before retrieval can proceed.`,
        storedModel,
        configuredModel
      );
    }

    // 2. Generate query embedding using asymmetric "query" mode
    const [queryVector] = await EmbeddingService.generateEmbeddings([queryText], {
      model: configuredModel,
      expectedDimensions: EMBEDDING_DIMENSIONS,
      inputType: "query",
    });

    if (!queryVector || queryVector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Failed to generate ${EMBEDDING_DIMENSIONS}-dimensional query embedding`);
    }

    return await this.searchByVector(queryVector, contractId, userId, {
      limit,
      minSimilarity,
      model: configuredModel,
    });
  }

  /**
   * Search document chunks using an existing embedding vector.
   * Guarantees strict multi-tenant scoping and model isolation.
   */
  static async searchByVector(
    queryVector: number[],
    contractId: string,
    userId: string,
    options?: RetrievalOptions
  ): Promise<RetrievedChunk[]> {
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.0;
    const configuredModel = options?.model ?? EMBEDDING_MODEL;

    const similarityExpr = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryVector)})`;

    const rows = await db
      .select({
        id: documentChunks.id,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        pageNumber: documentChunks.pageNumber,
        sectionTitle: documentChunks.sectionTitle,
        startCharOffset: documentChunks.startCharOffset,
        endCharOffset: documentChunks.endCharOffset,
        similarity: similarityExpr,
        embeddingModel: documentChunks.embeddingModel,
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.contractId, contractId),
          eq(documentChunks.userId, userId), // Tenant isolation
          eq(documentChunks.embeddingModel, configuredModel) // Model isolation
        )
      )
      .orderBy(asc(cosineDistance(documentChunks.embedding, queryVector)))
      .limit(limit);

    return rows
      .filter((r) => r.similarity >= minSimilarity)
      .map((r) => ({
        ...r,
        similarity: Number(r.similarity.toFixed(4)),
      }));
  }
}
