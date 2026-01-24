'use client';

// =====================================================
// TIS TIS PLATFORM - Delivery Notifications Component
// Sistema de notificaciones real-time para delivery en KDS
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/shared/types/delivery-types.ts
// =====================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/utils';
import type { DeliveryStatus } from '@/src/shared/types/delivery-types';
import { DELIVERY_STATUS_INFO } from '@/src/shared/types/delivery-types';

// ======================
// ICONS
// ======================

const TruckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

// ======================
// TYPES
// ======================

export interface DeliveryNotification {
  id: string;
  type: 'new_order' | 'status_change' | 'driver_assigned' | 'order_ready' | 'delivery_failed';
  orderId: string;
  orderNumber: string;
  message: string;
  timestamp: Date;
  read: boolean;
  deliveryStatus?: DeliveryStatus;
  driverName?: string;
}

interface DeliveryNotificationsProps {
  notifications: DeliveryNotification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onNotificationClick?: (notification: DeliveryNotification) => void;
  soundEnabled?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxVisible?: number;
  className?: string;
}

// ======================
// NOTIFICATION SOUND
// ======================

const NOTIFICATION_SOUNDS = {
  new_order: '/sounds/new-delivery.mp3',
  status_change: '/sounds/status-change.mp3',
  driver_assigned: '/sounds/driver-assigned.mp3',
  order_ready: '/sounds/order-ready.mp3',
  delivery_failed: '/sounds/delivery-failed.mp3',
};

function useNotificationSound(enabled: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback((type: DeliveryNotification['type']) => {
    if (!enabled) return;

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      const soundFile = NOTIFICATION_SOUNDS[type];
      if (soundFile) {
        audioRef.current.src = soundFile;
        audioRef.current.volume = 0.5;
        audioRef.current.play().catch(() => {
          // Ignore autoplay restrictions
        });
      }
    } catch {
      // Ignore audio errors
    }
  }, [enabled]);

  return playSound;
}

// ======================
// NOTIFICATION ITEM
// ======================

interface NotificationItemProps {
  notification: DeliveryNotification;
  onDismiss: () => void;
  onClick?: () => void;
}

function NotificationItem({ notification, onDismiss, onClick }: NotificationItemProps) {
  const typeConfig: Record<DeliveryNotification['type'], { icon: React.ReactNode; color: string }> = {
    new_order: {
      icon: <TruckIcon className="w-5 h-5" />,
      color: 'bg-purple-100 text-purple-600 border-purple-300',
    },
    status_change: {
      icon: <BellIcon className="w-5 h-5" />,
      color: 'bg-blue-100 text-blue-600 border-blue-300',
    },
    driver_assigned: {
      icon: <CheckIcon className="w-5 h-5" />,
      color: 'bg-green-100 text-green-600 border-green-300',
    },
    order_ready: {
      icon: <CheckIcon className="w-5 h-5" />,
      color: 'bg-emerald-100 text-emerald-600 border-emerald-300',
    },
    delivery_failed: {
      icon: <AlertIcon className="w-5 h-5" />,
      color: 'bg-red-100 text-red-600 border-red-300',
    },
  };

  const config = typeConfig[notification.type];
  const timeAgo = formatTimeAgo(notification.timestamp);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border shadow-lg bg-white cursor-pointer',
        notification.type === 'new_order' && 'ring-2 ring-purple-200',
        notification.type === 'delivery_failed' && 'ring-2 ring-red-200'
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={cn(
        'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
        config.color.split(' ')[0],
        config.color.split(' ')[1]
      )}>
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-900">
              #{notification.orderNumber}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              {notification.message}
            </p>
            {notification.driverName && (
              <p className="text-xs text-slate-500 mt-1">
                Repartidor: {notification.driverName}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
          >
            <XIcon />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {timeAgo}
        </p>
      </div>
    </motion.div>
  );
}

// ======================
// HELPER FUNCTIONS
// ======================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return 'ahora';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `hace ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;
  return `hace ${Math.floor(diffHours / 24)}d`;
}

// ======================
// BANNER COMPONENT
// ======================

interface DeliveryBannerProps {
  show: boolean;
  pendingCount: number;
  onDismiss: () => void;
  onViewAll: () => void;
}

export function DeliveryBanner({ show, pendingCount, onDismiss, onViewAll }: DeliveryBannerProps) {
  if (!show || pendingCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-0 left-0 right-0 z-50 bg-purple-600 text-white px-4 py-3 shadow-lg"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <TruckIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium">
                {pendingCount} {pendingCount === 1 ? 'orden de delivery pendiente' : 'ordenes de delivery pendientes'}
              </p>
              <p className="text-sm text-purple-200">
                Requieren asignacion de repartidor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onViewAll}
              className="px-4 py-1.5 bg-white text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-colors"
            >
              Ver ordenes
            </button>
            <button
              onClick={onDismiss}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <XIcon />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function DeliveryNotifications({
  notifications,
  onDismiss,
  onDismissAll,
  onNotificationClick,
  soundEnabled = true,
  position = 'top-right',
  maxVisible = 5,
  className,
}: DeliveryNotificationsProps) {
  const [previousCount, setPreviousCount] = useState(0);
  const playSound = useNotificationSound(soundEnabled);

  // Play sound on new notifications
  useEffect(() => {
    const currentCount = notifications.filter(n => !n.read).length;
    if (currentCount > previousCount && notifications.length > 0) {
      const latestNotification = notifications[0];
      playSound(latestNotification.type);
    }
    setPreviousCount(currentCount);
  }, [notifications, previousCount, playSound]);

  const visibleNotifications = notifications.slice(0, maxVisible);
  const hiddenCount = notifications.length - maxVisible;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  if (notifications.length === 0) return null;

  return (
    <div className={cn(
      'fixed z-50 w-96 space-y-2',
      positionClasses[position],
      className
    )}>
      {/* Header with dismiss all */}
      {notifications.length > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-slate-500">
            {notifications.length} notificaciones
          </span>
          <button
            onClick={onDismissAll}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Descartar todas
          </button>
        </div>
      )}

      {/* Notifications */}
      <AnimatePresence mode="popLayout">
        {visibleNotifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={() => onDismiss(notification.id)}
            onClick={() => onNotificationClick?.(notification)}
          />
        ))}
      </AnimatePresence>

      {/* Hidden count */}
      {hiddenCount > 0 && (
        <div className="text-center py-2 text-sm text-slate-500">
          +{hiddenCount} mas
        </div>
      )}
    </div>
  );
}

// ======================
// HOOK FOR MANAGING NOTIFICATIONS
// ======================

export function useDeliveryNotifications() {
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);

  const addNotification = useCallback((
    type: DeliveryNotification['type'],
    orderId: string,
    orderNumber: string,
    message: string,
    extra?: Partial<DeliveryNotification>
  ) => {
    const newNotification: DeliveryNotification = {
      id: `${orderId}-${Date.now()}`,
      type,
      orderId,
      orderNumber,
      message,
      timestamp: new Date(),
      read: false,
      ...extra,
    };

    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  return {
    notifications,
    addNotification,
    dismissNotification,
    dismissAll,
    markAsRead,
    unreadCount: notifications.filter(n => !n.read).length,
  };
}

export default DeliveryNotifications;
