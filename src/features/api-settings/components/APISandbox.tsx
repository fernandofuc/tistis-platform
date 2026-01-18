// =====================================================
// TIS TIS PLATFORM - API Sandbox Component
// Interactive testing sandbox for API endpoints
// =====================================================

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Terminal,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/shared/utils';

// ======================
// TYPES
// ======================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface SandboxEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  name: string;
  scope: string;
  defaultBody?: string | (() => string);
  queryParams?: { key: string; value: string; enabled: boolean }[];
}

interface RequestResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  success: boolean;
}

interface APISandboxProps {
  tenantId: string | null;
  apiKey?: string;
  baseUrl: string;
  className?: string;
}

// ======================
// CONSTANTS
// ======================

const SANDBOX_ENDPOINTS: SandboxEndpoint[] = [
  {
    id: 'leads-list',
    method: 'GET',
    path: '/api/v1/leads',
    name: 'Listar Leads',
    scope: 'leads:read',
    queryParams: [
      { key: 'page', value: '1', enabled: true },
      { key: 'pageSize', value: '10', enabled: true },
      { key: 'status', value: '', enabled: false },
      { key: 'search', value: '', enabled: false },
    ],
  },
  {
    id: 'leads-create',
    method: 'POST',
    path: '/api/v1/leads',
    name: 'Crear Lead',
    scope: 'leads:write',
    defaultBody: JSON.stringify(
      {
        phone: '+521234567890',
        name: 'Test Lead',
        email: 'test@example.com',
        source: 'sandbox',
      },
      null,
      2
    ),
  },
  {
    id: 'webhook-status',
    method: 'GET',
    path: '/api/v1/webhook/{tenantId}',
    name: 'Estado Webhook',
    scope: 'webhook:read',
  },
  {
    id: 'webhook-send',
    method: 'POST',
    path: '/api/v1/webhook/{tenantId}',
    name: 'Enviar Webhook',
    scope: 'webhook:write',
    // Use a function to generate dynamic timestamp each time
    defaultBody: () =>
      JSON.stringify(
        {
          event: 'test.event',
          data: {
            message: 'Test desde sandbox',
            timestamp: new Date().toISOString(),
          },
        },
        null,
        2
      ),
  },
];

// ======================
// HELPERS
// ======================

function formatJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-400';
  if (status >= 300 && status < 400) return 'text-amber-400';
  if (status >= 400 && status < 500) return 'text-orange-400';
  return 'text-red-400';
}

function getStatusBgColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-emerald-500/10 border-emerald-500/30';
  if (status >= 300 && status < 400) return 'bg-amber-500/10 border-amber-500/30';
  if (status >= 400 && status < 500) return 'bg-orange-500/10 border-orange-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

// ======================
// MAIN COMPONENT
// ======================

export function APISandbox({ tenantId, apiKey, baseUrl, className }: APISandboxProps) {
  // State
  const [selectedEndpoint, setSelectedEndpoint] = useState<SandboxEndpoint>(SANDBOX_ENDPOINTS[0]);
  const [requestBody, setRequestBody] = useState(selectedEndpoint.defaultBody || '');
  const [queryParams, setQueryParams] = useState(selectedEndpoint.queryParams || []);
  const [customApiKey, setCustomApiKey] = useState(apiKey || '');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHeaders, setShowHeaders] = useState(false);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update state when endpoint changes
  useEffect(() => {
    // Handle defaultBody as either string or function
    const defaultBody = selectedEndpoint.defaultBody;
    const bodyValue = typeof defaultBody === 'function' ? defaultBody() : defaultBody || '';
    setRequestBody(bodyValue);
    setQueryParams(selectedEndpoint.queryParams || []);
    setResult(null);
    setError(null);
  }, [selectedEndpoint]);

  // Update customApiKey when apiKey prop changes
  useEffect(() => {
    if (apiKey) {
      setCustomApiKey(apiKey);
    }
  }, [apiKey]);

  // Build the full URL
  const fullUrl = useMemo(() => {
    let path = selectedEndpoint.path.replace('{tenantId}', tenantId || 'TENANT_ID');
    const enabledParams = queryParams.filter((p) => p.enabled && p.value);

    if (enabledParams.length > 0) {
      const queryString = enabledParams.map((p) => `${p.key}=${encodeURIComponent(p.value)}`).join('&');
      path += `?${queryString}`;
    }

    return `${baseUrl}${path}`;
  }, [selectedEndpoint.path, tenantId, queryParams, baseUrl]);

  // Execute request
  const executeRequest = useCallback(async () => {
    if (!customApiKey) {
      setError('Por favor ingresa una API Key para probar');
      return;
    }

    if (!tenantId && selectedEndpoint.path.includes('{tenantId}')) {
      setError('No hay un tenant ID disponible');
      return;
    }

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      const url = fullUrl;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${customApiKey}`,
      };

      const fetchOptions: RequestInit = {
        method: selectedEndpoint.method,
        headers,
        signal: abortControllerRef.current.signal,
      };

      if (['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && requestBody) {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = requestBody;
      }

      const response = await fetch(url, fetchOptions);
      const endTime = performance.now();

      // Parse response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parse response body
      let responseBody = '';
      try {
        const text = await response.text();
        responseBody = text ? formatJson(text) : '(empty response)';
      } catch {
        responseBody = '(failed to parse response)';
      }

      setResult({
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        timeMs: Math.round(endTime - startTime),
        success: response.ok,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted, don't show error
        return;
      }

      setError(err instanceof Error ? err.message : 'Error desconocido al ejecutar la petición');
    } finally {
      setIsLoading(false);
    }
  }, [customApiKey, tenantId, selectedEndpoint, requestBody, fullUrl]);

  // Handle query param change
  const updateQueryParam = useCallback((index: number, field: 'value' | 'enabled', value: string | boolean) => {
    setQueryParams((prev) => {
      const updated = [...prev];
      if (field === 'value') {
        updated[index] = { ...updated[index], value: value as string };
      } else {
        updated[index] = { ...updated[index], enabled: value as boolean };
      }
      return updated;
    });
  }, []);

  const methodColors: Record<HttpMethod, string> = {
    GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    PATCH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/30',
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <Terminal className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Sandbox de Pruebas</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Prueba los endpoints de la API en tiempo real
          </p>
        </div>
      </div>

      {/* Warning */}
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-200/70">
            <strong className="text-amber-200">Ambiente de producción:</strong> Las peticiones se
            ejecutan contra tu API real. Los datos creados serán persistentes.
          </p>
        </div>
      </div>

      {/* Endpoint Selector */}
      <div className="space-y-2">
        <label htmlFor="sandbox-endpoint-select" className="text-sm font-medium text-zinc-300">
          Endpoint
        </label>
        <div className="relative">
          <select
            id="sandbox-endpoint-select"
            value={selectedEndpoint.id}
            onChange={(e) => {
              const endpoint = SANDBOX_ENDPOINTS.find((ep) => ep.id === e.target.value);
              if (endpoint) setSelectedEndpoint(endpoint);
            }}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            {SANDBOX_ENDPOINTS.map((endpoint) => (
              <option key={endpoint.id} value={endpoint.id}>
                {endpoint.method} - {endpoint.name} ({endpoint.scope})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* URL Display */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">URL</label>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-mono font-medium rounded border',
              methodColors[selectedEndpoint.method]
            )}
          >
            {selectedEndpoint.method}
          </span>
          <code className="text-sm text-zinc-300 truncate flex-1">{fullUrl}</code>
        </div>
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <label htmlFor="sandbox-api-key" className="text-sm font-medium text-zinc-300">
          API Key
        </label>
        <input
          id="sandbox-api-key"
          type="password"
          value={customApiKey}
          onChange={(e) => setCustomApiKey(e.target.value)}
          placeholder="Ingresa tu API Key aquí..."
          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <p className="text-xs text-zinc-500">
          Puedes copiar una API Key de la lista de arriba
        </p>
      </div>

      {/* Query Parameters */}
      {queryParams.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Parámetros Query</label>
          <div className="space-y-2">
            {queryParams.map((param, index) => (
              <div key={param.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={param.enabled}
                  onChange={(e) => updateQueryParam(index, 'enabled', e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500/50"
                />
                <span className="text-sm text-zinc-400 w-24">{param.key}</span>
                <input
                  type="text"
                  value={param.value}
                  onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                  disabled={!param.enabled}
                  className={cn(
                    'flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-sm text-white',
                    'focus:outline-none focus:ring-1 focus:ring-purple-500/50',
                    !param.enabled && 'opacity-50 cursor-not-allowed'
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Body */}
      {['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && (
        <div className="space-y-2">
          <label htmlFor="sandbox-request-body" className="text-sm font-medium text-zinc-300">
            Request Body (JSON)
          </label>
          <textarea
            id="sandbox-request-body"
            value={requestBody}
            onChange={(e) => setRequestBody(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            placeholder='{ "key": "value" }'
          />
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={executeRequest}
        disabled={isLoading || !customApiKey}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors',
          'bg-purple-600 hover:bg-purple-500 text-white',
          (isLoading || !customApiKey) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Ejecutando...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Ejecutar Petición
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="space-y-3">
          {/* Status Bar */}
          <div
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              getStatusBgColor(result.status)
            )}
          >
            <div className="flex items-center gap-3">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={cn('text-lg font-mono font-bold', getStatusColor(result.status))}>
                {result.status}
              </span>
              <span className="text-sm text-zinc-400">{result.statusText}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{result.timeMs}ms</span>
            </div>
          </div>

          {/* Headers Toggle */}
          <button
            onClick={() => setShowHeaders(!showHeaders)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            <ChevronDown
              className={cn('w-4 h-4 transition-transform', showHeaders && 'rotate-180')}
            />
            {showHeaders ? 'Ocultar' : 'Mostrar'} headers de respuesta
          </button>

          {/* Response Headers */}
          {showHeaders && (
            <div className="rounded-lg bg-zinc-900 p-3 overflow-x-auto">
              <div className="space-y-1 text-xs font-mono">
                {Object.entries(result.headers).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-purple-400">{key}:</span>
                    <span className="text-zinc-400">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response Body */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-300">Response Body</h4>
            <div className="rounded-lg bg-zinc-900 p-4 overflow-x-auto max-h-96">
              <pre className="text-sm">
                <code
                  className={cn(
                    'whitespace-pre',
                    result.success ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {result.body}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
