// =====================================================
// TIS TIS PLATFORM - Channel Connections Component
// Manages WhatsApp, Instagram, Facebook, TikTok connections
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Input } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================

type ChannelType = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';
type ConnectionStatus = 'pending' | 'configuring' | 'connected' | 'disconnected' | 'error' | 'suspended';

interface ChannelConnection {
  id: string;
  channel: ChannelType;
  status: ConnectionStatus;
  ai_enabled: boolean;
  branch_id: string | null;
  // WhatsApp fields
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token?: string;
  whatsapp_verify_token?: string;
  // Instagram fields
  instagram_page_id?: string;
  instagram_account_id?: string;
  instagram_username?: string;
  instagram_access_token?: string;
  instagram_verify_token?: string;
  // Facebook fields
  facebook_page_id?: string;
  facebook_page_name?: string;
  facebook_access_token?: string;
  facebook_verify_token?: string;
  // TikTok fields
  tiktok_client_key?: string;
  tiktok_client_secret?: string;
  tiktok_access_token?: string;
  tiktok_open_id?: string;
  tiktok_verify_token?: string;
  // Common
  webhook_secret?: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

// ======================
// ICONS
// ======================
const channelIcons: Record<ChannelType, React.ReactNode> = {
  whatsapp: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  instagram: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  facebook: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  tiktok: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
};

const channelColors: Record<ChannelType, string> = {
  whatsapp: 'bg-green-100 text-green-600',
  instagram: 'bg-pink-100 text-pink-600',
  facebook: 'bg-blue-100 text-blue-600',
  tiktok: 'bg-gray-900 text-white',
};

const channelNames: Record<ChannelType, string> = {
  whatsapp: 'WhatsApp Business',
  instagram: 'Instagram Direct',
  facebook: 'Facebook Messenger',
  tiktok: 'TikTok Messages',
};

const statusBadges: Record<ConnectionStatus, { variant: 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
  connected: { variant: 'success', label: 'Conectado' },
  pending: { variant: 'warning', label: 'Pendiente' },
  configuring: { variant: 'info', label: 'Configurando' },
  disconnected: { variant: 'warning', label: 'Desconectado' },
  error: { variant: 'danger', label: 'Error' },
  suspended: { variant: 'danger', label: 'Suspendido' },
};

// ======================
// TYPES FOR BRANCHES
// ======================
interface Branch {
  id: string;
  name: string;
  city: string;
  is_headquarters: boolean;
}

// ======================
// COMPONENT
// ======================

export function ChannelConnections() {
  const { tenant, isAdmin } = useAuthContext();
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuringChannel, setConfiguringChannel] = useState<ChannelType | null>(null);
  const [showWhatsAppSetup, setShowWhatsAppSetup] = useState(false);
  const [showInstagramSetup, setShowInstagramSetup] = useState(false);
  const [showFacebookSetup, setShowFacebookSetup] = useState(false);
  const [showTikTokSetup, setShowTikTokSetup] = useState(false);

  // Load connections and branches
  useEffect(() => {
    if (!tenant?.id) return;

    const loadData = async () => {
      setLoading(true);

      // Load connections
      const { data: connData, error: connError } = await supabase
        .from('channel_connections')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: true });

      if (!connError && connData) {
        setConnections(connData);
      }

      // Load branches
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('id, name, city, is_headquarters')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false });

      if (!branchError && branchData) {
        setBranches(branchData);
      }

      setLoading(false);
    };

    loadData();
  }, [tenant?.id]);

  // Toggle AI for a channel
  const toggleAI = async (connectionId: string, currentState: boolean) => {
    const { error } = await supabase
      .from('channel_connections')
      .update({ ai_enabled: !currentState })
      .eq('id', connectionId);

    if (!error) {
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, ai_enabled: !currentState } : c
        )
      );
    }
  };

  // Get connection for a channel
  const getConnection = (channel: ChannelType) =>
    connections.find((c) => c.channel === channel);

  // Render channel card
  const renderChannelCard = (channel: ChannelType) => {
    const connection = getConnection(channel);
    const status = connection?.status || 'pending';
    const badge = statusBadges[status];
    const isConnected = status === 'connected';

    return (
      <div
        key={channel}
        className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                channelColors[channel]
              )}
            >
              {channelIcons[channel]}
            </div>
            <div>
              <p className="font-medium text-gray-900">{channelNames[channel]}</p>
              <p className="text-sm text-gray-500">
                {isConnected
                  ? 'Recibiendo mensajes'
                  : 'Conecta para recibir mensajes'}
              </p>
            </div>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        {/* AI Toggle (only if connected) */}
        {isConnected && connection && (
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg mb-4">
            <div>
              <p className="font-medium text-gray-900 text-sm">AI Habilitado</p>
              <p className="text-xs text-gray-500">
                El asistente responde automáticamente
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={connection.ai_enabled}
                onChange={() => toggleAI(connection.id, connection.ai_enabled)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        )}

        {/* Error message */}
        {connection?.error_message && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg mb-4">
            {connection.error_message}
          </div>
        )}

        {/* Action button - Show for non-connected channels */}
        {!isConnected && (
          <Button
            variant={channel === 'whatsapp' ? 'primary' : 'outline'}
            size="sm"
            className="w-full"
            onClick={() => {
              switch (channel) {
                case 'whatsapp':
                  setShowWhatsAppSetup(true);
                  break;
                case 'instagram':
                  setShowInstagramSetup(true);
                  break;
                case 'facebook':
                  setShowFacebookSetup(true);
                  break;
                case 'tiktok':
                  setShowTikTokSetup(true);
                  break;
              }
            }}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {status === 'configuring' ? 'Continuar configuración' : 'Configurar API'}
          </Button>
        )}

        {/* Edit button for connected channels */}
        {isConnected && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400 text-center">
              Conectado desde{' '}
              {new Date(connection!.created_at).toLocaleDateString('es-MX')}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                switch (channel) {
                  case 'whatsapp':
                    setShowWhatsAppSetup(true);
                    break;
                  case 'instagram':
                    setShowInstagramSetup(true);
                    break;
                  case 'facebook':
                    setShowFacebookSetup(true);
                    break;
                  case 'tiktok':
                    setShowTikTokSetup(true);
                    break;
                }
              }}
            >
              Editar configuración
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card variant="bordered">
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card variant="bordered">
        <CardHeader
          title="Canales de Comunicación"
          subtitle="Conecta tus canales de mensajería para recibir conversaciones"
        />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['whatsapp', 'instagram', 'facebook', 'tiktok'] as ChannelType[]).map(
              renderChannelCard
            )}
          </div>

          {/* Recommendation */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Recomendación:</strong> Comienza conectando WhatsApp Business,
              que es el canal más usado por tus clientes. Luego puedes agregar
              Instagram y Facebook para capturar más leads.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Setup Modal */}
      {showWhatsAppSetup && (
        <WhatsAppSetupModal
          tenantId={tenant?.id || ''}
          branches={branches}
          existingConnection={getConnection('whatsapp') || null}
          onClose={() => setShowWhatsAppSetup(false)}
          onSuccess={(connection) => {
            setConnections((prev) => {
              const existing = prev.find(c => c.channel === 'whatsapp');
              if (existing) {
                return prev.map(c => c.channel === 'whatsapp' ? connection : c);
              }
              return [...prev, connection];
            });
            setShowWhatsAppSetup(false);
          }}
        />
      )}

      {/* Instagram Setup Modal */}
      {showInstagramSetup && (
        <InstagramSetupModal
          tenantId={tenant?.id || ''}
          branches={branches}
          existingConnection={getConnection('instagram') || null}
          onClose={() => setShowInstagramSetup(false)}
          onSuccess={(connection) => {
            setConnections((prev) => {
              const existing = prev.find(c => c.channel === 'instagram');
              if (existing) {
                return prev.map(c => c.channel === 'instagram' ? connection : c);
              }
              return [...prev, connection];
            });
            setShowInstagramSetup(false);
          }}
        />
      )}

      {/* Facebook Setup Modal */}
      {showFacebookSetup && (
        <FacebookSetupModal
          tenantId={tenant?.id || ''}
          branches={branches}
          existingConnection={getConnection('facebook') || null}
          onClose={() => setShowFacebookSetup(false)}
          onSuccess={(connection) => {
            setConnections((prev) => {
              const existing = prev.find(c => c.channel === 'facebook');
              if (existing) {
                return prev.map(c => c.channel === 'facebook' ? connection : c);
              }
              return [...prev, connection];
            });
            setShowFacebookSetup(false);
          }}
        />
      )}

      {/* TikTok Setup Modal */}
      {showTikTokSetup && (
        <TikTokSetupModal
          tenantId={tenant?.id || ''}
          branches={branches}
          existingConnection={getConnection('tiktok') || null}
          onClose={() => setShowTikTokSetup(false)}
          onSuccess={(connection) => {
            setConnections((prev) => {
              const existing = prev.find(c => c.channel === 'tiktok');
              if (existing) {
                return prev.map(c => c.channel === 'tiktok' ? connection : c);
              }
              return [...prev, connection];
            });
            setShowTikTokSetup(false);
          }}
        />
      )}
    </>
  );
}

// ======================
// WHATSAPP SETUP MODAL
// ======================

interface WhatsAppSetupModalProps {
  tenantId: string;
  branches: Branch[];
  existingConnection: ChannelConnection | null;
  onClose: () => void;
  onSuccess: (connection: ChannelConnection) => void;
}

function WhatsAppSetupModal({ tenantId, branches, existingConnection, onClose, onSuccess }: WhatsAppSetupModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedConnection, setSavedConnection] = useState<ChannelConnection | null>(null);
  const [formData, setFormData] = useState({
    branchId: existingConnection?.branch_id || '',
    phoneNumberId: existingConnection?.whatsapp_phone_number_id || '',
    businessAccountId: existingConnection?.whatsapp_business_account_id || '',
    accessToken: existingConnection?.whatsapp_access_token || '',
    verifyToken: existingConnection?.whatsapp_verify_token || '',
    webhookSecret: existingConnection?.webhook_secret || '',
  });

  const isEditing = !!existingConnection;

  // Test WhatsApp connection
  const testConnection = async () => {
    if (!formData.accessToken || !formData.phoneNumberId) {
      setTestResult({ success: false, message: 'Ingresa el Access Token y Phone Number ID primero' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Call WhatsApp API to verify the token
      const response = await fetch(`https://graph.facebook.com/v18.0/${formData.phoneNumberId}`, {
        headers: {
          Authorization: `Bearer ${formData.accessToken}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.id) {
        setTestResult({
          success: true,
          message: `Conexión exitosa! Número verificado: ${data.display_phone_number || data.id}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error?.message || 'Error al verificar las credenciales',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Error de conexión. Verifica que el Access Token sea válido.',
      });
    }

    setTesting(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError(null);

    // Generate verify token if not provided
    const verifyToken = formData.verifyToken || existingConnection?.whatsapp_verify_token || `tistis_${Math.random().toString(36).substring(7)}`;

    const connectionData = {
      tenant_id: tenantId,
      branch_id: formData.branchId || null,
      channel: 'whatsapp' as const,
      status: testResult?.success ? 'connected' : 'configuring' as const,
      ai_enabled: true,
      whatsapp_phone_number_id: formData.phoneNumberId,
      whatsapp_business_account_id: formData.businessAccountId,
      whatsapp_access_token: formData.accessToken,
      whatsapp_verify_token: verifyToken,
      webhook_secret: formData.webhookSecret,
    };

    let result;
    if (isEditing && existingConnection) {
      // Update existing connection
      result = await supabase
        .from('channel_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
        .select()
        .single();
    } else {
      // Insert new connection
      result = await supabase
        .from('channel_connections')
        .insert(connectionData)
        .select()
        .single();
    }

    setSaving(false);

    if (result.error) {
      console.error('Error saving connection:', result.error);
      setSaveError(result.error.message || 'Error al guardar la conexión');
      return;
    }

    // Get tenant slug for webhook URL
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();

    if (tenant) {
      setWebhookUrl(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/whatsapp/${tenant.slug}`);
    }

    setSavedConnection(result.data as ChannelConnection);
    setStep(3);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                {channelIcons.whatsapp}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {isEditing ? 'Editar WhatsApp Business' : 'Conectar WhatsApp Business'}
                </h3>
                <p className="text-sm text-gray-500">Paso {step} de 3</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>Requisitos:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Cuenta de Meta Business verificada</li>
                  <li>Acceso a WhatsApp Business API</li>
                  <li>Número de teléfono registrado en Meta</li>
                </ul>
              </div>

              {/* Branch Selector */}
              {branches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sucursal (opcional)
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.city}) {branch.is_headquarters ? '- Principal' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Si no seleccionas una sucursal, el canal se usará para todas.
                  </p>
                </div>
              )}

              <Input
                label="Phone Number ID"
                placeholder="123456789012345"
                value={formData.phoneNumberId}
                onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                helperText="Encuentra esto en Meta Business Suite > WhatsApp > Configuración"
              />

              <Input
                label="Business Account ID"
                placeholder="123456789012345"
                value={formData.businessAccountId}
                onChange={(e) => setFormData({ ...formData, businessAccountId: e.target.value })}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Input
                label="Access Token"
                type="password"
                placeholder="EAA..."
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                helperText="Token permanente de la API de WhatsApp Business"
              />

              <Input
                label="App Secret (para verificar webhooks)"
                type="password"
                placeholder="abc123..."
                value={formData.webhookSecret}
                onChange={(e) => setFormData({ ...formData, webhookSecret: e.target.value })}
                helperText="Encuentra esto en Meta Developers > Tu App > Configuración básica"
              />

              <Input
                label="Verify Token (opcional)"
                placeholder="Se generará automáticamente"
                value={formData.verifyToken}
                onChange={(e) => setFormData({ ...formData, verifyToken: e.target.value })}
                helperText="Token para verificar el webhook. Si lo dejas vacío, se generará uno."
              />

              {/* Test Connection Button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={testConnection}
                  isLoading={testing}
                  disabled={!formData.accessToken || !formData.phoneNumberId}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Probar Conexión
                </Button>
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={cn(
                    'p-4 rounded-lg text-sm',
                    testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  )}
                >
                  {testResult.success ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {testResult.message}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}

              {/* Save Error */}
              {saveError && (
                <div className="p-4 bg-red-50 rounded-lg text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {saveError}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-green-800 font-medium">
                  {testResult?.success ? '¡Conexión exitosa!' : 'Conexión guardada'}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {testResult?.success
                    ? 'Tu número de WhatsApp está configurado correctamente.'
                    : 'Ahora configura el webhook en Meta Business Suite.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL del Webhook
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                    value={webhookUrl}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verify Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                    value={formData.verifyToken || savedConnection?.whatsapp_verify_token || ''}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(formData.verifyToken || savedConnection?.whatsapp_verify_token || '');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                <strong>Siguiente paso en Meta Business Suite:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Ve a Meta Developers &gt; Tu App &gt; WhatsApp &gt; Configuración</li>
                  <li>En Webhooks, pega la URL de arriba</li>
                  <li>Usa el Verify Token mostrado arriba</li>
                  <li>Suscribe a los campos: messages, message_deliveries</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-between">
          {step > 1 && step < 3 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Anterior
            </Button>
          ) : (
            <div />
          )}

          {step < 2 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!formData.phoneNumberId || !formData.businessAccountId}
            >
              Siguiente
            </Button>
          )}

          {step === 2 && (
            <Button
              onClick={handleSubmit}
              isLoading={saving}
              disabled={!formData.accessToken}
            >
              Guardar y Continuar
            </Button>
          )}

          {step === 3 && (
            <Button
              onClick={() => {
                if (savedConnection) {
                  onSuccess(savedConnection);
                }
                onClose();
              }}
            >
              Finalizar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================
// INSTAGRAM SETUP MODAL
// ======================

interface InstagramSetupModalProps {
  tenantId: string;
  branches: Branch[];
  existingConnection: ChannelConnection | null;
  onClose: () => void;
  onSuccess: (connection: ChannelConnection) => void;
}

function InstagramSetupModal({ tenantId, branches, existingConnection, onClose, onSuccess }: InstagramSetupModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedConnection, setSavedConnection] = useState<ChannelConnection | null>(null);
  const [formData, setFormData] = useState({
    branchId: existingConnection?.branch_id || '',
    pageId: existingConnection?.instagram_page_id || '',
    accountId: existingConnection?.instagram_account_id || '',
    username: existingConnection?.instagram_username || '',
    accessToken: existingConnection?.instagram_access_token || '',
    verifyToken: existingConnection?.instagram_verify_token || '',
  });

  const isEditing = !!existingConnection;

  // Test Instagram connection via Facebook Graph API
  const testConnection = async () => {
    if (!formData.accessToken || !formData.accountId) {
      setTestResult({ success: false, message: 'Ingresa el Access Token e Instagram Account ID primero' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Instagram uses Facebook Graph API - verify the Instagram account
      const response = await fetch(`https://graph.facebook.com/v18.0/${formData.accountId}?fields=id,username,name&access_token=${formData.accessToken}`);
      const data = await response.json();

      if (response.ok && data.id) {
        setTestResult({
          success: true,
          message: `Conexión exitosa! Cuenta: @${data.username || data.name || data.id}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error?.message || 'Error al verificar las credenciales de Instagram',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Error de conexión. Verifica que el Access Token sea válido.',
      });
    }

    setTesting(false);
  };

  const handleSubmit = async () => {
    setSaving(true);

    const verifyToken = formData.verifyToken || existingConnection?.instagram_verify_token || `tistis_ig_${Math.random().toString(36).substring(7)}`;

    setSaveError(null);

    const connectionData = {
      tenant_id: tenantId,
      branch_id: formData.branchId || null,
      channel: 'instagram' as const,
      status: testResult?.success ? 'connected' : 'configuring' as const,
      ai_enabled: true,
      instagram_page_id: formData.pageId,
      instagram_account_id: formData.accountId,
      instagram_username: formData.username,
      instagram_access_token: formData.accessToken,
      instagram_verify_token: verifyToken,
    };

    let result;
    if (isEditing && existingConnection) {
      result = await supabase
        .from('channel_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('channel_connections')
        .insert(connectionData)
        .select()
        .single();
    }

    setSaving(false);

    if (result.error) {
      console.error('Error saving connection:', result.error);
      setSaveError(result.error.message || 'Error al guardar la conexión');
      return;
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();

    if (tenant) {
      setWebhookUrl(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/instagram/${tenant.slug}`);
    }

    setSavedConnection(result.data as ChannelConnection);
    setStep(3);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600">
                {channelIcons.instagram}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {isEditing ? 'Editar Instagram Direct' : 'Conectar Instagram Direct'}
                </h3>
                <p className="text-sm text-gray-500">Paso {step} de 3</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-pink-50 rounded-lg text-sm text-pink-800">
                <strong>Requisitos:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Cuenta de Instagram Business o Creator</li>
                  <li>Cuenta vinculada a una Página de Facebook</li>
                  <li>Acceso a Meta Business Suite</li>
                </ul>
              </div>

              {/* Branch Selector */}
              {branches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sucursal (opcional)
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.city}) {branch.is_headquarters ? '- Principal' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Input
                label="Instagram Page ID"
                placeholder="17841400..."
                value={formData.pageId}
                onChange={(e) => setFormData({ ...formData, pageId: e.target.value })}
                helperText="ID de la página de Instagram vinculada"
              />

              <Input
                label="Instagram Account ID"
                placeholder="17841400..."
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              />

              <Input
                label="Username de Instagram"
                placeholder="@tu_cuenta"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Input
                label="Access Token (Page Token)"
                type="password"
                placeholder="EAA..."
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                helperText="Token de la página de Facebook vinculada con permisos de Instagram"
              />

              <Input
                label="Verify Token (opcional)"
                placeholder="Se generará automáticamente"
                value={formData.verifyToken}
                onChange={(e) => setFormData({ ...formData, verifyToken: e.target.value })}
              />

              {/* Test Connection Button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={testConnection}
                  isLoading={testing}
                  disabled={!formData.accessToken || !formData.accountId}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Probar Conexión
                </Button>
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={cn(
                    'p-4 rounded-lg text-sm',
                    testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  )}
                >
                  {testResult.success ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {testResult.message}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}

              {/* Save Error */}
              {saveError && (
                <div className="p-4 bg-red-50 rounded-lg text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {saveError}
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>Permisos necesarios:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>instagram_manage_messages</li>
                  <li>instagram_basic</li>
                  <li>pages_messaging</li>
                </ul>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-green-800 font-medium">
                  {testResult?.success ? '¡Conexión exitosa!' : 'Conexión guardada'}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {testResult?.success
                    ? 'Tu cuenta de Instagram está configurada correctamente.'
                    : 'Ahora configura el webhook en Meta Business Suite.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL del Webhook</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                    value={webhookUrl}
                  />
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                    Copiar
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verify Token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                    value={formData.verifyToken || savedConnection?.instagram_verify_token || ''}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(formData.verifyToken || savedConnection?.instagram_verify_token || '')}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                <strong>Siguiente paso:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Ve a Meta Developers &gt; Tu App &gt; Webhooks</li>
                  <li>Selecciona &quot;Instagram&quot;</li>
                  <li>Configura la URL y el Verify Token de arriba</li>
                  <li>Suscribe a &quot;messages&quot; y &quot;messaging_postbacks&quot;</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-between">
          {step > 1 && step < 3 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Anterior</Button>
          ) : <div />}

          {step < 2 && (
            <Button onClick={() => setStep(step + 1)} disabled={!formData.pageId || !formData.accountId}>
              Siguiente
            </Button>
          )}

          {step === 2 && (
            <Button onClick={handleSubmit} isLoading={saving} disabled={!formData.accessToken}>
              Guardar y Continuar
            </Button>
          )}

          {step === 3 && (
            <Button
              onClick={() => {
                if (savedConnection) {
                  onSuccess(savedConnection);
                }
                onClose();
              }}
            >
              Finalizar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================
// FACEBOOK SETUP MODAL
// ======================

interface FacebookSetupModalProps {
  tenantId: string;
  branches: Branch[];
  existingConnection: ChannelConnection | null;
  onClose: () => void;
  onSuccess: (connection: ChannelConnection) => void;
}

function FacebookSetupModal({ tenantId, branches, existingConnection, onClose, onSuccess }: FacebookSetupModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedConnection, setSavedConnection] = useState<ChannelConnection | null>(null);
  const [formData, setFormData] = useState({
    branchId: existingConnection?.branch_id || '',
    pageId: existingConnection?.facebook_page_id || '',
    pageName: existingConnection?.facebook_page_name || '',
    accessToken: existingConnection?.facebook_access_token || '',
    verifyToken: existingConnection?.facebook_verify_token || '',
  });

  const isEditing = !!existingConnection;

  // Test Facebook connection via Graph API
  const testConnection = async () => {
    if (!formData.accessToken || !formData.pageId) {
      setTestResult({ success: false, message: 'Ingresa el Access Token y Page ID primero' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${formData.pageId}?fields=id,name,access_token&access_token=${formData.accessToken}`);
      const data = await response.json();

      if (response.ok && data.id) {
        setTestResult({
          success: true,
          message: `Conexión exitosa! Página: ${data.name || data.id}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error?.message || 'Error al verificar las credenciales de Facebook',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Error de conexión. Verifica que el Access Token sea válido.',
      });
    }

    setTesting(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError(null);

    const verifyToken = formData.verifyToken || existingConnection?.facebook_verify_token || `tistis_fb_${Math.random().toString(36).substring(7)}`;

    const connectionData = {
      tenant_id: tenantId,
      branch_id: formData.branchId || null,
      channel: 'facebook' as const,
      status: testResult?.success ? 'connected' : 'configuring' as const,
      ai_enabled: true,
      facebook_page_id: formData.pageId,
      facebook_page_name: formData.pageName,
      facebook_access_token: formData.accessToken,
      facebook_verify_token: verifyToken,
    };

    let result;
    if (isEditing && existingConnection) {
      result = await supabase
        .from('channel_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('channel_connections')
        .insert(connectionData)
        .select()
        .single();
    }

    setSaving(false);

    if (result.error) {
      console.error('Error saving connection:', result.error);
      setSaveError(result.error.message || 'Error al guardar la conexión');
      return;
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();

    if (tenant) {
      setWebhookUrl(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/facebook/${tenant.slug}`);
    }

    setSavedConnection(result.data as ChannelConnection);
    setStep(3);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                {channelIcons.facebook}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {isEditing ? 'Editar Facebook Messenger' : 'Conectar Facebook Messenger'}
                </h3>
                <p className="text-sm text-gray-500">Paso {step} de 3</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>Requisitos:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Página de Facebook Business</li>
                  <li>App registrada en Meta Developers</li>
                  <li>Permisos de Messenger API</li>
                </ul>
              </div>

              {/* Branch Selector */}
              {branches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sucursal (opcional)
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.city}) {branch.is_headquarters ? '- Principal' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Input
                label="Page ID"
                placeholder="123456789012345"
                value={formData.pageId}
                onChange={(e) => setFormData({ ...formData, pageId: e.target.value })}
                helperText="ID de tu página de Facebook"
              />

              <Input
                label="Nombre de la Página"
                placeholder="Mi Negocio"
                value={formData.pageName}
                onChange={(e) => setFormData({ ...formData, pageName: e.target.value })}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Input
                label="Page Access Token"
                type="password"
                placeholder="EAA..."
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                helperText="Token de acceso de la página con permisos de Messenger"
              />

              <Input
                label="Verify Token (opcional)"
                placeholder="Se generará automáticamente"
                value={formData.verifyToken}
                onChange={(e) => setFormData({ ...formData, verifyToken: e.target.value })}
              />

              {/* Test Connection Button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={testConnection}
                  isLoading={testing}
                  disabled={!formData.accessToken || !formData.pageId}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Probar Conexión
                </Button>
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={cn(
                    'p-4 rounded-lg text-sm',
                    testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  )}
                >
                  {testResult.success ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {testResult.message}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}

              {/* Save Error */}
              {saveError && (
                <div className="p-4 bg-red-50 rounded-lg text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {saveError}
                  </div>
                </div>
              )}

              <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>Permisos necesarios:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>pages_messaging</li>
                  <li>pages_read_engagement</li>
                  <li>pages_manage_metadata</li>
                </ul>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-green-800 font-medium">
                  {testResult?.success ? '¡Conexión exitosa!' : 'Conexión guardada'}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {testResult?.success
                    ? 'Tu página de Facebook está configurada correctamente.'
                    : 'Ahora configura el webhook en Meta Developers.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL del Webhook</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                    value={webhookUrl}
                  />
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                    Copiar
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verify Token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                    value={formData.verifyToken || savedConnection?.facebook_verify_token || ''}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(formData.verifyToken || savedConnection?.facebook_verify_token || '')}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                <strong>Siguiente paso:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Ve a Meta Developers &gt; Tu App &gt; Messenger &gt; Settings</li>
                  <li>En Webhooks, configura la URL y el Verify Token de arriba</li>
                  <li>Suscribe a &quot;messages&quot;, &quot;messaging_postbacks&quot;</li>
                  <li>Vincula tu página a la app</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-between">
          {step > 1 && step < 3 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Anterior</Button>
          ) : <div />}

          {step < 2 && (
            <Button onClick={() => setStep(step + 1)} disabled={!formData.pageId}>
              Siguiente
            </Button>
          )}

          {step === 2 && (
            <Button onClick={handleSubmit} isLoading={saving} disabled={!formData.accessToken}>
              Guardar y Continuar
            </Button>
          )}

          {step === 3 && (
            <Button
              onClick={() => {
                if (savedConnection) {
                  onSuccess(savedConnection);
                }
                onClose();
              }}
            >
              Finalizar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================
// TIKTOK SETUP MODAL
// ======================

interface TikTokSetupModalProps {
  tenantId: string;
  branches: Branch[];
  existingConnection: ChannelConnection | null;
  onClose: () => void;
  onSuccess: (connection: ChannelConnection) => void;
}

function TikTokSetupModal({ tenantId, branches, existingConnection, onClose, onSuccess }: TikTokSetupModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedConnection, setSavedConnection] = useState<ChannelConnection | null>(null);
  const [formData, setFormData] = useState({
    branchId: existingConnection?.branch_id || '',
    clientKey: existingConnection?.tiktok_client_key || '',
    clientSecret: existingConnection?.tiktok_client_secret || '',
    accessToken: existingConnection?.tiktok_access_token || '',
    openId: existingConnection?.tiktok_open_id || '',
    verifyToken: existingConnection?.tiktok_verify_token || '',
  });

  const isEditing = !!existingConnection;

  // Test TikTok connection via TikTok API
  // Note: TikTok API requires server-side calls, so we do a basic token validation
  const testConnection = async () => {
    if (!formData.accessToken) {
      setTestResult({ success: false, message: 'Ingresa el Access Token primero' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // TikTok requires server-side API calls due to CORS
      // We'll do a basic validation by checking token format
      if (formData.accessToken.startsWith('act.') && formData.accessToken.length > 20) {
        setTestResult({
          success: true,
          message: 'Formato de token válido. La conexión se verificará al recibir el primer mensaje.',
        });
      } else {
        setTestResult({
          success: false,
          message: 'El formato del Access Token no parece correcto. Debe comenzar con "act."',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Error al validar el token.',
      });
    }

    setTesting(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError(null);

    const verifyToken = formData.verifyToken || existingConnection?.tiktok_verify_token || `tistis_tt_${Math.random().toString(36).substring(7)}`;

    const connectionData = {
      tenant_id: tenantId,
      branch_id: formData.branchId || null,
      channel: 'tiktok' as const,
      status: testResult?.success ? 'connected' : 'configuring' as const,
      ai_enabled: true,
      tiktok_client_key: formData.clientKey,
      tiktok_client_secret: formData.clientSecret,
      tiktok_access_token: formData.accessToken,
      tiktok_open_id: formData.openId,
      tiktok_verify_token: verifyToken,
    };

    let result;
    if (isEditing && existingConnection) {
      result = await supabase
        .from('channel_connections')
        .update(connectionData)
        .eq('id', existingConnection.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('channel_connections')
        .insert(connectionData)
        .select()
        .single();
    }

    setSaving(false);

    if (result.error) {
      console.error('Error saving connection:', result.error);
      setSaveError(result.error.message || 'Error al guardar la conexión');
      return;
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();

    if (tenant) {
      setWebhookUrl(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/tiktok/${tenant.slug}`);
    }

    setSavedConnection(result.data as ChannelConnection);
    setStep(3);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white">
                {channelIcons.tiktok}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {isEditing ? 'Editar TikTok Messages' : 'Conectar TikTok Messages'}
                </h3>
                <p className="text-sm text-gray-500">Paso {step} de 3</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-100 rounded-lg text-sm text-gray-800">
                <strong>Requisitos:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Cuenta TikTok Business verificada</li>
                  <li>App registrada en TikTok for Developers</li>
                  <li>Permisos de Direct Message API</li>
                </ul>
              </div>

              {/* Branch Selector */}
              {branches.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sucursal (opcional)
                  </label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.city}) {branch.is_headquarters ? '- Principal' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Input
                label="Client Key"
                placeholder="awxxxxxxxx"
                value={formData.clientKey}
                onChange={(e) => setFormData({ ...formData, clientKey: e.target.value })}
                helperText="De tu app en TikTok for Developers"
              />

              <Input
                label="Client Secret"
                type="password"
                placeholder="xxxxxxxx"
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Input
                label="Access Token"
                type="password"
                placeholder="act.xxxxx"
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                helperText="Token obtenido del flujo OAuth"
              />

              <Input
                label="Open ID (opcional)"
                placeholder="xxxxxxxx"
                value={formData.openId}
                onChange={(e) => setFormData({ ...formData, openId: e.target.value })}
                helperText="ID único del usuario autorizado"
              />

              <Input
                label="Verify Token (opcional)"
                placeholder="Se generará automáticamente"
                value={formData.verifyToken}
                onChange={(e) => setFormData({ ...formData, verifyToken: e.target.value })}
              />

              {/* Test Connection Button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={testConnection}
                  isLoading={testing}
                  disabled={!formData.accessToken}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Validar Token
                </Button>
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  className={cn(
                    'p-4 rounded-lg text-sm',
                    testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  )}
                >
                  {testResult.success ? (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {testResult.message}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}

              {/* Save Error */}
              {saveError && (
                <div className="p-4 bg-red-50 rounded-lg text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {saveError}
                  </div>
                </div>
              )}

              <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                <strong>Nota:</strong> TikTok DM API está en fase beta limitada.
                Contacta a tu representante de TikTok para acceso.
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-green-800 font-medium">
                  {testResult?.success ? '¡Configuración lista!' : 'Conexión guardada'}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {testResult?.success
                    ? 'El token de TikTok fue validado correctamente.'
                    : 'Ahora configura el webhook en TikTok for Developers.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL del Webhook</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                    value={webhookUrl}
                  />
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
                    Copiar
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Verify Token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    className="flex-1 px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm"
                    value={formData.verifyToken || savedConnection?.tiktok_verify_token || ''}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(formData.verifyToken || savedConnection?.tiktok_verify_token || '')}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-800">
                <strong>Siguiente paso:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Ve a TikTok for Developers &gt; Tu App</li>
                  <li>Configura el Webhook URL y Verify Token</li>
                  <li>Habilita eventos de mensajes directos</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-between">
          {step > 1 && step < 3 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Anterior</Button>
          ) : <div />}

          {step < 2 && (
            <Button onClick={() => setStep(step + 1)} disabled={!formData.clientKey || !formData.clientSecret}>
              Siguiente
            </Button>
          )}

          {step === 2 && (
            <Button onClick={handleSubmit} isLoading={saving} disabled={!formData.accessToken}>
              Guardar y Continuar
            </Button>
          )}

          {step === 3 && (
            <Button
              onClick={() => {
                if (savedConnection) {
                  onSuccess(savedConnection);
                }
                onClose();
              }}
            >
              Finalizar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChannelConnections;
