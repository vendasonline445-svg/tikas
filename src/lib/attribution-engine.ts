/**
 * Multi-model Attribution Engine
 * Supports: last_click, first_click, linear
 */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type AttributionModel = "last_click" | "first_click" | "linear";

interface AttributionInput {
  eventId: string;
  eventType: string;
  visitorId: string;
  sessionId: string;
  revenue: number;
  model?: AttributionModel;
}

export async function createMultiModelAttribution(input: AttributionInput) {
  const { eventId, eventType, visitorId, sessionId, revenue, model = "last_click" } = input;

  try {
    // Get all sessions for this visitor to support different models
    const { data: sessions } = await db.from("sessions")
      .select("session_id, campaign_id, creative_id, created_at")
      .eq("visitor_id", visitorId)
      .order("created_at", { ascending: true });

    if (!sessions?.length) {
      console.warn("[Attribution] No sessions found for visitor:", visitorId);
      return;
    }

    // Find click_id if available
    const { data: click } = await db.from("clicks")
      .select("id")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (model === "last_click") {
      // Use current session (last interaction)
      const session = sessions.find((s: any) => s.session_id === sessionId) || sessions[sessions.length - 1];
      await db.from("attributions").insert({
        event_id: eventId,
        event_type: eventType,
        session_id: sessionId,
        campaign_id: session.campaign_id,
        creative_id: session.creative_id,
        click_id: click?.id || null,
        revenue,
        attribution_model: "last_click",
      });
    } else if (model === "first_click") {
      // Use first session
      const first = sessions[0];
      await db.from("attributions").insert({
        event_id: eventId,
        event_type: eventType,
        session_id: first.session_id,
        campaign_id: first.campaign_id,
        creative_id: first.creative_id,
        click_id: click?.id || null,
        revenue,
        attribution_model: "first_click",
      });
    } else if (model === "linear") {
      // Distribute revenue equally across all sessions with campaigns
      const withCampaign = sessions.filter((s: any) => s.campaign_id);
      if (withCampaign.length === 0) return;
      const share = Math.round(revenue / withCampaign.length);

      for (const s of withCampaign) {
        await db.from("attributions").insert({
          event_id: eventId,
          event_type: eventType,
          session_id: s.session_id,
          campaign_id: s.campaign_id,
          creative_id: s.creative_id,
          click_id: null,
          revenue: share,
          attribution_model: "linear",
        });
      }
    }

    console.log(`[Attribution] ✓ ${model} attribution created for event ${eventId}`);
  } catch (e) {
    console.warn("[Attribution] Error:", e);
  }
}
