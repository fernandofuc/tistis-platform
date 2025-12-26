import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center max-w-md px-6">
        {/* 404 Number */}
        <h1 className="text-8xl font-bold text-slate-200 mb-4">404</h1>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-slate-800 mb-3">
          Página no encontrada
        </h2>

        {/* Description */}
        <p className="text-slate-600 mb-8">
          Lo sentimos, la página que buscas no existe o ha sido movida.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-tis-coral text-white font-medium rounded-lg hover:bg-tis-coral/90 transition-colors"
          >
            Ir al inicio
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Ir al Dashboard
          </Link>
        </div>

        {/* Help Link */}
        <p className="mt-8 text-sm text-slate-500">
          ¿Necesitas ayuda?{' '}
          <a
            href="mailto:soporte@tistis.com"
            className="text-tis-coral hover:underline"
          >
            Contáctanos
          </a>
        </p>
      </div>
    </div>
  );
}
