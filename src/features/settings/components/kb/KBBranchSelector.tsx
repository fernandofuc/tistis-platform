// =====================================================
// TIS TIS PLATFORM - KB Branch Selector Premium
// Premium branch filter with animations
// Part of Knowledge Base Redesign - FASE 1.3
// =====================================================

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================
interface Branch {
  id: string;
  name: string;
  is_headquarters?: boolean;
  is_active?: boolean;
}

interface Props {
  branches: Branch[];
  selectedBranchId: string | null;
  onBranchSelect: (branchId: string | null) => void;
  className?: string;
}

// ======================
// ICONS
// ======================
const LocationIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const GlobeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const StarIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

// ======================
// BRANCH CHIP
// ======================
function BranchChip({
  branch,
  isSelected,
  onClick,
  isAll = false,
}: {
  branch?: Branch;
  isSelected: boolean;
  onClick: () => void;
  isAll?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
        isSelected
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
          : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300 hover:shadow-md'
      )}
    >
      {/* Icon */}
      <span className={cn(
        'flex-shrink-0 transition-transform',
        isSelected && 'scale-110'
      )}>
        {isAll ? <GlobeIcon /> : branch?.is_headquarters ? <BuildingIcon /> : <LocationIcon />}
      </span>

      {/* Label */}
      <span className="truncate max-w-[120px]">
        {isAll ? 'Todas las Sucursales' : branch?.name}
      </span>

      {/* Headquarters badge */}
      {branch?.is_headquarters && !isSelected && (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
          <StarIcon />
          <span className="hidden sm:inline">Matriz</span>
        </span>
      )}

      {/* Selected indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.span
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"
          >
            <CheckIcon />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function KBBranchSelector({
  branches,
  selectedBranchId,
  onBranchSelect,
  className,
}: Props) {
  // Don't render if only one or no branches
  if (!branches || branches.length <= 1) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br from-gray-50 to-white',
        'border border-gray-200/60',
        'p-5',
        className
      )}
    >
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <pattern id="locationGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="currentColor" className="text-purple-500" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#locationGrid)" />
        </svg>
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
            <LocationIcon />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Filtrar por Sucursal
            </h4>
            <p className="text-xs text-gray-500">
              Visualiza el conocimiento específico de cada ubicación
            </p>
          </div>
        </div>

        {/* Branch chips */}
        <div className="flex flex-wrap gap-2">
          {/* All branches option */}
          <BranchChip
            isAll
            isSelected={selectedBranchId === null}
            onClick={() => onBranchSelect(null)}
          />

          {/* Individual branches */}
          {branches.map((branch) => (
            <BranchChip
              key={branch.id}
              branch={branch}
              isSelected={selectedBranchId === branch.id}
              onClick={() => onBranchSelect(branch.id)}
            />
          ))}
        </div>

        {/* Info hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 flex items-center gap-2 text-xs text-gray-500"
        >
          <svg className="w-4 h-4 flex-shrink-0 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Los items sin sucursal asignada se muestran en todas las ubicaciones
          </span>
        </motion.div>

        {/* Selected branch indicator */}
        {selectedBranchId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 rounded-xl bg-purple-50 border border-purple-100"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="text-purple-600 font-medium">
                Mostrando:
              </span>
              <span className="text-purple-800 font-semibold">
                {branches.find(b => b.id === selectedBranchId)?.name}
              </span>
              {branches.find(b => b.id === selectedBranchId)?.is_headquarters && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                  <StarIcon />
                  Matriz
                </span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ======================
// EXPORTS
// ======================
export type { Branch, Props as KBBranchSelectorProps };
