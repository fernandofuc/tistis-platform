// =====================================================
// TIS TIS Catalyst - Layout with SEO Metadata
// =====================================================

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TIS TIS Catalyst - Capital sin bancos | Proximamente',
  description:
    'Tokeniza tus proyectos de expansion y accede a inversionistas que confian en tus datos reales verificados por TIS TIS. Sin bancos. Sin ceder equity.',
  keywords: [
    'tokenizacion',
    'capital',
    'expansion negocios',
    'inversion',
    'fintech',
    'TIS TIS',
    'catalyst',
  ],
  openGraph: {
    title: 'TIS TIS Catalyst - Capital sin bancos',
    description:
      'Tokeniza tus proyectos de expansion y accede a inversionistas que confian en tus datos reales.',
    type: 'website',
    locale: 'es_MX',
    siteName: 'TIS TIS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TIS TIS Catalyst - Capital sin bancos',
    description:
      'Tokeniza tus proyectos de expansion. Sin bancos. Sin ceder equity.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CatalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
