import Link from 'next/link';
import Image from 'next/image';
import Container from './Container';

export default function Footer() {
  return (
    <footer className="bg-tis-text-primary text-white py-12">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo y descripción */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <Image
                src="/logos/tis-brain-logo.png"
                alt="TIS TIS"
                width={48}
                height={48}
                className="h-12 w-auto object-contain"
              />
              <Image
                src="/logos/tis-text-logo.png"
                alt="TIS TIS"
                width={80}
                height={32}
                className="h-8 w-auto brightness-0 invert"
              />
            </div>
            <p className="text-gray-400 max-w-md">
              Tu negocio en piloto automático. Implementa el mejor cerebro digital
              y vuélvelo autónomo.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Producto</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-white transition-colors">
                  Planes y Precios
                </Link>
              </li>
              <li>
                <Link href="/#como-funciona" className="text-gray-400 hover:text-white transition-colors">
                  Cómo Funciona
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                  Privacidad
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                  Términos
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} TIS TIS. Todos los derechos reservados.</p>
        </div>
      </Container>
    </footer>
  );
}
