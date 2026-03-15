# FunnelIQ — CLAUDE.md

Project context and architecture guide for AI-assisted development.

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Charts**: Recharts
- **State**: React hooks + TanStack Query
- **Testing**: Vitest

## Commands

```bash
npm run dev       # Dev server
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Vitest
```

## Architecture

```
src/
├── lib/                    # Core business logic (no React)
│   ├── tracking-hub.ts     # All funnel event tracking
│   ├── attribution-engine.ts # Multi-model attribution
│   ├── crm-pipeline-engine.ts # Lead enrichment + bot detection + funnel health
│   └── tiktok-tracking.ts  # TikTok pixel (browser + server-side Events API)
├── components/
│   ├── AdminDashboard.tsx  # Analytics dashboard (pure display, receives props)
│   ├── AdminCRM.tsx        # CRM pipeline (fetches own data)
│   ├── AdminAIAssistant.tsx # Claude-powered assistant
│   ├── AdminTrackingHub.tsx # Campaign/creative/click management
│   └── funil/FunilMetricas.tsx # Simple metrics view
├── integrations/supabase/
│   ├── client.ts           # Typed SupabaseClient<Database>
│   └── types.ts            # Auto-generated DB types (do not edit)
└── pages/
    ├── Admin.tsx           # Admin shell + routing
    └── Index.tsx           # Public funnel page
```

## Key Patterns

### Tracking
Always use `trackFunnelEvent()` from `tracking-hub.ts` — never call Supabase directly from UI for events.

```ts
import { trackFunnelEvent } from "@/lib/tracking-hub";

await trackFunnelEvent({ event: "checkout_start", value: 9700 });
```

### Supabase queries
Import the typed client directly — **never cast to `any`**:

```ts
import { supabase } from "@/integrations/supabase/client";

const { data } = await supabase.from("events").select("*");
```

For dynamic payloads, import the Insert type:

```ts
import type { Database } from "@/integrations/supabase/types";
type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
```

### Site ID
Configured via `VITE_SITE_ID` env var. Default: `"mesa-dobravel"`.
- `tracking-hub.ts` reads from `window.fiqSiteId` → `localStorage('fiq_site_id')` → env/default
- `FunilMetricas` accepts a `siteId` prop with the same default

### Bot Detection
Scores are in `crm-pipeline-engine.ts → scoreBotVisitor()`:
- ≥ 61 = bot, 31–60 = suspeito, < 31 = normal

### Funnel Event Order
```
page_view → view_content → click_buy → add_to_cart →
checkout_start → add_payment_info → pix_generated → purchase
```
Out-of-order events are tracked but flagged (`is_consistent: false`).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon key |
| `VITE_SITE_ID` | optional | Site identifier (default: `mesa-dobravel`) |

Supabase secrets (Edge Functions):
- `ANTHROPIC_API_KEY` — required for `AdminAIAssistant` (ai-assistant function)

## Supabase Tables

| Table | Purpose |
|---|---|
| `events` | Funnel tracking events |
| `sessions` | Visitor sessions + UTM data |
| `checkout_leads` | Lead contact + payment data |
| `attributions` | Multi-model attribution records |
| `campaigns` | Campaign metadata |
| `creatives` | Creative assets |
| `clicks` | Click tracking |
| `funnel_state` | Current funnel stage per visitor |
| `tiktok_pixels` | Active TikTok pixel configs |
| `event_queue` | Fallback queue for failed event inserts |

## Code Quality Rules

1. **No `supabase as any`** — use the typed client; import Insert/Row types from `types.ts`
2. **No empty catch blocks** — always log with `console.warn("[Module] message", e)`
3. **React hooks** — always include all referenced variables in dependency arrays
4. **Site ID** — never hardcode; use `VITE_SITE_ID` env var or component prop
5. **Event tracking** — always go through `trackFunnelEvent()`, not raw DB inserts
