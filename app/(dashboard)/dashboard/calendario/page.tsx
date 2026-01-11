// =====================================================
// TIS TIS PLATFORM - Calendar Page
// =====================================================

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Avatar } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { NewAppointmentModal, AppointmentDetailPanel } from '@/src/features/appointments';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/src/shared/lib/supabase';
import { useBranch } from '@/src/shared/stores';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import { formatDate, formatTime, cn } from '@/src/shared/utils';
import { APPOINTMENT_STATUSES } from '@/src/shared/constants';
import type { Appointment } from '@/src/shared/types';

// ======================
// ICONS
// ======================
const icons = {
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  chevronLeft: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  arrowRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
};

// ======================
// ANIMATION VARIANTS (Apple-style)
// ======================
const listItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.2,
      ease: [0.32, 0.72, 0, 1] as const,
    },
  }),
};

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

// Status colors for badges
const statusColors: Record<string, { bg: string; border: string; dot: string }> = {
  scheduled: { bg: 'bg-blue-50', border: 'border-blue-100', dot: 'bg-blue-500' },
  confirmed: { bg: 'bg-green-50', border: 'border-green-100', dot: 'bg-green-500' },
  in_progress: { bg: 'bg-yellow-50', border: 'border-yellow-100', dot: 'bg-yellow-500' },
  completed: { bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500' },
  no_show: { bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' },
  rescheduled: { bg: 'bg-purple-50', border: 'border-purple-100', dot: 'bg-purple-500' },
};

// ======================
// HELPERS
// ======================
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];

  // Add previous month days
  for (let i = 0; i < firstDay.getDay(); i++) {
    const date = new Date(year, month, -i);
    days.unshift({ date, isCurrentMonth: false });
  }

  // Add current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Add next month days to complete grid
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  return days;
}

// ======================
// COMPONENT
// ======================
export default function CalendarPage() {
  const { tenant } = useAuthContext();
  const { selectedBranchId, selectedBranch } = useBranch();
  const { t, terminology } = useVerticalTerminology();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()); // Select today by default
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);

  // Detail panel state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch appointments for current month
  const fetchAppointments = useCallback(async () => {
    // Wait for tenant to be loaded
    if (!tenant?.id) {
      console.log('🟡 Calendar: No tenant yet, waiting...');
      return;
    }

    console.log('🟢 Calendar: Fetching appointments for tenant:', tenant.id, 'branch:', selectedBranchId || 'all');

    try {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      let query = supabase
        .from('appointments')
        .select('*, leads(full_name, phone)')
        .eq('tenant_id', tenant.id)
        .gte('scheduled_at', startOfMonth.toISOString())
        .lte('scheduled_at', endOfMonth.toISOString());

      // Apply branch filter if selected
      if (selectedBranchId) {
        query = query.eq('branch_id', selectedBranchId);
      }

      const { data, error } = await query.order('scheduled_at');

      if (error) throw error;
      console.log('🟢 Calendar: Fetched', data?.length, 'appointments');
      setAppointments(data as Appointment[]);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  }, [year, month, tenant?.id, selectedBranchId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Get appointments by date
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((apt) => {
      const dateKey = new Date(apt.scheduled_at).toDateString();
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(apt);
    });
    return map;
  }, [appointments]);

  // Calendar days
  const calendarDays = useMemo(() => getMonthDays(year, month), [year, month]);

  // Selected date appointments
  const selectedDateAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return appointmentsByDate.get(selectedDate.toDateString()) || [];
  }, [selectedDate, appointmentsByDate]);

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return selectedDate?.toDateString() === date.toDateString();
  };

  // Check if currently viewing today
  const isViewingToday = useMemo(() => {
    const today = new Date();
    return selectedDate?.toDateString() === today.toDateString();
  }, [selectedDate]);

  // Handle appointment click
  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowDetailPanel(true);
  };

  // Handle status change from detail panel
  const handleStatusChange = (appointmentId: string, newStatus: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === appointmentId ? { ...apt, status: newStatus as Appointment['status'] } : apt
      )
    );
  };

  return (
    <PageWrapper
      title={t('calendarPageTitle')}
      subtitle={selectedBranch ? `${MONTHS[month]} ${year} - ${selectedBranch.name}` : `${MONTHS[month]} ${year}`}
      actions={
        <Button leftIcon={icons.plus} onClick={() => setShowNewAppointmentModal(true)}>
          {t('newAppointment')}
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <Card variant="bordered">
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 active:scale-95 rounded-lg transition-all"
                    >
                      {icons.chevronLeft}
                    </button>
                    <button
                      onClick={goToNextMonth}
                      className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 active:scale-95 rounded-lg transition-all"
                    >
                      {icons.chevronRight}
                    </button>
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    {MONTHS[month]} {year}
                  </h2>
                </div>
                {!isViewingToday && (
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Hoy
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Days header */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const dateAppointments = appointmentsByDate.get(day.date.toDateString()) || [];
                  const hasAppointments = dateAppointments.length > 0;

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(day.date)}
                      className={cn(
                        'aspect-square p-1 sm:p-1.5 rounded-lg relative min-h-[40px] sm:min-h-[44px]',
                        'flex flex-col items-center justify-start',
                        'hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all',
                        !day.isCurrentMonth && 'text-gray-300',
                        isToday(day.date) && 'bg-blue-50',
                        isSelected(day.date) && 'ring-2 ring-blue-500'
                      )}
                    >
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isToday(day.date) && 'text-blue-600'
                        )}
                      >
                        {day.date.getDate()}
                      </span>
                      {hasAppointments && (
                        <div className="flex gap-0.5 mt-1">
                          {dateAppointments.slice(0, 3).map((apt, i) => (
                            <div
                              key={i}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                apt.status === 'confirmed' ? 'bg-green-500' :
                                apt.status === 'cancelled' ? 'bg-red-500' :
                                'bg-blue-500'
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Date Details */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          <Card variant="bordered">
            <CardHeader
              title={selectedDate ? formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecciona un día'}
              subtitle={selectedDate ? `${selectedDateAppointments.length} ${terminology.appointments.toLowerCase()}` : undefined}
            />
            <CardContent>
              {!selectedDate ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Selecciona un día para ver las {terminology.appointments.toLowerCase()}</p>
                </div>
              ) : selectedDateAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">No hay {terminology.appointments.toLowerCase()} para este día</p>
                  <Button variant="outline" size="sm" leftIcon={icons.plus} onClick={() => setShowNewAppointmentModal(true)}>
                    {t('scheduleAction')}
                  </Button>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedDate.toDateString()}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    {selectedDateAppointments.map((apt, index) => {
                      const statusStyle = statusColors[apt.status] || statusColors.scheduled;
                      const lead = (apt as any).leads;

                      return (
                        <motion.button
                          key={apt.id}
                          custom={index}
                          variants={listItemVariants}
                          onClick={() => handleAppointmentClick(apt)}
                          className={cn(
                            'w-full p-3 sm:p-4 rounded-xl text-left min-h-[44px]',
                            'border transition-all duration-200',
                            'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                            statusStyle.bg,
                            statusStyle.border
                          )}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Time & Status Row */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={cn('w-2 h-2 rounded-full', statusStyle.dot)} />
                              <span className="text-sm font-semibold text-gray-900">
                                {formatTime(apt.scheduled_at)}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({apt.duration_minutes} min)
                              </span>
                            </div>
                            <Badge
                              variant={
                                apt.status === 'confirmed' ? 'success' :
                                apt.status === 'cancelled' ? 'danger' :
                                apt.status === 'completed' ? 'success' :
                                'info'
                              }
                              size="sm"
                            >
                              {APPOINTMENT_STATUSES.find((s) => s.value === apt.status)?.label || apt.status}
                            </Badge>
                          </div>

                          {/* Patient Info */}
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={lead?.full_name || lead?.phone || 'Sin nombre'}
                              size="md"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {lead?.full_name || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {lead?.phone || 'Sin teléfono'}
                              </p>
                            </div>
                            <span className="text-gray-400 flex-shrink-0">
                              {icons.arrowRight}
                            </span>
                          </div>

                          {/* Notes Preview */}
                          {apt.notes && (
                            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200/50 line-clamp-1">
                              {apt.notes}
                            </p>
                          )}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Appointment Modal */}
      <NewAppointmentModal
        isOpen={showNewAppointmentModal}
        onClose={() => setShowNewAppointmentModal(false)}
        onSuccess={fetchAppointments}
        preselectedDate={selectedDate || undefined}
      />

      {/* Appointment Detail Panel (Apple-style slide-over) */}
      <AppointmentDetailPanel
        appointment={selectedAppointment}
        isOpen={showDetailPanel}
        onClose={() => {
          setShowDetailPanel(false);
          setSelectedAppointment(null);
        }}
        onStatusChange={handleStatusChange}
      />
    </PageWrapper>
  );
}
