import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Acesso negado: você não é administrador");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const listAppsForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("apps")
      .select(
        "id, name, package_name, description, icon_url, logo_url, apk_url, display_order, is_active, is_blocked, block_reason, created_at, updated_at",
      )
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { apps: data ?? [] };
  });

export const toggleAppBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        appId: z.string().uuid(),
        isBlocked: z.boolean(),
        reason: z.string().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("apps")
      .update({
        is_blocked: data.isBlocked,
        block_reason: data.isBlocked ? (data.reason ?? null) : null,
      })
      .eq("id", data.appId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        appId: z.string().uuid(),
        name: z.string().min(1).max(100),
        description: z.string().max(500).nullable().optional(),
        apk_url: z.string().url().max(2000).nullable().optional(),
        icon_url: z.string().url().max(2000).nullable().optional(),
        display_order: z.number().int().min(0).max(999),
        is_active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("apps")
      .update({
        name: data.name,
        description: data.description ?? null,
        apk_url: data.apk_url ?? null,
        icon_url: data.icon_url ?? null,
        display_order: data.display_order,
        is_active: data.is_active,
      })
      .eq("id", data.appId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getLoginPassword = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("login_password")
      .eq("id", "main")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { password: data?.login_password ?? "1555" };
  });

export const updateLoginPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ password: z.string().min(4).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: existing } = await supabaseAdmin
      .from("app_settings")
      .select("id")
      .eq("id", "main")
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .update({ login_password: data.password, updated_at: new Date().toISOString() })
        .eq("id", "main");
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .insert({ id: "main", login_password: data.password });
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });