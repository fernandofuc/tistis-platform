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

    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-6',
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
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, subtitle, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-start justify-between mb-4', className)}
        {...props}
      >
        <div>
          {title && (
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          )}
          {children}
        </div>
        {action && <div className="ml-4 flex-shrink-0">{action}</div>}
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
