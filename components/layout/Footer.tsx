import Link from 'next/link';
import Image from 'next/image';
import Container from './Container';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-12">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo y descripción */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/logos/tis-brain-logo.png"
                alt="TIS TIS"
                width={40}
                height={40}
                className="h-10 w-auto object-contain"
              />
              <Image
                src="/logos/tis-text-logo.png"
                alt="TIS TIS"
                width={72}
                height={28}
                className="h-7 w-auto object-contain"
              />
            </div>
            <p className="text-slate-500 max-w-md">
              Tu negocio en piloto automatico. Implementa el mejor cerebro digital
              y vuelvelo autonomo.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Producto</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/pricing" className="text-slate-500 hover:text-tis-coral transition-colors">
                  Planes y Precios
                </Link>
              </li>
              <li>
                <Link href="/como-funciona" className="text-slate-500 hover:text-tis-coral transition-colors">
                  Como Funciona
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-slate-500 hover:text-tis-coral transition-colors">
                  Privacidad
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-500 hover:text-tis-coral transition-colors">
                  Terminos
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-500 hover:text-tis-coral transition-colors">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-slate-200 mt-8 pt-8 text-center text-slate-500">
          <p>&copy; {new Date().getFullYear()} TIS TIS. Todos los derechos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}
