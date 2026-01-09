'use client';

// =====================================================
// TIS TIS PLATFORM - Invoices Hook
// React hook for invoice management with state
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, type APIResponse } from '@/src/shared/lib/api-client';
import type {
  Invoice,
  InvoiceConfig,
  InvoiceStatistics,
  CreateInvoiceRequest,
  InvoiceStatus,
  TicketExtraction,
} from '../types';

// Response types for API calls
interface InvoicesAPIResponse extends APIResponse<Invoice[]> {}
interface ConfigAPIResponse extends APIResponse<InvoiceConfig> {}
interface StatsAPIResponse extends APIResponse<InvoiceStatistics> {}
interface ExtractionsAPIResponse extends APIResponse<TicketExtraction[]> {}
interface InvoiceAPIResponse extends APIResponse<Invoice> {}
interface PDFAPIResponse extends APIResponse<{ pdf_url: string }> {}

// ======================
// TYPES
// ======================

interface UseInvoicesOptions {
  branch_id?: string;
  status?: InvoiceStatus;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

interface UseInvoicesReturn {
  // State
  invoices: Invoice[];
  config: InvoiceConfig | null;
  stats: InvoiceStatistics | null;
  pendingExtractions: TicketExtraction[];
  loading: boolean;
  error: string | null;

  // Actions
  createInvoice: (data: CreateInvoiceRequest) => Promise<Invoice>;
  cancelInvoice: (invoiceId: string, reason: string) => Promise<void>;
  sendInvoiceEmail: (invoiceId: string) => Promise<void>;
  generatePDF: (invoiceId: string) => Promise<string>;
  refresh: () => Promise<void>;
}

// ======================
// HOOK
// ======================

export function useInvoices(options: UseInvoicesOptions = {}): UseInvoicesReturn {
  const { branch_id, status, start_date, end_date, limit = 50 } = options;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [config, setConfig] = useState<InvoiceConfig | null>(null);
  const [stats, setStats] = useState<InvoiceStatistics | null>(null);
  const [pendingExtractions, setPendingExtractions] = useState<TicketExtraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!branch_id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('branch_id', branch_id);
      if (status) params.set('status', status);
      if (start_date) params.set('start_date', start_date);
      if (end_date) params.set('end_date', end_date);
      params.set('limit', limit.toString());

      const response = await fetchWithAuth<InvoicesAPIResponse>(`/api/invoicing/invoices?${params}`);
      setInvoices(response.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error loading invoices';
      setError(message);
      console.error('[useInvoices] Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [branch_id, status, start_date, end_date, limit]);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    if (!branch_id) return;

    try {
      const response = await fetchWithAuth<ConfigAPIResponse>(`/api/invoicing/config?branch_id=${branch_id}`);
      setConfig(response.data || null);
    } catch (err) {
      console.error('[useInvoices] Error fetching config:', err);
    }
  }, [branch_id]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!branch_id) return;

    try {
      const params = new URLSearchParams();
      params.set('branch_id', branch_id);
      if (start_date) params.set('start_date', start_date);
      if (end_date) params.set('end_date', end_date);

      const response = await fetchWithAuth<StatsAPIResponse>(`/api/invoicing/stats?${params}`);
      setStats(response.data || null);
    } catch (err) {
      console.error('[useInvoices] Error fetching stats:', err);
    }
  }, [branch_id, start_date, end_date]);

  // Fetch pending extractions
  const fetchPendingExtractions = useCallback(async () => {
    try {
      const response = await fetchWithAuth<ExtractionsAPIResponse>('/api/invoicing/extractions?status=pending');
      setPendingExtractions(response.data || []);
    } catch (err) {
      console.error('[useInvoices] Error fetching extractions:', err);
    }
  }, []);

  // Create invoice
  const createInvoice = useCallback(async (data: CreateInvoiceRequest): Promise<Invoice> => {
    const response = await fetchWithAuth<InvoiceAPIResponse>('/api/invoicing/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    await fetchInvoices();
    await fetchStats();

    return response.data as Invoice;
  }, [fetchInvoices, fetchStats]);

  // Cancel invoice
  const cancelInvoice = useCallback(async (invoiceId: string, reason: string): Promise<void> => {
    await fetchWithAuth(`/api/invoicing/invoices/${invoiceId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });

    await fetchInvoices();
    await fetchStats();
  }, [fetchInvoices, fetchStats]);

  // Send invoice email
  const sendInvoiceEmail = useCallback(async (invoiceId: string): Promise<void> => {
    await fetchWithAuth(`/api/invoicing/invoices/${invoiceId}/send-email`, {
      method: 'POST',
    });
  }, []);

  // Generate PDF
  const generatePDF = useCallback(async (invoiceId: string): Promise<string> => {
    const response = await fetchWithAuth<PDFAPIResponse>('/api/invoicing/generate-pdf', {
      method: 'POST',
      body: JSON.stringify({ invoice_id: invoiceId }),
    });

    return response.data?.pdf_url || '';
  }, []);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchInvoices(),
      fetchConfig(),
      fetchStats(),
      fetchPendingExtractions(),
    ]);
  }, [fetchInvoices, fetchConfig, fetchStats, fetchPendingExtractions]);

  // Initial load
  useEffect(() => {
    if (branch_id) {
      refresh();
    }
  }, [branch_id, refresh]);

  return {
    invoices,
    config,
    stats,
    pendingExtractions,
    loading,
    error,
    createInvoice,
    cancelInvoice,
    sendInvoiceEmail,
    generatePDF,
    refresh,
  };
}
