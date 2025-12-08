// =====================================================
// TIS TIS PLATFORM - Settings Page
// =====================================================

'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, Button, Input, Badge, Avatar } from '@/src/shared/components/ui';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { cn } from '@/src/shared/utils';

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
  whatsapp: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
type SettingsTab = 'profile' | 'clinic' | 'notifications' | 'ai' | 'integrations' | 'security';

const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { key: 'profile', label: 'Mi Perfil', icon: icons.user },
  { key: 'clinic', label: 'Clínica', icon: icons.building },
  { key: 'notifications', label: 'Notificaciones', icon: icons.bell },
  { key: 'ai', label: 'AI Agent', icon: icons.ai },
  { key: 'integrations', label: 'Integraciones', icon: icons.whatsapp },
  { key: 'security', label: 'Seguridad', icon: icons.lock },
];

// ======================
// COMPONENT
// ======================
export default function SettingsPage() {
  const { staff, tenant, isAdmin } = useAuthContext();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  return (
    <PageWrapper title="Configuración" subtitle="Administra tu cuenta y preferencias">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card variant="bordered">
            <CardContent padding="none">
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
                <div className="flex items-center gap-6 mb-6 pb-6 border-b border-gray-100">
                  <Avatar name={staff?.display_name || 'Usuario'} size="xl" />
                  <div>
                    <h3 className="font-medium text-gray-900">{staff?.display_name}</h3>
                    <p className="text-sm text-gray-500">{staff?.email}</p>
                    <Badge variant="info" size="sm" className="mt-2">
                      {staff?.role_title || staff?.role}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nombre"
                    defaultValue={staff?.first_name}
                    placeholder="Tu nombre"
                  />
                  <Input
                    label="Apellido"
                    defaultValue={staff?.last_name}
                    placeholder="Tu apellido"
                  />
                  <Input
                    label="Email"
                    type="email"
                    defaultValue={staff?.email}
                    placeholder="tu@email.com"
                    disabled
                  />
                  <Input
                    label="Teléfono"
                    defaultValue={staff?.phone || ''}
                    placeholder="+52 (XXX) XXX-XXXX"
                  />
                  <Input
                    label="WhatsApp"
                    defaultValue={staff?.whatsapp_number || ''}
                    placeholder="+52 (XXX) XXX-XXXX"
                  />
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSave} isLoading={saving}>
                    Guardar Cambios
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clinic Tab */}
          {activeTab === 'clinic' && (
            <Card variant="bordered">
              <CardHeader title="Clínica" subtitle="Información de la clínica" />
              <CardContent>
                {!isAdmin ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No tienes permisos para editar esta sección</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Nombre de la Clínica"
                        defaultValue={tenant?.name}
                        placeholder="Nombre"
                      />
                      <Input
                        label="Razón Social"
                        defaultValue={tenant?.legal_name || ''}
                        placeholder="Razón social"
                      />
                      <Input
                        label="Email de Contacto"
                        defaultValue={tenant?.primary_contact_email || ''}
                        placeholder="contacto@clinica.com"
                      />
                      <Input
                        label="Teléfono"
                        defaultValue={tenant?.primary_contact_phone || ''}
                        placeholder="+52 (XXX) XXX-XXXX"
                      />
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button onClick={handleSave} isLoading={saving}>
                        Guardar Cambios
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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

          {/* AI Agent Tab */}
          {activeTab === 'ai' && (
            <Card variant="bordered">
              <CardHeader title="AI Agent" subtitle="Configuración del asistente virtual" />
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        {icons.ai}
                      </div>
                      <div>
                        <p className="font-medium text-purple-900">AI Agent Activo</p>
                        <p className="text-sm text-purple-700">Respondiendo automáticamente en WhatsApp</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Personalidad
                      </label>
                      <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="professional_warm">Profesional y Cálido</option>
                        <option value="professional">Profesional</option>
                        <option value="friendly">Amigable</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Longitud Máxima de Mensajes
                      </label>
                      <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="300">Corto (300 caracteres)</option>
                        <option value="500">Medio (500 caracteres)</option>
                        <option value="800">Largo (800 caracteres)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="font-medium text-gray-900 mb-3">Reglas de Escalamiento</h4>
                    <div className="space-y-3">
                      {[
                        'Cuando el paciente mencione dolor o emergencia',
                        'Cuando el paciente solicite hablar con un humano',
                        'Después de 10 mensajes sin agendar cita',
                        'Lead caliente listo para agendar',
                      ].map((rule, i) => (
                        <label key={i} className="flex items-center gap-3">
                          <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm text-gray-700">{rule}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleSave} isLoading={saving}>
                      Guardar Cambios
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <Card variant="bordered">
              <CardHeader title="Integraciones" subtitle="Conecta tus herramientas" />
              <CardContent>
                <div className="space-y-4">
                  {/* WhatsApp */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                          {icons.whatsapp}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">WhatsApp Business API</p>
                          <p className="text-sm text-gray-500">Conecta tu número de WhatsApp Business</p>
                        </div>
                      </div>
                      <Badge variant="warning">Pendiente</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Se configurará al final del setup
                    </p>
                  </div>

                  {/* n8n */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                          <span className="text-lg font-bold">n8n</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">n8n Workflows</p>
                          <p className="text-sm text-gray-500">Automatización de procesos</p>
                        </div>
                      </div>
                      <Badge variant="warning">Pendiente</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Se configurará al final del setup
                    </p>
                  </div>

                  {/* Google Calendar */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                          {icons.calendar}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Google Calendar</p>
                          <p className="text-sm text-gray-500">Sincroniza citas con tu calendario</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Conectar
                      </Button>
                    </div>
                  </div>
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
                        placeholder="••••••••"
                      />
                      <Input
                        label="Nueva Contraseña"
                        type="password"
                        placeholder="••••••••"
                      />
                      <Input
                        label="Confirmar Nueva Contraseña"
                        type="password"
                        placeholder="••••••••"
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
                          <p className="text-sm text-gray-500">Navegador web • Activa ahora</p>
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
