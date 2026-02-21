import { LLMResponse } from './types';

export interface TokenLogEntry {
  id: string;
  timestamp: string;
  route: string;
  provider: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  success: boolean;
  error?: string;
}

// Route descriptions for the dashboard
export const ROUTE_DESCRIPTIONS: Record<string, string> = {
  'extract': 'Entity Extraction — extracts name, company, role, summary from live transcript',
  'reconcile': 'Reconciliation — reviews full transcript against existing cards for corrections',
  'reconcile/dedup': 'Dedup via Reconcile — evaluates candidate card pairs for merging',
  'dedup': 'Deduplication — identifies duplicate contact cards across sessions',
  'group/llm-groups': 'Smart Grouping — finds hidden connections between contacts',
  'group/insights': 'Network Insights — generates analytical observations about networking patterns',
};

/** In-memory log store — uses globalThis to survive across module re-evaluations in Next.js dev/Turbopack */
const MAX_ENTRIES = 500;

// Declare on globalThis so all API routes share the same array
const globalKey = '__recall_llm_logs__' as const;
declare global {
  // eslint-disable-next-line no-var
  var __recall_llm_logs__: TokenLogEntry[] | undefined;
}

function getLogStore(): TokenLogEntry[] {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = [];
  }
  return globalThis[globalKey]!;
}

/**
 * Logs LLM token usage to stdout and persists in memory.
 */
export function logTokenUsage(route: string, response: LLMResponse, provider: string) {
  const entry: TokenLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    route,
    provider,
    model: response.model || 'unknown',
    tokensIn: response.tokensIn ?? null,
    tokensOut: response.tokensOut ?? null,
    totalTokens: (response.tokensIn != null && response.tokensOut != null)
      ? response.tokensIn + response.tokensOut
      : null,
    latencyMs: response.latencyMs ?? null,
    success: true,
  };

  const logEntries = getLogStore();
  logEntries.push(entry);
  if (logEntries.length > MAX_ENTRIES) logEntries.shift();

  const parts = [
    `[Recall:LLM]`,
    `route=${route}`,
    `provider=${provider}`,
    `model=${response.model || 'unknown'}`,
    `tokens_in=${response.tokensIn ?? '?'}`,
    `tokens_out=${response.tokensOut ?? '?'}`,
    `latency=${response.latencyMs ? `${response.latencyMs}ms` : '?'}`,
  ];
  console.log(parts.join(' '));
}

/**
 * Logs a failed LLM call.
 */
export function logTokenError(route: string, provider: string, model: string, error: string) {
  const entry: TokenLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    route,
    provider,
    model,
    tokensIn: null,
    tokensOut: null,
    totalTokens: null,
    latencyMs: null,
    success: false,
    error,
  };

  const logEntries = getLogStore();
  logEntries.push(entry);
  if (logEntries.length > MAX_ENTRIES) logEntries.shift();
}

/** Returns all log entries (newest first). */
export function getTokenLogs(): TokenLogEntry[] {
  return [...getLogStore()].reverse();
}

/** Clears all log entries. */
export function clearTokenLogs(): void {
  const logEntries = getLogStore();
  logEntries.length = 0;
}

/**
 * Parses JSON from LLM response content, stripping markdown code fences.
 */
export function parseLLMJson<T>(content: string): T {
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
  return JSON.parse(jsonStr.trim());
}
