import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useProducts(siteId?: string) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    let query = supabase
      .from("products")
      .select("*")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (siteId) query = query.eq("site_id", siteId);

    query.then(({ data }) => {
      setProducts(data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { fetch(); }, [siteId]);

  return { products, loading, refresh: fetch };
}
