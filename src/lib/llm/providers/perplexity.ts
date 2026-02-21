import { LLMProvider, LLMRequest, LLMResponse } from '../types';

export class PerplexityProvider implements LLMProvider {
  name = 'perplexity';
  private apiKey: string;

  constructor() {
    const key = process.env.PPLX_API_KEY;
    if (!key) throw new Error('PPLX_API_KEY is required for Perplexity provider');
    this.apiKey = key;
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens || 500,
        temperature: request.temperature ?? 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - start;
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
      model: 'sonar',
      latencyMs,
    };
  }
}
