// =====================================================
// TIS TIS PLATFORM - Template Config Section Component
// Main section for configuring response templates
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';
import { icons } from '../shared';
import { RESPONSE_TEMPLATE_TYPES } from '../shared/config';
import { TemplateCard, type ResponseTemplate } from './TemplateCard';
import { TemplateModal, type TemplateFormData } from './TemplateModal';

// ======================
// TYPES
// ======================
interface TemplateConfigSectionProps {
  profileType: 'business' | 'personal';
  profileName: string;
  isProfileActive: boolean;
  colorScheme?: 'purple' | 'orange';
  onTemplatesChange?: (count: number) => void;
}

// ======================
// COMPONENT
// ======================
export function TemplateConfigSection({
  profileType,
  profileName,
  isProfileActive,
  colorScheme = 'purple',
  onTemplatesChange,
}: TemplateConfigSectionProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ResponseTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false); // Track if initial fetch was done

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
  };

  // Fetch templates - stable reference, doesn't depend on onTemplatesChange
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Sesión no válida');
        setHasFetched(true); // Mark as fetched even on error to prevent loops
        return;
      }

      const response = await fetch('/api/agent-profiles/templates', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener plantillas');
      }

      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates || []);
      } else {
        setError(data.error || 'Error desconocido');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('[TemplateConfig] Fetch error:', err);
    } finally {
      setIsLoading(false);
      setHasFetched(true); // Mark as fetched to prevent re-fetch loops
    }
  }, []); // No dependencies - stable reference

  // Save template
  const handleSaveTemplate = useCallback(async (data: TemplateFormData): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return false;
      }

      const method = data.id ? 'PUT' : 'POST';
      const url = data.id
        ? `/api/agent-profiles/templates/${data.id}`
        : '/api/agent-profiles/templates';

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
        await fetchTemplates();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[TemplateConfig] Save error:', err);
      return false;
    }
  }, [fetchTemplates]);

  // Delete template
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;

    setDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/agent-profiles/templates/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        await fetchTemplates();
      }
    } catch (err) {
      console.error('[TemplateConfig] Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  }, [fetchTemplates]);

  // Toggle active
  const handleToggleActive = useCallback(async (id: string, isActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`/api/agent-profiles/templates/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
      });

      setTemplates(prev =>
        prev.map(tmpl => tmpl.id === id ? { ...tmpl, is_active: isActive } : tmpl)
      );
    } catch (err) {
      console.error('[TemplateConfig] Toggle error:', err);
    }
  }, []);

  // Edit template
  const handleEdit = useCallback((template: ResponseTemplate) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  }, []);

  // Duplicate template
  const handleDuplicate = useCallback((template: ResponseTemplate) => {
    // Generate unique copy name, avoiding "(Copia) (Copia)" pattern
    let baseName = template.name;
    // Remove existing " (Copia)" or " (Copia X)" suffix
    baseName = baseName.replace(/\s*\(Copia(?:\s+\d+)?\)$/, '');

    // Find existing copies with this base name to determine next number
    const existingCopies = templates.filter(t =>
      t.name === `${baseName} (Copia)` || t.name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(Copia \\d+\\)$`))
    );

    const newName = existingCopies.length === 0
      ? `${baseName} (Copia)`
      : `${baseName} (Copia ${existingCopies.length + 1})`;

    // Create a copy without ID so it creates a new record
    const duplicatedTemplate: ResponseTemplate = {
      ...template,
      id: '', // Empty ID triggers POST instead of PUT
      name: newName,
      is_active: false, // Start as inactive to review before activating
    };
    setEditingTemplate(duplicatedTemplate);
    setIsModalOpen(true);
  }, [templates]);

  // Open new template modal
  const handleAddNew = useCallback(() => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  }, []);

  // Fetch on expand - only once when first expanded
  useEffect(() => {
    if (isExpanded && !hasFetched && !isLoading) {
      fetchTemplates();
    }
  }, [isExpanded, hasFetched, isLoading, fetchTemplates]);

  // Notify parent of template count changes
  useEffect(() => {
    onTemplatesChange?.(templates.length);
  }, [templates.length, onTemplatesChange]);

  // Calculate stats
  const activeTemplates = templates.filter(t => t.is_active);
  const existingTypes = templates.map(t => t.trigger_type);

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
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">Plantillas de Respuesta</h3>
              <p className="text-sm text-gray-500">
                {templates.length > 0
                  ? `${activeTemplates.length} plantillas activas`
                  : 'Respuestas predefinidas para situaciones comunes'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {templates.length > 0 && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#FFF5F4] text-[#FF6B5B]">
                {templates.length} plantilla{templates.length !== 1 ? 's' : ''}
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
              key="template-config-content"
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
                    <span>Cargando plantillas...</span>
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="pt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700">{error}</p>
                    <button
                      onClick={fetchTemplates}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {/* Templates List */}
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
                          <span className="font-medium text-gray-900">Plantillas de Respuesta:</span> Respuestas predefinidas
                          que tu asistente puede usar. Incluye variables como {'{nombre}'} o {'{fecha}'} que se
                          reemplazan automáticamente con datos reales.
                        </p>
                      </div>
                    </div>

                    {/* Templates Grid */}
                    {templates.length > 0 ? (
                      <div className="pt-2 space-y-3">
                        <AnimatePresence mode="popLayout">
                          {templates.map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              colorScheme={colorScheme}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onToggleActive={handleToggleActive}
                              onDuplicate={handleDuplicate}
                              isDeleting={deletingId === template.id}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="pt-4 text-center py-8">
                        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-[#FFF5F4]">
                          <svg className="w-7 h-7 text-[#FF6B5B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                          </svg>
                        </div>
                        <p className="text-gray-700 font-medium">Sin plantillas</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Crea plantillas para responder rápidamente a situaciones comunes
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
                      <span>Agregar Plantilla</span>
                    </button>

                    {/* Quick Stats - Premium cards */}
                    {templates.length > 0 && (
                      <div className="pt-2 grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50 rounded-xl text-center">
                          <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
                          <p className="text-xs text-gray-500 font-medium">Total</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl text-center">
                          <p className="text-2xl font-bold text-emerald-600">{activeTemplates.length}</p>
                          <p className="text-xs text-emerald-600/70 font-medium">Activas</p>
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

      {/* Template Modal */}
      <TemplateModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveTemplate}
        template={editingTemplate}
        colorScheme={colorScheme}
        existingTypes={existingTypes}
      />
    </>
  );
}

export default TemplateConfigSection;
