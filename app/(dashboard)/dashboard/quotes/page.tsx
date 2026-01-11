'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Search,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Eye,
  MoreHorizontal,
} from 'lucide-react';

interface Quote {
  id: string;
  quote_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  valid_until: string | null;
  sent_at: string | null;
  created_at: string;
  patient?: {
    id: string;
    patient_number: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  lead?: {
    id: string;
    full_name: string | null;
    phone: string;
    classification: string;
  };
  quote_items?: {
    id: string;
    service_name: string;
    quantity: number;
    subtotal: number;
  }[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 300);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchQuotes = useCallback(async (searchValue: string, statusValue: string, pageValue: number) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pageValue.toString(),
        limit: '20',
      });

      if (statusValue !== 'all') {
        params.append('status', statusValue);
      }

      if (searchValue.trim()) {
        params.append('search', searchValue.trim());
      }

      const response = await fetch(`/api/quotes?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch quotes');
      }

      const data = await response.json();

      setQuotes(data.quotes || []);
      setPagination(data.pagination || null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Error fetching quotes:', err);
      setError(err instanceof Error ? err.message : 'Error loading quotes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes(debouncedSearch, statusFilter, page);
  }, [debouncedSearch, statusFilter, page, fetchQuotes]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: <FileText className="w-4 h-4" />,
          label: 'Borrador',
        };
      case 'sent':
        return {
          color: 'bg-blue-100 text-blue-800',
          icon: <Send className="w-4 h-4" />,
          label: 'Enviada',
        };
      case 'accepted':
        return {
          color: 'bg-green-100 text-green-800',
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'Aceptada',
        };
      case 'rejected':
        return {
          color: 'bg-red-100 text-red-800',
          icon: <XCircle className="w-4 h-4" />,
          label: 'Rechazada',
        };
      case 'expired':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: <Clock className="w-4 h-4" />,
          label: 'Expirada',
        };
      case 'cancelled':
        return {
          color: 'bg-gray-100 text-gray-600',
          icon: <Ban className="w-4 h-4" />,
          label: 'Cancelada',
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: null,
          label: status,
        };
    }
  };

  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getClientName = (quote: Quote) => {
    if (quote.patient) {
      return `${quote.patient.first_name} ${quote.patient.last_name}`;
    }
    if (quote.lead) {
      return quote.lead.full_name || 'Sin nombre';
    }
    return 'Sin asignar';
  };

  const getClientType = (quote: Quote) => {
    if (quote.patient) return 'Paciente';
    if (quote.lead) return 'Lead';
    return '';
  };

  const statusOptions = [
    { value: 'all', label: 'Todas' },
    { value: 'draft', label: 'Borradores' },
    { value: 'sent', label: 'Enviadas' },
    { value: 'accepted', label: 'Aceptadas' },
    { value: 'rejected', label: 'Rechazadas' },
    { value: 'expired', label: 'Expiradas' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-tis-text-primary mb-2">Cotizaciones</h1>
        <p className="text-tis-text-secondary">Gestion de cotizaciones y presupuestos</p>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por numero de cotizacion..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="flex gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent bg-white"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* New Quote Button */}
            <button
              onClick={() => setShowNewQuoteModal(true)}
              className="px-4 py-2.5 min-h-[44px] bg-gradient-primary text-white rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nueva Cotizacion</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => fetchQuotes(debouncedSearch, statusFilter, page)}
            className="mt-2 text-red-600 hover:text-red-800 font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Quotes Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-tis-purple"></div>
            <p className="mt-4 text-tis-text-secondary">Cargando cotizaciones...</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-tis-text-primary mb-2">
              {searchTerm ? 'No se encontraron resultados' : 'No hay cotizaciones'}
            </h3>
            <p className="text-tis-text-secondary mb-4">
              {searchTerm ? 'Intenta con otros terminos de busqueda' : 'Crea tu primera cotizacion para comenzar'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowNewQuoteModal(true)}
                className="px-4 py-2 bg-gradient-primary text-white rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nueva Cotizacion
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    No. Cotizacion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valida hasta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quotes.map((quote) => {
                  const statusConfig = getStatusConfig(quote.status);
                  return (
                    <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-tis-purple">
                          {quote.quote_number}
                        </div>
                        <div className="text-xs text-tis-text-secondary">
                          {formatDate(quote.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-tis-text-primary">
                          {getClientName(quote)}
                        </div>
                        {getClientType(quote) && (
                          <div className="text-xs text-tis-text-secondary">
                            {getClientType(quote)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-tis-text-primary">
                          {quote.quote_items?.length || 0} servicios
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-tis-text-primary">
                          {formatCurrency(quote.total, quote.currency)}
                        </div>
                        {quote.discount_amount > 0 && (
                          <div className="text-xs text-green-600">
                            -{formatCurrency(quote.discount_amount, quote.currency)} desc.
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-tis-text-primary">
                          {formatDate(quote.valid_until)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}
                        >
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-tis-purple hover:bg-tis-purple/10 active:bg-tis-purple/20 active:scale-95 rounded-lg transition-all"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:bg-gray-200 active:scale-95 rounded-lg transition-all"
                            title="Mas opciones"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && quotes.length > 0 && pagination && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-tis-text-secondary text-center sm:text-left">
            Mostrando {quotes.length} de {pagination.total} cotizaciones
            (Pagina {pagination.page} de {pagination.totalPages})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2.5 min-h-[44px] border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= (pagination?.totalPages || 1)}
              className="px-4 py-2.5 min-h-[44px] border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* New Quote Modal Placeholder */}
      {showNewQuoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-tis-text-primary">
                  Nueva Cotizacion
                </h2>
                <button
                  onClick={() => setShowNewQuoteModal(false)}
                  className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg active:scale-95 transition-all"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <NewQuoteForm
                onSuccess={() => {
                  setShowNewQuoteModal(false);
                  fetchQuotes(debouncedSearch, statusFilter, page);
                }}
                onCancel={() => setShowNewQuoteModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// New Quote Form Component
// =====================================================
interface NewQuoteFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function NewQuoteForm({ onSuccess, onCancel }: NewQuoteFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientType, setClientType] = useState<'patient' | 'lead' | 'none'>('none');
  const [patients, setPatients] = useState<Array<{ id: string; patient_number: string; first_name: string; last_name: string }>>([]);
  const [leads, setLeads] = useState<Array<{ id: string; name: string; classification: string }>>([]);
  const [formData, setFormData] = useState({
    patient_id: '',
    lead_id: '',
    valid_until: '',
    discount_percentage: 0,
    tax_percentage: 16,
    notes: '',
  });
  const [items, setItems] = useState<Array<{
    service_name: string;
    description: string;
    quantity: number;
    unit_price: number;
  }>>([{ service_name: '', description: '', quantity: 1, unit_price: 0 }]);

  // Fetch patients and leads on mount
  useEffect(() => {
    const fetchData = async () => {
      const [patientsRes, leadsRes] = await Promise.all([
        fetch('/api/patients?limit=100&status=active'),
        fetch('/api/leads?limit=100'),
      ]);

      if (patientsRes.ok) {
        const data = await patientsRes.json();
        setPatients(data.patients || []);
      }

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
      }
    };

    fetchData();
  }, []);

  const addItem = () => {
    setItems([...items, { service_name: '', description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate items
      const validItems = items.filter(item => item.service_name.trim() && item.unit_price > 0);
      if (validItems.length === 0) {
        throw new Error('Agrega al menos un servicio con nombre y precio');
      }

      // Create quote
      const quoteData: Record<string, unknown> = {
        status: 'draft',
        valid_until: formData.valid_until || null,
        discount_percentage: formData.discount_percentage,
        tax_percentage: formData.tax_percentage,
        notes: formData.notes,
      };

      if (clientType === 'patient' && formData.patient_id) {
        quoteData.patient_id = formData.patient_id;
      } else if (clientType === 'lead' && formData.lead_id) {
        quoteData.lead_id = formData.lead_id;
      }

      const quoteRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData),
      });

      if (!quoteRes.ok) {
        const errorData = await quoteRes.json();
        throw new Error(errorData.error || 'Error al crear cotizacion');
      }

      const { quote } = await quoteRes.json();

      // Add items
      for (const item of validItems) {
        await fetch(`/api/quotes/${quote.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Client Selection */}
      <div>
        <label className="block text-sm font-medium text-tis-text-primary mb-2">
          Tipo de Cliente
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="clientType"
              checked={clientType === 'none'}
              onChange={() => setClientType('none')}
              className="text-tis-purple focus:ring-tis-purple"
            />
            <span className="text-sm">Sin asignar (borrador)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="clientType"
              checked={clientType === 'patient'}
              onChange={() => setClientType('patient')}
              className="text-tis-purple focus:ring-tis-purple"
            />
            <span className="text-sm">Paciente</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="clientType"
              checked={clientType === 'lead'}
              onChange={() => setClientType('lead')}
              className="text-tis-purple focus:ring-tis-purple"
            />
            <span className="text-sm">Lead</span>
          </label>
        </div>
      </div>

      {clientType === 'patient' && (
        <div>
          <label className="block text-sm font-medium text-tis-text-primary mb-1">
            Seleccionar Paciente
          </label>
          <select
            value={formData.patient_id}
            onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
            className="w-full px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent"
          >
            <option value="">Seleccionar...</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.patient_number} - {patient.first_name} {patient.last_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {clientType === 'lead' && (
        <div>
          <label className="block text-sm font-medium text-tis-text-primary mb-1">
            Seleccionar Lead
          </label>
          <select
            value={formData.lead_id}
            onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
            className="w-full px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent"
          >
            <option value="">Seleccionar...</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name} ({lead.classification})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-tis-text-primary">
            Servicios
          </label>
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-tis-purple hover:text-tis-purple-dark flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Agregar servicio
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Nombre del servicio"
                value={item.service_name}
                onChange={(e) => updateItem(index, 'service_name', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent text-sm"
              />
              <input
                type="number"
                placeholder="Cant."
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                min="1"
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent text-sm"
              />
              <input
                type="number"
                placeholder="Precio"
                value={item.unit_price || ''}
                onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent text-sm"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg active:scale-95 transition-all"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-sm text-tis-text-secondary">
          Subtotal: ${calculateSubtotal().toFixed(2)} MXN
        </div>
      </div>

      {/* Additional Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-tis-text-primary mb-1">
            Valida hasta
          </label>
          <input
            type="date"
            value={formData.valid_until}
            onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-tis-text-primary mb-1">
            Descuento (%)
          </label>
          <input
            type="number"
            value={formData.discount_percentage}
            onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tis-text-primary mb-1">
          Notas
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent"
          placeholder="Notas adicionales..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-gradient-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Crear Cotizacion
            </>
          )}
        </button>
      </div>
    </form>
  );
}
