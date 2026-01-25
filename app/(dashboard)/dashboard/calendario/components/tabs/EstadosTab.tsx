// =====================================================
// TIS TIS PLATFORM - Estados Tab Component
// View for booking/appointment states with confirmations
// Phase 7: UI/Dashboard - Booking States System
// =====================================================

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardContent, Badge, Avatar, Button } from '@/src/shared/components/ui';
import { BookingStateIndicator, BookingStateDot } from '../BookingStateIndicator';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import { cn, formatDate, formatTime } from '@/src/shared/utils';
import {
  BOOKING_COMBINED_STATES,
  CONFIRMATION_STATUSES,
  APPOINTMENT_STATUSES,
} from '@/src/shared/constants';
import {
  getCombinedBookingState,
  type ConfirmationStatus,
  type DepositStatus,
  type BookingCombinedState,
  type BookingStateStats,
  type Appointment,
} from '@/src/shared/types';

// ======================
// ICONS
// ======================
const icons = {
  filter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  x: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  arrowRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.2,
      ease: [0.32, 0.72, 0, 1] as const,
    },
  }),
};

// ======================
// TYPES
// ======================
interface AppointmentWithBooking extends Appointment {
  confirmation_status?: ConfirmationStatus | null;
  deposit_status?: DepositStatus | null;
  customer_trust_score_at_booking?: number | null;
  created_from_hold_id?: string | null;
  leads?: {
    full_name: string | null;
    phone: string | null;
  };
  services?: {
    name: string;
  } | null;
}

interface EstadosTabProps {
  appointments: AppointmentWithBooking[];
  activeHolds?: Array<{
    id: string;
    customer_name: string | null;
    customer_phone: string;
    slot_datetime: string;
    duration_minutes: number;
    expires_at: string;
  }>;
  loading?: boolean;
  onRefresh?: () => void;
  onAppointmentClick?: (appointment: AppointmentWithBooking) => void;
}

// ======================
// STAT CARD COMPONENT
// ======================
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'amber' | 'orange' | 'green' | 'blue' | 'red' | 'gray';
  description?: string;
  trend?: number;
}

const colorConfig = {
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-500', border: 'border-amber-200 dark:border-amber-800' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', icon: 'text-orange-500', border: 'border-orange-200 dark:border-orange-800' },
  green: { bg: 'bg-green-50 dark:bg-green-900/20', icon: 'text-green-500', border: 'border-green-200 dark:border-green-800' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-500', border: 'border-blue-200 dark:border-blue-800' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-500', border: 'border-red-200 dark:border-red-800' },
  gray: { bg: 'bg-gray-50 dark:bg-gray-800/50', icon: 'text-gray-500', border: 'border-gray-200 dark:border-gray-700' },
};

function StatCard({ label, value, icon, color, description }: StatCardProps) {
  const colors = colorConfig[color];
  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all duration-200 hover:shadow-md',
        colors.bg,
        colors.border
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn('p-2 rounded-lg', colors.bg)}>
          <span className={colors.icon}>{icon}</span>
        </span>
      </div>
      <div className="metric-value text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</div>
      {description && (
        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{description}</div>
      )}
    </div>
  );
}

// ======================
// FILTER BUTTON COMPONENT
// ======================

// Static class map for filter buttons - Tailwind CSS purges dynamic classes
const filterColorClasses = {
  amber: {
    active: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-300',
  },
  orange: {
    active: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400',
    badge: 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-300',
  },
  yellow: {
    active: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400',
    badge: 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-300',
  },
  green: {
    active: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400',
    badge: 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-300',
  },
  emerald: {
    active: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400',
    badge: 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-300',
  },
  blue: {
    active: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-300',
  },
  indigo: {
    active: 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400',
    badge: 'bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-300',
  },
  red: {
    active: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400',
    badge: 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-300',
  },
  gray: {
    active: 'bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300',
    badge: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
  },
  slate: {
    active: 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300',
    badge: 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-300',
  },
} as const;

type FilterColor = keyof typeof filterColorClasses;

interface FilterButtonProps {
  label: string;
  count: number;
  isActive: boolean;
  color: FilterColor;
  onClick: () => void;
}

function FilterButton({ label, count, isActive, color, onClick }: FilterButtonProps) {
  const colorClasses = filterColorClasses[color] || filterColorClasses.slate;

  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        'border min-h-[44px]',
        isActive
          ? colorClasses.active
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'px-1.5 py-0.5 text-xs rounded-full',
          isActive
            ? colorClasses.badge
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ======================
// APPOINTMENT CARD
// ======================
interface AppointmentCardProps {
  appointment: AppointmentWithBooking;
  index: number;
  onClick?: () => void;
  terminology: ReturnType<typeof useVerticalTerminology>['terminology'];
}

function AppointmentCard({ appointment, index, onClick, terminology }: AppointmentCardProps) {
  const lead = appointment.leads;
  const combinedState = getCombinedBookingState(
    appointment.status,
    appointment.confirmation_status,
    appointment.deposit_status,
    !!appointment.created_from_hold_id
  );

  return (
    <motion.button
      custom={index}
      variants={itemVariants}
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl text-left',
        'bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700',
        'transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Avatar and Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar
            name={lead?.full_name || lead?.phone || 'Sin nombre'}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {lead?.full_name || 'Sin nombre'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {lead?.phone || 'Sin teléfono'}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatDate(appointment.scheduled_at, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span>•</span>
              <span>{formatTime(appointment.scheduled_at)}</span>
              <span>•</span>
              <span>{appointment.duration_minutes} min</span>
            </div>
          </div>
        </div>

        {/* Right: State indicator */}
        <div className="flex flex-col items-end gap-2">
          <BookingStateIndicator
            appointmentStatus={appointment.status}
            confirmationStatus={appointment.confirmation_status}
            depositStatus={appointment.deposit_status}
            trustScore={appointment.customer_trust_score_at_booking}
            hasActiveHold={!!appointment.created_from_hold_id}
            size="sm"
            showLabel={false}
          />
          <span className="text-gray-400 dark:text-gray-500">
            {icons.arrowRight}
          </span>
        </div>
      </div>

      {/* Service and Trust Score */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        {appointment.services?.name && (
          <Badge variant="info" size="sm">
            {appointment.services.name}
          </Badge>
        )}
        {appointment.customer_trust_score_at_booking != null && (
          <Badge
            variant={
              appointment.customer_trust_score_at_booking >= 80 ? 'success' :
              appointment.customer_trust_score_at_booking >= 50 ? 'info' :
              appointment.customer_trust_score_at_booking >= 30 ? 'warning' : 'danger'
            }
            size="sm"
          >
            Trust: {appointment.customer_trust_score_at_booking}
          </Badge>
        )}
        {appointment.confirmation_status === 'pending' && (
          <Badge variant="warning" size="sm">
            Pendiente confirmar
          </Badge>
        )}
        {appointment.deposit_status === 'required' && (
          <Badge variant="warning" size="sm">
            Depósito pendiente
          </Badge>
        )}
      </div>
    </motion.button>
  );
}

// ======================
// ACTIVE HOLD CARD
// ======================
interface HoldCardProps {
  hold: NonNullable<EstadosTabProps['activeHolds']>[0];
  index: number;
}

function HoldCard({ hold, index }: HoldCardProps) {
  const expiresAt = new Date(hold.expires_at);
  const now = new Date();
  const minutesLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000));

  return (
    <motion.div
      custom={index}
      variants={itemVariants}
      className={cn(
        'p-4 rounded-xl',
        'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800',
        'transition-all duration-200'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <span className="text-amber-600 dark:text-amber-400">{icons.clock}</span>
          </span>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {hold.customer_name || 'Cliente sin nombre'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {hold.customer_phone}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {formatDate(hold.slot_datetime, { weekday: 'short', day: 'numeric', month: 'short' })} - {formatTime(hold.slot_datetime)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <Badge variant={minutesLeft <= 5 ? 'danger' : 'warning'} size="sm">
            {minutesLeft} min restantes
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function EstadosTab({
  appointments,
  activeHolds = [],
  loading = false,
  onRefresh,
  onAppointmentClick,
}: EstadosTabProps) {
  const { terminology, vertical } = useVerticalTerminology();
  const isRestaurant = vertical === 'restaurant';

  // Filter state
  const [selectedFilter, setSelectedFilter] = useState<BookingCombinedState | 'all'>('all');

  // Calculate stats
  const stats = useMemo<BookingStateStats>(() => {
    const counts: BookingStateStats = {
      totalBookings: appointments.length,
      pendingConfirmation: 0,
      pendingDeposit: 0,
      confirmed: 0,
      activeHolds: activeHolds.length,
      noShows: 0,
      cancelled: 0,
      completed: 0,
    };

    appointments.forEach((apt) => {
      if (apt.confirmation_status === 'pending') counts.pendingConfirmation++;
      if (apt.deposit_status === 'required' || apt.deposit_status === 'pending') counts.pendingDeposit++;
      if (apt.status === 'confirmed') counts.confirmed++;
      if (apt.status === 'no_show') counts.noShows++;
      if (apt.status === 'cancelled') counts.cancelled++;
      if (apt.status === 'completed') counts.completed++;
    });

    return counts;
  }, [appointments, activeHolds]);

  // Group appointments by combined state
  const groupedAppointments = useMemo(() => {
    const groups: Record<BookingCombinedState, AppointmentWithBooking[]> = {
      hold_active: [],
      pending_confirmation: [],
      pending_deposit: [],
      confirmed: [],
      scheduled: [],
      in_progress: [],
      completed: [],
      no_show: [],
      cancelled: [],
    };

    appointments.forEach((apt) => {
      const state = getCombinedBookingState(
        apt.status,
        apt.confirmation_status,
        apt.deposit_status,
        !!apt.created_from_hold_id
      );
      groups[state].push(apt);
    });

    return groups;
  }, [appointments]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    if (selectedFilter === 'all') return appointments;
    return groupedAppointments[selectedFilter] || [];
  }, [selectedFilter, appointments, groupedAppointments]);

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: appointments.length };
    BOOKING_COMBINED_STATES.forEach((state) => {
      counts[state.value] = groupedAppointments[state.value as BookingCombinedState]?.length || 0;
    });
    return counts;
  }, [appointments, groupedAppointments]);

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Estados de {isRestaurant ? 'Reservaciones' : 'Citas'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitorea confirmaciones, depósitos y holds activos
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={icons.refresh}
            onClick={onRefresh}
            disabled={loading}
          >
            Actualizar
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Holds Activos"
          value={stats.activeHolds}
          icon={icons.clock}
          color="amber"
          description="Reservaciones temporales"
        />
        <StatCard
          label="Pendiente Confirmar"
          value={stats.pendingConfirmation}
          icon={icons.alert}
          color="orange"
          description="Esperando respuesta"
        />
        <StatCard
          label="Confirmados"
          value={stats.confirmed}
          icon={icons.check}
          color="green"
          description="Listos para atender"
        />
        <StatCard
          label="No Shows"
          value={stats.noShows}
          icon={icons.x}
          color="red"
          description="No se presentaron"
        />
      </div>

      {/* Active Holds Section */}
      {activeHolds.length > 0 && (
        <Card variant="bordered">
          <CardHeader
            title="Holds Activos"
            subtitle={`${activeHolds.length} reservaciones temporales en progreso`}
          />
          <CardContent>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {activeHolds.map((hold, index) => (
                <HoldCard key={hold.id} hold={hold} index={index} />
              ))}
            </motion.div>
          </CardContent>
        </Card>
      )}

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        <FilterButton
          label="Todos"
          count={filterCounts.all ?? 0}
          isActive={selectedFilter === 'all'}
          color="slate"
          onClick={() => setSelectedFilter('all')}
        />
        {BOOKING_COMBINED_STATES.filter((s) => (filterCounts[s.value] ?? 0) > 0).map((state) => (
          <FilterButton
            key={state.value}
            label={state.label}
            count={filterCounts[state.value] ?? 0}
            isActive={selectedFilter === state.value}
            color={state.color as FilterColor}
            onClick={() => setSelectedFilter(state.value as BookingCombinedState)}
          />
        ))}
      </div>

      {/* Appointments List */}
      <Card variant="bordered">
        <CardHeader
          title={selectedFilter === 'all' ? `Todas las ${isRestaurant ? 'Reservaciones' : 'Citas'}` : BOOKING_COMBINED_STATES.find((s) => s.value === selectedFilter)?.label || ''}
          subtitle={`${filteredAppointments.length} ${isRestaurant ? 'reservaciones' : 'citas'}`}
        />
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No hay {isRestaurant ? 'reservaciones' : 'citas'} con este estado</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedFilter}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                {filteredAppointments.map((apt, index) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    index={index}
                    onClick={() => onAppointmentClick?.(apt)}
                    terminology={terminology}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
