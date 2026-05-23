import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Download, Play, AlertCircle, Calendar, Clock, Cloud, RefreshCcw, RotateCcw, Search, Info, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOtaUpdate } from "@/hooks/useOtaUpdate";
import { OtaUpdateModal } from "@/components/OtaUpdateModal";
import { NetworkIndicator } from "@/components/NetworkIndicator";
import { LoginGate } from "@/components/LoginGate";
import { useDateTime } from "@/hooks/useDateTime";
import { toast } from "sonner";
import unitvLogo from "@/assets/unitv.png";
import nexatvLogo from "@/assets/nexatv.png";
import alphaplayLogo from "@/assets/alphaplay.png";

// Ponte com o APK nativo (WebView host). Se existir, instalamos APK direto
// via PackageInstaller nativo; senão, fazemos o download "tradicional".
type AndroidBridge = {
  isNative: () => boolean;
  installApk: (url: string, name: string) => void;
  isAppInstalled: (packageName: string) => boolean;
  openApp: (packageName: string) => void;
  openSettings?: () => void;
  version?: () => string;
  versionCode?: () => number;
  isApkDownloaded?: (packageName: string, version: string) => boolean;
  installLocalApk?: (packageName: string) => void;
};
declare global {
  interface Window {
    Android?: AndroidBridge;
    __onNativeApkProgress?: (name: string, percent: number, error: string) => void;
  }
}

function formatBytes(b: number): string {
  if (!b || b <= 0) return "0 B";
  const mb = b / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = b / 1024;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${b} B`;
}

function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) return "—";
  const mbps = bps / 1024 / 1024;
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}

function formatEta(s: number): string {
  if (s == null || s < 0) return "—";
  if (s < 60) return `${s}s restantes`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${String(sec).padStart(2, "0")}s restantes`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m restantes`;
}

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "TV Apps — Central de Downloads" },
      { name: "description", content: "Baixe seus apps favoritos direto na sua TV Box." },
    ],
  }),
});

// ⬇️ SUBSTITUA AS URLs ABAIXO PELOS LINKS DIRETOS DOS SEUS APKs ⬇️
const APPS = [
  {
    name: "UniTV",
    description: "Mais de 400 canais, filmes e séries",
    url: "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk",
    logo: unitvLogo,
    packageName: "com.unitv.app",
    version: "2.4",
    updateDate: "20/05/2026",
    size: "45MB",
  },
  {
    name: "Nexa TV",
    description: "Mais de 300 canais",
    url: "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/Nexa_TV.apk",
    logo: nexatvLogo,
    packageName: "com.nexa.tv",
    version: "1.8",
    updateDate: "15/05/2026",
    size: "32MB",
  },
  {
    name: "AlphaPlay",
    description: "Mais de 300 canais, filmes e séries",
    url: "https://firebasestorage.googleapis.com/v0/b/update-41ccf.appspot.com/o/alphaplay.apk?alt=media&token=cdbe4055-ea90-4f2c-a540-1b458159ade6",
    logo: alphaplayLogo,
    packageName: "com.alphaplay.app",
    version: "3.2",
    updateDate: "18/05/2026",
    size: "58MB",
  },
];

function Index() {
  // Detecta a ponte nativa de forma resiliente: a única coisa que importa é
  // se `installApk` existe como função. Isso evita falsos negativos quando
  // `isNative()` ainda não foi avaliada na hidratação SSR.
  const [isNative, setIsNative] = useState<boolean>(() =>
    typeof window !== "undefined" &&
    typeof window.Android?.installApk === "function",
  );
  useEffect(() => {
    const check = () =>
      setIsNative(typeof window.Android?.installApk === "function");
    check();
    // Algumas WebViews injetam a interface depois do primeiro render.
    const t1 = setTimeout(check, 50);
    const t2 = setTimeout(check, 250);
    const t3 = setTimeout(check, 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);
  const [focused, setFocused] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [states, setStates] = useState<
    Array<{
      status: "idle" | "downloading" | "done" | "error";
      progress: number;
      isInstalled: boolean;
      isDownloaded: boolean;
      hasUpdate: boolean;
      installedVersion?: string;
      blobUrl?: string;
      downloadedBytes?: number;
      totalBytes?: number;
      speedBps?: number;
      etaSeconds?: number;
    }>
  >(() => APPS.map(() => ({ status: "idle", progress: 0, isInstalled: false, isDownloaded: false, hasUpdate: false })));

  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [appToUpdate, setAppToUpdate] = useState<number | null>(null);
  const [dynamicApps, setDynamicApps] = useState<any[]>([]);

  // ---------- OTA (atualização do próprio app TV.Apps) ----------
  const ota = useOtaUpdate({ autoCheck: false });
  const [otaModalOpen, setOtaModalOpen] = useState(false);
  const [otaDownloading, setOtaDownloading] = useState(false);
  const [otaProgress, setOtaProgress] = useState(0);
  const [otaSpeedBps, setOtaSpeedBps] = useState(0);

  // Abre modal manualmente via botão (autoCheck desativado no Index)
  // No Index, a verificação automática não ocorre mais por regra de negócio.

  const startOtaUpdate = async () => {
    if (!ota.manifest || otaDownloading) return;
    const url = ota.manifest.apkUrl ?? ota.manifest.url ?? "";
    if (!url) return;

    // No APK nativo, delega ao instalador do Android
    if (typeof window !== "undefined" && typeof window.Android?.installApk === "function") {
      setOtaDownloading(true);
      setOtaProgress(0);
      setOtaSpeedBps(0);
      try {
        window.Android.installApk(url, "TV.Apps");
      } catch (err) {
        console.error("OTA native install failed", err);
        setOtaDownloading(false);
      }
      return;
    }

    // Fallback navegador: baixa via fetch com progresso e abre o APK
    setOtaDownloading(true);
    setOtaProgress(0);
    setOtaSpeedBps(0);
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
      const total = Number(res.headers.get("Content-Length") || 0);
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      let windowStart = Date.now();
      let windowBytes = 0;
      let smoothedBps = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
          received += value.length;
          const now = Date.now();
          if (now - windowStart >= 500) {
            const instBps = ((received - windowBytes) * 1000) / (now - windowStart);
            smoothedBps = smoothedBps === 0 ? instBps : smoothedBps * 0.7 + instBps * 0.3;
            setOtaSpeedBps(Math.round(smoothedBps));
            windowStart = now;
            windowBytes = received;
          }
          if (total > 0) setOtaProgress(Math.round((received / total) * 100));
        }
      }
      const blob = new Blob(chunks, { type: "application/vnd.android.package-archive" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "tvapps-latest.apk";
      document.body.appendChild(a);
      a.click();
      a.remove();
      try {
        window.location.href = blobUrl;
      } catch {}
      
      toast.success("Download concluído", {
        description: "O instalador deve abrir automaticamente.",
      });

      setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
      setOtaDownloading(false);
      setOtaModalOpen(false);
    } catch (err) {
      console.error("OTA download failed", err);
      toast.error("Falha ao baixar a atualização");
      setOtaDownloading(false);
    }
  };
  // -----------------------------------------------------------

  const fetchDynamicApps = async () => {
    try {
      const { data: apps, error } = await supabase
        .from('apps')
        .select(`
          *,
          app_versions (*)
        `)
        .order('name');
      
      if (error) throw error;
      
      if (apps && apps.length > 0) {
        const mappedApps = apps.map(app => {
          const latestVersion = app.app_versions?.find((v: any) => v.is_latest) || app.app_versions?.[0];
          return {
            name: app.name,
            description: app.description || "",
            url: latestVersion?.apk_url || "",
            logo: app.logo_url || (app.name === "UniTV" ? unitvLogo : app.name === "Nexa TV" ? nexatvLogo : alphaplayLogo),
            packageName: app.package_name,
            version: latestVersion?.version_name || "1.0",
            updateDate: latestVersion ? new Date(latestVersion.created_at).toLocaleDateString('pt-BR') : "N/A",
            size: latestVersion?.apk_size_mb ? `${latestVersion.apk_size_mb}MB` : "N/A",
          };
        });
        const order = ["unitv", "nexa tv", "alphaplay"];
        mappedApps.sort((a, b) => {
          const idxA = order.indexOf(a.name.toLowerCase());
          const idxB = order.indexOf(b.name.toLowerCase());
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });
        setDynamicApps(mappedApps);
      }
    } catch (err) {
      console.error("Erro ao carregar apps do banco:", err);
      setDynamicApps(APPS); // Fallback
    }
  };

  useEffect(() => {
    fetchDynamicApps();
  }, []);

  const currentApps = dynamicApps.length > 0 ? dynamicApps : APPS;

  const checkUpdates = async (manual = false) => {
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    if (manual) playClick();

    await fetchDynamicApps();

    const newStates = states.map((s, i) => {
      const app = currentApps[i];
      if (!app) return s;

      const isInstalled = isNative 
        ? window.Android?.isAppInstalled?.(app.packageName)
        : (i === 0);
      
      const isDownloaded = isNative
        ? !!window.Android?.isApkDownloaded?.(app.packageName, app.version)
        : false;
      
      const installedVersion = isNative && window.Android?.version ? window.Android.version() : (parseFloat(app.version) - 0.3).toFixed(1);
      const hasUpdate = false; // Verificação de atualização para apps de terceiros removida permanentemente

      return {
        ...s,
        isInstalled: !!isInstalled,
        isDownloaded,
        installedVersion: installedVersion || "0",
        hasUpdate
      };
    });

    setStates(newStates);
    setCheckingUpdates(false);

    if (manual) {
      const updatesFound = newStates.some(s => s.hasUpdate);
      if (!updatesFound) {
        toast.success("O aplicativo já está atualizado", {
          description: "Todos os seus apps estão na versão mais recente.",
          duration: 3000,
        });
      }
    }
  };

  // Atualiza status de instalação e checa updates periodicamente
  // Atualiza status de instalação apenas uma vez ao carregar
  useEffect(() => {
    if (isNative && window.Android?.isAppInstalled) {
      checkUpdates();
    }
  }, [isNative]);
  const [modalChoice, setModalChoice] = useState<"yes" | "no">("yes");
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [installModalAppIndex, setInstallModalAppIndex] = useState<number | null>(null);
  const yesBtnRef = useRef<HTMLButtonElement | null>(null);
  const noBtnRef = useRef<HTMLButtonElement | null>(null);
  const installYesBtnRef = useRef<HTMLButtonElement | null>(null);
  const installNoBtnRef = useRef<HTMLButtonElement | null>(null);

  const { time, date } = useDateTime();
  const doneIndex = states.findIndex((s) => s.status === "done");
  const modalOpen = doneIndex !== -1 || installModalOpen || updateModalOpen;

  useEffect(() => {
    if (!modalOpen) refs.current[focused]?.focus();
  }, [focused, modalOpen]);

  // Força orientação landscape sempre que possível (PWA / fullscreen no Android)
  useEffect(() => {
    const lock = async () => {
      try {
        const orientation = (screen as Screen & {
          orientation?: { lock?: (o: string) => Promise<void> };
        }).orientation;
        await orientation?.lock?.("landscape");
      } catch {
        // Navegador não permitiu (precisa estar em fullscreen/PWA instalado)
      }
    };
    lock();
    const onFs = () => lock();
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (modalOpen) {
      setModalChoice("yes");
      setTimeout(() => yesBtnRef.current?.focus(), 0);
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    if (installModalOpen) {
      if (modalChoice === "yes") installYesBtnRef.current?.focus();
      else installNoBtnRef.current?.focus();
    } else {
      if (modalChoice === "yes") yesBtnRef.current?.focus();
      else noBtnRef.current?.focus();
    }
  }, [modalChoice, modalOpen, installModalOpen]);

  const playTick = () => {
    try {
      const audio = new Audio("https://pub-777ce89a8a364563a9200e0426021991.r2.dev/tick.mp3");
      audio.volume = 0.4;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const playClick = () => {
    try {
      const audio = new Audio("https://pub-777ce89a8a364563a9200e0426021991.r2.dev/click.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (modalOpen) return;
    // Só captura setas quando o foco está em um dos cards.
    // Caso contrário (botões do header), deixa a navegação natural agir.
    const target = e.target as HTMLElement | null;
    const isCard = refs.current.some((el) => el === target);
    if (!isCard) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (focused + 1) % currentApps.length;
      setFocused(next);
      playTick();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (focused - 1 + currentApps.length) % currentApps.length;
      setFocused(next);
      playTick();
    }
  };

  const updateState = (
    i: number,
    patch: Partial<{
      status: "idle" | "downloading" | "done" | "error";
      progress: number;
      isDownloaded?: boolean;
      blobUrl?: string;
      downloadedBytes?: number;
      totalBytes?: number;
      speedBps?: number;
      etaSeconds?: number;
    }>,
  ) => {
    setStates((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const startDownload = async (i: number, forceDownload = false) => {
    playClick();
    const app = currentApps[i];
    
    // Se já estiver instalado e NÃO for uma atualização forçada, abre direto
    if (!forceDownload && isNative && window.Android?.isAppInstalled?.(app.packageName)) {
      if (typeof window.Android.openApp === "function") {
        window.Android.openApp(app.packageName);
        return;
      }
    }

    // Cache inteligente: verifica se o APK já foi baixado anteriormente
    if (isNative && window.Android?.isApkDownloaded?.(app.packageName, app.version)) {
      toast.info("APK já baixado anteriormente.", {
        description: "Iniciando instalação...",
        duration: 3000,
      });
      window.Android.installLocalApk?.(app.packageName);
      return;
    }

    if (states[i].status === "downloading") return;
    updateState(i, { status: "downloading", progress: 0 });

    // Modo nativo: delega download + instalação ao APK host.
    if (isNative && window.Android) {
      window.Android.installApk(app.url, app.name);
      return;
    }

    try {
      const res = await fetch(app.url);
      if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
      const total = Number(res.headers.get("Content-Length") || 0);
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      const startMs = Date.now();
      let windowStart = startMs;
      let windowBytes = 0;
      let smoothedBps = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
          received += value.length;
          const now = Date.now();
          if (now - windowStart >= 500) {
            const instBps = ((received - windowBytes) * 1000) / (now - windowStart);
            smoothedBps = smoothedBps === 0 ? instBps : smoothedBps * 0.7 + instBps * 0.3;
            windowStart = now;
            windowBytes = received;
          }
          const eta = smoothedBps > 0 && total > 0
            ? Math.max(0, Math.round((total - received) / smoothedBps))
            : -1;
          updateState(i, {
            progress: total > 0 ? Math.round((received / total) * 100) : 0,
            downloadedBytes: received,
            totalBytes: total,
            speedBps: Math.round(smoothedBps),
            etaSeconds: eta,
          });
        }
      }
      const blob = new Blob(chunks, { type: "application/vnd.android.package-archive" });
      const blobUrl = URL.createObjectURL(blob);
      const fileName = app.url.split("/").pop()?.split("?")[0] || `${app.name}.apk`;
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = decodeURIComponent(fileName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      // Abre automaticamente o instalador
      try {
        window.location.href = blobUrl;
      } catch (err) {
        console.error("Auto-open APK failed", err);
      }
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
      updateState(i, { status: "idle", progress: 0 }); // Volta para idle em vez de "done" para evitar modal
      toast.success("Download concluído", {
        description: "O instalador deve abrir automaticamente.",
      });
    } catch (err) {
      console.error(err);
      updateState(i, { status: "error", progress: 0 });
    }
  };

  // Recebe progresso/erros do bridge nativo.
  useEffect(() => {
    if (!isNative) return;
    window.__onNativeApkProgress = (name, percent, error) => {
      // Caso seja a atualização do próprio app (OTA)
      if (name === "TV.Apps") {
        if (percent < 0) {
          setOtaDownloading(false);
          toast.error("Falha ao baixar atualização");
          return;
        }
        if (percent >= 100) {
          setOtaDownloading(false);
          setOtaModalOpen(false);
          return;
        }
        setOtaProgress(percent);
        return;
      }

      const idx = currentApps.findIndex((a) => a.name === name);
      if (idx === -1) return;
      if (percent < 0) {
        updateState(idx, { status: "error", progress: 0 });
        return;
      }
      if (percent >= 100) {
        // Instalador nativo já abriu — voltamos pro estado idle sem modal.
        updateState(idx, { status: "idle", progress: 0 });
        // Agenda uma verificação para atualizar os badges de "Baixado"
        setTimeout(() => checkUpdates(), 1000);
        return;
      }
      updateState(idx, { status: "downloading", progress: percent });
    };
    return () => {
      window.__onNativeApkProgress = undefined;
    };
  }, [isNative]);

  const handleModalKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setModalChoice((c) => (c === "yes" ? "no" : "yes"));
    } else if (e.key === "Escape" || e.key === "Backspace") {
      e.preventDefault();
      if (installModalOpen) {
        setInstallModalOpen(false);
        setInstallModalAppIndex(null);
      } else if (updateModalOpen) {
        setUpdateModalOpen(false);
        setAppToUpdate(null);
      } else {
        closeModal();
      }
    }
  };

  const handleInstallModalAction = () => {
    if (installModalAppIndex === null) return;
    if (modalChoice === "yes" && isNative) {
      window.Android?.openApp(currentApps[installModalAppIndex].packageName);
    }
    setInstallModalOpen(false);
    setInstallModalAppIndex(null);
  };

  const closeModal = () => {
    if (doneIndex === -1) return;
    const url = states[doneIndex].blobUrl;
    if (url) URL.revokeObjectURL(url);
    updateState(doneIndex, { status: "idle", progress: 0, blobUrl: undefined });
  };

  const openApk = () => {
    if (doneIndex === -1) return;
    const url = states[doneIndex].blobUrl;
    if (!url) {
      updateState(doneIndex, { status: "idle", progress: 0, blobUrl: undefined });
      return;
    }
    // Em WebView, `target="_blank"` em blob: não dispara o instalador.
    // Navegação direta é mais compatível e funciona tanto em Chrome
    // quanto em WebView de TV Box.
    try {
      window.location.href = url;
    } catch (err) {
      console.error("openApk failed", err);
    }
    updateState(doneIndex, { status: "idle", progress: 0, blobUrl: undefined });
  };

  return (
    <LoginGate>
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, oklch(0.6 0.2 150 / 0.15) 0%, transparent 70%)" }}
        />
        <div 
          className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, oklch(0.6 0.2 280 / 0.1) 0%, transparent 70%)" }}
        />
      </div>

      <main
        onKeyDown={handleKey}
        className="relative flex h-screen flex-col text-foreground overflow-hidden"
      >
      <header className="shrink-0 px-[clamp(1rem,4vw,4rem)] pt-[clamp(1rem,3vh,3rem)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="tv-title font-black tracking-tight leading-none">
            TV<span style={{ color: "var(--tv-accent)" }}>.</span>Apps
          </h1>
          <p className="mt-3 tv-text text-white/50 font-medium">
            Central de Downloads Automática
          </p>
          {ota.hasUpdate && ota.manifest && (
            <button
              onClick={() => setOtaModalOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white uppercase tracking-wider shadow-[0_0_30px_rgba(249,115,22,0.6)] animate-pulse hover:scale-105 transition-transform"
            >
              <RefreshCcw size={16} />
              ⬆️ Atualização disponível — v{ota.manifest.version}
            </button>
          )}
        </div>

        <div className="flex items-center gap-[clamp(0.5rem,1.5vw,1.5rem)] flex-wrap">
          <button
            onClick={() => { playClick(); ota.checkNow(); }}
            disabled={ota.checking}
            className={`group flex items-center justify-center gap-0 px-4 py-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-2 border-orange-500/40 backdrop-blur-md transition-all duration-300 active:scale-95 focus:outline-none focus:border-orange-400 focus:shadow-[0_0_30px_rgba(249,115,22,0.5)] ${ota.checking ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-500/20 hover:scale-105'}`}
          >
            <RotateCcw size={20} className={`text-orange-400 shrink-0 ${ota.checking ? 'animate-spin' : ''}`} />
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-lg font-bold text-white/90 transition-all duration-300 group-focus:max-w-xs group-focus:ml-2">
              {ota.checking ? "Verificando..." : "Updates"}
            </span>
          </button>

          <button
            onClick={() => { 
              playClick();
              if (typeof window !== "undefined" && typeof window.Android?.openSettings === "function") {
                window.Android.openSettings();
              } else {
                toast.info("Configurações nativas disponíveis apenas no app Android");
              }
            }}
            className="group flex items-center justify-center gap-0 px-4 py-4 rounded-2xl bg-white/5 border-2 border-white/10 backdrop-blur-md transition-all duration-300 active:scale-95 focus:outline-none focus:border-white/40 focus:bg-white/10 focus:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:bg-white/10 hover:scale-105"
          >
            <Settings size={20} className="text-white/70 shrink-0" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-lg font-bold text-white/90 transition-all duration-300 group-focus:max-w-xs group-focus:ml-2">
              Configurações
            </span>
          </button>

          <NetworkIndicator compact />

          <div className="flex items-center gap-[clamp(1rem,2vw,2rem)] px-[clamp(1rem,2vw,2rem)] py-[clamp(0.5rem,1vh,1rem)] rounded-[clamp(1rem,2vw,1.5rem)] bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2 text-white/90">
              <Clock size={20} className="text-tv-accent" />
              <span className="text-[clamp(1.2rem,2.5vw,2rem)] font-bold tabular-nums">{time}</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-white/70">
              <Calendar size={18} className="text-tv-accent" />
              <span className="text-[clamp(0.9rem,1.8vw,1.25rem)] font-medium capitalize">{date}</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-white/70">
              <Cloud size={20} className="text-tv-accent" />
              <span className="text-[clamp(0.9rem,1.8vw,1.25rem)] font-medium">24°C</span>
            </div>
          </div>

        </div>
      </header>

      <section className="tv-card-grid flex-1 min-h-0 items-stretch">
        {currentApps.map((app, i) => {
          const isFocused = focused === i;
          return (
            <button
              key={app.name}
              ref={(el) => {
                refs.current[i] = el;
              }}
              tabIndex={0}
              onFocus={() => setFocused(i)}
              onClick={() => {
                startDownload(i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startDownload(i);
                }
              }}
              className="group relative flex h-[90%] self-center w-full max-w-[clamp(280px,25vw,420px)] max-h-[90%] min-h-0 flex-col items-center justify-center rounded-[clamp(1.5rem,3vw,3rem)] outline-none transition-all duration-300 mx-auto p-[clamp(1rem,2.5vh,2rem)] overflow-hidden"
              style={{
                background:
                  "linear-gradient(160deg, var(--tv-card), oklch(0.18 0.04 270))",
                border: `clamp(2px, 0.4vw, 4px) solid ${isFocused ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                transform: isFocused ? "scale(1.05)" : "scale(1)",
                boxShadow: isFocused
                  ? states[i].hasUpdate 
                    ? "0 25px 80px -10px oklch(0.7 0.25 45 / 0.6), 0 0 0 clamp(4px, 0.6vw, 8px) oklch(0.7 0.25 45 / 0.2)"
                    : "0 25px 80px -10px oklch(0.78 0.22 150 / 0.55), 0 0 0 clamp(4px, 0.6vw, 8px) oklch(0.78 0.22 150 / 0.15)"
                  : states[i].hasUpdate
                    ? "0 15px 40px -10px oklch(0.7 0.25 45 / 0.4)"
                    : "0 10px 30px -10px oklch(0 0 0 / 0.5)",
              }}
            >
              {states[i].hasUpdate && (
                <div className="absolute top-6 left-6 z-10 flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 shadow-[0_0_20px_rgba(249,115,22,0.4)] animate-pulse">
                  <RefreshCcw size={16} className="text-white" />
                  <span className="text-sm font-black text-white tracking-wide uppercase">Update</span>
                </div>
              )}
              {states[i].status === "downloading" ? (
                <div className="flex w-full flex-col items-center px-[clamp(1rem,4vw,3rem)]">
                  <div
                    className="tv-icon-container mb-[clamp(0.5rem,2vh,2rem)] flex items-center justify-center rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))",
                    }}
                  >
                    <Download className="w-1/2 h-1/2" strokeWidth={1.8} color="oklch(0.15 0.03 270)" />
                  </div>
                  <h2 className="tv-text font-bold">{app.name}</h2>
                  <div
                    className="mt-6 h-3 w-full overflow-hidden rounded-full"
                    style={{ background: "oklch(0.28 0.04 270)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${states[i].progress}%`,
                        background:
                          "linear-gradient(90deg, var(--tv-accent), var(--tv-accent-2))",
                      }}
                    />
                  </div>
                  <div
                    className="mt-4 text-4xl font-black tabular-nums"
                    style={{ color: "var(--tv-accent)" }}
                  >
                    {states[i].progress}%
                  </div>
                </div>
              ) : states[i].status === "done" ? (
                <div className="flex flex-col items-center px-8">
                  <div
                    className="tv-icon-container mb-[clamp(0.5rem,2vh,2rem)] flex items-center justify-center rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))",
                    }}
                  >
                    <Check className="w-1/2 h-1/2" strokeWidth={2.5} color="oklch(0.15 0.03 270)" />
                  </div>
                  <h2 className="tv-text font-bold">{app.name}</h2>
                  <p className="mt-3 text-center text-base text-white/70">
                    Download concluído!
                  </p>
                  <p className="mt-2 px-2 text-center text-xs text-white/50">
                    Abra a notificação do Android para instalar
                  </p>
                </div>
              ) : states[i].status === "error" ? (
                <div className="flex flex-col items-center px-8">
                  <div
                    className="tv-icon-container mb-[clamp(0.5rem,2vh,2rem)] flex items-center justify-center rounded-2xl"
                    style={{ background: "oklch(0.4 0.2 25)" }}
                  >
                    <AlertCircle className="w-1/2 h-1/2" strokeWidth={1.8} color="white" />
                  </div>
                  <h2 className="tv-text font-bold">{app.name}</h2>
                  <p className="mt-3 text-center text-base text-white/70">
                    Falha no download
                  </p>
                  <div
                    className="mt-6 rounded-full px-6 py-3 text-sm font-semibold"
                    style={{
                      background: isFocused ? "var(--tv-accent)" : "transparent",
                      color: isFocused ? "oklch(0.15 0.03 270)" : "white",
                      border: `2px solid ${isFocused ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                    }}
                  >
                    Tentar de novo
                  </div>
                </div>
              ) : (
              <>
              <div
                className="tv-icon-container mb-[clamp(0.5rem,2vh,2rem)] flex items-center justify-center rounded-2xl transition-all duration-300 overflow-hidden"
                style={{
                  background: isFocused
                    ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                    : "oklch(0.95 0.005 270)",
                  padding: 0,
                }}
              >
                <img
                  src={app.logo}
                  alt={`${app.name} logo`}
                  className="block transition-all duration-300"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    aspectRatio: "1 / 1",
                    filter: isFocused ? "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" : "none",
                  }}
                />
              </div>
              {states[i].isInstalled ? (
                <div className="absolute top-6 right-6 flex items-center gap-2 rounded-full bg-tv-accent/20 px-4 py-2 border border-tv-accent/30 shadow-[0_0_20px_rgba(94,230,168,0.2)] animate-in fade-in zoom-in duration-300">
                  <Check size={18} className="text-tv-accent" />
                  <span className="text-sm font-bold text-tv-accent tracking-wide uppercase">Instalado</span>
                </div>
              ) : states[i].isDownloaded ? (
                <div className="absolute top-6 right-6 flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-2 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)] animate-in fade-in zoom-in duration-300">
                  <Cloud size={18} className="text-blue-400" />
                  <span className="text-sm font-bold text-blue-400 tracking-wide uppercase">Baixado</span>
                </div>
              ) : null}
              <h2 className="text-[clamp(1.25rem,2.5vw,2.25rem)] font-bold text-center">{app.name}</h2>
              <p className="mt-[clamp(0.25rem,1vh,1rem)] px-4 text-center text-[clamp(0.8rem,1.4vw,1.15rem)] text-white/60 line-clamp-2">
                {app.description}
              </p>
              <div
                className="mt-[clamp(0.75rem,2.5vh,2.5rem)] flex items-center gap-2 rounded-full px-[clamp(1rem,3vw,2.5rem)] py-[clamp(0.5rem,1.5vh,1.25rem)] text-[clamp(0.85rem,1.3vw,1.1rem)] font-bold transition-all whitespace-nowrap"
                style={{
                  background: isFocused ? "var(--tv-accent)" : "transparent",
                  color: isFocused ? "oklch(0.15 0.03 270)" : "white",
                  border: `3px solid ${isFocused ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                }}
              >
                {states[i].isInstalled ? (
                  <>
                    <Play size={22} fill="currentColor" />
                    ABRIR APP
                  </>
                ) : (
                  <>
                    <Download size={22} />
                    INSTALAR
                  </>
                )}
              </div>
              
              </>
              )}
            </button>
          );
        })}
      </section>

      <footer className="shrink-0 px-8 pb-[clamp(0.5rem,2vh,1.5rem)] text-center text-xs md:text-sm text-white/40">
        Selecione um aplicativo e pressione OK para instalar ou abrir
      </footer>

      {modalOpen && (
        <div
          onKeyDown={handleModalKey}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "oklch(0 0 0 / 0.75)", backdropFilter: "blur(8px)" }}
        >
          {updateModalOpen && appToUpdate !== null ? (
            <div
              className="flex w-[600px] flex-col items-center rounded-3xl p-10"
              style={{
                background:
                  "linear-gradient(160deg, var(--tv-card), oklch(0.18 0.04 270))",
                border: "3px solid var(--tv-accent)",
                boxShadow:
                  "0 30px 100px -10px oklch(0.7 0.25 45 / 0.45), 0 0 0 8px oklch(0.7 0.25 45 / 0.12)",
              }}
            >
              <div
                className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl animate-bounce"
                style={{
                  background:
                    "linear-gradient(135deg, #f97316, #ea580c)",
                }}
              >
                <RefreshCcw size={56} strokeWidth={2.5} color="white" />
              </div>
              <h2 className="text-4xl font-black text-white text-center leading-tight">
                Nova versão disponível!
              </h2>
              <p className="mt-4 text-center text-xl text-white/70">
                Uma atualização importante para o <span className="text-tv-accent font-bold">{currentApps[appToUpdate].name}</span> está pronta.
              </p>
              
              <div className="mt-8 grid grid-cols-2 gap-4 w-full px-6">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 flex flex-col items-center">
                  <span className="text-xs text-white/40 uppercase font-bold tracking-wider mb-1">Instalada</span>
                  <span className="text-2xl font-black text-white/60">{states[appToUpdate].installedVersion}</span>
                </div>
                <div className="bg-orange-500/10 rounded-2xl p-4 border border-orange-500/30 flex flex-col items-center">
                  <span className="text-xs text-orange-500/60 uppercase font-bold tracking-wider mb-1">Nova Versão</span>
                  <span className="text-2xl font-black text-orange-500">{currentApps[appToUpdate].version}</span>
                </div>
              </div>

              <div className="mt-10 flex gap-5 w-full">
                <button
                  ref={installYesBtnRef}
                  onFocus={() => setModalChoice("yes")}
                  onClick={() => {
                    setUpdateModalOpen(false);
                    startDownload(appToUpdate, true);
                  }}
                  className="flex-1 rounded-2xl px-8 py-5 text-xl font-black outline-none transition-all"
                  style={{
                    background:
                      modalChoice === "yes"
                        ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                        : "oklch(0.28 0.04 270)",
                    color:
                      modalChoice === "yes" ? "oklch(0.15 0.03 270)" : "white",
                    border: `3px solid ${modalChoice === "yes" ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                    transform: modalChoice === "yes" ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  Atualizar agora
                </button>
                <button
                  ref={installNoBtnRef}
                  onFocus={() => setModalChoice("no")}
                  onClick={() => {
                    setUpdateModalOpen(false);
                    setAppToUpdate(null);
                  }}
                  className="flex-1 rounded-2xl px-8 py-5 text-xl font-bold outline-none transition-all"
                  style={{
                    background:
                      modalChoice === "no"
                        ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                        : "oklch(0.28 0.04 270)",
                    color:
                      modalChoice === "no" ? "oklch(0.15 0.03 270)" : "white",
                    border: `3px solid ${modalChoice === "no" ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                    transform: modalChoice === "no" ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  Depois
                </button>
              </div>
              <div className="mt-6 flex items-center gap-4 text-white/30 text-sm">
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                   <span>{currentApps[appToUpdate].updateDate}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <div className="flex items-center gap-1">
                  <Download size={14} />
                  <span>{currentApps[appToUpdate].size}</span>
                </div>
              </div>
            </div>
          ) : installModalOpen ? (
            <div
              className="flex w-[560px] flex-col items-center rounded-3xl p-10"
              style={{
                background:
                  "linear-gradient(160deg, var(--tv-card), oklch(0.18 0.04 270))",
                border: "3px solid var(--tv-accent)",
                boxShadow:
                  "0 30px 100px -10px oklch(0.78 0.22 150 / 0.45), 0 0 0 8px oklch(0.78 0.22 150 / 0.12)",
              }}
            >
              <div
                className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))",
                }}
              >
                <Check size={56} strokeWidth={2.5} color="oklch(0.15 0.03 270)" />
              </div>
              <h2 className="text-3xl font-bold text-white text-center">
                Este aplicativo já está instalado.
              </h2>
              <p className="mt-3 text-center text-lg text-white/80">
                Deseja abrir o aplicativo?
              </p>
              <div className="mt-8 flex gap-5">
                <button
                  ref={installYesBtnRef}
                  onFocus={() => setModalChoice("yes")}
                  onClick={handleInstallModalAction}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleInstallModalAction();
                    }
                  }}
                  className="rounded-2xl px-10 py-4 text-lg font-bold outline-none transition-all"
                  style={{
                    background:
                      modalChoice === "yes"
                        ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                        : "oklch(0.28 0.04 270)",
                    color:
                      modalChoice === "yes" ? "oklch(0.15 0.03 270)" : "white",
                    border: `3px solid ${modalChoice === "yes" ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                    transform: modalChoice === "yes" ? "scale(1.06)" : "scale(1)",
                  }}
                >
                  Sim, abrir
                </button>
                <button
                  ref={installNoBtnRef}
                  onFocus={() => setModalChoice("no")}
                  onClick={handleInstallModalAction}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleInstallModalAction();
                    }
                  }}
                  className="rounded-2xl px-10 py-4 text-lg font-bold outline-none transition-all"
                  style={{
                    background:
                      modalChoice === "no"
                        ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                        : "oklch(0.28 0.04 270)",
                    color:
                      modalChoice === "no" ? "oklch(0.15 0.03 270)" : "white",
                    border: `3px solid ${modalChoice === "no" ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                    transform: modalChoice === "no" ? "scale(1.06)" : "scale(1)",
                  }}
                >
                  Não
                </button>
              </div>
            </div>
          ) : (
            <div
              className="flex w-[560px] flex-col items-center rounded-3xl p-10"
              style={{
                background:
                  "linear-gradient(160deg, var(--tv-card), oklch(0.18 0.04 270))",
                border: "3px solid var(--tv-accent)",
                boxShadow:
                  "0 30px 100px -10px oklch(0.78 0.22 150 / 0.45), 0 0 0 8px oklch(0.78 0.22 150 / 0.12)",
              }}
            >
              <div
                className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))",
                }}
              >
                <Check size={56} strokeWidth={2.5} color="oklch(0.15 0.03 270)" />
              </div>
              <h2 className="text-3xl font-bold text-white">
                {currentApps[doneIndex]?.name}
              </h2>
              <p className="mt-3 text-center text-lg text-white/80">
                Download concluído.
              </p>
              <p className="mt-1 text-center text-lg text-white/80">
                Deseja abrir o arquivo?
              </p>
              <div className="mt-8 flex gap-5">
                <button
                  ref={yesBtnRef}
                  onFocus={() => setModalChoice("yes")}
                  onClick={openApk}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openApk();
                    }
                  }}
                  className="rounded-2xl px-10 py-4 text-lg font-bold outline-none transition-all"
                  style={{
                    background:
                      modalChoice === "yes"
                        ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                        : "oklch(0.28 0.04 270)",
                    color:
                      modalChoice === "yes" ? "oklch(0.15 0.03 270)" : "white",
                    border: `3px solid ${modalChoice === "yes" ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                    transform: modalChoice === "yes" ? "scale(1.06)" : "scale(1)",
                  }}
                >
                  Sim, abrir
                </button>
                <button
                  ref={noBtnRef}
                  onFocus={() => setModalChoice("no")}
                  onClick={closeModal}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      closeModal();
                    }
                  }}
                  className="rounded-2xl px-10 py-4 text-lg font-bold outline-none transition-all"
                  style={{
                    background:
                      modalChoice === "no"
                        ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                        : "oklch(0.28 0.04 270)",
                    color:
                      modalChoice === "no" ? "oklch(0.15 0.03 270)" : "white",
                    border: `3px solid ${modalChoice === "no" ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                    transform: modalChoice === "no" ? "scale(1.06)" : "scale(1)",
                  }}
                >
                  Não
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>

    <OtaUpdateModal
      open={otaModalOpen}
      manifest={ota.manifest}
      installedVersion={ota.installedVersion}
      downloading={otaDownloading}
      progress={otaProgress}
      speedBps={otaSpeedBps}
      onUpdate={startOtaUpdate}
      onLater={() => setOtaModalOpen(false)}
    />
    </div>
    </LoginGate>
  );
}
