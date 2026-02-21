import { NextRequest, NextResponse } from 'next/server';
import { getTokenLogs, clearTokenLogs, ROUTE_DESCRIPTIONS } from '@/lib/llm/token-logger';

// Pricing per 1M tokens (input / output) by model ID pattern
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'deepseek.v3.2': { input: 0.62, output: 1.85 },
  'openai.gpt-oss-safeguard-120b': { input: 0.18, output: 0.71 },
  'mistral.mistral-large-2402-v1:0': { input: 4.00, output: 12.00 },
  'us.anthropic.claude-sonnet-4-20250514-v1:0': { input: 3.00, output: 15.00 },
  'sonar': { input: 1.00, output: 1.00 },
};

function getModelPricing(model: string): { input: number; output: number } | null {
  // Exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // Partial match (model ID might have extra suffixes)
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.includes(key) || key.includes(model)) return pricing;
  }
  return null;
}

function estimateCost(tokensIn: number, tokensOut: number, model: string): number | null {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  return (tokensIn / 1_000_000) * pricing.input + (tokensOut / 1_000_000) * pricing.output;
}

export async function GET() {
  const logs = getTokenLogs();

  // Compute summary stats
  const totalCalls = logs.length;
  const successCalls = logs.filter(l => l.success).length;
  const failedCalls = totalCalls - successCalls;
  const totalTokensIn = logs.reduce((sum, l) => sum + (l.tokensIn || 0), 0);
  const totalTokensOut = logs.reduce((sum, l) => sum + (l.tokensOut || 0), 0);
  const avgLatency = successCalls > 0
    ? Math.round(logs.filter(l => l.success && l.latencyMs).reduce((sum, l) => sum + (l.latencyMs || 0), 0) / successCalls)
    : 0;

  // Per-route breakdown
  const byRoute: Record<string, { calls: number; tokensIn: number; tokensOut: number; avgLatency: number; errors: number; description: string; cost: number | null }> = {};
  for (const log of logs) {
    if (!byRoute[log.route]) {
      byRoute[log.route] = { calls: 0, tokensIn: 0, tokensOut: 0, avgLatency: 0, errors: 0, description: ROUTE_DESCRIPTIONS[log.route] || log.route, cost: null };
    }
    const r = byRoute[log.route];
    r.calls++;
    r.tokensIn += log.tokensIn || 0;
    r.tokensOut += log.tokensOut || 0;
    if (log.latencyMs) r.avgLatency += log.latencyMs;
    if (!log.success) r.errors++;
  }
  for (const route of Object.keys(byRoute)) {
    const r = byRoute[route];
    const successCount = r.calls - r.errors;
    r.avgLatency = successCount > 0 ? Math.round(r.avgLatency / successCount) : 0;
    r.cost = estimateCost(r.tokensIn, r.tokensOut, logs.find(l => l.route === route)?.model || '');
  }

  // Total cost
  const totalCost = estimateCost(totalTokensIn, totalTokensOut, logs[0]?.model || '');

  // Per-log cost
  const logsWithCost = logs.map(l => ({
    ...l,
    cost: (l.tokensIn != null && l.tokensOut != null) ? estimateCost(l.tokensIn, l.tokensOut, l.model) : null,
  }));

  return NextResponse.json({
    summary: { totalCalls, successCalls, failedCalls, totalTokensIn, totalTokensOut, avgLatency, totalCost },
    byRoute,
    logs: logsWithCost,
    provider: process.env.LLM_PROVIDER || 'bedrock',
    model: process.env.BEDROCK_MODEL_ID || 'default',
  });
}

export async function DELETE(_request: NextRequest) {
  clearTokenLogs();
  return NextResponse.json({ ok: true });
}
