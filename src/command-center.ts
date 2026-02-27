import { CostTracker, RateLimiter } from "./cost";
import { getProvider } from "./providers";
import { Router } from "./router";
import {
  CompletionRequest,
  CompletionResponse,
  CostSnapshot,
  Provider,
  ProviderHealth,
  RoutingStrategy,
} from "./types";
import { logger } from "./utils/logger";

export interface CommandCenterOptions {
  routing?: Partial<RoutingStrategy>;
}

export class CommandCenter {
  private router: Router;
  private costTracker: CostTracker;
  private rateLimiter: RateLimiter;

  constructor(options?: CommandCenterOptions) {
    this.router = new Router(options?.routing);
    this.costTracker = new CostTracker();
    this.rateLimiter = new RateLimiter();
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const release = await this.rateLimiter.acquire();

    try {
      const modelConfig = this.router.selectModel(request);

      // Estimate cost and check budget
      const estimatedInputTokens = this.estimateTokens(request);
      const estimatedCost = this.costTracker.estimateCost(
        modelConfig,
        estimatedInputTokens,
        request.maxTokens ?? 4096
      );
      this.costTracker.checkBudget(estimatedCost);

      logger.info("Routing request", {
        provider: modelConfig.provider,
        model: modelConfig.modelId,
        tier: modelConfig.tier,
        estimatedCost: estimatedCost.toFixed(6),
      });

      const provider = getProvider(modelConfig.provider);
      const enrichedRequest: CompletionRequest = {
        ...request,
        model: modelConfig.modelId,
        provider: modelConfig.provider,
      };

      const response = await provider.complete(enrichedRequest);

      // Track actual cost
      const actualCost = this.costTracker.record(response);
      response.cost = actualCost;

      logger.info("Request completed", {
        provider: response.provider,
        model: response.model,
        tokens: response.usage.totalTokens,
        cost: actualCost.toFixed(6),
        latencyMs: response.latencyMs,
      });

      return response;
    } catch (error) {
      // Attempt fallback if the primary provider fails
      if (request.provider === undefined) {
        return this.tryFallback(request, error);
      }
      throw error;
    } finally {
      release();
    }
  }

  private async tryFallback(
    request: CompletionRequest,
    originalError: unknown
  ): Promise<CompletionResponse> {
    const healthy = this.router.getHealthyProviders();

    for (const provider of healthy) {
      if (provider === request.provider) continue;

      try {
        logger.warn("Falling back to alternate provider", { provider });
        return await this.complete({ ...request, provider });
      } catch {
        continue;
      }
    }

    throw originalError;
  }

  async healthCheck(): Promise<Map<Provider, ProviderHealth>> {
    const providers: Provider[] = ["openai", "anthropic", "google"];
    await Promise.allSettled(
      providers.map((p) => this.router.updateHealth(p))
    );
    return this.router.getHealth();
  }

  getCostSnapshot(): CostSnapshot {
    return this.costTracker.getSnapshot();
  }

  private estimateTokens(request: CompletionRequest): number {
    // Rough estimate: ~4 chars per token
    const totalChars = request.messages.reduce(
      (sum, m) => sum + m.content.length,
      0
    );
    return Math.ceil(totalChars / 4);
  }
}
