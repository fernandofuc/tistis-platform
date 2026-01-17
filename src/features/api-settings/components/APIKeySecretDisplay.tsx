// =====================================================
// TIS TIS PLATFORM - API Key Secret Display Component
// Shows the API key secret (only displayed once after creation)
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import { Button } from '@/shared/components/ui/Button';

// ======================
// ICONS
// ======================

const CopyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// ======================
// TYPES
// ======================

export interface APIKeySecretDisplayProps {
  apiKey: string;
  keyName: string;
  onClose?: () => void;
  className?: string;
}

// ======================
// COMPONENT
// ======================

export function APIKeySecretDisplay({
  apiKey,
  keyName,
  onClose,
  className,
}: APIKeySecretDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const maskKey = (key: string): string => {
    if (key.length <= 12) return '•'.repeat(key.length);
    return key.slice(0, 8) + '•'.repeat(key.length - 12) + key.slice(-4);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex-shrink-0 text-amber-600">
          <WarningIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-800">
            Guarda esta API Key de forma segura
          </p>
          <p className="text-sm text-amber-700 mt-1">
            No podrás ver esta key completa de nuevo. Cópiala ahora y guárdala en un lugar seguro.
          </p>
        </div>
      </div>

      {/* Key Display */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          API Key para &quot;{keyName}&quot;
        </label>
        <div className="relative">
          <div className="flex items-center gap-2 p-4 bg-gray-900 rounded-xl">
            <code className="flex-1 text-sm sm:text-base text-green-400 font-mono break-all">
              {visible ? apiKey : maskKey(apiKey)}
            </code>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <Button
              variant={copied ? 'success' : 'primary'}
              size="md"
              onClick={handleCopy}
              leftIcon={copied ? <CheckIcon /> : <CopyIcon />}
              className="flex-1"
            >
              {copied ? 'Copiada!' : 'Copiar API Key'}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setVisible(!visible)}
              leftIcon={visible ? <EyeOffIcon /> : <EyeIcon />}
            >
              {visible ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Security Tips */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h4 className="font-medium text-gray-900 mb-2">Recomendaciones de seguridad:</h4>
        <ul className="text-sm text-gray-600 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">•</span>
            <span>Almacena la key en variables de entorno, nunca en el código</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">•</span>
            <span>No compartas la key en repositorios públicos</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">•</span>
            <span>Rota las keys periódicamente para mayor seguridad</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">•</span>
            <span>Usa keys de test para desarrollo y keys live para producción</span>
          </li>
        </ul>
      </div>

      {/* Close Button */}
      {onClose && (
        <Button
          variant="secondary"
          size="md"
          onClick={onClose}
          className="w-full"
        >
          He guardado mi API Key
        </Button>
      )}
    </div>
  );
}

// ======================
// COMPACT VERSION (for inline display)
// ======================

export interface APIKeySecretInlineProps {
  apiKey: string;
  className?: string;
}

export function APIKeySecretInline({ apiKey, className }: APIKeySecretInlineProps) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const maskKey = (key: string): string => {
    if (key.length <= 12) return '•'.repeat(key.length);
    return key.slice(0, 8) + '•'.repeat(key.length - 12) + key.slice(-4);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <code className="flex-1 p-2 bg-gray-900 text-green-400 text-sm font-mono rounded-lg truncate">
        {visible ? apiKey : maskKey(apiKey)}
      </code>
      <button
        onClick={() => setVisible(!visible)}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title={visible ? 'Ocultar' : 'Mostrar'}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
      <button
        onClick={handleCopy}
        className={cn(
          'p-2 rounded-lg transition-colors',
          copied
            ? 'text-green-600 bg-green-50'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        )}
        title={copied ? 'Copiada!' : 'Copiar'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}
