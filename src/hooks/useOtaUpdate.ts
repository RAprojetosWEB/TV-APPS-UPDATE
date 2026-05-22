import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  APP_VERSION,
  APP_VERSION_CODE,
  UPDATE_JSON_URL,
  isUpdateAvailable,
  type UpdateManifest,
} from "@/lib/app-version";


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

function getInstalledVersionCode(): number {
  const bridge = (typeof window !== "undefined" ? window.Android : undefined) as
    | { versionCode?: () => number }
    | undefined;
  if (bridge && typeof bridge.versionCode === "function") {
    try {
      const v = bridge.versionCode();
      return typeof v === "number" ? v : Number(v) || APP_VERSION_CODE;
    } catch {
      return APP_VERSION_CODE;
    }
  }
  return APP_VERSION_CODE;
}

export function useOtaUpdate(options: { autoCheck?: boolean } = { autoCheck: true }) {
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [installedVersion, setInstalledVersion] = useState<string>(APP_VERSION);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const checkingRef = useRef(false);

  const check = useCallback(async (manual = false) => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setChecked(false);
    try {
      const url = `${UPDATE_JSON_URL}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as UpdateManifest;
      const installed = getInstalledVersion();
      const installedCode = getInstalledVersionCode();
      setInstalledVersion(installed);
      setManifest(data);
      const updateAvailable = isUpdateAvailable(data, {
        code: installedCode,
        name: installed,
      });
      setHasUpdate(updateAvailable);

      if (manual) {
        if (updateAvailable) {
          const remoteName = data.versionName ?? data.version ?? "";
          toast.success(`Nova versão ${remoteName} disponível!`);
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
      setChecked(true);
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  // Verificação automática do OTA reativada
  useEffect(() => {
    setInstalledVersion(getInstalledVersion());
    if (options.autoCheck) {
      check(false);
    }
  }, [check, options.autoCheck]);

  return {
    manifest,
    installedVersion,
    checking,
    checked,
    hasUpdate,
    checkNow: () => check(true),
    reset: () => setHasUpdate(false),
  };
}