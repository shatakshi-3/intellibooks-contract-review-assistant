/**
 * AI Provider factory.
 *
 * Returns the configured AI provider instance.
 * Currently supports OpenRouter; can be extended to support
 * direct OpenAI, Anthropic, or local models.
 */

import type { AIProvider } from "./types";
import { OpenRouterProvider } from "./openrouter";

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required. " +
        "Get your API key at https://openrouter.ai/keys"
    );
  }

  cachedProvider = new OpenRouterProvider({
    apiKey,
    appName: "IntelliBooks",
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
  });

  return cachedProvider;
}

// Re-export types for convenience
export type { AIProvider, ChatMessage, TextResult, AIConfig } from "./types";
export { getAIConfig } from "./types";
