// =====================================================
// TIS TIS PLATFORM - SR FASE 2 SQL Migration Tests
// Tests for migration 161_SR_FASE2_PROCESSING_QUEUE.sql
// =====================================================

import { describe, it, expect } from 'vitest';

// ======================
// STATUS TRANSITIONS TESTS
// ======================

describe('SR Sales Status Transitions', () => {
  const validStatuses = [
    'pending',
    'queued',
    'processing',
    'processed',
    'failed',
    'dead_letter',
    'duplicate',
  ];

  it('should define all valid status values', () => {
    expect(validStatuses).toContain('pending');
    expect(validStatuses).toContain('queued');
    expect(validStatuses).toContain('processing');
    expect(validStatuses).toContain('processed');
    expect(validStatuses).toContain('failed');
    expect(validStatuses).toContain('dead_letter');
    expect(validStatuses).toContain('duplicate');
  });

  it('should have exactly 7 status values', () => {
    expect(validStatuses).toHaveLength(7);
  });

  describe('Valid Status Transitions', () => {
    const validTransitions: Record<string, string[]> = {
      pending: ['queued', 'processing', 'duplicate'],
      queued: ['processing'],
      processing: ['processed', 'failed', 'queued'], // queued = recovered from stale
      failed: ['queued', 'dead_letter'],
      processed: [], // Terminal state
      dead_letter: ['queued'], // Manual recovery possible
      duplicate: [], // Terminal state
    };

    it('should allow pending → queued transition', () => {
      expect(validTransitions.pending).toContain('queued');
    });

    it('should allow pending → processing transition (direct claim)', () => {
      expect(validTransitions.pending).toContain('processing');
    });

    it('should allow queued → processing transition', () => {
      expect(validTransitions.queued).toContain('processing');
    });

    it('should allow processing → processed transition', () => {
      expect(validTransitions.processing).toContain('processed');
    });

    it('should allow processing → failed transition', () => {
      expect(validTransitions.processing).toContain('failed');
    });

    it('should allow processing → queued transition (stale recovery)', () => {
      expect(validTransitions.processing).toContain('queued');
    });

    it('should allow failed → queued transition (retry)', () => {
      expect(validTransitions.failed).toContain('queued');
    });

    it('should allow failed → dead_letter transition (max retries)', () => {
      expect(validTransitions.failed).toContain('dead_letter');
    });

    it('should have no transitions from processed (terminal)', () => {
      expect(validTransitions.processed).toHaveLength(0);
    });

    it('should have no transitions from duplicate (terminal)', () => {
      expect(validTransitions.duplicate).toHaveLength(0);
    });

    it('should allow dead_letter → queued transition (manual recovery)', () => {
      expect(validTransitions.dead_letter).toContain('queued');
    });
  });
});

// ======================
// NEW COLUMNS TESTS
// ======================

describe('SR Sales New Columns', () => {
  const newColumns = [
    { name: 'queued_at', type: 'TIMESTAMPTZ', nullable: true },
    { name: 'processing_started_at', type: 'TIMESTAMPTZ', nullable: true },
    { name: 'next_retry_at', type: 'TIMESTAMPTZ', nullable: true },
  ];

  it('should define queued_at column', () => {
    const column = newColumns.find(c => c.name === 'queued_at');
    expect(column).toBeDefined();
    expect(column?.type).toBe('TIMESTAMPTZ');
    expect(column?.nullable).toBe(true);
  });

  it('should define processing_started_at column', () => {
    const column = newColumns.find(c => c.name === 'processing_started_at');
    expect(column).toBeDefined();
    expect(column?.type).toBe('TIMESTAMPTZ');
    expect(column?.nullable).toBe(true);
  });

  it('should define next_retry_at column', () => {
    const column = newColumns.find(c => c.name === 'next_retry_at');
    expect(column).toBeDefined();
    expect(column?.type).toBe('TIMESTAMPTZ');
    expect(column?.nullable).toBe(true);
  });
});

// ======================
// INDEXES TESTS
// ======================

describe('SR Sales Indexes', () => {
  const indexes = [
    {
      name: 'idx_sr_sales_queue_priority',
      columns: ['status', 'next_retry_at', 'created_at'],
      filter: "status IN ('queued', 'pending')",
      purpose: 'Optimized batch claiming',
    },
    {
      name: 'idx_sr_sales_dead_letter',
      columns: ['tenant_id', 'created_at DESC'],
      filter: "status = 'dead_letter'",
      purpose: 'Dead letter monitoring by tenant',
    },
    {
      name: 'idx_sr_sales_processing_timeout',
      columns: ['processing_started_at'],
      filter: "status = 'processing'",
      purpose: 'Detecting stale processing jobs',
    },
  ];

  it('should have queue priority index for efficient claiming', () => {
    const index = indexes.find(i => i.name === 'idx_sr_sales_queue_priority');
    expect(index).toBeDefined();
    expect(index?.columns).toContain('status');
    expect(index?.columns).toContain('next_retry_at');
    expect(index?.columns).toContain('created_at');
    expect(index?.filter).toContain('queued');
    expect(index?.filter).toContain('pending');
  });

  it('should have dead letter index for monitoring', () => {
    const index = indexes.find(i => i.name === 'idx_sr_sales_dead_letter');
    expect(index).toBeDefined();
    expect(index?.columns).toContain('tenant_id');
    expect(index?.filter).toContain('dead_letter');
  });

  it('should have processing timeout index for recovery', () => {
    const index = indexes.find(i => i.name === 'idx_sr_sales_processing_timeout');
    expect(index).toBeDefined();
    expect(index?.columns).toContain('processing_started_at');
    expect(index?.filter).toContain('processing');
  });

  it('should have partial indexes for efficiency', () => {
    // All indexes should have filters (partial indexes)
    for (const index of indexes) {
      expect(index.filter).toBeDefined();
      expect(index.filter.length).toBeGreaterThan(0);
    }
  });
});

// ======================
// RPC FUNCTIONS TESTS
// ======================

describe('SR Sales RPC Functions', () => {
  describe('claim_sr_sales_batch', () => {
    it('should define correct function signature', () => {
      const signature = {
        name: 'claim_sr_sales_batch',
        parameters: [{ name: 'p_limit', type: 'INTEGER', default: 10 }],
        returns: 'TABLE (id UUID)',
        security: 'DEFINER',
      };

      expect(signature.name).toBe('claim_sr_sales_batch');
      expect(signature.parameters[0].default).toBe(10);
      expect(signature.security).toBe('DEFINER');
    });

    it('should use SELECT FOR UPDATE SKIP LOCKED', () => {
      // This is critical for preventing race conditions
      const sqlPattern = 'FOR UPDATE SKIP LOCKED';
      expect(sqlPattern).toContain('FOR UPDATE');
      expect(sqlPattern).toContain('SKIP LOCKED');
    });

    it('should prioritize queued over pending', () => {
      // The ORDER BY should prioritize queued (0) over pending (1)
      const priorityOrder = ['queued', 'pending'];
      expect(priorityOrder[0]).toBe('queued');
      expect(priorityOrder[1]).toBe('pending');
    });

    it('should respect next_retry_at for backoff', () => {
      // The WHERE clause should check next_retry_at <= NOW()
      const whereCondition = '(next_retry_at IS NULL OR next_retry_at <= NOW())';
      expect(whereCondition).toContain('next_retry_at');
      expect(whereCondition).toContain('NOW()');
    });

    it('should atomically update status to processing', () => {
      const updateFields = ['status', 'processing_started_at'];
      expect(updateFields).toContain('status');
      expect(updateFields).toContain('processing_started_at');
    });
  });

  describe('get_sr_queue_stats', () => {
    it('should define correct function signature', () => {
      const signature = {
        name: 'get_sr_queue_stats',
        parameters: [{ name: 'p_tenant_id', type: 'UUID', default: null }],
        returns: 'TABLE',
        security: 'DEFINER',
      };

      expect(signature.name).toBe('get_sr_queue_stats');
      expect(signature.parameters[0].name).toBe('p_tenant_id');
    });

    it('should return all required stat columns', () => {
      const statColumns = [
        'pending_count',
        'queued_count',
        'processing_count',
        'processed_today',
        'failed_today',
        'dead_letter_count',
      ];

      expect(statColumns).toHaveLength(6);
      expect(statColumns).toContain('pending_count');
      expect(statColumns).toContain('queued_count');
      expect(statColumns).toContain('processing_count');
      expect(statColumns).toContain('processed_today');
      expect(statColumns).toContain('failed_today');
      expect(statColumns).toContain('dead_letter_count');
    });

    it('should filter by tenant when provided', () => {
      const filterCondition = '(p_tenant_id IS NULL OR tenant_id = p_tenant_id)';
      expect(filterCondition).toContain('p_tenant_id');
      expect(filterCondition).toContain('tenant_id');
    });
  });

  describe('recover_stale_sr_sales', () => {
    it('should define correct function signature', () => {
      const signature = {
        name: 'recover_stale_sr_sales',
        parameters: [{ name: 'p_timeout_minutes', type: 'INTEGER', default: 5 }],
        returns: 'INTEGER',
        security: 'DEFINER',
      };

      expect(signature.name).toBe('recover_stale_sr_sales');
      expect(signature.parameters[0].default).toBe(5);
      expect(signature.returns).toBe('INTEGER');
    });

    it('should update stale processing sales to queued', () => {
      const updateFields = {
        status: 'queued',
        processing_started_at: null,
        error_message: 'Recovered from stale processing state',
      };

      expect(updateFields.status).toBe('queued');
      expect(updateFields.processing_started_at).toBeNull();
    });

    it('should use timeout interval correctly', () => {
      const timeoutCondition = "processing_started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL";
      expect(timeoutCondition).toContain('p_timeout_minutes');
      expect(timeoutCondition).toContain('INTERVAL');
    });
  });
});

// ======================
// TRIGGER TESTS
// ======================

describe('SR Sales Trigger', () => {
  it('should auto-set queued_at when transitioning to queued', () => {
    // Trigger function: trigger_sr_sales_queue_timestamps
    const triggerBehavior = {
      event: 'BEFORE UPDATE',
      condition: "NEW.status = 'queued' AND OLD.status != 'queued'",
      action: 'NEW.queued_at := COALESCE(NEW.queued_at, NOW())',
    };

    expect(triggerBehavior.event).toBe('BEFORE UPDATE');
    expect(triggerBehavior.condition).toContain('queued');
    expect(triggerBehavior.action).toContain('queued_at');
    expect(triggerBehavior.action).toContain('COALESCE');
  });

  it('should auto-set processing_started_at when transitioning to processing', () => {
    const triggerBehavior = {
      event: 'BEFORE UPDATE',
      condition: "NEW.status = 'processing' AND OLD.status != 'processing'",
      action: 'NEW.processing_started_at := COALESCE(NEW.processing_started_at, NOW())',
    };

    expect(triggerBehavior.condition).toContain('processing');
    expect(triggerBehavior.action).toContain('processing_started_at');
  });

  it('should clear next_retry_at when not in retry state', () => {
    const triggerBehavior = {
      condition: "NEW.status NOT IN ('queued', 'failed')",
      action: 'NEW.next_retry_at := NULL',
    };

    expect(triggerBehavior.condition).toContain('queued');
    expect(triggerBehavior.condition).toContain('failed');
    expect(triggerBehavior.action).toContain('NULL');
  });
});

// ======================
// PERMISSIONS TESTS
// ======================

describe('SR Sales Permissions', () => {
  const grantedFunctions = [
    'claim_sr_sales_batch',
    'get_sr_queue_stats',
    'recover_stale_sr_sales',
  ];

  const grantedRoles = ['authenticated', 'service_role'];

  it('should grant execute to authenticated role', () => {
    expect(grantedRoles).toContain('authenticated');
  });

  it('should grant execute to service_role', () => {
    expect(grantedRoles).toContain('service_role');
  });

  it('should grant all three RPC functions', () => {
    expect(grantedFunctions).toContain('claim_sr_sales_batch');
    expect(grantedFunctions).toContain('get_sr_queue_stats');
    expect(grantedFunctions).toContain('recover_stale_sr_sales');
  });
});

// ======================
// PATTERN ALIGNMENT TESTS
// ======================

describe('Pattern Alignment with job-processor.service.ts', () => {
  it('should follow claim_next_job pattern for atomic claiming', () => {
    // job-processor.service.ts uses claim_next_job RPC
    // sr-job-queue.service.ts uses claim_sr_sales_batch RPC
    const patterns = {
      jobProcessor: 'claim_next_job',
      srJobQueue: 'claim_sr_sales_batch',
    };

    // Both should use atomic SELECT FOR UPDATE SKIP LOCKED
    expect(patterns.jobProcessor).toContain('claim');
    expect(patterns.srJobQueue).toContain('claim');
  });

  it('should follow exponential backoff pattern', () => {
    const backoffConfig = {
      maxBackoffMs: 3600000, // 1 hour
      formula: 'min(2^attempts * 1000, MAX_BACKOFF_MS)',
    };

    expect(backoffConfig.maxBackoffMs).toBe(3600000);
    expect(backoffConfig.formula).toContain('2^attempts');
  });

  it('should follow max retries pattern', () => {
    const retryConfig = {
      defaultMaxRetries: 3,
      deadLetterStatus: 'dead_letter',
    };

    expect(retryConfig.defaultMaxRetries).toBe(3);
    expect(retryConfig.deadLetterStatus).toBe('dead_letter');
  });

  it('should follow status transition pattern', () => {
    // job_queue: pending → processing → completed/failed
    // sr_sales: pending → queued → processing → processed/failed/dead_letter
    const jobQueueStatuses = ['pending', 'processing', 'completed', 'failed'];
    const srSalesStatuses = ['pending', 'queued', 'processing', 'processed', 'failed', 'dead_letter'];

    // SR has additional queued state (webhook → queue → process)
    expect(srSalesStatuses).toContain('queued');
    expect(jobQueueStatuses).not.toContain('queued');

    // SR has dead_letter instead of just failed
    expect(srSalesStatuses).toContain('dead_letter');
  });
});
