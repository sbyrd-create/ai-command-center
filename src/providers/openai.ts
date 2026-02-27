import OpenAI from "openai";
import { v4 as uuid } from "uuid";
import { apiKeys } from "../config";
import {
  CompletionRequest,
  CompletionResponse,
  ProviderAdapter,
} from "../types";
import { ProviderError } from "../utils/errors";
import { logger } from "../utils/logger";

export class OpenAIProvider implements ProviderAdapter {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: apiKeys.openai });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model ?? "gpt-4o-mini";
    const start = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      });

      const choice = response.choices[0];
      const usage = response.usage;

      return {
        id: uuid(),
        provider: "openai",
        model,
        content: choice?.message?.content ?? "",
        usage: {
          inputTokens: usage?.prompt_tokens ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        cost: 0, // calculated by CostTracker
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("OpenAI request failed", { model, error: message });
      throw new ProviderError("openai", message);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
