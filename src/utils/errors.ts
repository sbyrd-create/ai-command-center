import { Provider } from "../types";

export class CommandCenterError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "CommandCenterError";
  }
}

export class ProviderError extends CommandCenterError {
  constructor(
    public readonly provider: Provider,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message, "PROVIDER_ERROR");
    this.name = "ProviderError";
  }
}

export class BudgetExceededError extends CommandCenterError {
  constructor(
    public readonly limitType: "daily" | "monthly" | "per_request",
    public readonly currentSpend: number,
    public readonly limit: number
  ) {
    super(
      `${limitType} budget exceeded: $${currentSpend.toFixed(4)} / $${limit.toFixed(2)}`,
      "BUDGET_EXCEEDED"
    );
    this.name = "BudgetExceededError";
  }
}

export class RateLimitError extends CommandCenterError {
  constructor(message: string) {
    super(message, "RATE_LIMIT");
    this.name = "RateLimitError";
  }
}

export class NoProviderAvailableError extends CommandCenterError {
  constructor(reason: string) {
    super(`No provider available: ${reason}`, "NO_PROVIDER");
    this.name = "NoProviderAvailableError";
  }
}
