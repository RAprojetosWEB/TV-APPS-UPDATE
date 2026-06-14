import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/launcher-admin/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Painel de Aparelhos" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Não foi possível entrar", { description: error.message });
        return;
      }
      toast.success("Bem-vindo!");
      navigate({ to: "/launcher-admin" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Painel de Aparelhos</h1>
          <p className="mt-1 text-sm text-neutral-400">Entre com seu email e senha</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-white outline-none focus:border-neutral-500"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-white outline-none focus:border-neutral-500"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Entrando…" : "ENTRAR"}
          </button>
        </form>
      </div>
    </div>
  );
}