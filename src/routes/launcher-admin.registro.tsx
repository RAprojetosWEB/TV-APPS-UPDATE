import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { bootstrapFirstAdmin } from "@/lib/admin-bootstrap.functions";

export const Route = createFileRoute("/launcher-admin/registro")({
  component: RegisterPage,
  head: () => ({ meta: [{ title: "Criar conta — Painel de Aparelhos" }] }),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error("Não foi possível criar a conta", { description: error.message });
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        toast.error("Conta criada, mas não foi possível identificar o usuário.");
        return;
      }

      // Garante que a sessão está pronta antes de chamar a server fn
      // (signUp com auto-confirm já retorna sessão ativa)
      try {
        await bootstrapFirstAdmin();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        toast.error("Conta criada, mas erro ao definir permissão admin", {
          description: msg,
        });
        return;
      }

      toast.success("Conta admin criada com sucesso!");
      await supabase.auto?.signOut?.();
      navigate({ to: "/launcher-admin/login" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Criar conta admin</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Cadastre seu email e senha para acessar o painel
          </p>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-white outline-none focus:border-neutral-500"
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
              Confirmar senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-12 rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-white outline-none focus:border-neutral-500"
              placeholder="••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Criando…" : "CRIAR CONTA"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-400">
          Já tem uma conta?{" "}
          <Link to="/launcher-admin/login" className="text-white underline hover:text-neutral-200">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
