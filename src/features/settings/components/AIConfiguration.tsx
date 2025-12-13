// =====================================================
// TIS TIS PLATFORM - AI Configuration Component
// Configure AI assistant behavior and prompts
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

type AIModel =
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-opus-4-5-20251101'
  | 'claude-3-haiku-20240307'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-opus-20240229'
  | 'gpt-4o-mini'
  | 'gpt-4o';

interface AIConfig {
  id?: string;
  tenant_id: string;
  ai_enabled: boolean;
  ai_model: AIModel;
  system_prompt_override?: string;
  custom_instructions?: string;
  greeting_message?: string;
  fallback_message?: string;
  out_of_hours_message?: string;
  ai_personality: 'professional' | 'professional_friendly' | 'casual' | 'formal';
  max_tokens: number;
  ai_temperature: number;
  enable_scoring: boolean;
  auto_escalate_after_messages: number;
  escalation_keywords: string[];
  business_hours: {
    enabled: boolean;
    start: string;
    end: string;
    days: number[];
    timezone: string;
  };
}

interface ScoringRule {
  id: string;
  tenant_id: string | null;
  signal_name: string;
  points: number;
  keywords: string[];
  category: string;
  is_active: boolean;
}

// ======================
// ICONS
// ======================
const icons = {
  ai: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const responseStyles = [
  { value: 'professional', label: 'Profesional', desc: 'Formal y directo' },
  { value: 'professional_friendly', label: 'Profesional Cálido', desc: 'Formal pero amigable (recomendado)' },
  { value: 'casual', label: 'Casual', desc: 'Informal y cercano' },
  { value: 'formal', label: 'Muy Formal', desc: 'Extremadamente profesional' },
];

const aiModels = [
  {
    value: 'claude-3-5-sonnet-20241022',
    label: 'Claude Sonnet 3.5',
    desc: 'Mejor balance costo/calidad (RECOMENDADO)',
    provider: 'anthropic',
    recommended: true,
  },
  {
    value: 'claude-3-5-haiku-20241022',
    label: 'Claude Haiku 3.5',
    desc: 'Más rápido y económico',
    provider: 'anthropic',
    recommended: false,
  },
  {
    value: 'claude-opus-4-5-20251101',
    label: 'Claude Opus 4.5',
    desc: 'Máxima calidad, mayor costo',
    provider: 'anthropic',
    recommended: false,
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    desc: 'Alternativa económica de OpenAI',
    provider: 'openai',
    recommended: false,
  },
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    desc: 'Modelo premium de OpenAI',
    provider: 'openai',
    recommended: false,
  },
];

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ======================
// COMPONENT
// ======================

export function AIConfiguration() {
  const { tenant, isAdmin } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'messages' | 'scoring' | 'escalation'>('general');

  const [config, setConfig] = useState<AIConfig>({
    tenant_id: tenant?.id || '',
    ai_enabled: true,
    ai_model: 'claude-3-5-sonnet-20241022',
    ai_personality: 'professional_friendly',
    max_tokens: 500,
    ai_temperature: 0.7,
    enable_scoring: true,
    auto_escalate_after_messages: 10,
    escalation_keywords: ['queja', 'molesto', 'enojado', 'gerente', 'supervisor'],
    business_hours: {
      enabled: false,
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5],
      timezone: 'America/Mexico_City',
    },
  });

  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);

  // Load configuration
  useEffect(() => {
    if (!tenant?.id) return;

    const loadConfig = async () => {
      setLoading(true);

      // Load AI config
      const { data: aiConfig } = await supabase
        .from('ai_tenant_config')
        .select('*')
        .eq('tenant_id', tenant.id)
        .single();

      if (aiConfig) {
        setConfig({
          ...config,
          ...aiConfig,
        });
      }

      // Load scoring rules
      const { data: rules } = await supabase
        .from('ai_scoring_rules')
        .select('*')
        .or(`tenant_id.eq.${tenant.id},tenant_id.is.null`)
        .eq('is_active', true)
        .order('points', { ascending: false });

      if (rules) {
        setScoringRules(rules);
      }

      setLoading(false);
    };

    loadConfig();
  }, [tenant?.id]);

  // Save configuration
  const saveConfig = async () => {
    if (!tenant?.id) return;

    setSaving(true);

    // Exclude tenant_id from spread since we set it explicitly
    const { tenant_id: _, ...configWithoutTenantId } = config;

    const { error } = await supabase
      .from('ai_tenant_config')
      .upsert({
        tenant_id: tenant.id,
        ...configWithoutTenantId,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);

    if (error) {
      console.error('Error saving config:', error);
    }
  };

  // Toggle AI enabled
  const toggleAI = async () => {
    const newState = !config.ai_enabled;
    setConfig({ ...config, ai_enabled: newState });

    await supabase
      .from('ai_tenant_config')
      .upsert({
        tenant_id: tenant?.id,
        ai_enabled: newState,
      });
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
    <div className="space-y-6">
      {/* AI Status Card */}
      <Card variant="bordered">
        <CardContent className="p-0">
          <div
            className={cn(
              'p-6 rounded-xl',
              config.ai_enabled ? 'bg-gradient-to-r from-purple-50 to-blue-50' : 'bg-gray-50'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center',
                    config.ai_enabled ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-400'
                  )}
                >
                  {icons.ai}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    AI Agent {config.ai_enabled ? 'Activo' : 'Desactivado'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {config.ai_enabled
                      ? `Usando ${aiModels.find(m => m.value === config.ai_model)?.label || config.ai_model}`
                      : 'Las conversaciones serán atendidas manualmente'}
                  </p>
                </div>
              </div>

              {isAdmin && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.ai_enabled}
                    onChange={toggleAI}
                  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Tabs */}
      <Card variant="bordered">
        <CardContent className="p-0">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-100">
            {[
              { key: 'general', label: 'General' },
              { key: 'messages', label: 'Mensajes' },
              { key: 'scoring', label: 'Puntuación' },
              { key: 'escalation', label: 'Escalamiento' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key as typeof activeSection)}
                className={cn(
                  'px-6 py-4 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeSection === tab.key
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="p-6 space-y-6">
              {/* Selector de Modelo AI */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo de IA
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {aiModels.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => setConfig({ ...config, ai_model: model.value as AIModel })}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all relative',
                        config.ai_model === model.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      {model.recommended && (
                        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          Recomendado
                        </span>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          model.provider === 'anthropic' ? 'bg-orange-500' : 'bg-green-500'
                        )} />
                        <p className="font-medium text-gray-900">{model.label}</p>
                      </div>
                      <p className="text-xs text-gray-500">{model.desc}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-full" /> Anthropic (Claude)</span>
                  <span className="inline-flex items-center gap-1 ml-4"><span className="w-2 h-2 bg-green-500 rounded-full" /> OpenAI (GPT)</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estilo de Respuesta
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {responseStyles.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setConfig({ ...config, ai_personality: style.value as typeof config.ai_personality })}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        config.ai_personality === style.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <p className="font-medium text-gray-900">{style.label}</p>
                      <p className="text-sm text-gray-500">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitud Máxima de Respuesta (tokens)
                  </label>
                  <select
                    value={config.max_tokens}
                    onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={300}>Corto (300 tokens)</option>
                    <option value={500}>Medio (500 tokens)</option>
                    <option value={800}>Largo (800 tokens)</option>
                    <option value={1000}>Muy Largo (1000 tokens)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Creatividad (Temperature)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.ai_temperature}
                      onChange={(e) => setConfig({ ...config, ai_temperature: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600 w-12">{config.ai_temperature}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    0 = Muy consistente, 1 = Más creativo
                  </p>
                </div>
              </div>

              {/* Business Hours */}
              <div className="pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Horario de Atención</h4>
                    <p className="text-sm text-gray-500">
                      El AI solo responderá durante el horario configurado
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={config.business_hours.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          business_hours: { ...config.business_hours, enabled: e.target.checked },
                        })
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {config.business_hours.enabled && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora inicio</label>
                        <input
                          type="time"
                          value={config.business_hours.start}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              business_hours: { ...config.business_hours, start: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora fin</label>
                        <input
                          type="time"
                          value={config.business_hours.end}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              business_hours: { ...config.business_hours, end: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-2">Días activos</label>
                      <div className="flex gap-2">
                        {dayNames.map((day, index) => (
                          <button
                            key={day}
                            onClick={() => {
                              const days = config.business_hours.days.includes(index)
                                ? config.business_hours.days.filter((d) => d !== index)
                                : [...config.business_hours.days, index];
                              setConfig({
                                ...config,
                                business_hours: { ...config.business_hours, days },
                              });
                            }}
                            className={cn(
                              'w-10 h-10 rounded-lg text-sm font-medium transition-colors',
                              config.business_hours.days.includes(index)
                                ? 'bg-purple-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-600'
                            )}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Messages */}
          {activeSection === 'messages' && (
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instrucciones Personalizadas
                </label>
                <textarea
                  rows={4}
                  value={config.custom_instructions || ''}
                  onChange={(e) => setConfig({ ...config, custom_instructions: e.target.value })}
                  placeholder="Ej: Siempre menciona que tenemos estacionamiento gratuito. Recuerda que los lunes no atendemos."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Estas instrucciones se agregan al prompt del AI para personalizar sus respuestas.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje de Saludo
                </label>
                <textarea
                  rows={3}
                  value={config.greeting_message || ''}
                  onChange={(e) => setConfig({ ...config, greeting_message: e.target.value })}
                  placeholder="Ej: Bienvenido a [Clínica]. Soy el asistente virtual. ¿En qué puedo ayudarte hoy?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje Fuera de Horario
                </label>
                <textarea
                  rows={3}
                  value={config.out_of_hours_message || ''}
                  onChange={(e) => setConfig({ ...config, out_of_hours_message: e.target.value })}
                  placeholder="Ej: Gracias por contactarnos. Nuestro horario de atención es de lunes a viernes de 9am a 6pm. Te responderemos a primera hora."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensaje de Fallback (cuando el AI no puede ayudar)
                </label>
                <textarea
                  rows={3}
                  value={config.fallback_message || ''}
                  onChange={(e) => setConfig({ ...config, fallback_message: e.target.value })}
                  placeholder="Ej: Disculpa, no tengo esa información disponible. Te conecto con uno de nuestros asesores para ayudarte mejor."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* Scoring Configuration */}
          {activeSection === 'scoring' && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">Sistema de Puntuación de Leads</h4>
                  <p className="text-sm text-gray-500">
                    Detecta automáticamente señales de intención de compra
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.enable_scoring}
                    onChange={(e) => setConfig({ ...config, enable_scoring: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {config.enable_scoring && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 font-medium">Reglas de Puntuación Activas</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {scoringRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{rule.signal_name}</p>
                          <p className="text-xs text-gray-500">
                            {rule.keywords.slice(0, 3).join(', ')}
                            {rule.keywords.length > 3 && '...'}
                          </p>
                        </div>
                        <Badge
                          variant={rule.points > 0 ? 'success' : 'warning'}
                          size="sm"
                        >
                          {rule.points > 0 ? '+' : ''}{rule.points} pts
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <strong>Sistema de Clasificación:</strong>
                    <div className="mt-2 grid grid-cols-3 gap-4">
                      <div>
                        <Badge variant="hot" size="sm">HOT</Badge>
                        <span className="ml-2">80+ puntos</span>
                      </div>
                      <div>
                        <Badge variant="warning" size="sm">WARM</Badge>
                        <span className="ml-2">40-79 puntos</span>
                      </div>
                      <div>
                        <Badge variant="info" size="sm">COLD</Badge>
                        <span className="ml-2">0-39 puntos</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Escalation Settings */}
          {activeSection === 'escalation' && (
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escalar después de N mensajes sin conversión
                </label>
                <select
                  value={config.auto_escalate_after_messages}
                  onChange={(e) =>
                    setConfig({ ...config, auto_escalate_after_messages: parseInt(e.target.value) })
                  }
                  className="w-full max-w-xs px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={5}>5 mensajes</option>
                  <option value={10}>10 mensajes</option>
                  <option value={15}>15 mensajes</option>
                  <option value={20}>20 mensajes</option>
                  <option value={0}>Nunca (deshabilitado)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Palabras clave de escalamiento automático
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  El AI escalará inmediatamente si detecta estas palabras
                </p>
                <textarea
                  rows={3}
                  value={config.escalation_keywords.join(', ')}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      escalation_keywords: e.target.value.split(',').map((k) => k.trim()),
                    })
                  }
                  placeholder="queja, molesto, enojado, gerente, supervisor, demanda"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-yellow-600">{icons.warning}</span>
                  <div>
                    <p className="font-medium text-yellow-800">Escalamiento automático siempre activo:</p>
                    <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
                      <li>Cuando el cliente solicite hablar con un humano</li>
                      <li>Cuando se detecte dolor o emergencia</li>
                      <li>Cuando el lead sea clasificado como HOT (80+ puntos)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="p-6 border-t border-gray-100 flex justify-end">
            <Button onClick={saveConfig} isLoading={saving}>
              Guardar Configuración
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AIConfiguration;
