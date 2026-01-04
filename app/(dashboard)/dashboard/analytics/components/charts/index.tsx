// =====================================================
// TIS TIS PLATFORM - Analytics Charts Components
// Reusable chart components with TIS TIS styling
// =====================================================

'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { cn } from '@/src/shared/utils';

// ======================
// CHART COLORS (TIS TIS Palette)
// ======================
export const CHART_COLORS = {
  primary: '#DF7373',      // TIS Coral
  secondary: '#8B5CF6',    // Purple
  success: '#10B981',      // Green
  warning: '#F59E0B',      // Amber
  danger: '#EF4444',       // Red
  info: '#06B6D4',         // Cyan
  blue: '#3B82F6',         // Blue
  pink: '#EC4899',         // Pink
  slate: '#64748B',        // Slate
};

export const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.blue,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.secondary,
  CHART_COLORS.info,
];

// ======================
// CUSTOM TOOLTIP
// ======================
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey?: string;
  }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}

export function CustomTooltip({ active, payload, label, formatter }: TooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-slate-100">
        {label && <p className="text-sm font-medium text-slate-900 mb-2">{label}</p>}
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-semibold text-slate-900">
              {formatter ? formatter(entry.value, entry.name) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// ======================
// LOADING SKELETON
// ======================
export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className={`flex items-center justify-center`} style={{ height }}>
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-tis-coral rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Cargando datos...</span>
      </div>
    </div>
  );
}

// ======================
// EMPTY STATE
// ======================
export function ChartEmpty({ message = 'No hay datos para mostrar', height = 280 }: { message?: string; height?: number }) {
  return (
    <div className={`flex items-center justify-center text-slate-400`} style={{ height }}>
      <div className="text-center">
        <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm font-medium">{message}</p>
        <p className="text-xs mt-1">Los datos aparecerán cuando tengas actividad</p>
      </div>
    </div>
  );
}

// ======================
// AREA CHART COMPONENT
// ======================
interface AreaChartData {
  label: string;
  [key: string]: string | number;
}

interface AreaChartProps {
  data: AreaChartData[];
  areas: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  height?: number;
  loading?: boolean;
  showLegend?: boolean;
  formatter?: (value: number, name: string) => string;
}

export function TISAreaChart({ data, areas, height = 320, loading, showLegend = true, formatter }: AreaChartProps) {
  if (loading) return <ChartSkeleton height={height} />;
  if (!data || data.length === 0) return <ChartEmpty height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {areas.map((area) => (
            <linearGradient key={area.dataKey} id={`gradient-${area.dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={area.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={area.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748B', fontSize: 12 }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748B', fontSize: 12 }}
          dx={-10}
        />
        <Tooltip content={<CustomTooltip formatter={formatter} />} />
        {showLegend && (
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
          />
        )}
        {areas.map((area) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name}
            stroke={area.color}
            strokeWidth={2.5}
            fillOpacity={1}
            fill={`url(#gradient-${area.dataKey})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ======================
// PIE CHART COMPONENT
// ======================
interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  height?: number;
  loading?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
}

export function TISPieChart({
  data,
  height = 220,
  loading,
  innerRadius = 50,
  outerRadius = 80,
  showLegend = false
}: PieChartProps) {
  const filteredData = useMemo(() => data.filter(item => item.value > 0), [data]);

  if (loading) return <ChartSkeleton height={height} />;
  if (filteredData.length === 0) return <ChartEmpty height={height} message="No hay datos para mostrar" />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={filteredData}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={4}
          dataKey="value"
        >
          {filteredData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  );
}

// ======================
// BAR CHART COMPONENT
// ======================
interface BarChartData {
  name: string;
  value: number;
  fill?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  loading?: boolean;
  layout?: 'horizontal' | 'vertical';
  barSize?: number;
  showValues?: boolean;
}

export function TISBarChart({
  data,
  height = 220,
  loading,
  layout = 'vertical',
  barSize = 24,
  showValues = false
}: BarChartProps) {
  const filteredData = useMemo(() => data.filter(item => item.value > 0), [data]);

  if (loading) return <ChartSkeleton height={height} />;
  if (filteredData.length === 0) return <ChartEmpty height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={filteredData}
        layout={layout}
        margin={{ left: layout === 'vertical' ? 20 : 0, right: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={layout === 'vertical'} vertical={layout === 'horizontal'} />
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
              width={100}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
          </>
        )}
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="value"
          radius={layout === 'vertical' ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          barSize={barSize}
          label={showValues ? { position: 'right', fill: '#64748B', fontSize: 12 } : false}
        >
          {filteredData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill || PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ======================
// LINE CHART COMPONENT
// ======================
interface LineChartProps {
  data: AreaChartData[];
  lines: Array<{
    dataKey: string;
    name: string;
    color: string;
  }>;
  height?: number;
  loading?: boolean;
  showLegend?: boolean;
}

export function TISLineChart({ data, lines, height = 280, loading, showLegend = true }: LineChartProps) {
  if (loading) return <ChartSkeleton height={height} />;
  if (!data || data.length === 0) return <ChartEmpty height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748B', fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748B', fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && (
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
          />
        )}
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={2.5}
            dot={{ fill: line.color, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: line.color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ======================
// METRIC CARD COMPONENT
// ======================
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  iconBgColor = 'bg-slate-100',
  trend = 'neutral',
  loading,
  size = 'md',
}: MetricCardProps) {
  const sizeClasses = {
    sm: { value: 'text-xl', title: 'text-xs', padding: 'p-3' },
    md: { value: 'text-2xl', title: 'text-sm', padding: 'p-4' },
    lg: { value: 'text-3xl', title: 'text-sm', padding: 'p-5' },
  };

  const trendColors = {
    up: 'text-emerald-600 bg-emerald-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-slate-600 bg-slate-50',
  };

  if (loading) {
    return (
      <div className={cn('bg-white rounded-xl border border-slate-200 animate-pulse', sizeClasses[size].padding)}>
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-3" />
        <div className="h-8 bg-slate-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-slate-200 rounded w-1/3" />
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow', sizeClasses[size].padding)}>
      <div className="flex items-start justify-between mb-2">
        <span className={cn('text-slate-500 font-medium', sizeClasses[size].title)}>{title}</span>
        {icon && (
          <div className={cn('p-2 rounded-lg', iconBgColor)}>
            {icon}
          </div>
        )}
      </div>
      <p className={cn('font-bold text-slate-900 mb-1', sizeClasses[size].value)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {(change !== undefined || changeLabel) && (
        <div className="flex items-center gap-2">
          {change !== undefined && (
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', trendColors[trend])}>
              {change > 0 ? '+' : ''}{change}%
            </span>
          )}
          {changeLabel && (
            <span className="text-xs text-slate-500">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ======================
// PROGRESS BAR
// ======================
interface ProgressBarProps {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ label, value, maxValue = 100, color = 'bg-tis-coral', showPercentage = true }: ProgressBarProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-slate-900 font-bold">
          {showPercentage ? `${Math.round(percentage)}%` : value.toLocaleString()}
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ======================
// RANKING LIST
// ======================
interface RankingItem {
  rank: number;
  name: string;
  value: number | string;
  subValue?: string;
  icon?: React.ReactNode;
}

interface RankingListProps {
  items: RankingItem[];
  loading?: boolean;
  emptyMessage?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

export function RankingList({ items, loading, emptyMessage = 'Sin datos', valuePrefix = '', valueSuffix = '' }: RankingListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-6 h-6 bg-slate-200 rounded" />
            <div className="flex-1 h-4 bg-slate-200 rounded" />
            <div className="w-16 h-4 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.rank} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
          <div className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
            item.rank === 1 ? 'bg-amber-100 text-amber-700' :
            item.rank === 2 ? 'bg-slate-200 text-slate-700' :
            item.rank === 3 ? 'bg-orange-100 text-orange-700' :
            'bg-slate-100 text-slate-500'
          )}>
            {item.rank}
          </div>
          {item.icon && <div className="text-slate-400">{item.icon}</div>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
            {item.subValue && <p className="text-xs text-slate-500">{item.subValue}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">
              {valuePrefix}{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}{valueSuffix}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
