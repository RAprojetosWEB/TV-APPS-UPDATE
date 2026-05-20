import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Download, Play, Tv, AlertCircle } from "lucide-react";

// Ponte com o APK nativo (WebView host). Se existir, instalamos APK direto
// via PackageInstaller nativo; senão, fazemos o download "tradicional".
type AndroidBridge = {
  isNative: () => boolean;
  installApk: (url: string, name: string) => void;
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
    description: "Streaming de filmes e séries",
    url: "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/unitv.apk",
    Icon: Play,
  },
  {
    name: "Nexa TV",
    description: "Player de mídia universal",
    url: "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/Nexa_TV.apk",
    Icon: Tv,
  },
  {
    name: "AllApp",
    description: "Tudo em um só app",
    url: "https://apyjsxxuuptelmiwnzwq.supabase.co/storage/v1/object/public/Alpicativos%20APKs/AllApp.apk",
    Icon: Download,
  },
];

function Index() {
  // Detecta a ponte nativa de forma tolerante: em algumas WebViews os métodos
  // expostos por addJavascriptInterface aparecem como `object`, não `function`.
  // Então só checamos a EXISTÊNCIA da chave `installApk` em `window.Android`.
  const detect = () =>
    typeof window !== "undefined" &&
    !!window.Android &&
    "installApk" in (window.Android as object);
  const [isNative, setIsNative] = useState<boolean>(detect);
  const [bridgeVersion, setBridgeVersion] = useState<string>("");
  useEffect(() => {
    const check = () => {
      if (!detect()) return;
      setIsNative(true);
      try {
        setBridgeVersion(window.Android?.version?.() ?? "?");
      } catch {
        setBridgeVersion("?");
      }
    };
    check();
    // WebView pode injetar a interface logo após o load — re-checa algumas vezes.
    const ids = [50, 200, 600, 1500].map((ms) => window.setTimeout(check, ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);
  const [focused, setFocused] = useState(1);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [states, setStates] = useState<
    Array<{
      status: "idle" | "downloading" | "done" | "error";
      progress: number;
    }>
  >(() => APPS.map(() => ({ status: "idle", progress: 0 })));

  useEffect(() => {
    refs.current[focused]?.focus();
  }, [focused]);

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

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocused((i) => Math.min(APPS.length - 1, i + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocused((i) => Math.max(0, i - 1));
    }
  };

  const updateState = (
    i: number,
    patch: Partial<{
      status: "idle" | "downloading" | "done" | "error";
      progress: number;
    }>,
  ) => {
    setStates((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const startDownload = (i: number) => {
    const app = APPS[i];
    if (states[i].status === "downloading") return;

    // Modo nativo: delega download + instalação ao APK host.
    if (isNative && window.Android) {
      updateState(i, { status: "downloading", progress: 0 });
      window.Android.installApk(app.url, app.name);
      return;
    }

    // Fallback (navegador ou WebView sem ponte): navega direto para a URL
    // do APK. O Chrome/WebView reconhece o tipo e dispara o download nativo.
    // Dentro do nosso APK, mesmo se a ponte falhar, o setDownloadListener
    // do MainActivity intercepta esse http e roda o mesmo fluxo nativo.
    window.location.href = app.url;
  };

  // Recebe progresso/erros do bridge nativo.
  useEffect(() => {
    if (!isNative) return;
    window.__onNativeApkProgress = (name, percent, error) => {
      const idx = APPS.findIndex((a) => a.name === name);
      if (idx === -1) return;
      if (percent < 0) {
        console.error("Erro nativo:", error);
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

  return (
    <main
      onKeyDown={handleKey}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top left, oklch(0.3 0.12 280 / 0.4), transparent 60%), radial-gradient(ellipse at bottom right, oklch(0.3 0.12 150 / 0.35), transparent 60%)",
      }}
    >
      <header className="px-16 pt-6">
        <h1 className="text-4xl font-black tracking-tight">
          TV<span style={{ color: "var(--tv-accent)" }}>.</span>Apps
        </h1>
        <p className="mt-1 text-base text-white/60">
          Use as setas do controle e pressione OK para baixar
        </p>
      </header>

      <section className="flex flex-1 items-center justify-center gap-8 px-16 py-6">
        {APPS.map((app, i) => {
          const isFocused = focused === i;
          const Icon = app.Icon;
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
              className="group relative flex h-[360px] w-[280px] flex-col items-center justify-center rounded-3xl outline-none transition-all duration-300"
              style={{
                background:
                  "linear-gradient(160deg, var(--tv-card), oklch(0.18 0.04 270))",
                border: `3px solid ${isFocused ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                transform: isFocused ? "scale(1.05)" : "scale(1)",
                boxShadow: isFocused
                  ? "0 25px 80px -10px oklch(0.78 0.22 150 / 0.55), 0 0 0 6px oklch(0.78 0.22 150 / 0.15)"
                  : "0 10px 30px -10px oklch(0 0 0 / 0.5)",
              }}
            >
              {states[i].status === "downloading" ? (
                <div className="flex w-full flex-col items-center px-8">
                  <div
                    className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))",
                    }}
                  >
                    <Download size={44} strokeWidth={1.8} color="oklch(0.15 0.03 270)" />
                  </div>
                  <h2 className="text-2xl font-bold">{app.name}</h2>
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
                    className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))",
                    }}
                  >
                    <Check size={44} strokeWidth={2.5} color="oklch(0.15 0.03 270)" />
                  </div>
                  <h2 className="text-2xl font-bold">{app.name}</h2>
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
                    className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl"
                    style={{ background: "oklch(0.4 0.2 25)" }}
                  >
                    <AlertCircle size={44} strokeWidth={1.8} color="white" />
                  </div>
                  <h2 className="text-2xl font-bold">{app.name}</h2>
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
                className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-300"
                style={{
                  background: isFocused
                    ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                    : "oklch(0.28 0.04 270)",
                }}
              >
                <Icon
                  className="transition-all"
                  size={44}
                  strokeWidth={1.8}
                  color={isFocused ? "oklch(0.15 0.03 270)" : "white"}
                />
              </div>
              <h2 className="text-2xl font-bold">{app.name}</h2>
              <p className="mt-3 px-6 text-center text-base text-white/60">
                {app.description}
              </p>
              <div
                className="mt-8 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all"
                style={{
                  background: isFocused ? "var(--tv-accent)" : "transparent",
                  color: isFocused ? "oklch(0.15 0.03 270)" : "white",
                  border: `2px solid ${isFocused ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                }}
              >
                <Download size={16} />
                BAIXAR APK
              </div>
              </>
              )}
            </button>
          );
        })}
      </section>

      <footer className="flex items-center justify-between px-16 pb-8 text-sm text-white/40">
        <span>
          Após o download, abra o arquivo APK e permita instalação de fontes desconhecidas
        </span>
        <span className="font-mono text-xs text-white/30">
          {isNative ? `nativo${bridgeVersion ? ` v${bridgeVersion}` : ""}` : "web"}
        </span>
      </footer>
    </main>
  );
}
