/**
 * AI Provider abstraction layer.
 *
 * Defines the interface that all AI providers must implement.
 * This allows swapping OpenRouter for direct OpenAI, Anthropic,
 * or local models without changing business logic.
 */

import { z } from "zod";

// ─── Message Types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─── Result Types ────────────────────────────────────────────────────────────

export interface TextResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface AIProvider {
  /**
   * Generate a text completion.
   */
  generateText(params: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<TextResult>;

  /**
   * Generate structured output validated against a Zod schema.
   * Uses JSON mode or function calling depending on the provider.
   */
  generateStructured<T>(params: {
    model: string;
    messages: ChatMessage[];
    schema: z.ZodSchema<T>;
    schemaName?: string;
    temperature?: number;
  }): Promise<T>;

  /**
   * Generate embeddings for a batch of texts.
   * Returns an array of embedding vectors.
   */
  generateEmbeddings(params: {
    model: string;
    inputs: string[];
  }): Promise<number[][]>;

  /**
   * Stream a text completion. Returns an async iterable of text chunks.
   */
  streamText(params: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<string>;
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface AIConfig {
  reviewModel: string;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  promptVersion: string;
}

export function getAIConfig(): AIConfig {
  return {
    reviewModel: process.env.AI_REVIEW_MODEL || "google/gemini-2.5-flash",
    chatModel: process.env.AI_CHAT_MODEL || "google/gemini-2.5-flash",
    embeddingModel: process.env.AI_EMBEDDING_MODEL || "openai/text-embedding-3-small",
    embeddingDimensions: parseInt(process.env.AI_EMBEDDING_DIMENSIONS || "1536", 10),
    promptVersion: process.env.PROMPT_VERSION || "v1",
  };
}
