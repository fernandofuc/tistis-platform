// =====================================================
// TIS TIS PLATFORM - New Appointment Modal
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Input } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================
interface Lead {
  id: string;
  full_name: string;
  phone: string;
}

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedDate?: Date;
  preselectedLeadId?: string;
}

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
  const { tenant } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Form state
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId || '');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');

  // Fetch leads when modal opens
  useEffect(() => {
    if (isOpen && tenant?.id) {
      fetchLeads();
    }
  }, [isOpen, tenant?.id]);

  // Set preselected date
  useEffect(() => {
    if (preselectedDate) {
      setScheduledDate(preselectedDate.toISOString().split('T')[0]);
    } else {
      setScheduledDate(new Date().toISOString().split('T')[0]);
    }
  }, [preselectedDate, isOpen]);

  // Set preselected lead
  useEffect(() => {
    if (preselectedLeadId) {
      setSelectedLeadId(preselectedLeadId);
    }
  }, [preselectedLeadId]);

  async function fetchLeads() {
    if (!tenant?.id) return;

    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, full_name, phone')
        .eq('tenant_id', tenant.id)
        .order('full_name');

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Get branch_id
      const { data: branches } = await supabase
        .from('branches')
        .select('id')
        .eq('tenant_id', tenant.id)
        .limit(1);

      const branchId = branches?.[0]?.id;
      if (!branchId) {
        throw new Error('No branch found for this tenant');
      }

      // Create scheduled_at datetime
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);

      const { error: insertError } = await supabase
        .from('appointments')
        .insert({
          tenant_id: tenant.id,
          branch_id: branchId,
          lead_id: selectedLeadId || null,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: parseInt(duration),
          status: 'scheduled',
          notes: notes || null,
        });

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
    setScheduledDate(new Date().toISOString().split('T')[0]);
    setScheduledTime('09:00');
    setDuration('30');
    setNotes('');
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nueva Cita"
      subtitle="Agenda una nueva cita con un cliente"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            Crear Cita
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Lead Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cliente
          </label>
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loadingLeads}
          >
            <option value="">Seleccionar cliente (opcional)</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.full_name || lead.phone}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha *
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hora *
          </label>
          <input
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duracion
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="15">15 minutos</option>
            <option value="30">30 minutos</option>
            <option value="45">45 minutos</option>
            <option value="60">1 hora</option>
            <option value="90">1.5 horas</option>
            <option value="120">2 horas</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notas adicionales sobre la cita..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
