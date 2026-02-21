import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
import { LLMProvider, LLMRequest, LLMResponse } from '../types';

const DEFAULT_MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514-v1:0';

export class BedrockProvider implements LLMProvider {
  name = 'bedrock';
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    this.modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID;

    const config: Record<string, unknown> = {
      region: process.env.AWS_REGION || 'us-east-1',
    };

    // Use explicit credentials from env if available, otherwise fall back to default chain
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
      };
    }

    this.client = new BedrockRuntimeClient(config);
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();

    // Separate system message from conversation messages
    const systemMessages: SystemContentBlock[] = [];
    const conversationMessages: Message[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemMessages.push({ text: msg.content });
      } else {
        conversationMessages.push({
          role: msg.role,
          content: [{ text: msg.content }],
        });
      }
    }

    const command = new ConverseCommand({
      modelId: this.modelId,
      system: systemMessages.length > 0 ? systemMessages : undefined,
      messages: conversationMessages,
      inferenceConfig: {
        maxTokens: request.maxTokens || 500,
        temperature: request.temperature ?? 0.1,
      },
    });

    const response = await this.client.send(command);
    const latencyMs = Date.now() - start;

    const content =
      response.output?.message?.content
        ?.map((block) => ('text' in block ? block.text : ''))
        .join('') || '';

    return {
      content,
      tokensIn: response.usage?.inputTokens,
      tokensOut: response.usage?.outputTokens,
      model: this.modelId,
      latencyMs,
    };
  }
}
