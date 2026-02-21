'use client';

import { useState, useEffect, useCallback } from 'react';

interface TokenLogEntry {
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
  cost?: number | null;
}

interface RouteStats {
  calls: number;
  tokensIn: number;
  tokensOut: number;
  avgLatency: number;
  errors: number;
  description: string;
  cost: number | null;
}

interface DashboardData {
  summary: {
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    totalTokensIn: number;
    totalTokensOut: number;
    avgLatency: number;
    totalCost: number | null;
  };
  byRoute: Record<string, RouteStats>;
  logs: TokenLogEntry[];
  provider: string;
  model: string;
}

// Route color coding
const ROUTE_COLORS: Record<string, string> = {
  'extract': '#3b82f6',
  'reconcile': '#8b5cf6',
  'reconcile/dedup': '#a78bfa',
  'dedup': '#ec4899',
  'group/llm-groups': '#10b981',
  'group/insights': '#06b6d4',
};

function getRouteColor(route: string): string {
  return ROUTE_COLORS[route] || '#6b7280';
}

function formatCost(cost: number | null | undefined): string {
  if (cost == null) return '—';
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(4)}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/llm-logs');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
  }, []);

  const clearLogs = async () => {
    await fetch('/api/llm-logs', { method: 'DELETE' });
    fetchLogs();
  };

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  const { summary, byRoute, logs, provider, model } = data;
  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.route === filter);
  const routes = Object.keys(byRoute);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Recall LLM Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              Provider: <span className="text-gray-300">{provider}</span> · Model: <span className="text-gray-300 font-mono text-xs">{model}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <button onClick={fetchLogs} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
              Refresh
            </button>
            <button onClick={clearLogs} className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg text-sm transition-colors">
              Clear Logs
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total Calls" value={summary.totalCalls} />
          <StatCard label="Successful" value={summary.successCalls} color="text-emerald-400" />
          <StatCard label="Failed" value={summary.failedCalls} color="text-red-400" />
          <StatCard label="Tokens In" value={summary.totalTokensIn.toLocaleString()} />
          <StatCard label="Tokens Out" value={summary.totalTokensOut.toLocaleString()} />
          <StatCard label="Avg Latency" value={`${summary.avgLatency}ms`} />
          <StatCard label="Est. Cost" value={formatCost(summary.totalCost)} color="text-amber-400" />
        </div>

        {/* Per-Route Breakdown */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Usage by Route</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {routes.length === 0 ? (
              <p className="px-5 py-8 text-gray-600 text-center text-sm">No LLM calls recorded yet. Start a session to see data.</p>
            ) : (
              routes.map(route => {
                const stats = byRoute[route];
                const totalTokens = stats.tokensIn + stats.tokensOut;
                const maxTokens = Math.max(...routes.map(r => byRoute[r].tokensIn + byRoute[r].tokensOut), 1);
                const barWidth = Math.max(2, (totalTokens / maxTokens) * 100);
                return (
                  <div key={route} className="px-5 py-3 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getRouteColor(route) }} />
                        <span className="font-mono text-sm text-gray-200">{route}</span>
                        <span className="text-gray-600 text-xs">— {stats.description}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{stats.calls} calls</span>
                        <span>{stats.tokensIn.toLocaleString()} in / {stats.tokensOut.toLocaleString()} out</span>
                        <span>{stats.avgLatency}ms avg</span>
                        {stats.cost != null && <span className="text-amber-400">{formatCost(stats.cost)}</span>}
                        {stats.errors > 0 && <span className="text-red-400">{stats.errors} errors</span>}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%`, backgroundColor: getRouteColor(route) }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Request Log</h2>
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-gray-300"
              >
                <option value="all">All routes</option>
                {routes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <span className="text-xs text-gray-600">{filteredLogs.length} entries</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Route</th>
                  <th className="px-4 py-2 text-left">Model</th>
                  <th className="px-4 py-2 text-right">Tokens In</th>
                  <th className="px-4 py-2 text-right">Tokens Out</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Latency</th>
                  <th className="px-4 py-2 text-right">Cost</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-600">No log entries yet</td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className={`hover:bg-gray-800/30 ${!log.success ? 'bg-red-950/20' : ''}`}>
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getRouteColor(log.route) }} />
                          <span className="font-mono text-gray-300">{log.route}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500 max-w-[200px] truncate">{log.model}</td>
                      <td className="px-4 py-2 text-right text-gray-400 font-mono">{log.tokensIn?.toLocaleString() ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-400 font-mono">{log.tokensOut?.toLocaleString() ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-200 font-mono font-medium">{log.totalTokens?.toLocaleString() ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-400">
                        {log.latencyMs ? `${(log.latencyMs / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-amber-400/80 text-xs">
                        {formatCost(log.cost)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {log.success ? (
                          <span className="text-emerald-400 text-xs">✓</span>
                        ) : (
                          <span className="text-red-400 text-xs" title={log.error}>✗</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Architecture Reference */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">LLM Call Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <ArchCard
              color="#3b82f6"
              route="extract"
              trigger="Every ~30 chars of new transcript"
              purpose="Extracts name, company, role, category, summary, action items from live speech"
              frequency="High — fires continuously during active listening"
            />
            <ArchCard
              color="#8b5cf6"
              route="reconcile"
              trigger="Every ~500 chars of new transcript"
              purpose="Reviews full transcript against existing cards, proposes corrections and merges"
              frequency="Medium — periodic during listening"
            />
            <ArchCard
              color="#ec4899"
              route="dedup"
              trigger="After session ends, when 2+ cards exist"
              purpose="Identifies duplicate contact cards across sessions for merging"
              frequency="Low — once per session end"
            />
            <ArchCard
              color="#10b981"
              route="group/llm-groups"
              trigger="When contact count exceeds 5"
              purpose="Finds hidden connections between contacts for smart grouping"
              frequency="Low — once when enough contacts exist"
            />
            <ArchCard
              color="#06b6d4"
              route="group/insights"
              trigger="Alongside group generation"
              purpose="Generates 1-2 analytical observations about networking patterns"
              frequency="Low — once alongside grouping"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color || 'text-white'}`}>{value}</p>
    </div>
  );
}

function ArchCard({ color, route, trigger, purpose, frequency }: { color: string; route: string; trigger: string; purpose: string; frequency: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-mono text-gray-200 text-sm">{route}</span>
      </div>
      <p className="text-gray-400 text-xs leading-relaxed">{purpose}</p>
      <p className="text-gray-600 text-xs mt-1">Trigger: {trigger}</p>
      <p className="text-gray-600 text-xs">Frequency: {frequency}</p>
    </div>
  );
}
