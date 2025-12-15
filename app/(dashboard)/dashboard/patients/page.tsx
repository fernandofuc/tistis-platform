// =====================================================
// TIS TIS PLATFORM - Patients Page
// =====================================================

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, Button, Badge, Avatar, SearchInput } from '@/src/shared/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { useBranch } from '@/src/shared/stores';
import { formatRelativeTime, formatPhone, cn } from '@/src/shared/utils';

// ======================
// ICONS
// ======================
const icons = {
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  mail: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface Patient {
  id: string;
  tenant_id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  date_of_birth: string | null;
  gender: string | null;
  status: 'active' | 'inactive' | 'archived';
  preferred_branch_id: string | null;
  assigned_dentist_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  preferred_branch?: { id: string; name: string } | null;
  assigned_dentist?: { id: string; first_name: string; last_name: string } | null;
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'archived';

// ======================
// ANIMATION VARIANTS
// ======================
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: [0.32, 0.72, 0, 1] as const } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 25, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 },
  },
};

// ======================
// COMPONENT
// ======================
export default function PatientsPage() {
  const { tenant } = useAuthContext();
  const { selectedBranchId, selectedBranch } = useBranch();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // New patient form state
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '',
    notes: '',
  });

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    if (!tenant?.id) {
      console.log('🟡 Patients: No tenant yet, waiting...');
      return;
    }

    console.log('🟢 Patients: Fetching for tenant:', tenant.id);

    try {
      let query = supabase
        .from('patients')
        .select(`
          *,
          preferred_branch:branches!preferred_branch_id(id, name),
          assigned_dentist:staff_members!assigned_dentist_id(id, first_name, last_name)
        `)
        .eq('tenant_id', tenant.id);

      // Apply branch filter if selected
      if (selectedBranchId) {
        query = query.eq('preferred_branch_id', selectedBranchId);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      console.log('🟢 Patients: Fetched', data?.length, 'patients');
      setPatients(data as Patient[]);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, selectedBranchId, statusFilter]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Filter patients by search
  const filteredPatients = useMemo(() => {
    if (!search) return patients;
    const searchLower = search.toLowerCase();
    return patients.filter((p) =>
      p.first_name.toLowerCase().includes(searchLower) ||
      p.last_name.toLowerCase().includes(searchLower) ||
      p.phone.includes(search) ||
      p.email?.toLowerCase().includes(searchLower) ||
      p.patient_number.toLowerCase().includes(searchLower)
    );
  }, [patients, search]);

  // Count by status
  const counts = useMemo(() => ({
    all: patients.length,
    active: patients.filter((p) => p.status === 'active').length,
    inactive: patients.filter((p) => p.status === 'inactive').length,
    archived: patients.filter((p) => p.status === 'archived').length,
  }), [patients]);

  // Calculate age
  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  // Handle create patient
  const handleCreatePatient = async () => {
    if (!tenant?.id) return;
    if (!newPatient.first_name.trim() || !newPatient.last_name.trim() || !newPatient.phone.trim()) {
      alert('Por favor completa los campos requeridos: Nombre, Apellido y Teléfono');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .insert({
          tenant_id: tenant.id,
          first_name: newPatient.first_name.trim(),
          last_name: newPatient.last_name.trim(),
          phone: newPatient.phone.trim(),
          email: newPatient.email.trim() || null,
          date_of_birth: newPatient.date_of_birth || null,
          gender: newPatient.gender || null,
          notes: newPatient.notes.trim() || null,
          preferred_branch_id: selectedBranchId || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      console.log('🟢 Patient created:', data);
      setShowNewPatientModal(false);
      setNewPatient({ first_name: '', last_name: '', phone: '', email: '', date_of_birth: '', gender: '', notes: '' });
      fetchPatients();
    } catch (error) {
      console.error('Error creating patient:', error);
      alert('Error al crear el paciente. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Activos' },
    { key: 'inactive', label: 'Inactivos' },
    { key: 'archived', label: 'Archivados' },
  ];

  return (
    <PageWrapper
      title="Pacientes"
      subtitle={selectedBranch ? `Pacientes en ${selectedBranch.name}` : `${patients.length} pacientes registrados`}
      actions={
        <Button leftIcon={icons.plus} onClick={() => setShowNewPatientModal(true)}>
          Nuevo Paciente
        </Button>
      }
    >
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              statusFilter === tab.key
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {tab.label}
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-gray-100">
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchInput
          placeholder="Buscar por nombre, teléfono o número de paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Patients List */}
      <Card variant="bordered">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                {icons.user}
              </div>
              <p className="text-lg font-medium mb-2">
                {search ? 'No se encontraron resultados' : 'No hay pacientes registrados'}
              </p>
              <p className="text-sm mb-4">
                {search
                  ? 'Intenta con otros términos de búsqueda'
                  : 'Comienza agregando tu primer paciente'
                }
              </p>
              {!search && (
                <Button leftIcon={icons.plus} onClick={() => setShowNewPatientModal(true)}>
                  Agregar Paciente
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* Avatar */}
                  <Avatar name={`${patient.first_name} ${patient.last_name}`} size="lg" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <span className="text-xs text-gray-400 font-mono">
                        #{patient.patient_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{formatPhone(patient.phone)}</span>
                      {patient.date_of_birth && (
                        <span>{calculateAge(patient.date_of_birth)} años</span>
                      )}
                    </div>
                  </div>

                  {/* Branch */}
                  <div className="hidden md:block text-sm text-gray-500">
                    {patient.preferred_branch?.name || 'Sin sucursal'}
                  </div>

                  {/* Status */}
                  <Badge
                    variant={
                      patient.status === 'active' ? 'success' :
                      patient.status === 'inactive' ? 'default' :
                      'danger'
                    }
                    size="sm"
                  >
                    {patient.status === 'active' ? 'Activo' :
                     patient.status === 'inactive' ? 'Inactivo' :
                     'Archivado'}
                  </Badge>

                  {/* Time */}
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {formatRelativeTime(patient.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Patient Modal (Premium Design) */}
      <AnimatePresence>
        {showNewPatientModal && (
          <>
            {/* Backdrop */}
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setShowNewPatientModal(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            />

            {/* Modal */}
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Nuevo Paciente</h2>
                    <p className="text-sm text-gray-500">Registra un nuevo paciente en el sistema</p>
                  </div>
                  <button
                    onClick={() => setShowNewPatientModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-xl transition-colors"
                  >
                    {icons.close}
                  </button>
                </div>

                {/* Form - Scrollable */}
                <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">

                  {/* Section: Información Personal */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <span className="text-blue-500">{icons.user}</span>
                      <span>Información Personal</span>
                      <span className="text-red-500">*</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre</label>
                        <input
                          type="text"
                          value={newPatient.first_name}
                          onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            'transition-all duration-200 placeholder:text-gray-400'
                          )}
                          placeholder="Juan"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Apellido</label>
                        <input
                          type="text"
                          value={newPatient.last_name}
                          onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            'transition-all duration-200 placeholder:text-gray-400'
                          )}
                          placeholder="Pérez"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Fecha de Nacimiento</label>
                        <input
                          type="date"
                          value={newPatient.date_of_birth}
                          onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            'transition-all duration-200'
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Género</label>
                        <select
                          value={newPatient.gender}
                          onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            'transition-all duration-200 appearance-none bg-white',
                            'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                          )}
                        >
                          <option value="">Seleccionar...</option>
                          <option value="male">Masculino</option>
                          <option value="female">Femenino</option>
                          <option value="other">Otro</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section: Contacto */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <span className="text-green-500">{icons.phone}</span>
                      <span>Información de Contacto</span>
                      <span className="text-red-500">*</span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Teléfono</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {icons.phone}
                        </span>
                        <input
                          type="tel"
                          value={newPatient.phone}
                          onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                          className={cn(
                            'w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-green-500 focus:border-transparent',
                            'transition-all duration-200 placeholder:text-gray-400'
                          )}
                          placeholder="+52 (000) 000-0000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Email <span className="text-gray-400 font-normal">(opcional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {icons.mail}
                        </span>
                        <input
                          type="email"
                          value={newPatient.email}
                          onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                          className={cn(
                            'w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-green-500 focus:border-transparent',
                            'transition-all duration-200 placeholder:text-gray-400'
                          )}
                          placeholder="paciente@ejemplo.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section: Notas */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <span className="text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </span>
                      <span>Notas Adicionales</span>
                      <span className="text-gray-400 font-normal">(opcional)</span>
                    </div>

                    <textarea
                      value={newPatient.notes}
                      onChange={(e) => setNewPatient({ ...newPatient, notes: e.target.value })}
                      rows={3}
                      className={cn(
                        'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                        'focus:ring-2 focus:ring-gray-400 focus:border-transparent',
                        'transition-all duration-200 resize-none placeholder:text-gray-400'
                      )}
                      placeholder="Alergias, condiciones médicas, información relevante..."
                    />
                  </div>

                  {/* Summary Card */}
                  {(newPatient.first_name || newPatient.last_name || newPatient.phone) && (
                    <div className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Vista previa del paciente
                      </h4>
                      <div className="flex items-center gap-4">
                        <Avatar
                          name={`${newPatient.first_name} ${newPatient.last_name}`.trim() || 'Nuevo'}
                          size="lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {newPatient.first_name || newPatient.last_name
                              ? `${newPatient.first_name} ${newPatient.last_name}`.trim()
                              : 'Sin nombre'}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            {newPatient.phone && <span>{newPatient.phone}</span>}
                            {newPatient.email && <span>{newPatient.email}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {newPatient.gender && (
                              <Badge size="sm" variant="info">
                                {newPatient.gender === 'male' ? 'Masculino' :
                                 newPatient.gender === 'female' ? 'Femenino' : 'Otro'}
                              </Badge>
                            )}
                            {selectedBranch && (
                              <Badge size="sm" variant="default">
                                {selectedBranch.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    <span className="text-red-500">*</span> Campos requeridos
                  </p>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => setShowNewPatientModal(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreatePatient}
                      disabled={saving || !newPatient.first_name || !newPatient.last_name || !newPatient.phone}
                    >
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Guardando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {icons.check}
                          Crear Paciente
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}
