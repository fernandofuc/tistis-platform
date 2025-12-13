// =====================================================
// TIS TIS PLATFORM - Settings Page
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Input, Badge, Avatar } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { ChannelConnections, AIConfiguration } from '@/src/features/settings';
import { cn } from '@/src/shared/utils';

// ======================
// PROFILE FORM STATE
// ======================
interface ProfileFormData {
  first_name: string;
  last_name: string;
  phone: string;
  whatsapp_number: string;
}

// ======================
// ICONS
// ======================
const icons = {
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  bell: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  channels: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  lock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
};

// ======================
// TABS
// ======================
type SettingsTab = 'profile' | 'notifications' | 'channels' | 'ai' | 'security';

const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { key: 'profile', label: 'Mi Perfil', icon: icons.user },
  { key: 'channels', label: 'Canales', icon: icons.channels },
  { key: 'ai', label: 'AI Agent', icon: icons.ai },
  { key: 'notifications', label: 'Notificaciones', icon: icons.bell },
  { key: 'security', label: 'Seguridad', icon: icons.lock },
];

// ======================
// ROLE LABELS
// ======================
const roleLabels: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Gerente',
  specialist: 'Especialista',
  dentist: 'Dentista',
  receptionist: 'Recepcionista',
  assistant: 'Asistente',
  staff: 'Staff',
};

// ======================
// COMPONENT
// ======================
export default function SettingsPage() {
  const { staff, updateStaff } = useAuthContext();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Profile form state - controlled inputs
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    phone: '',
    whatsapp_number: '',
  });

  // Initialize form when staff data loads
  useEffect(() => {
    if (staff) {
      setProfileForm({
        first_name: staff.first_name || '',
        last_name: staff.last_name || '',
        phone: staff.phone || '',
        whatsapp_number: staff.whatsapp_number || '',
      });
    }
  }, [staff]);

  // Handle profile form changes
  const handleProfileChange = (field: keyof ProfileFormData, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Check if form has changes
  const hasChanges = staff && (
    profileForm.first_name !== (staff.first_name || '') ||
    profileForm.last_name !== (staff.last_name || '') ||
    profileForm.phone !== (staff.phone || '') ||
    profileForm.whatsapp_number !== (staff.whatsapp_number || '')
  );

  // Save profile changes
  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const result = await updateStaff({
      first_name: profileForm.first_name || undefined,
      last_name: profileForm.last_name || undefined,
      phone: profileForm.phone || undefined,
      whatsapp_number: profileForm.whatsapp_number || undefined,
    });

    setSaving(false);

    if (result.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setSaveError(result.error || 'Error al guardar');
    }
  };

  // Generic save for other tabs (placeholder)
  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  return (
    <PageWrapper title="Configuración" subtitle="Administra tu cuenta y preferencias">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card variant="bordered">
            <CardContent className="p-0">
              <nav className="p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                      activeTab === tab.key
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <span className={cn(activeTab === tab.key && 'text-blue-600')}>
                      {tab.icon}
                    </span>
                    <span className="font-medium text-sm">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card variant="bordered">
              <CardHeader title="Mi Perfil" subtitle="Actualiza tu información personal" />
              <CardContent>
                {/* Profile Header */}
                <div className="flex items-center gap-6 mb-6 pb-6 border-b border-gray-100">
                  <Avatar
                    name={staff?.display_name || 'Usuario'}
                    src={staff?.avatar_url || undefined}
                    size="xl"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {staff?.display_name || 'Sin nombre'}
                    </h3>
                    <p className="text-sm text-gray-500">{staff?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="info" size="sm">
                        {staff?.role_title || roleLabels[staff?.role || ''] || staff?.role}
                      </Badge>
                      {staff?.is_active !== false && (
                        <Badge variant="success" size="sm">Activo</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Success/Error Messages */}
                {saveSuccess && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">Perfil actualizado correctamente</span>
                  </div>
                )}
                {saveError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">{saveError}</span>
                  </div>
                )}

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nombre"
                    value={profileForm.first_name}
                    onChange={(e) => handleProfileChange('first_name', e.target.value)}
                    placeholder="Tu nombre"
                  />
                  <Input
                    label="Apellido"
                    value={profileForm.last_name}
                    onChange={(e) => handleProfileChange('last_name', e.target.value)}
                    placeholder="Tu apellido"
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={staff?.email || ''}
                    placeholder="tu@email.com"
                    disabled
                    helperText="El email no se puede cambiar"
                  />
                  <Input
                    label="Teléfono"
                    value={profileForm.phone}
                    onChange={(e) => handleProfileChange('phone', e.target.value)}
                    placeholder="+52 (XXX) XXX-XXXX"
                  />
                  <Input
                    label="WhatsApp"
                    value={profileForm.whatsapp_number}
                    onChange={(e) => handleProfileChange('whatsapp_number', e.target.value)}
                    placeholder="+52 (XXX) XXX-XXXX"
                    helperText="Número para recibir notificaciones"
                  />
                </div>

                {/* Actions */}
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    {hasChanges ? 'Tienes cambios sin guardar' : 'Todos los cambios guardados'}
                  </p>
                  <Button
                    onClick={handleSaveProfile}
                    isLoading={saving}
                    disabled={!hasChanges}
                  >
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && <ChannelConnections />}

          {/* AI Agent Tab */}
          {activeTab === 'ai' && <AIConfiguration />}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card variant="bordered">
              <CardHeader title="Notificaciones" subtitle="Configura cómo recibir alertas" />
              <CardContent>
                <div className="space-y-6">
                  {[
                    { label: 'Leads Calientes', desc: 'Recibir notificación inmediata cuando llegue un lead caliente', key: 'hot_leads' },
                    { label: 'Nuevas Citas', desc: 'Notificar cuando se agende una nueva cita', key: 'new_appointments' },
                    { label: 'Cancelaciones', desc: 'Alertar sobre citas canceladas', key: 'cancellations' },
                    { label: 'Escalaciones', desc: 'Notificar cuando el AI escale una conversación', key: 'escalations' },
                    { label: 'Reporte Diario', desc: 'Recibir resumen diario por la mañana', key: 'daily_report' },
                    { label: 'Reporte Semanal', desc: 'Recibir resumen semanal los lunes', key: 'weekly_report' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSave} isLoading={saving}>
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <Card variant="bordered">
              <CardHeader title="Seguridad" subtitle="Protege tu cuenta" />
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-4">Cambiar Contraseña</h4>
                    <div className="space-y-4 max-w-md">
                      <Input
                        label="Contraseña Actual"
                        type="password"
                        placeholder="********"
                      />
                      <Input
                        label="Nueva Contraseña"
                        type="password"
                        placeholder="********"
                      />
                      <Input
                        label="Confirmar Nueva Contraseña"
                        type="password"
                        placeholder="********"
                      />
                      <Button onClick={handleSave} isLoading={saving}>
                        Actualizar Contraseña
                      </Button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                    <h4 className="font-medium text-gray-900 mb-4">Sesiones Activas</h4>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Esta sesión</p>
                          <p className="text-sm text-gray-500">Navegador web - Activa ahora</p>
                        </div>
                        <Badge variant="success">Actual</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
