import { useAuth } from "@/hooks/use-auth";
import { AdminLogin } from "@/components/AdminLogin";
import FunnelIQLogo from "@/components/FunnelIQLogo";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <FunnelIQLogo size={48} />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) return <AdminLogin />;
  return <>{children}</>;
}
