// =====================================================
// TIS TIS PLATFORM - Dashboard Layout
// =====================================================

import { DashboardLayout } from '@/src/features/dashboard';

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
