import { models, routing as defaultRouting } from "../config";
import {
  CompletionRequest,
  ModelConfig,
  ModelTier,
  Provider,
  ProviderHealth,
  RoutingStrategy,
} from "../types";
import { NoProviderAvailableError } from "../utils/errors";
import { logger } from "../utils/logger";
import { getAvailableProviders, getProvider } from "../providers";

export class Router {
  private healthMap = new Map<Provider, ProviderHealth>();
  private strategy: RoutingStrategy;

  constructor(strategy?: Partial<RoutingStrategy>) {
    this.strategy = { ...defaultRouting, ...strategy };
  }

  selectModel(request: CompletionRequest): ModelConfig {
    const tier = request.tier ?? "standard";
    const available = this.getHealthyProviders();

    if (available.length === 0) {
      throw new NoProviderAvailableError("All providers are unavailable");
    }

    // If a specific provider is requested, use it
    if (request.provider && available.includes(request.provider)) {
      return this.findModel(request.provider, tier);
    }

    // Try preferred provider first
    if (
      this.strategy.preferredProvider &&
      available.includes(this.strategy.preferredProvider)
    ) {
      try {
        return this.findModel(this.strategy.preferredProvider, tier);
      } catch {
        logger.warn("Preferred provider has no matching model", {
          provider: this.strategy.preferredProvider,
          tier,
        });
      }
    }

    // Optimize based on strategy
    const candidates = models
      .filter((m) => available.includes(m.provider))
      .filter((m) => this.matchesTier(m, tier));

    if (candidates.length === 0) {
      throw new NoProviderAvailableError(
        `No model available for tier: ${tier}`
      );
    }

    switch (this.strategy.optimizeFor) {
      case "cost":
        return candidates.sort(
          (a, b) => a.costPer1kInput + a.costPer1kOutput - (b.costPer1kInput + b.costPer1kOutput)
        )[0];
      case "latency": {
        return this.sortByLatency(candidates)[0];
      }
      case "quality":
      default:
        return candidates[0];
    }
  }

  async updateHealth(provider: Provider): Promise<void> {
    try {
      const adapter = getProvider(provider);
      const start = Date.now();
      const available = await adapter.healthCheck();

      this.healthMap.set(provider, {
        provider,
        available,
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
        consecutiveFailures: available
          ? 0
          : (this.healthMap.get(provider)?.consecutiveFailures ?? 0) + 1,
      });
    } catch {
      const prev = this.healthMap.get(provider);
      this.healthMap.set(provider, {
        provider,
        available: false,
        latencyMs: null,
        lastChecked: new Date(),
        consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
      });
    }
  }

  getHealthyProviders(): Provider[] {
    const configured = getAvailableProviders();
    const allowed = this.strategy.allowedProviders ?? configured;

    return allowed.filter((p) => {
      if (!configured.includes(p)) return false;
      const health = this.healthMap.get(p);
      // If never checked, assume healthy
      if (!health) return true;
      return health.available;
    });
  }

  getHealth(): Map<Provider, ProviderHealth> {
    return new Map(this.healthMap);
  }

  private findModel(provider: Provider, tier: ModelTier): ModelConfig {
    const match = models.find(
      (m) => m.provider === provider && this.matchesTier(m, tier)
    );
    if (!match) {
      throw new Error(`No ${tier} model for ${provider}`);
    }
    return match;
  }

  private matchesTier(model: ModelConfig, tier: ModelTier): boolean {
    if (tier === "standard") return true; // standard accepts any tier
    return model.tier === tier;
  }

  private sortByLatency(candidates: ModelConfig[]): ModelConfig[] {
    return [...candidates].sort((a, b) => {
      const latA = this.healthMap.get(a.provider)?.latencyMs ?? Infinity;
      const latB = this.healthMap.get(b.provider)?.latencyMs ?? Infinity;
      return latA - latB;
    });
  }
}
