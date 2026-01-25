// =====================================================
// TIS TIS PLATFORM - Usage Service Tests
// Sprint 5: AI Setup Assistant
// Migrated to Vitest
// =====================================================

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { UsageService, usageService } from '../../services/usage.service';
import { createServerClient } from '@/src/shared/lib/supabase';

// Mock Supabase
vi.mock('@/src/shared/lib/supabase', () => ({
  createServerClient: vi.fn(),
}));

describe('UsageService', () => {
  const mockSupabase = {
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServerClient as Mock).mockReturnValue(mockSupabase);
  });

  // ======================
  // getInstance Tests
  // ======================

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = UsageService.getInstance();
      const instance2 = UsageService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should export usageService as singleton', () => {
      expect(usageService).toBe(UsageService.getInstance());
    });
  });

  // ======================
  // getUsage Tests
  // ======================

  describe('getUsage', () => {
    it('should return usage data for a tenant', async () => {
      const mockUsageData = [{
        messages_count: 10,
        messages_limit: 50,
        files_uploaded: 2,
        files_limit: 10,
        vision_requests: 1,
        vision_limit: 5,
        total_tokens: 5000,
        tokens_limit: 50000,
        plan_id: 'essentials',
        plan_name: 'Essentials',
        is_at_limit: false,
        reset_at: new Date().toISOString(),
      }];

      mockSupabase.rpc.mockResolvedValue({ data: mockUsageData, error: null });

      const result = await usageService.getUsage('tenant-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_setup_usage_with_limits', {
        p_tenant_id: 'tenant-123',
      });
      expect(result.messagesCount).toBe(10);
      expect(result.messagesLimit).toBe(50);
      expect(result.filesUploaded).toBe(2);
      expect(result.filesLimit).toBe(10);
      expect(result.visionRequests).toBe(1);
      expect(result.visionLimit).toBe(5);
      expect(result.planId).toBe('essentials');
      expect(result.planName).toBe('Essentials');
      expect(result.isAtLimit).toBe(false);
      expect(result.tokensUsed).toBe(5000);
      expect(result.tokensLimit).toBe(50000);
    });

    it('should calculate percentages correctly', async () => {
      const mockUsageData = [{
        messages_count: 25,
        messages_limit: 50,
        files_uploaded: 5,
        files_limit: 10,
        vision_requests: 3,
        vision_limit: 10,
        total_tokens: 25000,
        tokens_limit: 50000,
        plan_id: 'essentials',
        plan_name: 'Essentials',
        is_at_limit: false,
        reset_at: new Date().toISOString(),
      }];

      mockSupabase.rpc.mockResolvedValue({ data: mockUsageData, error: null });

      const result = await usageService.getUsage('tenant-123');

      expect(result.percentages.messages).toBe(50);
      expect(result.percentages.files).toBe(50);
      expect(result.percentages.vision).toBe(30);
      expect(result.percentages.tokens).toBe(50);
    });

    it('should return 0 percentages for enterprise plan', async () => {
      const mockUsageData = [{
        messages_count: 1000,
        messages_limit: 999999,
        files_uploaded: 100,
        files_limit: 999999,
        vision_requests: 50,
        vision_limit: 999999,
        total_tokens: 500000,
        tokens_limit: 999999,
        plan_id: 'enterprise',
        plan_name: 'Enterprise',
        is_at_limit: false,
        reset_at: new Date().toISOString(),
      }];

      mockSupabase.rpc.mockResolvedValue({ data: mockUsageData, error: null });

      const result = await usageService.getUsage('tenant-123');

      expect(result.percentages.messages).toBe(0);
      expect(result.percentages.files).toBe(0);
      expect(result.percentages.vision).toBe(0);
      expect(result.percentages.tokens).toBe(0);
    });

    it('should return defaults when no data found', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await usageService.getUsage('tenant-123');

      expect(result.messagesCount).toBe(0);
      expect(result.filesUploaded).toBe(0);
      expect(result.visionRequests).toBe(0);
      expect(result.tokensUsed).toBe(0);
      expect(result.planId).toBe('starter');
      expect(result.planName).toBe('Starter');
      expect(result.isAtLimit).toBe(false);
    });

    it('should return defaults when data array is empty', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const result = await usageService.getUsage('tenant-123');

      expect(result.messagesCount).toBe(0);
      expect(result.planId).toBe('starter');
    });

    it('should throw error when RPC fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(usageService.getUsage('tenant-123')).rejects.toThrow(
        'Failed to get usage'
      );
    });
  });

  // ======================
  // canPerformAction Tests
  // ======================

  describe('canPerformAction', () => {
    it('should allow message action when under limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          messages_count: 10,
          messages_limit: 50,
          files_uploaded: 2,
          files_limit: 10,
          vision_requests: 1,
          vision_limit: 5,
          total_tokens: 5000,
          tokens_limit: 50000,
          plan_id: 'essentials',
          plan_name: 'Essentials',
          is_at_limit: false,
          reset_at: new Date().toISOString(),
        }],
        error: null,
      });

      const result = await usageService.canPerformAction('tenant-123', 'message');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny message action when at limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          messages_count: 50,
          messages_limit: 50,
          files_uploaded: 2,
          files_limit: 10,
          vision_requests: 1,
          vision_limit: 5,
          total_tokens: 5000,
          tokens_limit: 50000,
          plan_id: 'essentials',
          plan_name: 'Essentials',
          is_at_limit: true,
          reset_at: new Date().toISOString(),
        }],
        error: null,
      });

      const result = await usageService.canPerformAction('tenant-123', 'message');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('límite');
      expect(result.reason).toContain('50');
      expect(result.currentCount).toBe(50);
      expect(result.limitCount).toBe(50);
    });

    it('should allow file action when under limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          messages_count: 10,
          messages_limit: 50,
          files_uploaded: 5,
          files_limit: 10,
          vision_requests: 1,
          vision_limit: 5,
          total_tokens: 5000,
          tokens_limit: 50000,
          plan_id: 'essentials',
          plan_name: 'Essentials',
          is_at_limit: false,
          reset_at: new Date().toISOString(),
        }],
        error: null,
      });

      const result = await usageService.canPerformAction('tenant-123', 'file');

      expect(result.allowed).toBe(true);
    });

    it('should deny file action when at limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          messages_count: 10,
          messages_limit: 50,
          files_uploaded: 10,
          files_limit: 10,
          vision_requests: 1,
          vision_limit: 5,
          total_tokens: 5000,
          tokens_limit: 50000,
          plan_id: 'essentials',
          plan_name: 'Essentials',
          is_at_limit: false,
          reset_at: new Date().toISOString(),
        }],
        error: null,
      });

      const result = await usageService.canPerformAction('tenant-123', 'file');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('archivos');
    });

    it('should deny vision action when at limit', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          messages_count: 10,
          messages_limit: 50,
          files_uploaded: 2,
          files_limit: 10,
          vision_requests: 5,
          vision_limit: 5,
          total_tokens: 5000,
          tokens_limit: 50000,
          plan_id: 'essentials',
          plan_name: 'Essentials',
          is_at_limit: false,
          reset_at: new Date().toISOString(),
        }],
        error: null,
      });

      const result = await usageService.canPerformAction('tenant-123', 'vision');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('análisis de imagen');
    });

    it('should always allow enterprise tenants', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          messages_count: 999999,
          messages_limit: 999999,
          files_uploaded: 999999,
          files_limit: 999999,
          vision_requests: 999999,
          vision_limit: 999999,
          total_tokens: 999999,
          tokens_limit: 999999,
          plan_id: 'enterprise',
          plan_name: 'Enterprise',
          is_at_limit: false,
          reset_at: new Date().toISOString(),
        }],
        error: null,
      });

      const messageResult = await usageService.canPerformAction('tenant-123', 'message');
      expect(messageResult.allowed).toBe(true);

      const fileResult = await usageService.canPerformAction('tenant-123', 'file');
      expect(fileResult.allowed).toBe(true);

      const visionResult = await usageService.canPerformAction('tenant-123', 'vision');
      expect(visionResult.allowed).toBe(true);
    });
  });

  // ======================
  // getUpgradeSuggestion Tests
  // ======================

  describe('getUpgradeSuggestion', () => {
    it('should not suggest upgrade when usage is low', () => {
      const usage = {
        messagesCount: 10,
        messagesLimit: 50,
        filesUploaded: 2,
        filesLimit: 10,
        visionRequests: 1,
        visionLimit: 5,
        planId: 'essentials' as const,
        planName: 'Essentials',
        isAtLimit: false,
        tokensUsed: 5000,
        tokensLimit: 50000,
        resetAt: new Date(),
        percentages: { messages: 20, files: 20, vision: 20, tokens: 10 },
      };

      const result = usageService.getUpgradeSuggestion(usage);

      expect(result.shouldUpgrade).toBe(false);
      expect(result.suggestedPlan).toBeNull();
    });

    it('should suggest upgrade when messages near limit (80%+)', () => {
      const usage = {
        messagesCount: 45,
        messagesLimit: 50,
        filesUploaded: 2,
        filesLimit: 10,
        visionRequests: 1,
        visionLimit: 5,
        planId: 'essentials' as const,
        planName: 'Essentials',
        isAtLimit: false,
        tokensUsed: 5000,
        tokensLimit: 50000,
        resetAt: new Date(),
        percentages: { messages: 90, files: 20, vision: 20, tokens: 10 },
      };

      const result = usageService.getUpgradeSuggestion(usage);

      expect(result.shouldUpgrade).toBe(true);
      expect(result.suggestedPlan).toBe('growth');
      expect(result.reason).toContain('mensajes');
    });

    it('should suggest upgrade when multiple limits near capacity', () => {
      const usage = {
        messagesCount: 45,
        messagesLimit: 50,
        filesUploaded: 8,
        filesLimit: 10,
        visionRequests: 4,
        visionLimit: 5,
        planId: 'essentials' as const,
        planName: 'Essentials',
        isAtLimit: false,
        tokensUsed: 40000,
        tokensLimit: 50000,
        resetAt: new Date(),
        percentages: { messages: 90, files: 80, vision: 80, tokens: 80 },
      };

      const result = usageService.getUpgradeSuggestion(usage);

      expect(result.shouldUpgrade).toBe(true);
      expect(result.reason).toContain('mensajes');
      expect(result.reason).toContain('archivos');
    });

    it('should not suggest upgrade for enterprise users', () => {
      const usage = {
        messagesCount: 10000,
        messagesLimit: 999999,
        filesUploaded: 1000,
        filesLimit: 999999,
        visionRequests: 500,
        visionLimit: 999999,
        planId: 'enterprise' as const,
        planName: 'Enterprise',
        isAtLimit: false,
        tokensUsed: 500000,
        tokensLimit: 999999,
        resetAt: new Date(),
        percentages: { messages: 0, files: 0, vision: 0, tokens: 0 },
      };

      const result = usageService.getUpgradeSuggestion(usage);

      expect(result.shouldUpgrade).toBe(false);
    });

    it('should suggest growth from starter', () => {
      const usage = {
        messagesCount: 8,
        messagesLimit: 10,
        filesUploaded: 4,
        filesLimit: 5,
        visionRequests: 2,
        visionLimit: 3,
        planId: 'starter' as const,
        planName: 'Starter',
        isAtLimit: false,
        tokensUsed: 8000,
        tokensLimit: 10000,
        resetAt: new Date(),
        percentages: { messages: 80, files: 80, vision: 66, tokens: 80 },
      };

      const result = usageService.getUpgradeSuggestion(usage);

      expect(result.shouldUpgrade).toBe(true);
      expect(result.suggestedPlan).toBe('essentials');
    });
  });

  // ======================
  // formatResetTime Tests
  // ======================

  describe('formatResetTime', () => {
    it('should format hours and minutes', () => {
      const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000 + 30 * 60 * 1000);

      const result = usageService.formatResetTime(futureDate);

      expect(result).toContain('3h');
      expect(result).toContain('30m');
    });

    it('should format minutes only when less than 1 hour', () => {
      const futureDate = new Date(Date.now() + 45 * 60 * 1000);

      const result = usageService.formatResetTime(futureDate);

      expect(result).toContain('45');
      expect(result).toContain('minutos');
    });

    it('should return "ahora" for past dates', () => {
      const pastDate = new Date(Date.now() - 1000);

      const result = usageService.formatResetTime(pastDate);

      expect(result).toBe('ahora');
    });

    it('should accept string dates', () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const dateString = futureDate.toISOString();

      const result = usageService.formatResetTime(dateString);

      expect(result).toContain('h');
    });
  });
});
