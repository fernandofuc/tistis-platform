// =====================================================
// TIS TIS Genesis - Layout with SEO Metadata
// Preparacion para integracion robotica - Vision 2028+
// =====================================================

import type { Metadata } from 'next';

// =====================================================
// SEO Configuration
// Optimized for Genesis landing page - robotics integration
// =====================================================

export const metadata: Metadata = {
  title: 'TIS TIS Genesis - Prepara tu negocio para robots | Vision 2028+',
  description:
    'Acumula datos operativos hoy para integrar robots de servicio manana. Robot-Ready Score, analisis de tareas automatizables y preparacion continua. Sin costo adicional.',
  keywords: [
    'robots de servicio',
    'automatizacion',
    'inteligencia artificial',
    'robot ready',
    'integracion robotica',
    'TIS TIS',
    'genesis',
    'futuro del trabajo',
    'datos operativos',
    'machine learning',
    'pre-entrenamiento',
  ],
  openGraph: {
    title: 'TIS TIS Genesis - Prepara tu negocio para robots',
    description:
      'Acumula datos operativos hoy para integrar robots de servicio manana. Vision 2028+.',
    type: 'website',
    locale: 'es_MX',
    siteName: 'TIS TIS',
    images: [
      {
        url: '/images/genesis/robot-optimus.jpg',
        width: 1200,
        height: 2125,
        alt: 'TIS TIS Genesis - Preparacion robotica',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TIS TIS Genesis - Prepara tu negocio para robots',
    description:
      'Acumula datos operativos hoy. Integra robots manana. Vision 2028+.',
    images: ['/images/genesis/robot-optimus.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/genesis',
  },
};

// =====================================================
// Layout Component
// Simple passthrough for children with consistent structure
// =====================================================

export default function GenesisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
