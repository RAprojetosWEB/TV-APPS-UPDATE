import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Endpoint público para a tela de login nativa do APK Android verificar
// a senha do launcher contra o banco. Retorna apenas { ok: boolean }.
// Sem autenticação Supabase (a TV não tem sessão), e nunca devolve a senha.
const Schema = z.object({ password: z.string().min(1).max(200) });

const CORS = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export const Route = createFileRoute("/api/public/verify-launcher-password")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "bad_json" }), {
            status: 400,
            headers: CORS,
          });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ ok: false, error: "invalid_input" }),
            { status: 400, headers: CORS },
          );
        }

        const { data, error } = await supabaseAdmin
          .from("app_settings")
          .select("login_password")
          .eq("id", "main")
          .maybeSingle();

        if (error) {
          console.error("verify-launcher-password error", error);
          return new Response(
            JSON.stringify({ ok: false, error: "server_error" }),
            { status: 500, headers: CORS },
          );
        }

        const expected = data?.login_password ?? "1555";
        return new Response(
          JSON.stringify({ ok: parsed.data.password === expected }),
          { status: 200, headers: CORS },
        );
      },
    },
  },
});