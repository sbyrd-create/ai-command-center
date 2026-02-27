export type Provider = "openai" | "anthropic" | "google";

export type ModelTier = "fast" | "standard" | "premium";

export interface ModelConfig {
  provider: Provider;
  modelId: string;
  tier: ModelTier;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  supportsStreaming: boolean;
  supportsImages: boolean;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  messages: Message[];
  model?: string;
  provider?: Provider;
  tier?: ModelTier;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CompletionResponse {
  id: string;
  provider: Provider;
  model: string;
  content: string;
  usage: TokenUsage;
  cost: number;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ProviderHealth {
  provider: Provider;
  available: boolean;
  latencyMs: number | null;
  lastChecked: Date;
  consecutiveFailures: number;
}

export interface CostSnapshot {
  daily: number;
  monthly: number;
  perRequestAvg: number;
  lastRequest: number;
}

export interface BudgetConfig {
  monthlyLimitUsd: number;
  dailyLimitUsd: number;
  perRequestLimitUsd: number;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxConcurrentRequests: number;
}

export interface RoutingStrategy {
  preferredProvider?: Provider;
  fallbackProvider?: Provider;
  optimizeFor: "cost" | "latency" | "quality";
  allowedProviders?: Provider[];
}

export interface Task {
  id: string;
  description: string;
  subtasks: Subtask[];
  status: TaskStatus;
  result?: string;
  createdAt: Date;
  completedAt?: Date;
}

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface Subtask {
  id: string;
  parentId: string;
  description: string;
  prompt: string;
  dependencies: string[];
  status: TaskStatus;
  result?: string;
  tier?: ModelTier;
}

export interface ProviderAdapter {
  readonly name: Provider;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  healthCheck(): Promise<boolean>;
}
