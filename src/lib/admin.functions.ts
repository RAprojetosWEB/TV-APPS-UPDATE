import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { zipSync, unzipSync, strToU8, strFromU8, type Zippable } from "fflate";

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
      package_name: src.package_name,
      description: src.description,
      icon_url: src.icon_url,
      logo_url: src.logo_url,
      apk_url: src.apk_url,
      display_order: nextOrder,
      is_active: true,
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

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const uploadAppIcon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        appId: z.string().uuid(),
        fileBase64: z.string().min(1),
        ext: z.string().regex(/^[a-z0-9]{1,5}$/),
        contentType: z.string().min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const bytes = decodeBase64(data.fileBase64);
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Imagem muito grande (máx 5 MB)");
    const path = `${data.appId}/${Date.now()}.${data.ext}`;
    const { error } = await supabaseAdmin.storage
      .from("app-icons")
      .upload(path, bytes, { upsert: false, contentType: data.contentType });
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("app-icons").getPublicUrl(path);
    return { publicUrl: pub.publicUrl, path };
  });

export const uploadLauncherApk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        path: z.string().min(1).max(200).regex(/^[a-zA-Z0-9/_.-]+$/),
        fileBase64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const bytes = decodeBase64(data.fileBase64);
    const { error } = await supabaseAdmin.storage
      .from("tvapps-updates")
      .upload(data.path, bytes, {
        upsert: true,
        contentType: "application/vnd.android.package-archive",
      });
    if (error) throw new Error(error.message);
    return { success: true, path: data.path };
  });

export const uploadLauncherRaw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        path: z.string().min(1).max(200).regex(/^[a-zA-Z0-9/_.-]+$/),
        contentBase64: z.string().min(1),
        contentType: z.string().min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const bytes = decodeBase64(data.contentBase64);
    const { error } = await supabaseAdmin.storage
      .from("tvapps-updates")
      .upload(data.path, bytes, { upsert: true, contentType: data.contentType });
    if (error) throw new Error(error.message);
    return { success: true, path: data.path };
  });

// ============ Backup completo ============

function encodeBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function listBucketRecursive(
  bucket: string,
  prefix = "",
): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    // Pastas no Supabase storage não têm id/metadata
    const isFolder = !item.id && !item.metadata;
    if (isFolder) {
      const nested = await listBucketRecursive(bucket, full);
      out.push(...nested);
    } else {
      out.push(full);
    }
  }
  return out;
}

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    // 1. Dados das tabelas
    const [appsRes, versionsRes, settingsRes] = await Promise.all([
      supabaseAdmin.from("apps").select("*"),
      supabaseAdmin.from("app_versions").select("*"),
      supabaseAdmin.from("app_settings").select("*"),
    ]);
    if (appsRes.error) throw new Error(appsRes.error.message);
    if (versionsRes.error) throw new Error(versionsRes.error.message);
    if (settingsRes.error) throw new Error(settingsRes.error.message);

    const zip: Zippable = {};

    zip["db/apps.json"] = strToU8(JSON.stringify(appsRes.data ?? [], null, 2));
    zip["db/app_versions.json"] = strToU8(
      JSON.stringify(versionsRes.data ?? [], null, 2),
    );
    zip["db/app_settings.json"] = strToU8(
      JSON.stringify(settingsRes.data ?? [], null, 2),
    );

    // 2. Storage (arquivos dos dois buckets)
    const buckets = ["tvapps-updates", "app-icons"];
    const fileCounts: Record<string, number> = {};
    let totalBytes = 0;

    for (const bucket of buckets) {
      const paths = await listBucketRecursive(bucket);
      fileCounts[bucket] = paths.length;
      for (const p of paths) {
        const { data: blob, error } = await supabaseAdmin.storage
          .from(bucket)
          .download(p);
        if (error) {
          console.error(`download ${bucket}/${p}: ${error.message}`);
          continue;
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        zip[`storage/${bucket}/${p}`] = buf;
        totalBytes += buf.byteLength;
      }
    }

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);

    const manifest = {
      version: 1,
      createdAt: now.toISOString(),
      counts: {
        apps: appsRes.data?.length ?? 0,
        app_versions: versionsRes.data?.length ?? 0,
        app_settings: settingsRes.data?.length ?? 0,
        storage: fileCounts,
      },
      totalStorageBytes: totalBytes,
    };
    zip["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

    const readme = [
      "Backup TV.Apps",
      `Gerado em: ${now.toISOString()}`,
      "",
      "Conteúdo:",
      "- db/apps.json           — catálogo de apps",
      "- db/app_versions.json   — histórico de versões OTA",
      "- db/app_settings.json   — configurações (senha do launcher)",
      "- storage/tvapps-updates — APKs do launcher + update.json",
      "- storage/app-icons      — ícones dos apps do catálogo",
      "- manifest.json          — metadados deste backup",
      "",
      "Para restaurar, contate o suporte ou peça uma rotina de restore.",
    ].join("\n");
    zip["README.txt"] = strToU8(readme);

    const zipped = zipSync(zip, { level: 6 });
    const filename = `tvapps-backup-${stamp}.zip`;

    return {
      filename,
      base64: encodeBase64(zipped),
      byteLength: zipped.byteLength,
      manifest,
    };
  });

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        zipBase64: z.string().min(1),
        wipeStorage: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const bytes = decodeBase64(data.zipBase64);
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes);
    } catch (e) {
      throw new Error(`Arquivo inválido (não é um zip): ${String(e)}`);
    }

    // Validação básica: precisa ter manifest e os 3 JSON do db
    const manifestRaw = files["manifest.json"];
    if (!manifestRaw) throw new Error("Backup inválido: manifest.json ausente");
    const requiredDb = ["db/apps.json", "db/app_versions.json", "db/app_settings.json"];
    for (const k of requiredDb) {
      if (!files[k]) throw new Error(`Backup inválido: ${k} ausente`);
    }

    const apps = JSON.parse(strFromU8(files["db/apps.json"])) as Array<Record<string, unknown>>;
    const versions = JSON.parse(strFromU8(files["db/app_versions.json"])) as Array<Record<string, unknown>>;
    const settings = JSON.parse(strFromU8(files["db/app_settings.json"])) as Array<Record<string, unknown>>;

    // 1. Restaurar tabelas: apagar tudo e reinserir
    // Ordem: app_versions (pode ter FK pra apps), apps, app_settings
    const delVer = await supabaseAdmin
      .from("app_versions")
      .delete()
      .not("id", "is", null);
    if (delVer.error) throw new Error(`apagar app_versions: ${delVer.error.message}`);

    const delApps = await supabaseAdmin.from("apps").delete().not("id", "is", null);
    if (delApps.error) throw new Error(`apagar apps: ${delApps.error.message}`);

    const delSet = await supabaseAdmin
      .from("app_settings")
      .delete()
      .not("id", "is", null);
    if (delSet.error) throw new Error(`apagar app_settings: ${delSet.error.message}`);

    if (apps.length > 0) {
      const { error } = await supabaseAdmin.from("apps").insert(apps as never);
      if (error) throw new Error(`inserir apps: ${error.message}`);
    }
    if (versions.length > 0) {
      const { error } = await supabaseAdmin
        .from("app_versions")
        .insert(versions as never);
      if (error) throw new Error(`inserir app_versions: ${error.message}`);
    }
    if (settings.length > 0) {
      const { error } = await supabaseAdmin
        .from("app_settings")
        .insert(settings as never);
      if (error) throw new Error(`inserir app_settings: ${error.message}`);
    }

    // 2. Restaurar storage
    const buckets = ["tvapps-updates", "app-icons"];
    const counts: Record<string, number> = {};

    if (data.wipeStorage) {
      for (const bucket of buckets) {
        const existing = await listBucketRecursive(bucket);
        if (existing.length > 0) {
          const { error } = await supabaseAdmin.storage.from(bucket).remove(existing);
          if (error) console.error(`limpar ${bucket}: ${error.message}`);
        }
      }
    }

    for (const bucket of buckets) {
      counts[bucket] = 0;
      const prefix = `storage/${bucket}/`;
      for (const [path, content] of Object.entries(files)) {
        if (!path.startsWith(prefix)) continue;
        const inner = path.slice(prefix.length);
        if (!inner) continue;
        const contentType = inner.endsWith(".apk")
          ? "application/vnd.android.package-archive"
          : inner.endsWith(".json")
            ? "application/json"
            : inner.endsWith(".png")
              ? "image/png"
              : inner.endsWith(".jpg") || inner.endsWith(".jpeg")
                ? "image/jpeg"
                : inner.endsWith(".webp")
                  ? "image/webp"
                  : "application/octet-stream";
        const { error } = await supabaseAdmin.storage
          .from(bucket)
          .upload(inner, content, { upsert: true, contentType });
        if (error) {
          console.error(`upload ${bucket}/${inner}: ${error.message}`);
        } else {
          counts[bucket]++;
        }
      }
    }

    return {
      success: true,
      restored: {
        apps: apps.length,
        app_versions: versions.length,
        app_settings: settings.length,
        storage: counts,
      },
    };
  });