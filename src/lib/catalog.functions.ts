import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CatalogApp = {
  id: string;
  name: string;
  package_name: string;
  description: string | null;
  icon_url: string | null;
  logo_url: string | null;
  apk_url: string | null;
  display_order: number;
  is_active: boolean;
  is_blocked: boolean;
  block_reason: string | null;
};

// Pública (sem auth). Usada pela TV Box e pelo site web.
// Retorna todos os apps ativos (incluindo bloqueados — o front decide o que mostrar).
export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("apps")
    .select(
      "id, name, package_name, description, icon_url, logo_url, apk_url, display_order, is_active, is_blocked, block_reason",
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("getCatalog error", error);
    return { apps: [] as CatalogApp[], error: "server_error" };
  }
  return { apps: (data ?? []) as CatalogApp[], error: null };
});