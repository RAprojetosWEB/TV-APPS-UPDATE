import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const verifyLoginPassword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("app_settings")
      .select("login_password")
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      console.error("verifyLoginPassword error", error);
      return { ok: false, error: "server_error" as const };
    }

    const expected = row?.login_password ?? "1555";
    return { ok: data.password === expected, error: null };
  });