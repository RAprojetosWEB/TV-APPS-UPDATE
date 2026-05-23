import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Endpoint público pra TV Box Android consumir.
// Retorna lista de apps com flag de bloqueio. Sem auth (TV não tem login).
export const Route = createFileRoute("/api/public/catalog")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("apps")
          .select(
            "id, name, package_name, description, icon_url, logo_url, apk_url, display_order, is_blocked, block_reason",
          )
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (error) {
          return new Response(JSON.stringify({ error: "server_error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ apps: data ?? [] }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=30",
            "access-control-allow-origin": "*",
          },
        });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
          },
        }),
    },
  },
});