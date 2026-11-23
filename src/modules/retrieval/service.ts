/**
 * Scoped vector retrieval service.
 *
 * Implements tenant-isolated semantic search using pgvector cosine similarity.
 * Every vector search strictly enforces WHERE user_id = $userId AND contract_id = $contractId.
 */

import { db } from "@/lib/db";
import { documentChunks } from "@/lib/db/schema";
import { and, eq, cosineDistance, asc, sql } from "drizzle-orm";
import { EmbeddingService } from "@/modules/embeddings";

export interface RetrievedChunk {
  id: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  startCharOffset: number | null;
  endCharOffset: number | null;
  similarity: number;
}

export interface RetrievalOptions {
  limit?: number;
  minSimilarity?: number;
}

export class RetrievalService {
  /**
   * Search for document chunks semantically similar to a query text.
   * Strictly isolated to the authenticated user and contract.
   */
  static async searchSimilarChunks(
    queryText: string,
    contractId: string,
    userId: string,
    options?: RetrievalOptions
  ): Promise<RetrievedChunk[]> {
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.0;

    // 1. Generate query embedding (1536 dims)
    const [queryVector] = await EmbeddingService.generateEmbeddings([queryText]);
    if (!queryVector || queryVector.length !== 1536) {
      throw new Error("Failed to generate 1536-dimensional query embedding");
    }

    return await this.searchByVector(queryVector, contractId, userId, {
      limit,
      minSimilarity,
    });
  }

  /**
   * Search document chunks using an existing embedding vector.
   * Guarantees strict multi-tenant scoping.
   */
  static async searchByVector(
    queryVector: number[],
    contractId: string,
    userId: string,
    options?: RetrievalOptions
  ): Promise<RetrievedChunk[]> {
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.0;

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
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.contractId, contractId),
          eq(documentChunks.userId, userId) // Tenant isolation
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
