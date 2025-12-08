'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, UserCheck, UserX, Archive } from 'lucide-react';

interface Patient {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  date_of_birth: string | null;
  status: 'active' | 'inactive' | 'archived';
  preferred_branch?: {
    id: string;
    name: string;
  };
  assigned_dentist?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('active');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchPatients();
  }, [statusFilter, page]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/patients?${params}`);
      const data = await response.json();

      if (data.patients) {
        setPatients(data.patients);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPatients();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <UserCheck className="w-4 h-4" />;
      case 'inactive':
        return <UserX className="w-4 h-4" />;
      case 'archived':
        return <Archive className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const calculateAge = (dateOfBirth: string | null) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-tis-text-primary mb-2">Pacientes</h1>
        <p className="text-tis-text-secondary">Gestión de pacientes registrados</p>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o número de paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tis-purple focus:border-transparent"
              />
            </div>
          </form>

          {/* Filters and Actions */}
          <div className="flex gap-2">
            {/* Status Filter */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-tis-text-primary shadow-sm'
                    : 'text-tis-text-secondary hover:text-tis-text-primary'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-white text-tis-text-primary shadow-sm'
                    : 'text-tis-text-secondary hover:text-tis-text-primary'
                }`}
              >
                Activos
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  statusFilter === 'inactive'
                    ? 'bg-white text-tis-text-primary shadow-sm'
                    : 'text-tis-text-secondary hover:text-tis-text-primary'
                }`}
              >
                Inactivos
              </button>
              <button
                onClick={() => setStatusFilter('archived')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  statusFilter === 'archived'
                    ? 'bg-white text-tis-text-primary shadow-sm'
                    : 'text-tis-text-secondary hover:text-tis-text-primary'
                }`}
              >
                Archivados
              </button>
            </div>

            {/* Add Patient Button */}
            <button className="px-4 py-2 bg-gradient-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-medium">
              <Plus className="w-5 h-5" />
              Nuevo Paciente
            </button>
          </div>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-tis-purple"></div>
            <p className="mt-4 text-tis-text-secondary">Cargando pacientes...</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center">
            <UserCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-tis-text-primary mb-2">
              No hay pacientes registrados
            </h3>
            <p className="text-tis-text-secondary mb-4">
              Comienza agregando tu primer paciente
            </p>
            <button className="px-4 py-2 bg-gradient-primary text-white rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Agregar Paciente
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    No. Paciente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Edad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sucursal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dentista Asignado
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
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-tis-purple">
                        {patient.patient_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-tis-text-primary">
                            {patient.first_name} {patient.last_name}
                          </div>
                          {patient.email && (
                            <div className="text-sm text-tis-text-secondary">{patient.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-tis-text-primary">{patient.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-tis-text-primary">
                        {patient.date_of_birth ? `${calculateAge(patient.date_of_birth)} años` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-tis-text-primary">
                        {patient.preferred_branch?.name || 'Sin asignar'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-tis-text-primary">
                        {patient.assigned_dentist
                          ? `${patient.assigned_dentist.first_name} ${patient.assigned_dentist.last_name}`
                          : 'Sin asignar'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          patient.status
                        )}`}
                      >
                        {getStatusIcon(patient.status)}
                        {patient.status === 'active' ? 'Activo' : patient.status === 'inactive' ? 'Inactivo' : 'Archivado'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-tis-purple hover:text-tis-purple-dark">Ver detalle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && patients.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-tis-text-secondary">
            Mostrando {patients.length} pacientes
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={patients.length < 20}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
