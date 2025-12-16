// =====================================================
// TIS TIS PLATFORM - Leads Page
// =====================================================

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, Button, Badge, Avatar, SearchInput } from '@/src/shared/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { useBranch } from '@/src/shared/stores';
import { formatRelativeTime, formatPhone, cn } from '@/src/shared/utils';
import { LEAD_STATUSES, LEAD_CLASSIFICATIONS, LEAD_SOURCES } from '@/src/shared/constants';
import type { Lead, LeadClassification, LeadStatus } from '@/src/shared/types';

// ======================
// ICONS
// ======================
const icons = {
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  filter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
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
  ai: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  mail: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  tag: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  ),
};

// ======================
// ANIMATION VARIANTS (Apple-style)
// ======================
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: [0.32, 0.72, 0, 1] as const } },
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

// ======================
// FILTERS
// ======================
type FilterTab = 'all' | LeadClassification;

// ======================
// COMPONENT
// ======================
// ======================
// NEW LEAD FORM TYPE
// ======================
interface NewLeadForm {
  full_name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  notes: string;
}

const initialNewLeadForm: NewLeadForm = {
  full_name: '',
  phone: '',
  email: '',
  source: 'other', // 'manual' is not a valid source in DB constraint
  status: 'new',
  notes: '',
};

export default function LeadsPage() {
  const { tenant } = useAuthContext();
  const { selectedBranchId, selectedBranch } = useBranch();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const router = useRouter();

  // Create lead state
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState<NewLeadForm>(initialNewLeadForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ======================
  // ACTION HANDLERS
  // ======================

  // Handle call button - show confirmation alert
  const handleCallClick = useCallback((e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation(); // Prevent row click
    const leadName = lead.full_name || lead.phone;
    const confirmed = window.confirm(
      `¿Estás seguro de que quieres llamar a ${leadName}?\n\nTeléfono: ${formatPhone(lead.phone)}`
    );
    if (confirmed) {
      // Open phone dialer
      window.location.href = `tel:${lead.phone}`;
    }
  }, []);

  // Handle message button - navigate to inbox with lead context
  const handleMessageClick = useCallback((e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation(); // Prevent row click
    // Navigate to inbox with lead_id as query param to open conversation
    router.push(`/dashboard/inbox?lead_id=${lead.id}`);
  }, [router]);

  // Handle calendar button - navigate to calendar with lead context
  const handleCalendarClick = useCallback((e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation(); // Prevent row click
    // Navigate to calendar with lead_id to create/view appointment
    router.push(`/dashboard/calendario?lead_id=${lead.id}`);
  }, [router]);

  // Handle lead row click - open detail panel
  const handleLeadClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setShowDetailPanel(true);
  }, []);

  // Handle create new lead
  const handleCreateLead = useCallback(async () => {
    if (!tenant?.id) {
      setCreateError('No se encontró el tenant');
      return;
    }

    // Validate required fields
    if (!newLeadForm.phone.trim()) {
      setCreateError('El teléfono es obligatorio');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const leadData = {
        tenant_id: tenant.id,
        branch_id: selectedBranchId || null,
        phone: newLeadForm.phone.trim(),
        full_name: newLeadForm.full_name.trim() || null,
        email: newLeadForm.email.trim() || null,
        source: newLeadForm.source,
        status: newLeadForm.status,
        notes: newLeadForm.notes.trim() || null,
        classification: 'cold' as LeadClassification,
        score: 0,
      };

      const { data, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (error) throw error;

      console.log('🟢 Lead created:', data);

      // Add to list
      setLeads((prev) => [data as Lead, ...prev]);

      // Reset form and close panel
      setNewLeadForm(initialNewLeadForm);
      setShowCreatePanel(false);
    } catch (error: any) {
      console.error('🔴 Error creating lead:', error);
      setCreateError(error.message || 'Error al crear el lead');
    } finally {
      setCreating(false);
    }
  }, [tenant?.id, selectedBranchId, newLeadForm]);

  // Handle open create panel
  const handleOpenCreatePanel = useCallback(() => {
    setNewLeadForm(initialNewLeadForm);
    setCreateError(null);
    setShowCreatePanel(true);
  }, []);

  // Fetch leads
  useEffect(() => {
    async function fetchLeads() {
      // Wait for tenant to be loaded
      if (!tenant?.id) {
        console.log('🟡 Leads: No tenant yet, waiting...');
        return;
      }

      console.log('🟢 Leads: Fetching leads for tenant:', tenant.id, 'branch:', selectedBranchId || 'all');

      try {
        let query = supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', tenant.id);

        // Apply branch filter if selected
        if (selectedBranchId) {
          query = query.eq('branch_id', selectedBranchId);
        }

        const { data, error } = await query
          .order('score', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log('🟢 Leads: Fetched', data?.length, 'leads');
        setLeads(data as Lead[]);
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, [tenant?.id, selectedBranchId]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Classification filter
      if (activeTab !== 'all' && lead.classification !== activeTab) {
        return false;
      }

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const leadName = lead.full_name || '';
        return (
          leadName.toLowerCase().includes(searchLower) ||
          lead.phone.includes(search) ||
          lead.email?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [leads, activeTab, search]);

  // Count by classification
  const counts = useMemo(() => ({
    all: leads.length,
    hot: leads.filter((l) => l.classification === 'hot').length,
    warm: leads.filter((l) => l.classification === 'warm').length,
    cold: leads.filter((l) => l.classification === 'cold').length,
  }), [leads]);

  const tabs: { key: FilterTab; label: string; emoji?: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'hot', label: 'Calientes', emoji: '🔥' },
    { key: 'warm', label: 'Tibios', emoji: '🌡️' },
    { key: 'cold', label: 'Fríos', emoji: '❄️' },
  ];

  return (
    <PageWrapper
      title="Leads"
      subtitle={selectedBranch ? `${leads.length} leads en ${selectedBranch.name}` : `${leads.length} leads en total`}
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={icons.filter}>
            Filtros
          </Button>
          <Button leftIcon={icons.plus} onClick={handleOpenCreatePanel}>
            Nuevo Lead
          </Button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              activeTab === tab.key
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {tab.emoji && <span className="mr-1">{tab.emoji}</span>}
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
          placeholder="Buscar por nombre, teléfono o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Leads List */}
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
          ) : filteredLeads.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg font-medium mb-2">No hay leads</p>
              <p className="text-sm">
                {search
                  ? 'No se encontraron resultados para tu búsqueda'
                  : selectedBranch
                    ? `No hay leads asignados a ${selectedBranch.name}. Prueba seleccionando "Todas las sucursales".`
                    : 'Los leads aparecerán aquí cuando lleguen mensajes por WhatsApp'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => handleLeadClick(lead)}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* Avatar */}
                  <Avatar name={lead.full_name || lead.phone} size="lg" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {lead.full_name || 'Sin nombre'}
                      </h3>
                      <Badge variant={lead.classification as 'hot' | 'warm' | 'cold'} size="sm">
                        {lead.classification === 'hot' && '🔥'}
                        {lead.classification === 'warm' && '🌡️'}
                        {lead.classification === 'cold' && '❄️'}
                        {' '}{lead.score}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">{formatPhone(lead.phone)}</p>
                    {lead.interested_services && lead.interested_services.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lead.interested_services.slice(0, 2).map((service) => (
                          <span key={service} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {service}
                          </span>
                        ))}
                        {lead.interested_services.length > 2 && (
                          <span className="text-xs text-gray-400">
                            +{lead.interested_services.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block">
                    <Badge variant="default" size="sm">
                      {LEAD_STATUSES.find((s) => s.value === lead.status)?.label || lead.status}
                    </Badge>
                  </div>

                  {/* Source */}
                  <div className="hidden md:block text-sm text-gray-500">
                    {LEAD_SOURCES.find((s) => s.value === lead.source)?.label || lead.source}
                  </div>

                  {/* Time */}
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {formatRelativeTime(lead.created_at)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCallClick(e, lead)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Llamar"
                    >
                      {icons.phone}
                    </button>
                    <button
                      onClick={(e) => handleMessageClick(e, lead)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Enviar mensaje"
                    >
                      {icons.message}
                    </button>
                    <button
                      onClick={(e) => handleCalendarClick(e, lead)}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Ver/Agendar cita"
                    >
                      {icons.calendar}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Panel (Apple-style slide-over) */}
      <AnimatePresence>
        {showDetailPanel && selectedLead && (
          <>
            {/* Backdrop */}
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => {
                setShowDetailPanel(false);
                setSelectedLead(null);
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
              <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Detalle del Lead</h2>
                  <button
                    onClick={() => {
                      setShowDetailPanel(false);
                      setSelectedLead(null);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {icons.close}
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* Lead Header */}
                <motion.div
                  custom={0}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center gap-4"
                >
                  <Avatar name={selectedLead.full_name || selectedLead.phone} size="xl" />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {selectedLead.full_name || 'Sin nombre'}
                    </h3>
                    <p className="text-gray-500">{formatPhone(selectedLead.phone)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={selectedLead.classification as 'hot' | 'warm' | 'cold'} size="sm">
                        {selectedLead.classification === 'hot' && '🔥 Caliente'}
                        {selectedLead.classification === 'warm' && '🌡️ Tibio'}
                        {selectedLead.classification === 'cold' && '❄️ Frío'}
                      </Badge>
                      <span className="text-sm font-medium text-gray-600">
                        Score: {selectedLead.score}
                      </span>
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
                    onClick={(e) => handleCallClick(e, selectedLead)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
                  >
                    <div className="text-green-600">{icons.phone}</div>
                    <span className="text-xs font-medium text-green-700">Llamar</span>
                  </button>
                  <button
                    onClick={(e) => handleMessageClick(e, selectedLead)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <div className="text-blue-600">{icons.message}</div>
                    <span className="text-xs font-medium text-blue-700">Mensaje</span>
                  </button>
                  <button
                    onClick={(e) => handleCalendarClick(e, selectedLead)}
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
                  className="bg-gray-50 rounded-xl p-4 space-y-3"
                >
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    {icons.user}
                    Información de Contacto
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Teléfono</span>
                      <span className="font-medium text-gray-900">{formatPhone(selectedLead.phone)}</span>
                    </div>
                    {selectedLead.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Email</span>
                        <span className="font-medium text-gray-900">{selectedLead.email}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Fuente</span>
                      <span className="font-medium text-gray-900">
                        {LEAD_SOURCES.find((s) => s.value === selectedLead.source)?.label || selectedLead.source}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Estado</span>
                      <Badge variant="default" size="sm">
                        {LEAD_STATUSES.find((s) => s.value === selectedLead.status)?.label || selectedLead.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Creado</span>
                      <span className="font-medium text-gray-900">{formatRelativeTime(selectedLead.created_at)}</span>
                    </div>
                  </div>
                </motion.div>

                {/* Interested Services */}
                {selectedLead.interested_services && selectedLead.interested_services.length > 0 && (
                  <motion.div
                    custom={3}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-gray-50 rounded-xl p-4 space-y-3"
                  >
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      {icons.tag}
                      Servicios de Interés
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedLead.interested_services.map((service) => (
                        <span
                          key={service}
                          className="px-3 py-1 bg-white rounded-full text-sm text-gray-700 border border-gray-200"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* AI Extracted Info */}
                {selectedLead.source_details && Object.keys(selectedLead.source_details).length > 0 && (
                  <motion.div
                    custom={4}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 space-y-3 border border-indigo-100"
                  >
                    <h4 className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
                      {icons.ai}
                      Información Extraída por IA
                    </h4>
                    <div className="space-y-2 text-sm">
                      {Object.entries(selectedLead.source_details).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-2">
                          <span className="text-indigo-600 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-gray-900 text-right">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Notes */}
                {selectedLead.notes && (
                  <motion.div
                    custom={5}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-gray-50 rounded-xl p-4 space-y-3"
                  >
                    <h4 className="text-sm font-semibold text-gray-700">Notas</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedLead.notes}</p>
                  </motion.div>
                )}

                {/* Tags */}
                {selectedLead.tags && selectedLead.tags.length > 0 && (
                  <motion.div
                    custom={6}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-wrap gap-2"
                  >
                    {selectedLead.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </motion.div>
                )}

                {/* Timestamps */}
                <motion.div
                  custom={7}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-400"
                >
                  {selectedLead.last_contact_at && (
                    <p>Último contacto: {formatRelativeTime(selectedLead.last_contact_at)}</p>
                  )}
                  {selectedLead.next_followup_at && (
                    <p>Próximo seguimiento: {formatRelativeTime(selectedLead.next_followup_at)}</p>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Lead Panel (Premium Design - Slide-over) */}
      <AnimatePresence>
        {showCreatePanel && (
          <>
            {/* Backdrop */}
            <motion.div
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => setShowCreatePanel(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            />

            {/* Panel */}
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              {/* Header with Gradient */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 px-6 py-4 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Nuevo Lead</h2>
                    <p className="text-sm text-gray-500">Registra un nuevo prospecto</p>
                  </div>
                  <button
                    onClick={() => setShowCreatePanel(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-xl transition-colors"
                  >
                    {icons.close}
                  </button>
                </div>
              </div>

              {/* Form Content - Scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Error Message */}
                {createError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
                  >
                    <div className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-800">Error al crear el lead</p>
                      <p className="text-sm text-red-600 mt-0.5">{createError}</p>
                    </div>
                  </motion.div>
                )}

                {/* Section: Información del Contacto */}
                <motion.div
                  custom={0}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <span className="text-blue-500">{icons.user}</span>
                    <span>Información del Contacto</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Nombre completo</label>
                    <input
                      type="text"
                      value={newLeadForm.full_name}
                      onChange={(e) => setNewLeadForm(prev => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Juan Pérez"
                      className={cn(
                        'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                        'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'transition-all duration-200 placeholder:text-gray-400'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        {icons.phone}
                      </span>
                      <input
                        type="tel"
                        value={newLeadForm.phone}
                        onChange={(e) => setNewLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+52 55 1234 5678"
                        className={cn(
                          'w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm',
                          'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                          'transition-all duration-200 placeholder:text-gray-400'
                        )}
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
                        value={newLeadForm.email}
                        onChange={(e) => setNewLeadForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="juan@ejemplo.com"
                        className={cn(
                          'w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm',
                          'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                          'transition-all duration-200 placeholder:text-gray-400'
                        )}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Section: Clasificación */}
                <motion.div
                  custom={1}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <span className="text-purple-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </span>
                    <span>Clasificación</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Fuente</label>
                      <select
                        value={newLeadForm.source}
                        onChange={(e) => setNewLeadForm(prev => ({ ...prev, source: e.target.value }))}
                        className={cn(
                          'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                          'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                          'transition-all duration-200 appearance-none bg-white',
                          'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                        )}
                      >
                        {LEAD_SOURCES.map((source) => (
                          <option key={source.value} value={source.value}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Estado</label>
                      <select
                        value={newLeadForm.status}
                        onChange={(e) => setNewLeadForm(prev => ({ ...prev, status: e.target.value }))}
                        className={cn(
                          'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                          'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                          'transition-all duration-200 appearance-none bg-white',
                          'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat'
                        )}
                      >
                        {LEAD_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </motion.div>

                {/* Section: Notas */}
                <motion.div
                  custom={2}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
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
                    value={newLeadForm.notes}
                    onChange={(e) => setNewLeadForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Información adicional sobre el lead, intereses, necesidades..."
                    rows={3}
                    className={cn(
                      'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm',
                      'focus:ring-2 focus:ring-gray-400 focus:border-transparent',
                      'transition-all duration-200 resize-none placeholder:text-gray-400'
                    )}
                  />
                </motion.div>

                {/* Preview Card */}
                {(newLeadForm.full_name || newLeadForm.phone) && (
                  <motion.div
                    custom={3}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl space-y-3"
                  >
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Vista previa del lead
                    </h4>
                    <div className="flex items-center gap-4">
                      <Avatar
                        name={newLeadForm.full_name || newLeadForm.phone || 'Nuevo'}
                        size="lg"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {newLeadForm.full_name || 'Sin nombre'}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          {newLeadForm.phone && <span>{newLeadForm.phone}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge size="sm" variant="info">
                            {LEAD_SOURCES.find(s => s.value === newLeadForm.source)?.label || 'Manual'}
                          </Badge>
                          <Badge size="sm" variant="default">
                            {LEAD_STATUSES.find(s => s.value === newLeadForm.status)?.label || 'Nuevo'}
                          </Badge>
                          {selectedBranch && (
                            <Badge size="sm" variant="warning">
                              {selectedBranch.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer with Actions */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    <span className="text-red-500">*</span> Campo requerido
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreatePanel(false)}
                      disabled={creating}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateLead}
                      disabled={creating || !newLeadForm.phone.trim()}
                    >
                      {creating ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Creando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Crear Lead
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
