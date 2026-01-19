/**
 * Supabase Timeout Wrapper
 * MEJORA-2.2: Añade timeouts a todas las operaciones de Supabase
 *
 * Previene que el sistema se bloquee indefinidamente esperando
 * respuestas de la base de datos. Implementa:
 * - Timeouts configurables por tipo de operación
 * - Manejo de errores consistente
 * - Logging de timeouts para debugging
 * - Wrapper compatible con la API de Supabase
 */

import { SupabaseClient, PostgrestFilterBuilder, PostgrestBuilder } from '@supabase/supabase-js';

// ============================================
// TIPOS
// ============================================

export interface TimeoutConfig {
  defaultTimeoutMs: number;
  rpcTimeoutMs: number;
  queryTimeoutMs: number;
  insertTimeoutMs: number;
  updateTimeoutMs: number;
  deleteTimeoutMs: number;
}

export class TimeoutError extends Error {
  public readonly operation: string;
  public readonly timeoutMs: number;
  public readonly code = 'TIMEOUT';

  constructor(operation: string, timeoutMs: number) {
    super(`Operation "${operation}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export interface TimeoutResult<T> {
  data: T | null;
  error: { message: string; code: string } | null;
}

// ============================================
// CONFIGURACIÓN POR DEFECTO
// ============================================

const DEFAULT_CONFIG: TimeoutConfig = {
  defaultTimeoutMs: 10000,  // 10 segundos
  rpcTimeoutMs: 15000,      // 15 segundos para RPCs (pueden ser más pesados)
  queryTimeoutMs: 10000,    // 10 segundos para queries SELECT
  insertTimeoutMs: 5000,    // 5 segundos para inserts
  updateTimeoutMs: 5000,    // 5 segundos para updates
  deleteTimeoutMs: 5000,    // 5 segundos para deletes
};

// ============================================
// FUNCIONES DE TIMEOUT
// ============================================

/**
 * Envuelve una promesa con timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * RPC con timeout
 * Wrapper para llamadas supabase.rpc()
 */
export async function rpcWithTimeout<T = unknown>(
  supabase: SupabaseClient,
  functionName: string,
  params: Record<string, unknown> = {},
  timeoutMs: number = DEFAULT_CONFIG.rpcTimeoutMs
): Promise<TimeoutResult<T>> {
  const startTime = Date.now();

  try {
    const result = await withTimeout(
      supabase.rpc(functionName, params) as Promise<{ data: T | null; error: unknown }>,
      timeoutMs,
      `rpc:${functionName}`
    );

    const duration = Date.now() - startTime;

    if (duration > timeoutMs * 0.8) {
      console.warn('[Supabase] Slow RPC call:', {
        function: functionName,
        durationMs: duration,
        thresholdMs: timeoutMs,
      });
    }

    if (result.error) {
      return {
        data: null,
        error: {
          message: (result.error as { message?: string }).message || 'Unknown error',
          code: (result.error as { code?: string }).code || 'UNKNOWN',
        },
      };
    }

    return { data: result.data, error: null };
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error('[Supabase] RPC timeout:', {
        function: functionName,
        timeoutMs,
        durationMs: Date.now() - startTime,
      });

      return {
        data: null,
        error: { message: error.message, code: 'TIMEOUT' },
      };
    }

    throw error;
  }
}

/**
 * Query con timeout
 * Wrapper para builders de Supabase (select, insert, update, delete)
 */
export async function queryWithTimeout<T = unknown>(
  queryBuilder: PostgrestBuilder<T> | PostgrestFilterBuilder<unknown, unknown, T[]>,
  timeoutMs: number = DEFAULT_CONFIG.queryTimeoutMs,
  operationName: string = 'query'
): Promise<TimeoutResult<T>> {
  const startTime = Date.now();

  try {
    const result = await withTimeout(
      queryBuilder as Promise<{ data: T | null; error: unknown }>,
      timeoutMs,
      operationName
    );

    const duration = Date.now() - startTime;

    if (duration > timeoutMs * 0.8) {
      console.warn('[Supabase] Slow query:', {
        operation: operationName,
        durationMs: duration,
        thresholdMs: timeoutMs,
      });
    }

    if (result.error) {
      return {
        data: null,
        error: {
          message: (result.error as { message?: string }).message || 'Unknown error',
          code: (result.error as { code?: string }).code || 'UNKNOWN',
        },
      };
    }

    return { data: result.data, error: null };
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error('[Supabase] Query timeout:', {
        operation: operationName,
        timeoutMs,
        durationMs: Date.now() - startTime,
      });

      return {
        data: null,
        error: { message: error.message, code: 'TIMEOUT' },
      };
    }

    throw error;
  }
}

/**
 * Insert con timeout
 */
export async function insertWithTimeout<T = unknown>(
  queryBuilder: PostgrestBuilder<T>,
  timeoutMs: number = DEFAULT_CONFIG.insertTimeoutMs,
  operationName: string = 'insert'
): Promise<TimeoutResult<T>> {
  return queryWithTimeout(queryBuilder, timeoutMs, operationName);
}

/**
 * Update con timeout
 */
export async function updateWithTimeout<T = unknown>(
  queryBuilder: PostgrestBuilder<T>,
  timeoutMs: number = DEFAULT_CONFIG.updateTimeoutMs,
  operationName: string = 'update'
): Promise<TimeoutResult<T>> {
  return queryWithTimeout(queryBuilder, timeoutMs, operationName);
}

/**
 * Delete con timeout
 */
export async function deleteWithTimeout<T = unknown>(
  queryBuilder: PostgrestBuilder<T>,
  timeoutMs: number = DEFAULT_CONFIG.deleteTimeoutMs,
  operationName: string = 'delete'
): Promise<TimeoutResult<T>> {
  return queryWithTimeout(queryBuilder, timeoutMs, operationName);
}

// ============================================
// SUPABASE CLIENT WRAPPER
// ============================================

/**
 * Wrapper de SupabaseClient con timeouts automáticos
 * Uso: const db = getSupabaseWithTimeout(supabase);
 */
export class SupabaseWithTimeout {
  private client: SupabaseClient;
  private config: TimeoutConfig;

  constructor(client: SupabaseClient, config?: Partial<TimeoutConfig>) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * RPC con timeout automático
   */
  async rpc<T = unknown>(
    functionName: string,
    params: Record<string, unknown> = {},
    options?: { timeoutMs?: number }
  ): Promise<TimeoutResult<T>> {
    return rpcWithTimeout<T>(
      this.client,
      functionName,
      params,
      options?.timeoutMs || this.config.rpcTimeoutMs
    );
  }

  /**
   * Acceso a tablas con timeout builder
   */
  from(table: string): TableQueryBuilder {
    return new TableQueryBuilder(this.client.from(table), this.config, table);
  }

  /**
   * Acceso al cliente original para operaciones no soportadas
   */
  get raw(): SupabaseClient {
    return this.client;
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): TimeoutConfig {
    return { ...this.config };
  }
}

/**
 * Builder para queries con timeout
 * Replica la API de Supabase pero añade timeouts
 */
class TableQueryBuilder {
  private builder: ReturnType<SupabaseClient['from']>;
  private config: TimeoutConfig;
  private tableName: string;
  private operationType: 'select' | 'insert' | 'update' | 'delete' = 'select';

  constructor(
    builder: ReturnType<SupabaseClient['from']>,
    config: TimeoutConfig,
    tableName: string
  ) {
    this.builder = builder;
    this.config = config;
    this.tableName = tableName;
  }

  select(columns: string = '*'): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.select(columns);
    this.operationType = 'select';
    return this;
  }

  insert(values: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.insert(values);
    this.operationType = 'insert';
    return this;
  }

  update(values: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.update(values);
    this.operationType = 'update';
    return this;
  }

  delete(): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.delete();
    this.operationType = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.eq(column, value);
    return this;
  }

  neq(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.neq(column, value);
    return this;
  }

  gt(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.gt(column, value);
    return this;
  }

  lt(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.lt(column, value);
    return this;
  }

  gte(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.gte(column, value);
    return this;
  }

  lte(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.lte(column, value);
    return this;
  }

  like(column: string, pattern: string): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.like(column, pattern);
    return this;
  }

  ilike(column: string, pattern: string): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.ilike(column, pattern);
    return this;
  }

  is(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.is(column, value);
    return this;
  }

  in(column: string, values: unknown[]): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.in(column, values);
    return this;
  }

  contains(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.contains(column, value);
    return this;
  }

  containedBy(column: string, value: unknown): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.containedBy(column, value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.order(column, options);
    return this;
  }

  limit(count: number): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.limit(count);
    return this;
  }

  range(from: number, to: number): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.range(from, to);
    return this;
  }

  single(): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.single();
    return this;
  }

  maybeSingle(): this {
    // @ts-expect-error - dynamic builder
    this.builder = this.builder.maybeSingle();
    return this;
  }

  /**
   * Ejecuta la query con timeout
   */
  async execute<T = unknown>(timeoutMs?: number): Promise<TimeoutResult<T>> {
    const timeout = timeoutMs || this.getTimeoutForOperation();
    const operationName = `${this.operationType}:${this.tableName}`;

    return queryWithTimeout<T>(
      this.builder as unknown as PostgrestBuilder<T>,
      timeout,
      operationName
    );
  }

  /**
   * Obtiene el timeout según el tipo de operación
   */
  private getTimeoutForOperation(): number {
    switch (this.operationType) {
      case 'insert':
        return this.config.insertTimeoutMs;
      case 'update':
        return this.config.updateTimeoutMs;
      case 'delete':
        return this.config.deleteTimeoutMs;
      default:
        return this.config.queryTimeoutMs;
    }
  }

  /**
   * Compatibilidad con then() para uso como promesa
   */
  then<TResult = TimeoutResult<unknown>>(
    onFulfilled?: (value: TimeoutResult<unknown>) => TResult | PromiseLike<TResult>,
    onRejected?: (reason: unknown) => TResult | PromiseLike<TResult>
  ): Promise<TResult> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

// ============================================
// FACTORY Y CACHE
// ============================================

const wrappedClients = new WeakMap<SupabaseClient, SupabaseWithTimeout>();

/**
 * Obtiene un wrapper con timeout para un cliente Supabase
 * Usa WeakMap para cachear por cliente (evita memory leaks)
 */
export function getSupabaseWithTimeout(
  client: SupabaseClient,
  config?: Partial<TimeoutConfig>
): SupabaseWithTimeout {
  // Si hay config custom, siempre crear nuevo wrapper
  if (config) {
    return new SupabaseWithTimeout(client, config);
  }

  // Usar cache para config por defecto
  let wrapped = wrappedClients.get(client);
  if (!wrapped) {
    wrapped = new SupabaseWithTimeout(client);
    wrappedClients.set(client, wrapped);
  }

  return wrapped;
}

// ============================================
// HELPERS ADICIONALES
// ============================================

/**
 * Verifica si un error es de timeout
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Obtiene la configuración por defecto
 */
export function getDefaultTimeoutConfig(): TimeoutConfig {
  return { ...DEFAULT_CONFIG };
}

export default SupabaseWithTimeout;
