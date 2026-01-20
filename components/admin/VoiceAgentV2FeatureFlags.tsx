'use client';

/**
 * TIS TIS Platform - Voice Agent v2 Feature Flags Admin UI
 *
 * Admin component for managing Voice Agent v2 rollout.
 * Displays current status, allows percentage control, and tenant overrides.
 *
 * @module components/admin/VoiceAgentV2FeatureFlags
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Types
interface VoiceAgentV2Flags {
  enabled: boolean;
  percentage: number;
  enabledTenants: string[];
  disabledTenants: string[];
  updatedAt: string;
  updatedBy: string | null;
}

interface RolloutStatus {
  currentPercentage: number;
  tenantsOnV2: number;
  totalTenants: number;
  isHealthy: boolean;
  lastUpdated: string;
  metrics: {
    v1: VersionMetrics;
    v2: VersionMetrics;
  };
}

interface VersionMetrics {
  totalCalls: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
}

interface TenantStatus {
  tenantId: string;
  tenantName: string;
  isOnV2: boolean;
  overrideType: 'enabled' | 'disabled' | 'percentage' | null;
}

interface AuditEntry {
  id: string;
  flagName: string;
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  changedBy: string | null;
  reason: string | null;
  createdAt: string;
}

interface FeatureFlagsData {
  flags: VoiceAgentV2Flags;
  status: RolloutStatus;
  tenants?: TenantStatus[];
  auditLog?: AuditEntry[];
}

// =====================================================
// COMPONENT
// =====================================================

export default function VoiceAgentV2FeatureFlags() {
  const [data, setData] = useState<FeatureFlagsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [percentageInput, setPercentageInput] = useState(0);
  const [showTenants, setShowTenants] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  // Create Supabase client for auth
  const supabase = createClientComponentClient();

  // Get auth token properly from Supabase session
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, [supabase]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (showTenants) params.set('includeTenants', 'true');
      if (showAudit) params.set('includeAudit', 'true');

      const token = await getAuthToken();
      if (!token) {
        setError('No authentication token available');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/feature-flags/voice-agent-v2?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      setData(result);
      setPercentageInput(result.flags.percentage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [showTenants, showAudit, getAuthToken]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Execute action
  const executeAction = async (action: string, params: Record<string, unknown> = {}) => {
    try {
      setActionLoading(true);
      setError(null);

      const token = await getAuthToken();
      if (!token) {
        setError('No authentication token available');
        setActionLoading(false);
        return;
      }

      const response = await fetch('/api/admin/feature-flags/voice-agent-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...params }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Action failed');
      }

      const result = await response.json();
      setData({ ...data!, flags: result.flags, status: result.status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <p className="text-red-600">Failed to load feature flags</p>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { flags, status } = data;

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Main Status Card */}
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Voice Agent v2 Rollout</h2>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              flags.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {flags.enabled ? 'Enabled' : 'Disabled'}
            </span>
            {status.isHealthy ? (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Healthy
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                Needs Attention
              </span>
            )}
          </div>
        </div>

        {/* Toggle Button */}
        <div className="mb-6">
          <button
            onClick={() => executeAction(flags.enabled ? 'disable' : 'enable')}
            disabled={actionLoading}
            className={`px-6 py-2 rounded font-medium ${
              flags.enabled
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            } ${actionLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {flags.enabled ? 'Disable v2 Globally' : 'Enable v2 Globally'}
          </button>
        </div>

        {/* Percentage Control */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rollout Percentage: {flags.percentage}%
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              min="0"
              max="100"
              value={percentageInput}
              onChange={(e) => setPercentageInput(Number(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={percentageInput}
              onChange={(e) => setPercentageInput(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="w-20 px-2 py-1 border rounded"
            />
            <button
              onClick={() => executeAction('updatePercentage', { percentage: percentageInput })}
              disabled={actionLoading || percentageInput === flags.percentage}
              className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${
                (actionLoading || percentageInput === flags.percentage) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Apply
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Tenants on v2</p>
            <p className="text-2xl font-bold text-blue-700">
              {status.tenantsOnV2} / {status.totalTenants}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">v2 Calls (1h)</p>
            <p className="text-2xl font-bold text-green-700">{status.metrics.v2.totalCalls}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">v2 Avg Latency</p>
            <p className="text-2xl font-bold text-purple-700">{status.metrics.v2.avgLatency}ms</p>
          </div>
          <div className={`p-4 rounded-lg ${
            status.metrics.v2.errorRate < 0.02 ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <p className="text-sm text-gray-600">v2 Error Rate</p>
            <p className={`text-2xl font-bold ${
              status.metrics.v2.errorRate < 0.02 ? 'text-green-700' : 'text-red-700'
            }`}>
              {(status.metrics.v2.errorRate * 100).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Override Lists */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">
              Enabled Tenants ({flags.enabledTenants.length})
            </h4>
            {flags.enabledTenants.length > 0 ? (
              <ul className="text-sm text-green-700 max-h-32 overflow-y-auto">
                {flags.enabledTenants.map((id) => (
                  <li key={id} className="flex justify-between items-center py-1">
                    <span className="truncate">{id}</span>
                    <button
                      onClick={() => executeAction('resetTenant', { tenantId: id })}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No overrides</p>
            )}
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <h4 className="font-medium text-red-800 mb-2">
              Disabled Tenants ({flags.disabledTenants.length})
            </h4>
            {flags.disabledTenants.length > 0 ? (
              <ul className="text-sm text-red-700 max-h-32 overflow-y-auto">
                {flags.disabledTenants.map((id) => (
                  <li key={id} className="flex justify-between items-center py-1">
                    <span className="truncate">{id}</span>
                    <button
                      onClick={() => executeAction('resetTenant', { tenantId: id })}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No overrides</p>
            )}
          </div>
        </div>

        {/* Last Updated */}
        <p className="text-sm text-gray-500">
          Last updated: {new Date(flags.updatedAt).toLocaleString()}
          {flags.updatedBy && ` by ${flags.updatedBy}`}
        </p>
      </div>

      {/* Version Comparison */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Version Comparison (Last Hour)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Metric</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">v1</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">v2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2">Total Calls</td>
                <td className="px-4 py-2">{status.metrics.v1.totalCalls}</td>
                <td className="px-4 py-2">{status.metrics.v2.totalCalls}</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Error Rate</td>
                <td className="px-4 py-2">{(status.metrics.v1.errorRate * 100).toFixed(2)}%</td>
                <td className="px-4 py-2">{(status.metrics.v2.errorRate * 100).toFixed(2)}%</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Avg Latency</td>
                <td className="px-4 py-2">{status.metrics.v1.avgLatency}ms</td>
                <td className="px-4 py-2">{status.metrics.v2.avgLatency}ms</td>
              </tr>
              <tr>
                <td className="px-4 py-2">p95 Latency</td>
                <td className="px-4 py-2">{status.metrics.v1.p95Latency}ms</td>
                <td className="px-4 py-2">{status.metrics.v2.p95Latency}ms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="flex space-x-4">
        <button
          onClick={() => { setShowTenants(!showTenants); }}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          {showTenants ? 'Hide' : 'Show'} Tenant List
        </button>
        <button
          onClick={() => { setShowAudit(!showAudit); }}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          {showAudit ? 'Hide' : 'Show'} Audit Log
        </button>
        <button
          onClick={() => executeAction('clearCache')}
          disabled={actionLoading}
          className="px-4 py-2 border border-orange-300 text-orange-600 rounded hover:bg-orange-50"
        >
          Clear Cache
        </button>
      </div>

      {/* Tenant List */}
      {showTenants && data.tenants && (
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Tenant Status</h3>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Tenant</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Version</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Override</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.tenants.map((tenant) => (
                  <tr key={tenant.tenantId}>
                    <td className="px-4 py-2">
                      <div>
                        <p className="font-medium">{tenant.tenantName}</p>
                        <p className="text-xs text-gray-500 truncate">{tenant.tenantId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        tenant.isOnV2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tenant.isOnV2 ? 'v2' : 'v1'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {tenant.overrideType && (
                        <span className={`px-2 py-1 rounded text-xs ${
                          tenant.overrideType === 'enabled' ? 'bg-green-100 text-green-700' :
                          tenant.overrideType === 'disabled' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {tenant.overrideType}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 space-x-2">
                      {!tenant.isOnV2 && (
                        <button
                          onClick={() => executeAction('enableTenant', { tenantId: tenant.tenantId })}
                          className="text-xs text-green-600 hover:text-green-800"
                        >
                          Enable v2
                        </button>
                      )}
                      {tenant.isOnV2 && (
                        <button
                          onClick={() => executeAction('disableTenant', { tenantId: tenant.tenantId })}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Disable v2
                        </button>
                      )}
                      {tenant.overrideType && (
                        <button
                          onClick={() => executeAction('resetTenant', { tenantId: tenant.tenantId })}
                          className="text-xs text-gray-600 hover:text-gray-800"
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log */}
      {showAudit && data.auditLog && (
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Audit Log</h3>
          <div className="overflow-x-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Time</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Action</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Changed By</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.auditLog.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-sm whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {entry.changedBy || 'System'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {entry.newValue && (
                        <span>
                          {JSON.stringify(entry.newValue).slice(0, 100)}...
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
