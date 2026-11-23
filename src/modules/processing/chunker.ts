import type { ExtractionResult, ExtractedSection } from "./extractors/types";

export interface ChunkingConfig {
  targetChunkTokens?: number; // default: 500
  overlapTokens?: number; // default: 50
  minChunkChars?: number; // default: 80
}

export interface DocumentChunkData {
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  sectionTitle?: string;
  sectionNumber?: number;
  startCharOffset: number;
  endCharOffset: number;
  metadata: {
    tokenCountEstimate: number;
    charLength: number;
  };
}

const CHARS_PER_TOKEN = 4;

interface StructuralBlock {
  text: string;
  startOffset: number;
  endOffset: number;
}

export class DocumentChunker {
  private readonly targetChars: number;
  private readonly overlapChars: number;
  private readonly minChars: number;

  constructor(config?: ChunkingConfig) {
    const targetTokens = config?.targetChunkTokens ?? 500;
    const overlapTokens = config?.overlapTokens ?? 50;
    this.targetChars = targetTokens * CHARS_PER_TOKEN; // ~2000 chars
    this.overlapChars = overlapTokens * CHARS_PER_TOKEN; // ~200 chars
    this.minChars = config?.minChunkChars ?? 80;
  }

  /**
   * Split an extracted document into structure-aware, traceable chunks.
   * Every chunk is guaranteed to be an exact contiguous slice of fullText.
   */
  chunk(extraction: ExtractionResult): DocumentChunkData[] {
    const { fullText, pages, sections } = extraction;
    if (!fullText || fullText.trim().length === 0) {
      return [];
    }

    const chunks: DocumentChunkData[] = [];
    let chunkIndex = 0;

    if (pages && pages.length > 0) {
      for (const page of pages) {
        const pageChunks = this.chunkRegion(
          page.text,
          page.startOffset,
          fullText,
          page.pageNumber,
          sections
        );

        for (const pc of pageChunks) {
          chunks.push({
            ...pc,
            chunkIndex: chunkIndex++,
          });
        }
      }
    } else {
      const docChunks = this.chunkRegion(fullText, 0, fullText, 1, sections);
      for (const dc of docChunks) {
        chunks.push({
          ...dc,
          chunkIndex: chunkIndex++,
        });
      }
    }

    return chunks;
  }

  private chunkRegion(
    regionText: string,
    regionBaseOffset: number,
    fullText: string,
    pageNumber: number,
    sections: ExtractedSection[]
  ): Omit<DocumentChunkData, "chunkIndex">[] {
    if (!regionText || regionText.trim().length === 0) return [];

    const blocks = this.locateStructuralBlocks(regionText, regionBaseOffset);
    if (blocks.length === 0) return [];

    const result: Omit<DocumentChunkData, "chunkIndex">[] = [];
    let i = 0;

    while (i < blocks.length) {
      const startBlock = blocks[i];
      let j = i;
      while (j + 1 < blocks.length) {
        const nextBlock = blocks[j + 1];
        const nextLen = nextBlock.endOffset - startBlock.startOffset;
        if (nextLen <= this.targetChars) {
          j++;
        } else {
          break;
        }
      }

      // Slice exact contiguous text from fullText
      const chunkStart = startBlock.startOffset;
      const chunkEnd = blocks[j].endOffset;
      const content = fullText.substring(chunkStart, chunkEnd);

      if (content.trim().length >= this.minChars || result.length === 0) {
        result.push({
          content,
          pageNumber,
          sectionTitle: this.findEnclosingSection(chunkStart, sections),
          startCharOffset: chunkStart,
          endCharOffset: chunkEnd,
          metadata: {
            tokenCountEstimate: Math.ceil(content.length / CHARS_PER_TOKEN),
            charLength: content.length,
          },
        });
      }

      // Advance index with overlap if multiple blocks were included
      if (j > i && this.overlapChars > 0) {
        // Step forward but retain the last block as overlap if it fits
        i = j;
      } else {
        i = j + 1;
      }
    }

    return result;
  }

  /**
   * Split region into discrete structural blocks and locate their exact offsets in fullText.
   */
  private locateStructuralBlocks(regionText: string, baseOffset: number): StructuralBlock[] {
    const rawParagraphs = regionText.split(/\n\s*\n/);
    const blocks: StructuralBlock[] = [];
    let searchPos = 0;

    for (const para of rawParagraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      const idx = regionText.indexOf(trimmed, searchPos);
      const start = idx !== -1 ? baseOffset + idx : baseOffset + searchPos;
      const end = start + trimmed.length;
      searchPos = idx !== -1 ? idx + trimmed.length : searchPos + trimmed.length;

      // If paragraph is oversized, split at sentence boundaries
      if (trimmed.length > this.targetChars * 1.5) {
        const sentences = trimmed.split(/(?<=\.\s+)(?=[A-Z0-9])/);
        let sSearchPos = idx !== -1 ? idx : 0;
        for (const sent of sentences) {
          const sTrimmed = sent.trim();
          if (!sTrimmed) continue;
          const sIdx = regionText.indexOf(sTrimmed, sSearchPos);
          const sStart = sIdx !== -1 ? baseOffset + sIdx : baseOffset + sSearchPos;
          const sEnd = sStart + sTrimmed.length;
          sSearchPos = sIdx !== -1 ? sIdx + sTrimmed.length : sSearchPos + sTrimmed.length;

          blocks.push({
            text: sTrimmed,
            startOffset: sStart,
            endOffset: sEnd,
          });
        }
      } else {
        blocks.push({
          text: trimmed,
          startOffset: start,
          endOffset: end,
        });
      }
    }

    return blocks;
  }

  private findEnclosingSection(offset: number, sections: ExtractedSection[]): string | undefined {
    if (!sections || sections.length === 0) return undefined;

    let activeSection: ExtractedSection | undefined;
    for (const sec of sections) {
      if (sec.startOffset <= offset) {
        activeSection = sec;
      } else {
        break;
      }
    }

    return activeSection?.title;
  }
}
