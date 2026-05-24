import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/bump-version")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.BUILD_VERSION_TOKEN;
        if (!expected) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const provided = request.headers.get("x-build-token");
        if (!provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data, error } = await supabaseAdmin.rpc("bump_build_counter", {
          _id: "launcher",
        });
        if (error || !data || data.length === 0) {
          return new Response(
            JSON.stringify({ error: error?.message ?? "no data" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        const row = data[0] as { version_name: string; version_code: number };
        return new Response(
          JSON.stringify({
            versionName: row.version_name,
            versionCode: row.version_code,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});