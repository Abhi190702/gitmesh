import * as p from "@clack/prompts";
import type { LlmConfig } from "../config/schema.js";

const VALID_PROVIDERS = ["claude", "openai"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

function providerLabel(v: Provider): string {
  return v === "claude" ? "Claude (Anthropic)" : "OpenAI";
}

async function promptProvider(): Promise<Provider | null> {
  const selected = await p.select({
    message: "Select an LLM provider",
    options: VALID_PROVIDERS.map((v) => ({ value: v, label: providerLabel(v) })),
  });
  if (p.isCancel(selected)) return null;
  return selected as Provider;
}

async function promptApiKey(provider: Provider): Promise<string | null> {
  const key = await p.password({
    message: `Enter your ${providerLabel(provider)} API key`,
    validate: (val) => (val.trim().length === 0 ? "API key is required" : undefined),
  });
  if (p.isCancel(key)) return null;
  return typeof key === "string" ? key.trim() : null;
}

export async function promptLlm(): Promise<LlmConfig | undefined> {
  const confirmed = await p.confirm({
    message: "Configure an LLM provider now?",
    initialValue: false,
  });

  if (p.isCancel(confirmed)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (!confirmed) return undefined;

  const provider = await promptProvider();
  if (!provider) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const apiKey = await promptApiKey(provider);
  if (!apiKey) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  return { provider, apiKey };
}
