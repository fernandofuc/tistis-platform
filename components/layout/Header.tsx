'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Container from './Container';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/lib/auth';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'signup' | 'login'>('signup');
  const { user, signOut, loading } = useAuth();

  // Detectar scroll (opcional para efectos)
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openSignup = () => {
    setAuthModalView('signup');
    setAuthModalOpen(true);
  };

  const openLogin = () => {
    setAuthModalView('login');
    setAuthModalOpen(true);
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all ${
        isScrolled ? 'bg-tis-bg-primary/80 backdrop-blur-md shadow-sm' : 'bg-tis-bg-primary/80 backdrop-blur-md'
      }`}
      style={{ height: '72px' }}
    >
      <Container>
        <nav className="flex items-center justify-between h-[72px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/logos/tis-brain-logo.png"
              alt="TIS TIS Brain Logo"
              width={48}
              height={48}
              className="h-12 w-auto object-contain"
            />
            <Image
              src="/logos/tis-text-logo.png"
              alt="TIS TIS"
              width={60}
              height={24}
              className="h-6 w-auto object-contain"
            />
          </Link>

          {/* Links Centro */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/pricing"
              className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium"
            >
              Planes
            </Link>
            <Link
              href="/como-funciona"
              className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium"
            >
              Cómo funciona
            </Link>
            <Link
              href="/catalyst"
              className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium flex items-center gap-1.5"
            >
              Catalyst
              <span className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-tis-coral/15 to-tis-pink/15 text-tis-coral rounded-full font-semibold uppercase tracking-wide">
                Pronto
              </span>
            </Link>
            <Link
              href="/genesis"
              className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium flex items-center gap-1.5"
            >
              Genesis
              <span className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-blue-500/15 via-purple-500/15 to-tis-pink/15 text-purple-500 rounded-full font-semibold uppercase tracking-wide">
                2028+
              </span>
            </Link>
          </div>

          {/* Botones Derecha */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-20 h-8 bg-gray-100 animate-pulse rounded-lg" />
            ) : user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    console.log('🔵 Dashboard button clicked, navigating...');
                    window.location.href = '/dashboard';
                  }}
                >
                  Dashboard
                </Button>
                <Button variant="primary" size="sm" onClick={signOut}>
                  Cerrar Sesión
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={openLogin}>
                  Iniciar Sesión
                </Button>
                <Button variant="primary" size="sm" onClick={openSignup}>
                  Crear Cuenta
                </Button>
              </>
            )}
          </div>
        </nav>
      </Container>

      {/* Border bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-black/5" />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialView={authModalView}
      />
    </header>
  );
}
