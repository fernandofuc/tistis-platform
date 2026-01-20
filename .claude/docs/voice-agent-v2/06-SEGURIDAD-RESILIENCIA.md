# VOICE AGENT v2.0 - SEGURIDAD Y RESILIENCIA

**Documento:** 06-SEGURIDAD-RESILIENCIA.md
**Version:** 2.0.0
**Fecha:** 2026-01-19
**Estado:** Especificacion Completa

---

## 1. RESUMEN

Este documento detalla los dos componentes criticos de seguridad y resiliencia:

1. **Security Gate**: Sistema de 5 capas de validacion para webhooks
2. **Circuit Breaker**: Sistema de proteccion contra fallas de LangGraph

---

## 2. SECURITY GATE

### 2.1 Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY GATE                               │
│                    (5 Capas de Validacion)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  REQUEST ENTRANTE                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ CAPA 1: IP WHITELIST                                    │    │
│  │ ─────────────────────                                   │    │
│  │ - Verificar IP contra rangos de VAPI                   │    │
│  │ - En desarrollo: permitir localhost                    │    │
│  │ - Overhead: <1ms                                       │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │ PASS                                │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ CAPA 2: HMAC SIGNATURE                                  │    │
│  │ ─────────────────────                                   │    │
│  │ - Verificar X-Vapi-Signature header                    │    │
│  │ - HMAC-SHA256 con timing-safe comparison               │    │
│  │ - Overhead: <5ms                                       │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │ PASS                                │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ CAPA 3: TIMESTAMP VALIDATION                            │    │
│  │ ─────────────────────────                               │    │
│  │ - Verificar X-Vapi-Timestamp header                    │    │
│  │ - Rechazar requests >5 minutos de antiguedad           │    │
│  │ - Protege contra replay attacks                        │    │
│  │ - Overhead: <1ms                                       │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │ PASS                                │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ CAPA 4: RATE LIMITING                                   │    │
│  │ ──────────────────                                      │    │
│  │ - Limite por tenant: 200 req/min                       │    │
│  │ - Limite global: 1000 req/min                          │    │
│  │ - Sliding window algorithm                             │    │
│  │ - Overhead: <5ms                                       │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │ PASS                                │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ CAPA 5: CONTENT VALIDATION                              │    │
│  │ ────────────────────────                                │    │
│  │ - Content-Type: application/json                       │    │
│  │ - Body size < 1MB                                      │    │
│  │ - JSON valido                                          │    │
│  │ - Overhead: <1ms                                       │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │ PASS                                │
│                           ▼                                      │
│  REQUEST AUTORIZADO -> Continuar a handlers                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

OVERHEAD TOTAL: ~12ms maximo
```

### 2.2 Implementacion Completa

```typescript
// src/features/voice-agent/security/webhook-security-gate.ts

import { createHmac, timingSafeEqual } from 'crypto';
import { RateLimiter } from './rate-limiter';
import { IPWhitelist } from './ip-whitelist';

// ============================================================================
// TIPOS
// ============================================================================

export interface SecurityCheckResult {
  passed: boolean;
  check: string;
  message?: string;
  duration_ms?: number;
}

export interface SecurityGateResult {
  valid: boolean;
  failedChecks: SecurityCheckResult[];
  passedChecks: SecurityCheckResult[];
  requestId: string;
  totalDuration_ms: number;
}

export interface SecurityGateConfig {
  // IP Whitelist
  vapiIpRanges: string[];
  allowLocalhost: boolean;

  // Signature
  webhookSecret: string | null;
  requireSignature: boolean;

  // Timestamp
  maxTimestampDrift_ms: number;

  // Rate Limiting
  rateLimitPerTenant: number;
  rateLimitWindow_ms: number;
  rateLimitGlobal: number;

  // Content
  maxBodySize: number;
}

// ============================================================================
// CONFIGURACION POR DEFECTO
// ============================================================================

const DEFAULT_CONFIG: SecurityGateConfig = {
  // IPs de VAPI (verificar documentacion oficial)
  vapiIpRanges: [
    '34.212.0.0/16',    // US-West-2
    '52.40.0.0/16',     // US-West-2
    '44.242.0.0/16',    // US-West-2
    '35.166.0.0/16',    // US-West-2
  ],
  allowLocalhost: process.env.NODE_ENV === 'development',

  webhookSecret: process.env.VAPI_WEBHOOK_SECRET || null,
  requireSignature: process.env.NODE_ENV === 'production',

  maxTimestampDrift_ms: 5 * 60 * 1000, // 5 minutos

  rateLimitPerTenant: 200,  // 200 req/min
  rateLimitWindow_ms: 60 * 1000,
  rateLimitGlobal: 1000,    // 1000 req/min total

  maxBodySize: 1024 * 1024, // 1MB
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

export class WebhookSecurityGate {
  private config: SecurityGateConfig;
  private rateLimiter: RateLimiter;
  private ipWhitelist: IPWhitelist;

  constructor(config?: Partial<SecurityGateConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.rateLimiter = new RateLimiter({
      windowMs: this.config.rateLimitWindow_ms,
      maxRequests: this.config.rateLimitPerTenant,
      maxGlobal: this.config.rateLimitGlobal,
    });

    this.ipWhitelist = new IPWhitelist(this.config.vapiIpRanges);
  }

  // ==========================================================================
  // METODO PRINCIPAL
  // ==========================================================================

  async validate(request: Request): Promise<SecurityGateResult> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const checks: SecurityCheckResult[] = [];

    // Capa 1: IP Whitelist
    checks.push(await this.validateSourceIP(request));

    // Capa 2: HMAC Signature
    checks.push(await this.validateSignature(request));

    // Capa 3: Timestamp
    checks.push(this.validateTimestamp(request));

    // Capa 4: Rate Limiting
    checks.push(await this.checkRateLimit(request));

    // Capa 5: Content Validation
    checks.push(this.validateContent(request));

    const failedChecks = checks.filter(c => !c.passed);
    const passedChecks = checks.filter(c => c.passed);
    const totalDuration = Date.now() - startTime;

    return {
      valid: failedChecks.length === 0,
      failedChecks,
      passedChecks,
      requestId,
      totalDuration_ms: totalDuration,
    };
  }

  // ==========================================================================
  // CAPA 1: IP WHITELIST
  // ==========================================================================

  private async validateSourceIP(request: Request): Promise<SecurityCheckResult> {
    const start = Date.now();

    // Obtener IP real (considerar proxies)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = forwardedFor?.split(',')[0]?.trim() ||
                   request.headers.get('x-real-ip') ||
                   'unknown';

    // Permitir localhost en desarrollo
    if (this.config.allowLocalhost) {
      const localhostIPs = ['127.0.0.1', '::1', 'localhost'];
      if (localhostIPs.includes(realIP)) {
        return {
          passed: true,
          check: 'ip_whitelist',
          duration_ms: Date.now() - start,
        };
      }
    }

    // Validar contra whitelist
    const isAllowed = this.ipWhitelist.isAllowed(realIP);

    return {
      passed: isAllowed,
      check: 'ip_whitelist',
      message: isAllowed ? undefined : `IP ${realIP} not in VAPI whitelist`,
      duration_ms: Date.now() - start,
    };
  }

  // ==========================================================================
  // CAPA 2: HMAC SIGNATURE
  // ==========================================================================

  private async validateSignature(request: Request): Promise<SecurityCheckResult> {
    const start = Date.now();

    const signature = request.headers.get('x-vapi-signature');
    const secret = this.config.webhookSecret;

    // Si no hay secret configurado
    if (!secret) {
      if (this.config.requireSignature) {
        return {
          passed: false,
          check: 'signature',
          message: 'VAPI_WEBHOOK_SECRET not configured but required in production',
          duration_ms: Date.now() - start,
        };
      }
      // En desarrollo, permitir sin signature
      return {
        passed: true,
        check: 'signature',
        duration_ms: Date.now() - start,
      };
    }

    // Verificar que el header existe
    if (!signature) {
      return {
        passed: false,
        check: 'signature',
        message: 'Missing X-Vapi-Signature header',
        duration_ms: Date.now() - start,
      };
    }

    // Calcular signature esperada
    const body = await request.clone().text();
    const expectedSignature = createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Comparacion timing-safe
    try {
      const signatureBuffer = Buffer.from(signature, 'utf-8');
      const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

      // Los buffers deben tener el mismo tamano
      if (signatureBuffer.length !== expectedBuffer.length) {
        return {
          passed: false,
          check: 'signature',
          message: 'Invalid signature format',
          duration_ms: Date.now() - start,
        };
      }

      const passed = timingSafeEqual(signatureBuffer, expectedBuffer);

      return {
        passed,
        check: 'signature',
        message: passed ? undefined : 'Invalid signature',
        duration_ms: Date.now() - start,
      };
    } catch (error) {
      return {
        passed: false,
        check: 'signature',
        message: 'Signature comparison failed',
        duration_ms: Date.now() - start,
      };
    }
  }

  // ==========================================================================
  // CAPA 3: TIMESTAMP VALIDATION
  // ==========================================================================

  private validateTimestamp(request: Request): SecurityCheckResult {
    const start = Date.now();

    const timestamp = request.headers.get('x-vapi-timestamp');

    // Timestamp es opcional pero recomendado
    if (!timestamp) {
      return {
        passed: true,
        check: 'timestamp',
        message: 'Timestamp not provided (optional)',
        duration_ms: Date.now() - start,
      };
    }

    const requestTime = parseInt(timestamp, 10);

    if (isNaN(requestTime)) {
      return {
        passed: false,
        check: 'timestamp',
        message: 'Invalid timestamp format',
        duration_ms: Date.now() - start,
      };
    }

    const currentTime = Date.now();
    const drift = Math.abs(currentTime - requestTime);
    const passed = drift <= this.config.maxTimestampDrift_ms;

    return {
      passed,
      check: 'timestamp',
      message: passed
        ? undefined
        : `Request timestamp too old (drift: ${drift}ms, max: ${this.config.maxTimestampDrift_ms}ms)`,
      duration_ms: Date.now() - start,
    };
  }

  // ==========================================================================
  // CAPA 4: RATE LIMITING
  // ==========================================================================

  private async checkRateLimit(request: Request): Promise<SecurityCheckResult> {
    const start = Date.now();

    // Intentar extraer tenant_id del body
    let tenantId = 'global';

    try {
      const body = await request.clone().json();
      tenantId = body.call?.tenant_id || 'global';
    } catch {
      // Si no podemos parsear, usar global
    }

    const allowed = await this.rateLimiter.consume(tenantId);

    return {
      passed: allowed,
      check: 'rate_limit',
      message: allowed ? undefined : `Rate limit exceeded for tenant: ${tenantId}`,
      duration_ms: Date.now() - start,
    };
  }

  // ==========================================================================
  // CAPA 5: CONTENT VALIDATION
  // ==========================================================================

  private validateContent(request: Request): SecurityCheckResult {
    const start = Date.now();

    // Verificar Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        passed: false,
        check: 'content',
        message: 'Content-Type must be application/json',
        duration_ms: Date.now() - start,
      };
    }

    // Verificar Content-Length
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > this.config.maxBodySize) {
        return {
          passed: false,
          check: 'content',
          message: `Body size ${size} exceeds limit ${this.config.maxBodySize}`,
          duration_ms: Date.now() - start,
        };
      }
    }

    return {
      passed: true,
      check: 'content',
      duration_ms: Date.now() - start,
    };
  }
}

// ============================================================================
// CLASES AUXILIARES
// ============================================================================

// Rate Limiter con sliding window
export class RateLimiter {
  private windows: Map<string, number[]> = new Map();
  private config: {
    windowMs: number;
    maxRequests: number;
    maxGlobal: number;
  };

  constructor(config: { windowMs: number; maxRequests: number; maxGlobal: number }) {
    this.config = config;
  }

  async consume(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Limpiar requests viejos
    const requests = (this.windows.get(key) || []).filter(t => t > windowStart);

    // Verificar limite por key
    if (requests.length >= this.config.maxRequests) {
      return false;
    }

    // Verificar limite global
    let globalCount = 0;
    this.windows.forEach((timestamps) => {
      globalCount += timestamps.filter(t => t > windowStart).length;
    });

    if (globalCount >= this.config.maxGlobal) {
      return false;
    }

    // Agregar request actual
    requests.push(now);
    this.windows.set(key, requests);

    return true;
  }
}

// IP Whitelist con soporte para CIDR
export class IPWhitelist {
  private ranges: Array<{ start: number; end: number }>;

  constructor(cidrRanges: string[]) {
    this.ranges = cidrRanges.map(cidr => this.cidrToRange(cidr));
  }

  isAllowed(ip: string): boolean {
    const ipNum = this.ipToNumber(ip);
    if (ipNum === null) return false;

    return this.ranges.some(range =>
      ipNum >= range.start && ipNum <= range.end
    );
  }

  private cidrToRange(cidr: string): { start: number; end: number } {
    const [ip, bits] = cidr.split('/');
    const ipNum = this.ipToNumber(ip) || 0;
    const mask = bits ? parseInt(bits, 10) : 32;
    const maskBits = ~((1 << (32 - mask)) - 1) >>> 0;

    return {
      start: ipNum & maskBits,
      end: (ipNum & maskBits) | (~maskBits >>> 0),
    };
  }

  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let result = 0;
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) return null;
      result = (result << 8) | num;
    }
    return result >>> 0;
  }
}
```

### 2.3 Uso en Webhook Handler

```typescript
// app/api/voice-agent/webhook/route.ts

import { WebhookSecurityGate } from '@/features/voice-agent/security/webhook-security-gate';
import { voiceLogger } from '@/lib/logger/voice-logger';

const securityGate = new WebhookSecurityGate();

export async function POST(request: Request) {
  const startTime = Date.now();

  // ========================================
  // PASO 1: SECURITY GATE
  // ========================================

  const securityResult = await securityGate.validate(request);

  if (!securityResult.valid) {
    voiceLogger.securityCheckFailed({
      request_id: securityResult.requestId,
      check: securityResult.failedChecks[0].check,
      reason: securityResult.failedChecks[0].message || 'Unknown',
    });

    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'X-Request-ID': securityResult.requestId,
      },
    });
  }

  voiceLogger.webhookReceived({
    request_id: securityResult.requestId,
    latency_ms: securityResult.totalDuration_ms,
  });

  // ========================================
  // PASO 2: CONTINUAR CON HANDLERS...
  // ========================================

  // ... resto del codigo
}
```

---

## 3. CIRCUIT BREAKER

### 3.1 Estados y Transiciones

```
┌─────────────────────────────────────────────────────────────────┐
│                    CIRCUIT BREAKER STATES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                      ┌─────────────┐                            │
│         ┌───────────>│   CLOSED    │<───────────┐              │
│         │            │  (Normal)   │            │              │
│         │            └──────┬──────┘            │              │
│         │                   │                   │              │
│         │    Failures < 5   │   Failures >= 5  │              │
│         │                   │                   │              │
│         │                   ▼                   │              │
│         │            ┌─────────────┐            │              │
│  Success│            │    OPEN     │            │Success x 3  │
│  (any)  │            │  (Failing)  │            │              │
│         │            └──────┬──────┘            │              │
│         │                   │                   │              │
│         │   30s elapsed     │                   │              │
│         │                   │                   │              │
│         │                   ▼                   │              │
│         │            ┌─────────────┐            │              │
│         │            │  HALF_OPEN  │────────────┘              │
│         └────────────│  (Testing)  │                           │
│          1 Failure   └─────────────┘                           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  ESTADOS:                                                        │
│                                                                  │
│  CLOSED    - Normal. Ejecuta operaciones.                       │
│              Si falla >= threshold, transiciona a OPEN.         │
│                                                                  │
│  OPEN      - Circuito abierto. Retorna fallback inmediatamente.│
│              Despues de recovery_timeout, transiciona a         │
│              HALF_OPEN.                                         │
│                                                                  │
│  HALF_OPEN - Prueba. Permite 1-3 requests de prueba.           │
│              Si exito, transiciona a CLOSED.                    │
│              Si falla, vuelve a OPEN.                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Implementacion Completa

```typescript
// src/features/voice-agent/resilience/circuit-breaker.ts

import { voiceLogger } from '@/lib/logger/voice-logger';

// ============================================================================
// TIPOS
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  // Threshold de fallas para abrir circuito
  failureThreshold: number;

  // Tiempo antes de intentar recovery (ms)
  recoveryTimeout: number;

  // Timeout para operaciones (ms)
  maxLatencyMs: number;

  // Intentos en HALF_OPEN antes de cerrar
  halfOpenMaxAttempts: number;

  // Nombre para logging
  name: string;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  lastStateChange: Date;
  totalRequests: number;
  totalFallbacks: number;
}

export interface CircuitBreakerStore {
  getState(tenantId: string): Promise<StoredState | null>;
  saveState(tenantId: string, state: StoredState): Promise<void>;
}

interface StoredState {
  state: CircuitState;
  failure_count: number;
  success_count: number;
  last_failure_at?: string;
  last_success_at?: string;
  last_state_change_at: string;
  opened_at?: string;
}

// ============================================================================
// CONFIGURACION POR DEFECTO
// ============================================================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,        // 5 fallas consecutivas
  recoveryTimeout: 30000,     // 30 segundos
  maxLatencyMs: 8000,         // 8 segundos (VAPI timeout es ~10s)
  halfOpenMaxAttempts: 3,     // 3 exitos para cerrar
  name: 'voice-langgraph',
};

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

export class VoiceCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private lastStateChange = new Date();
  private totalRequests = 0;
  private totalFallbacks = 0;

  private readonly config: CircuitBreakerConfig;
  private readonly tenantId: string;
  private readonly store?: CircuitBreakerStore;

  constructor(
    tenantId: string,
    config?: Partial<CircuitBreakerConfig>,
    store?: CircuitBreakerStore
  ) {
    this.tenantId = tenantId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = store;
  }

  // ==========================================================================
  // INICIALIZACION (cargar estado persistido)
  // ==========================================================================

  async initialize(): Promise<void> {
    if (!this.store) return;

    const stored = await this.store.getState(this.tenantId);
    if (stored) {
      this.state = stored.state;
      this.failures = stored.failure_count;
      this.successes = stored.success_count;
      this.lastFailureTime = stored.last_failure_at
        ? new Date(stored.last_failure_at)
        : undefined;
      this.lastSuccessTime = stored.last_success_at
        ? new Date(stored.last_success_at)
        : undefined;
      this.lastStateChange = new Date(stored.last_state_change_at);
    }
  }

  // ==========================================================================
  // METODO PRINCIPAL: EXECUTE
  // ==========================================================================

  async execute<T>(
    operation: () => Promise<T>,
    fallback: () => T
  ): Promise<{ result: T; usedFallback: boolean; latency_ms: number }> {
    const startTime = Date.now();
    this.totalRequests++;

    // ========================================
    // ESTADO: OPEN
    // ========================================
    if (this.state === 'OPEN') {
      // Verificar si debemos intentar recovery
      if (this.shouldAttemptRecovery()) {
        this.transitionTo('HALF_OPEN');
        voiceLogger.circuitBreakerTripped({
          tenant_id: this.tenantId,
          previous_state: 'OPEN',
          new_state: 'HALF_OPEN',
        });
      } else {
        // Retornar fallback inmediatamente
        this.totalFallbacks++;
        voiceLogger.fallbackUsed({
          tenant_id: this.tenantId,
          reason: 'circuit_open',
        });
        return {
          result: fallback(),
          usedFallback: true,
          latency_ms: Date.now() - startTime,
        };
      }
    }

    // ========================================
    // EJECUTAR OPERACION CON TIMEOUT
    // ========================================
    try {
      const result = await this.executeWithTimeout(operation);
      await this.onSuccess();
      return {
        result,
        usedFallback: false,
        latency_ms: Date.now() - startTime,
      };
    } catch (error) {
      await this.onFailure(error);
      this.totalFallbacks++;
      voiceLogger.fallbackUsed({
        tenant_id: this.tenantId,
        reason: error instanceof Error ? error.message : 'unknown_error',
      });
      return {
        result: fallback(),
        usedFallback: true,
        latency_ms: Date.now() - startTime,
      };
    }
  }

  // ==========================================================================
  // TIMEOUT WRAPPER
  // ==========================================================================

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timeout after ${this.config.maxLatencyMs}ms`)),
          this.config.maxLatencyMs
        )
      ),
    ]);
  }

  // ==========================================================================
  // RECOVERY CHECK
  // ==========================================================================

  private shouldAttemptRecovery(): boolean {
    if (!this.lastFailureTime) return true;

    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.config.recoveryTimeout;
  }

  // ==========================================================================
  // SUCCESS HANDLER
  // ==========================================================================

  private async onSuccess(): Promise<void> {
    this.successes++;
    this.lastSuccessTime = new Date();

    if (this.state === 'HALF_OPEN') {
      // En HALF_OPEN, verificar si alcanzamos el threshold de exitos
      if (this.successes >= this.config.halfOpenMaxAttempts) {
        this.transitionTo('CLOSED');
        this.failures = 0;
        this.successes = 0;
        voiceLogger.circuitBreakerTripped({
          tenant_id: this.tenantId,
          previous_state: 'HALF_OPEN',
          new_state: 'CLOSED',
        });
      }
    } else {
      // En CLOSED, reset failures
      this.failures = 0;
    }

    await this.persistState();
  }

  // ==========================================================================
  // FAILURE HANDLER
  // ==========================================================================

  private async onFailure(error: unknown): Promise<void> {
    this.failures++;
    this.lastFailureTime = new Date();
    this.successes = 0;

    voiceLogger.langGraphTimeout({
      tenant_id: this.tenantId,
      timeout_ms: this.config.maxLatencyMs,
      error: error instanceof Error ? error.message : 'unknown',
    });

    if (this.state === 'HALF_OPEN') {
      // Una falla en HALF_OPEN vuelve a abrir
      this.transitionTo('OPEN');
      voiceLogger.circuitBreakerTripped({
        tenant_id: this.tenantId,
        previous_state: 'HALF_OPEN',
        new_state: 'OPEN',
      });
    } else if (this.failures >= this.config.failureThreshold) {
      // En CLOSED, abrir si alcanzamos threshold
      this.transitionTo('OPEN');
      voiceLogger.circuitBreakerTripped({
        tenant_id: this.tenantId,
        previous_state: 'CLOSED',
        new_state: 'OPEN',
      });
    }

    await this.persistState();
  }

  // ==========================================================================
  // STATE TRANSITIONS
  // ==========================================================================

  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    console.log(
      `[CircuitBreaker:${this.tenantId}] ${previousState} -> ${newState}`
    );
  }

  // ==========================================================================
  // PERSISTENCIA
  // ==========================================================================

  private async persistState(): Promise<void> {
    if (!this.store) return;

    await this.store.saveState(this.tenantId, {
      state: this.state,
      failure_count: this.failures,
      success_count: this.successes,
      last_failure_at: this.lastFailureTime?.toISOString(),
      last_success_at: this.lastSuccessTime?.toISOString(),
      last_state_change_at: this.lastStateChange.toISOString(),
      opened_at: this.state === 'OPEN' ? new Date().toISOString() : undefined,
    });
  }

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      totalFallbacks: this.totalFallbacks,
    };
  }

  // ==========================================================================
  // RESET MANUAL (para testing/admin)
  // ==========================================================================

  async reset(): Promise<void> {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.lastStateChange = new Date();
    await this.persistState();
  }
}
```

### 3.3 Store de Supabase

```typescript
// src/features/voice-agent/resilience/circuit-breaker-store.ts

import { createServerClient } from '@/lib/supabase/server';
import { CircuitBreakerStore, CircuitState } from './circuit-breaker';

interface StoredState {
  state: CircuitState;
  failure_count: number;
  success_count: number;
  last_failure_at?: string;
  last_success_at?: string;
  last_state_change_at: string;
  opened_at?: string;
}

export class SupabaseCircuitBreakerStore implements CircuitBreakerStore {
  async getState(tenantId: string): Promise<StoredState | null> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('voice_circuit_breaker_state')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) return null;

    return {
      state: data.state as CircuitState,
      failure_count: data.failure_count,
      success_count: data.success_count,
      last_failure_at: data.last_failure_at,
      last_success_at: data.last_success_at,
      last_state_change_at: data.last_state_change_at,
      opened_at: data.opened_at,
    };
  }

  async saveState(tenantId: string, state: StoredState): Promise<void> {
    const supabase = await createServerClient();

    await supabase.rpc('update_circuit_breaker_state', {
      p_tenant_id: tenantId,
      p_new_state: state.state,
      p_failure_count: state.failure_count,
      p_success_count: state.success_count,
      p_last_failure_at: state.last_failure_at,
      p_last_success_at: state.last_success_at,
    });
  }
}
```

### 3.4 Fallback Responses

```typescript
// src/features/voice-agent/resilience/fallback-responses.ts

export interface FallbackResponse {
  response: string;
  action?: 'continue' | 'transfer' | 'end_call';
}

export const FALLBACK_RESPONSES: Record<string, Record<string, FallbackResponse>> = {
  // Respuestas por tipo de situacion

  timeout: {
    es: {
      response: 'Disculpa, estoy teniendo dificultades tecnicas en este momento. Podrias intentar de nuevo en unos segundos, o si prefieres puedo transferirte con alguien del equipo.',
      action: 'continue',
    },
    en: {
      response: "Sorry, I'm experiencing technical difficulties right now. Could you try again in a few seconds, or would you prefer I transfer you to someone from our team?",
      action: 'continue',
    },
  },

  booking_failure: {
    es: {
      response: 'No pude completar la reservacion en este momento. Por favor intenta de nuevo o llama en unos minutos. Disculpa las molestias.',
      action: 'continue',
    },
    en: {
      response: "I couldn't complete the reservation right now. Please try again or call back in a few minutes. Sorry for the inconvenience.",
      action: 'continue',
    },
  },

  general_error: {
    es: {
      response: 'Algo salio mal. Podriamos intentar eso de nuevo?',
      action: 'continue',
    },
    en: {
      response: 'Something went wrong. Could we try that again?',
      action: 'continue',
    },
  },

  critical_failure: {
    es: {
      response: 'Lo siento mucho, pero estoy teniendo problemas tecnicos que no puedo resolver. Te voy a transferir con un miembro de nuestro equipo para que te ayude.',
      action: 'transfer',
    },
    en: {
      response: "I'm very sorry, but I'm having technical issues I can't resolve. Let me transfer you to a team member who can help.",
      action: 'transfer',
    },
  },
};

export function getFallbackResponse(
  type: keyof typeof FALLBACK_RESPONSES,
  language: string = 'es'
): FallbackResponse {
  const responses = FALLBACK_RESPONSES[type];
  if (!responses) {
    return FALLBACK_RESPONSES.general_error[language] || FALLBACK_RESPONSES.general_error.es;
  }
  return responses[language] || responses.es;
}
```

### 3.5 Uso en Webhook Handler

```typescript
// Uso en webhook handler

import { VoiceCircuitBreaker } from '@/features/voice-agent/resilience/circuit-breaker';
import { SupabaseCircuitBreakerStore } from '@/features/voice-agent/resilience/circuit-breaker-store';
import { getFallbackResponse } from '@/features/voice-agent/resilience/fallback-responses';

// Cache de circuit breakers por tenant
const circuitBreakers = new Map<string, VoiceCircuitBreaker>();

async function getCircuitBreaker(tenantId: string): Promise<VoiceCircuitBreaker> {
  if (!circuitBreakers.has(tenantId)) {
    const store = new SupabaseCircuitBreakerStore();
    const cb = new VoiceCircuitBreaker(tenantId, undefined, store);
    await cb.initialize();
    circuitBreakers.set(tenantId, cb);
  }
  return circuitBreakers.get(tenantId)!;
}

// En handleConversationUpdate:
async function handleConversationUpdate(body: WebhookBody) {
  const tenantId = body.call.tenant_id;
  const circuitBreaker = await getCircuitBreaker(tenantId);

  const { result, usedFallback, latency_ms } = await circuitBreaker.execute(
    // Operacion principal
    async () => {
      return await VoiceLangGraphService.processVoiceMessage({
        tenant_id: tenantId,
        message: body.messages[body.messages.length - 1].content,
        conversation_history: body.messages,
        // ...
      });
    },
    // Fallback
    () => {
      const fallback = getFallbackResponse('timeout', 'es');
      return {
        response: fallback.response,
        intent: 'FALLBACK',
        signals: [],
      };
    }
  );

  // Log metricas
  voiceLogger.langGraphResponse({
    tenant_id: tenantId,
    latency_ms,
    used_fallback: usedFallback,
    response_length: result.response.length,
    intent: result.intent,
  });

  return { assistantResponse: result.response };
}
```

---

## 4. LOGGING ESTRUCTURADO

### 4.1 Estructura de Logger

```typescript
// src/lib/logger/voice-logger.ts

import { createLogger, LogLevel } from './index';

export interface VoiceLogContext {
  request_id?: string;
  call_id?: string;
  tenant_id?: string;
  event_type?: string;
  latency_ms?: number;
  error?: unknown;
}

const baseLogger = createLogger('voice');

export const voiceLogger = {
  // ========================================
  // WEBHOOK EVENTS
  // ========================================

  webhookReceived: (context: VoiceLogContext) => {
    baseLogger.info('webhook_received', context);
  },

  webhookProcessed: (context: VoiceLogContext & { success: boolean }) => {
    baseLogger.info('webhook_processed', context);
  },

  webhookFailed: (context: VoiceLogContext & { error: string }) => {
    baseLogger.error('webhook_failed', context);
  },

  // ========================================
  // SECURITY EVENTS
  // ========================================

  securityCheckFailed: (context: VoiceLogContext & {
    check: string;
    reason: string;
  }) => {
    baseLogger.warn('security_check_failed', context);
  },

  // ========================================
  // CIRCUIT BREAKER EVENTS
  // ========================================

  circuitBreakerTripped: (context: VoiceLogContext & {
    previous_state: string;
    new_state: string;
  }) => {
    baseLogger.warn('circuit_breaker_state_change', context);
  },

  fallbackUsed: (context: VoiceLogContext & { reason: string }) => {
    baseLogger.info('fallback_response_used', context);
  },

  // ========================================
  // LANGGRAPH EVENTS
  // ========================================

  langGraphProcessing: (context: VoiceLogContext) => {
    baseLogger.debug('langgraph_processing_start', context);
  },

  langGraphResponse: (context: VoiceLogContext & {
    response_length: number;
    intent?: string;
    used_fallback?: boolean;
  }) => {
    baseLogger.info('langgraph_response', context);
  },

  langGraphTimeout: (context: VoiceLogContext & {
    timeout_ms: number;
    error?: string;
  }) => {
    baseLogger.error('langgraph_timeout', context);
  },

  // ========================================
  // CALL EVENTS
  // ========================================

  callStarted: (context: VoiceLogContext & {
    caller_phone: string;
    called_phone: string;
  }) => {
    baseLogger.info('call_started', context);
  },

  callEnded: (context: VoiceLogContext & {
    duration_seconds: number;
    outcome: string;
    successful: boolean;
  }) => {
    baseLogger.info('call_ended', context);
  },

  // ========================================
  // TOOL EVENTS
  // ========================================

  toolExecuted: (context: VoiceLogContext & {
    tool_name: string;
    success: boolean;
    duration_ms: number;
    result?: unknown;
  }) => {
    baseLogger.info('tool_executed', context);
  },
};
```

---

## 5. METRICAS Y MONITOREO

### 5.1 Metricas a Trackear

| Metrica | Tipo | Descripcion |
|---------|------|-------------|
| `voice_webhook_requests_total` | Counter | Total de requests al webhook |
| `voice_webhook_latency_ms` | Histogram | Latencia del webhook |
| `voice_security_failures_total` | Counter | Fallas de seguridad por tipo |
| `voice_circuit_breaker_state` | Gauge | Estado del circuit breaker |
| `voice_fallback_responses_total` | Counter | Veces que se uso fallback |
| `voice_langgraph_latency_ms` | Histogram | Latencia de LangGraph |
| `voice_calls_total` | Counter | Total de llamadas |
| `voice_calls_duration_seconds` | Histogram | Duracion de llamadas |

### 5.2 Alertas Recomendadas

| Alerta | Condicion | Severidad |
|--------|-----------|-----------|
| `VoiceCircuitBreakerOpen` | state == 'OPEN' | Critical |
| `VoiceHighLatency` | p95 > 1000ms | Warning |
| `VoiceSecurityFailures` | rate > 10/min | Warning |
| `VoiceFallbackRate` | rate > 5% | Warning |
| `VoiceWebhookErrors` | rate > 1% | Critical |

---

## 6. CHECKLIST DE IMPLEMENTACION

### 6.1 Security Gate

- [ ] Implementar clase `WebhookSecurityGate`
- [ ] Implementar clase `IPWhitelist`
- [ ] Implementar clase `RateLimiter`
- [ ] Configurar VAPI_WEBHOOK_SECRET en produccion
- [ ] Verificar IPs de VAPI (documentacion oficial)
- [ ] Tests unitarios para cada capa
- [ ] Tests de integracion

### 6.2 Circuit Breaker

- [ ] Implementar clase `VoiceCircuitBreaker`
- [ ] Implementar `SupabaseCircuitBreakerStore`
- [ ] Crear tabla `voice_circuit_breaker_state`
- [ ] Implementar fallback responses
- [ ] Tests unitarios para transiciones de estado
- [ ] Tests de integracion con timeout simulado

### 6.3 Logging

- [ ] Implementar `voiceLogger`
- [ ] Configurar logger estructurado
- [ ] Verificar que logs no contengan PII
- [ ] Configurar retention policy

---

*Este documento es parte de la documentacion de Voice Agent v2.0.*
