// =====================================================
// TIS TIS PLATFORM - Skeleton Components
// Premium loading states with smooth animations
// =====================================================

import { cn } from '@/src/shared/utils';

// ======================
// BASE SKELETON
// ======================
export interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded', className)} />
);

// ======================
// SKELETON TEXT
// ======================
export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export const SkeletonText = ({ lines = 1, className }: SkeletonTextProps) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn('h-4', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')}
      />
    ))}
  </div>
);

// ======================
// SKELETON AVATAR
// ======================
export interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const SkeletonAvatar = ({ size = 'md' }: SkeletonAvatarProps) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };
  return <Skeleton className={cn('rounded-full', sizes[size])} />;
};

// ======================
// SKELETON BADGE
// ======================
export interface SkeletonBadgeProps {
  width?: 'sm' | 'md' | 'lg';
}

export const SkeletonBadge = ({ width = 'md' }: SkeletonBadgeProps) => {
  const widths = {
    sm: 'w-12',
    md: 'w-20',
    lg: 'w-28',
  };
  return <Skeleton className={cn('h-5 rounded-full', widths[width])} />;
};

// ======================
// KNOWLEDGE BASE ITEM SKELETON
// ======================
export const KnowledgeBaseItemSkeleton = () => (
  <div className="p-5 bg-white rounded-2xl border-2 border-gray-100">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        {/* Type badge skeleton */}
        <div className="flex items-center gap-2 mb-3">
          <SkeletonBadge width="md" />
          <SkeletonBadge width="sm" />
        </div>

        {/* Title skeleton */}
        <Skeleton className="h-5 w-3/4 mb-2" />

        {/* Content preview skeleton */}
        <SkeletonText lines={2} className="mt-2" />
      </div>

      {/* Action buttons skeleton */}
      <div className="flex gap-2 ml-4">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
    </div>
  </div>
);

// ======================
// KNOWLEDGE BASE LIST SKELETON
// ======================
export interface KnowledgeBaseListSkeletonProps {
  count?: number;
}

export const KnowledgeBaseListSkeleton = ({ count = 3 }: KnowledgeBaseListSkeletonProps) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <KnowledgeBaseItemSkeleton key={i} />
    ))}
  </div>
);

// ======================
// QUICK STATS SKELETON
// ======================
export const QuickStatsSkeleton = () => (
  <div className="mb-6">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div>
          <Skeleton className="h-5 w-40 mb-1.5" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Skeleton className="h-7 w-28 rounded-full" />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-5 gap-3 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 bg-white rounded-xl border border-gray-200">
          <Skeleton className="h-8 w-8 mx-auto mb-2 rounded-lg" />
          <Skeleton className="h-3 w-14 mx-auto" />
        </div>
      ))}
    </div>

    {/* Progress bar */}
    <Skeleton className="h-2 w-full rounded-full" />
  </div>
);

// ======================
// BRANCH CARD SKELETON
// ======================
export const BranchCardSkeleton = () => (
  <div className="p-5 bg-white rounded-xl border border-gray-200">
    <div className="flex items-start gap-4">
      {/* Icon skeleton */}
      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />

      <div className="flex-1">
        {/* Name and badge */}
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-5 w-36" />
          <SkeletonBadge width="sm" />
        </div>

        {/* Address */}
        <Skeleton className="h-4 w-48 mb-1.5" />
        <Skeleton className="h-4 w-32" />

        {/* Staff avatars */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex -space-x-2">
            <SkeletonAvatar size="sm" />
            <SkeletonAvatar size="sm" />
            <SkeletonAvatar size="sm" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
    </div>

    {/* Footer */}
    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-36" />
    </div>
  </div>
);

// ======================
// STAFF CARD SKELETON
// ======================
export const StaffCardSkeleton = () => (
  <div className="p-4 bg-white rounded-xl border border-gray-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Skeleton className="w-11 h-11 rounded-xl" />

        <div>
          <Skeleton className="h-5 w-32 mb-1.5" />
          <Skeleton className="h-4 w-24 mb-1" />
          <SkeletonBadge width="sm" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
    </div>
  </div>
);

// ======================
// TAB NAVIGATION SKELETON
// ======================
export const TabNavigationSkeleton = () => (
  <div className="flex gap-2 mb-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <Skeleton key={i} className="h-10 w-28 rounded-lg" />
    ))}
  </div>
);

// ======================
// FORM SKELETON
// ======================
export const FormFieldSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-10 w-full rounded-xl" />
  </div>
);

export const FormSkeleton = ({ fields = 4 }: { fields?: number }) => (
  <div className="space-y-6">
    {Array.from({ length: fields }).map((_, i) => (
      <FormFieldSkeleton key={i} />
    ))}
  </div>
);

// ======================
// FULL PAGE SKELETON FOR KNOWLEDGE BASE
// ======================
export const KnowledgeBasePageSkeleton = () => (
  <div className="space-y-6">
    {/* Quick Stats */}
    <QuickStatsSkeleton />

    {/* Branch Filter (optional, shows for multi-branch) */}
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
    </div>

    {/* Tab Navigation */}
    <TabNavigationSkeleton />

    {/* Item List */}
    <KnowledgeBaseListSkeleton count={4} />
  </div>
);
