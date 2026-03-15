import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FunnelIQLogo from "@/components/FunnelIQLogo";

export function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Email ou senha incorretos.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background admin-bg p-4">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-2xl bg-card shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <FunnelIQLogo size={48} />
          <h1 className="text-xl font-bold tracking-tight">FunnelIQ</h1>
          <p className="text-xs text-muted-foreground">Painel administrativo</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
