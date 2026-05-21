// Versão local do app TV.Apps. Atualize aqui sempre que compilar um novo APK.
export const APP_VERSION = "2.1";

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
  version: string;
  apkUrl: string;
  changelog?: string;
  forceUpdate?: boolean;
};