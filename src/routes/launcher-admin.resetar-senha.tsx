import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/launcher-admin/resetar-senha")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Redefinir senha — Painel de Aparelhos" }] }),
});

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/launcher-admin/nova-senha`,
      });

      if (error) {
        toast.error("Não foi possível enviar o acesso", { description: error.message });
        return;
      }

      setSent(true);
      toast.success("Enviamos o acesso para seu email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Redefinir senha</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Digite o email da conta admin
          </p>
        </div>

        {sent ? (
          <div className="space-y-5 text-center">
            <p className="text-sm text-neutral-300">
              Se esse email estiver cadastrado, você receberá um link para escolher uma nova senha.
            </p>
            <Link to="/launcher-admin/login" className="block w-full rounded-xl bg-white px-4 py-3 font-bold text-black hover:opacity-90">
              VOLTAR PARA ENTRAR
            </Link>
          </div>
        ) : (
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

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-white font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Enviando…" : "ENVIAR ACESSO"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-neutral-400">
          Lembrou a senha?{" "}
          <Link to="/launcher-admin/login" className="text-white underline hover:text-neutral-200">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}