/**
 * LLM Provider abstraction for Recall.
 * Supports switching between providers via LLM_PROVIDER env var.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
  latencyMs?: number;
}

export interface LLMProvider {
  name: string;
  chat(request: LLMRequest): Promise<LLMResponse>;
}
