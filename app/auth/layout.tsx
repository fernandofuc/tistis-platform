// =====================================================
// TIS TIS PLATFORM - Auth Layout
// Minimal layout for auth pages
// =====================================================

import Header from "@/components/layout/Header";

export default function AuthLayout({
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
