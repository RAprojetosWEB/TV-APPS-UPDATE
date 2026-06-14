import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Device = {
  id: string;
  device_id: string | null;
  client_name: string | null;
  status: string;
  expires_at: string | null;
  registered_at: string;
  notes: string | null;
};

type Filter = "all" | "active" | "blocked";

export const Route = createFileRoute("/launcher-admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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
    return devices.filter((d) => {
      if (filter === "active" && d.status !== "active") return false;
      if (filter === "blocked" && d.status !== "blocked") return false;
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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total de aparelhos" value={stats.total} tone="neutral" />
        <StatCard label="Ativos" value={stats.active} tone="green" />
        <StatCard label="Bloqueados" value={stats.blocked} tone="red" />
        <StatCard label="Vencendo em 7 dias" value={stats.expiring} tone="orange" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome do cliente…"
          className="flex-1 h-11 rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-neutral-600"
        />
        <div className="flex gap-1 rounded-xl border border-neutral-800 bg-neutral-900 p-1">
          {(["all", "active", "blocked"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Bloqueados"}
            </button>
          ))}
        </div>
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
                  <div className="font-medium text-white">
                    {d.client_name?.trim() ? d.client_name : "Novo dispositivo"}
                  </div>
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
}: {
  label: string;
  value: number;
  tone: "neutral" | "green" | "red" | "orange";
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
    <div className={`rounded-2xl border p-5 ${toneClasses}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-400">
        {label}
      </div>
      <div className={`mt-2 text-4xl font-bold ${valueColor}`}>{value}</div>
    </div>
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