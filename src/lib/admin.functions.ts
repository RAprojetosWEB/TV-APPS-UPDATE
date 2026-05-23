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

// ============ CRUD apps ============

export const createApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(100),
        package_name: z.string().min(1).max(200),
        description: z.string().max(500).nullable().optional(),
        apk_url: z.string().url().max(2000).nullable().optional(),
        icon_url: z.string().url().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: maxRow } = await supabaseAdmin
      .from("apps")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.display_order ?? -1) + 1;
    const { error } = await supabaseAdmin.from("apps").insert({
      name: data.name,
      package_name: data.package_name,
      description: data.description ?? null,
      apk_url: data.apk_url ?? null,
      icon_url: data.icon_url ?? null,
      display_order: nextOrder,
      is_active: true,
      is_blocked: false,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ appId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("apps").delete().eq("id", data.appId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const duplicateApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ appId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: src, error: getErr } = await supabaseAdmin
      .from("apps")
      .select("name, package_name, description, icon_url, logo_url, apk_url")
      .eq("id", data.appId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!src) throw new Error("App não encontrado");
    const { data: maxRow } = await supabaseAdmin
      .from("apps")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.display_order ?? -1) + 1;
    const { error } = await supabaseAdmin.from("apps").insert({
      name: `${src.name} (cópia)`,
      package_name: `${src.package_name}.copy.${Date.now()}`,
      description: src.description,
      icon_url: src.icon_url,
      logo_url: src.logo_url,
      apk_url: src.apk_url,
      display_order: nextOrder,
      is_active: false,
      is_blocked: false,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const reorderApps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orderedIds: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // Batch sequencial — N pequeno (<= 200)
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await supabaseAdmin
        .from("apps")
        .update({ display_order: i })
        .eq("id", data.orderedIds[i]);
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

// ============ OTA launcher ============

type UpdateManifest = {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  changelog?: string;
};

async function writeUpdateManifest(manifest: UpdateManifest) {
  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  });
  const { error } = await supabaseAdmin.storage
    .from("tvapps-updates")
    .upload("update.json", blob, { upsert: true, contentType: "application/json" });
  if (error) throw new Error(`Falha ao escrever update.json: ${error.message}`);
}

export const listLauncherVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("app_versions")
      .select("id, version_name, version_code, apk_url, apk_size_mb, changelog, is_latest, created_at, target")
      .eq("target", "launcher")
      .order("version_code", { ascending: false });
    if (error) throw new Error(error.message);
    return { versions: data ?? [] };
  });

export const publishLauncherVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        versionName: z.string().min(1).max(50),
        versionCode: z.number().int().min(1).max(2_000_000_000),
        changelog: z.string().max(2000).optional().nullable(),
        apkStoragePath: z.string().min(1).max(500),
        apkSizeMb: z.number().min(0).max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: pub } = supabaseAdmin.storage
      .from("tvapps-updates")
      .getPublicUrl(data.apkStoragePath);
    const apkUrl = pub.publicUrl;

    // marca todas como não-latest
    await supabaseAdmin
      .from("app_versions")
      .update({ is_latest: false })
      .eq("target", "launcher");

    // insere nova
    const { error: insErr } = await supabaseAdmin.from("app_versions").insert({
      target: "launcher",
      version_name: data.versionName,
      version_code: data.versionCode,
      apk_url: apkUrl,
      apk_size_mb: data.apkSizeMb ?? null,
      changelog: data.changelog ?? null,
      is_latest: true,
    });
    if (insErr) throw new Error(insErr.message);

    await writeUpdateManifest({
      versionCode: data.versionCode,
      versionName: data.versionName,
      apkUrl,
      changelog: data.changelog ?? undefined,
    });

    return { success: true, apkUrl };
  });

export const setLatestLauncherVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ versionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("app_versions")
      .select("version_name, version_code, apk_url, changelog")
      .eq("id", data.versionId)
      .eq("target", "launcher")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.apk_url) throw new Error("Versão inválida");

    await supabaseAdmin
      .from("app_versions")
      .update({ is_latest: false })
      .eq("target", "launcher");
    await supabaseAdmin
      .from("app_versions")
      .update({ is_latest: true })
      .eq("id", data.versionId);

    await writeUpdateManifest({
      versionCode: row.version_code,
      versionName: row.version_name,
      apkUrl: row.apk_url,
      changelog: row.changelog ?? undefined,
    });
    return { success: true };
  });

export const deleteLauncherVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ versionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin
      .from("app_versions")
      .select("is_latest, apk_url")
      .eq("id", data.versionId)
      .maybeSingle();
    if (row?.is_latest) throw new Error("Não é possível excluir a versão marcada como atual");
    const { error } = await supabaseAdmin
      .from("app_versions")
      .delete()
      .eq("id", data.versionId);
    if (error) throw new Error(error.message);
    // tenta apagar o APK do storage (best-effort)
    if (row?.apk_url) {
      const m = row.apk_url.match(/tvapps-updates\/(.+)$/);
      if (m) {
        await supabaseAdmin.storage.from("tvapps-updates").remove([m[1]]);
      }
    }
    return { success: true };
  });