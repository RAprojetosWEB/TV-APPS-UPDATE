import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { APP_VERSION, UPDATE_JSON_URL, compareVersions, type UpdateManifest } from "@/lib/app-version";

function getInstalledVersion(): string {
  if (typeof window !== "undefined" && typeof window.Android?.version === "function") {
    try {
      return window.Android.version() || APP_VERSION;
    } catch {
      return APP_VERSION;
    }
  }
  return APP_VERSION;
}

export function useOtaUpdate() {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [installedVersion, setInstalledVersion] = useState<string>(APP_VERSION);
  const [checking, setChecking] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);

  const check = useCallback(async (manual = false) => {
    if (checking) return;
    setChecking(true);
    try {
      const url = `${UPDATE_JSON_URL}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as UpdateManifest;
      const installed = getInstalledVersion();
      setInstalledVersion(installed);
      setManifest(data);
      const updateAvailable = compareVersions(data.version, installed) > 0;
      setHasUpdate(updateAvailable);

      if (manual) {
        if (updateAvailable) {
          toast.success(`Nova versão ${data.version} disponível!`);
        } else {
          toast.success("✅ O aplicativo já está atualizado", {
            description: `Você está na versão ${installed}.`,
          });
        }
      }
    } catch (err) {
      console.error("OTA check failed:", err);
      if (manual) {
        toast.error("Não foi possível verificar atualizações", {
          description: "Verifique sua conexão e tente novamente.",
        });
      }
    } finally {
      setChecking(false);
    }
  }, [checking]);

  // Verificação automática desativada
  useEffect(() => {
    setInstalledVersion(getInstalledVersion());
    // check(false); // Removido
  }, []);

  return {
    manifest,
    installedVersion,
    checking,
    hasUpdate,
    checkNow: () => check(true),
    reset: () => setHasUpdate(false),
  };
}