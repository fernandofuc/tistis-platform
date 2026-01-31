// =====================================================
// TIS TIS PLATFORM - Schema Validation Status Component
// Displays the schema validation results in the agent wizard
// =====================================================

'use client';

import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================

export interface SchemaValidationData {
  success: boolean;
  validatedAt?: string;
  databaseName?: string;
  srVersionDetected?: string;
  tablesFound: number;
  tablesMissing: number;
  totalTablesExpected: number;
  canSyncSales: boolean;
  canSyncMenu: boolean;
  canSyncInventory: boolean;
  canSyncTables: boolean;
  errors: string[];
  warnings: string[];
  missingRequiredTables?: string[];
}

interface SchemaValidationStatusProps {
  validation: SchemaValidationData | null;
  isValidating: boolean;
  onRetry?: () => void;
}

// ======================
// ICONS
// ======================

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}

// ======================
// FEATURE ITEM
// ======================

interface FeatureItemProps {
  name: string;
  enabled: boolean;
  reason?: string;
}

function FeatureItem({ name, enabled, reason }: FeatureItemProps) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg',
      enabled
        ? 'bg-green-50 dark:bg-green-900/20'
        : 'bg-gray-50 dark:bg-gray-800/50'
    )}>
      {enabled ? (
        <CheckCircleIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
      ) : (
        <XCircleIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
      )}
      <span className={cn(
        'text-sm font-medium',
        enabled
          ? 'text-green-700 dark:text-green-300'
          : 'text-gray-500 dark:text-gray-400'
      )}>
        {name}
      </span>
      {!enabled && reason && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {reason}
        </span>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function SchemaValidationStatus({
  validation,
  isValidating,
  onRetry,
}: SchemaValidationStatusProps) {
  // Loading state
  if (isValidating) {
    return (
      <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
            <SpinnerIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-300">Validando schema de base de datos...</p>
            <p className="text-sm text-blue-600 dark:text-blue-400">Verificando tablas y columnas requeridas</p>
          </div>
        </div>
      </div>
    );
  }

  // No validation yet
  if (!validation) {
    return (
      <div className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <DatabaseIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">Validación de schema pendiente</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              El agente validará el schema cuando se conecte por primera vez
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Validation success
  if (validation.success) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="p-5 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
              <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-800 dark:text-green-300">Schema validado correctamente</p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-0.5">
                Base de datos compatible con TIS TIS
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <span className="px-2 py-1 bg-white dark:bg-green-900/40 rounded-md text-green-700 dark:text-green-300">
                  <strong>{validation.tablesFound}</strong> / {validation.totalTablesExpected} tablas encontradas
                </span>
                {validation.srVersionDetected && (
                  <span className="px-2 py-1 bg-white dark:bg-green-900/40 rounded-md text-green-700 dark:text-green-300">
                    {validation.srVersionDetected}
                  </span>
                )}
                {validation.databaseName && (
                  <span className="px-2 py-1 bg-white dark:bg-green-900/40 rounded-md text-green-700 dark:text-green-300">
                    {validation.databaseName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Features available */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Funcionalidades disponibles</p>
          <div className="grid grid-cols-2 gap-2">
            <FeatureItem
              name="Ventas"
              enabled={validation.canSyncSales}
              reason={!validation.canSyncSales ? 'Tablas faltantes' : undefined}
            />
            <FeatureItem
              name="Menú"
              enabled={validation.canSyncMenu}
              reason={!validation.canSyncMenu ? 'Tabla Productos faltante' : undefined}
            />
            <FeatureItem
              name="Inventario"
              enabled={validation.canSyncInventory}
              reason={!validation.canSyncInventory ? 'Tabla Inventario faltante' : undefined}
            />
            <FeatureItem
              name="Mesas"
              enabled={validation.canSyncTables}
              reason={!validation.canSyncTables ? 'Tabla Mesas faltante' : undefined}
            />
          </div>
        </div>

        {/* Warnings */}
        {validation.warnings.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/30">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Advertencias</p>
                <ul className="text-xs text-amber-600 dark:text-amber-400 mt-1 space-y-0.5">
                  {validation.warnings.slice(0, 3).map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                  {validation.warnings.length > 3 && (
                    <li>• y {validation.warnings.length - 3} más...</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Validation failed
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
            <XCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-800 dark:text-red-300">Validación de schema fallida</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
              Faltan tablas requeridas para la sincronización
            </p>
            {validation.missingRequiredTables && validation.missingRequiredTables.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {validation.missingRequiredTables.map((table) => (
                  <span
                    key={table}
                    className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-md font-mono"
                  >
                    {table}
                  </span>
                ))}
              </div>
            )}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 text-sm font-medium text-red-700 dark:text-red-300 underline hover:no-underline"
              >
                Reintentar validación
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Errors list */}
      {validation.errors.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Errores detectados:</p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            {validation.errors.map((error, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-red-500">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Recomendaciones:</p>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
          <li>• Verifica que estás conectado a la base de datos correcta de Soft Restaurant</li>
          <li>• Asegúrate de que el usuario SQL tiene permisos de lectura en todas las tablas</li>
          <li>• Si usas una versión anterior de SR, contacta soporte para verificar compatibilidad</li>
        </ul>
      </div>
    </div>
  );
}

export default SchemaValidationStatus;
