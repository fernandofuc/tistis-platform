// =====================================================
// TIS TIS PLATFORM - Dashboard Layout
// =====================================================

// Prevent static generation - dashboard requires authentication
export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/src/features/dashboard';

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
