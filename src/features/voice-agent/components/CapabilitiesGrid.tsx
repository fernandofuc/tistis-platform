'use client';

/**
 * TIS TIS Platform - Voice Agent
 * CapabilitiesGrid Component
 *
 * Displays capabilities organized by category in a visual grid.
 * Shows which capabilities are included, not included, or new (for comparisons).
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CalendarCheck,
  UtensilsCrossed,
  ShoppingBag,
  Calendar,
  Stethoscope,
  Shield,
  AlertTriangle,
  Headphones,
} from 'lucide-react';
import type { Capability } from '@/lib/voice-agent/types';
import {
  getCategoriesForVertical,
  type CapabilityCategory,
} from '../constants/capability-display';
import { CapabilityBadgeCompact } from './CapabilityBadge';

// =====================================================
// ICON MAP
// =====================================================

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  CalendarCheck,
  UtensilsCrossed,
  ShoppingBag,
  Headphones,
  Calendar,
  Stethoscope,
  Shield,
  AlertTriangle,
};

// =====================================================
// TYPES
// =====================================================

interface CapabilitiesGridProps {
  vertical: 'restaurant' | 'dental';
  includedCapabilities: Capability[];
  highlightNew?: Capability[];
  showCategories?: boolean;
  compact?: boolean;
  className?: string;
}

// =====================================================
// COMPONENT
// =====================================================

export function CapabilitiesGrid({
  vertical,
  includedCapabilities,
  highlightNew = [],
  showCategories = true,
  compact = false,
  className = '',
}: CapabilitiesGridProps) {
  const categories = useMemo(() => {
    return getCategoriesForVertical(vertical);
  }, [vertical]);

  // Filter categories to only show those with at least one capability
  const relevantCategories = useMemo(() => {
    return categories.filter((category) =>
      category.capabilities.some(
        (cap) => includedCapabilities.includes(cap) || highlightNew.includes(cap)
      )
    );
  }, [categories, includedCapabilities, highlightNew]);

  // Get all capabilities that should be shown (for non-category view)
  const allCapabilities = useMemo(() => {
    const caps = new Set<Capability>();
    categories.forEach((cat) => {
      cat.capabilities.forEach((cap) => {
        if (includedCapabilities.includes(cap) || highlightNew.includes(cap)) {
          caps.add(cap);
        }
      });
    });
    return Array.from(caps);
  }, [categories, includedCapabilities, highlightNew]);

  if (!showCategories) {
    // Simple flat grid without categories
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <AnimatePresence mode="popLayout">
          {allCapabilities.map((capability) => (
            <motion.div
              key={capability}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <CapabilityBadgeCompact
                capability={capability}
                isIncluded={includedCapabilities.includes(capability)}
                isNew={highlightNew.includes(capability)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  // Grid with categories
  return (
    <div className={`space-y-4 ${className}`}>
      <AnimatePresence mode="popLayout">
        {relevantCategories.map((category, index) => (
          <CategorySection
            key={category.id}
            category={category}
            includedCapabilities={includedCapabilities}
            highlightNew={highlightNew}
            compact={compact}
            delay={index * 0.05}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// =====================================================
// CATEGORY SECTION
// =====================================================

interface CategorySectionProps {
  category: CapabilityCategory;
  includedCapabilities: Capability[];
  highlightNew: Capability[];
  compact: boolean;
  delay: number;
}

function CategorySection({
  category,
  includedCapabilities,
  highlightNew,
  compact,
  delay,
}: CategorySectionProps) {
  const IconComponent = CATEGORY_ICON_MAP[category.icon];

  // Filter to show only relevant capabilities
  const visibleCapabilities = category.capabilities.filter(
    (cap) => includedCapabilities.includes(cap) || highlightNew.includes(cap)
  );

  if (visibleCapabilities.length === 0) {
    return null;
  }

  // Count included vs total
  const includedCount = visibleCapabilities.filter((cap) =>
    includedCapabilities.includes(cap)
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay }}
      className="group"
    >
      {/* Category Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 group-hover:bg-slate-200 transition-colors">
          {IconComponent && (
            <IconComponent className="w-3.5 h-3.5 text-slate-500" />
          )}
        </div>
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          {category.name}
        </span>
        <span className="text-xs text-slate-400">
          ({includedCount}/{visibleCapabilities.length})
        </span>
      </div>

      {/* Capabilities */}
      <div className={`flex flex-wrap gap-1.5 ${compact ? 'ml-0' : 'ml-8'}`}>
        {visibleCapabilities.map((capability) => (
          <CapabilityBadgeCompact
            key={capability}
            capability={capability}
            isIncluded={includedCapabilities.includes(capability)}
            isNew={highlightNew.includes(capability)}
          />
        ))}
      </div>
    </motion.div>
  );
}

// =====================================================
// COMPARISON GRID (for modal)
// =====================================================

interface CapabilitiesComparisonProps {
  vertical: 'restaurant' | 'dental';
  currentCapabilities: Capability[];
  newCapabilities: Capability[];
  className?: string;
}

export function CapabilitiesComparison({
  vertical,
  currentCapabilities,
  newCapabilities,
  className = '',
}: CapabilitiesComparisonProps) {
  // Find capabilities that are new (in new but not in current)
  const addedCapabilities = useMemo(() => {
    return newCapabilities.filter((cap) => !currentCapabilities.includes(cap));
  }, [currentCapabilities, newCapabilities]);

  // Find capabilities that would be removed (in current but not in new)
  const removedCapabilities = useMemo(() => {
    return currentCapabilities.filter((cap) => !newCapabilities.includes(cap));
  }, [currentCapabilities, newCapabilities]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Added Capabilities */}
      {addedCapabilities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">
              Nuevas capacidades ({addedCapabilities.length})
            </span>
          </div>
          <CapabilitiesGrid
            vertical={vertical}
            includedCapabilities={addedCapabilities}
            highlightNew={addedCapabilities}
            showCategories={false}
          />
        </div>
      )}

      {/* Removed Capabilities */}
      {removedCapabilities.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-700">
              Capacidades que se perderán ({removedCapabilities.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {removedCapabilities.map((capability) => (
              <CapabilityBadgeCompact
                key={capability}
                capability={capability}
                isIncluded={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Kept Capabilities */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-sm font-medium text-slate-600">
            Capacidades incluidas
          </span>
        </div>
        <CapabilitiesGrid
          vertical={vertical}
          includedCapabilities={newCapabilities.filter(
            (cap) => !addedCapabilities.includes(cap)
          )}
          showCategories={false}
        />
      </div>
    </div>
  );
}

export default CapabilitiesGrid;
