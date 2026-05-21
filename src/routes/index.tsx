import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Download, Play, AlertCircle, Calendar, Clock, Cloud, RefreshCcw, Search, Info } from "lucide-react";
import { NetworkIndicator } from "@/components/NetworkIndicator";
import { useDateTime } from "@/hooks/useDateTime";
import { toast } from "sonner";
import unitvLogo from "@/assets/unitv.png";
import nexatvLogo from "@/assets/nexatv.png";
import alphaplayLogo from "@/assets/alphaplay.webp";

// Ponte com o APK nativo (WebView host). Se existir, instalamos APK direto
// via PackageInstaller nativo; senão, fazemos o download "tradicional".
type AndroidBridge = {
  isNative: () => boolean;
  installApk: (url: string, name: string) => void;
  isAppInstalled: (packageName: string) => boolean;
  openApp: (packageName: string) => void;
  version?: () => string;
};
declare global {
  interface Window {
    Android?: AndroidBridge;
    __onNativeApkProgress?: (name: string, percent: number, error: string) => void;
  }
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
    name: "ALPHAPLAY",
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
      hasUpdate: boolean;
      installedVersion?: string;
      blobUrl?: string;
    }>
  >(() => APPS.map(() => ({ status: "idle", progress: 0, isInstalled: false, hasUpdate: false })));

  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [appToUpdate, setAppToUpdate] = useState<number | null>(null);

  const checkUpdates = async (manual = false) => {
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    if (manual) playClick();

    // Simula um delay de rede
    await new Promise(resolve => setTimeout(resolve, manual ? 2000 : 500));

    setStates(prev => prev.map((s, i) => {
      const app = APPS[i];
      const isInstalled = isNative && window.Android?.isAppInstalled?.(app.packageName);
      
      // Mock de versão instalada para demonstração (sempre um pouco menor que a versão atual)
      const installedVersion = isNative && window.Android?.version ? window.Android.version() : (parseFloat(app.version) - 0.3).toFixed(1);
      
      // Consideramos que tem update se a versão do servidor for maior que a instalada
      const hasUpdate = !!(isInstalled && parseFloat(app.version) > parseFloat(installedVersion || "0"));

      return {
        ...s,
        isInstalled: !!isInstalled,
        installedVersion: installedVersion || "0",
        hasUpdate
      };
    }));

    setCheckingUpdates(false);

    if (manual) {
      setStates(currentStates => {
        const updatesFound = currentStates.some(s => s.hasUpdate);
        if (!updatesFound) {
          toast.success("O aplicativo já está atualizado", {
            description: "Todos os seus apps estão na versão mais recente.",
            duration: 3000,
          });
        }
        return currentStates;
      });
    }
  };

  // Atualiza status de instalação e checa updates periodicamente
  useEffect(() => {
    const checkAll = () => {
      if (isNative && window.Android?.isAppInstalled) {
        checkUpdates();
      }
    };
    checkAll();
    const interval = setInterval(checkAll, 15000); // Check every 15s
    return () => clearInterval(interval);
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
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = (focused + 1) % APPS.length;
      setFocused(next);
      playTick();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (focused - 1 + APPS.length) % APPS.length;
      setFocused(next);
      playTick();
    }
  };

  const updateState = (
    i: number,
    patch: Partial<{
      status: "idle" | "downloading" | "done" | "error";
      progress: number;
      blobUrl?: string;
    }>,
  ) => {
    setStates((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const startDownload = async (i: number) => {
    playClick();
    const app = APPS[i];
    
    // Se já estiver instalado, abre direto ao clicar
    if (isNative && window.Android?.isAppInstalled?.(app.packageName)) {
      window.Android.openApp(app.packageName);
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
          received += value.length;
          if (total > 0) {
            updateState(i, { progress: Math.round((received / total) * 100) });
          }
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
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
      updateState(i, { status: "done", progress: 100, blobUrl });
    } catch (err) {
      console.error(err);
      updateState(i, { status: "error", progress: 0 });
    }
  };

  // Recebe progresso/erros do bridge nativo.
  useEffect(() => {
    if (!isNative) return;
    window.__onNativeApkProgress = (name, percent, error) => {
      const idx = APPS.findIndex((a) => a.name === name);
      if (idx === -1) return;
      if (percent < 0) {
        updateState(idx, { status: "error", progress: 0 });
        return;
      }
      if (percent >= 100) {
        // Instalador nativo já abriu — voltamos pro estado idle sem modal.
        updateState(idx, { status: "idle", progress: 0 });
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
      } else {
        closeModal();
      }
    }
  };

  const handleInstallModalAction = () => {
    if (installModalAppIndex === null) return;
    if (modalChoice === "yes" && isNative) {
      window.Android?.openApp(APPS[installModalAppIndex].packageName);
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
    <div className="relative min-h-screen w-screen overflow-x-hidden bg-background">
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
        className="relative flex min-h-screen flex-col text-foreground"
      >
      <header className="px-[clamp(2rem,6vw,6rem)] pt-[clamp(2rem,6vh,6rem)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="tv-title font-black tracking-tight leading-none">
            TV<span style={{ color: "var(--tv-accent)" }}>.</span>Apps
          </h1>
          <p className="mt-3 tv-text text-white/50 font-medium">
            Central de Downloads Automática
          </p>
        </div>

        <div className="flex items-center gap-[clamp(0.5rem,1.5vw,1.5rem)] flex-wrap">
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
          
          <NetworkIndicator />
        </div>
      </header>

      <section className="tv-card-grid flex-1 items-center">
        {APPS.map((app, i) => {
          const isFocused = focused === i;
          return (
            <button
              key={app.name}
              ref={(el) => {
                refs.current[i] = el;
              }}
              tabIndex={0}
              onFocus={() => setFocused(i)}
              onClick={() => startDownload(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startDownload(i);
                }
              }}
              className="group relative flex aspect-[3/4.2] w-full max-w-[clamp(300px,25vw,420px)] max-h-[clamp(400px,80vh,600px)] flex-col items-center justify-center rounded-[clamp(1.5rem,3vw,3rem)] outline-none transition-all duration-300 mx-auto"
              style={{
                background:
                  "linear-gradient(160deg, var(--tv-card), oklch(0.18 0.04 270))",
                border: `clamp(2px, 0.4vw, 4px) solid ${isFocused ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                transform: isFocused ? "scale(1.05)" : "scale(1)",
                boxShadow: isFocused
                  ? "0 25px 80px -10px oklch(0.78 0.22 150 / 0.55), 0 0 0 clamp(4px, 0.6vw, 8px) oklch(0.78 0.22 150 / 0.15)"
                  : "0 10px 30px -10px oklch(0 0 0 / 0.5)",
              }}
            >
              {states[i].status === "downloading" ? (
                <div className="flex w-full flex-col items-center px-[clamp(1rem,4vw,3rem)]">
                  <div
                    className="tv-icon-container mb-8 flex items-center justify-center rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))",
                    }}
                  >
                    <Download className="w-1/2 h-1/2" strokeWidth={1.8} color="oklch(0.15 0.03 270)" />
                  </div>
                  <h2 className="tv-text font-bold">{app.name}</h2>
                  <p className="mt-2 text-sm text-white/60">Baixando…</p>
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
                    className="tv-icon-container mb-8 flex items-center justify-center rounded-2xl"
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
                    className="tv-icon-container mb-8 flex items-center justify-center rounded-2xl"
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
                className="tv-icon-container mb-8 flex items-center justify-center rounded-2xl transition-all duration-300 overflow-hidden"
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
              {states[i].isInstalled && (
                <div className="absolute top-6 right-6 flex items-center gap-2 rounded-full bg-tv-accent/20 px-4 py-2 border border-tv-accent/30 shadow-[0_0_20px_rgba(94,230,168,0.2)] animate-in fade-in zoom-in duration-300">
                  <Check size={18} className="text-tv-accent" />
                  <span className="text-sm font-bold text-tv-accent tracking-wide uppercase">Instalado</span>
                </div>
              )}
              <h2 className="text-4xl font-bold">{app.name}</h2>
              <p className="mt-4 px-6 text-center text-xl text-white/60">
                {app.description}
              </p>
              <div
                className="mt-10 flex items-center gap-3 rounded-full px-10 py-5 text-lg font-bold transition-all"
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
                    QUERO INSTALAR
                  </>
                )}
              </div>
              </>
              )}
            </button>
          );
        })}
      </section>

      <footer className="px-16 pb-8 text-center text-sm text-white/40">
        Após o download, abra o arquivo APK e permita instalação de fontes desconhecidas
      </footer>

      {modalOpen && (
        <div
          onKeyDown={handleModalKey}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "oklch(0 0 0 / 0.75)", backdropFilter: "blur(8px)" }}
        >
          {installModalOpen ? (
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
                {APPS[doneIndex]?.name}
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
    </div>
  );
}
