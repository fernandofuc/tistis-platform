// =====================================================
// TIS TIS PLATFORM - Checkout Layout
// Minimal layout for checkout flow (no footer)
// =====================================================

import Header from "@/components/layout/Header";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
    </>
  );
}
