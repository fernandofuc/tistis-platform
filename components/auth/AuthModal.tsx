'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/lib/auth';

type AuthView = 'signup' | 'login' | 'email-signup' | 'email-login';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthView;
}

export function AuthModal({ isOpen, onClose, initialView = 'signup' }: AuthModalProps) {
  const [currentView, setCurrentView] = useState<AuthView>(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we're on the client for Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentView(initialView);
      setError(null);
      setEmail('');
      setPassword('');
      setIsAnimating(true);
    }
  }, [isOpen, initialView]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('🔵 Initiating Google OAuth flow');
      console.log('Redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('🔴 Google OAuth Error:', {
          message: error.message,
          status: (error as any).status,
          cause: (error as any).cause,
        });
        throw error;
      }

      console.log('🟡 Google OAuth initiated - redirecting to provider');
    } catch (err: any) {
      const errorMsg = err.message || 'Error al conectar con Google';
      console.error('🔴 Google Auth Exception:', errorMsg, err);
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const handleGitHubAuth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      console.log('🔵 Initiating GitHub OAuth flow');
      console.log('Redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('🔴 GitHub OAuth Error:', {
          message: error.message,
          status: (error as any).status,
          cause: (error as any).cause,
        });
        throw error;
      }

      console.log('🟡 GitHub OAuth initiated - redirecting to provider');
    } catch (err: any) {
      const errorMsg = err.message || 'Error al conectar con GitHub';
      console.error('🔴 GitHub Auth Exception:', errorMsg, err);
      setError(errorMsg);
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (currentView === 'email-signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });
        if (error) throw error;
        // Show success message or redirect
        onClose();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = useCallback((view: AuthView) => {
    setIsAnimating(false);
    setTimeout(() => {
      setCurrentView(view);
      setError(null);
      setIsAnimating(true);
    }, 150);
  }, []);

  // Don't render on server or if modal is closed
  if (!mounted || !isOpen) return null;

  const isSignup = currentView === 'signup' || currentView === 'email-signup';
  const isEmailView = currentView === 'email-signup' || currentView === 'email-login';

  // Use createPortal to render modal at document.body level
  return createPortal(
    <>
      {/* Overlay - covers entire viewport */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - centered in viewport */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className={`
          fixed z-[9999] bg-white shadow-2xl
          w-[calc(100%-2rem)] max-w-[456px] p-10
          top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          rounded-2xl
          sm:w-[456px]
          max-sm:w-[calc(100%-2rem)] max-sm:p-6 max-sm:max-h-[90vh] max-sm:overflow-y-auto
          transition-all duration-300 ease-out
          ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.96]'}
        `}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md active:scale-95 transition-all"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Content */}
        <div className={`transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image
              src="/logos/tis-brain-logo.png"
              alt="TIS TIS Logo"
              width={40}
              height={40}
              className="w-10 h-10"
            />
          </div>

          {/* Heading */}
          <h2
            id="auth-modal-title"
            className="text-[30px] font-bold text-gray-900 text-center mb-2 tracking-tight leading-9"
          >
            Start Building.
          </h2>

          {/* Subheading */}
          <p className="text-lg text-gray-500 text-center mb-8">
            {isSignup ? 'Create free account' : 'Log in to your account'}
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {!isEmailView ? (
            /* Social Auth View */
            <>
              {/* Google Button */}
              <button
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full h-12 flex items-center justify-center gap-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all mb-3 relative disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-[15px] font-medium text-gray-900">
                  Continue with Google
                </span>
                <span className="absolute right-3 text-[11px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                  Last used
                </span>
              </button>

              {/* GitHub Button */}
              <button
                onClick={handleGitHubAuth}
                disabled={isLoading}
                className="w-full h-12 flex items-center justify-center gap-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#111827">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="text-[15px] font-medium text-gray-900">
                  Continue with GitHub
                </span>
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-[13px] font-medium text-gray-400">
                    OR
                  </span>
                </div>
              </div>

              {/* Email Button */}
              <button
                onClick={() => switchView(isSignup ? 'email-signup' : 'email-login')}
                disabled={isLoading}
                className="w-full h-12 flex items-center justify-center bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors mb-6 text-[15px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue with email
              </button>
            </>
          ) : (
            /* Email Form View */
            <>
              {/* Social shortcuts */}
              <button
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full h-12 flex items-center justify-center gap-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all mb-3 relative disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-[15px] font-medium text-gray-900">
                  Continue with Google
                </span>
                <span className="absolute right-3 text-[11px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                  Last used
                </span>
              </button>

              <button
                onClick={handleGitHubAuth}
                disabled={isLoading}
                className="w-full h-12 flex items-center justify-center gap-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#111827">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="text-[15px] font-medium text-gray-900">
                  Continue with GitHub
                </span>
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-[13px] font-medium text-gray-400">
                    OR
                  </span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailSubmit}>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:border-[#C23350] focus:ring-2 focus:ring-[#C23350]/10 outline-none transition-all text-[15px]"
                  />
                </div>

                <div className="mb-6">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:border-[#C23350] focus:ring-2 focus:ring-[#C23350]/10 outline-none transition-all text-[15px]"
                  />
                </div>

                {/* Terms */}
                <p className="text-xs text-gray-500 text-center mb-6 leading-[18px]">
                  By continuing, you agree to the{' '}
                  <a href="/terms" className="text-gray-900 underline hover:text-gray-600">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-gray-900 underline hover:text-gray-600">
                    Privacy Policy
                  </a>
                  .
                </p>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 flex items-center justify-center bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors mb-5 text-[15px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Loading...' : 'Continue'}
                </button>
              </form>
            </>
          )}

          {/* Footer */}
          {!isEmailView && (
            <p className="text-xs text-gray-500 text-center leading-[18px]">
              By continuing, you agree to the{' '}
              <a href="/terms" className="text-gray-900 underline hover:text-gray-600">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-gray-900 underline hover:text-gray-600">
                Privacy Policy
              </a>
              .
            </p>
          )}

          {/* Switch between login/signup */}
          <p className="text-sm text-gray-500 text-center mt-5">
            {isSignup ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => switchView('login')}
                  className="text-gray-900 underline font-medium hover:text-gray-600"
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => switchView('signup')}
                  className="text-gray-900 underline font-medium hover:text-gray-600"
                >
                  Sign up
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}
