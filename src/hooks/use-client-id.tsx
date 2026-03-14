import { useAuth } from "@/hooks/use-auth";

export function useClientId() {
  const { profile, isSuperAdmin, isAdmin } = useAuth();

  return {
    clientId: profile?.client_id ?? null,
    // superadmin and admin see everything — no client_id filter
    shouldFilter: !isSuperAdmin && !isAdmin,
  };
}
