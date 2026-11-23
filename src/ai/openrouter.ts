/**
 * OpenRouter AI provider implementation.
 *
 * Implements the AIProvider interface using OpenRouter's
 * OpenAI-compatible API. Supports:
 * - Text generation
 * - Structured JSON output
 * - Embedding generation
 * - Streaming text
 */

import { z } from "zod";
import type { AIProvider, ChatMessage, TextResult } from "./types";
import { logger } from "@/lib/logger";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface OpenRouterConfig {
  apiKey: string;
  appName?: string;
  appUrl?: string;
}

export class OpenRouterProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly headers: Record<string, string>;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(config.appName && { "X-Title": config.appName }),
      ...(config.appUrl && { "HTTP-Referer": config.appUrl }),
    };
  }

  async generateText(params: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<TextResult> {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.1,
        max_tokens: params.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("OpenRouter text generation failed", {
        status: response.status,
        error,
        model: params.model,
      });
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.content) {
      throw new Error("No content in OpenRouter response");
    }

    return {
      content: choice.message.content,
      model: data.model || params.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async generateStructured<T>(params: {
    model: string;
    messages: ChatMessage[];
    schema: z.ZodSchema<T>;
    schemaName?: string;
    temperature?: number;
  }): Promise<T> {
    // Use JSON mode with schema instruction in system prompt
    const schemaDescription = JSON.stringify(
      zodToJsonSchema(params.schema),
      null,
      2
    );

    const messages: ChatMessage[] = [
      ...params.messages,
      {
        role: "system" as const,
        content: `Respond ONLY with valid JSON matching this schema:\n${schemaDescription}\n\nDo not include any text outside the JSON object.`,
      },
    ];

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        model: params.model,
        messages,
        temperature: params.temperature ?? 0,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("OpenRouter structured generation failed", {
        status: response.status,
        error,
        model: params.model,
      });
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    // Parse and validate against schema
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.error("Failed to parse structured response as JSON", {
        content: content.substring(0, 500),
      });
      throw new Error("AI response was not valid JSON");
    }

    const result = params.schema.safeParse(parsed);
    if (!result.success) {
      logger.error("Structured response failed schema validation", {
        errors: result.error.issues,
        content: content.substring(0, 500),
      });
      throw new Error(
        `AI response did not match expected schema: ${result.error.message}`
      );
    }

    return result.data;
  }

  async generateEmbeddings(params: {
    model: string;
    inputs: string[];
  }): Promise<number[][]> {
    const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        model: params.model,
        input: params.inputs,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("OpenRouter embedding generation failed", {
        status: response.status,
        error,
        model: params.model,
        inputCount: params.inputs.length,
      });
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid embedding response format");
    }

    // Sort by index to ensure order matches input
    const sorted = data.data.sort(
      (a: { index: number }, b: { index: number }) => a.index - b.index
    );

    return sorted.map((item: { embedding: number[] }) => item.embedding);
  }

  async *streamText(params: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncIterable<string> {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("OpenRouter streaming failed", {
        status: response.status,
        error,
        model: params.model,
      });
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    if (!response.body) {
      throw new Error("No response body for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/**
 * Minimal Zod-to-JSON-Schema converter for prompt injection.
 * Handles the common types used in our review schemas.
 */
function zodToJsonSchema(schema: any): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return { type: "object", properties, required };
  }

  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchema(schema.element) };
  }

  if (schema instanceof z.ZodString) return { type: "string" };
  if (schema instanceof z.ZodNumber) return { type: "number" };
  if (schema instanceof z.ZodBoolean) return { type: "boolean" };

  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }

  if (schema instanceof z.ZodNullable) {
    const inner = zodToJsonSchema(schema.unwrap());
    return { ...inner, nullable: true };
  }

  return { type: "string" }; // fallback
}
