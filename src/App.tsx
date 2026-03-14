import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Admin from "./pages/Admin";
import FunilAdmin from "./pages/FunilAdmin";
import TrackingRedirect from "./pages/TrackingRedirect";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import Checkout from "./pages/Checkout";
import PixPayment from "./pages/PixPayment";
import Obrigado from "./pages/Obrigado";
import ObrigadoUpsell from "./pages/ObrigadoUpsell";
import Upsell1 from "./pages/Upsell1";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import TermosDeUso from "./pages/TermosDeUso";
import StoreFront from "./pages/StoreFront";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import StoreAdmin from "./pages/StoreAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/loja" element={<StoreFront />} />
              <Route path="/p/:slug" element={<ProductPage />} />
              <Route path="/carrinho" element={<CartPage />} />
              <Route path="/loja-admin" element={<StoreAdmin />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/pix" element={<PixPayment />} />
              <Route path="/obrigado" element={<Obrigado />} />
              <Route path="/obrigado-upsell" element={<ObrigadoUpsell />} />
              <Route path="/upsell1" element={<Upsell1 />} />
              <Route path="/taxa-alfandega" element={<Upsell1 />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
              <Route path="/termos-de-uso" element={<TermosDeUso />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/funil-admin" element={<FunilAdmin />} />
              <Route path="/r/:trackingId" element={<TrackingRedirect />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
