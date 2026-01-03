// =====================================================
// TIS TIS PLATFORM - Business Insights Hook
// Provides unseen insights count for sidebar badge
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/src/features/auth';

interface UseBusinessInsightsResult {
  unseenCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get unseen business insights count
 * Used for sidebar badge notification
 */
export function useBusinessInsights(): UseBusinessInsightsResult {
  const { session } = useAuth();
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.access_token;

  const fetchUnseenCount = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setUnseenCount(0);
      return;
    }

    try {
      // Don't set loading on subsequent calls to avoid UI flicker
      if (unseenCount === 0) {
        setLoading(true);
      }
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch('/api/business-insights', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't throw on 401/403 - just silently set 0
        if (response.status === 401 || response.status === 403) {
          setUnseenCount(0);
          return;
        }
        throw new Error('Error fetching insights');
      }

      const data = await response.json();

      // Only set count if status is 'active' (not blocked or onboarding)
      if (data.status === 'active') {
        setUnseenCount(data.unseen_count || 0);
      } else {
        setUnseenCount(0);
      }
    } catch (err) {
      // Silently fail on network errors - don't show error in sidebar
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('[useBusinessInsights] Request timeout');
      }
      setUnseenCount(0);
    } finally {
      setLoading(false);
    }
  }, [accessToken, unseenCount]);

  useEffect(() => {
    fetchUnseenCount();

    // Refresh every 5 minutes
    const interval = setInterval(fetchUnseenCount, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchUnseenCount]);

  return {
    unseenCount,
    loading,
    error,
    refresh: fetchUnseenCount,
  };
}
