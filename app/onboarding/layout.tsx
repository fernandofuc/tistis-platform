// =====================================================
// TIS TIS PLATFORM - Onboarding Layout
// Minimal layout for onboarding flow
// =====================================================

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gray-50">
      {children}
    </main>
  );
}
