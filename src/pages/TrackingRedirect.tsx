/**
 * /r/:trackingId — Redirect tracking link handler
 * Records click, creates session, redirects to final URL
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export default function TrackingRedirect() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!trackingId) { setError(true); return; }

    (async () => {
      try {
        // 1. Find tracked link
        const { data: link } = await db.from("tracked_links")
          .select("url, campaign_id, creative_id")
          .eq("tracking_id", trackingId)
          .maybeSingle();

        if (!link?.url) { setError(true); return; }

        // 2. Get or create visitor/session IDs
        let visitorId = localStorage.getItem("mesalar_visitor_id");
        if (!visitorId) {
          visitorId = `v_${Math.random().toString(36).slice(2, 7)}_${Date.now()}`;
          localStorage.setItem("mesalar_visitor_id", visitorId);
        }

        const sessionId = `s_${Math.random().toString(36).slice(2, 7)}_${Date.now()}`;
        sessionStorage.setItem("mesalar_session_id", sessionId);
        sessionStorage.setItem("mesalar_session_ts", String(Date.now()));

        // 3. Register click
        await db.from("clicks").insert({
          session_id: sessionId,
          tracking_id: trackingId,
        });

        // 4. Create session with campaign/creative attribution
        await db.from("sessions").upsert({
          session_id: sessionId,
          visitor_id: visitorId,
          campaign_id: link.campaign_id || null,
          creative_id: link.creative_id || null,
          device: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
          referrer: document.referrer || "direct",
        }, { onConflict: "session_id", ignoreDuplicates: true });

        // 5. Ensure visitor exists
        await db.from("visitors").upsert(
          { visitor_id: visitorId, device: /mobile|android|iphone/i.test(navigator.userAgent) ? "Mobile" : "Desktop", first_seen: new Date().toISOString() },
          { onConflict: "visitor_id", ignoreDuplicates: true }
        );

        // 6. Build redirect URL preserving UTMs
        const targetUrl = new URL(link.url);
        targetUrl.searchParams.set("visitor_id", visitorId);
        targetUrl.searchParams.set("tracking_id", trackingId);

        // Pass campaign/creative as UTMs if not already present
        const params = new URLSearchParams(window.location.search);
        ["utm_source", "utm_campaign", "utm_content", "utm_medium", "ttclid"].forEach(k => {
          const v = params.get(k);
          if (v) targetUrl.searchParams.set(k, v);
        });

        // 7. Redirect
        window.location.href = targetUrl.toString();
      } catch (e) {
        console.error("[TrackingRedirect] Error:", e);
        setError(true);
      }
    })();
  }, [trackingId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Link não encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">O link rastreado não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground animate-pulse">Redirecionando...</p>
    </div>
  );
}
