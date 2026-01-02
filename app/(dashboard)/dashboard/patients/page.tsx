// =====================================================
// TIS TIS PLATFORM - Patients Page
// Patients who have had at least one appointment (uses dynamic terminology)
// Design System: TIS TIS Premium (Apple-like aesthetics)
// =====================================================

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button, Badge, Avatar, SearchInput } from '@/src/shared/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { useBranch } from '@/src/shared/stores';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import { formatRelativeTime, formatPhone, cn } from '@/src/shared/utils';

// ======================
// ICONS - TIS TIS Premium Style
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
  message: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
  heart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  arrowRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  clipboardList: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  userCheck: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 6l2 2-4 4" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface Patient {
  id: string;
  tenant_id: string;
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
  preferred_branch?: { id: string; name: string } | null;
  assigned_dentist?: { id: string; first_name: string; last_name: string } | null;
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'archived';

// ======================
// ANIMATION VARIANTS (Apple-style)
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

const panelVariants = {
  hidden: { x: '100%', opacity: 0.8 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 30, stiffness: 300, mass: 0.8 },
  },
  exit: {
    x: '100%',
    opacity: 0.8,
    transition: { type: 'spring' as const, damping: 30, stiffness: 300, mass: 0.8 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.15 + i * 0.05, duration: 0.25, ease: [0.32, 0.72, 0, 1] as const },
  }),
};

const cardHoverVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.01, transition: { duration: 0.2 } },
};

// ======================
// COMPONENT
// ======================
export default function PatientsPage() {
  const { tenant } = useAuthContext();
  const { selectedBranchId, selectedBranch } = useBranch();
  const { t, terminology, vertical } = useVerticalTerminology();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Detail panel state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

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

  // ======================
  // ACTION HANDLERS
  // ======================

  const handleCallClick = useCallback((e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    const patientName = `${patient.first_name} ${patient.last_name}`;
    const confirmed = window.confirm(
      `¿Estás seguro de que quieres llamar a ${patientName}?\n\nTeléfono: ${formatPhone(patient.phone)}`
    );
    if (confirmed) {
      window.location.href = `tel:${patient.phone}`;
    }
  }, []);

  const handleMessageClick = useCallback((e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    router.push(`/dashboard/inbox?patient_id=${patient.id}`);
  }, [router]);

  const handleCalendarClick = useCallback((e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    router.push(`/dashboard/calendario?patient_id=${patient.id}`);
  }, [router]);

  const handlePatientClick = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setShowDetailPanel(true);
  }, []);

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      let query = supabase
        .from('patients')
        .select('*')
        .eq('tenant_id', tenant.id);

      if (selectedBranchId) {
        query = query.eq('preferred_branch_id', selectedBranchId);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
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
      p.email?.toLowerCase().includes(searchLower)
    );
  }, [patients, search]);

  // Count by status (need to fetch all for counts)
  const [allPatients, setAllPatients] = useState<Patient[]>([]);

  useEffect(() => {
    async function fetchAllCounts() {
      if (!tenant?.id) return;

      let query = supabase
        .from('patients')
        .select('status')
        .eq('tenant_id', tenant.id);

      if (selectedBranchId) {
        query = query.eq('preferred_branch_id', selectedBranchId);
      }

      const { data } = await query;
      if (data) setAllPatients(data as Patient[]);
    }
    fetchAllCounts();
  }, [tenant?.id, selectedBranchId]);

  const counts = useMemo(() => ({
    all: allPatients.length,
    active: allPatients.filter((p) => p.status === 'active').length,
    inactive: allPatients.filter((p) => p.status === 'inactive').length,
    archived: allPatients.filter((p) => p.status === 'archived').length,
  }), [allPatients]);

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

  // Handle create patient - uses API endpoint with service role for reliable persistence
  const handleCreatePatient = async () => {
    if (!tenant?.id) {
      console.error('❌ No tenant ID found');
      alert('Error: No se encontró el tenant. Por favor recarga la página.');
      return;
    }
    if (!newPatient.first_name.trim() || !newPatient.last_name.trim() || !newPatient.phone.trim()) {
      alert('Por favor completa los campos requeridos: Nombre, Apellido y Teléfono');
      return;
    }

    setSaving(true);
    try {
      const patientData = {
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
      };

      console.log('📝 Creating patient via API with data:', patientData);

      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
      }

      // Use API endpoint which has service role access (bypasses RLS issues)
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(patientData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ API error creating patient:', result);
        throw new Error(result.error || 'Error al crear paciente');
      }

      console.log('✅ Patient created successfully:', result.patient);

      // Optimistically add the new patient to the list
      if (result.patient) {
        setPatients(prev => [result.patient, ...prev]);
      }

      setShowNewPatientModal(false);
      setNewPatient({ first_name: '', last_name: '', phone: '', email: '', date_of_birth: '', gender: '', notes: '' });
    } catch (error: unknown) {
      console.error('❌ Error creating patient:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al crear paciente';
      alert(`Error al crear el paciente: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Tab configuration
  const tabs: { key: StatusFilter; label: string; emoji: string; color: string; bgColor: string }[] = [
    { key: 'all', label: 'Todos', emoji: '📋', color: 'text-slate-700', bgColor: 'bg-slate-100' },
    { key: 'active', label: 'Activos', emoji: '✅', color: 'text-green-700', bgColor: 'bg-green-100' },
    { key: 'inactive', label: 'Inactivos', emoji: '⏸️', color: 'text-amber-700', bgColor: 'bg-amber-100' },
    { key: 'archived', label: 'Archivados', emoji: '📁', color: 'text-slate-600', bgColor: 'bg-slate-200' },
  ];

  // Dynamic content based on vertical
  const heroContent = useMemo(() => {
    if (vertical === 'restaurant') {
      return {
        title: '¿Quiénes son los Clientes?',
        description: `Los clientes son personas que ya han realizado al menos una reservación en tu restaurante.
          A diferencia de los leads (prospectos), los clientes tienen un historial de visitas y pueden hacer nuevas reservaciones.
          Cuando un lead asiste a su primera reservación, se convierte automáticamente en cliente.`,
        highlightText: 'lead asiste a su primera reservación',
      };
    }
    return {
      title: `¿Quiénes son los ${terminology.patients}?`,
      description: `Los ${terminology.patients.toLowerCase()} son personas que ya han tenido al menos una ${terminology.appointment.toLowerCase()} en tu clínica.
        A diferencia de los leads (prospectos), los ${terminology.patients.toLowerCase()} tienen un expediente clínico, historial de visitas y pueden agendar ${terminology.appointments.toLowerCase()} de seguimiento.
        Cuando un lead asiste a su primera ${terminology.appointment.toLowerCase()}, se convierte automáticamente en ${terminology.patient.toLowerCase()}.`,
      highlightText: `lead asiste a su primera ${terminology.appointment.toLowerCase()}`,
    };
  }, [vertical, terminology]);

  return (
    <PageWrapper
      title={terminology.patients}
      subtitle={selectedBranch ? `${terminology.patients} en ${selectedBranch.name}` : `Gestión de ${terminology.patients.toLowerCase()}`}
      actions={
        <Button leftIcon={icons.plus} onClick={() => setShowNewPatientModal(true)}>
          {t('newPatient')}
        </Button>
      }
    >
      {/* Hero Section - Explica qué son los Pacientes/Clientes */}
      <div className="mb-8 p-6 bg-gradient-to-br from-emerald-50 via-teal-50/30 to-cyan-50/50 rounded-2xl border border-emerald-200/60">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
            <span className="text-white">{icons.heart}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              {heroContent.title}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              {heroContent.description}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Patients */}
        <motion.div
          variants={cardHoverVariants}
          initial="rest"
          whileHover="hover"
          className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <span className="text-slate-600">{icons.users}</span>
            </div>
            <Badge variant="default" size="sm">Total</Badge>
          </div>
          <div className="text-2xl font-bold text-slate-800">{counts.all}</div>
          <p className="text-xs text-slate-500 mt-1">{terminology.patients} registrados</p>
        </motion.div>

        {/* Active Patients */}
        <motion.div
          variants={cardHoverVariants}
          initial="rest"
          whileHover="hover"
          className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-200/60 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <span className="text-lg">✅</span>
            </div>
            <Badge variant="success" size="sm">Activos</Badge>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{counts.active}</div>
          <p className="text-xs text-emerald-600 mt-1">{vertical === 'restaurant' ? 'Clientes frecuentes' : 'Con tratamiento activo'}</p>
        </motion.div>

        {/* Inactive Patients */}
        <motion.div
          variants={cardHoverVariants}
          initial="rest"
          whileHover="hover"
          className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-200/60 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <span className="text-lg">⏸️</span>
            </div>
            <Badge variant="warning" size="sm">Inactivos</Badge>
          </div>
          <div className="text-2xl font-bold text-amber-700">{counts.inactive}</div>
          <p className="text-xs text-amber-600 mt-1">Sin {terminology.appointments.toLowerCase()} recientes</p>
        </motion.div>

        {/* Archived Patients */}
        <motion.div
          variants={cardHoverVariants}
          initial="rest"
          whileHover="hover"
          className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-slate-200 rounded-lg">
              <span className="text-lg">📁</span>
            </div>
            <Badge variant="default" size="sm">Archivados</Badge>
          </div>
          <div className="text-2xl font-bold text-slate-600">{counts.archived}</div>
          <p className="text-xs text-slate-500 mt-1">Expedientes cerrados</p>
        </motion.div>
      </div>

      {/* Tabs - Premium Design */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200',
              statusFilter === tab.key
                ? `${tab.bgColor} ${tab.color} shadow-sm ring-1 ring-slate-200/50`
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            )}
          >
            <span className="text-base">{tab.emoji}</span>
            <span>{tab.label}</span>
            <span className={cn(
              'ml-1 px-2 py-0.5 rounded-full text-xs font-semibold',
              statusFilter === tab.key
                ? 'bg-white/80 text-slate-700'
                : 'bg-slate-100 text-slate-500'
            )}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchInput
          placeholder={`Buscar por nombre, teléfono o número de ${terminology.patient.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Patients List */}
      <Card variant="bordered" className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-2xl flex items-center justify-center">
                <span className="text-4xl">💚</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                {search ? 'Sin resultados' : `No hay ${terminology.patients.toLowerCase()} registrados`}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                {search
                  ? `No se encontraron ${terminology.patients.toLowerCase()} con esos criterios de búsqueda`
                  : `Los ${terminology.patients.toLowerCase()} aparecerán aquí cuando un lead asista a su primera ${terminology.appointment.toLowerCase()} o los registres manualmente.`
                }
              </p>
              {!search && (
                <Button leftIcon={icons.plus} onClick={() => setShowNewPatientModal(true)}>
                  Agregar Primer {terminology.patient}
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPatients.map((patient) => (
                <motion.div
                  key={patient.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => handlePatientClick(patient)}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50/80 cursor-pointer transition-all duration-200 group"
                >
                  {/* Avatar */}
                  <Avatar name={`${patient.first_name} ${patient.last_name}`} size="lg" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-slate-900 truncate">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <Badge size="sm" variant="success">Paciente</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span>{formatPhone(patient.phone)}</span>
                      {patient.date_of_birth && (
                        <span className="text-slate-400">• {calculateAge(patient.date_of_birth)} años</span>
                      )}
                    </div>
                  </div>

                  {/* Branch */}
                  <div className="hidden md:block text-sm text-slate-500">
                    {patient.preferred_branch_id ? (selectedBranch?.name || 'Sucursal asignada') : 'Sin sucursal'}
                  </div>

                  {/* Status */}
                  <Badge
                    variant={
                      patient.status === 'active' ? 'success' :
                      patient.status === 'inactive' ? 'warning' :
                      'default'
                    }
                    size="sm"
                  >
                    {patient.status === 'active' ? '✅ Activo' :
                     patient.status === 'inactive' ? '⏸️ Inactivo' :
                     '📁 Archivado'}
                  </Badge>

                  {/* Time */}
                  <div className="text-xs text-slate-400 whitespace-nowrap">
                    {formatRelativeTime(patient.created_at)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleCallClick(e, patient)}
                      className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Llamar"
                    >
                      {icons.phone}
                    </button>
                    <button
                      onClick={(e) => handleMessageClick(e, patient)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Enviar mensaje"
                    >
                      {icons.message}
                    </button>
                    <button
                      onClick={(e) => handleCalendarClick(e, patient)}
                      className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title={`Ver/Agendar ${terminology.appointment.toLowerCase()}`}
                    >
                      {icons.calendar}
                    </button>
                  </div>

                  {/* Arrow indicator */}
                  <span className="text-slate-300 group-hover:text-slate-400 transition-colors">
                    {icons.arrowRight}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Detail Panel (Apple-style slide-over) */}
      <AnimatePresence>
        {showDetailPanel && selectedPatient && (
          <>
            {/* Backdrop */}
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => {
                setShowDetailPanel(false);
                setSelectedPatient(null);
              }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />

            {/* Panel */}
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Detalle del {terminology.patient}</h2>
                  <button
                    onClick={() => {
                      setShowDetailPanel(false);
                      setSelectedPatient(null);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {icons.close}
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* Patient Header */}
                <motion.div
                  custom={0}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center gap-4"
                >
                  <Avatar name={`${selectedPatient.first_name} ${selectedPatient.last_name}`} size="xl" />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </h3>
                    <p className="text-slate-500 text-sm">{selectedPatient.phone}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant={
                          selectedPatient.status === 'active' ? 'success' :
                          selectedPatient.status === 'inactive' ? 'warning' :
                          'default'
                        }
                        size="sm"
                      >
                        {selectedPatient.status === 'active' ? '✅ Activo' :
                         selectedPatient.status === 'inactive' ? '⏸️ Inactivo' :
                         '📁 Archivado'}
                      </Badge>
                    </div>
                  </div>
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                  custom={1}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-3 gap-3"
                >
                  <button
                    onClick={(e) => handleCallClick(e, selectedPatient)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <div className="text-green-600">{icons.phone}</div>
                    <span className="text-xs font-medium text-green-700">Llamar</span>
                  </button>
                  <button
                    onClick={(e) => handleMessageClick(e, selectedPatient)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <div className="text-blue-600">{icons.message}</div>
                    <span className="text-xs font-medium text-blue-700">Mensaje</span>
                  </button>
                  <button
                    onClick={(e) => handleCalendarClick(e, selectedPatient)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors"
                  >
                    <div className="text-purple-600">{icons.calendar}</div>
                    <span className="text-xs font-medium text-purple-700">Agendar</span>
                  </button>
                </motion.div>

                {/* Contact Info */}
                <motion.div
                  custom={2}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="bg-slate-50 rounded-xl p-4 space-y-3"
                >
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    {icons.user}
                    Información de Contacto
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Teléfono</span>
                      <span className="font-medium text-slate-900">{formatPhone(selectedPatient.phone)}</span>
                    </div>
                    {selectedPatient.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Email</span>
                        <span className="font-medium text-slate-900">{selectedPatient.email}</span>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Personal Info */}
                <motion.div
                  custom={3}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="bg-slate-50 rounded-xl p-4 space-y-3"
                >
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    {icons.clipboardList}
                    Información Personal
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedPatient.date_of_birth && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Edad</span>
                        <span className="font-medium text-slate-900">{calculateAge(selectedPatient.date_of_birth)} años</span>
                      </div>
                    )}
                    {selectedPatient.gender && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Género</span>
                        <span className="font-medium text-slate-900">
                          {selectedPatient.gender === 'male' ? 'Masculino' :
                           selectedPatient.gender === 'female' ? 'Femenino' : 'Otro'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Registrado</span>
                      <span className="font-medium text-slate-900">{formatRelativeTime(selectedPatient.created_at)}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Notes */}
                {selectedPatient.notes && (
                  <motion.div
                    custom={4}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-slate-50 rounded-xl p-4 space-y-3"
                  >
                    <h4 className="text-sm font-semibold text-slate-700">Notas</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedPatient.notes}</p>
                  </motion.div>
                )}

                {/* Coming Soon: Historial */}
                <motion.div
                  custom={5}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 space-y-3 border border-emerald-100"
                >
                  <h4 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                    {icons.calendar}
                    Historial de {terminology.appointments}
                  </h4>
                  <p className="text-sm text-slate-500 italic">
                    El historial de {terminology.appointments.toLowerCase()} se mostrará aquí próximamente.
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{t('newPatient')}</h2>
                    <p className="text-sm text-slate-500">Registra un nuevo {terminology.patient.toLowerCase()} en el sistema</p>
                  </div>
                  <button
                    onClick={() => setShowNewPatientModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white/50 rounded-xl transition-colors"
                  >
                    {icons.close}
                  </button>
                </div>

                {/* Form - Scrollable */}
                <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">

                  {/* Section: Información Personal */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="text-emerald-500">{icons.user}</span>
                      <span>Información Personal</span>
                      <span className="text-red-500">*</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombre</label>
                        <input
                          type="text"
                          value={newPatient.first_name}
                          onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                            'transition-all duration-200 placeholder:text-slate-400'
                          )}
                          placeholder="Juan"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Apellido</label>
                        <input
                          type="text"
                          value={newPatient.last_name}
                          onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                            'transition-all duration-200 placeholder:text-slate-400'
                          )}
                          placeholder="Pérez"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de Nacimiento</label>
                        <input
                          type="date"
                          value={newPatient.date_of_birth}
                          onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                            'transition-all duration-200'
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Género</label>
                        <select
                          value={newPatient.gender}
                          onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                          className={cn(
                            'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
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
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="text-green-500">{icons.phone}</span>
                      <span>Información de Contacto</span>
                      <span className="text-red-500">*</span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          {icons.phone}
                        </span>
                        <input
                          type="tel"
                          value={newPatient.phone}
                          onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                          className={cn(
                            'w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-green-500 focus:border-transparent',
                            'transition-all duration-200 placeholder:text-slate-400'
                          )}
                          placeholder="+52 (000) 000-0000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">
                        Email <span className="text-slate-400 font-normal">(opcional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                          {icons.mail}
                        </span>
                        <input
                          type="email"
                          value={newPatient.email}
                          onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                          className={cn(
                            'w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm',
                            'focus:ring-2 focus:ring-green-500 focus:border-transparent',
                            'transition-all duration-200 placeholder:text-slate-400'
                          )}
                          placeholder="paciente@ejemplo.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section: Notas */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </span>
                      <span>Notas Adicionales</span>
                      <span className="text-slate-400 font-normal">(opcional)</span>
                    </div>

                    <textarea
                      value={newPatient.notes}
                      onChange={(e) => setNewPatient({ ...newPatient, notes: e.target.value })}
                      rows={3}
                      className={cn(
                        'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm',
                        'focus:ring-2 focus:ring-slate-400 focus:border-transparent',
                        'transition-all duration-200 resize-none placeholder:text-slate-400'
                      )}
                      placeholder="Alergias, condiciones médicas, información relevante..."
                    />
                  </div>

                  {/* Summary Card */}
                  {(newPatient.first_name || newPatient.last_name || newPatient.phone) && (
                    <div className="p-4 bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Vista previa del {terminology.patient.toLowerCase()}
                      </h4>
                      <div className="flex items-center gap-4">
                        <Avatar
                          name={`${newPatient.first_name} ${newPatient.last_name}`.trim() || 'Nuevo'}
                          size="lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">
                            {newPatient.first_name || newPatient.last_name
                              ? `${newPatient.first_name} ${newPatient.last_name}`.trim()
                              : 'Sin nombre'}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-slate-500">
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
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
                  <p className="text-xs text-slate-500">
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
                          Crear {terminology.patient}
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
