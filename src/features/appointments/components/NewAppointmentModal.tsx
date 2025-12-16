// =====================================================
// TIS TIS PLATFORM - New Appointment Modal (Premium)
// Professional appointment scheduling interface
// =====================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Badge, Avatar } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { useBranch } from '@/src/shared/stores';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================
interface Lead {
  id: string;
  full_name: string | null;
  phone: string;
  email?: string;
  classification?: string;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price_min: number;
  price_max: number;
  category?: string;
}

interface StaffMember {
  id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  role: string;
  role_title?: string;
  avatar_url?: string;
}

interface Branch {
  id: string;
  name: string;
  address?: string;
}

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedDate?: Date;
  preselectedLeadId?: string;
}

// ======================
// ICONS
// ======================
const icons = {
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
  notes: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

// ======================
// TIME SLOTS
// ======================
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1.5 horas' },
  { value: 120, label: '2 horas' },
];

// ======================
// COMPONENT
// ======================
export function NewAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedDate,
  preselectedLeadId,
}: NewAppointmentModalProps) {
  const { tenant, branches: authBranches } = useAuthContext();
  const { selectedBranchId } = useBranch();

  // Data states
  const [leads, setLeads] = useState<Lead[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form states
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId || '');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedBranchIdLocal, setSelectedBranchIdLocal] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadSearch, setLeadSearch] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  // Fetch all data when modal opens
  useEffect(() => {
    if (isOpen && tenant?.id) {
      fetchAllData();
    }
  }, [isOpen, tenant?.id]);

  // Set preselected values
  useEffect(() => {
    if (isOpen) {
      if (preselectedDate) {
        setScheduledDate(preselectedDate.toISOString().split('T')[0]);
      } else {
        setScheduledDate(new Date().toISOString().split('T')[0]);
      }

      if (preselectedLeadId) {
        setSelectedLeadId(preselectedLeadId);
      }

      // Set default branch
      if (selectedBranchId) {
        setSelectedBranchIdLocal(selectedBranchId);
      } else if (authBranches.length > 0) {
        setSelectedBranchIdLocal(authBranches[0].id);
      }
    }
  }, [isOpen, preselectedDate, preselectedLeadId, selectedBranchId, authBranches]);

  async function fetchAllData() {
    if (!tenant?.id) return;

    setLoadingData(true);
    try {
      const [leadsRes, servicesRes, staffRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, full_name, phone, email, classification')
          .eq('tenant_id', tenant.id)
          .order('full_name'),
        supabase
          .from('services')
          .select('id, name, duration_minutes, price_min, price_max, category')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('staff')
          .select('id, display_name, first_name, last_name, role, role_title, avatar_url')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .in('role', ['dentist', 'specialist', 'doctor', 'manager', 'owner'])
          .order('display_name'),
      ]);

      if (leadsRes.error) console.error('Error fetching leads:', leadsRes.error);
      if (servicesRes.error) console.error('Error fetching services:', servicesRes.error);
      if (staffRes.error) console.error('Error fetching staff:', staffRes.error);

      // Debug logging
      console.log('[NewAppointmentModal] Staff loaded:', staffRes.data?.length || 0, 'members');
      console.log('[NewAppointmentModal] Staff data:', staffRes.data);
      console.log('[NewAppointmentModal] Services loaded:', servicesRes.data?.length || 0);
      console.log('[NewAppointmentModal] Leads loaded:', leadsRes.data?.length || 0);

      setLeads(leadsRes.data || []);
      setServices(servicesRes.data || []);
      setStaff(staffRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingData(false);
    }
  }

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!leadSearch) return leads;
    const search = leadSearch.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.full_name?.toLowerCase().includes(search) ||
        lead.phone?.includes(search) ||
        lead.email?.toLowerCase().includes(search)
    );
  }, [leads, leadSearch]);

  // Get selected lead details
  const selectedLead = useMemo(() => {
    return leads.find((l) => l.id === selectedLeadId);
  }, [leads, selectedLeadId]);

  // Get selected service details
  const selectedService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId);
  }, [services, selectedServiceId]);

  // Get selected staff details
  const selectedStaff = useMemo(() => {
    return staff.find((s) => s.id === selectedStaffId);
  }, [staff, selectedStaffId]);

  // Auto-set duration when service is selected
  useEffect(() => {
    if (selectedService?.duration_minutes) {
      setDuration(selectedService.duration_minutes);
    }
  }, [selectedService]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!selectedBranchIdLocal) {
        throw new Error('Selecciona una sucursal');
      }
      if (!scheduledDate) {
        throw new Error('Selecciona una fecha');
      }
      if (!scheduledTime) {
        throw new Error('Selecciona una hora');
      }

      // Create scheduled_at datetime
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);

      // Calculate end_time
      const endTime = new Date(scheduledAt.getTime() + duration * 60000);

      const appointmentData = {
        tenant_id: tenant.id,
        branch_id: selectedBranchIdLocal,
        lead_id: selectedLeadId || null,
        staff_id: selectedStaffId || null,
        service_id: selectedServiceId || null,
        scheduled_at: scheduledAt.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: duration,
        status: 'scheduled',
        notes: notes || null,
      };

      console.log('Creating appointment:', appointmentData);

      const { error: insertError } = await supabase
        .from('appointments')
        .insert(appointmentData);

      if (insertError) throw insertError;

      // Success
      onSuccess?.();
      onClose();
      resetForm();
    } catch (err) {
      console.error('Error creating appointment:', err);
      setError(err instanceof Error ? err.message : 'Error al crear la cita');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setSelectedLeadId('');
    setSelectedServiceId('');
    setSelectedStaffId('');
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setScheduledTime('09:00');
    setDuration(30);
    setNotes('');
    setError(null);
    setLeadSearch('');
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // Format price range
  const formatPrice = (min: number, max: number) => {
    if (min === max) return `$${min.toLocaleString()}`;
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  };

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nueva Cita"
      subtitle="Agenda una cita con todos los detalles"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} isLoading={loading}>
            Crear Cita
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <div className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">Error al crear la cita</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Section: Cliente */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="text-blue-500">{icons.user}</span>
            <span>Cliente</span>
            <span className="text-gray-400 font-normal">(opcional)</span>
          </div>

          <div className="relative">
            {/* Search Input */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                {icons.search}
              </span>
              <input
                type="text"
                value={selectedLead ? selectedLead.full_name || selectedLead.phone : leadSearch}
                onChange={(e) => {
                  setLeadSearch(e.target.value);
                  setSelectedLeadId('');
                  setShowLeadDropdown(true);
                }}
                onFocus={() => setShowLeadDropdown(true)}
                placeholder="Buscar por nombre, teléfono o email..."
                className={cn(
                  'w-full pl-10 pr-10 py-3 border rounded-xl text-sm',
                  'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  'transition-all duration-200',
                  selectedLead ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                )}
              />
              {selectedLead && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLeadId('');
                    setLeadSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showLeadDropdown && !selectedLead && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                {loadingData ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Cargando...</div>
                ) : filteredLeads.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {leadSearch ? 'No se encontraron resultados' : 'No hay clientes registrados'}
                  </div>
                ) : (
                  filteredLeads.slice(0, 10).map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        setLeadSearch('');
                        setShowLeadDropdown(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Avatar name={lead.full_name || lead.phone} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {lead.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{lead.phone}</p>
                      </div>
                      {lead.classification && (
                        <Badge
                          size="sm"
                          variant={
                            lead.classification === 'hot' ? 'danger' :
                            lead.classification === 'warm' ? 'warning' :
                            'default'
                          }
                        >
                          {lead.classification}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Lead Card */}
          {selectedLead && (
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex items-center gap-3">
              <Avatar name={selectedLead.full_name || selectedLead.phone} size="md" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{selectedLead.full_name || 'Sin nombre'}</p>
                <p className="text-sm text-gray-500">{selectedLead.phone}</p>
              </div>
              <div className="text-green-500">{icons.check}</div>
            </div>
          )}
        </div>

        {/* Section: Fecha y Hora */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="text-purple-500">{icons.calendar}</span>
            <span>Fecha y Hora</span>
            <span className="text-red-500">*</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Picker */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Fecha</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className={cn(
                  'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                  'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                  'transition-all duration-200'
                )}
              />
              {scheduledDate && (
                <p className="mt-1.5 text-xs text-gray-500 capitalize">
                  {formatDisplayDate(scheduledDate)}
                </p>
              )}
            </div>

            {/* Time Picker */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Hora</label>
              <select
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
                className={cn(
                  'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                  'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                  'transition-all duration-200 appearance-none bg-white',
                  'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                )}
              >
                {TIME_SLOTS.map((time) => (
                  <option key={time} value={time}>
                    {time.replace(':', ':')} hrs
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section: Servicio y Duración */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="text-green-500">{icons.medical}</span>
            <span>Servicio</span>
            <span className="text-gray-400 font-normal">(opcional)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Service Select */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tipo de servicio</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className={cn(
                  'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                  'focus:ring-2 focus:ring-green-500 focus:border-transparent',
                  'transition-all duration-200 appearance-none bg-white',
                  'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                )}
              >
                <option value="">Seleccionar servicio</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} min)
                  </option>
                ))}
              </select>
              {selectedService && (
                <p className="mt-1.5 text-xs text-green-600 font-medium">
                  {formatPrice(selectedService.price_min, selectedService.price_max)}
                </p>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Duración</label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className={cn(
                  'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                  'focus:ring-2 focus:ring-green-500 focus:border-transparent',
                  'transition-all duration-200 appearance-none bg-white',
                  'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                )}
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section: Especialista y Sucursal */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="text-orange-500">{icons.location}</span>
            <span>Asignación</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Staff Select */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Especialista <span className="text-gray-400">(opcional)</span>
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className={cn(
                  'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                  'focus:ring-2 focus:ring-orange-500 focus:border-transparent',
                  'transition-all duration-200 appearance-none bg-white',
                  'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                )}
              >
                <option value="">Sin asignar</option>
                {staff
                  .filter((member) => member.display_name?.trim() || member.first_name?.trim() || member.last_name?.trim())
                  .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.role_title || member.role} - {member.display_name || `${member.first_name || ''} ${member.last_name || ''}`.trim()}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Select */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Sucursal <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedBranchIdLocal}
                onChange={(e) => setSelectedBranchIdLocal(e.target.value)}
                required
                className={cn(
                  'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                  'focus:ring-2 focus:ring-orange-500 focus:border-transparent',
                  'transition-all duration-200 appearance-none bg-white',
                  'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                )}
              >
                <option value="">Seleccionar sucursal</option>
                {authBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Staff Card */}
          {selectedStaff && (
            <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl flex items-center gap-3">
              <Avatar
                name={selectedStaff.display_name || `${selectedStaff.first_name} ${selectedStaff.last_name}`}
                src={selectedStaff.avatar_url || undefined}
                size="md"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {selectedStaff.display_name || `${selectedStaff.first_name} ${selectedStaff.last_name}`}
                </p>
                <p className="text-sm text-gray-500">{selectedStaff.role_title || selectedStaff.role}</p>
              </div>
              <Badge size="sm" variant="warning">{selectedStaff.role}</Badge>
            </div>
          )}
        </div>

        {/* Section: Notas */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="text-gray-400">{icons.notes}</span>
            <span>Notas adicionales</span>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Información adicional sobre la cita, síntomas, indicaciones especiales..."
            className={cn(
              'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
              'focus:ring-2 focus:ring-gray-400 focus:border-transparent',
              'transition-all duration-200 resize-none',
              'placeholder:text-gray-400'
            )}
          />
        </div>

        {/* Summary Card */}
        {(scheduledDate && scheduledTime) && (
          <div className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">Resumen de la cita</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Fecha:</span>
                <p className="font-medium text-gray-900 capitalize">
                  {formatDisplayDate(scheduledDate)}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Hora:</span>
                <p className="font-medium text-gray-900">{scheduledTime} hrs</p>
              </div>
              <div>
                <span className="text-gray-500">Duración:</span>
                <p className="font-medium text-gray-900">{duration} minutos</p>
              </div>
              <div>
                <span className="text-gray-500">Sucursal:</span>
                <p className="font-medium text-gray-900">
                  {authBranches.find(b => b.id === selectedBranchIdLocal)?.name || 'No seleccionada'}
                </p>
              </div>
              {selectedLead && (
                <div className="col-span-2">
                  <span className="text-gray-500">Cliente:</span>
                  <p className="font-medium text-gray-900">{selectedLead.full_name || selectedLead.phone}</p>
                </div>
              )}
              {selectedService && (
                <div className="col-span-2">
                  <span className="text-gray-500">Servicio:</span>
                  <p className="font-medium text-gray-900">{selectedService.name}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </form>

      {/* Click outside to close lead dropdown */}
      {showLeadDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowLeadDropdown(false)}
        />
      )}
    </Modal>
  );
}
