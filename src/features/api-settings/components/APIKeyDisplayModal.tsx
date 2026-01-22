// =====================================================
// TIS TIS PLATFORM - API Key Display Modal
// Shows the newly created API Key (one-time display)
// =====================================================

'use client';

import { useState } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils';

// ======================
// TYPES
// ======================

interface APIKeyDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  keyName: string;
}

// ======================
// ICONS
// ======================

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

// ======================
// COMPONENT
// ======================

export function APIKeyDisplayModal({
  isOpen,
  onClose,
  apiKey,
  keyName,
}: APIKeyDisplayModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="API Key Creada Exitosamente"
      subtitle={`Tu API Key "${keyName}" ha sido creada`}
      size="lg"
      closeOnBackdrop={false}
      closeOnEscape={false}
    >
      <div className="space-y-6">
        {/* Warning Alert */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex-shrink-0 text-amber-600 mt-0.5">
            <AlertIcon />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-amber-900 mb-1">
              Guarda esta API Key de forma segura
            </h4>
            <p className="text-sm text-amber-700">
              Esta es la <strong>única vez</strong> que podrás ver esta API Key completa.
              Guárdala en un lugar seguro (como un gestor de contraseñas) antes de cerrar esta ventana.
            </p>
          </div>
        </div>

        {/* API Key Display */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Tu API Key
          </label>
          <div className="relative">
            <div
              className={cn(
                'p-4 bg-gray-900 rounded-lg border-2 transition-colors',
                'font-mono text-sm break-all select-all',
                copied ? 'border-green-500 text-green-400' : 'border-gray-700 text-gray-100'
              )}
            >
              {apiKey}
            </div>
            <button
              onClick={handleCopy}
              className={cn(
                'absolute top-2 right-2 p-2 rounded-md transition-all',
                'hover:bg-white/10 active:scale-95',
                copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-800 text-gray-300 hover:text-white'
              )}
              title={copied ? 'Copiado!' : 'Copiar API Key'}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Cómo usar tu API Key</h4>
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <p className="text-sm text-gray-700">
              Incluye tu API Key en el header <code className="px-1.5 py-0.5 bg-white rounded text-xs">Authorization</code> de tus requests:
            </p>
            <pre className="p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
{`curl -X GET 'https://api.tistis.com/v1/leads' \\
  -H 'Authorization: Bearer ${apiKey}'`}
            </pre>
          </div>
        </div>

        {/* Security Tips */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Consejos de Seguridad</h4>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-tis-coral mt-0.5">•</span>
              <span>Nunca compartas tu API Key públicamente ni la subas a repositorios de código</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-tis-coral mt-0.5">•</span>
              <span>Usa variables de entorno para almacenar tu API Key en tus aplicaciones</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-tis-coral mt-0.5">•</span>
              <span>Si crees que tu API Key fue comprometida, revócala inmediatamente y crea una nueva</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-tis-coral mt-0.5">•</span>
              <span>Revisa regularmente el uso de tus API Keys en el panel de analytics</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={handleCopy}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <CopyIcon />
            <span className="ml-2">{copied ? '¡Copiado!' : 'Copiar API Key'}</span>
          </Button>
          <Button onClick={onClose} className="w-full sm:w-auto">
            Entendido, Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
