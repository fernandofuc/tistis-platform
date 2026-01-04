// =====================================================
// TIS TIS PLATFORM - Analytics AI Insights Tab
// AI assistant metrics: conversations, resolution, response time
// =====================================================

'use client';

import { Card, CardHeader, CardContent } from '@/src/shared/components/ui';
import { formatNumber, cn } from '@/src/shared/utils';
import {
  TISAreaChart,
  TISBarChart,
  TISPieChart,
  MetricCard,
  RankingList,
  ProgressBar,
  CHART_COLORS,
} from '../charts';

// ======================
// ICONS
// ======================
const icons = {
  chat: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  escalation: (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5 text-tis-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  lightning: (
    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface AIInsightsTabProps {
  data: {
    // KPIs
    totalConversations?: number;
    conversationsChange?: number;
    resolvedConversations?: number;
    resolutionRate?: number;
    avgResponseTime?: number;
    responseTimeChange?: number;
    escalatedCount?: number;
    escalationRate?: number;
    aiHandlingRate?: number;
    // Chart data
    conversationsTrend?: Array<{ label: string; conversations: number; resolved: number; escalated: number }>;
    conversationsByChannel?: Array<{ name: string; value: number; color: string }>;
    intentDistribution?: Array<{ name: string; value: number; fill: string }>;
    responseTimeByHour?: Array<{ label: string; value: number }>;
    topIntents?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    handlingBreakdown?: Array<{ name: string; value: number; color: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values for safe data access
const DEFAULT_DATA = {
  totalConversations: 0,
  conversationsChange: 0,
  resolvedConversations: 0,
  resolutionRate: 0,
  avgResponseTime: 0,
  responseTimeChange: 0,
  escalatedCount: 0,
  escalationRate: 0,
  aiHandlingRate: 0,
  conversationsTrend: [] as Array<{ label: string; conversations: number; resolved: number; escalated: number }>,
  conversationsByChannel: [] as Array<{ name: string; value: number; color: string }>,
  intentDistribution: [] as Array<{ name: string; value: number; fill: string }>,
  responseTimeByHour: [] as Array<{ label: string; value: number }>,
  topIntents: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  handlingBreakdown: [] as Array<{ name: string; value: number; color: string }>,
};

// ======================
// COMPONENT
// ======================
export function AIInsightsTab({ data, loading, period }: AIInsightsTabProps) {
  // Safe data with defaults - prevents undefined errors
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Conversaciones"
          value={formatNumber(safeData.totalConversations)}
          change={safeData.conversationsChange}
          changeLabel="vs período anterior"
          icon={icons.chat}
          iconBgColor="bg-purple-50"
          trend={safeData.conversationsChange > 0 ? 'up' : safeData.conversationsChange < 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Tasa de Resolución"
          value={`${safeData.resolutionRate}%`}
          change={safeData.resolvedConversations}
          changeLabel="resueltas"
          icon={icons.check}
          iconBgColor="bg-emerald-50"
          trend={safeData.resolutionRate > 80 ? 'up' : safeData.resolutionRate < 60 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Tiempo Respuesta"
          value={`${safeData.avgResponseTime}s`}
          change={safeData.responseTimeChange}
          changeLabel="vs período anterior"
          icon={icons.clock}
          iconBgColor="bg-blue-50"
          trend={safeData.responseTimeChange < 0 ? 'up' : safeData.responseTimeChange > 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Escalaciones"
          value={formatNumber(safeData.escalatedCount)}
          change={safeData.escalationRate}
          changeLabel="tasa de escalación"
          icon={icons.escalation}
          iconBgColor="bg-amber-50"
          trend={safeData.escalationRate < 10 ? 'up' : 'down'}
          loading={loading}
          size="lg"
        />
      </div>

      {/* AI vs Human Summary */}
      <Card variant="bordered" className="bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                {icons.ai}
              </div>
              <div>
                <p className="text-sm text-slate-600">Manejo Automático AI</p>
                <p className="text-3xl font-bold text-slate-900">{safeData.aiHandlingRate}%</p>
                <p className="text-xs text-slate-500">de todas las conversaciones</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{safeData.resolvedConversations}</p>
                <p className="text-sm text-slate-500">Resueltas por AI</p>
              </div>
              <div className="h-12 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{safeData.escalatedCount}</p>
                <p className="text-sm text-slate-500">Escaladas a humano</p>
              </div>
              <div className="h-12 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{safeData.avgResponseTime}s</p>
                <p className="text-sm text-slate-500">Tiempo promedio</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversations Trend */}
      <Card variant="bordered">
        <CardHeader
          title="Tendencia de Conversaciones"
          subtitle={`Volumen y resolución - ${period}`}
        />
        <CardContent>
          <TISAreaChart
            data={safeData.conversationsTrend}
            areas={[
              { dataKey: 'conversations', name: 'Total', color: CHART_COLORS.secondary },
              { dataKey: 'resolved', name: 'Resueltas', color: CHART_COLORS.success },
              { dataKey: 'escalated', name: 'Escaladas', color: CHART_COLORS.warning },
            ]}
            height={300}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Three Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channels */}
        <Card variant="bordered">
          <CardHeader title="Canales de Comunicación" subtitle="Origen de conversaciones" />
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <TISPieChart
                  data={safeData.conversationsByChannel}
                  height={160}
                  loading={loading}
                  innerRadius={35}
                  outerRadius={60}
                />
              </div>
              <div className="space-y-3">
                {safeData.conversationsByChannel.map((channel) => {
                  const total = safeData.totalConversations || 1;
                  const percentage = Math.round((channel.value / total) * 100);
                  return (
                    <div key={channel.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }} />
                        <span className="text-sm text-slate-600">{channel.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{channel.value}</span>
                        <span className="text-xs text-slate-400">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI vs Human Handling */}
        <Card variant="bordered">
          <CardHeader title="Manejo de Conversaciones" subtitle="AI vs Humano" />
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <TISPieChart
                  data={safeData.handlingBreakdown}
                  height={160}
                  loading={loading}
                  innerRadius={35}
                  outerRadius={60}
                />
              </div>
              <div className="space-y-3">
                {safeData.handlingBreakdown.map((item) => {
                  const total = safeData.handlingBreakdown.reduce((sum, h) => sum + h.value, 0) || 1;
                  const percentage = Math.round((item.value / total) * 100);
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-slate-600">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{item.value}</span>
                        <span className="text-xs text-slate-400">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Intents */}
        <Card variant="bordered">
          <CardHeader title="Intenciones Principales" subtitle="Qué buscan los clientes" />
          <CardContent>
            <RankingList
              items={safeData.topIntents}
              loading={loading}
              emptyMessage="Sin datos de intenciones"
              valueSuffix="%"
            />
          </CardContent>
        </Card>
      </div>

      {/* Response Time by Hour */}
      <Card variant="bordered">
        <CardHeader title="Tiempo de Respuesta por Hora" subtitle="Rendimiento durante el día" />
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {safeData.responseTimeByHour.map((item, index) => {
              const maxValue = Math.max(...safeData.responseTimeByHour.map(h => h.value), 1);
              const intensity = item.value / maxValue;
              const isGood = item.value < 3;
              const isBad = item.value > 5;
              return (
                <div
                  key={index}
                  className={cn(
                    'flex flex-col items-center p-2 rounded-lg min-w-[50px] transition-colors',
                    isGood && 'bg-emerald-100',
                    isBad && 'bg-red-100',
                    !isGood && !isBad && 'bg-amber-100'
                  )}
                >
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className={cn(
                    'text-sm font-bold',
                    isGood && 'text-emerald-700',
                    isBad && 'text-red-700',
                    !isGood && !isBad && 'text-amber-700'
                  )}>
                    {item.value}s
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-4 mt-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-emerald-100 rounded" />
              <span>&lt; 3s (Excelente)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber-100 rounded" />
              <span>3-5s (Normal)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-100 rounded" />
              <span>&gt; 5s (Lento)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intent Distribution */}
      <Card variant="bordered">
        <CardHeader title="Distribución de Intenciones" subtitle="Categorías de consultas" />
        <CardContent>
          <TISBarChart
            data={safeData.intentDistribution}
            height={240}
            loading={loading}
            layout="vertical"
            barSize={24}
          />
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-purple-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            {icons.lightning}
            <span className="text-sm text-slate-600">Msgs/Conversación</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">4.2</p>
          <p className="text-xs text-slate-500">promedio de mensajes</p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            {icons.check}
            <span className="text-sm text-slate-600">Primera Respuesta</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">1.2s</p>
          <p className="text-xs text-slate-500">tiempo inicial</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            {icons.chat}
            <span className="text-sm text-slate-600">Satisfacción</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">92%</p>
          <p className="text-xs text-slate-500">rating positivo</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            {icons.ai}
            <span className="text-sm text-slate-600">Precisión AI</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">95%</p>
          <p className="text-xs text-slate-500">respuestas correctas</p>
        </div>
      </div>
    </div>
  );
}
