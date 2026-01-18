// =====================================================
// TIS TIS PLATFORM - API Documentation Component
// Interactive inline documentation with code examples
// =====================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Book,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Terminal,
  ExternalLink,
  Key,
  Shield,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import type { APIScope } from '../types';

// ======================
// TYPES
// ======================

type CodeLanguage = 'curl' | 'javascript' | 'python';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  scope: APIScope;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responseExample: string;
  errorResponses?: ErrorResponse[];
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

interface RequestBody {
  contentType: string;
  fields: Parameter[];
  example: string;
}

interface ErrorResponse {
  code: number;
  description: string;
  example: string;
}

interface APIDocumentationProps {
  tenantId: string | null;
  apiKey?: string;
  baseUrl: string;
  className?: string;
}

// ======================
// CONSTANTS
// ======================

const ENDPOINTS: Endpoint[] = [
  // Leads API
  {
    method: 'GET',
    path: '/api/v1/leads',
    description: 'Obtener lista de leads con paginación y filtros',
    scope: 'leads:read',
    parameters: [
      {
        name: 'page',
        type: 'number',
        required: false,
        description: 'Número de página (default: 1)',
        example: '1',
      },
      {
        name: 'pageSize',
        type: 'number',
        required: false,
        description: 'Elementos por página, máximo 100 (default: 20)',
        example: '20',
      },
      {
        name: 'status',
        type: 'string',
        required: false,
        description: 'Filtrar por estado del lead',
        example: 'new',
      },
      {
        name: 'search',
        type: 'string',
        required: false,
        description: 'Buscar por nombre, teléfono o email',
        example: 'john',
      },
    ],
    responseExample: `{
  "data": [
    {
      "id": "uuid-1234",
      "tenant_id": "tenant-uuid",
      "phone": "+521234567890",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "source": "api",
      "status": "new",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}`,
    errorResponses: [
      {
        code: 401,
        description: 'API Key inválida o no proporcionada',
        example: '{ "error": "Missing API key", "code": "MISSING_KEY" }',
      },
      {
        code: 403,
        description: 'Sin permisos para este scope',
        example: '{ "error": "Insufficient scope", "code": "INSUFFICIENT_SCOPE" }',
      },
      {
        code: 429,
        description: 'Límite de rate excedido',
        example: '{ "error": "Rate limit exceeded", "code": "RATE_LIMIT_EXCEEDED" }',
      },
    ],
  },
  {
    method: 'POST',
    path: '/api/v1/leads',
    description: 'Crear un nuevo lead',
    scope: 'leads:write',
    requestBody: {
      contentType: 'application/json',
      fields: [
        {
          name: 'phone',
          type: 'string',
          required: true,
          description: 'Número de teléfono (7-20 caracteres)',
          example: '+521234567890',
        },
        {
          name: 'name',
          type: 'string',
          required: false,
          description: 'Nombre del lead',
          example: 'Juan Pérez',
        },
        {
          name: 'email',
          type: 'string',
          required: false,
          description: 'Correo electrónico',
          example: 'juan@example.com',
        },
        {
          name: 'source',
          type: 'string',
          required: false,
          description: 'Origen del lead (default: "api")',
          example: 'facebook',
        },
      ],
      example: `{
  "phone": "+521234567890",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "source": "facebook"
}`,
    },
    responseExample: `{
  "data": {
    "id": "uuid-5678",
    "tenant_id": "tenant-uuid",
    "phone": "+521234567890",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "source": "facebook",
    "status": "new",
    "created_at": "2025-01-15T11:00:00Z",
    "updated_at": "2025-01-15T11:00:00Z"
  }
}`,
    errorResponses: [
      {
        code: 400,
        description: 'Datos de entrada inválidos',
        example: '{ "error": "Phone number is required", "code": "VALIDATION_ERROR" }',
      },
      {
        code: 409,
        description: 'Lead duplicado (mismo teléfono)',
        example:
          '{ "error": "A lead with this phone number already exists", "code": "DUPLICATE_LEAD", "existing_id": "uuid-1234" }',
      },
    ],
  },
  // Webhook API
  {
    method: 'GET',
    path: '/api/v1/webhook/{tenantId}',
    description: 'Verificar estado del endpoint de webhook',
    scope: 'webhook:read',
    responseExample: `{
  "status": "ok",
  "tenant_id": "tenant-uuid",
  "message": "Webhook endpoint ready. Send POST requests with your API key.",
  "expected_payload": {
    "event": "string (required)",
    "data": "object (required)",
    "timestamp": "string (optional)"
  }
}`,
  },
  {
    method: 'POST',
    path: '/api/v1/webhook/{tenantId}',
    description: 'Enviar evento via webhook entrante',
    scope: 'webhook:write',
    requestBody: {
      contentType: 'application/json',
      fields: [
        {
          name: 'event',
          type: 'string',
          required: true,
          description: 'Tipo de evento',
          example: 'lead.created',
        },
        {
          name: 'data',
          type: 'object',
          required: true,
          description: 'Datos del evento',
          example: '{ "lead_id": "123", "source": "external" }',
        },
        {
          name: 'timestamp',
          type: 'string',
          required: false,
          description: 'Timestamp ISO 8601',
          example: '2025-01-15T12:00:00Z',
        },
      ],
      example: `{
  "event": "lead.created",
  "data": {
    "lead_id": "external-123",
    "name": "María García",
    "phone": "+521987654321",
    "source": "crm_externo"
  },
  "timestamp": "2025-01-15T12:00:00Z"
}`,
    },
    responseExample: `{
  "received": true,
  "id": "webhook-event-uuid",
  "event": "lead.created"
}`,
    errorResponses: [
      {
        code: 400,
        description: 'Payload de webhook inválido',
        example:
          '{ "error": "Invalid webhook payload. Required: { event: string, data: object }", "code": "INVALID_PAYLOAD" }',
      },
      {
        code: 403,
        description: 'Tenant ID no coincide con la API Key',
        example: '{ "error": "Unauthorized: tenant mismatch", "code": "TENANT_MISMATCH" }',
      },
    ],
  },
];

// ======================
// CODE GENERATORS
// ======================

function generateCurlExample(
  endpoint: Endpoint,
  baseUrl: string,
  apiKey: string,
  tenantId: string | null
): string {
  const path = endpoint.path.replace('{tenantId}', tenantId || 'YOUR_TENANT_ID');
  const url = `${baseUrl}${path}`;

  let cmd = `curl -X ${endpoint.method} "${url}"`;
  cmd += ` \\\n  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}"`;

  if (endpoint.requestBody) {
    cmd += ` \\\n  -H "Content-Type: ${endpoint.requestBody.contentType}"`;
    cmd += ` \\\n  -d '${endpoint.requestBody.example.replace(/\n\s*/g, ' ')}'`;
  }

  if (endpoint.method === 'GET' && endpoint.parameters?.length) {
    const queryParams = endpoint.parameters
      .filter((p) => p.example)
      .map((p) => `${p.name}=${p.example}`)
      .join('&');
    if (queryParams) {
      cmd = cmd.replace(url, `${url}?${queryParams}`);
    }
  }

  return cmd;
}

function generateJavaScriptExample(
  endpoint: Endpoint,
  baseUrl: string,
  apiKey: string,
  tenantId: string | null
): string {
  const path = endpoint.path.replace('{tenantId}', tenantId || 'YOUR_TENANT_ID');

  let code = `const response = await fetch('${baseUrl}${path}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer ${apiKey || 'YOUR_API_KEY'}',`;

  if (endpoint.requestBody) {
    code += `
    'Content-Type': '${endpoint.requestBody.contentType}',`;
  }

  code += `
  },`;

  if (endpoint.requestBody) {
    code += `
  body: JSON.stringify(${endpoint.requestBody.example}),`;
  }

  code += `
});

const data = await response.json();
console.log(data);`;

  return code;
}

function generatePythonExample(
  endpoint: Endpoint,
  baseUrl: string,
  apiKey: string,
  tenantId: string | null
): string {
  const path = endpoint.path.replace('{tenantId}', tenantId || 'YOUR_TENANT_ID');

  let code = `import requests

url = "${baseUrl}${path}"
headers = {
    "Authorization": "Bearer ${apiKey || 'YOUR_API_KEY'}",`;

  if (endpoint.requestBody) {
    code += `
    "Content-Type": "${endpoint.requestBody.contentType}",`;
  }

  code += `
}
`;

  if (endpoint.requestBody) {
    code += `
payload = ${endpoint.requestBody.example}

response = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=payload)`;
  } else {
    code += `
response = requests.${endpoint.method.toLowerCase()}(url, headers=headers)`;
  }

  code += `
print(response.json())`;

  return code;
}

// ======================
// SUB-COMPONENTS
// ======================

interface CodeBlockProps {
  code: string;
  language: CodeLanguage;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  const languageLabels: Record<CodeLanguage, string> = {
    curl: 'cURL',
    javascript: 'JavaScript',
    python: 'Python',
  };

  return (
    <div className="relative rounded-lg bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
        <span className="text-xs font-medium text-zinc-400">{languageLabels[language]}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code className="text-zinc-100 whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

interface EndpointDocProps {
  endpoint: Endpoint;
  baseUrl: string;
  apiKey?: string;
  tenantId: string | null;
}

function EndpointDoc({ endpoint, baseUrl, apiKey, tenantId }: EndpointDocProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>('curl');

  const methodColors: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    PATCH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/30',
  };

  const getCodeExample = useCallback(() => {
    const key = apiKey || 'YOUR_API_KEY';
    switch (selectedLanguage) {
      case 'curl':
        return generateCurlExample(endpoint, baseUrl, key, tenantId);
      case 'javascript':
        return generateJavaScriptExample(endpoint, baseUrl, key, tenantId);
      case 'python':
        return generatePythonExample(endpoint, baseUrl, key, tenantId);
    }
  }, [endpoint, baseUrl, apiKey, tenantId, selectedLanguage]);

  const displayPath = endpoint.path.replace('{tenantId}', tenantId || '{tenantId}');

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        )}
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-mono font-medium rounded border',
            methodColors[endpoint.method]
          )}
        >
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-zinc-300 flex-1">{displayPath}</code>
        <span className="text-xs text-zinc-500 hidden sm:block">{endpoint.scope}</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-4 border-t border-zinc-800">
          {/* Description */}
          <p className="text-sm text-zinc-400">{endpoint.description}</p>

          {/* Required Scope */}
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-400">Scope requerido:</span>
            <code className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-400 rounded">
              {endpoint.scope}
            </code>
          </div>

          {/* Parameters */}
          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300">Parámetros Query</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium text-zinc-400">Nombre</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-400">Tipo</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-400">Requerido</th>
                      <th className="pb-2 font-medium text-zinc-400">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {endpoint.parameters.map((param) => (
                      <tr key={param.name}>
                        <td className="py-2 pr-4">
                          <code className="text-xs text-purple-400">{param.name}</code>
                        </td>
                        <td className="py-2 pr-4 text-zinc-500">{param.type}</td>
                        <td className="py-2 pr-4">
                          {param.required ? (
                            <span className="text-red-400">Sí</span>
                          ) : (
                            <span className="text-zinc-500">No</span>
                          )}
                        </td>
                        <td className="py-2 text-zinc-400">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request Body */}
          {endpoint.requestBody && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300">Request Body</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium text-zinc-400">Campo</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-400">Tipo</th>
                      <th className="pb-2 pr-4 font-medium text-zinc-400">Requerido</th>
                      <th className="pb-2 font-medium text-zinc-400">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {endpoint.requestBody.fields.map((field) => (
                      <tr key={field.name}>
                        <td className="py-2 pr-4">
                          <code className="text-xs text-purple-400">{field.name}</code>
                        </td>
                        <td className="py-2 pr-4 text-zinc-500">{field.type}</td>
                        <td className="py-2 pr-4">
                          {field.required ? (
                            <span className="text-red-400">Sí</span>
                          ) : (
                            <span className="text-zinc-500">No</span>
                          )}
                        </td>
                        <td className="py-2 text-zinc-400">{field.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Code Examples */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-zinc-300">Ejemplo de código</h4>
              <div className="flex gap-1" role="tablist" aria-label="Seleccionar lenguaje">
                {(['curl', 'javascript', 'python'] as CodeLanguage[]).map((lang) => (
                  <button
                    key={lang}
                    role="tab"
                    aria-selected={selectedLanguage === lang}
                    aria-controls={`code-panel-${endpoint.method}-${endpoint.path}`}
                    onClick={() => setSelectedLanguage(lang)}
                    className={cn(
                      'px-2 py-1 text-xs rounded transition-colors',
                      selectedLanguage === lang
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {lang === 'curl' ? 'cURL' : lang === 'javascript' ? 'JS' : 'Python'}
                  </button>
                ))}
              </div>
            </div>
            <CodeBlock code={getCodeExample()} language={selectedLanguage} />
          </div>

          {/* Response Example */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-300">Respuesta exitosa</h4>
            <div className="rounded-lg bg-zinc-900 p-4 overflow-x-auto">
              <pre className="text-sm">
                <code className="text-emerald-400 whitespace-pre">
                  {endpoint.responseExample}
                </code>
              </pre>
            </div>
          </div>

          {/* Error Responses */}
          {endpoint.errorResponses && endpoint.errorResponses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300">Respuestas de error</h4>
              <div className="space-y-2">
                {endpoint.errorResponses.map((error) => (
                  <div key={error.code} className="rounded-lg bg-zinc-900/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 text-xs font-mono bg-red-500/10 text-red-400 rounded">
                        {error.code}
                      </span>
                      <span className="text-xs text-zinc-400">{error.description}</span>
                    </div>
                    <code className="text-xs text-red-300/80">{error.example}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function APIDocumentation({
  tenantId,
  apiKey,
  baseUrl,
  className,
}: APIDocumentationProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Book className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Documentación de la API</h3>
          <p className="text-sm text-zinc-400 mt-1">
            Referencia completa de endpoints disponibles con ejemplos de código
          </p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <Key className="w-4 h-4 text-amber-400" />
          <div>
            <p className="text-xs text-zinc-500">Autenticación</p>
            <p className="text-sm text-zinc-300">Bearer Token</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <Zap className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="text-xs text-zinc-500">Rate Limit</p>
            <p className="text-sm text-zinc-300">Según tu plan</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <Terminal className="w-4 h-4 text-blue-400" />
          <div>
            <p className="text-xs text-zinc-500">Base URL</p>
            <p className="text-sm text-zinc-300 truncate">{baseUrl || 'Tu dominio'}</p>
          </div>
        </div>
      </div>

      {/* Authentication Section */}
      <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="font-medium text-amber-200">Autenticación</h4>
            <p className="text-sm text-amber-200/70">
              Todas las peticiones requieren una API Key válida en el header{' '}
              <code className="px-1 py-0.5 bg-amber-500/10 rounded text-amber-300">
                Authorization
              </code>
              :
            </p>
            <div className="rounded bg-zinc-900 p-3">
              <code className="text-sm text-zinc-300">
                Authorization: Bearer {apiKey || 'tu_api_key_aquí'}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Rate Limit Headers Info */}
      <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
        <h4 className="font-medium text-zinc-200 mb-3 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-zinc-400" />
          Headers de Rate Limit
        </h4>
        <p className="text-sm text-zinc-400 mb-3">
          Cada respuesta incluye headers con información del rate limit:
        </p>
        <div className="space-y-1 text-sm font-mono">
          <div className="flex gap-2">
            <span className="text-purple-400">X-RateLimit-Limit:</span>
            <span className="text-zinc-400">Límite de requests por minuto</span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400">X-RateLimit-Remaining:</span>
            <span className="text-zinc-400">Requests restantes</span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400">X-RateLimit-Reset:</span>
            <span className="text-zinc-400">Timestamp de reset (Unix)</span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400">X-RateLimit-Daily-Limit:</span>
            <span className="text-zinc-400">Límite diario</span>
          </div>
          <div className="flex gap-2">
            <span className="text-purple-400">X-RateLimit-Daily-Remaining:</span>
            <span className="text-zinc-400">Requests diarios restantes</span>
          </div>
        </div>
      </div>

      {/* Endpoints */}
      <div className="space-y-3">
        <h4 className="font-medium text-zinc-200">Endpoints disponibles</h4>
        {ENDPOINTS.map((endpoint, index) => (
          <EndpointDoc
            key={`${endpoint.method}-${endpoint.path}-${index}`}
            endpoint={endpoint}
            baseUrl={baseUrl}
            apiKey={apiKey}
            tenantId={tenantId}
          />
        ))}
      </div>

      {/* Footer Links */}
      <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
        <a
          href="https://docs.tistis.com/api"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Documentación completa
        </a>
      </div>
    </div>
  );
}
