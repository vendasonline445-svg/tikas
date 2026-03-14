/**
 * Centralized Metrics Engine — Single source of truth for all performance calculations.
 * All hubs (Tracking, Analytics, Ads, CRM) consume this instead of inline calculations.
 */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

// ── Types ──
export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  conversions: number;
  sessions: number;
  clicks: number;
  impressions: number;
  convRate: number;
  ctr: number;
}

export interface CreativeMetrics {
  creativeId: string;
  creativeName: string;
  campaignId: string | null;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  conversions: number;
  sessions: number;
  convRate: number;
  rank: "top_performer" | "em_teste" | "fraco";
}

export interface FunnelMetrics {
  visitors: number;
  clicks: number;
  viewContent: number;
  checkouts: number;
  pixGenerated: number;
  purchases: number;
  visitorToClickRate: number;
  clickToCheckoutRate: number;
  checkoutToPaymentRate: number;
  paymentToPurchaseRate: number;
  overallConvRate: number;
  status: "healthy" | "warning" | "critical";
}

export interface ClientOverview {
  clientId: string;
  clientName: string;
  totalSpend: number;
  totalRevenue: number;
  totalConversions: number;
  roas: number;
  activeCampaigns: number;
}

// ── Helpers ──
function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function clampPct(val: number): number {
  return Math.min(Math.max(val, 0), 100);
}

// ── Campaign Metrics ──
export async function getCampaignMetrics(clientId?: string): Promise<CampaignMetrics[]> {
  let campaignQuery = db.from("campaigns").select("id, campaign_name, client_id");
  if (clientId) campaignQuery = campaignQuery.eq("client_id", clientId);
  const { data: campaigns } = await campaignQuery;
  if (!campaigns?.length) return [];

  const campaignIds = campaigns.map((c: any) => c.id);

  const [{ data: costs }, { data: attrs }, { data: sessions }] = await Promise.all([
    db.from("campaign_costs").select("campaign_id, spend, clicks, impressions, ctr").in("campaign_id", campaignIds),
    db.from("attributions").select("campaign_id, revenue").in("campaign_id", campaignIds),
    db.from("sessions").select("campaign_id").in("campaign_id", campaignIds),
  ]);

  return campaigns.map((c: any) => {
    const cCosts = (costs || []).filter((r: any) => r.campaign_id === c.id);
    const cAttrs = (attrs || []).filter((r: any) => r.campaign_id === c.id);
    const cSessions = (sessions || []).filter((r: any) => r.campaign_id === c.id);

    const spend = cCosts.reduce((s: number, r: any) => s + (r.spend || 0), 0);
    const revenue = cAttrs.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
    const conversions = cAttrs.length;
    const clicks = cCosts.reduce((s: number, r: any) => s + (r.clicks || 0), 0);
    const impressions = cCosts.reduce((s: number, r: any) => s + (r.impressions || 0), 0);
    const sessionCount = cSessions.length;

    return {
      campaignId: c.id,
      campaignName: c.campaign_name,
      spend,
      revenue,
      roas: safeDiv(revenue, spend),
      cpa: safeDiv(spend, conversions),
      conversions,
      sessions: sessionCount,
      clicks,
      impressions,
      convRate: clampPct(safeDiv(conversions, sessionCount) * 100),
      ctr: clampPct(safeDiv(clicks, impressions) * 100),
    };
  });
}

// ── Creative Metrics ──
export async function getCreativeMetrics(clientId?: string): Promise<CreativeMetrics[]> {
  let query = db.from("creatives").select("id, creative_name, campaign_id, client_id");
  if (clientId) query = query.eq("client_id", clientId);
  const { data: creatives } = await query;
  if (!creatives?.length) return [];

  const creativeIds = creatives.map((c: any) => c.id);
  const campaignIds = [...new Set(creatives.map((c: any) => c.campaign_id).filter(Boolean))];

  const [{ data: attrs }, { data: costs }, { data: sessions }] = await Promise.all([
    db.from("attributions").select("creative_id, revenue").in("creative_id", creativeIds),
    campaignIds.length ? db.from("campaign_costs").select("campaign_id, spend").in("campaign_id", campaignIds) : { data: [] },
    campaignIds.length ? db.from("sessions").select("creative_id").in("creative_id", creativeIds) : { data: [] },
  ]);

  return creatives.map((c: any) => {
    const cAttrs = (attrs || []).filter((r: any) => r.creative_id === c.id);
    const cCosts = (costs || []).filter((r: any) => r.campaign_id === c.campaign_id);
    const cSessions = (sessions || []).filter((r: any) => r.creative_id === c.id);

    const revenue = cAttrs.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
    const conversions = cAttrs.length;
    const spend = cCosts.reduce((s: number, r: any) => s + (r.spend || 0), 0);
    const sessionCount = cSessions.length;
    const convRate = clampPct(safeDiv(conversions, sessionCount) * 100);

    let rank: CreativeMetrics["rank"] = "em_teste";
    if (conversions >= 3 && convRate > 2) rank = "top_performer";
    else if (sessionCount > 50 && convRate < 0.5) rank = "fraco";

    return {
      creativeId: c.id,
      creativeName: c.creative_name,
      campaignId: c.campaign_id,
      spend,
      revenue,
      roas: safeDiv(revenue, spend),
      cpa: safeDiv(spend, conversions),
      conversions,
      sessions: sessionCount,
      convRate,
      rank,
    };
  });
}

// ── Funnel Metrics ──
export async function getFunnelMetrics(clientId?: string): Promise<FunnelMetrics> {
  const filter = (q: any) => clientId ? q.eq("client_id", clientId) : q;

  const [
    { count: visitors },
    { count: clicks },
    { count: viewContent },
    { count: checkouts },
    { count: pixGenerated },
    { count: purchases },
  ] = await Promise.all([
    filter(db.from("visitors").select("*", { count: "exact", head: true })),
    filter(db.from("clicks").select("*", { count: "exact", head: true })),
    filter(db.from("events").select("*", { count: "exact", head: true }).eq("event_name", "view_content")),
    filter(db.from("events").select("*", { count: "exact", head: true }).eq("event_name", "checkout_start")),
    filter(db.from("events").select("*", { count: "exact", head: true }).eq("event_name", "pix_generated")),
    filter(db.from("events").select("*", { count: "exact", head: true }).eq("event_name", "purchase")),
  ]);

  const v = visitors || 0;
  const cl = clicks || 0;
  const vc = viewContent || 0;
  const ch = checkouts || 0;
  const px = pixGenerated || 0;
  const pu = purchases || 0;

  const vtc = clampPct(safeDiv(cl, v) * 100);
  const ctch = clampPct(safeDiv(ch, cl) * 100);
  const chtp = clampPct(safeDiv(px, ch) * 100);
  const ptp = clampPct(safeDiv(pu, px) * 100);
  const overall = clampPct(safeDiv(pu, v) * 100);

  let status: FunnelMetrics["status"] = "healthy";
  if (vtc < 1 || ctch < 5 || ptp < 10) status = "critical";
  else if (vtc < 3 || ctch < 10 || ptp < 30) status = "warning";

  return {
    visitors: v, clicks: cl, viewContent: vc, checkouts: ch,
    pixGenerated: px, purchases: pu,
    visitorToClickRate: vtc, clickToCheckoutRate: ctch,
    checkoutToPaymentRate: chtp, paymentToPurchaseRate: ptp,
    overallConvRate: overall, status,
  };
}

// ── Client Overview ──
export async function getClientMetrics(): Promise<ClientOverview[]> {
  const { data: clients } = await db.from("clients").select("id, client_name");
  if (!clients?.length) return [];

  const [{ data: campaigns }, { data: costs }, { data: attrs }] = await Promise.all([
    db.from("campaigns").select("id, client_id"),
    db.from("campaign_costs").select("client_id, spend"),
    db.from("attributions").select("client_id, revenue"),
  ]);

  return clients.map((c: any) => {
    const cCampaigns = (campaigns || []).filter((r: any) => r.client_id === c.id);
    const cCosts = (costs || []).filter((r: any) => r.client_id === c.id);
    const cAttrs = (attrs || []).filter((r: any) => r.client_id === c.id);

    const totalSpend = cCosts.reduce((s: number, r: any) => s + (r.spend || 0), 0);
    const totalRevenue = cAttrs.reduce((s: number, r: any) => s + (r.revenue || 0), 0);

    return {
      clientId: c.id,
      clientName: c.client_name,
      totalSpend,
      totalRevenue,
      totalConversions: cAttrs.length,
      roas: safeDiv(totalRevenue, totalSpend),
      activeCampaigns: cCampaigns.length,
    };
  });
}

// ── Formatting helpers ──
export function fmtMoney(v: number): string {
  return `R$ ${(v / 100).toFixed(2)}`;
}

export function fmtPct(a: number, b: number): string {
  return b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "—";
}

export function fmtRate(rate: number): string {
  return rate.toFixed(1) + "%";
}
