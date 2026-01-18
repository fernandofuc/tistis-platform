// =====================================================
// TIS TIS PLATFORM - Modal Component
// =====================================================

'use client';

import { useEffect, useCallback } from 'react';
import { cn } from '@/shared/utils';

// ======================
// TYPES
// ======================
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

// ======================
// ICONS
// ======================
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ======================
// COMPONENT
// ======================
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  // Handle escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closeOnEscape) {
      onClose();
    }
  }, [onClose, closeOnEscape]);

  // Add/remove escape listener and body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  // Size classes - mobile-first: full width on small screens, constrained on larger
  const sizeClasses = {
    sm: 'max-w-[calc(100vw-2rem)] sm:max-w-sm',
    md: 'max-w-[calc(100vw-2rem)] sm:max-w-md',
    lg: 'max-w-[calc(100vw-2rem)] sm:max-w-lg',
    xl: 'max-w-[calc(100vw-2rem)] sm:max-w-2xl',
    full: 'max-w-[calc(100vw-2rem)] sm:max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Container - Scrollable wrapper for centering */}
      {/* pointer-events-none allows clicks to pass through to backdrop */}
      <div className="fixed inset-0 overflow-y-auto pointer-events-none">
        <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
          <div
            className={cn(
              'relative w-full bg-white rounded-xl shadow-2xl pointer-events-auto',
              'transform transition-all max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)]',
              'flex flex-col',
              sizeClasses[size]
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
          >
            {/* Header */}
            {(title || subtitle) && (
              <div className="flex items-start justify-between p-4 sm:p-5 border-b border-gray-100 flex-shrink-0">
                <div className="pr-2">
                  {title && (
                    <h3 id="modal-title" className="text-base sm:text-lg font-semibold text-gray-900">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-xs sm:text-sm text-gray-500">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg active:scale-95 transition-all -mr-2 -mt-1 flex-shrink-0"
                >
                  <CloseIcon />
                </button>
              </div>
            )}

            {/* Content - Scrollable area */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl flex-shrink-0">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
