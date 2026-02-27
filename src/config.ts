import { config as loadEnv } from "dotenv";
import {
  BudgetConfig,
  ModelConfig,
  Provider,
  RateLimitConfig,
  RoutingStrategy,
} from "./types";

loadEnv();

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envNum(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? Number(val) : fallback;
}

export const budget: BudgetConfig = {
  monthlyLimitUsd: envNum("MONTHLY_BUDGET_USD", 100),
  dailyLimitUsd: envNum("DAILY_BUDGET_USD", 10),
  perRequestLimitUsd: envNum("PER_REQUEST_LIMIT_USD", 1),
};

export const rateLimit: RateLimitConfig = {
  maxRequestsPerMinute: envNum("MAX_REQUESTS_PER_MINUTE", 60),
  maxConcurrentRequests: envNum("MAX_CONCURRENT_REQUESTS", 10),
};

export const routing: RoutingStrategy = {
  preferredProvider: envStr("DEFAULT_PROVIDER", "anthropic") as Provider,
  fallbackProvider: envStr("FALLBACK_PROVIDER", "openai") as Provider,
  optimizeFor: "quality",
};

export const models: ModelConfig[] = [
  // OpenAI
  {
    provider: "openai",
    modelId: "gpt-4o",
    tier: "premium",
    maxTokens: 128000,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    supportsStreaming: true,
    supportsImages: true,
  },
  {
    provider: "openai",
    modelId: "gpt-4o-mini",
    tier: "fast",
    maxTokens: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    supportsStreaming: true,
    supportsImages: true,
  },
  // Anthropic
  {
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    tier: "premium",
    maxTokens: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    supportsStreaming: true,
    supportsImages: true,
  },
  {
    provider: "anthropic",
    modelId: "claude-haiku-3-5-20241022",
    tier: "fast",
    maxTokens: 200000,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    supportsStreaming: true,
    supportsImages: true,
  },
  // Google
  {
    provider: "google",
    modelId: "gemini-2.0-flash",
    tier: "standard",
    maxTokens: 1048576,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
    supportsStreaming: true,
    supportsImages: true,
  },
];

export const apiKeys: Record<Provider, string> = {
  openai: envStr("OPENAI_API_KEY", ""),
  anthropic: envStr("ANTHROPIC_API_KEY", ""),
  google: envStr("GOOGLE_API_KEY", ""),
};

export const logLevel = envStr("LOG_LEVEL", "info");
export const logFormat = envStr("LOG_FORMAT", "json");
