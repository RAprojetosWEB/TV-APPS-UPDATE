import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LogIn, RefreshCcw, AlertTriangle, Settings } from "lucide-react";
import { NetworkIndicator } from "./NetworkIndicator";
import { useOtaUpdate } from "@/hooks/useOtaUpdate";
import { OtaUpdateModal } from "./OtaUpdateModal";

// SHA-256("1555"). Para trocar, gere um novo hash e substitua aqui.
// Console: crypto.subtle.digest("SHA-256", new TextEncoder().encode("suasenha"))
const PASSWORD_HASH =
  "2ae7ffb0ec4d1bccf01b12233aaced6949cc5808a4a173315ee508abbbaaaa1c";

const STORAGE_KEY = "tvapps_auth_v1";
const SESSION_TOKEN = "ok";

// Usa sessionStorage para que toda vez que o app for fechado/reaberto
// a senha precise ser digitada novamente.
function getStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isAuthenticated(): boolean {
  const s = getStore();
  if (!s) return false;
  try {
    return s.getItem(STORAGE_KEY) === SESSION_TOKEN;
  } catch {
    return false;
  }
}

export function logout() {
  const s = getStore();
  try {
    s?.removeItem(STORAGE_KEY);
    // também limpa qualquer resquício de versão antiga
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") window.location.reload();
}

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // OTA (Verificação obrigatória antes do login)
  const ota = useOtaUpdate({ autoCheck: true });
  const [otaDownloading, setOtaDownloading] = useState(false);
  const [otaProgress, setOtaProgress] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const updateBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    setAuthed(isAuthenticated());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(t);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || authed) return;
    // Enquanto a verificação OTA ainda está rodando, não focar nada
    // (evita que o teclado virtual da TV apareça antes de sabermos se
    // há atualização pendente).
    if (ota.checking) return;
    if (ota.hasUpdate) {
      // Garante que o input perca o foco para fechar o teclado virtual
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const t = setTimeout(() => updateBtnRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [mounted, authed, ota.hasUpdate, ota.checking]);

  const startOtaUpdate = async () => {
    if (!ota.manifest || otaDownloading) return;
    const url = ota.manifest.apkUrl ?? ota.manifest.url ?? "";
    if (!url) return;

    if (typeof window !== "undefined" && typeof window.Android?.installApk === "function") {
      setOtaDownloading(true);
      setOtaProgress(0);
      try {
        window.Android.installApk(url, "TV.Apps");
      } catch (err) {
        console.error("OTA native install failed", err);
        setOtaDownloading(false);
      }
      return;
    }

    setOtaDownloading(true);
    setOtaProgress(0);
    try {
      const res = await fetch(url);
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
      setOtaDownloading(false);
    } catch (err) {
      console.error("OTA download failed", err);
      setOtaDownloading(false);
    }
  };

  async function handleSubmit() {
    if (loading || isTransitioning) return;
    setLoading(true);
    setError(null);
    try {
      const hash = await sha256Hex(password);
      if (hash === PASSWORD_HASH) {
        try {
          getStore()?.setItem(STORAGE_KEY, SESSION_TOKEN);
        } catch {
          // ignore
        }
        setIsTransitioning(true);
        // Pequeno delay para mostrar a tela de carregamento e melhorar a percepção de TV
        setTimeout(() => {
          setAuthed(true);
        }, 1800);
      } else {
        setError("Senha incorreta");
        setPassword("");
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKey(
    e: KeyboardEvent<HTMLInputElement | HTMLButtonElement>,
  ) {
    const k = e.key;
    if (k === "Enter") {
      e.preventDefault();
      void handleSubmit();
      return;
    }
    if (k === "ArrowDown") {
      e.preventDefault();
      buttonRef.current?.focus();
    } else if (k === "ArrowUp") {
      e.preventDefault();
      inputRef.current?.focus();
    }
  }

  // Evita hidratação divergente: nada no SSR.
  if (!mounted) {
    return (
      <div className="min-h-screen w-screen bg-background" aria-hidden />
    );
  }

  if (authed) return <>{children}</>;

  if (showSplash) {
    return (
      <div className="relative min-h-screen w-screen overflow-hidden bg-background text-foreground flex items-center justify-center animate-in fade-in duration-500">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
            style={{
              background:
                "radial-gradient(circle, oklch(0.78 0.18 155 / 0.35) 0%, transparent 70%)",
            }}
          />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-6 text-center animate-in zoom-in-95 duration-700">
          <h1
            className="font-black tracking-tight text-white"
            style={{
              fontSize: "clamp(4rem, 14vw, 10rem)",
              textShadow: "0 0 60px oklch(0.78 0.18 155 / 0.6)",
            }}
          >
            TV<span style={{ color: "oklch(0.78 0.18 155)" }}>.</span>Apps
          </h1>
          <p
            className="font-light tracking-wide text-white/70"
            style={{ fontSize: "clamp(1rem, 2.2vw, 1.75rem)" }}
          >
            A maneira mais fácil de baixar apps
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.18_155)] animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.18_155)] animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2 w-2 rounded-full bg-[oklch(0.78_0.18_155)] animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  if (isTransitioning) {
    return (
      <div className="relative min-h-screen w-screen overflow-hidden bg-background text-foreground flex items-center justify-center animate-in fade-in duration-700">
        {/* Glow verde */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
            style={{
              background:
                "radial-gradient(circle, oklch(0.78 0.18 155 / 0.15) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 text-center animate-in zoom-in-95 duration-1000">
          <div className="relative flex items-center justify-center h-24 w-24">
            {/* Spinner Minimalista */}
            <div className="absolute inset-0 rounded-full border-[3px] border-white/5" />
            <div 
              className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[oklch(0.78_0.18_155)] animate-spin" 
              style={{ animationDuration: '0.8s' }}
            />
            <div className="size-10 rounded-full bg-white/5 animate-pulse" />
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-white/90">
              Carregando conteúdo...
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="h-1 w-1 rounded-full bg-[oklch(0.78_0.18_155)] animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1 w-1 rounded-full bg-[oklch(0.78_0.18_155)] animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1 w-1 rounded-full bg-[oklch(0.78_0.18_155)] animate-bounce" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ota.hasUpdate) {
    return (
      <div className="relative min-h-screen w-screen overflow-hidden bg-background text-foreground flex items-center justify-center px-6 animate-in fade-in duration-500">
        {/* Glow âmbar */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
            style={{
              background:
                "radial-gradient(circle, oklch(0.78 0.18 70 / 0.28) 0%, transparent 70%)",
            }}
          />
        </div>

        <div
          className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-10 backdrop-blur-xl animate-in zoom-in-95 duration-500"
          style={{
            boxShadow:
              "0 0 60px oklch(0.78 0.18 70 / 0.25), 0 0 0 1px oklch(0.78 0.18 70 / 0.2) inset",
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-3xl font-bold">Atualização Obrigatória</h2>
            <p className="mt-4 text-base text-white/70">
              Uma nova versão do <span className="font-bold text-white">TV.Apps</span> está disponível e é necessária para continuar.
            </p>

            <div className="mt-8 w-full space-y-4">
              {otaDownloading ? (
                <div className="space-y-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${otaProgress}%` }}
                    />
                  </div>
                  <p className="text-sm font-medium text-amber-500">
                    Baixando atualização... {otaProgress}%
                  </p>
                </div>
              ) : (
                <button
                  ref={updateBtnRef}
                  onClick={startOtaUpdate}
                  className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-amber-500 text-xl font-bold text-black transition-all hover:scale-[1.02] focus:ring-4 focus:ring-amber-500/50"
                >
                  <RefreshCcw className="size-6 animate-spin-slow" />
                  ATUALIZAR AGORA
                </button>
              )}
            </div>

            <p className="mt-6 text-xs text-white/30 uppercase tracking-widest">
              Versão {ota.manifest?.versionName ?? ota.manifest?.version} disponível
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background text-foreground flex items-center justify-center px-6">
      {/* Glow verde */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
          style={{
            background:
              "radial-gradient(circle, oklch(0.78 0.18 155 / 0.28) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-[20%] -right-[10%] h-[50%] w-[50%] rounded-full blur-[140px]"
          style={{
            background:
              "radial-gradient(circle, oklch(0.6 0.2 280 / 0.18) 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500"
        style={{
          boxShadow:
            "0 0 60px oklch(0.78 0.18 155 / 0.25), 0 0 0 1px oklch(0.78 0.18 155 / 0.2) inset",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center text-center">
              <h1 className="text-5xl font-black tracking-tight leading-none">
                TV<span style={{ color: "var(--tv-accent, #4ade80)" }}>.</span>Apps
              </h1>
              <h2 className="mt-8 text-3xl font-bold">Bem-vindo</h2>
              <p className="mt-2 text-base text-white/60">
                Digite a senha para continuar
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleKey}
                placeholder="••••••"
                aria-label="Senha"
                className="w-full h-16 rounded-2xl border-2 border-white/10 bg-white/5 px-6 text-2xl tracking-[0.3em] text-white text-center outline-none transition-all duration-200 placeholder:text-white/20 placeholder:tracking-normal focus:border-[oklch(0.78_0.18_155)] focus:bg-white/10 focus:shadow-[0_0_0_4px_oklch(0.78_0.18_155/0.25),0_0_30px_oklch(0.78_0.18_155/0.45)]"
              />

              {error && (
                <p
                  role="alert"
                  className="text-center text-sm font-semibold text-red-400 animate-in fade-in slide-in-from-top-1"
                >
                  {error}
                </p>
              )}

              <button
                ref={buttonRef}
                type="button"
                onClick={() => void handleSubmit()}
                onKeyDown={handleKey}
                disabled={loading || password.length === 0}
                className="group relative flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[oklch(0.78_0.18_155)] text-lg font-bold tracking-wide text-black transition-all duration-150 hover:brightness-110 focus:outline-none focus:scale-[1.03] focus:ring-2 focus:ring-white/50 focus:shadow-[0_0_50px_oklch(0.78_0.18_155/0.8)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="size-5" />
                ENTRAR
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && typeof window.Android?.openSettings === "function") {
                    window.Android.openSettings();
                  }
                }}
                aria-label="Configurações"
                title="Configurações"
                className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-white/10 bg-white/5 text-white/70 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-white/30 hover:bg-white/10 hover:text-white focus:outline-none focus:scale-105 focus:border-white/50 focus:bg-white/10 focus:text-white focus:shadow-[0_0_25px_rgba(255,255,255,0.25)]"
              >
                <Settings className="size-6" />
              </button>
              <NetworkIndicator />
            </div>

            <p className="mt-6 text-center text-xs text-white/30">
              Use ↑ ↓ para navegar · Enter para confirmar
            </p>
      </div>

      <p className="absolute top-6 left-0 right-0 z-10 px-6 text-center text-white/50" style={{ fontSize: "1.35rem" }}>
        Acesso restrito a clientes. Peça o acesso no WhatsApp{" "}
        <span className="font-semibold text-white/80">14 99868-1696</span>
      </p>
    </div>
  );
}