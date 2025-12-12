// =====================================================
// TIS TIS PLATFORM - Marketing Layout
// For landing pages, pricing, etc. (with Header/Footer)
// =====================================================

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
