import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

type Device = {
  id: string;
  device_id: string | null;
  client_name: string | null;
  status: string;
  expires_at: string | null;
  registered_at: string;
  notes: string | null;
};

type Filter = "all" | "active" | "blocked" | "expiring";

export const Route = createFileRoute("/launcher-admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [originalName, setOriginalName] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("devices")
      .select("*")
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

  const stats = useMemo(() => {
    const now = Date.now();
    const in7 = now + 7 * 24 * 60 * 60 * 1000;
    let active = 0;
    let blocked = 0;
    let expiring = 0;
    for (const d of devices) {
      if (d.status === "active") active++;
      else blocked++;
      if (d.expires_at) {
        const t = new Date(d.expires_at).getTime();
        if (t >= now && t <= in7) expiring++;
      }
    }
    return { total: devices.length, active, blocked, expiring };
  }, [devices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const in7 = now + 7 * 24 * 60 * 60 * 1000;
    return devices.filter((d) => {
      if (filter === "active" && d.status !== "active") return false;
      if (filter === "blocked" && d.status !== "blocked") return false;
      if (filter === "expiring") {
        if (!d.expires_at) return false;
        const t = new Date(d.expires_at).getTime();
        if (t < now || t > in7) return false;
      }
      if (!q) return true;
      return (d.client_name ?? "").toLowerCase().includes(q);
    });
  }, [devices, search, filter]);

  async function toggleStatus(d: Device) {
    const newStatus = d.status === "active" ? "blocked" : "active";
    const { error } = await supabase
      .from("devices")
      .update({ status: newStatus })
      .eq("id", d.id);
    if (error) {
      toast.error("Não foi possível atualizar", { description: error.message });
      return;
    }
    toast.success(newStatus === "active" ? "Aparelho ativado" : "Aparelho bloqueado");
    setDevices((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, status: newStatus } : x)),
    );
  }

  async function renameDevice(id: string, newName: string) {
    const trimmed = newName.trim();
    const { error } = await supabase
      .from("devices")
      .update({ client_name: trimmed || null })
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível renomear", { description: error.message });
      return;
    }
    toast.success("Nome atualizado");
    setDevices((prev) =>
      prev.map((x) => (x.id === id ? { ...x, client_name: trimmed || null } : x)),
    );
  }

  function startEdit(d: Device) {
    setEditingId(d.id);
    setEditName(d.client_name ?? "");
    setOriginalName(d.client_name ?? "");
  }

  function commitEdit(id: string) {
    if (editingId === id) {
      renameDevice(id, editName);
      setEditingId(null);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total de aparelhos" value={stats.total} tone="neutral" onClick={() => setFilter("all")} />
        <StatCard label="Ativos" value={stats.active} tone="green" onClick={() => setFilter("active")} />
        <StatCard label="Bloqueados" value={stats.blocked} tone="red" onClick={() => setFilter("blocked")} />
        <StatCard label="Vencendo em 7 dias" value={stats.expiring} tone="orange" onClick={() => setFilter("expiring")} />
      </div>

      <div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome do cliente…"
          className="w-full h-11 rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-600"
        />
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
        <div className="grid grid-cols-12 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
          <div className="col-span-5">Cliente</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Vencimento</div>
          <div className="col-span-2 text-right">Ação</div>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-neutral-500">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-neutral-500">
            Nenhum aparelho encontrado.
          </div>
        ) : (
          filtered.map((d) => {
            const isActive = d.status === "active";
            return (
              <div
                key={d.id}
                className="grid grid-cols-12 items-center px-5 py-4 border-b border-neutral-800/60 last:border-b-0"
              >
                <div className="col-span-5">
                  {editingId === d.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(d.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      onBlur={() => commitEdit(d.id)}
                      className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm text-white outline-none focus:border-neutral-500"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {d.client_name?.trim() ? d.client_name : "Novo dispositivo"}
                      </span>
                      <button
                        onClick={() => startEdit(d)}
                        className="text-neutral-500 hover:text-neutral-300 transition-colors"
                        title="Renomear"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="text-xs text-neutral-500 mt-0.5 truncate">
                    {d.device_id ?? "Aguardando primeira conexão"}
                  </div>
                </div>
                <div className="col-span-2">
                  <StatusBadge status={d.status} />
                </div>
                <div className="col-span-3 text-sm text-neutral-300">
                  {formatDate(d.expires_at)}
                </div>
                <div className="col-span-2 text-right">
                  <button
                    onClick={() => toggleStatus(d)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    {isActive ? "Bloquear" : "Ativar"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "neutral" | "green" | "red" | "orange";
  onClick?: () => void;
}) {
  const toneClasses = {
    neutral: "border-neutral-800 bg-neutral-900/50",
    green: "border-emerald-500/20 bg-emerald-500/5",
    red: "border-red-500/20 bg-red-500/5",
    orange: "border-orange-500/30 bg-orange-500/10",
  }[tone];
  const valueColor = {
    neutral: "text-white",
    green: "text-emerald-400",
    red: "text-red-400",
    orange: "text-orange-400",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border py-2 px-3 text-left transition-colors hover:brightness-110 ${toneClasses} ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className={`text-xl font-bold ${valueColor}`}>{value}</div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ativo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Bloqueado
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return <span className="text-neutral-600">—</span>;
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}