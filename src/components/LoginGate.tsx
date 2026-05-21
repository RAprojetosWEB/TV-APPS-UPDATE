import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LogIn, RefreshCcw, AlertTriangle } from "lucide-react";
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
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    setAuthed(isAuthenticated());
  }, []);

  useEffect(() => {
    if (mounted && !authed) {
      // foco inicial no campo de senha
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [mounted, authed]);

  async function handleSubmit() {
    if (loading) return;
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
        setAuthed(true);
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
            className="group relative flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[oklch(0.78_0.18_155)] text-lg font-bold tracking-wide text-black transition-all duration-200 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-[oklch(0.78_0.18_155/0.5)] focus:shadow-[0_0_40px_oklch(0.78_0.18_155/0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="size-5" />
            ENTRAR
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Use ↑ ↓ para navegar · Enter para confirmar
        </p>
      </div>
    </div>
  );
}