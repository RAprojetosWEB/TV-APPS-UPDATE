import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/launcher-admin/novo")({
  component: NovoPage,
});

function NovoPage() {
  const navigate = useNavigate();
  const [clientName, setClientName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("devices").insert({
        client_name: clientName.trim(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        notes: notes.trim() || null,
        status: "blocked",
      });
      if (error) {
        toast.error("Não foi possível salvar", { description: error.message });
        return;
      }
      toast.success("Cliente cadastrado");
      navigate({ to: "/launcher-admin" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Cadastrar novo cliente</h1>
        <p className="mt-1 text-sm text-neutral-400">
          O identificador do aparelho será preenchido automaticamente quando ele ligar pela primeira vez.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8"
      >
        <div>
          <label className="block text-sm font-semibold text-neutral-200 mb-2">
            Nome do cliente
          </label>
          <input
            type="text"
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full h-12 rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-white outline-none focus:border-neutral-500"
            placeholder="Ex.: João Silva"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-200 mb-2">
            Data de vencimento
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full h-12 rounded-xl border border-neutral-700 bg-neutral-950 px-4 text-white outline-none focus:border-neutral-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-200 mb-2">
            Observações
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white outline-none focus:border-neutral-500 resize-none"
            placeholder="Anotações opcionais sobre este cliente"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-14 rounded-xl bg-emerald-500 font-bold text-black text-lg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Salvando…" : "SALVAR CLIENTE"}
        </button>
      </form>
    </div>
  );
}