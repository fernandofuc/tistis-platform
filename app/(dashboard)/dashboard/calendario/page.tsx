// =====================================================
// TIS TIS PLATFORM - Calendar Page
// =====================================================

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Avatar } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { NewAppointmentModal } from '@/src/features/appointments';
import { supabase } from '@/src/shared/lib/supabase';
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date()); // Select today by default
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Fetch appointments for current month
  const fetchAppointments = useCallback(async () => {
    // Wait for tenant to be loaded
    if (!tenant?.id) {
      console.log('🟡 Calendar: No tenant yet, waiting...');
      return;
    }

    console.log('🟢 Calendar: Fetching appointments for tenant:', tenant.id);

    try {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('appointments')
        .select('*, leads(full_name, phone)')
        .eq('tenant_id', tenant.id)
        .gte('scheduled_at', startOfMonth.toISOString())
        .lte('scheduled_at', endOfMonth.toISOString())
        .order('scheduled_at');

      if (error) throw error;
      console.log('🟢 Calendar: Fetched', data?.length, 'appointments');
      setAppointments(data as Appointment[]);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  }, [year, month, tenant?.id]);

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

  return (
    <PageWrapper
      title="Calendario"
      subtitle={`${MONTHS[month]} ${year}`}
      actions={
        <Button leftIcon={icons.plus} onClick={() => setShowNewAppointmentModal(true)}>
          Nueva Cita
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card variant="bordered">
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={goToPreviousMonth}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      {icons.chevronLeft}
                    </button>
                    <button
                      onClick={goToNextMonth}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      {icons.chevronRight}
                    </button>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {MONTHS[month]} {year}
                  </h2>
                </div>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Hoy
                </Button>
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
                        'aspect-square p-1 rounded-lg relative',
                        'flex flex-col items-center justify-start',
                        'hover:bg-gray-100 transition-colors',
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
        <div className="lg:col-span-1">
          <Card variant="bordered">
            <CardHeader
              title={selectedDate ? formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecciona un día'}
              subtitle={selectedDate ? `${selectedDateAppointments.length} citas` : undefined}
            />
            <CardContent>
              {!selectedDate ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Selecciona un día para ver las citas</p>
                </div>
              ) : selectedDateAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">No hay citas para este día</p>
                  <Button variant="outline" size="sm" leftIcon={icons.plus} onClick={() => setShowNewAppointmentModal(true)}>
                    Agendar Cita
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <span className="text-gray-400">{icons.clock}</span>
                          {formatTime(apt.scheduled_at)}
                          <span className="text-gray-400">({apt.duration_minutes} min)</span>
                        </div>
                        <Badge
                          variant={
                            apt.status === 'confirmed' ? 'success' :
                            apt.status === 'cancelled' ? 'danger' :
                            'info'
                          }
                          size="sm"
                        >
                          {APPOINTMENT_STATUSES.find((s) => s.value === apt.status)?.label || apt.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar name={(apt as any).leads?.full_name || 'Sin nombre'} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {(apt as any).leads?.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(apt as any).leads?.phone}
                          </p>
                        </div>
                      </div>
                      {apt.notes && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {apt.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
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
    </PageWrapper>
  );
}
