// =====================================================
// TIS TIS PLATFORM - Appointment Detail Panel (Apple-style)
// Slide-over panel with fluid animations
// =====================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Badge, Avatar } from '@/src/shared/components/ui';
import { supabase } from '@/src/shared/lib/supabase';
import { formatDate, formatTime, cn } from '@/src/shared/utils';
import { APPOINTMENT_STATUSES } from '@/src/shared/constants';
import type { Appointment, Lead, Staff, Service, Branch } from '@/src/shared/types';

// ======================
// TYPES
// ======================
interface AppointmentWithRelations extends Appointment {
  leads?: Lead;
  staff?: Staff;
  services?: Service;
  branches?: Branch;
}

interface AppointmentDetailPanelProps {
  appointment: AppointmentWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (appointmentId: string, newStatus: string) => void;
}

// ======================
// ICONS
// ======================
const icons = {
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  medical: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  location: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  phone: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
  notes: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  reason: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  doctor: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
};

// ======================
// STATUS BADGE COLORS
// ======================
const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  scheduled: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  confirmed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  in_progress: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  no_show: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
  rescheduled: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
};

// ======================
// ANIMATION VARIANTS (Apple-style)
// ======================
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: [0.32, 0.72, 0, 1] as const },
  },
};

const panelVariants = {
  hidden: {
    x: '100%',
    opacity: 0.8,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      damping: 30,
      stiffness: 300,
      mass: 0.8,
    },
  },
  exit: {
    x: '100%',
    opacity: 0.8,
    transition: {
      type: 'spring' as const,
      damping: 30,
      stiffness: 300,
      mass: 0.8,
    },
  },
};

const contentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1,
      duration: 0.25,
      ease: [0.32, 0.72, 0, 1] as const,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.15 + i * 0.05,
      duration: 0.25,
      ease: [0.32, 0.72, 0, 1] as const,
    },
  }),
};

// ======================
// COMPONENT
// ======================
export function AppointmentDetailPanel({
  appointment,
  isOpen,
  onClose,
  onStatusChange,
}: AppointmentDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [fullData, setFullData] = useState<AppointmentWithRelations | null>(null);

  // Fetch full appointment data with relations
  const fetchFullData = useCallback(async () => {
    if (!appointment?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          leads(*),
          staff:staff!appointments_staff_id_fkey(*),
          services(*),
          branches(*)
        `)
        .eq('id', appointment.id)
        .single();

      if (error) throw error;
      setFullData(data as AppointmentWithRelations);
    } catch (err) {
      console.error('Error fetching appointment details:', err);
      setFullData(appointment);
    } finally {
      setLoading(false);
    }
  }, [appointment]);

  useEffect(() => {
    if (isOpen && appointment) {
      fetchFullData();
    }
  }, [isOpen, fetchFullData, appointment]);

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (!appointment?.id) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', appointment.id);

      if (error) throw error;

      // Update local state
      setFullData((prev) => prev ? { ...prev, status: newStatus as any } : null);
      onStatusChange?.(appointment.id, newStatus);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const displayData = fullData || appointment;
  const lead = displayData?.leads;
  const staff = displayData?.staff;
  const service = displayData?.services;
  const branch = displayData?.branches;

  // Debug: log staff data (v2 - with FK fix)
  console.log('🔍 Appointment Detail v2:', {
    timestamp: new Date().toISOString(),
    staff_id: displayData?.staff_id,
    staff: staff,
    service_id: displayData?.service_id,
    service: service,
    hasFullData: !!fullData
  });

  const statusInfo = displayData?.status ? statusColors[displayData.status] || statusColors.scheduled : statusColors.scheduled;
  const statusLabel = APPOINTMENT_STATUSES.find((s) => s.value === displayData?.status)?.label || displayData?.status;

  // Format price
  const formatPrice = (min?: number | null, max?: number | null) => {
    if (!min && !max) return null;
    if (min === max || !max) return `$${min?.toLocaleString()}`;
    return `$${min?.toLocaleString()} - $${max?.toLocaleString()}`;
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && displayData && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed top-0 right-0 h-full w-full max-w-md',
              'bg-white shadow-2xl z-50',
              'flex flex-col',
              'border-l border-gray-200'
            )}
          >
            {/* Header */}
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-shrink-0 px-6 py-4 border-b border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className={cn(
                      'p-2 -ml-2 rounded-full',
                      'text-gray-400 hover:text-gray-600',
                      'hover:bg-gray-100 active:bg-gray-200',
                      'transition-all duration-150'
                    )}
                  >
                    {icons.close}
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900">Detalle de Cita</h2>
                </div>
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full',
                  statusInfo.bg, statusInfo.text
                )}>
                  <span className={cn('w-2 h-2 rounded-full', statusInfo.dot)} />
                  <span className="text-sm font-medium">{statusLabel}</span>
                </div>
              </div>
            </motion.div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <motion.div
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="p-6 space-y-6"
              >
                {/* Date & Time Card */}
                <motion.div
                  custom={0}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <span className="text-blue-600">{icons.calendar}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-600 mb-1">Fecha y Hora</p>
                      <p className="text-lg font-semibold text-gray-900 capitalize">
                        {formatDate(displayData.scheduled_at, { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-gray-600">
                        <span className="text-gray-400">{icons.clock}</span>
                        <span className="text-sm">
                          {formatTime(displayData.scheduled_at)} - {displayData.duration_minutes} min
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Patient/Lead Card */}
                {lead && (
                  <motion.div
                    custom={1}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-purple-500">{icons.user}</span>
                      <span className="text-sm font-medium text-gray-700">Paciente</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Avatar
                        name={lead.full_name || lead.phone}
                        size="lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {lead.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{lead.email || 'Sin email'}</p>
                        {lead.classification && (
                          <Badge
                            size="sm"
                            variant={
                              lead.classification === 'hot' ? 'danger' :
                              lead.classification === 'warm' ? 'warning' :
                              'default'
                            }
                            className="mt-1"
                          >
                            {lead.classification}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Contact actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 px-3',
                            'bg-gray-50 hover:bg-gray-100 rounded-xl',
                            'text-sm font-medium text-gray-700',
                            'transition-colors duration-150'
                          )}
                        >
                          <span className="text-gray-400">{icons.phone}</span>
                          Llamar
                        </a>
                      )}
                      {lead.phone && (
                        <a
                          href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 px-3',
                            'bg-green-50 hover:bg-green-100 rounded-xl',
                            'text-sm font-medium text-green-700',
                            'transition-colors duration-150'
                          )}
                        >
                          <span className="text-green-600">{icons.whatsapp}</span>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Service Card */}
                {service && (
                  <motion.div
                    custom={2}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="p-4 bg-white rounded-2xl border border-gray-200"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-green-500">{icons.medical}</span>
                      <span className="text-sm font-medium text-gray-700">Servicio</span>
                    </div>
                    <p className="font-semibold text-gray-900">{service.name}</p>
                    {service.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      {formatPrice(service.price_min, service.price_max) && (
                        <span className="text-sm font-medium text-green-600">
                          {formatPrice(service.price_min, service.price_max)}
                        </span>
                      )}
                      {service.duration_minutes && (
                        <span className="text-sm text-gray-500">
                          {service.duration_minutes} min
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Reason Card - Motivo de consulta (from service or notes) */}
                {(service || displayData.reason || displayData.notes) && (
                  <motion.div
                    custom={3}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-amber-600">{icons.reason}</span>
                      <span className="text-sm font-medium text-amber-800">Motivo de Consulta</span>
                    </div>
                    {/* Primary: Service name as consultation reason */}
                    {service && (
                      <p className="font-medium text-gray-900 mb-1">{service.name}</p>
                    )}
                    {/* Secondary: Additional notes or reason */}
                    {(displayData.reason || displayData.notes) && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {displayData.reason || displayData.notes}
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Staff Card - Always show, even if no doctor assigned */}
                <motion.div
                  custom={4}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="p-4 bg-white rounded-2xl border border-gray-200"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-orange-500">{icons.doctor}</span>
                    <span className="text-sm font-medium text-gray-700">Especialista Asignado</span>
                  </div>
                  {staff ? (
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={staff.display_name || `${staff.first_name} ${staff.last_name}`}
                        src={staff.avatar_url || undefined}
                        size="md"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {staff.display_name || `${staff.first_name} ${staff.last_name}`}
                        </p>
                        <p className="text-sm text-gray-500">{staff.role_title || staff.role}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400">{icons.user}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500">Sin asignar</p>
                        <p className="text-sm text-gray-400">Pendiente de asignación</p>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Branch Card */}
                {branch && (
                  <motion.div
                    custom={4}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="p-4 bg-white rounded-2xl border border-gray-200"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-blue-500">{icons.location}</span>
                      <span className="text-sm font-medium text-gray-700">Sucursal</span>
                    </div>
                    <p className="font-medium text-gray-900">{branch.name}</p>
                    {branch.address && (
                      <p className="text-sm text-gray-500 mt-1">
                        {branch.address}{branch.city ? `, ${branch.city}` : ''}
                      </p>
                    )}
                    {branch.phone && (
                      <p className="text-sm text-gray-500 mt-1">{branch.phone}</p>
                    )}
                  </motion.div>
                )}

                {/* Notes Card - Only show if notes exist AND are different from reason */}
                {displayData.notes && displayData.reason && displayData.notes !== displayData.reason && (
                  <motion.div
                    custom={6}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="p-4 bg-gray-50 rounded-2xl border border-gray-200"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-400">{icons.notes}</span>
                      <span className="text-sm font-medium text-gray-700">Notas Internas</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{displayData.notes}</p>
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Footer Actions */}
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50/50"
            >
              <p className="text-xs text-gray-500 mb-3">Cambiar estado:</p>
              <div className="grid grid-cols-2 gap-2">
                {displayData.status !== 'confirmed' && displayData.status !== 'completed' && displayData.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    onClick={() => handleStatusChange('confirmed')}
                    leftIcon={icons.check}
                  >
                    Confirmar
                  </Button>
                )}
                {displayData.status !== 'completed' && displayData.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    onClick={() => handleStatusChange('completed')}
                    leftIcon={icons.check}
                  >
                    Completar
                  </Button>
                )}
                {displayData.status !== 'cancelled' && displayData.status !== 'completed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                    onClick={() => handleStatusChange('cancelled')}
                    leftIcon={icons.x}
                  >
                    Cancelar
                  </Button>
                )}
                {displayData.status !== 'no_show' && displayData.status !== 'completed' && displayData.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    onClick={() => handleStatusChange('no_show')}
                  >
                    No Show
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
