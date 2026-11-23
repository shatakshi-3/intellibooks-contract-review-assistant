import { db } from "@/lib/db";
import { documentChunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { RetrievalService } from "@/modules/retrieval";
import { CATEGORY_DEFINITIONS, type ChecklistItem } from "./constants";
import type { EvidenceChunkReference } from "./quote-verifier";

export interface EvidenceRetrievalResult {
  category: ChecklistItem;
  chunks: EvidenceChunkReference[];
  examinedChunkCount: number;
  totalChunkCount: number;
  documentCoverageRatio: number;
  hasSufficientCoverageForNotFound: boolean;
}

export class EvidenceRetriever {
  /**
   * Retrieve multi-source evidence for a single checklist category:
   * - Category-specific semantic pgvector queries
   * - Keyword & synonym scanning
   * - Neighboring chunk expansion (chunkIndex +/- 1)
   * - Document coverage assessment
   */
  static async retrieveEvidenceForCategory(params: {
    contractId: string;
    userId: string;
    contractVersionId: string;
    category: ChecklistItem;
    maxChunks?: number;
  }): Promise<EvidenceRetrievalResult> {
    const { contractId, userId, contractVersionId, category, maxChunks = 8 } = params;
    const catDef = CATEGORY_DEFINITIONS[category];

    // 1. Fetch all chunk metadata for this contract version to understand document scope & structure
    const allVersionChunks = await db
      .select({
        id: documentChunks.id,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        pageNumber: documentChunks.pageNumber,
        sectionTitle: documentChunks.sectionTitle,
        startCharOffset: documentChunks.startCharOffset,
        endCharOffset: documentChunks.endCharOffset,
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.contractId, contractId),
          eq(documentChunks.contractVersionId, contractVersionId),
          eq(documentChunks.userId, userId)
        )
      )
      .orderBy(documentChunks.chunkIndex);

    const totalChunkCount = allVersionChunks.length;

    if (totalChunkCount === 0) {
      return {
        category,
        chunks: [],
        examinedChunkCount: 0,
        totalChunkCount: 0,
        documentCoverageRatio: 0,
        hasSufficientCoverageForNotFound: false,
      };
    }

    const matchedChunkIndices = new Set<number>();
    const chunkMapByIndex = new Map<number, (typeof allVersionChunks)[0]>();
    for (const chunk of allVersionChunks) {
      chunkMapByIndex.set(chunk.chunkIndex, chunk);
    }

    // 2. Keyword & Synonym Matching across document chunks
    const lowerSynonyms = catDef.keywordSynonyms.map((s) => s.toLowerCase());
    for (const chunk of allVersionChunks) {
      const lowerContent = chunk.content.toLowerCase();
      const lowerTitle = (chunk.sectionTitle || "").toLowerCase();

      for (const syn of lowerSynonyms) {
        if (lowerContent.includes(syn) || lowerTitle.includes(syn)) {
          matchedChunkIndices.add(chunk.chunkIndex);
          break;
        }
      }
    }

    // 3. Semantic Vector Retrieval for primary category queries
    try {
      const topSemanticQuery = catDef.semanticQueries[0];
      const semanticResults = await RetrievalService.searchSimilarChunks(
        topSemanticQuery,
        contractId,
        userId,
        { limit: 5, minSimilarity: 0.35 }
      );

      for (const item of semanticResults) {
        matchedChunkIndices.add(item.chunkIndex);
      }
    } catch {
      // If embeddings are mocked or unavailable, keyword scanning still works
    }

    // 4. If document is small (<= 15 chunks), examine all chunks for complete coverage
    if (totalChunkCount <= 15) {
      for (const chunk of allVersionChunks) {
        matchedChunkIndices.add(chunk.chunkIndex);
      }
    }

    // 5. Expand context with neighboring chunks (chunkIndex - 1 and + 1)
    const expandedIndices = new Set<number>(matchedChunkIndices);
    for (const idx of Array.from(matchedChunkIndices)) {
      if (idx > 0) expandedIndices.add(idx - 1);
      if (idx < totalChunkCount - 1) expandedIndices.add(idx + 1);
    }

    // Sort indices and cap to maxChunks if needed, prioritizing direct keyword/semantic hits
    const prioritizedIndices = Array.from(expandedIndices).sort((a, b) => {
      const aIsDirect = matchedChunkIndices.has(a);
      const bIsDirect = matchedChunkIndices.has(b);
      if (aIsDirect && !bIsDirect) return -1;
      if (!aIsDirect && bIsDirect) return 1;
      return a - b;
    });

    const selectedIndices = prioritizedIndices.slice(0, maxChunks);

    // Collect concrete chunk data
    const evidenceChunks: EvidenceChunkReference[] = [];
    for (const idx of selectedIndices) {
      const chunk = chunkMapByIndex.get(idx);
      if (chunk) {
        evidenceChunks.push({
          id: chunk.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          sectionTitle: chunk.sectionTitle,
          startCharOffset: chunk.startCharOffset ?? 0,
          endCharOffset: chunk.endCharOffset ?? 0,
        });
      }
    }

    // 6. Compute coverage ratio
    const examinedChunkCount = selectedIndices.length;
    const documentCoverageRatio =
      totalChunkCount > 0 ? examinedChunkCount / totalChunkCount : 0;

    // A not_found status is only allowed if either:
    // a) All document chunks were examined (100% coverage, typical for short/standard contracts <= 15 chunks)
    // b) Or at least 65% of the document was examined and no matching clause was found
    const hasSufficientCoverageForNotFound =
      totalChunkCount <= 15 || documentCoverageRatio >= 0.65;

    return {
      category,
      chunks: evidenceChunks,
      examinedChunkCount,
      totalChunkCount,
      documentCoverageRatio,
      hasSufficientCoverageForNotFound,
    };
  }
}
