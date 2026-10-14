export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
