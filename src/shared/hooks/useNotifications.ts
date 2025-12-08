import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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
  metadata?: any;
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
  const channelRef = useRef<any>(null);
  const userId = useRef<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      userId.current = user.id;

      // Fetch notifications
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        console.error('Error fetching notifications:', fetchError);
        setError(fetchError.message);
        return;
      }

      setNotifications(data || []);

      // Calculate unread count
      const unread = (data || []).filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error in fetchNotifications:', err);
      setError('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId.current);

      if (updateError) {
        console.error('Error marking notification as read:', updateError);
        return;
      }

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

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId.current)
        .eq('read', false);

      if (updateError) {
        console.error('Error marking all notifications as read:', updateError);
        return;
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: true,
          read_at: n.read ? n.read_at : new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error('Error in markAllAsRead:', err);
    }
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    fetchNotifications();

    // Set up realtime subscription
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('notifications-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;

            // Add to notifications
            setNotifications((prev) => [newNotification, ...prev].slice(0, limit));

            // Increment unread count
            if (!newNotification.read) {
              setUnreadCount((prev) => prev + 1);
            }

            // Call callback
            if (onNewNotification) {
              onNewNotification(newNotification);
            }

            // Auto mark as read if enabled
            if (autoMarkAsRead) {
              markAsRead(newNotification.id);
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
            const updatedNotification = payload.new as Notification;

            // Update in notifications
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === updatedNotification.id ? updatedNotification : n
              )
            );

            // Recalculate unread count
            setNotifications((notifications) => {
              const unread = notifications.filter((n) => !n.read).length;
              setUnreadCount(unread);
              return notifications;
            });
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    setupRealtime();

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchNotifications, onNewNotification, autoMarkAsRead, markAsRead, limit]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refreshNotifications: fetchNotifications,
  };
}

// Helper function to create notification (call from API routes)
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
    metadata?: any;
  } = {}
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
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

// Helper function to broadcast notification to multiple users
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
    metadata?: any;
  } = {}
) {
  const promises = userIds.map((userId) =>
    createNotification(tenantId, userId, type, title, message, options)
  );

  const results = await Promise.all(promises);
  return results.filter((r) => r !== null);
}
