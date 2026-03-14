import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

const ADMIN_PASSWORD = "12345";

interface Pixel {
  id: string;
  name: string;
  pixel_id: string;
  api_token: string;
  status: string;
  created_at: string;
}

const AdminTikTok = () => {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("admin_auth") === "true");
  const [password, setPassword] = useState("");
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [form, setForm] = useState({ name: "", pixel_id: "", api_token: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (authed) fetchPixels();
  }, [authed]);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_auth", "true");
      setAuthed(true);
    } else {
      toast({ title: "Senha incorreta", variant: "destructive" });
    }
  };

  const fetchPixels = async () => {
    setLoading(true);
    // Select all pixels (including inactive) — we need a broader policy or use service role
    // Since anon can only select active, we'll use a workaround: select all statuses
    const { data, error } = await supabase
      .from("tiktok_pixels")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching pixels:", error);
    }
    setPixels((data as Pixel[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.name || !form.pixel_id || !form.api_token) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("tiktok_pixels").insert({
      name: form.name,
      pixel_id: form.pixel_id,
      api_token: form.api_token,
      status: "active",
    });
    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pixel adicionado!" });
      setForm({ name: "", pixel_id: "", api_token: "" });
      fetchPixels();
    }
    setAdding(false);
  };

  const toggleStatus = async (pixel: Pixel) => {
    const newStatus = pixel.status === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("tiktok_pixels")
      .update({ status: newStatus })
      .eq("id", pixel.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      fetchPixels();
    }
  };

  const deletePixel = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este pixel?")) return;
    const { error } = await supabase.from("tiktok_pixels").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } else {
      fetchPixels();
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-center">Admin TikTok Pixels</h1>
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <Button onClick={handleLogin} className="w-full">Entrar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-bold text-sm">TikTok Pixels</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl p-4 space-y-6">
        {/* Add Pixel Form */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" /> Adicionar Pixel
          </h2>
          <Input
            placeholder="Nome do Pixel (ex: Campanha Principal)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Pixel ID (ex: D6GM4RBC77UAAN00B800)"
            value={form.pixel_id}
            onChange={(e) => setForm({ ...form, pixel_id: e.target.value })}
          />
          <Input
            placeholder="Events API Access Token"
            value={form.api_token}
            onChange={(e) => setForm({ ...form, api_token: e.target.value })}
            type="password"
          />
          <Button onClick={handleAdd} disabled={adding} className="w-full">
            {adding ? "Adicionando..." : "Adicionar Pixel"}
          </Button>
        </div>

        {/* Pixel List */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Pixels cadastrados ({pixels.length})</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : pixels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pixel cadastrado.</p>
          ) : (
            pixels.map((px) => (
              <div
                key={px.id}
                className={`rounded-xl border p-4 space-y-2 ${
                  px.status === "active" ? "bg-card" : "bg-muted/30 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{px.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{px.pixel_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleStatus(px)} title="Alternar status">
                      {px.status === "active" ? (
                        <ToggleRight className="h-6 w-6 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                      )}
                    </button>
                    <button onClick={() => deletePixel(px.id)} title="Remover">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    px.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {px.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                  <span className="text-muted-foreground">
                    Token: {px.api_token.slice(0, 8)}...
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTikTok;
