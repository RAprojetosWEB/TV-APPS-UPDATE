import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Device = {
  id: string;
  device_id: string | null;
  client_name: string | null;
  status: string;
  expires_at: string | null;
  registered_at: string;
};

export const Route = createFileRoute("/launcher-admin/novos")({
  component: NovosPage,
});

function NovosPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Device | null>(null);
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("devices")
      .select("*")
      .or("client_name.is.null,client_name.eq.Novo dispositivo")
      .order("registered_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar", { description: error.message });
    } else {
      setDevices((data ?? []) as Device[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openModal(d: Device) {
    setEditing(d);
    setName("");
    setExpiresAt("");
  }

  async function handleSave() {
    if (!editing) return;
    if (!name.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({
          client_name: name.trim(),
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          status: "active",
        })
        .eq("id", editing.id);
      if (error) {
        toast.error("Não foi possível salvar", { description: error.message });
        return;
      }
      toast.success("Aparelho ativado");
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novos aparelhos</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Aparelhos que conectaram pela primeira vez e ainda não foram associados a um cliente.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-neutral-500">Carregando…</div>
        ) : devices.length === 0 ? (
          <div className="px-5 py-10 text-center text-neutral-500">
            Nenhum aparelho novo no momento.
          </div>
        ) : (
          devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-4 px-5 py-4 border-b border-neutral-800/60 last:border-b-0 border-l-4 border-l-orange-500 bg-orange-500/5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40">
                    Novo
                  </span>
                  <span className="text-sm text-neutral-400">
                    Conectou em {new Date(d.registered_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="mt-1 text-sm text-neutral-300 truncate">
                  {d.device_id ?? "Sem identificador"}
                </div>
              </div>
              <button
                onClick={() => openModal(d)}
                className="px-4 py-2 rounded-lg bg-orange-500 text-black font-semibold hover:bg-orange-400"
              >
                Associar cliente
              </button>
            </div>
          ))
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <h2 className="text-lg font-bold">Associar cliente ao aparelho</h2>
            <p className="mt-1 text-xs text-neutral-500 break-all">
              {editing.device_id ?? "Sem identificador"}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Nome do cliente</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-white outline-none focus:border-neutral-500"
                  placeholder="Ex.: João Silva"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Data de vencimento (opcional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full h-11 rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-white outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 h-12 rounded-xl border border-neutral-700 text-neutral-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-12 rounded-xl bg-emerald-500 font-bold text-black hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Salvando…" : "Ativar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}