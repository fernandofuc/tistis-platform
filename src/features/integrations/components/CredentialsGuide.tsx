// =====================================================
// TIS TIS PLATFORM - Credentials Guide Component
// Helps users obtain SQL Server credentials for Soft Restaurant
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================

interface CredentialsGuideProps {
  onClose?: () => void;
  compact?: boolean;
}

type AuthMethodType = 'sql' | 'windows' | 'unknown';

// ======================
// ICONS
// ======================

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function CommandLineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ======================
// COPY BUTTON
// ======================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        copied
          ? 'text-green-600 dark:text-green-400'
          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
      )}
      aria-label={copied ? 'Copiado' : 'Copiar al portapapeles'}
    >
      {copied ? (
        <CheckIcon className="w-4 h-4" />
      ) : (
        <ClipboardIcon className="w-4 h-4" />
      )}
    </button>
  );
}

// ======================
// CODE BLOCK
// ======================

function CodeBlock({ code, language = 'sql' }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <pre className="p-3 bg-gray-900 dark:bg-[#1a1a1a] text-gray-100 rounded-lg text-xs font-mono overflow-x-auto">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

// ======================
// EXPANDABLE SECTION
// ======================

interface ExpandableSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function ExpandableSection({ title, icon: Icon, children, defaultOpen = false }: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 dark:border-[#404040] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-[#262626] hover:bg-gray-100 dark:hover:bg-[#303030] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-tis-coral" />
          <span className="font-medium text-gray-900 dark:text-white">{title}</span>
        </div>
        <ChevronDownIcon
          className={cn(
            'w-5 h-5 text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div className="p-4 space-y-4 border-t border-gray-200 dark:border-[#404040]">
          {children}
        </div>
      )}
    </div>
  );
}

// ======================
// AUTH METHOD SELECTOR
// ======================

interface AuthMethodSelectorProps {
  selected: AuthMethodType;
  onSelect: (method: AuthMethodType) => void;
}

function AuthMethodSelector({ selected, onSelect }: AuthMethodSelectorProps) {
  const methods = [
    {
      id: 'sql' as const,
      label: 'SQL Server Authentication',
      description: 'Usuario y contraseña de SQL Server',
      recommended: true,
    },
    {
      id: 'windows' as const,
      label: 'Windows Authentication',
      description: 'Usa las credenciales de Windows',
      recommended: false,
    },
    {
      id: 'unknown' as const,
      label: 'No sé qué método tengo',
      description: 'Te ayudamos a identificarlo',
      recommended: false,
    },
  ];

  return (
    <div className="space-y-2">
      {methods.map((method) => (
        <label
          key={method.id}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
            selected === method.id
              ? 'border-tis-coral bg-tis-coral/5 dark:bg-tis-coral/10'
              : 'border-gray-200 dark:border-[#404040] hover:border-gray-300 dark:hover:border-[#505050]'
          )}
        >
          <input
            type="radio"
            name="authMethod"
            value={method.id}
            checked={selected === method.id}
            onChange={() => onSelect(method.id)}
            className="mt-1 w-4 h-4 text-tis-coral border-gray-300 focus:ring-tis-coral"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">{method.label}</span>
              {method.recommended && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                  Recomendado
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{method.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function CredentialsGuide({ onClose, compact = false }: CredentialsGuideProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethodType>('sql');

  // SQL script to create read-only user
  const createUserScript = `-- Crear usuario con permisos de solo lectura
USE master;
GO

-- Crear login de SQL Server
CREATE LOGIN TisTisAgent
WITH PASSWORD = 'TuContrasenaSegura123!';
GO

-- Conectar a la base de datos de Soft Restaurant
USE SoftRestaurant;
GO

-- Crear usuario en la base de datos
CREATE USER TisTisAgent FOR LOGIN TisTisAgent;
GO

-- Otorgar permisos de lectura
EXEC sp_addrolemember 'db_datareader', 'TisTisAgent';
GO`;

  const findDatabaseScript = `-- Encontrar la base de datos de Soft Restaurant
SELECT name
FROM sys.databases
WHERE name LIKE '%Soft%'
   OR name LIKE '%Restaurant%'
   OR name LIKE '%SR%';`;

  const testConnectionScript = `-- Probar conexión (ejecutar como TisTisAgent)
SELECT TOP 1 * FROM Ventas;
SELECT TOP 1 * FROM Productos;`;

  // Content based on auth method
  const renderAuthMethodContent = () => {
    switch (authMethod) {
      case 'sql':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
              <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                SQL Server Authentication
              </h5>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Necesitas un usuario y contraseña de SQL Server. Si no tienes uno, puedes crear
                un usuario nuevo con permisos de solo lectura.
              </p>
            </div>

            <ExpandableSection title="Opción 1: Usar credenciales existentes" icon={KeyIcon} defaultOpen>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Si ya tienes credenciales de SQL Server (como las que usa Soft Restaurant),
                  puedes usarlas directamente:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-tis-coral font-bold">1.</span>
                    <span>Busca en la carpeta de instalación de Soft Restaurant el archivo de configuración</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-tis-coral font-bold">2.</span>
                    <span>Ubicación típica: <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#404040] rounded text-xs">C:\SoftRestaurant\SR.ini</code> o <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#404040] rounded text-xs">SR.config</code></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-tis-coral font-bold">3.</span>
                    <span>Busca líneas como <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#404040] rounded text-xs">User ID=</code> y <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#404040] rounded text-xs">Password=</code></span>
                  </li>
                </ul>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Opción 2: Crear usuario nuevo (recomendado)" icon={UserIcon}>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Puedes crear un usuario de solo lectura para TIS TIS. Esto es más seguro ya que
                  limita los permisos al mínimo necesario.
                </p>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Paso 1: Abre SQL Server Management Studio
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Conéctate como administrador (sa) o un usuario con permisos de administrador.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Paso 2: Ejecuta este script SQL
                  </p>
                  <CodeBlock code={createUserScript} language="sql" />
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/30">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Importante:</strong> Cambia <code className="px-1 bg-amber-100 dark:bg-amber-900/40 rounded">TuContrasenaSegura123!</code> por una contraseña segura.
                    También verifica que el nombre de la base de datos sea correcto (puede variar según tu instalación).
                  </p>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Encontrar nombre de la base de datos" icon={ServerIcon}>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Si no conoces el nombre exacto de la base de datos, ejecuta este script:
                </p>
                <CodeBlock code={findDatabaseScript} language="sql" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Los nombres más comunes son: <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#404040] rounded text-xs">SoftRestaurant</code>,
                  <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#404040] rounded text-xs">SR</code>,
                  <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#404040] rounded text-xs">SRData</code>
                </p>
              </div>
            </ExpandableSection>
          </div>
        );

      case 'windows':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800/30">
              <h5 className="font-medium text-purple-800 dark:text-purple-300 mb-2">
                Windows Authentication
              </h5>
              <p className="text-sm text-purple-700 dark:text-purple-400">
                El agente usará las credenciales del usuario de Windows bajo el cual se ejecuta el servicio.
                Necesitas asegurarte de que ese usuario tenga permisos de lectura en SQL Server.
              </p>
            </div>

            <ExpandableSection title="Configurar permisos de Windows" icon={ShieldCheckIcon} defaultOpen>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Para usar Windows Authentication, el usuario de Windows necesita tener permisos en SQL Server:
                </p>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Paso 1: Identifica el usuario del servicio
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    El servicio TIS TIS Agent se ejecuta como <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#404040] rounded text-xs">NT SERVICE\TisTisAgent</code> o como el usuario de Windows actual.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Paso 2: Otorga permisos en SQL Server
                  </p>
                  <CodeBlock
                    code={`-- Agregar usuario de Windows a SQL Server
USE master;
GO

-- Reemplaza 'DOMINIO\\Usuario' con el usuario correcto
CREATE LOGIN [DOMINIO\\Usuario] FROM WINDOWS;
GO

USE SoftRestaurant;
GO

CREATE USER [DOMINIO\\Usuario] FOR LOGIN [DOMINIO\\Usuario];
EXEC sp_addrolemember 'db_datareader', 'DOMINIO\\Usuario';
GO`}
                    language="sql"
                  />
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    <strong>Nota:</strong> Si el agente se ejecuta en el mismo servidor que SQL Server,
                    y SQL Server está configurado para Windows Authentication, esto suele funcionar automáticamente.
                  </p>
                </div>
              </div>
            </ExpandableSection>
          </div>
        );

      case 'unknown':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                Identificar el tipo de autenticación
              </h5>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sigue estos pasos para identificar qué tipo de autenticación usa tu instalación de Soft Restaurant.
              </p>
            </div>

            <ExpandableSection title="Verificar configuración actual" icon={DocumentTextIcon} defaultOpen>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Paso 1: Busca el archivo de configuración
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                    <li>• Abre el Explorador de Windows</li>
                    <li>• Navega a la carpeta de instalación de Soft Restaurant</li>
                    <li>• Busca archivos como <code className="px-1 bg-gray-100 dark:bg-[#404040] rounded text-xs">SR.ini</code>, <code className="px-1 bg-gray-100 dark:bg-[#404040] rounded text-xs">SR.config</code>, o <code className="px-1 bg-gray-100 dark:bg-[#404040] rounded text-xs">appsettings.json</code></li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Paso 2: Busca la cadena de conexión
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Busca líneas que contengan <code className="px-1 bg-gray-100 dark:bg-[#404040] rounded text-xs">Connection</code> o <code className="px-1 bg-gray-100 dark:bg-[#404040] rounded text-xs">Server=</code>
                  </p>
                </div>

                <div className="grid gap-3 mt-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      Si ves <code className="px-1 bg-blue-100 dark:bg-blue-900/40 rounded text-xs">User ID=</code> y <code className="px-1 bg-blue-100 dark:bg-blue-900/40 rounded text-xs">Password=</code>
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                      Usa <strong>SQL Server Authentication</strong>
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800/30">
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                      Si ves <code className="px-1 bg-purple-100 dark:bg-purple-900/40 rounded text-xs">Integrated Security=True</code> o <code className="px-1 bg-purple-100 dark:bg-purple-900/40 rounded text-xs">Trusted_Connection=Yes</code>
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                      Usa <strong>Windows Authentication</strong>
                    </p>
                  </div>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Verificar desde SQL Server Management Studio" icon={CommandLineIcon}>
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Si tienes acceso a SQL Server Management Studio, puedes verificar cómo está configurado:
                </p>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 ml-4">
                  <li>1. Abre SQL Server Management Studio</li>
                  <li>2. Intenta conectar con tu usuario de Windows (Windows Authentication)</li>
                  <li>3. Si funciona, tu SQL Server acepta Windows Authentication</li>
                  <li>4. Si pide usuario y contraseña, necesitas SQL Server Authentication</li>
                </ol>
              </div>
            </ExpandableSection>
          </div>
        );
    }
  };

  return (
    <div className={cn('space-y-6', compact && 'space-y-4')}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tis-coral/20 to-tis-pink/20 flex items-center justify-center flex-shrink-0">
          <KeyIcon className="w-6 h-6 text-tis-coral" />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
            Guía de Credenciales SQL Server
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            El agente necesita acceso a la base de datos de Soft Restaurant para sincronizar datos.
          </p>
        </div>
      </div>

      {/* Auth Method Selection */}
      <div className="space-y-3">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          ¿Qué tipo de autenticación usas?
        </h5>
        <AuthMethodSelector selected={authMethod} onSelect={setAuthMethod} />
      </div>

      {/* Auth Method Specific Content */}
      {renderAuthMethodContent()}

      {/* Test Connection */}
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/30">
        <h5 className="font-medium text-green-800 dark:text-green-300 mb-2">
          Verificar conexión
        </h5>
        <p className="text-sm text-green-700 dark:text-green-400 mb-3">
          Después de configurar las credenciales, puedes verificar que funcionan ejecutando:
        </p>
        <CodeBlock code={testConnectionScript} language="sql" />
      </div>

      {/* Support Note */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>¿Necesitas ayuda?</strong> Nuestro equipo de soporte puede asistirte con la configuración.
          Contáctanos en <a href="mailto:soporte@tistis.com" className="text-tis-coral hover:underline">soporte@tistis.com</a>
        </p>
      </div>
    </div>
  );
}

export default CredentialsGuide;
