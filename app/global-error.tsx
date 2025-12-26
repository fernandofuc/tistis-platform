'use client';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="es">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
            {/* Error Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 24px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* Title */}
            <h2
              style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '12px',
              }}
            >
              Error del servidor
            </h2>

            {/* Description */}
            <p style={{ color: '#64748b', marginBottom: '32px' }}>
              Ha ocurrido un error crítico. Estamos trabajando para solucionarlo.
            </p>

            {/* Error ID */}
            {error.digest && (
              <p
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginBottom: '24px',
                }}
              >
                Error ID: {error.digest}
              </p>
            )}

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={reset}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#f97066',
                  color: 'white',
                  fontWeight: '500',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Intentar de nuevo
              </button>
              <a
                href="/"
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#475569',
                  fontWeight: '500',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  textDecoration: 'none',
                }}
              >
                Ir al inicio
              </a>
            </div>

            {/* Contact */}
            <p style={{ marginTop: '32px', fontSize: '14px', color: '#94a3b8' }}>
              Si el problema persiste, contacta a{' '}
              <a href="mailto:soporte@tistis.com" style={{ color: '#f97066' }}>
                soporte@tistis.com
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
