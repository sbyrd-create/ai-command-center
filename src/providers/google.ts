import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuid } from "uuid";
import { apiKeys } from "../config";
import {
  CompletionRequest,
  CompletionResponse,
  ProviderAdapter,
} from "../types";
import { ProviderError } from "../utils/errors";
import { logger } from "../utils/logger";

export class GoogleProvider implements ProviderAdapter {
  readonly name = "google" as const;
  private client: GoogleGenerativeAI;

  constructor() {
    this.client = new GoogleGenerativeAI(apiKeys.google);
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const modelId = request.model ?? "gemini-2.0-flash";
    const start = Date.now();

    try {
      const model = this.client.getGenerativeModel({ model: modelId });

      const systemMsg = request.messages.find((m) => m.role === "system");
      const history = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const lastMessage = history.pop();
      if (!lastMessage) {
        throw new Error("No user message provided");
      }

      const chat = model.startChat({
        history,
        systemInstruction: systemMsg
          ? { role: "user", parts: [{ text: systemMsg.content }] }
          : undefined,
      });

      const result = await chat.sendMessage(
        lastMessage.parts.map((p) => p.text).join("\n")
      );

      const response = result.response;
      const usage = response.usageMetadata;

      return {
        id: uuid(),
        provider: "google",
        model: modelId,
        content: response.text(),
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        cost: 0,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Google request failed", { model: modelId, error: message });
      throw new ProviderError("google", message);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({
        model: "gemini-2.0-flash",
      });
      await model.generateContent("ping");
      return true;
    } catch {
      return false;
    }
  }
}
