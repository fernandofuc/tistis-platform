// =====================================================
// TIS TIS PLATFORM - Avatar Component
// =====================================================

import { forwardRef, type HTMLAttributes } from 'react';
import { cn, initials } from '@/shared/utils';

// ======================
// TYPES
// ======================
export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
}

// ======================
// STYLES
// ======================
const sizeStyles = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

const statusSizeStyles = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

const statusColorStyles = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
};

// Color generator based on name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// ======================
// COMPONENT
// ======================
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, name = '?', size = 'md', status, ...props }, ref) => {
    const displayInitials = initials(name);
    const bgColor = getAvatarColor(name);

    return (
      <div ref={ref} className={cn('relative inline-flex', className)} {...props}>
        {src ? (
          <img
            src={src}
            alt={name}
            className={cn(
              'rounded-full object-cover',
              sizeStyles[size]
            )}
          />
        ) : (
          <div
            className={cn(
              'rounded-full flex items-center justify-center font-medium text-white',
              sizeStyles[size],
              bgColor
            )}
          >
            {displayInitials}
          </div>
        )}
        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full border-2 border-white',
              statusSizeStyles[size],
              statusColorStyles[status]
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// ======================
// AVATAR GROUP
// ======================
export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  avatars: Array<{ src?: string; name: string }>;
  max?: number;
  size?: AvatarProps['size'];
}

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, avatars, max = 4, size = 'md', ...props }, ref) => {
    const visibleAvatars = avatars.slice(0, max);
    const remainingCount = avatars.length - max;

    return (
      <div
        ref={ref}
        className={cn('flex -space-x-2', className)}
        {...props}
      >
        {visibleAvatars.map((avatar, index) => (
          <Avatar
            key={index}
            src={avatar.src}
            name={avatar.name}
            size={size}
            className="ring-2 ring-white"
          />
        ))}
        {remainingCount > 0 && (
          <div
            className={cn(
              'rounded-full flex items-center justify-center font-medium text-gray-600 bg-gray-200 ring-2 ring-white',
              sizeStyles[size]
            )}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';
