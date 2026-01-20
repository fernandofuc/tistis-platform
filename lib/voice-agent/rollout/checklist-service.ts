/**
 * TIS TIS Platform - Voice Agent v2.0
 * Pre-Rollout Checklist Service
 *
 * Manages pre-rollout verification checklist:
 * - Checklist creation and management
 * - Item completion tracking
 * - Approval workflow
 * - Automatic checks
 *
 * NOTE: This module uses untyped Supabase operations because the rollout tables
 * are not in the generated types. Run `supabase gen types typescript` after
 * creating the rollout migration to get proper type inference.
 *
 * @module lib/voice-agent/rollout/checklist-service
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  PreRolloutChecklist,
  ChecklistItem,
} from './types';
import { DEFAULT_CHECKLIST_ITEMS } from './types';
import { getVoiceLogger } from '../monitoring/voice-logger';
import { getMetricsRegistry } from '../monitoring/voice-metrics';
import { getAlertManager } from '../monitoring/alert-manager';

// =====================================================
// CONFIGURATION
// =====================================================

export interface ChecklistServiceConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
}

const DEFAULT_CONFIG: ChecklistServiceConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
};

// =====================================================
// CHECKLIST SERVICE
// =====================================================

/**
 * Untyped Supabase client for tables without generated types
 */
type UntypedSupabaseClient = SupabaseClient<any, any, any>;

/**
 * Service for managing pre-rollout checklist
 */
export class ChecklistService {
  private readonly config: ChecklistServiceConfig;
  private readonly supabase: UntypedSupabaseClient;
  private readonly logger = getVoiceLogger();
  private static instance: ChecklistService | null = null;

  constructor(config?: Partial<ChecklistServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.supabase = createClient(
      this.config.supabaseUrl,
      this.config.supabaseServiceKey
    ) as UntypedSupabaseClient;
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<ChecklistServiceConfig>): ChecklistService {
    if (!ChecklistService.instance) {
      ChecklistService.instance = new ChecklistService(config);
    }
    return ChecklistService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    ChecklistService.instance = null;
  }

  // =====================================================
  // CHECKLIST METHODS
  // =====================================================

  /**
   * Get or create the current checklist
   */
  async getOrCreateChecklist(): Promise<PreRolloutChecklist> {
    // Try to get existing active checklist
    const { data: existing } = await this.supabase
      .from('rollout_checklists')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return this.parseChecklist(existing);
    }

    // Create new checklist
    return this.createChecklist();
  }

  /**
   * Create a new checklist
   */
  async createChecklist(): Promise<PreRolloutChecklist> {
    const items: ChecklistItem[] = DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
      id: `item_${index}_${Date.now()}`,
      ...item,
      completed: false,
      completedBy: null,
      completedAt: null,
      notes: null,
    }));

    const checklistId = `checklist_${Date.now()}`;
    const now = new Date().toISOString();

    const checklistData = {
      id: checklistId,
      status: 'active',
      items,
      approved_by: null,
      approved_at: null,
      created_at: now,
      updated_at: now,
    };

    const { error } = await this.supabase
      .from('rollout_checklists')
      .insert(checklistData as any);

    if (error) {
      this.logger.error('Failed to create checklist', error);
      throw new Error(`Failed to create checklist: ${error.message}`);
    }

    this.logger.info('Pre-rollout checklist created', {
      data: { checklistId, itemCount: items.length },
    });

    return {
      id: checklistId,
      createdAt: now,
      updatedAt: now,
      items,
      completionPercentage: 0,
      allRequiredComplete: false,
      approvedBy: null,
      approvedAt: null,
    };
  }

  /**
   * Parse checklist from database
   */
  private parseChecklist(data: Record<string, unknown>): PreRolloutChecklist {
    const items = (data.items as ChecklistItem[]) ?? [];
    const completedCount = items.filter((i) => i.completed).length;
    const requiredItems = items.filter((i) => i.required);
    const allRequiredComplete = requiredItems.every((i) => i.completed);

    return {
      id: data.id as string,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      items,
      completionPercentage: items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
      allRequiredComplete,
      approvedBy: data.approved_by as string | null,
      approvedAt: data.approved_at as string | null,
    };
  }

  /**
   * Complete a checklist item
   */
  async completeItem(
    checklistId: string,
    itemId: string,
    completedBy: string,
    notes?: string
  ): Promise<PreRolloutChecklist> {
    const checklist = await this.getChecklist(checklistId);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    const now = new Date().toISOString();
    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          completed: true,
          completedBy,
          completedAt: now,
          notes: notes ?? item.notes,
        };
      }
      return item;
    });

    const { error } = await this.supabase
      .from('rollout_checklists')
      .update({
        items: updatedItems,
        updated_at: now,
      } as any)
      .eq('id', checklistId);

    if (error) {
      throw new Error(`Failed to complete item: ${error.message}`);
    }

    this.logger.info('Checklist item completed', {
      data: { checklistId, itemId, completedBy },
    });

    return this.getChecklist(checklistId) as Promise<PreRolloutChecklist>;
  }

  /**
   * Uncomplete a checklist item
   */
  async uncompleteItem(checklistId: string, itemId: string): Promise<PreRolloutChecklist> {
    const checklist = await this.getChecklist(checklistId);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    const now = new Date().toISOString();
    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          completed: false,
          completedBy: null,
          completedAt: null,
        };
      }
      return item;
    });

    const { error } = await this.supabase
      .from('rollout_checklists')
      .update({
        items: updatedItems,
        updated_at: now,
        approved_by: null,
        approved_at: null,
      } as any)
      .eq('id', checklistId);

    if (error) {
      throw new Error(`Failed to uncomplete item: ${error.message}`);
    }

    return this.getChecklist(checklistId) as Promise<PreRolloutChecklist>;
  }

  /**
   * Add notes to an item
   */
  async addItemNotes(checklistId: string, itemId: string, notes: string): Promise<PreRolloutChecklist> {
    const checklist = await this.getChecklist(checklistId);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    const now = new Date().toISOString();
    const updatedItems = checklist.items.map((item) => {
      if (item.id === itemId) {
        return { ...item, notes };
      }
      return item;
    });

    const { error } = await this.supabase
      .from('rollout_checklists')
      .update({
        items: updatedItems,
        updated_at: now,
      } as any)
      .eq('id', checklistId);

    if (error) {
      throw new Error(`Failed to add notes: ${error.message}`);
    }

    return this.getChecklist(checklistId) as Promise<PreRolloutChecklist>;
  }

  /**
   * Get checklist by ID
   */
  async getChecklist(checklistId: string): Promise<PreRolloutChecklist | null> {
    const { data, error } = await this.supabase
      .from('rollout_checklists')
      .select('*')
      .eq('id', checklistId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.parseChecklist(data);
  }

  /**
   * Approve checklist for rollout
   */
  async approveChecklist(checklistId: string, approvedBy: string): Promise<PreRolloutChecklist> {
    const checklist = await this.getChecklist(checklistId);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    if (!checklist.allRequiredComplete) {
      throw new Error('Cannot approve - not all required items are complete');
    }

    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from('rollout_checklists')
      .update({
        approved_by: approvedBy,
        approved_at: now,
        updated_at: now,
      } as any)
      .eq('id', checklistId);

    if (error) {
      throw new Error(`Failed to approve checklist: ${error.message}`);
    }

    this.logger.info('Pre-rollout checklist approved', {
      data: { checklistId, approvedBy },
    });

    return this.getChecklist(checklistId) as Promise<PreRolloutChecklist>;
  }

  /**
   * Revoke checklist approval
   */
  async revokeApproval(checklistId: string): Promise<PreRolloutChecklist> {
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from('rollout_checklists')
      .update({
        approved_by: null,
        approved_at: null,
        updated_at: now,
      } as any)
      .eq('id', checklistId);

    if (error) {
      throw new Error(`Failed to revoke approval: ${error.message}`);
    }

    return this.getChecklist(checklistId) as Promise<PreRolloutChecklist>;
  }

  // =====================================================
  // AUTOMATIC CHECKS
  // =====================================================

  /**
   * Run automatic checks and update checklist
   */
  async runAutomaticChecks(checklistId: string): Promise<{
    checklist: PreRolloutChecklist;
    results: AutoCheckResult[];
  }> {
    const checklist = await this.getChecklist(checklistId);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    const results: AutoCheckResult[] = [];

    // Check metrics collection
    const metricsResult = await this.checkMetricsCollection();
    results.push(metricsResult);

    // Check alert rules
    const alertsResult = await this.checkAlertRules();
    results.push(alertsResult);

    // Check feature flags
    const flagsResult = await this.checkFeatureFlags();
    results.push(flagsResult);

    // Auto-complete items that pass
    for (const result of results) {
      if (result.passed) {
        const item = checklist.items.find((i) => i.description.toLowerCase().includes(result.checkType.toLowerCase()));
        if (item && !item.completed) {
          await this.completeItem(checklistId, item.id, 'system', `Auto-verified: ${result.message}`);
        }
      }
    }

    const updatedChecklist = await this.getChecklist(checklistId);

    this.logger.info('Automatic checks completed', {
      data: {
        checklistId,
        passed: results.filter((r) => r.passed).length,
        failed: results.filter((r) => !r.passed).length,
      },
    });

    return {
      checklist: updatedChecklist!,
      results,
    };
  }

  /**
   * Check if metrics collection is active
   */
  private async checkMetricsCollection(): Promise<AutoCheckResult> {
    try {
      const registry = getMetricsRegistry();
      const metric = registry.getMetric('voice_calls_total');

      if (metric) {
        return {
          checkType: 'Metrics collection',
          passed: true,
          message: 'Metrics registry is active and collecting data',
        };
      }

      return {
        checkType: 'Metrics collection',
        passed: false,
        message: 'Metrics registry not properly initialized',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkType: 'Metrics collection',
        passed: false,
        message: `Error checking metrics: ${errorMessage}`,
      };
    }
  }

  /**
   * Check if alert rules are configured
   */
  private async checkAlertRules(): Promise<AutoCheckResult> {
    try {
      const alertManager = getAlertManager();
      const rules = alertManager.getRules();

      if (rules.length >= 3) {
        return {
          checkType: 'Alert rules',
          passed: true,
          message: `${rules.length} alert rules configured`,
        };
      }

      return {
        checkType: 'Alert rules',
        passed: false,
        message: `Only ${rules.length} alert rules configured (minimum 3 required)`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkType: 'Alert rules',
        passed: false,
        message: `Error checking alerts: ${errorMessage}`,
      };
    }
  }

  /**
   * Check if feature flags are configured
   */
  private async checkFeatureFlags(): Promise<AutoCheckResult> {
    try {
      const { data, error } = await this.supabase
        .from('platform_feature_flags')
        .select('*')
        .eq('name', 'voice_agent_v2')
        .single();

      if (error || !data) {
        return {
          checkType: 'Feature flags',
          passed: false,
          message: 'Feature flag voice_agent_v2 not found in database',
        };
      }

      return {
        checkType: 'Feature flags',
        passed: true,
        message: 'Feature flag voice_agent_v2 configured in database',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        checkType: 'Feature flags',
        passed: false,
        message: `Error checking feature flags: ${errorMessage}`,
      };
    }
  }

  // =====================================================
  // HISTORY
  // =====================================================

  /**
   * Get checklist history
   */
  async getChecklistHistory(limit: number = 10): Promise<PreRolloutChecklist[]> {
    const { data, error } = await this.supabase
      .from('rollout_checklists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.parseChecklist(row));
  }

  /**
   * Archive a checklist
   */
  async archiveChecklist(checklistId: string): Promise<void> {
    const { error } = await this.supabase
      .from('rollout_checklists')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', checklistId);

    if (error) {
      throw new Error(`Failed to archive checklist: ${error.message}`);
    }
  }
}

// =====================================================
// TYPES
// =====================================================

interface AutoCheckResult {
  checkType: string;
  passed: boolean;
  message: string;
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Get checklist service instance
 */
export function getChecklistService(): ChecklistService {
  return ChecklistService.getInstance();
}

/**
 * Get or create the current checklist
 */
export async function getOrCreateChecklist(): Promise<PreRolloutChecklist> {
  return ChecklistService.getInstance().getOrCreateChecklist();
}

/**
 * Complete a checklist item
 */
export async function completeChecklistItem(
  checklistId: string,
  itemId: string,
  completedBy: string,
  notes?: string
): Promise<PreRolloutChecklist> {
  return ChecklistService.getInstance().completeItem(checklistId, itemId, completedBy, notes);
}

/**
 * Approve checklist
 */
export async function approveChecklist(checklistId: string, approvedBy: string): Promise<PreRolloutChecklist> {
  return ChecklistService.getInstance().approveChecklist(checklistId, approvedBy);
}

/**
 * Run automatic checks
 */
export async function runAutomaticChecks(checklistId: string): Promise<{
  checklist: PreRolloutChecklist;
  results: AutoCheckResult[];
}> {
  return ChecklistService.getInstance().runAutomaticChecks(checklistId);
}
