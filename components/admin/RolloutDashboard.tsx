'use client';

/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Dashboard Component
 *
 * Comprehensive dashboard for managing Voice Agent v2 rollout:
 * - Real-time rollout status and progress visualization
 * - Stage-based progression with Go/No-Go criteria
 * - Health metrics comparison (V1 vs V2)
 * - Quick action buttons for stage advancement and rollback
 * - Pre-rollout checklist management
 * - Rollout history and audit trail
 *
 * @module components/admin/RolloutDashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// =====================================================
// TYPES
// =====================================================

interface RolloutStageConfig {
  stage: string;
  percentage: number;
  minDurationHours: number;
  goCriteria: {
    maxErrorRate: number;
    maxP95LatencyMs: number;
  };
  noGoCriteria: {
    maxErrorRate: number;
    maxP95LatencyMs: number;
  };
}

interface RolloutStatus {
  currentStage: string;
  percentage: number;
  enabled: boolean;
  enabledTenants: string[];
  disabledTenants: string[];
  stageStartedAt: string;
  stageInitiatedBy: string | null;
  autoAdvanceEnabled: boolean;
  lastHealthCheck: HealthCheckResult | null;
}

interface HealthCheckResult {
  timestamp: string;
  healthy: boolean;
  canAdvance: boolean;
  shouldRollback: boolean;
  v2Metrics: RolloutMetrics;
  v1Metrics: RolloutMetrics;
  issues: RolloutIssue[];
}

interface RolloutMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  errorRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  circuitBreakerOpens: number;
  activeCalls: number;
}

interface RolloutIssue {
  severity: 'warning' | 'critical';
  type: string;
  message: string;
  currentValue: number;
  thresholdValue: number;
  recommendedAction: string;
}

interface RolloutHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  fromStage: string;
  toStage: string;
  fromPercentage: number;
  toPercentage: number;
  initiatedBy: string | null;
  reason: string;
}

interface ChecklistItem {
  id: string;
  category: string;
  description: string;
  completed: boolean;
  completedBy: string | null;
  completedAt: string | null;
  required: boolean;
  notes: string | null;
}

interface PreRolloutChecklist {
  id: string;
  createdAt: string;
  updatedAt: string;
  items: ChecklistItem[];
  completionPercentage: number;
  allRequiredComplete: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
}

interface TenantInfo {
  total: number;
  onV2: number;
  explicitlyEnabled: number;
  explicitlyDisabled: number;
}

interface DashboardData {
  status: RolloutStatus;
  stageConfig: RolloutStageConfig;
  tenantInfo: TenantInfo;
  history: RolloutHistoryEntry[];
  checklist?: PreRolloutChecklist;
}

// Stage order for display
const STAGE_ORDER = ['disabled', 'canary', 'early_adopters', 'expansion', 'majority', 'complete'];

const STAGE_LABELS: Record<string, string> = {
  disabled: 'Disabled',
  canary: 'Canary (5%)',
  early_adopters: 'Early Adopters (10%)',
  expansion: 'Expansion (25%)',
  majority: 'Majority (50%)',
  complete: 'Complete (100%)',
};

const CATEGORY_LABELS: Record<string, string> = {
  migration: 'Migration',
  feature_flags: 'Feature Flags',
  monitoring: 'Monitoring',
  alerts: 'Alerts',
  rollback: 'Rollback',
  team: 'Team',
};

// =====================================================
// COMPONENT
// =====================================================

export default function RolloutDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [checklist, setChecklist] = useState<PreRolloutChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'checklist' | 'history'>('overview');
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    action: string;
    title: string;
    message: string;
    params?: Record<string, unknown>;
  } | null>(null);

  const supabase = createClientComponentClient();

  // Get auth token
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, [supabase]);

  // Fetch rollout data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const token = await getAuthToken();
      if (!token) {
        setError('No authentication token available');
        setLoading(false);
        return;
      }

      // Fetch rollout status (section=all returns status, stageConfig, tenantInfo, and history)
      const statusResponse = await fetch('/api/admin/rollout?section=all&includeHealth=true', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!statusResponse.ok) {
        throw new Error(await statusResponse.text());
      }

      const statusData = await statusResponse.json();

      // Fetch checklist
      const checklistResponse = await fetch('/api/admin/rollout/checklist', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      let checklistData = null;
      if (checklistResponse.ok) {
        const result = await checklistResponse.json();
        checklistData = result.checklist;
      }

      setData(statusData);
      setChecklist(checklistData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rollout data');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Execute rollout action
  const executeRolloutAction = async (action: string, params: Record<string, unknown> = {}) => {
    try {
      setActionLoading(true);
      setError(null);
      setShowConfirmDialog(null);

      const token = await getAuthToken();
      if (!token) {
        setError('No authentication token available');
        return;
      }

      const response = await fetch('/api/admin/rollout', {
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

      // Refresh data after action
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute checklist action
  const executeChecklistAction = async (action: string, params: Record<string, unknown> = {}) => {
    try {
      setActionLoading(true);
      setError(null);

      const token = await getAuthToken();
      if (!token) {
        setError('No authentication token available');
        return;
      }

      const response = await fetch('/api/admin/rollout/checklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...params }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Checklist action failed');
      }

      const result = await response.json();
      setChecklist(result.checklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checklist action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm action dialog handler
  const handleConfirmAction = (action: string, title: string, message: string, params?: Record<string, unknown>) => {
    setShowConfirmDialog({ action, title, message, params });
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse flex flex-col space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state with no data
  if (!data) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load rollout data'}</p>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { status, stageConfig, tenantInfo, history } = data;
  const healthCheck = status.lastHealthCheck;
  const currentStageIndex = STAGE_ORDER.indexOf(status.currentStage);
  const nextStage = currentStageIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentStageIndex + 1] : null;
  const prevStage = currentStageIndex > 0 ? STAGE_ORDER[currentStageIndex - 1] : null;

  // Calculate stage duration
  const stageDuration = status.stageStartedAt
    ? Math.floor((Date.now() - new Date(status.stageStartedAt).getTime()) / 3600000)
    : 0;
  const stageProgress = stageConfig.minDurationHours > 0
    ? Math.min(100, (stageDuration / stageConfig.minDurationHours) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">{showConfirmDialog.title}</h3>
            <p className="text-gray-600 mb-4">{showConfirmDialog.message}</p>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => executeRolloutAction(showConfirmDialog.action, showConfirmDialog.params)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Status */}
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Voice Agent v2 Rollout</h1>
            <p className="text-gray-500 mt-1">
              Stage: <span className="font-medium text-gray-900">{STAGE_LABELS[status.currentStage]}</span>
              {status.stageInitiatedBy && (
                <span className="ml-2 text-sm">by {status.stageInitiatedBy}</span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Health Status */}
            {healthCheck && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                healthCheck.shouldRollback
                  ? 'bg-red-100 text-red-800'
                  : healthCheck.healthy
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
              }`}>
                {healthCheck.shouldRollback ? 'Critical' : healthCheck.healthy ? 'Healthy' : 'Warning'}
              </span>
            )}
            {/* Enabled Status */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              status.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {status.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Rollout Progress</span>
            <span>{status.percentage}%</span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                healthCheck?.shouldRollback ? 'bg-red-500' :
                healthCheck?.healthy ? 'bg-green-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${status.percentage}%` }}
            />
          </div>
          {/* Stage markers */}
          <div className="flex justify-between mt-2">
            {STAGE_ORDER.map((stage, idx) => {
              const isActive = stage === status.currentStage;
              const isPast = idx < currentStageIndex;
              return (
                <div
                  key={stage}
                  className={`text-xs text-center ${
                    isActive ? 'text-blue-600 font-semibold' : isPast ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  <div className={`w-3 h-3 mx-auto mb-1 rounded-full ${
                    isActive ? 'bg-blue-600' : isPast ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                  {stage.replace('_', ' ')}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage Duration Progress */}
        {stageConfig.minDurationHours > 0 && (
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Stage Duration</span>
              <span className="text-gray-900">{stageDuration}h / {stageConfig.minDurationHours}h minimum</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${stageProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          {/* Advance Button */}
          {nextStage && (
            <button
              onClick={() => handleConfirmAction(
                'advance',
                'Advance Rollout',
                `Are you sure you want to advance from ${STAGE_LABELS[status.currentStage]} to ${STAGE_LABELS[nextStage]}?`,
                { targetStage: nextStage, reason: 'Manual advancement via dashboard' }
              )}
              disabled={actionLoading || (healthCheck !== null && !healthCheck.canAdvance)}
              className={`px-4 py-2 rounded font-medium ${
                healthCheck?.canAdvance
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              } disabled:opacity-50`}
            >
              Advance to {STAGE_LABELS[nextStage]}
            </button>
          )}

          {/* Rollback Button */}
          {prevStage && status.percentage > 0 && (
            <button
              onClick={() => handleConfirmAction(
                'rollback',
                'Rollback Confirmation',
                `Are you sure you want to rollback from ${STAGE_LABELS[status.currentStage]} to ${STAGE_LABELS[prevStage]}?`,
                { level: 'partial', targetStage: prevStage, reason: 'Manual rollback via dashboard' }
              )}
              disabled={actionLoading}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium disabled:opacity-50"
            >
              Rollback to {STAGE_LABELS[prevStage]}
            </button>
          )}

          {/* Emergency Stop */}
          {status.percentage > 0 && (
            <button
              onClick={() => handleConfirmAction(
                'rollback',
                'Emergency Stop',
                'This will immediately stop all V2 traffic and rollback to 0%. Are you sure?',
                { level: 'total', reason: 'Emergency stop via dashboard' }
              )}
              disabled={actionLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50"
            >
              Emergency Stop
            </button>
          )}

          {/* Health Check Button */}
          <button
            onClick={() => executeRolloutAction('healthCheck')}
            disabled={actionLoading}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Run Health Check
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            disabled={actionLoading || loading}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'checklist', label: 'Pre-Rollout Checklist' },
            { key: 'history', label: 'History' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.key === 'checklist' && checklist && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  checklist.allRequiredComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {Math.round(checklist.completionPercentage)}%
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          status={status}
          stageConfig={stageConfig}
          tenantInfo={tenantInfo}
          healthCheck={healthCheck}
        />
      )}

      {activeTab === 'checklist' && (
        <ChecklistTab
          checklist={checklist}
          onAction={executeChecklistAction}
          actionLoading={actionLoading}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab history={history} />
      )}
    </div>
  );
}

// =====================================================
// OVERVIEW TAB
// =====================================================

interface OverviewTabProps {
  status: RolloutStatus;
  stageConfig: RolloutStageConfig;
  tenantInfo: TenantInfo;
  healthCheck: HealthCheckResult | null;
}

function OverviewTab({ status, stageConfig, tenantInfo, healthCheck }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Tenants on V2"
          value={`${tenantInfo.onV2} / ${tenantInfo.total}`}
          subtext={`${tenantInfo.explicitlyEnabled} explicitly enabled`}
          color="blue"
        />
        <MetricCard
          label="V2 Calls (1h)"
          value={healthCheck?.v2Metrics.totalCalls.toLocaleString() ?? '—'}
          subtext={`${healthCheck?.v2Metrics.activeCalls ?? 0} active`}
          color="green"
        />
        <MetricCard
          label="V2 Error Rate"
          value={healthCheck ? `${(healthCheck.v2Metrics.errorRate * 100).toFixed(2)}%` : '—'}
          subtext={`Max: ${(stageConfig.goCriteria.maxErrorRate * 100).toFixed(1)}%`}
          color={
            !healthCheck ? 'gray' :
            healthCheck.v2Metrics.errorRate <= stageConfig.goCriteria.maxErrorRate ? 'green' :
            healthCheck.v2Metrics.errorRate <= stageConfig.noGoCriteria.maxErrorRate ? 'yellow' : 'red'
          }
        />
        <MetricCard
          label="V2 p95 Latency"
          value={healthCheck ? `${healthCheck.v2Metrics.p95LatencyMs}ms` : '—'}
          subtext={`Max: ${stageConfig.goCriteria.maxP95LatencyMs}ms`}
          color={
            !healthCheck ? 'gray' :
            healthCheck.v2Metrics.p95LatencyMs <= stageConfig.goCriteria.maxP95LatencyMs ? 'green' :
            healthCheck.v2Metrics.p95LatencyMs <= stageConfig.noGoCriteria.maxP95LatencyMs ? 'yellow' : 'red'
          }
        />
      </div>

      {/* Issues Alert */}
      {healthCheck && healthCheck.issues.length > 0 && (
        <div className={`p-4 rounded-lg border ${
          healthCheck.shouldRollback ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
        }`}>
          <h3 className={`font-semibold mb-2 ${
            healthCheck.shouldRollback ? 'text-red-800' : 'text-yellow-800'
          }`}>
            {healthCheck.shouldRollback ? 'Critical Issues Detected' : 'Warning Issues Detected'}
          </h3>
          <ul className="space-y-2">
            {healthCheck.issues.map((issue, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className={`inline-block w-2 h-2 mt-1.5 rounded-full ${
                  issue.severity === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div>
                  <p className={`text-sm ${
                    issue.severity === 'critical' ? 'text-red-700' : 'text-yellow-700'
                  }`}>
                    {issue.message}
                  </p>
                  <p className="text-xs text-gray-500">
                    Recommended: {issue.recommendedAction}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* V1 vs V2 Comparison */}
      {healthCheck && (
        <div className="p-6 bg-white rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Version Comparison (Last Hour)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Metric</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">V1</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">V2</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <ComparisonRow
                  label="Total Calls"
                  v1Value={healthCheck.v1Metrics.totalCalls}
                  v2Value={healthCheck.v2Metrics.totalCalls}
                  format="number"
                />
                <ComparisonRow
                  label="Success Rate"
                  v1Value={(1 - healthCheck.v1Metrics.errorRate) * 100}
                  v2Value={(1 - healthCheck.v2Metrics.errorRate) * 100}
                  format="percent"
                  higherIsBetter
                />
                <ComparisonRow
                  label="Error Rate"
                  v1Value={healthCheck.v1Metrics.errorRate * 100}
                  v2Value={healthCheck.v2Metrics.errorRate * 100}
                  format="percent"
                  lowerIsBetter
                />
                <ComparisonRow
                  label="Avg Latency"
                  v1Value={healthCheck.v1Metrics.avgLatencyMs}
                  v2Value={healthCheck.v2Metrics.avgLatencyMs}
                  format="ms"
                  lowerIsBetter
                />
                <ComparisonRow
                  label="p50 Latency"
                  v1Value={healthCheck.v1Metrics.p50LatencyMs}
                  v2Value={healthCheck.v2Metrics.p50LatencyMs}
                  format="ms"
                  lowerIsBetter
                />
                <ComparisonRow
                  label="p95 Latency"
                  v1Value={healthCheck.v1Metrics.p95LatencyMs}
                  v2Value={healthCheck.v2Metrics.p95LatencyMs}
                  format="ms"
                  lowerIsBetter
                />
                <ComparisonRow
                  label="p99 Latency"
                  v1Value={healthCheck.v1Metrics.p99LatencyMs}
                  v2Value={healthCheck.v2Metrics.p99LatencyMs}
                  format="ms"
                  lowerIsBetter
                />
                <ComparisonRow
                  label="Circuit Breaker Opens"
                  v1Value={healthCheck.v1Metrics.circuitBreakerOpens}
                  v2Value={healthCheck.v2Metrics.circuitBreakerOpens}
                  format="number"
                  lowerIsBetter
                />
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Last health check: {new Date(healthCheck.timestamp).toLocaleString()}
          </p>
        </div>
      )}

      {/* Go/No-Go Criteria */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Go/No-Go Criteria for {STAGE_LABELS[status.currentStage]}</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-800 mb-3">Go Criteria (to advance)</h4>
            <ul className="space-y-2 text-sm text-green-700">
              <li className="flex justify-between">
                <span>Error Rate</span>
                <span className="font-mono">&lt; {(stageConfig.goCriteria.maxErrorRate * 100).toFixed(1)}%</span>
              </li>
              <li className="flex justify-between">
                <span>p95 Latency</span>
                <span className="font-mono">&lt; {stageConfig.goCriteria.maxP95LatencyMs}ms</span>
              </li>
              <li className="flex justify-between">
                <span>Min Duration</span>
                <span className="font-mono">{stageConfig.minDurationHours}h</span>
              </li>
            </ul>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <h4 className="font-medium text-red-800 mb-3">No-Go Criteria (triggers rollback)</h4>
            <ul className="space-y-2 text-sm text-red-700">
              <li className="flex justify-between">
                <span>Error Rate</span>
                <span className="font-mono">&gt; {(stageConfig.noGoCriteria.maxErrorRate * 100).toFixed(1)}%</span>
              </li>
              <li className="flex justify-between">
                <span>p95 Latency</span>
                <span className="font-mono">&gt; {stageConfig.noGoCriteria.maxP95LatencyMs}ms</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tenant Overrides Summary */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Tenant Overrides</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Explicitly Enabled</p>
            <p className="text-2xl font-bold text-green-700">{status.enabledTenants.length}</p>
            {status.enabledTenants.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Always use V2 regardless of percentage
              </p>
            )}
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-gray-600">Explicitly Disabled</p>
            <p className="text-2xl font-bold text-red-700">{status.disabledTenants.length}</p>
            {status.disabledTenants.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Always use V1 regardless of percentage
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// CHECKLIST TAB
// =====================================================

interface ChecklistTabProps {
  checklist: PreRolloutChecklist | null;
  onAction: (action: string, params?: Record<string, unknown>) => Promise<void>;
  actionLoading: boolean;
}

function ChecklistTab({ checklist, onAction, actionLoading }: ChecklistTabProps) {
  if (!checklist) {
    return (
      <div className="p-6 bg-white rounded-lg shadow text-center">
        <p className="text-gray-500 mb-4">No pre-rollout checklist found</p>
        <button
          onClick={() => onAction('createNew')}
          disabled={actionLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Create New Checklist
        </button>
      </div>
    );
  }

  // Group items by category
  const groupedItems = checklist.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  return (
    <div className="space-y-6">
      {/* Checklist Header */}
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Pre-Rollout Checklist</h3>
            <p className="text-sm text-gray-500">
              Created: {new Date(checklist.createdAt).toLocaleDateString()}
              {checklist.approvedBy && (
                <span className="ml-2 text-green-600">
                  Approved by {checklist.approvedBy} on {new Date(checklist.approvedAt!).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Completion Badge */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              checklist.allRequiredComplete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {Math.round(checklist.completionPercentage)}% Complete
            </span>
            {/* Run Auto Checks */}
            <button
              onClick={() => onAction('runAutoChecks', { checklistId: checklist.id })}
              disabled={actionLoading}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Run Auto Checks
            </button>
            {/* Approve Button */}
            {checklist.allRequiredComplete && !checklist.approvedBy && (
              <button
                onClick={() => onAction('approve', { checklistId: checklist.id })}
                disabled={actionLoading}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Approve Checklist
              </button>
            )}
            {checklist.approvedBy && (
              <button
                onClick={() => onAction('revokeApproval', { checklistId: checklist.id })}
                disabled={actionLoading}
                className="px-3 py-1 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50 disabled:opacity-50"
              >
                Revoke Approval
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              checklist.allRequiredComplete ? 'bg-green-500' : 'bg-yellow-500'
            }`}
            style={{ width: `${checklist.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Checklist Items by Category */}
      {Object.entries(groupedItems).map(([category, items]) => (
        <div key={category} className="p-6 bg-white rounded-lg shadow">
          <h4 className="font-semibold text-gray-900 mb-4">
            {CATEGORY_LABELS[category] || category}
          </h4>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-start space-x-3">
                <button
                  onClick={() => onAction(
                    item.completed ? 'uncompleteItem' : 'completeItem',
                    { checklistId: checklist.id, itemId: item.id }
                  )}
                  disabled={actionLoading}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    item.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-green-500'
                  } disabled:opacity-50`}
                >
                  {item.completed && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <div className="flex-1">
                  <p className={`text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {item.description}
                    {item.required && (
                      <span className="ml-2 text-xs text-red-500">*Required</span>
                    )}
                  </p>
                  {item.completed && item.completedBy && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Completed by {item.completedBy} on {new Date(item.completedAt!).toLocaleString()}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic">{item.notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// HISTORY TAB
// =====================================================

interface HistoryTabProps {
  history: RolloutHistoryEntry[];
}

function HistoryTab({ history }: HistoryTabProps) {
  if (!history || history.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow text-center">
        <p className="text-gray-500">No rollout history available</p>
      </div>
    );
  }

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'advance':
        return 'bg-green-100 text-green-800';
      case 'rollback_partial':
      case 'rollback_total':
      case 'rollback_tenant':
        return 'bg-red-100 text-red-800';
      case 'enable':
      case 'enable_tenant':
        return 'bg-blue-100 text-blue-800';
      case 'disable':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Rollout History</h3>
      <div className="space-y-4">
        {history.map((entry, idx) => (
          <div key={entry.id} className="flex items-start space-x-4">
            {/* Timeline indicator */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${
                idx === 0 ? 'bg-blue-500' : 'bg-gray-300'
              }`} />
              {idx < history.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 mt-1" />
              )}
            </div>
            {/* Entry content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center space-x-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(entry.action)}`}>
                  {entry.action.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-900">
                {STAGE_LABELS[entry.fromStage]} ({entry.fromPercentage}%)
                {' → '}
                {STAGE_LABELS[entry.toStage]} ({entry.toPercentage}%)
              </p>
              {entry.reason && (
                <p className="text-sm text-gray-600 mt-1">{entry.reason}</p>
              )}
              {entry.initiatedBy && (
                <p className="text-xs text-gray-400 mt-1">by {entry.initiatedBy}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// HELPER COMPONENTS
// =====================================================

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

function MetricCard({ label, value, subtext, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-gray-50 text-gray-700',
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}

interface ComparisonRowProps {
  label: string;
  v1Value: number;
  v2Value: number;
  format: 'number' | 'percent' | 'ms';
  higherIsBetter?: boolean;
  lowerIsBetter?: boolean;
}

function ComparisonRow({ label, v1Value, v2Value, format, higherIsBetter, lowerIsBetter }: ComparisonRowProps) {
  const diff = v2Value - v1Value;
  const formatValue = (val: number): string => {
    switch (format) {
      case 'percent':
        return `${val.toFixed(2)}%`;
      case 'ms':
        return `${Math.round(val)}ms`;
      default:
        return val.toLocaleString();
    }
  };

  let diffColor = 'text-gray-500';
  if (diff !== 0) {
    if (higherIsBetter) {
      diffColor = diff > 0 ? 'text-green-600' : 'text-red-600';
    } else if (lowerIsBetter) {
      diffColor = diff < 0 ? 'text-green-600' : 'text-red-600';
    }
  }

  const diffText = diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatValue(diff)}`;

  return (
    <tr>
      <td className="px-4 py-2 text-sm">{label}</td>
      <td className="px-4 py-2 text-sm font-mono">{formatValue(v1Value)}</td>
      <td className="px-4 py-2 text-sm font-mono">{formatValue(v2Value)}</td>
      <td className={`px-4 py-2 text-sm font-mono ${diffColor}`}>{diffText}</td>
    </tr>
  );
}
