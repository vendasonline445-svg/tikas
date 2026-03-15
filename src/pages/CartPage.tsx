import { useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/use-cart";
import { Trash2 } from "lucide-react";

export default function CartPage() {
  const { items, totalCents, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  const formatPrice = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (items.length === 0) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-4xl">🛒</p>
      <p className="text-muted-foreground">Seu carrinho está vazio</p>
      <button onClick={() => navigate("/loja")} className="text-primary text-sm font-medium">
        ← Continuar comprando
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-foreground">← Voltar</button>
        <h1 className="text-base font-semibold">Meu Carrinho ({items.length})</h1>
        <button onClick={clearCart} className="text-xs text-destructive">Limpar</button>
      </header>

      <div className="p-4 space-y-3">
        {items.map(item => (
          <div key={item.productId} className="flex gap-3 bg-card border border-border rounded-xl p-3">
            <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden shrink-0">
              {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-2">{item.name}</p>
              {item.variant && (
                <p className="text-xs text-muted-foreground">
                  {Object.entries(item.variant).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                </p>
              )}
              <p className="text-base font-bold mt-1">{formatPrice(item.priceCents)}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm"
                >-</button>
                <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-sm"
                >+</button>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="ml-auto text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-bold">{formatPrice(totalCents)}</span>
        </div>
        <button
          onClick={() => {
            // fiq_cart is already saved via CartProvider, checkout reads it directly
            navigate('/checkout');
          }}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-base"
        >
          Finalizar compra • {formatPrice(totalCents)}
        </button>
      </div>
    </div>
  );
}
