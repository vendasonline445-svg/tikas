import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, DollarSign, Target, AlertTriangle, Activity, Users, Zap, Wallet } from "lucide-react";

const db = supabase as any;

type SubTab = "overview" | "campaign_perf" | "creative_perf" | "revenue" | "alerts";

const SUB_TABS: { key: SubTab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
  { key: "campaign_perf", label: "Campanhas", icon: <Target className="h-4 w-4" /> },
  { key: "creative_perf", label: "Criativos", icon: <Activity className="h-4 w-4" /> },
  { key: "revenue", label: "Receita", icon: <DollarSign className="h-4 w-4" /> },
  { key: "alerts", label: "Alertas", icon: <AlertTriangle className="h-4 w-4" /> },
];

const fmtMoney = (v: number) => `R$ ${(v / 100).toFixed(2)}`;
const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "0%";

interface CampaignPerf {
  id: string;
  name: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  conversions: number;
  sessions: number;
  convRate: string;
}

interface CreativePerf {
  id: string;
  name: string;
  campaign: string;
  sessions: number;
  conversions: number;
  revenue: number;
  convRate: string;
}

interface SystemAlert {
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
}

export default function AdminAnalyticsHub({ defaultTab }: { defaultTab?: SubTab }) {
  const [subTab, setSubTab] = useState<SubTab>(defaultTab ?? "overview");
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [attributions, setAttributions] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [campRes, creatRes, attrRes, costRes, sessRes, evRes] = await Promise.all([
      db.from("campaigns").select("*"),
      db.from("creatives").select("*, campaigns(campaign_name)"),
      db.from("attributions").select("*"),
      db.from("campaign_costs").select("*"),
      db.from("sessions").select("session_id, campaign_id, creative_id").limit(1000),
      db.from("events").select("event_name, session_id, value, created_at").in("event_name", ["purchase", "checkout_start", "pix_generated"]).limit(1000),
    ]);
    setCampaigns(campRes.data || []);
    setCreatives(creatRes.data || []);
    setAttributions(attrRes.data || []);
    setCosts(costRes.data || []);
    setSessions(sessRes.data || []);
    setEvents(evRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Campaign Performance ──
  const campaignPerfs = useMemo<CampaignPerf[]>(() => {
    return campaigns.map(c => {
      const campAttr = attributions.filter(a => a.campaign_id === c.id);
      const campCosts = costs.filter(co => co.campaign_id === c.id);
      const campSessions = sessions.filter(s => s.campaign_id === c.id);
      const totalSpend = campCosts.reduce((s: number, co: any) => s + (co.spend || 0), 0);
      const totalRevenue = campAttr.reduce((s: number, a: any) => s + (a.revenue || 0), 0);
      const conversions = campAttr.length;
      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const cpa = conversions > 0 ? totalSpend / conversions : 0;
      return {
        id: c.id,
        name: c.campaign_name,
        spend: totalSpend,
        revenue: totalRevenue,
        roas,
        cpa,
        conversions,
        sessions: campSessions.length,
        convRate: pct(conversions, campSessions.length),
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [campaigns, attributions, costs, sessions]);

  // ── Creative Performance ──
  const creativePerfs = useMemo<CreativePerf[]>(() => {
    return creatives.map(c => {
      const creatAttr = attributions.filter(a => a.creative_id === c.id);
      const creatSessions = sessions.filter(s => s.creative_id === c.id);
      const totalRevenue = creatAttr.reduce((s: number, a: any) => s + (a.revenue || 0), 0);
      return {
        id: c.id,
        name: c.creative_name,
        campaign: c.campaigns?.campaign_name || "—",
        sessions: creatSessions.length,
        conversions: creatAttr.length,
        revenue: totalRevenue,
        convRate: pct(creatAttr.length, creatSessions.length),
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [creatives, attributions, sessions]);

  // ── Overview Totals ──
  const totals = useMemo(() => {
    const totalSpend = costs.reduce((s: number, c: any) => s + (c.spend || 0), 0);
    const totalRevenue = attributions.reduce((s: number, a: any) => s + (a.revenue || 0), 0);
    const totalConversions = attributions.length;
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const convRate = pct(totalConversions, sessions.length);
    return { totalSpend, totalRevenue, totalConversions, roas, cpa, convRate };
  }, [costs, attributions, sessions]);

  // ── Alerts ──
  const alerts = useMemo<SystemAlert[]>(() => {
    const list: SystemAlert[] = [];
    campaignPerfs.forEach(c => {
      if (c.spend > 0 && c.roas < 1) {
        list.push({ type: "critical", title: `ROAS negativo: ${c.name}`, description: `ROAS ${c.roas.toFixed(2)} — Spend ${fmtMoney(c.spend)}, Revenue ${fmtMoney(c.revenue)}` });
      }
      if (c.sessions > 20 && c.conversions === 0) {
        list.push({ type: "warning", title: `Zero conversões: ${c.name}`, description: `${c.sessions} sessões sem nenhuma conversão.` });
      }
      if (c.spend > 0 && c.cpa > 5000) {
        list.push({ type: "warning", title: `CPA alto: ${c.name}`, description: `CPA ${fmtMoney(c.cpa)} está acima do limite recomendado.` });
      }
    });

    // Check for sudden drop in events (last 24h vs previous 24h)
    const now = Date.now();
    const last24h = events.filter(e => new Date(e.created_at).getTime() > now - 86400000).length;
    const prev24h = events.filter(e => {
      const t = new Date(e.created_at).getTime();
      return t > now - 172800000 && t <= now - 86400000;
    }).length;
    if (prev24h > 10 && last24h < prev24h * 0.3) {
      list.push({ type: "critical", title: "Queda brusca de eventos", description: `${last24h} eventos nas últimas 24h vs ${prev24h} no período anterior.` });
    }

    if (list.length === 0) {
      list.push({ type: "info", title: "Sem alertas", description: "Todas as campanhas estão dentro dos parâmetros normais." });
    }
    return list;
  }, [campaignPerfs, events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Analytics Hub</h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${subTab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-muted-foreground py-8">Carregando...</p>}

      {/* ── OVERVIEW ── */}
      {!loading && subTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Spend", value: fmtMoney(totals.totalSpend), icon: <Wallet className="h-4 w-4" /> },
              { label: "Revenue", value: fmtMoney(totals.totalRevenue), icon: <DollarSign className="h-4 w-4" /> },
              { label: "ROAS", value: totals.roas.toFixed(2) + "x", icon: <TrendingUp className="h-4 w-4" /> },
              { label: "CPA", value: fmtMoney(totals.cpa), icon: <Target className="h-4 w-4" /> },
              { label: "Conversões", value: String(totals.totalConversions), icon: <Zap className="h-4 w-4" /> },
              { label: "Conv. Rate", value: totals.convRate, icon: <Users className="h-4 w-4" /> },
            ].map(m => (
              <Card key={m.label}>
                <CardContent className="pt-4 text-center">
                  <div className="flex justify-center mb-1 text-muted-foreground">{m.icon}</div>
                  <p className="text-xl font-bold">{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Top campaigns */}
          <Card>
            <CardHeader><CardTitle className="text-base">Top Campanhas por Receita</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>ROAS</TableHead>
                    <TableHead>Conversões</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignPerfs.slice(0, 5).map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{fmtMoney(c.revenue)}</TableCell>
                      <TableCell><Badge variant={c.roas >= 1 ? "default" : "destructive"}>{c.roas.toFixed(2)}x</Badge></TableCell>
                      <TableCell>{c.conversions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Active alerts */}
          {alerts.filter(a => a.type !== "info").length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas Ativos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {alerts.filter(a => a.type !== "info").map((a, i) => (
                  <div key={i} className={`p-3 rounded-lg text-sm ${a.type === "critical" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-xs opacity-80">{a.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── CAMPAIGN PERFORMANCE ── */}
      {!loading && subTab === "campaign_perf" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Performance por Campanha</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Sessões</TableHead>
                    <TableHead>Conversões</TableHead>
                    <TableHead>Conv. Rate</TableHead>
                    <TableHead>Spend</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>ROAS</TableHead>
                    <TableHead>CPA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignPerfs.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.sessions}</TableCell>
                      <TableCell>{c.conversions}</TableCell>
                      <TableCell>{c.convRate}</TableCell>
                      <TableCell>{fmtMoney(c.spend)}</TableCell>
                      <TableCell className="font-semibold">{fmtMoney(c.revenue)}</TableCell>
                      <TableCell>
                        <Badge variant={c.roas >= 1 ? "default" : "destructive"}>{c.roas.toFixed(2)}x</Badge>
                      </TableCell>
                      <TableCell>{fmtMoney(c.cpa)}</TableCell>
                    </TableRow>
                  ))}
                  {!campaignPerfs.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── CREATIVE PERFORMANCE ── */}
      {!loading && subTab === "creative_perf" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Performance por Criativo</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criativo</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Sessões</TableHead>
                    <TableHead>Conversões</TableHead>
                    <TableHead>Conv. Rate</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creativePerfs.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-xs">{c.campaign}</TableCell>
                      <TableCell>{c.sessions}</TableCell>
                      <TableCell>{c.conversions}</TableCell>
                      <TableCell>{c.convRate}</TableCell>
                      <TableCell className="font-semibold">{fmtMoney(c.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {!creativePerfs.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── REVENUE ── */}
      {!loading && subTab === "revenue" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-emerald-500">{fmtMoney(totals.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Receita Total</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{fmtMoney(totals.totalSpend)}</p>
              <p className="text-xs text-muted-foreground">Investimento Total</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className={`text-2xl font-bold ${totals.totalRevenue - totals.totalSpend >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {fmtMoney(totals.totalRevenue - totals.totalSpend)}
              </p>
              <p className="text-xs text-muted-foreground">Lucro</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Receita por Campanha</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Spend</TableHead>
                    <TableHead>Lucro</TableHead>
                    <TableHead>ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignPerfs.filter(c => c.revenue > 0 || c.spend > 0).map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-emerald-600 font-semibold">{fmtMoney(c.revenue)}</TableCell>
                      <TableCell>{fmtMoney(c.spend)}</TableCell>
                      <TableCell className={c.revenue - c.spend >= 0 ? "text-emerald-600" : "text-destructive"}>
                        {fmtMoney(c.revenue - c.spend)}
                      </TableCell>
                      <TableCell><Badge variant={c.roas >= 1 ? "default" : "destructive"}>{c.roas.toFixed(2)}x</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ALERTS ── */}
      {!loading && subTab === "alerts" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-destructive">{alerts.filter(a => a.type === "critical").length}</p>
              <p className="text-xs text-muted-foreground">Críticos</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-amber-500">{alerts.filter(a => a.type === "warning").length}</p>
              <p className="text-xs text-muted-foreground">Atenção</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-emerald-500">{alerts.filter(a => a.type === "info").length}</p>
              <p className="text-xs text-muted-foreground">Info</p>
            </CardContent></Card>
          </div>

          {alerts.map((a, i) => (
            <Card key={i} className={a.type === "critical" ? "border-destructive/40" : a.type === "warning" ? "border-amber-500/40" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${a.type === "critical" ? "text-destructive" : a.type === "warning" ? "text-amber-500" : "text-emerald-500"}`} />
                  <div>
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
