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
    name: "ALPHAPLAY",
    description: "Tudo em um só app",
    url: "https://firebasestorage.googleapis.com/v0/b/update-41ccf.appspot.com/o/alphaplay.apk?alt=media&token=cdbe4055-ea90-4f2c-a540-1b458159ade6",
    Icon: Download,
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
  const [focused, setFocused] = useState(1);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [states, setStates] = useState<
    Array<{
      status: "idle" | "downloading" | "done" | "error";
      progress: number;
      blobUrl?: string;
    }>
  >(() => APPS.map(() => ({ status: "idle", progress: 0 })));
  const [modalChoice, setModalChoice] = useState<"yes" | "no">("yes");
  const yesBtnRef = useRef<HTMLButtonElement | null>(null);
  const noBtnRef = useRef<HTMLButtonElement | null>(null);

  const doneIndex = states.findIndex((s) => s.status === "done");
  const modalOpen = doneIndex !== -1;

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
    if (modalChoice === "yes") yesBtnRef.current?.focus();
    else noBtnRef.current?.focus();
  }, [modalChoice, modalOpen]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (modalOpen) return;
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
    const app = APPS[i];
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
      closeModal();
    }
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
    <main
      onKeyDown={handleKey}
      className="relative flex min-h-screen w-screen flex-col overflow-x-hidden bg-background text-foreground"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top left, oklch(0.3 0.12 280 / 0.4), transparent 60%), radial-gradient(ellipse at bottom right, oklch(0.3 0.12 150 / 0.35), transparent 60%)",
      }}
    >
      <header className="px-16 pt-10">
        <h1 className="tv-title font-black tracking-tight">
          TV<span style={{ color: "var(--tv-accent)" }}>.</span>Apps
        </h1>
        <p className="mt-2 tv-text text-white/60">
          Use as setas do controle e pressione OK para baixar
        </p>
      </header>

      <section className="tv-card-grid flex-1 items-center">
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
              className="group relative flex aspect-[3/4] w-full max-w-[360px] flex-col items-center justify-center rounded-3xl outline-none transition-all duration-300 mx-auto"
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
                className="tv-icon-container mb-8 flex items-center justify-center rounded-2xl transition-all duration-300"
                style={{
                  background: isFocused
                    ? "linear-gradient(135deg, var(--tv-accent), var(--tv-accent-2))"
                    : "oklch(0.28 0.04 270)",
                }}
              >
                <Icon
                  className="transition-all w-1/2 h-1/2"
                  strokeWidth={1.8}
                  color={isFocused ? "oklch(0.15 0.03 270)" : "white"}
                />
              </div>
              <h2 className="tv-text font-bold">{app.name}</h2>
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
                QUERO INSTALAR
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
              {APPS[doneIndex].name}
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
                    modalChoice === "no" ? "oklch(0.4 0.04 270)" : "transparent",
                  color: "white",
                  border: `3px solid ${modalChoice === "no" ? "var(--tv-accent)" : "var(--tv-card-border)"}`,
                  transform: modalChoice === "no" ? "scale(1.06)" : "scale(1)",
                }}
              >
                Não, agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
