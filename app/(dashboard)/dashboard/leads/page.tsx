// =====================================================
// TIS TIS PLATFORM - Leads Page
// =====================================================

'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Avatar, SearchInput } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { supabase, ESVA_TENANT_ID } from '@/src/shared/lib/supabase';
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
};

// ======================
// FILTERS
// ======================
type FilterTab = 'all' | LeadClassification;

// ======================
// COMPONENT
// ======================
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Fetch leads
  useEffect(() => {
    async function fetchLeads() {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', ESVA_TENANT_ID)
          .order('score', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setLeads(data as Lead[]);
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, []);

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
        return (
          lead.name?.toLowerCase().includes(searchLower) ||
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
      subtitle={`${leads.length} leads en total`}
      actions={
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={icons.filter}>
            Filtros
          </Button>
          <Button leftIcon={icons.plus}>
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
        <CardContent padding="none">
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
                {search ? 'No se encontraron resultados para tu búsqueda' : 'Los leads aparecerán aquí'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {/* Avatar */}
                  <Avatar name={lead.name || lead.phone} size="lg" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {lead.name || 'Sin nombre'}
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
                    <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      {icons.phone}
                    </button>
                    <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      {icons.message}
                    </button>
                    <button className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                      {icons.calendar}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
