'use client';

// =====================================================
// TIS TIS PLATFORM - Section Group Component
// Agrupa visualmente secciones relacionadas con estilo Apple
// =====================================================

import { ReactNode } from 'react';

// ======================
// TYPES
// ======================

interface SectionGroupProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconGradient?: string;
  children: ReactNode;
  className?: string;
}

// ======================
// COMPONENT
// ======================

export function SectionGroup({
  title,
  subtitle,
  icon,
  iconGradient = 'from-slate-500 to-slate-600',
  children,
  className = '',
}: SectionGroupProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center gap-3 px-1">
        {icon && (
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow-sm`}>
            <span className="text-white">{icon}</span>
          </div>
        )}
        <div>
          <h2 className="text-base font-bold text-slate-800 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Section Content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

export default SectionGroup;
