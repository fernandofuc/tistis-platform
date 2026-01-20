/**
 * Redis Rate Limiter - Rate limiting distribuido
 * MEJORA-1.3: Implementación con Redis
 *
 * Algoritmo: Sliding Window Log
 * Ventajas vs Fixed Window:
 * - Sin "burst" al inicio de ventana
 * - Distribución más uniforme
 * - Más justo para usuarios
 *
 * Nota: Requiere Redis instalado y REDIS_URL en variables de entorno
 * Si Redis no está disponible, fallback a comportamiento permisivo (fail-open)
 */

import { NextResponse } from 'next/server';

// ============================================
// TIPOS
// ============================================

export interface RedisRateLimitConfig {
  windowMs: number;        // Ventana de tiempo en ms
  maxRequests: number;     // Máximo de requests por ventana
  keyPrefix: string;       // Prefijo para keys en Redis
  blockDurationMs?: number; // Duración del bloqueo tras exceder límite
  skipFailedRequests?: boolean; // No contar requests fallidos
}

export interface RedisRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs: number;
  totalHits: number;
}

export interface RateLimitInfo {
  key: string;
  hits: number;
  windowStart: Date;
  windowEnd: Date;
  isBlocked: boolean;
  blockedUntil?: Date;
}

// ============================================
// CONFIGURACIONES PREDEFINIDAS
// ============================================

export const REDIS_RATE_LIMIT_CONFIGS = {
  // API general
  api: {
    windowMs: 60 * 1000,      // 1 minuto
    maxRequests: 100,
    keyPrefix: 'rl:api',
  },

  // Mensajes AI por tenant
  aiMessages: {
    windowMs: 60 * 1000,      // 1 minuto
    maxRequests: 30,          // 30 mensajes/minuto por tenant
    keyPrefix: 'rl:ai',
    blockDurationMs: 5 * 60 * 1000, // 5 min de bloqueo
  },

  // Webhooks
  webhooks: {
    windowMs: 1000,           // 1 segundo
    maxRequests: 50,          // 50 webhooks/segundo
    keyPrefix: 'rl:webhook',
  },

  // Login/Auth
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5,           // 5 intentos
    keyPrefix: 'rl:auth',
    blockDurationMs: 30 * 60 * 1000, // 30 min de bloqueo
  },

  // Tool calls por conversación
  toolCalls: {
    windowMs: 60 * 1000,      // 1 minuto
    maxRequests: 20,          // 20 tool calls/minuto
    keyPrefix: 'rl:tools',
  },

  // Standard (equivalente al preset existente)
  standard: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'rl:standard',
  },

  // Strict
  strict: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'rl:strict',
  },

  // Upload
  upload: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'rl:upload',
  },
} as const;

// ============================================
// REDIS CLIENT INTERFACE
// ============================================

interface RedisClientInterface {
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
  zcount(key: string, min: string | number, max: string | number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  quit(): Promise<void>;
  on(event: string, callback: (arg?: unknown) => void): void;
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export class RedisRateLimiter {
  private redis: RedisClientInterface | null = null;
  private config: RedisRateLimitConfig;
  private readonly luaScript: string;
  private isConnected: boolean = false;

  constructor(config: RedisRateLimitConfig) {
    this.config = {
      blockDurationMs: 0,
      skipFailedRequests: false,
      ...config,
    };

    // Script Lua para operación atómica
    this.luaScript = `
      local key = KEYS[1]
      local blockKey = KEYS[2]
      local now = tonumber(ARGV[1])
      local windowMs = tonumber(ARGV[2])
      local maxRequests = tonumber(ARGV[3])
      local blockDurationMs = tonumber(ARGV[4])

      -- Verificar si está bloqueado
      local blockedUntil = redis.call('GET', blockKey)
      if blockedUntil and tonumber(blockedUntil) > now then
        return {0, 0, tonumber(blockedUntil), -1}
      end

      -- Limpiar entradas antiguas
      local windowStart = now - windowMs
      redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

      -- Contar requests en ventana actual
      local count = redis.call('ZCARD', key)

      if count >= maxRequests then
        -- Excedió límite
        if blockDurationMs > 0 then
          local blockUntil = now + blockDurationMs
          redis.call('SET', blockKey, blockUntil, 'PX', blockDurationMs)
          return {0, 0, blockUntil, count}
        end
        return {0, 0, now + windowMs, count}
      end

      -- Agregar request actual
      redis.call('ZADD', key, now, now .. ':' .. math.random())
      redis.call('PEXPIRE', key, windowMs)

      local remaining = maxRequests - count - 1
      local resetAt = now + windowMs

      return {1, remaining, resetAt, count + 1}
    `;
  }

  /**
   * Inicializa conexión Redis (lazy initialization)
   */
  private async initRedis(): Promise<boolean> {
    if (this.isConnected && this.redis) return true;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('[RedisRateLimiter] REDIS_URL not configured, using fail-open mode');
      return false;
    }

    try {
      // Dynamic import para ioredis
      const ioredisModule = await import('ioredis').catch(() => null);

      if (!ioredisModule?.default) {
        console.warn('[RedisRateLimiter] ioredis module not available, using fail-open mode');
        return false;
      }

      const Redis = ioredisModule.default;

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
        enableReadyCheck: true,
        lazyConnect: false,
      }) as unknown as RedisClientInterface;

      this.redis.on('error', (error) => {
        console.error('[RedisRateLimiter] Connection error:', error);
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        console.log('[RedisRateLimiter] Connected successfully');
        this.isConnected = true;
      });

      // Esperar conexión
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
        this.redis!.on('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
        this.redis!.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('[RedisRateLimiter] Failed to connect:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Verifica y registra un request
   */
  async check(identifier: string): Promise<RedisRateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const blockKey = `${this.config.keyPrefix}:block:${identifier}`;
    const now = Date.now();

    // Intentar conectar a Redis
    const connected = await this.initRedis();

    if (!connected || !this.redis) {
      // Fail open: permitir si Redis no está disponible
      console.warn('[RedisRateLimiter] Redis not available, allowing request (fail-open)');
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(now + this.config.windowMs),
        retryAfterMs: 0,
        totalHits: 0,
      };
    }

    try {
      const result = await this.redis.eval(
        this.luaScript,
        2,
        key,
        blockKey,
        now.toString(),
        this.config.windowMs.toString(),
        this.config.maxRequests.toString(),
        (this.config.blockDurationMs || 0).toString()
      ) as [number, number, number, number];

      const [allowed, remaining, resetAt, totalHits] = result;

      return {
        allowed: allowed === 1,
        remaining: Math.max(0, remaining),
        resetAt: new Date(resetAt),
        retryAfterMs: allowed === 1 ? 0 : resetAt - now,
        totalHits,
      };
    } catch (error) {
      console.error('[RedisRateLimiter] Error:', error);
      // Fail open: permitir si Redis falla
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(now + this.config.windowMs),
        retryAfterMs: 0,
        totalHits: 0,
      };
    }
  }

  /**
   * Obtiene información del rate limit sin consumir
   */
  async getInfo(identifier: string): Promise<RateLimitInfo> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const blockKey = `${this.config.keyPrefix}:block:${identifier}`;
    const now = Date.now();

    const connected = await this.initRedis();

    if (!connected || !this.redis) {
      return {
        key,
        hits: 0,
        windowStart: new Date(now - this.config.windowMs),
        windowEnd: new Date(now),
        isBlocked: false,
      };
    }

    try {
      const [count, blockedUntil] = await Promise.all([
        this.redis.zcount(key, now - this.config.windowMs, '+inf'),
        this.redis.get(blockKey),
      ]);

      const isBlocked = blockedUntil !== null && parseInt(blockedUntil) > now;

      return {
        key,
        hits: count,
        windowStart: new Date(now - this.config.windowMs),
        windowEnd: new Date(now),
        isBlocked,
        blockedUntil: isBlocked ? new Date(parseInt(blockedUntil!)) : undefined,
      };
    } catch (error) {
      console.error('[RedisRateLimiter] Error getting info:', error);
      return {
        key,
        hits: 0,
        windowStart: new Date(now - this.config.windowMs),
        windowEnd: new Date(now),
        isBlocked: false,
      };
    }
  }

  /**
   * Resetea el contador para un identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const blockKey = `${this.config.keyPrefix}:block:${identifier}`;

    const connected = await this.initRedis();
    if (!connected || !this.redis) return;

    try {
      await this.redis.del(key, blockKey);
    } catch (error) {
      console.error('[RedisRateLimiter] Error resetting:', error);
    }
  }

  /**
   * Bloquea manualmente un identifier
   */
  async block(identifier: string, durationMs: number): Promise<void> {
    const blockKey = `${this.config.keyPrefix}:block:${identifier}`;
    const blockedUntil = Date.now() + durationMs;

    const connected = await this.initRedis();
    if (!connected || !this.redis) return;

    try {
      await this.redis.set(blockKey, blockedUntil.toString(), 'PX', durationMs);
    } catch (error) {
      console.error('[RedisRateLimiter] Error blocking:', error);
    }
  }

  /**
   * Desbloquea manualmente un identifier
   */
  async unblock(identifier: string): Promise<void> {
    const blockKey = `${this.config.keyPrefix}:block:${identifier}`;

    const connected = await this.initRedis();
    if (!connected || !this.redis) return;

    try {
      await this.redis.del(blockKey);
    } catch (error) {
      console.error('[RedisRateLimiter] Error unblocking:', error);
    }
  }

  /**
   * Cierra conexión Redis
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
    }
  }
}

// ============================================
// FACTORY Y CACHE
// ============================================

const rateLimiters = new Map<string, RedisRateLimiter>();

/**
 * Obtiene rate limiter para un tipo específico
 */
export function getRedisRateLimiter(
  type: keyof typeof REDIS_RATE_LIMIT_CONFIGS,
  customConfig?: Partial<RedisRateLimitConfig>
): RedisRateLimiter {
  const configKey = JSON.stringify({ type, ...customConfig });

  if (!rateLimiters.has(configKey)) {
    const baseConfig = REDIS_RATE_LIMIT_CONFIGS[type];
    const config = { ...baseConfig, ...customConfig };
    rateLimiters.set(configKey, new RedisRateLimiter(config));
  }

  return rateLimiters.get(configKey)!;
}

// ============================================
// RESPONSE HELPERS (compatibilidad con rate-limiter.ts existente)
// ============================================

export function redisRateLimitHeaders(
  result: RedisRateLimitResult,
  config?: { maxRequests: number }
): Record<string, string> {
  return {
    'X-RateLimit-Limit': (config?.maxRequests || result.totalHits + result.remaining).toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt.getTime() / 1000).toString(),
  };
}

export function createRedisRateLimitResponse(result: RedisRateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Has excedido el límite de solicitudes. Por favor, espera antes de intentar de nuevo.',
      retryAfterMs: result.retryAfterMs,
      resetAt: result.resetAt.toISOString(),
    },
    {
      status: 429,
      headers: {
        ...redisRateLimitHeaders(result),
        'Retry-After': Math.ceil(result.retryAfterMs / 1000).toString(),
      },
    }
  );
}

// ============================================
// WRAPPER COMPATIBLE CON API EXISTENTE
// ============================================

/**
 * Wrapper para usar en API routes de forma similar al rate-limiter existente
 */
export async function withRedisRateLimit(
  identifier: string,
  type: keyof typeof REDIS_RATE_LIMIT_CONFIGS = 'standard'
): Promise<{
  limited: boolean;
  response: NextResponse | null;
  result: RedisRateLimitResult;
}> {
  const limiter = getRedisRateLimiter(type);
  const result = await limiter.check(identifier);

  if (!result.allowed) {
    return {
      limited: true,
      response: createRedisRateLimitResponse(result),
      result,
    };
  }

  return {
    limited: false,
    response: null,
    result,
  };
}

// ============================================
// CLEANUP
// ============================================

export async function closeAllRedisConnections(): Promise<void> {
  for (const limiter of rateLimiters.values()) {
    await limiter.close();
  }
  rateLimiters.clear();
}

export default RedisRateLimiter;
