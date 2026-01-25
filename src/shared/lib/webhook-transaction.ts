// =====================================================
// TIS TIS PLATFORM - Webhook Transaction Helper
// Provides atomic operations for webhook processing
// Uses compensating transactions pattern for rollback
// =====================================================

import { SupabaseClient } from '@supabase/supabase-js';

interface TransactionOperation<T> {
  name: string;
  execute: () => Promise<T>;
  rollback?: (result: T) => Promise<void>;
}

interface TransactionResult<T> {
  success: boolean;
  results: T[];
  error?: string;
  failedStep?: string;
}

/**
 * Execute multiple operations with rollback support
 * If any operation fails, all previous operations are rolled back
 *
 * @example
 * const result = await executeWithRollback([
 *   {
 *     name: 'Create client',
 *     execute: () => supabase.from('clients').insert(clientData).single(),
 *     rollback: (result) => supabase.from('clients').delete().eq('id', result.data.id),
 *   },
 *   {
 *     name: 'Create subscription',
 *     execute: () => supabase.from('subscriptions').insert(subData).single(),
 *     rollback: (result) => supabase.from('subscriptions').delete().eq('id', result.data.id),
 *   },
 * ]);
 */
export async function executeWithRollback<T>(
  operations: TransactionOperation<T>[]
): Promise<TransactionResult<T>> {
  const results: T[] = [];
  const completedOps: { op: TransactionOperation<T>; result: T }[] = [];

  for (const operation of operations) {
    try {
      const result = await operation.execute();
      results.push(result);
      completedOps.push({ op: operation, result });
    } catch (error) {
      // Rollback all completed operations in reverse order
      console.error(`[Transaction] Operation "${operation.name}" failed, rolling back...`);

      for (const completed of completedOps.reverse()) {
        if (completed.op.rollback) {
          try {
            await completed.op.rollback(completed.result);
            console.log(`[Transaction] Rolled back "${completed.op.name}"`);
          } catch (rollbackError) {
            console.error(`[Transaction] Rollback failed for "${completed.op.name}":`, rollbackError);
          }
        }
      }

      return {
        success: false,
        results,
        error: error instanceof Error ? error.message : 'Unknown error',
        failedStep: operation.name,
      };
    }
  }

  return {
    success: true,
    results,
  };
}

/**
 * Wrapper for Supabase operations with automatic error extraction
 */
export async function safeSupabaseOp<T>(
  operation: Promise<{ data: T | null; error: { message: string } | null }>
): Promise<T> {
  const result = await operation;

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error('Operation returned null data');
  }

  return result.data;
}

/**
 * Create a webhook transaction context
 * Automatically tracks operations and handles rollback
 */
export class WebhookTransaction {
  private operations: { name: string; rollback: () => Promise<void> }[] = [];
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Add an operation to the transaction
   * @param name Operation name for logging
   * @param rollback Function to rollback this operation
   */
  track(name: string, rollback: () => Promise<void>): void {
    this.operations.push({ name, rollback });
  }

  /**
   * Rollback all tracked operations in reverse order
   */
  async rollback(): Promise<void> {
    console.log(`[WebhookTransaction] Rolling back ${this.operations.length} operations...`);

    for (const op of this.operations.reverse()) {
      try {
        await op.rollback();
        console.log(`[WebhookTransaction] Rolled back "${op.name}"`);
      } catch (error) {
        console.error(`[WebhookTransaction] Rollback failed for "${op.name}":`, error);
      }
    }
  }

  /**
   * Insert with automatic rollback tracking
   */
  async insert<T extends Record<string, unknown>>(
    table: string,
    data: T,
    name?: string
  ): Promise<T & { id: string }> {
    const { data: result, error } = await this.supabase
      .from(table)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to insert into ${table}: ${error.message}`);
    }

    const record = result as T & { id: string };

    this.track(name || `Insert into ${table}`, async () => {
      await this.supabase.from(table).delete().eq('id', record.id);
    });

    return record;
  }

  /**
   * Update with automatic rollback tracking
   */
  async update<T extends Record<string, unknown>>(
    table: string,
    id: string,
    data: Partial<T>,
    name?: string
  ): Promise<T> {
    // First get original data for rollback
    const { data: original, error: fetchError } = await this.supabase
      .from(table)
      .select()
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      throw new Error(`Failed to fetch ${table} record for update: ${fetchError?.message}`);
    }

    const { data: result, error } = await this.supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update ${table}: ${error.message}`);
    }

    // Track rollback to restore original values
    const rollbackData: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      rollbackData[key] = original[key];
    }

    this.track(name || `Update ${table}`, async () => {
      await this.supabase.from(table).update(rollbackData).eq('id', id);
    });

    return result as T;
  }

  /**
   * Upsert with automatic rollback tracking
   */
  async upsert<T extends Record<string, unknown>>(
    table: string,
    data: T,
    conflictColumn: string = 'id',
    name?: string
  ): Promise<T & { id: string }> {
    // Check if record exists
    const lookupValue = (data as Record<string, unknown>)[conflictColumn];
    const { data: existing } = await this.supabase
      .from(table)
      .select()
      .eq(conflictColumn, lookupValue)
      .single();

    const { data: result, error } = await this.supabase
      .from(table)
      .upsert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert into ${table}: ${error.message}`);
    }

    const record = result as T & { id: string };

    if (existing) {
      // Was an update - rollback to original
      this.track(name || `Upsert (update) ${table}`, async () => {
        await this.supabase.from(table).upsert(existing);
      });
    } else {
      // Was an insert - rollback by deleting
      this.track(name || `Upsert (insert) ${table}`, async () => {
        await this.supabase.from(table).delete().eq('id', record.id);
      });
    }

    return record;
  }
}

/**
 * Execute a function with transaction-like behavior
 * If the function throws, all tracked operations are rolled back
 */
export async function withWebhookTransaction<T>(
  supabase: SupabaseClient,
  fn: (tx: WebhookTransaction) => Promise<T>
): Promise<T> {
  const tx = new WebhookTransaction(supabase);

  try {
    const result = await fn(tx);
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
