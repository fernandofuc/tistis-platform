'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import Button from '@/components/ui/Button';
import Container from './Container';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  // Detectar scroll (opcional para efectos)
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
              width={40}
              height={40}
              className="h-10 w-auto object-contain"
            />
            <Image
              src="/logos/tis-text-logo.png"
              alt="TIS TIS"
              width={80}
              height={32}
              className="h-7 w-auto"
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
              href="/#como-funciona"
              className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium"
            >
              Cómo funciona
            </Link>
            <Link
              href="/#casos"
              className="text-tis-text-primary hover:text-tis-coral transition-colors font-medium"
            >
              Casos de éxito
            </Link>
          </div>

          {/* Botones Derecha */}
          <div className="flex items-center gap-3">
            <button
              className="p-2 hover:bg-tis-bg-secondary rounded-lg transition-colors"
              title="Sistema de Referidos"
            >
              <Gift className="w-5 h-5 text-tis-text-primary" />
            </button>
            <Button variant="ghost" size="sm">
              Iniciar Sesión
            </Button>
            <Button variant="primary" size="sm">
              Crear Cuenta
            </Button>
          </div>
        </nav>
      </Container>

      {/* Border bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-black/5" />
    </header>
  );
}
