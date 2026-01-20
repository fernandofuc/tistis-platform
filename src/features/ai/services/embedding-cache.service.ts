/**
 * Embedding Cache Service
 * MEJORA-3.4: Caché de embeddings para queries frecuentes
 *
 * Este servicio reduce la latencia y costos de API al cachear
 * embeddings de queries frecuentes. Soporta:
 * - Caché en memoria (siempre disponible)
 * - Caché en Redis (opcional, para compartir entre instancias)
 *
 * La clave de caché se genera usando SHA-256 del texto normalizado
 * más el modelo de embedding para evitar colisiones.
 */

import { createHash } from 'crypto';

// ============================================
// TIPOS
// ============================================

export interface EmbeddingCacheConfig {
  /** URL de Redis (opcional) */
  redisUrl?: string;
  /** TTL en segundos (default: 3600 = 1 hora) */
  ttlSeconds: number;
  /** Tamaño máximo de caché en memoria */
  maxCacheSize: number;
  /** Habilitar compresión de embeddings */
  compressionEnabled: boolean;
}

export interface CachedEmbedding {
  embedding: number[];
  model: string;
  createdAt: number;
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  hitRate: number;
  memoryCacheSize: number;
  redisConnected: boolean;
}

// ============================================
// LRU CACHE IMPLEMENTATION
// ============================================

/**
 * Simple LRU (Least Recently Used) cache
 * Evicta los elementos menos usados cuando alcanza el límite
 */
class LRUCache<T> {
  private cache = new Map<string, T>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Mover al final (más reciente)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    // Si ya existe, eliminar para actualizar posición
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evictar el más antiguo si está lleno
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, value);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export class EmbeddingCacheService {
  private memoryCache: LRUCache<CachedEmbedding>;
  private config: EmbeddingCacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };

  // Redis support - lazy loaded si está disponible
  private redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, mode: string, ttl: number) => Promise<void>;
    del: (key: string) => Promise<void>;
    keys: (pattern: string) => Promise<string[]>;
    quit: () => Promise<void>;
  } | null = null;
  private redisInitialized = false;
  private redisInitPromise: Promise<void> | null = null;

  constructor(config?: Partial<EmbeddingCacheConfig>) {
    this.config = {
      ttlSeconds: 3600, // 1 hora
      maxCacheSize: 10000,
      compressionEnabled: false, // Disabled by default for simplicity
      ...config,
    };

    this.memoryCache = new LRUCache<CachedEmbedding>(this.config.maxCacheSize);

    // Inicializar Redis de forma lazy
    if (this.config.redisUrl || process.env.REDIS_URL) {
      this.redisInitPromise = this.initRedis();
    }
  }

  private async initRedis(): Promise<void> {
    if (this.redisInitialized) return;

    const redisUrl = this.config.redisUrl || process.env.REDIS_URL;
    if (!redisUrl) {
      this.redisInitialized = true;
      return;
    }

    try {
      // Importar dinámicamente ioredis
      const { Redis } = await import('ioredis');
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
      });

      await client.connect();

      this.redis = {
        get: (key: string) => client.get(key),
        set: (key: string, value: string, mode: string, ttl: number) =>
          client.set(key, value, mode as 'EX', ttl).then(() => undefined),
        del: (key: string) => client.del(key).then(() => undefined),
        keys: (pattern: string) => client.keys(pattern),
        quit: () => client.quit().then(() => undefined),
      };

      console.log('[EmbeddingCache] Redis connected');
    } catch (error) {
      console.warn('[EmbeddingCache] Redis unavailable, using memory cache only:', error);
      this.redis = null;
    }

    this.redisInitialized = true;
  }

  /**
   * Genera key de caché a partir del texto
   */
  private getCacheKey(text: string, model: string): string {
    const normalized = text.toLowerCase().trim();
    const hash = createHash('sha256')
      .update(`${model}:${normalized}`)
      .digest('hex')
      .substring(0, 32);

    return `emb:${hash}`;
  }

  /**
   * Espera a que Redis esté inicializado (si aplica)
   */
  private async ensureRedisReady(): Promise<void> {
    if (this.redisInitPromise) {
      await this.redisInitPromise;
    }
  }

  /**
   * Obtiene embedding de caché
   */
  async get(text: string, model: string): Promise<number[] | null> {
    const key = this.getCacheKey(text, model);

    // Intentar memoria primero (siempre más rápido)
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached) {
      this.stats.hits++;
      memoryCached.hitCount++;
      return memoryCached.embedding;
    }

    // Intentar Redis
    await this.ensureRedisReady();
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          this.stats.hits++;
          const parsed: CachedEmbedding = JSON.parse(cached);

          // Guardar en memoria para accesos futuros
          parsed.hitCount++;
          this.memoryCache.set(key, parsed);

          // Actualizar hit count en Redis (fire-and-forget)
          this.redis.set(key, JSON.stringify(parsed), 'EX', this.config.ttlSeconds).catch(() => {});

          return parsed.embedding;
        }
      } catch (error) {
        console.error('[EmbeddingCache] Redis get error:', error);
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Guarda embedding en caché
   */
  async set(text: string, model: string, embedding: number[]): Promise<void> {
    const key = this.getCacheKey(text, model);

    const cacheEntry: CachedEmbedding = {
      embedding,
      model,
      createdAt: Date.now(),
      hitCount: 0,
    };

    // Guardar en memoria
    this.memoryCache.set(key, cacheEntry);
    this.stats.sets++;

    // Guardar en Redis (si disponible)
    await this.ensureRedisReady();
    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(cacheEntry), 'EX', this.config.ttlSeconds);
      } catch (error) {
        console.error('[EmbeddingCache] Redis set error:', error);
      }
    }
  }

  /**
   * Obtiene o genera embedding
   * Si está en caché, lo retorna. Si no, ejecuta generateFn y cachea el resultado.
   */
  async getOrGenerate(
    text: string,
    model: string,
    generateFn: () => Promise<number[]>
  ): Promise<{ embedding: number[]; fromCache: boolean }> {
    // Intentar obtener de caché
    const cached = await this.get(text, model);
    if (cached) {
      return { embedding: cached, fromCache: true };
    }

    // Generar nuevo embedding
    const embedding = await generateFn();

    // Guardar en caché (fire-and-forget para no bloquear)
    this.set(text, model, embedding).catch((err) => {
      console.error('[EmbeddingCache] Error caching embedding:', err);
    });

    return { embedding, fromCache: false };
  }

  /**
   * Invalida caché para un texto
   */
  async invalidate(text: string, model: string): Promise<void> {
    const key = this.getCacheKey(text, model);

    this.memoryCache.delete(key);

    await this.ensureRedisReady();
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error('[EmbeddingCache] Redis delete error:', error);
      }
    }
  }

  /**
   * Limpia todo el caché
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    await this.ensureRedisReady();
    if (this.redis) {
      try {
        const keys = await this.redis.keys('emb:*');
        if (keys.length > 0) {
          for (const key of keys) {
            await this.redis.del(key);
          }
        }
      } catch (error) {
        console.error('[EmbeddingCache] Redis clear error:', error);
      }
    }
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      memoryCacheSize: this.memoryCache.size,
      redisConnected: this.redis !== null,
    };
  }

  /**
   * Resetea estadísticas
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
  }

  /**
   * Cierra conexiones
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
        this.redis = null;
        console.log('[EmbeddingCache] Redis connection closed');
      } catch (error) {
        console.error('[EmbeddingCache] Error closing Redis:', error);
      }
    }
    this.memoryCache.clear();
  }
}

// ============================================
// SINGLETON
// ============================================

let cacheServiceInstance: EmbeddingCacheService | null = null;

export function getEmbeddingCacheService(
  config?: Partial<EmbeddingCacheConfig>
): EmbeddingCacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new EmbeddingCacheService(config);
  }
  return cacheServiceInstance;
}

/**
 * Crea una nueva instancia con configuración custom
 */
export function createEmbeddingCacheService(
  config?: Partial<EmbeddingCacheConfig>
): EmbeddingCacheService {
  return new EmbeddingCacheService(config);
}

/**
 * Cierra el singleton y limpia recursos
 */
export async function shutdownEmbeddingCache(): Promise<void> {
  if (cacheServiceInstance) {
    await cacheServiceInstance.shutdown();
    cacheServiceInstance = null;
  }
}

export default EmbeddingCacheService;
