// =====================================================
// TIS TIS PLATFORM - Card Component (Premium Design)
// =====================================================

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils';

// ======================
// CARD
// ======================
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated' | 'premium' | 'hero';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', hover = true, children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-white shadow-card border border-slate-200/50',
      bordered: 'bg-white border border-slate-200 shadow-card',
      elevated: 'bg-white shadow-card-elevated',
      premium: 'card-premium',
      hero: 'card-hero text-white',
    };

    // Padding responsive - less on mobile, more on desktop
    const paddingStyles = {
      none: '',
      sm: 'p-2.5 sm:p-3',
      md: 'p-4 sm:p-5',
      lg: 'p-4 sm:p-6',
    };

    const hoverStyles = hover && variant !== 'hero'
      ? 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5'
      : '';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl',
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// ======================
// CARD HEADER (Premium Typography)
// ======================
export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, subtitle, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-start justify-between mb-3 sm:mb-4 gap-2', className)}
        {...props}
      >
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h3>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 line-clamp-2">{subtitle}</p>
          )}
          {children}
        </div>
        {action && <div className="ml-2 sm:ml-4 flex-shrink-0">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// ======================
// CARD CONTENT
// ======================
export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('', className)} {...props} />
));

CardContent.displayName = 'CardContent';

// ======================
// CARD FOOTER
// ======================
export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center mt-4 pt-4 border-t border-slate-100', className)}
    {...props}
  />
));

CardFooter.displayName = 'CardFooter';
