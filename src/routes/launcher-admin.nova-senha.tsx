import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/launcher-admin/nova-senha")({
  component: NewPasswordPage,
  head: () => ({ meta: [{ title: "Nova senha — Painel de Aparelhos" }] }),
});

function NewPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error("Não foi possível salvar a nova senha", { description: error.message });
        return;
      }

      toast.success("Senha alterada. Entre novamente.");
      await supabase.auth.signOut();
      navigate({ to: "/launcher-admin/login" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Nova senha</h1>
          <p className="mt-1 text-sm text-neutral-400">Escolha uma senha para entrar no painel</p>
        </div>

        {!ready ? (
          <div className="space-y-5 text-center">
            <p className="text-sm text-neutral-300">
              Abra esta página pelo link enviado no email para criar uma nova senha.
            </p>
            <Link to="/launcher-admin/resetar-senha" className="block w-full rounded-xl bg-white px-4 py-3 font-bold text-black hover:opacity-90">
              ENVIAR NOVO LINK
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                Nova senha
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
                Confirmar nova senha
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
              {loading ? "Salvando…" : "SALVAR SENHA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}