'use client';

// =====================================================
// TIS TIS PLATFORM - FASE 3: API Analytics Dashboard
// Branch usage analytics visualization for admins
// =====================================================

import { useState, useEffect } from 'react';
import { useTenant } from '@/src/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// ======================
// TYPES
// ======================

interface BranchUsageStats {
  branch_id: string;
  branch_name: string;
  is_headquarters: boolean;
  api_requests_30d: number;
  api_requests_7d: number;
  api_requests_today: number;
  most_used_endpoints: Array<{
    endpoint: string;
    requests: number;
    avg_response_time_ms: number;
  }>;
  leads: {
    total: number;
    new_30d: number;
    converted_30d: number;
    conversion_rate: number;
  };
  appointments: {
    total: number;
    upcoming: number;
    completed_30d: number;
    completion_rate: number;
  };
  performance: {
    avg_response_time_ms: number;
    p95_response_time_ms: number;
    error_rate: number;
    cache_hit_rate: number;
  };
  daily_trends: Array<{
    date: string;
    requests: number;
    errors: number;
  }>;
}

interface AnalyticsData {
  tenant_id: string;
  generated_at: string;
  branches: BranchUsageStats[];
  summary: {
    total_branches: number;
    total_requests_30d: number;
    avg_response_time_ms: number;
    overall_error_rate: number;
  };
}

// ======================
// COMPONENT
// ======================

export default function APIAnalyticsPage() {
  const { tenant } = useTenant();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!tenant?.id) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/analytics/branch-usage');

        if (!response.ok) {
          throw new Error('Error al cargar analytics');
        }

        const analyticsData = await response.json();
        setData(analyticsData);

        // Auto-select first branch if none selected
        if (!selectedBranch && analyticsData.branches.length > 0) {
          setSelectedBranch(analyticsData.branches[0].branch_id);
        }
      } catch (err) {
        console.error('[API Analytics] Error:', err);
        setError('Error al cargar datos de analytics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const selectedBranchData = data?.branches.find(
    (b) => b.branch_id === selectedBranch
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tis-coral mx-auto mb-4" />
          <p className="text-sm text-gray-500">Cargando analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700">{error || 'Error al cargar datos'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">API Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Uso de la API por sucursal • Últimos 30 días
          </p>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Sucursales</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {data.summary.total_branches}
                  </p>
                </div>
                <div className="h-12 w-12 bg-tis-coral/10 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-tis-coral" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {data.summary.total_requests_30d.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">últimos 30 días</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tiempo Promedio</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {data.summary.avg_response_time_ms}ms
                  </p>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    {data.summary.avg_response_time_ms < 100 ? 'Óptimo' : 'Normal'}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Tasa de Error</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {data.summary.overall_error_rate}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {data.summary.overall_error_rate < 1 ? 'Excelente' : 'Revisar'}
                  </p>
                </div>
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center ${
                    data.summary.overall_error_rate < 1
                      ? 'bg-green-100'
                      : 'bg-orange-100'
                  }`}
                >
                  {data.summary.overall_error_rate < 1 ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-orange-600" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Branch Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seleccionar Sucursal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.branches.map((branch) => (
                <button
                  key={branch.branch_id}
                  onClick={() => setSelectedBranch(branch.branch_id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedBranch === branch.branch_id
                      ? 'bg-tis-coral text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {branch.branch_name}
                  {branch.is_headquarters && (
                    <span className="ml-2 text-xs opacity-75">🏢</span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Branch Details */}
        {selectedBranchData && (
          <>
            {/* API Usage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Requests (30d)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-gray-900">
                    {selectedBranchData.api_requests_30d.toLocaleString()}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>7d: {selectedBranchData.api_requests_7d}</span>
                    <span>Hoy: {selectedBranchData.api_requests_today}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Promedio:</span>
                      <span className="font-semibold">
                        {selectedBranchData.performance.avg_response_time_ms}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">P95:</span>
                      <span className="font-semibold">
                        {selectedBranchData.performance.p95_response_time_ms}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Errores:</span>
                      <span
                        className={`font-semibold ${
                          selectedBranchData.performance.error_rate < 1
                            ? 'text-green-600'
                            : 'text-orange-600'
                        }`}
                      >
                        {selectedBranchData.performance.error_rate}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Conversión
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Leads (30d):</span>
                      <span className="font-semibold">
                        {selectedBranchData.leads.new_30d}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Convertidos:</span>
                      <span className="font-semibold">
                        {selectedBranchData.leads.converted_30d}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tasa:</span>
                      <span className="font-semibold text-tis-coral">
                        {selectedBranchData.leads.conversion_rate}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Most Used Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle>Endpoints Más Usados</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedBranchData.most_used_endpoints.length > 0 ? (
                  <div className="space-y-3">
                    {selectedBranchData.most_used_endpoints.map((endpoint, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-mono text-sm text-gray-900">
                            {endpoint.endpoint}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {endpoint.requests.toLocaleString()} requests
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-700">
                            {endpoint.avg_response_time_ms}ms
                          </p>
                          <p className="text-xs text-gray-500">promedio</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No hay datos de endpoints disponibles
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Daily Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia Diaria (últimos 7 días)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedBranchData.daily_trends.map((trend, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-2 hover:bg-gray-50 rounded"
                    >
                      <span className="text-sm font-medium text-gray-600 w-24">
                        {new Date(trend.date).toLocaleDateString('es-ES', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2 bg-gray-200 rounded-full flex-1 overflow-hidden">
                            <div
                              className="h-full bg-tis-coral rounded-full"
                              style={{
                                width: `${Math.min(
                                  (trend.requests /
                                    Math.max(
                                      ...selectedBranchData.daily_trends.map(
                                        (t) => t.requests
                                      )
                                    )) *
                                    100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-700 w-12">
                            {trend.requests}
                          </span>
                        </div>
                      </div>
                      {trend.errors > 0 && (
                        <span className="text-xs text-orange-600 font-medium">
                          {trend.errors} errors
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
