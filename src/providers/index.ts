import { Provider, ProviderAdapter } from "../types";
import { apiKeys } from "../config";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { OpenAIProvider } from "./openai";
import { logger } from "../utils/logger";

const registry = new Map<Provider, () => ProviderAdapter>([
  ["openai", () => new OpenAIProvider()],
  ["anthropic", () => new AnthropicProvider()],
  ["google", () => new GoogleProvider()],
]);

const instances = new Map<Provider, ProviderAdapter>();

export function getProvider(name: Provider): ProviderAdapter {
  let instance = instances.get(name);
  if (instance) return instance;

  const factory = registry.get(name);
  if (!factory) {
    throw new Error(`Unknown provider: ${name}`);
  }

  instance = factory();
  instances.set(name, instance);
  return instance;
}

export function getAvailableProviders(): Provider[] {
  return (Object.entries(apiKeys) as [Provider, string][])
    .filter(([, key]) => key.length > 0)
    .map(([provider]) => provider);
}

export function logProviderStatus(): void {
  const available = getAvailableProviders();
  logger.info("Provider status", {
    configured: available,
    missing: (["openai", "anthropic", "google"] as Provider[]).filter(
      (p) => !available.includes(p)
    ),
  });
}
