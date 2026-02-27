import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import { apiKeys } from "../config";
import {
  CompletionRequest,
  CompletionResponse,
  ProviderAdapter,
} from "../types";
import { ProviderError } from "../utils/errors";
import { logger } from "../utils/logger";

export class AnthropicProvider implements ProviderAdapter {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: apiKeys.anthropic });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model ?? "claude-sonnet-4-20250514";
    const start = Date.now();

    const systemMsg = request.messages.find((m) => m.role === "system");
    const userMessages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: request.maxTokens ?? 4096,
        system: systemMsg?.content,
        messages: userMessages,
      });

      const content = response.content
        .filter((block) => block.type === "text")
        .map((block) => {
          if (block.type === "text") return block.text;
          return "";
        })
        .join("");

      return {
        id: uuid(),
        provider: "anthropic",
        model,
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
        cost: 0,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Anthropic request failed", { model, error: message });
      throw new ProviderError("anthropic", message);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: "claude-haiku-3-5-20241022",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
