import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Login Admin — TV.Apps" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/apps-admin` },
        });
        if (error) {
          toast.error("Erro ao criar conta", { description: error.message });
        } else {
          toast.success("Conta criada! Você já pode fazer login.");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          toast.error("Login falhou", { description: error.message });
        } else {
          toast.success("Bem-vindo!");
          navigate({ to: "/apps-admin" });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-background text-foreground px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
          style={{
            background:
              "radial-gradient(circle, oklch(0.78 0.18 155 / 0.22) 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-10 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 0 60px oklch(0.78 0.18 155 / 0.18), 0 0 0 1px oklch(0.78 0.18 155 / 0.15) inset",
        }}
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight">
            TV<span style={{ color: "oklch(0.78 0.18 155)" }}>.</span>Apps
          </h1>
          <p className="mt-2 text-sm text-white/60">Painel administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-[oklch(0.78_0.18_155)] focus:bg-white/10"
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:border-[oklch(0.78_0.18_155)] focus:bg-white/10"
              placeholder="••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[oklch(0.78_0.18_155)] font-bold text-black transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "..." : mode === "login" ? "ENTRAR" : "CRIAR CONTA"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-sm text-white/50 hover:text-white/80"
        >
          {mode === "login"
            ? "Primeira vez? Criar conta"
            : "Já tem conta? Fazer login"}
        </button>
      </div>
    </div>
  );
}