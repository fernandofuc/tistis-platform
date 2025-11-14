export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Este layout para /pricing NO incluye Header ni Footer
  // El HTML embebido en el iframe tiene su propio header
  return <>{children}</>;
}
