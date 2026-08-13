import { OptimizationProvider } from "@/providers/optimization-provider";
import { AuthGate } from "@/components/auth/auth-gate";

export default function OptimizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <OptimizationProvider>{children}</OptimizationProvider>
    </AuthGate>
  );
}
