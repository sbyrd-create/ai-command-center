import { budget } from "../config";
import {
  BudgetConfig,
  CostSnapshot,
  CompletionResponse,
  ModelConfig,
} from "../types";
import { BudgetExceededError } from "../utils/errors";
import { logger } from "../utils/logger";
import { models } from "../config";

interface CostRecord {
  timestamp: Date;
  cost: number;
  provider: string;
  model: string;
}

export class CostTracker {
  private records: CostRecord[] = [];
  private budgetConfig: BudgetConfig;

  constructor(overrides?: Partial<BudgetConfig>) {
    this.budgetConfig = { ...budget, ...overrides };
  }

  calculateCost(response: CompletionResponse): number {
    const modelConfig = models.find(
      (m) => m.modelId === response.model && m.provider === response.provider
    );

    if (!modelConfig) {
      logger.warn("Unknown model for cost calculation", {
        provider: response.provider,
        model: response.model,
      });
      return 0;
    }

    const inputCost =
      (response.usage.inputTokens / 1000) * modelConfig.costPer1kInput;
    const outputCost =
      (response.usage.outputTokens / 1000) * modelConfig.costPer1kOutput;

    return inputCost + outputCost;
  }

  record(response: CompletionResponse): number {
    const cost = this.calculateCost(response);
    this.records.push({
      timestamp: new Date(),
      cost,
      provider: response.provider,
      model: response.model,
    });

    logger.debug("Cost recorded", {
      cost: cost.toFixed(6),
      provider: response.provider,
      model: response.model,
    });

    return cost;
  }

  checkBudget(estimatedCost: number): void {
    const snapshot = this.getSnapshot();

    if (estimatedCost > this.budgetConfig.perRequestLimitUsd) {
      throw new BudgetExceededError(
        "per_request",
        estimatedCost,
        this.budgetConfig.perRequestLimitUsd
      );
    }

    if (snapshot.daily + estimatedCost > this.budgetConfig.dailyLimitUsd) {
      throw new BudgetExceededError(
        "daily",
        snapshot.daily,
        this.budgetConfig.dailyLimitUsd
      );
    }

    if (snapshot.monthly + estimatedCost > this.budgetConfig.monthlyLimitUsd) {
      throw new BudgetExceededError(
        "monthly",
        snapshot.monthly,
        this.budgetConfig.monthlyLimitUsd
      );
    }
  }

  estimateCost(
    modelConfig: ModelConfig,
    inputTokens: number,
    expectedOutputTokens: number
  ): number {
    return (
      (inputTokens / 1000) * modelConfig.costPer1kInput +
      (expectedOutputTokens / 1000) * modelConfig.costPer1kOutput
    );
  }

  getSnapshot(): CostSnapshot {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const daily = this.records
      .filter((r) => r.timestamp >= startOfDay)
      .reduce((sum, r) => sum + r.cost, 0);

    const monthly = this.records
      .filter((r) => r.timestamp >= startOfMonth)
      .reduce((sum, r) => sum + r.cost, 0);

    const total = this.records.reduce((sum, r) => sum + r.cost, 0);
    const avg = this.records.length > 0 ? total / this.records.length : 0;
    const last = this.records.length > 0 ? this.records.at(-1)!.cost : 0;

    return {
      daily,
      monthly,
      perRequestAvg: avg,
      lastRequest: last,
    };
  }

  reset(): void {
    this.records = [];
  }
}
