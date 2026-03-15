import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/hooks/use-products";

function StoreAdminContent() {
  const { products, loading, refresh } = useProducts();

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("products").update({ active: !active }).eq("id", id);
    refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold">Admin da Loja</h1>
        <a href="/loja" className="text-xs text-primary">Ver loja →</a>
      </header>

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            {products.length} produto(s)
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
        ) : (
          <div className="space-y-2">
            {products.map((p: any) => (
              <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden shrink-0">
                  {p.images?.[0]?.url && (
                    <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(p.price_cents)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(p.id, p.active)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.active ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {p.active ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoreAdmin() {
  return (
    <ProtectedRoute>
      <StoreAdminContent />
    </ProtectedRoute>
  );
}
