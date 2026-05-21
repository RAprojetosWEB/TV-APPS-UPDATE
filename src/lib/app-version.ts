// Versão local do app TV.Apps (apenas para fallback no preview web).
// No Android, a versão real vem do bridge `window.Android.version()` /
// `window.Android.versionCode()`, alimentado pelo APK gerado.
// O versionCode do APK é gerado automaticamente pelo Gradle (timestamp
// yyMMddHHmm) — você não precisa editar essas constantes a cada build.
export const APP_VERSION = "2.1";
export const APP_VERSION_CODE = 0;

// URL pública do update.json no bucket tvapps-updates do Lovable Cloud.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const UPDATE_JSON_URL = `${SUPABASE_URL}/storage/v1/object/public/tvapps-updates/update.json`;

// Compara duas versões tipo "2.4" ou "2.4.1". Retorna >0 se a primeira é maior.
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export type UpdateManifest = {
  // Schema novo (gerado pela task Gradle generateUpdateJson):
  versionCode?: number;
  versionName?: string;
  apkUrl?: string;
  // Schema antigo (retrocompatível):
  version?: string;
  url?: string;
  changelog?: string;
  forceUpdate?: boolean;
};

// Decide se há atualização disponível. Prefere comparar por versionCode
// (números, sempre crescente) quando ambos os lados expõem; cai para
// versionName (string) só em fallback.
export function isUpdateAvailable(
  remote: UpdateManifest,
  installed: { code: number; name: string },
): boolean {
  if (typeof remote.versionCode === "number" && remote.versionCode > 0 && installed.code > 0) {
    return remote.versionCode > installed.code;
  }
  const remoteName = remote.versionName ?? remote.version ?? "";
  return compareVersions(remoteName, installed.name) > 0;
}