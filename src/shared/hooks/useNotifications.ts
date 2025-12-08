import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a single instance for the hook
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  related_entity_type?: string;
  related_entity_id?: string;
  action_url?: string;
  action_label?: string;
  read: boolean;
  read_at?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface UseNotificationsOptions {
  onNewNotification?: (notification: Notification) => void;
  autoMarkAsRead?: boolean;
  limit?: number;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

/**
 * Hook for managing user notifications with real-time updates
 * Optimized to prevent memory leaks and unnecessary re-renders
 */
export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const {
    onNewNotification,
    autoMarkAsRead = false,
    limit = 50,
  } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid stale closures in callbacks
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);
  const onNewNotificationRef = useRef(onNewNotification);
  const autoMarkAsReadRef = useRef(autoMarkAsRead);
  const limitRef = useRef(limit);
  const isMountedRef = useRef(true);

  // Update refs when props change
  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    autoMarkAsReadRef.current = autoMarkAsRead;
  }, [autoMarkAsRead]);

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

  // Fetch notifications - memoized and stable
  const fetchNotifications = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!isMountedRef.current) return;

      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      userIdRef.current = user.id;

      // Fetch notifications
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(limitRef.current);

      if (!isMountedRef.current) return;

      if (fetchError) {
        console.error('Error fetching notifications:', fetchError);
        setError(fetchError.message);
        return;
      }

      const notificationData = data || [];
      setNotifications(notificationData);

      // Calculate unread count
      const unread = notificationData.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error in fetchNotifications:', err);
      setError('Failed to fetch notifications');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // No dependencies - uses refs internally

  // Mark notification as read - stable callback
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userIdRef.current) return;

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userIdRef.current);

      if (updateError) {
        console.error('Error marking notification as read:', updateError);
        return;
      }

      if (!isMountedRef.current) return;

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error in markAsRead:', err);
    }
  }, []);

  // Mark all notifications as read - stable callback
  const markAllAsRead = useCallback(async () => {
    if (!userIdRef.current) return;

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userIdRef.current)
        .eq('read', false);

      if (updateError) {
        console.error('Error marking all notifications as read:', updateError);
        return;
      }

      if (!isMountedRef.current) return;

      // Update local state
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
          read_at: n.read ? n.read_at : now,
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error('Error in markAllAsRead:', err);
    }
  }, []);

  // Setup realtime subscription - runs once on mount
  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    fetchNotifications();

    // Set up realtime subscription
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user || !isMountedRef.current) return;

      // Clean up any existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!isMountedRef.current) return;

            const newNotification = payload.new as Notification;

            // Add to notifications
            setNotifications((prev) =>
              [newNotification, ...prev].slice(0, limitRef.current)
            );

            // Increment unread count
            if (!newNotification.read) {
              setUnreadCount((prev) => prev + 1);
            }

            // Call callback using ref to avoid stale closure
            if (onNewNotificationRef.current) {
              onNewNotificationRef.current(newNotification);
            }

            // Auto mark as read if enabled
            if (autoMarkAsReadRef.current) {
              // Use setTimeout to avoid blocking the update
              setTimeout(() => {
                supabase
                  .from('notifications')
                  .update({ read: true, read_at: new Date().toISOString() })
                  .eq('id', newNotification.id)
                  .then(() => {
                    if (isMountedRef.current) {
                      setNotifications((prev) =>
                        prev.map((n) =>
                          n.id === newNotification.id
                            ? { ...n, read: true, read_at: new Date().toISOString() }
                            : n
                        )
                      );
                      setUnreadCount((prev) => Math.max(0, prev - 1));
                    }
                  });
              }, 0);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!isMountedRef.current) return;

            const updatedNotification = payload.new as Notification;

            // Update in notifications and recalculate unread in single update
            setNotifications((prev) => {
              const updated = prev.map((n) =>
                n.id === updatedNotification.id ? updatedNotification : n
              );

              // Recalculate unread count based on updated list
              const newUnreadCount = updated.filter((n) => !n.read).length;
              setUnreadCount(newUnreadCount);

              return updated;
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    setupRealtime();

    // Cleanup function
    return () => {
      isMountedRef.current = false;

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchNotifications]); // Only depends on fetchNotifications which is stable

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      markAsRead,
      markAllAsRead,
      refreshNotifications: fetchNotifications,
    }),
    [notifications, unreadCount, loading, error, markAsRead, markAllAsRead, fetchNotifications]
  );
}

// =====================================================
// Helper functions for server-side notification creation
// =====================================================

/**
 * Create a notification for a specific user
 * Call from API routes only - uses service role key
 */
export async function createNotification(
  tenantId: string,
  userId: string,
  type: string,
  title: string,
  message: string,
  options: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    relatedEntityType?: string;
    relatedEntityId?: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  // This should only be called from server-side (API routes)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not available');
    return null;
  }

  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data, error } = await serviceClient
    .from('notifications')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      type,
      title,
      message,
      priority: options.priority || 'normal',
      related_entity_type: options.relatedEntityType,
      related_entity_id: options.relatedEntityId,
      action_url: options.actionUrl,
      action_label: options.actionLabel,
      metadata: options.metadata,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data;
}

/**
 * Broadcast a notification to multiple users
 * Call from API routes only - uses service role key
 */
export async function broadcastNotification(
  tenantId: string,
  userIds: string[],
  type: string,
  title: string,
  message: string,
  options: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    relatedEntityType?: string;
    relatedEntityId?: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      createNotification(tenantId, userId, type, title, message, options)
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<Notification> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value);
}
