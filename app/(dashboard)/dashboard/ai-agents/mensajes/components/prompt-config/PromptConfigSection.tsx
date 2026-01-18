// =====================================================
// TIS TIS PLATFORM - Prompt Config Section Component
// Main section for configuring prompt instructions
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';
import { icons } from '../shared';
import { PROMPT_INSTRUCTION_TYPES } from '../shared/config';
import { InstructionCard, type Instruction } from './InstructionCard';
import { InstructionModal, type InstructionFormData } from './InstructionModal';

// ======================
// TYPES
// ======================
interface PromptConfigSectionProps {
  profileType: 'business' | 'personal';
  profileName: string;
  isProfileActive: boolean;
  colorScheme?: 'purple' | 'orange';
  onInstructionsChange?: (count: number) => void;
}

// ======================
// COMPONENT
// ======================
export function PromptConfigSection({
  profileType,
  profileName,
  isProfileActive,
  colorScheme = 'purple',
  onInstructionsChange,
}: PromptConfigSectionProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false); // Track if initial fetch was done
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstruction, setEditingInstruction] = useState<Instruction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search and filter state (only shown with 4+ instructions)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'in_prompt'>('all');

  // Colors - TIS TIS Design System (coral primary)
  const colors = {
    // Section styling
    sectionBg: 'bg-white',
    border: 'border-gray-200',
    // Primary coral color
    primary: '#FF6B5B',
    primaryLight: '#FFF5F4',
    button: 'bg-[#FF6B5B] hover:bg-[#e55a4a]',
    // Icon container
    iconBg: 'bg-[#FFF5F4]',
    iconColor: 'text-[#FF6B5B]',
    // Badge
    badge: 'bg-[#FFF5F4] text-[#FF6B5B]',
    // Text
    text: 'text-[#FF6B5B]',
    // Stats
    statBorder: 'border-gray-100',
  };

  // Fetch instructions
  const fetchInstructions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Sesión no válida');
        setHasFetched(true); // Mark as fetched even on error to prevent infinite loop
        return;
      }

      const response = await fetch(`/api/agent-profiles/instructions?profile_type=${profileType}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener instrucciones');
      }

      const data = await response.json();
      if (data.success) {
        setInstructions(data.instructions || []);
        onInstructionsChange?.(data.instructions?.length || 0);
      } else {
        setError(data.error || 'Error desconocido');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('[PromptConfig] Fetch error:', err);
    } finally {
      setIsLoading(false);
      setHasFetched(true); // Mark as fetched after completion
    }
  }, [profileType, onInstructionsChange]);

  // Save instruction
  const handleSaveInstruction = useCallback(async (data: InstructionFormData): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return false;
      }

      const method = data.id ? 'PUT' : 'POST';
      const url = data.id
        ? `/api/agent-profiles/instructions/${data.id}`
        : '/api/agent-profiles/instructions';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      if (result.success) {
        await fetchInstructions();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PromptConfig] Save error:', err);
      return false;
    }
  }, [fetchInstructions]);

  // Delete instruction
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar esta instrucción?')) return;

    setDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/agent-profiles/instructions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        await fetchInstructions();
      }
    } catch (err) {
      console.error('[PromptConfig] Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  }, [fetchInstructions]);

  // Toggle active
  const handleToggleActive = useCallback(async (id: string, isActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`/api/agent-profiles/instructions/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
      });

      setInstructions(prev =>
        prev.map(inst => inst.id === id ? { ...inst, is_active: isActive } : inst)
      );
    } catch (err) {
      console.error('[PromptConfig] Toggle error:', err);
    }
  }, []);

  // Toggle include in prompt
  const handleToggleIncludeInPrompt = useCallback(async (id: string, include: boolean) => {
    // Check limit: max 5 with include_in_prompt
    if (include) {
      const currentIncluded = instructions.filter(i => i.include_in_prompt && i.id !== id).length;
      if (currentIncluded >= 5) {
        alert('Máximo 5 instrucciones pueden incluirse en el prompt inicial');
        return;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`/api/agent-profiles/instructions/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ include_in_prompt: include }),
      });

      setInstructions(prev =>
        prev.map(inst => inst.id === id ? { ...inst, include_in_prompt: include } : inst)
      );
    } catch (err) {
      console.error('[PromptConfig] Toggle include error:', err);
    }
  }, [instructions]);

  // Edit instruction
  const handleEdit = useCallback((instruction: Instruction) => {
    setEditingInstruction(instruction);
    setIsModalOpen(true);
  }, []);

  // Open new instruction modal
  const handleAddNew = useCallback(() => {
    setEditingInstruction(null);
    setIsModalOpen(true);
  }, []);

  // Fetch on expand - only fetch once when first expanded
  useEffect(() => {
    if (isExpanded && !hasFetched && !isLoading) {
      fetchInstructions();
    }
  }, [isExpanded, hasFetched, isLoading, fetchInstructions]);

  // Calculate stats
  const activeInstructions = instructions.filter(i => i.is_active);
  const inPromptCount = instructions.filter(i => i.include_in_prompt).length;
  const existingTypes = instructions.map(i => i.instruction_type);

  // Filter and search instructions
  const filteredInstructions = instructions.filter(instruction => {
    // Search filter
    const matchesSearch = !searchQuery ||
      instruction.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instruction.instruction.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instruction.instruction_type.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && instruction.is_active) ||
      (filterStatus === 'inactive' && !instruction.is_active) ||
      (filterStatus === 'in_prompt' && instruction.include_in_prompt);

    return matchesSearch && matchesStatus;
  });

  // Show search/filter UI only when there are 4+ instructions
  const showSearchAndFilter = instructions.length >= 4;

  return (
    <>
      <div className={cn(
        'bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow'
      )}>
        {/* Header - Premium Apple-style */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors active:scale-[0.995]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FFF5F4]">
              <svg className="w-5 h-5 text-[#FF6B5B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">Prompt Inicial</h3>
              <p className="text-sm text-gray-500">
                {instructions.length > 0
                  ? `${activeInstructions.length} instrucciones activas • ${inPromptCount}/5 en prompt`
                  : 'Configura el comportamiento de tu asistente'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {inPromptCount >= 5 && (
              <span className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-600 rounded-full border border-amber-200">
                Límite alcanzado
              </span>
            )}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="p-1 rounded-full bg-gray-100"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </div>
        </button>

        {/* Expandable Content */}
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              key="prompt-config-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
                {/* Loading State */}
                {isLoading && (
                  <div className="pt-4 flex items-center justify-center gap-2 text-gray-500">
                    <svg className="w-5 h-5 animate-spin text-[#FF6B5B]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Cargando instrucciones...</span>
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="pt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                      onClick={fetchInstructions}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {/* Instructions List */}
                {!isLoading && !error && (
                  <>
                    {/* Info Banner - Premium style */}
                    <div className="pt-4 p-4 bg-gradient-to-r from-[#FFF5F4] to-white border border-[#FF6B5B]/10 rounded-xl">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 p-1.5 rounded-lg bg-white shadow-sm">
                          <svg className="w-4 h-4 text-[#FF6B5B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          <span className="font-medium text-gray-900">Instrucciones del Prompt Inicial:</span> Define cómo
                          debe comportarse tu asistente. Las instrucciones marcadas como &quot;En Prompt&quot; se
                          incluyen directamente en el prompt del agente (máximo 5).
                        </p>
                      </div>
                    </div>

                    {/* Search and Filters - Only shown with 4+ instructions */}
                    {showSearchAndFilter && (
                      <div className="pt-3 space-y-3">
                        {/* Search Input */}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </span>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar instrucciones..."
                            className={cn(
                              'w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl',
                              'text-sm text-gray-900 placeholder:text-gray-400',
                              'focus:ring-2 focus:ring-[#FF6B5B]/30 focus:border-[#FF6B5B] transition-all'
                            )}
                          />
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Filter Pills */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'all', label: 'Todas', count: instructions.length },
                            { key: 'active', label: 'Activas', count: activeInstructions.length },
                            { key: 'inactive', label: 'Inactivas', count: instructions.length - activeInstructions.length },
                            { key: 'in_prompt', label: 'En Prompt', count: inPromptCount },
                          ].map(({ key, label, count }) => (
                            <button
                              key={key}
                              onClick={() => setFilterStatus(key as typeof filterStatus)}
                              className={cn(
                                'px-3 py-1.5 text-xs font-medium rounded-full transition-all',
                                filterStatus === key
                                  ? 'bg-[#FF6B5B] text-white shadow-sm'
                                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                              )}
                            >
                              {label} ({count})
                            </button>
                          ))}
                        </div>

                        {/* Active filters summary */}
                        {(searchQuery || filterStatus !== 'all') && (
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              Mostrando {filteredInstructions.length} de {instructions.length} instrucciones
                            </span>
                            {(searchQuery || filterStatus !== 'all') && (
                              <button
                                onClick={() => {
                                  setSearchQuery('');
                                  setFilterStatus('all');
                                }}
                                className="text-xs font-medium text-[#FF6B5B] hover:underline"
                              >
                                Limpiar filtros
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Instructions Grid */}
                    {instructions.length > 0 ? (
                      filteredInstructions.length > 0 ? (
                        <div className="pt-2 space-y-3">
                          <AnimatePresence mode="popLayout">
                            {filteredInstructions
                              .sort((a, b) => b.priority - a.priority)
                              .map((instruction) => (
                                <InstructionCard
                                  key={instruction.id}
                                  instruction={instruction}
                                  colorScheme={colorScheme}
                                  onEdit={handleEdit}
                                  onDelete={handleDelete}
                                  onToggleActive={handleToggleActive}
                                  onToggleIncludeInPrompt={handleToggleIncludeInPrompt}
                                  isDeleting={deletingId === instruction.id}
                                />
                              ))}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <div className="pt-4 text-center py-6">
                          <p className="text-gray-500 text-sm">
                            No se encontraron instrucciones con los filtros actuales
                          </p>
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setFilterStatus('all');
                            }}
                            className="mt-2 text-sm font-medium text-[#FF6B5B] hover:underline"
                          >
                            Limpiar filtros
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="pt-4 text-center py-8">
                        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-[#FFF5F4]">
                          <svg className="w-7 h-7 text-[#FF6B5B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </div>
                        <p className="text-gray-700 font-medium">Sin instrucciones</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Agrega instrucciones para personalizar el comportamiento de tu asistente
                        </p>
                      </div>
                    )}

                    {/* Add Button - Premium style */}
                    <button
                      onClick={handleAddNew}
                      className={cn(
                        'w-full mt-4 px-4 py-3.5 rounded-xl font-medium text-white',
                        'flex items-center justify-center gap-2 transition-all',
                        'bg-[#FF6B5B] hover:bg-[#e55a4a] shadow-lg shadow-[#FF6B5B]/25',
                        'active:scale-[0.98]'
                      )}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span>Agregar Instrucción</span>
                    </button>

                    {/* Quick Stats - Premium cards */}
                    {instructions.length > 0 && (
                      <div className="pt-2 grid grid-cols-3 gap-3">
                        <div className="p-3 bg-gray-50 rounded-xl text-center">
                          <p className="text-2xl font-bold text-gray-900">{instructions.length}</p>
                          <p className="text-xs text-gray-500 font-medium">Total</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl text-center">
                          <p className="text-2xl font-bold text-emerald-600">{activeInstructions.length}</p>
                          <p className="text-xs text-emerald-600/70 font-medium">Activas</p>
                        </div>
                        <div className={cn(
                          'p-3 rounded-xl text-center',
                          inPromptCount >= 5 ? 'bg-amber-50' : 'bg-[#FFF5F4]'
                        )}>
                          <p className={cn(
                            'text-2xl font-bold',
                            inPromptCount >= 5 ? 'text-amber-600' : 'text-[#FF6B5B]'
                          )}>
                            {inPromptCount}/5
                          </p>
                          <p className={cn(
                            'text-xs font-medium',
                            inPromptCount >= 5 ? 'text-amber-600/70' : 'text-[#FF6B5B]/70'
                          )}>En Prompt</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instruction Modal */}
      <InstructionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingInstruction(null);
        }}
        onSave={handleSaveInstruction}
        instruction={editingInstruction}
        colorScheme={colorScheme}
        profileType={profileType}
        existingTypes={existingTypes}
      />
    </>
  );
}

export default PromptConfigSection;
