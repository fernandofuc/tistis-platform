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

  // Colors
  const colors = colorScheme === 'purple'
    ? {
        gradient: 'from-purple-50 to-indigo-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        bg: 'bg-purple-100',
        button: 'bg-purple-600 hover:bg-purple-700',
        icon: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-700',
      }
    : {
        gradient: 'from-orange-50 to-amber-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        bg: 'bg-orange-100',
        button: 'bg-orange-600 hover:bg-orange-700',
        icon: 'text-orange-600',
        badge: 'bg-orange-100 text-orange-700',
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
        'bg-gradient-to-r rounded-2xl border overflow-hidden shadow-sm',
        colors.gradient,
        colors.border
      )}>
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', colors.bg)}>
              {icons.sparkles}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-slate-900">Prompt Inicial</h3>
              <p className="text-sm text-slate-500">
                {instructions.length > 0
                  ? `${activeInstructions.length} instrucciones activas • ${inPromptCount}/5 en prompt`
                  : 'Configura el comportamiento de tu asistente'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {inPromptCount >= 5 && (
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                Límite alcanzado
              </span>
            )}
            <motion.span
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-slate-400"
            >
              {icons.chevronDown}
            </motion.span>
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
              <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                {/* Loading State */}
                {isLoading && (
                  <div className="pt-4 flex items-center justify-center gap-2 text-slate-500">
                    {icons.spinner}
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
                    {/* Info Banner */}
                    <div className="pt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Instrucciones del Prompt Inicial:</span> Define cómo
                        debe comportarse tu asistente. Las instrucciones marcadas como &quot;En Prompt&quot; se
                        incluyen directamente en el prompt del agente (máximo 5).
                      </p>
                    </div>

                    {/* Search and Filters - Only shown with 4+ instructions */}
                    {showSearchAndFilter && (
                      <div className="pt-3 space-y-3">
                        {/* Search Input */}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {icons.search || (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            )}
                          </span>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar instrucciones..."
                            className={cn(
                              'w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl',
                              'text-sm text-slate-900 placeholder:text-slate-400',
                              'focus:ring-2 focus:border-transparent transition-all',
                              colorScheme === 'purple' ? 'focus:ring-purple-500' : 'focus:ring-orange-500'
                            )}
                          />
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {icons.x}
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
                                  ? colorScheme === 'purple'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-orange-600 text-white'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                              )}
                            >
                              {label} ({count})
                            </button>
                          ))}
                        </div>

                        {/* Active filters summary */}
                        {(searchQuery || filterStatus !== 'all') && (
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>
                              Mostrando {filteredInstructions.length} de {instructions.length} instrucciones
                            </span>
                            {(searchQuery || filterStatus !== 'all') && (
                              <button
                                onClick={() => {
                                  setSearchQuery('');
                                  setFilterStatus('all');
                                }}
                                className={cn(
                                  'text-xs font-medium hover:underline',
                                  colorScheme === 'purple' ? 'text-purple-600' : 'text-orange-600'
                                )}
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
                          <p className="text-slate-500 text-sm">
                            No se encontraron instrucciones con los filtros actuales
                          </p>
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setFilterStatus('all');
                            }}
                            className={cn(
                              'mt-2 text-sm font-medium hover:underline',
                              colorScheme === 'purple' ? 'text-purple-600' : 'text-orange-600'
                            )}
                          >
                            Limpiar filtros
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="pt-4 text-center py-8">
                        <div className={cn(
                          'w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center',
                          colors.bg
                        )}>
                          {icons.documentText}
                        </div>
                        <p className="text-slate-600 font-medium">Sin instrucciones</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Agrega instrucciones para personalizar el comportamiento de tu asistente
                        </p>
                      </div>
                    )}

                    {/* Add Button */}
                    <button
                      onClick={handleAddNew}
                      className={cn(
                        'w-full mt-4 px-4 py-3 rounded-xl font-medium text-white',
                        'flex items-center justify-center gap-2 transition-all shadow-lg',
                        colors.button
                      )}
                    >
                      {icons.plus || '+'}
                      <span>Agregar Instrucción</span>
                    </button>

                    {/* Quick Stats */}
                    {instructions.length > 0 && (
                      <div className="pt-2 grid grid-cols-3 gap-3">
                        <div className="p-3 bg-white rounded-xl border border-slate-100 text-center">
                          <p className="text-2xl font-bold text-slate-900">{instructions.length}</p>
                          <p className="text-xs text-slate-500">Total</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100 text-center">
                          <p className="text-2xl font-bold text-emerald-600">{activeInstructions.length}</p>
                          <p className="text-xs text-slate-500">Activas</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100 text-center">
                          <p className={cn(
                            'text-2xl font-bold',
                            inPromptCount >= 5 ? 'text-amber-600' : 'text-blue-600'
                          )}>
                            {inPromptCount}/5
                          </p>
                          <p className="text-xs text-slate-500">En Prompt</p>
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
