import { LLMProvider } from './types';
import { BedrockProvider } from './providers/bedrock';
import { PerplexityProvider } from './providers/perplexity';

let cachedProvider: LLMProvider | null = null;
let cachedProviderName: string | null = null;

/**
 * Returns the configured LLM provider.
 * Set LLM_PROVIDER env var to switch: "bedrock" | "perplexity"
 * Defaults to "bedrock".
 */
export function createLLMProvider(): LLMProvider {
  const providerName = (process.env.LLM_PROVIDER || 'bedrock').toLowerCase();

  // Return cached instance if provider hasn't changed
  if (cachedProvider && cachedProviderName === providerName) {
    return cachedProvider;
  }

  switch (providerName) {
    case 'bedrock':
      cachedProvider = new BedrockProvider();
      break;
    case 'perplexity':
      cachedProvider = new PerplexityProvider();
      break;
    default:
      console.warn(`[Recall:LLM] Unknown provider "${providerName}", falling back to bedrock`);
      cachedProvider = new BedrockProvider();
  }

  cachedProviderName = providerName;
  return cachedProvider;
}
