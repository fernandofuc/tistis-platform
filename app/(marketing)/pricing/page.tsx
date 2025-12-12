import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TIS TIS - Planes y Precios',
  description: 'Planes y precios de TIS TIS. Configura tu sistema y ve el precio en tiempo real.',
};

export default function PricingPage() {
  return (
    <iframe
      src="/pricing-tistis.html"
      className="w-full h-screen border-0"
      title="TIS TIS - Planes y Precios"
    />
  );
}
