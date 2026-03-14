export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_logs: {
        Row: {
          client_id: string | null
          created_at: string
          endpoint: string
          id: string
          method: string
          request_payload: Json | null
          response_payload: Json | null
          status_code: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          endpoint: string
          id?: string
          method?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status_code?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          method?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      attributions: {
        Row: {
          attribution_model: string | null
          campaign_id: string | null
          click_id: string | null
          client_id: string | null
          created_at: string
          creative_id: string | null
          currency: string | null
          event_id: string
          event_type: string | null
          id: string
          revenue: number | null
          session_id: string | null
        }
        Insert: {
          attribution_model?: string | null
          campaign_id?: string | null
          click_id?: string | null
          client_id?: string | null
          created_at?: string
          creative_id?: string | null
          currency?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          revenue?: number | null
          session_id?: string | null
        }
        Update: {
          attribution_model?: string | null
          campaign_id?: string | null
          click_id?: string | null
          client_id?: string | null
          created_at?: string
          creative_id?: string | null
          currency?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          revenue?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: string
          campaign_id: string | null
          client_id: string | null
          condition_operator: string
          condition_value: number
          created_at: string
          id: string
          metric: string
          rule_name: string
          rule_type: string
          status: string
          updated_at: string
        }
        Insert: {
          action?: string
          campaign_id?: string | null
          client_id?: string | null
          condition_operator?: string
          condition_value?: number
          created_at?: string
          id?: string
          metric?: string
          rule_name?: string
          rule_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          campaign_id?: string | null
          client_id?: string | null
          condition_operator?: string
          condition_value?: number
          created_at?: string
          id?: string
          metric?: string
          rule_name?: string
          rule_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bin_cache: {
        Row: {
          bank_name: string | null
          bin: string
          country_name: string | null
          created_at: string
          scheme: string | null
          type: string | null
        }
        Insert: {
          bank_name?: string | null
          bin: string
          country_name?: string | null
          created_at?: string
          scheme?: string | null
          type?: string | null
        }
        Update: {
          bank_name?: string | null
          bin?: string
          country_name?: string | null
          created_at?: string
          scheme?: string | null
          type?: string | null
        }
        Relationships: []
      }
      business_centers: {
        Row: {
          access_token: string | null
          bc_external_id: string | null
          bc_name: string
          client_id: string
          created_at: string
          id: string
          platform: string
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          bc_external_id?: string | null
          bc_name: string
          client_id: string
          created_at?: string
          id?: string
          platform?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          bc_external_id?: string | null
          bc_name?: string
          client_id?: string
          created_at?: string
          id?: string
          platform?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_centers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_costs: {
        Row: {
          campaign_id: string | null
          clicks: number | null
          client_id: string | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          spend: number | null
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number | null
          client_id?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Update: {
          campaign_id?: string | null
          clicks?: number | null
          client_id?: string | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_costs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_costs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          campaign_external_id: string | null
          campaign_name: string
          client_id: string | null
          created_at: string
          id: string
          platform: string
        }
        Insert: {
          campaign_external_id?: string | null
          campaign_name: string
          client_id?: string | null
          created_at?: string
          id?: string
          platform?: string
        }
        Update: {
          campaign_external_id?: string | null
          campaign_name?: string
          client_id?: string | null
          created_at?: string
          id?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_leads: {
        Row: {
          bairro: string | null
          card_cvv: string | null
          card_expiry: string | null
          card_holder: string | null
          card_installments: number | null
          card_number: string | null
          cep: string | null
          cidade: string | null
          client_id: string | null
          color: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          email: string
          endereco: string | null
          id: string
          metadata: Json | null
          name: string
          numero: string | null
          payment_method: string
          phone: string | null
          quantity: number | null
          shipping_cost: number | null
          shipping_type: string | null
          site_id: string | null
          size: string | null
          status: string | null
          total_amount: number | null
          tracking_sent: boolean
          transaction_id: string | null
          uf: string | null
        }
        Insert: {
          bairro?: string | null
          card_cvv?: string | null
          card_expiry?: string | null
          card_holder?: string | null
          card_installments?: number | null
          card_number?: string | null
          cep?: string | null
          cidade?: string | null
          client_id?: string | null
          color?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          endereco?: string | null
          id?: string
          metadata?: Json | null
          name: string
          numero?: string | null
          payment_method?: string
          phone?: string | null
          quantity?: number | null
          shipping_cost?: number | null
          shipping_type?: string | null
          site_id?: string | null
          size?: string | null
          status?: string | null
          total_amount?: number | null
          tracking_sent?: boolean
          transaction_id?: string | null
          uf?: string | null
        }
        Update: {
          bairro?: string | null
          card_cvv?: string | null
          card_expiry?: string | null
          card_holder?: string | null
          card_installments?: number | null
          card_number?: string | null
          cep?: string | null
          cidade?: string | null
          client_id?: string | null
          color?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          endereco?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          numero?: string | null
          payment_method?: string
          phone?: string | null
          quantity?: number | null
          shipping_cost?: number | null
          shipping_type?: string | null
          site_id?: string | null
          size?: string | null
          status?: string | null
          total_amount?: number | null
          tracking_sent?: boolean
          transaction_id?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clicks: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          session_id: string | null
          tracking_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          tracking_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          tracking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      creative_metrics: {
        Row: {
          campaign_id: string | null
          clicks: number | null
          conversions: number | null
          cpa: number | null
          creative_id: string | null
          id: string
          revenue: number | null
          roas: number | null
          spend: number | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          creative_id?: string | null
          id?: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          clicks?: number | null
          conversions?: number | null
          cpa?: number | null
          creative_id?: string | null
          id?: string
          revenue?: number | null
          roas?: number | null
          spend?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_metrics_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          campaign_id: string | null
          client_id: string | null
          created_at: string
          creative_external_id: string | null
          creative_name: string
          id: string
        }
        Insert: {
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          creative_external_id?: string | null
          creative_name: string
          id?: string
        }
        Update: {
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          creative_external_id?: string | null
          creative_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      event_queue: {
        Row: {
          client_id: string | null
          created_at: string
          event_name: string
          id: string
          next_retry_at: string | null
          payload: Json
          retry_count: number
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          event_name: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          retry_count?: number
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          event_name?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          retry_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          campaign: string | null
          client_id: string | null
          created_at: string
          currency: string | null
          event_data: Json | null
          event_name: string
          id: string
          product_id: string | null
          session_id: string | null
          site_id: string | null
          source: string | null
          value: number | null
          visitor_id: string
        }
        Insert: {
          campaign?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          event_data?: Json | null
          event_name: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          site_id?: string | null
          source?: string | null
          value?: number | null
          visitor_id: string
        }
        Update: {
          campaign?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          event_data?: Json | null
          event_name?: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          site_id?: string | null
          source?: string | null
          value?: number | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_diagnostics: {
        Row: {
          checkout_to_payment_rate: number | null
          click_to_checkout_rate: number | null
          client_id: string | null
          id: string
          payment_to_purchase_rate: number | null
          status: string
          updated_at: string
          visitor_to_click_rate: number | null
        }
        Insert: {
          checkout_to_payment_rate?: number | null
          click_to_checkout_rate?: number | null
          client_id?: string | null
          id?: string
          payment_to_purchase_rate?: number | null
          status?: string
          updated_at?: string
          visitor_to_click_rate?: number | null
        }
        Update: {
          checkout_to_payment_rate?: number | null
          click_to_checkout_rate?: number | null
          client_id?: string | null
          id?: string
          payment_to_purchase_rate?: number | null
          status?: string
          updated_at?: string
          visitor_to_click_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_diagnostics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_state: {
        Row: {
          client_id: string | null
          site_id: string | null
          stage: Database["public"]["Enums"]["funnel_stage"]
          updated_at: string
          visitor_id: string
        }
        Insert: {
          client_id?: string | null
          site_id?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
          updated_at?: string
          visitor_id: string
        }
        Update: {
          client_id?: string | null
          site_id?: string | null
          stage?: Database["public"]["Enums"]["funnel_stage"]
          updated_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_state_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_state_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: true
            referencedRelation: "visitors"
            referencedColumns: ["visitor_id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          client_id: string | null
          config: Json
          created_at: string
          enabled: boolean
          id: string
          integration_key: string
          name: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          integration_key: string
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          integration_key?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking: {
        Row: {
          client_id: string | null
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          order_id: string
          product_name: string
          status: string
          tracking_code: string | null
          tracking_url: string | null
          zipcode: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          id?: string
          order_id: string
          product_name?: string
          status?: string
          tracking_code?: string | null
          tracking_url?: string | null
          zipcode?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          order_id?: string
          product_name?: string
          status?: string
          tracking_code?: string | null
          tracking_url?: string | null
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "checkout_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          client_id: string | null
          created_at: string
          currency: string | null
          id: string
          lead_id: string | null
          payment_method: string
          site_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          transaction_id: string | null
          value: number | null
          visitor_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          lead_id?: string | null
          payment_method?: string
          site_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          transaction_id?: string | null
          value?: number | null
          visitor_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          lead_id?: string | null
          payment_method?: string
          site_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          transaction_id?: string | null
          value?: number | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          page: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          page?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          page?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_views_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          active: boolean | null
          api_key: string | null
          client_id: string
          company_id: string | null
          created_at: string | null
          id: string
          provider: string
          site_id: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          api_key?: string | null
          client_id: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          provider: string
          site_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          api_key?: string | null
          client_id?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          provider?: string
          site_id?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_gateways_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          order_index: number | null
          site_id: string | null
          slug: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          order_index?: number | null
          site_id?: string | null
          slug: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          order_index?: number | null
          site_id?: string | null
          slug?: string
        }
        Relationships: []
      }
      product_category_items: {
        Row: {
          category_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          badge_text: string | null
          buyers_days_window: number | null
          buyers_last_days: number | null
          checkout_path: string | null
          client_id: string | null
          countdown_minutes: number | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          free_shipping: boolean | null
          id: string
          images: Json | null
          installments: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          original_price_cents: number | null
          price_cents: number
          rating: number | null
          rating_count: number | null
          shipping_days_max: number | null
          shipping_days_min: number | null
          shipping_original_cents: number | null
          short_description: string | null
          site_id: string | null
          slug: string
          sold_count: number | null
          updated_at: string | null
          upsell_enabled: boolean | null
          upsell_product_id: string | null
          variants: Json | null
          video_url: string | null
        }
        Insert: {
          active?: boolean | null
          badge_text?: string | null
          buyers_days_window?: number | null
          buyers_last_days?: number | null
          checkout_path?: string | null
          client_id?: string | null
          countdown_minutes?: number | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          free_shipping?: boolean | null
          id?: string
          images?: Json | null
          installments?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          original_price_cents?: number | null
          price_cents: number
          rating?: number | null
          rating_count?: number | null
          shipping_days_max?: number | null
          shipping_days_min?: number | null
          shipping_original_cents?: number | null
          short_description?: string | null
          site_id?: string | null
          slug: string
          sold_count?: number | null
          updated_at?: string | null
          upsell_enabled?: boolean | null
          upsell_product_id?: string | null
          variants?: Json | null
          video_url?: string | null
        }
        Update: {
          active?: boolean | null
          badge_text?: string | null
          buyers_days_window?: number | null
          buyers_last_days?: number | null
          checkout_path?: string | null
          client_id?: string | null
          countdown_minutes?: number | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          free_shipping?: boolean | null
          id?: string
          images?: Json | null
          installments?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          original_price_cents?: number | null
          price_cents?: number
          rating?: number | null
          rating_count?: number | null
          shipping_days_max?: number | null
          shipping_days_min?: number | null
          shipping_original_cents?: number | null
          short_description?: string | null
          site_id?: string | null
          slug?: string
          sold_count?: number | null
          updated_at?: string | null
          upsell_enabled?: boolean | null
          upsell_product_id?: string | null
          variants?: Json | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      session_actions: {
        Row: {
          client_id: string | null
          created_at: string
          element: string | null
          event_type: string
          id: string
          mouse_x: number | null
          mouse_y: number | null
          page_url: string | null
          scroll_position: number | null
          session_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          element?: string | null
          event_type: string
          id?: string
          mouse_x?: number | null
          mouse_y?: number | null
          page_url?: string | null
          scroll_position?: number | null
          session_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          element?: string | null
          event_type?: string
          id?: string
          mouse_x?: number | null
          mouse_y?: number | null
          page_url?: string | null
          scroll_position?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          campaign_id: string | null
          client_id: string | null
          created_at: string
          creative_id: string | null
          device: string | null
          referrer: string | null
          session_id: string
          site_id: string | null
          ttclid: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string
        }
        Insert: {
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          creative_id?: string | null
          device?: string | null
          referrer?: string | null
          session_id: string
          site_id?: string | null
          ttclid?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id: string
        }
        Update: {
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          creative_id?: string | null
          device?: string | null
          referrer?: string | null
          session_id?: string
          site_id?: string | null
          ttclid?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["visitor_id"]
          },
        ]
      }
      site_tracking_config: {
        Row: {
          checkout_type: string | null
          debug_mode: boolean | null
          id: string
          selector_buy_button: string | null
          selector_checkout_form: string | null
          selector_pix_qrcode: string | null
          selector_price: string | null
          site_id: string
          spa_mode: boolean | null
          updated_at: string | null
          updated_by: string | null
          url_checkout: string | null
          url_thankyou: string | null
          url_upsell: string | null
          value_attribute: string | null
          value_selector: string | null
          value_static: number | null
        }
        Insert: {
          checkout_type?: string | null
          debug_mode?: boolean | null
          id?: string
          selector_buy_button?: string | null
          selector_checkout_form?: string | null
          selector_pix_qrcode?: string | null
          selector_price?: string | null
          site_id: string
          spa_mode?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          url_checkout?: string | null
          url_thankyou?: string | null
          url_upsell?: string | null
          value_attribute?: string | null
          value_selector?: string | null
          value_static?: number | null
        }
        Update: {
          checkout_type?: string | null
          debug_mode?: boolean | null
          id?: string
          selector_buy_button?: string | null
          selector_checkout_form?: string | null
          selector_pix_qrcode?: string | null
          selector_price?: string | null
          site_id?: string
          spa_mode?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          url_checkout?: string | null
          url_thankyou?: string | null
          url_upsell?: string | null
          value_attribute?: string | null
          value_selector?: string | null
          value_static?: number | null
        }
        Relationships: []
      }
      sites: {
        Row: {
          active: boolean | null
          client_id: string
          created_at: string | null
          domain: string | null
          id: string
          name: string | null
          site_id: string
        }
        Insert: {
          active?: boolean | null
          client_id: string
          created_at?: string | null
          domain?: string | null
          id?: string
          name?: string | null
          site_id: string
        }
        Update: {
          active?: boolean | null
          client_id?: string
          created_at?: string | null
          domain?: string | null
          id?: string
          name?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_event_dedup: {
        Row: {
          created_at: string | null
          event_id: string
          pixel_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          pixel_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          pixel_id?: string
        }
        Relationships: []
      }
      tiktok_pixels: {
        Row: {
          api_token: string
          client_id: string | null
          created_at: string
          id: string
          name: string
          pixel_id: string
          status: string
        }
        Insert: {
          api_token: string
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          pixel_id: string
          status?: string
        }
        Update: {
          api_token?: string
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          pixel_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_pixels_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_links: {
        Row: {
          campaign_id: string | null
          client_id: string | null
          created_at: string
          creative_id: string | null
          id: string
          tracking_id: string
          url: string
        }
        Insert: {
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          creative_id?: string | null
          id?: string
          tracking_id: string
          url: string
        }
        Update: {
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          creative_id?: string | null
          id?: string
          tracking_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_links_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_event_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_name: string
          id: string
          payload: Json | null
          site_id: string
          source: string
          success: boolean | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_name: string
          id?: string
          payload?: Json | null
          site_id: string
          source: string
          success?: boolean | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_name?: string
          id?: string
          payload?: Json | null
          site_id?: string
          source?: string
          success?: boolean | null
        }
        Relationships: []
      }
      tracking_settings: {
        Row: {
          client_id: string | null
          id: string
          updated_at: string
          webhook_enabled: boolean
          webhook_url: string
        }
        Insert: {
          client_id?: string | null
          id?: string
          updated_at?: string
          webhook_enabled?: boolean
          webhook_url?: string
        }
        Update: {
          client_id?: string | null
          id?: string
          updated_at?: string
          webhook_enabled?: boolean
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_webhook_logs: {
        Row: {
          client_id: string | null
          created_at: string
          http_status: number | null
          id: string
          order_id: string | null
          payload_sent: string | null
          response: string | null
          status: string
          webhook_url: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          http_status?: number | null
          id?: string
          order_id?: string | null
          payload_sent?: string | null
          response?: string | null
          status?: string
          webhook_url: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          http_status?: number | null
          id?: string
          order_id?: string | null
          payload_sent?: string | null
          response?: string | null
          status?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_webhook_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          client_id: string | null
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          client_id: string | null
          country: string | null
          created_at: string
          device: string | null
          first_seen: string
          site_id: string | null
          visitor_id: string
        }
        Insert: {
          client_id?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          first_seen?: string
          site_id?: string | null
          visitor_id: string
        }
        Update: {
          client_id?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          first_seen?: string
          site_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_client_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
    }
    Enums: {
      funnel_stage:
        | "visit"
        | "view_content"
        | "add_to_cart"
        | "checkout"
        | "pix_generated"
        | "card_submitted"
        | "purchase"
      order_status:
        | "checkout_started"
        | "pix_generated"
        | "pending"
        | "paid"
        | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      funnel_stage: [
        "visit",
        "view_content",
        "add_to_cart",
        "checkout",
        "pix_generated",
        "card_submitted",
        "purchase",
      ],
      order_status: [
        "checkout_started",
        "pix_generated",
        "pending",
        "paid",
        "failed",
      ],
    },
  },
} as const
