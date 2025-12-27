// =====================================================
// TIS TIS PLATFORM - Security Section Component
// Handles password change, forgot password, and account management
// =====================================================

'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, Button, Input, Badge } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';

export function SecuritySection() {
  const { user } = useAuthContext();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Forgot password state
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Password validation
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }
    if (!/[A-Z]/.test(password)) {
      return 'La contraseña debe contener al menos una mayúscula';
    }
    if (!/[a-z]/.test(password)) {
      return 'La contraseña debe contener al menos una minúscula';
    }
    if (!/\d/.test(password)) {
      return 'La contraseña debe contener al menos un número';
    }
    return null;
  };

  // Handle password change
  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Todos los campos son requeridos');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cambiar la contraseña');
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Auto-hide success message after 5 seconds
      setTimeout(() => setPasswordSuccess(false), 5000);

    } catch (error: any) {
      setPasswordError(error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle forgot password - send reset email
  const handleForgotPassword = async () => {
    if (!user?.email) {
      setResetError('No se encontró tu email');
      return;
    }

    setSendingReset(true);
    setResetError(null);

    const redirectUrl = `${window.location.origin}/auth/reset-password`;
    console.log('🔐 [Password Reset] Starting reset for:', user.email);
    console.log('🔐 [Password Reset] Redirect URL:', redirectUrl);

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: redirectUrl,
      });

      console.log('🔐 [Password Reset] Supabase response:', { data, error });

      if (error) {
        console.error('🔐 [Password Reset] Error:', error);
        throw error;
      }

      console.log('🔐 [Password Reset] Success! Email should be sent.');
      setResetSent(true);
      // Auto-hide after 10 seconds
      setTimeout(() => setResetSent(false), 10000);

    } catch (error: any) {
      console.error('🔐 [Password Reset] Catch error:', error);
      setResetError(error.message || 'Error al enviar el email');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <Card variant="bordered">
      <CardHeader title="Seguridad" subtitle="Protege tu cuenta" />
      <CardContent>
        <div className="space-y-8">
          {/* Password Change Section */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Cambiar Contraseña</h4>

            {/* Success Message */}
            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Contraseña actualizada correctamente</span>
              </div>
            )}

            {/* Error Message */}
            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">{passwordError}</span>
              </div>
            )}

            <div className="space-y-4 max-w-md">
              <Input
                label="Contraseña Actual"
                type="password"
                placeholder="Ingresa tu contraseña actual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                label="Nueva Contraseña"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Debe contener mayúsculas, minúsculas y números"
              />
              <Input
                label="Confirmar Nueva Contraseña"
                type="password"
                placeholder="Repite la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <div className="flex items-center justify-between">
                <Button
                  onClick={handleChangePassword}
                  isLoading={changingPassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword}
                >
                  Actualizar Contraseña
                </Button>
              </div>
            </div>
          </div>

          {/* Forgot Password Section */}
          <div className="pt-6 border-t border-gray-100">
            <h4 className="font-medium text-gray-900 mb-2">¿Olvidaste tu contraseña?</h4>
            <p className="text-sm text-gray-500 mb-4">
              Te enviaremos un enlace a tu correo electrónico para restablecer tu contraseña.
            </p>

            {resetSent && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium">
                  Email enviado a {user?.email}. Revisa tu bandeja de entrada.
                </span>
              </div>
            )}

            {resetError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">{resetError}</span>
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleForgotPassword}
              isLoading={sendingReset}
              disabled={resetSent}
            >
              Enviar Email de Recuperación
            </Button>
          </div>

          {/* Active Sessions */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">Sesiones Activas</h4>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Esta sesión</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Navegador web - Activa ahora</p>
                </div>
                <Badge variant="success">Actual</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
