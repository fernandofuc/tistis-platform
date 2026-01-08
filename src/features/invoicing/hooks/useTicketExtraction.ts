'use client';

// =====================================================
// TIS TIS PLATFORM - Ticket Extraction Hook
// React hook for AI-powered ticket/receipt extraction
// =====================================================

import { useState, useCallback } from 'react';
import type { TicketExtraction, TicketExtractedData } from '../types';

// ======================
// TYPES
// ======================

interface ExtractionProgress {
  status: 'idle' | 'uploading' | 'extracting' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
}

interface UseTicketExtractionReturn {
  // State
  extraction: TicketExtraction | null;
  extractedData: TicketExtractedData | null;
  progress: ExtractionProgress;
  error: string | null;

  // Actions
  uploadAndExtract: (file: File, branchId: string) => Promise<TicketExtraction>;
  updateExtractedData: (data: Partial<TicketExtractedData>) => void;
  confirmExtraction: (extractionId: string) => Promise<void>;
  reset: () => void;
}

// ======================
// API HELPERS
// ======================

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No session found');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// ======================
// HOOK
// ======================

export function useTicketExtraction(): UseTicketExtractionReturn {
  const [extraction, setExtraction] = useState<TicketExtraction | null>(null);
  const [extractedData, setExtractedData] = useState<TicketExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExtractionProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  // Upload image and extract data
  const uploadAndExtract = useCallback(async (file: File, branchId: string): Promise<TicketExtraction> => {
    setError(null);
    setProgress({ status: 'uploading', progress: 10, message: 'Subiendo imagen...' });

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress({ status: 'extracting', progress: 40, message: 'Analizando ticket con IA...' });

      // Call extraction API
      const response = await fetchWithAuth('/api/invoicing/extract-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId,
          image_base64: base64,
          mime_type: file.type,
        }),
      });

      setProgress({ status: 'completed', progress: 100, message: 'Extracción completada' });

      const extractionResult = response.data as TicketExtraction;
      setExtraction(extractionResult);

      if (extractionResult.extracted_data) {
        setExtractedData(extractionResult.extracted_data as TicketExtractedData);
      }

      return extractionResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en extracción';
      setError(message);
      setProgress({ status: 'error', progress: 0, message });
      throw err;
    }
  }, []);

  // Update extracted data locally (for user corrections)
  const updateExtractedData = useCallback((data: Partial<TicketExtractedData>) => {
    setExtractedData(prev => prev ? { ...prev, ...data } : null);
  }, []);

  // Confirm extraction and mark as reviewed
  const confirmExtraction = useCallback(async (extractionId: string): Promise<void> => {
    if (!extractedData) {
      throw new Error('No extracted data to confirm');
    }

    await fetchWithAuth(`/api/invoicing/extractions/${extractionId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extracted_data: extractedData,
      }),
    });
  }, [extractedData]);

  // Reset state
  const reset = useCallback(() => {
    setExtraction(null);
    setExtractedData(null);
    setError(null);
    setProgress({ status: 'idle', progress: 0, message: '' });
  }, []);

  return {
    extraction,
    extractedData,
    progress,
    error,
    uploadAndExtract,
    updateExtractedData,
    confirmExtraction,
    reset,
  };
}
