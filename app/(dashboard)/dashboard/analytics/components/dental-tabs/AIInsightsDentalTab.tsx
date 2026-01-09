// =====================================================
// TIS TIS PLATFORM - Dental Analytics AI Insights Tab
// AI conversation and assistant analytics
// =====================================================

'use client';

import { Card, CardHeader, CardContent } from '@/src/shared/components/ui';
import { formatNumber } from '@/src/shared/utils';
import {
  TISAreaChart,
  TISBarChart,
  TISPieChart,
  MetricCard,
  RankingList,
  CHART_COLORS,
} from '../charts';

// ======================
// ICONS
// ======================
const icons = {
  chat: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  resolved: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  escalated: (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5 text-tis-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface AIInsightsDentalTabProps {
  data: {
    // KPIs
    totalConversations?: number;
    conversationsChange?: number;
    resolvedRate?: number;
    resolvedRateChange?: number;
    avgResponseTime?: number;
    responseTimeChange?: number;
    escalatedRate?: number;
    aiHandlingRate?: number;
    // Chart data
    conversationsTrend?: Array<{ label: string; total: number; resolved: number; escalated: number }>;
    conversationsByChannel?: Array<{ name: string; value: number; color: string }>;
    intentDistribution?: Array<{ name: string; value: number; fill: string }>;
    responseTimeByHour?: Array<{ label: string; value: number }>;
    topIntents?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    handlingBreakdown?: Array<{ name: string; value: number; color: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values
const DEFAULT_DATA = {
  totalConversations: 0,
  conversationsChange: 0,
  resolvedRate: 0,
  resolvedRateChange: 0,
  avgResponseTime: 0,
  responseTimeChange: 0,
  escalatedRate: 0,
  aiHandlingRate: 0,
  conversationsTrend: [] as Array<{ label: string; total: number; resolved: number; escalated: number }>,
  conversationsByChannel: [] as Array<{ name: string; value: number; color: string }>,
  intentDistribution: [] as Array<{ name: string; value: number; fill: string }>,
  responseTimeByHour: [] as Array<{ label: string; value: number }>,
  topIntents: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  handlingBreakdown: [] as Array<{ name: string; value: number; color: string }>,
};

// ======================
// COMPONENT
// ======================
export function AIInsightsDentalTab({ data, loading, period }: AIInsightsDentalTabProps) {
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Conversaciones"
          value={formatNumber(safeData.totalConversations)}
          change={safeData.conversationsChange}
          changeLabel="vs período anterior"
          icon={icons.chat}
          iconBgColor="bg-blue-50"
          trend={safeData.conversationsChange > 0 ? 'up' : safeData.conversationsChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Tasa Resolución"
          value={`${safeData.resolvedRate}%`}
          change={safeData.resolvedRateChange}
          changeLabel="vs período anterior"
          icon={icons.resolved}
          iconBgColor="bg-emerald-50"
          trend={safeData.resolvedRateChange > 0 ? 'up' : safeData.resolvedRateChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Tiempo Respuesta"
          value={`${safeData.avgResponseTime}s`}
          change={safeData.responseTimeChange}
          changeLabel="promedio"
          icon={icons.clock}
          iconBgColor="bg-purple-50"
          trend={safeData.responseTimeChange < 0 ? 'up' : safeData.responseTimeChange > 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Escaladas"
          value={`${safeData.escalatedRate}%`}
          changeLabel="requirió humano"
          icon={icons.escalated}
          iconBgColor="bg-amber-50"
          trend={safeData.escalatedRate < 15 ? 'up' : 'down'}
          loading={loading}
        />
        <MetricCard
          title="AI Handling"
          value={`${safeData.aiHandlingRate}%`}
          changeLabel="resueltas por AI"
          icon={icons.ai}
          iconBgColor="bg-tis-coral/10"
          trend={safeData.aiHandlingRate > 70 ? 'up' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Main Chart - Conversations Trend */}
      <Card variant="bordered" className="overflow-hidden">
        <CardHeader
          title="Tendencia de Conversaciones"
          subtitle={`Total, resueltas y escaladas - ${period}`}
        />
        <CardContent className="pt-2">
          <TISAreaChart
            data={safeData.conversationsTrend}
            areas={[
              { dataKey: 'total', name: 'Total', color: CHART_COLORS.blue },
              { dataKey: 'resolved', name: 'Resueltas', color: CHART_COLORS.success },
              { dataKey: 'escalated', name: 'Escaladas', color: CHART_COLORS.warning },
            ]}
            height={320}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations by Channel */}
        <Card variant="bordered">
          <CardHeader title="Por Canal" subtitle="Distribución de mensajes" />
          <CardContent>
            <div className="space-y-4">
              <TISPieChart
                data={safeData.conversationsByChannel}
                height={150}
                loading={loading}
                innerRadius={30}
                outerRadius={55}
              />
              <div className="space-y-2">
                {safeData.conversationsByChannel.map((item) => {
                  const total = safeData.conversationsByChannel.reduce((sum, i) => sum + i.value, 0) || 1;
                  const percentage = Math.round((item.value / total) * 100);
                  const channelIcon = item.name === 'WhatsApp' ? '📱' : item.name === 'Instagram' ? '📸' : item.name === 'Facebook' ? '👤' : '💬';
                  return (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{channelIcon}</span>
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{item.value}</span>
                        <span className="text-xs text-slate-400">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Intent Distribution */}
        <Card variant="bordered">
          <CardHeader title="Intenciones Detectadas" subtitle="Temas de conversación" />
          <CardContent>
            <TISBarChart
              data={safeData.intentDistribution}
              height={220}
              loading={loading}
              layout="vertical"
              barSize={20}
            />
          </CardContent>
        </Card>

        {/* AI Handling Breakdown */}
        <Card variant="bordered">
          <CardHeader title="Manejo de Conversaciones" subtitle="AI vs Humano" />
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral" />
              </div>
            ) : safeData.handlingBreakdown.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-slate-400">
                <p className="text-sm">No hay datos para mostrar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {safeData.handlingBreakdown.map((item) => {
                  const total = safeData.totalConversations || 1;
                  const percentage = Math.round((item.value / total) * 100);
                  const icon = item.name.includes('AI') ? '🤖' : item.name.includes('Escalado') ? '👨‍💼' : '⏳';
                  return (
                    <div key={item.name} className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{icon}</span>
                          <span className="font-medium text-slate-700">{item.name}</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-900">{item.value}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: item.color }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{percentage}% del total</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time by Hour */}
        <Card variant="bordered">
          <CardHeader title="Tiempo de Respuesta por Hora" subtitle="Segundos promedio" />
          <CardContent>
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral" />
              </div>
            ) : safeData.responseTimeByHour.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400">
                <p className="text-sm">No hay datos para mostrar</p>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-1">
                {safeData.responseTimeByHour.slice(8, 20).map((hour, index) => {
                  const maxValue = Math.max(...safeData.responseTimeByHour.map(h => h.value), 1);
                  const intensity = hour.value / maxValue;
                  const isGood = hour.value <= 3;
                  return (
                    <div
                      key={index}
                      className="aspect-square rounded flex items-center justify-center text-xs font-medium transition-all hover:scale-110"
                      style={{
                        backgroundColor: isGood
                          ? `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`
                          : `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`,
                        color: intensity > 0.5 ? 'white' : '#64748b',
                      }}
                      title={`${hour.label}: ${hour.value}s`}
                    >
                      {hour.value}s
                    </div>
                  );
                })}
                <div className="col-span-12 flex justify-between mt-2 px-1">
                  {['8am', '10am', '12pm', '2pm', '4pm', '6pm'].map(label => (
                    <span key={label} className="text-xs text-slate-400">{label}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Intents */}
        <Card variant="bordered">
          <CardHeader title="Intenciones Más Frecuentes" subtitle="Top consultas de pacientes" />
          <CardContent>
            <RankingList
              items={safeData.topIntents}
              loading={loading}
              emptyMessage="Sin datos de intenciones"
              valuePrefix=""
              valueSuffix="%"
            />
          </CardContent>
        </Card>
      </div>

      {/* AI Performance Summary */}
      <Card variant="bordered" className="bg-gradient-to-br from-slate-50 to-slate-100">
        <CardContent className="py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3">
                <span className="text-3xl">🤖</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{safeData.aiHandlingRate}%</p>
              <p className="text-sm text-slate-500">Resuelto por AI</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3">
                <span className="text-3xl">⚡</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{safeData.avgResponseTime}s</p>
              <p className="text-sm text-slate-500">Tiempo Respuesta</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3">
                <span className="text-3xl">✅</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{safeData.resolvedRate}%</p>
              <p className="text-sm text-slate-500">Tasa de Resolución</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3">
                <span className="text-3xl">📈</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{100 - safeData.escalatedRate}%</p>
              <p className="text-sm text-slate-500">Sin Escalación</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
