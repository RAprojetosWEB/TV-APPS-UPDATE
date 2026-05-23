import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  listAppsForAdmin,
  toggleAppBlock,
  updateApp,
  checkIsAdmin,
  getLoginPassword,
  updateLoginPassword,
  createApp,
  deleteApp,
  duplicateApp,
  reorderApps,
  listLauncherVersions,
  publishLauncherVersion,
  setLatestLauncherVersion,
  deleteLauncherVersion,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import {
  Lock, LogOut, Pencil, Save, X, Eye, EyeOff, KeyRound, Upload,
  Plus, Trash2, Copy, GripVertical, Package, CheckCircle2, RotateCcw,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin — TV.Apps" }],
  }),
});

type AppRow = {
  id: string;
  name: string;
  package_name: string;
  description: string | null;
  icon_url: string | null;
  apk_url: string | null;
  display_order: number;
  is_active: boolean;
  is_blocked: boolean;
  block_reason: string | null;
};

type LauncherVersion = {
  id: string;
  version_name: string;
  version_code: number;
  apk_url: string | null;
  apk_size_mb: number | null;
  changelog: string | null;
  is_latest: boolean | null;
  created_at: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const listFn = useServerFn(listAppsForAdmin);
  const toggleFn = useServerFn(toggleAppBlock);
  const updateFn = useServerFn(updateApp);
  const checkFn = useServerFn(checkIsAdmin);
  const getPwdFn = useServerFn(getLoginPassword);
  const setPwdFn = useServerFn(updateLoginPassword);

  const [pwd, setPwd] = useState("");
  const [pwdLoaded, setPwdLoaded] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/login" });
        return;
      }
      try {
        const { isAdmin } = await checkFn();
        if (cancelled) return;
        if (!isAdmin) {
          toast.error("Acesso negado", {
            description: "Sua conta não é administrador.",
          });
          navigate({ to: "/login" });
          return;
        }
        setChecking(false);
        await refresh();
        try {
          const { password } = await getPwdFn();
          if (!cancelled) {
            setPwd(password);
            setPwdLoaded(true);
          }
        } catch (err) {
          console.error("getLoginPassword", err);
        }
      } catch (err) {
        console.error(err);
        navigate({ to: "/login" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const { apps } = await listFn();
      setApps(apps as AppRow[]);
    } catch (err) {
      toast.error("Erro ao carregar apps", { description: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(app: AppRow, nextBlocked: boolean) {
    if (nextBlocked) {
      setBlocking(app.id);
      setReason(app.block_reason ?? "");
      return;
    }
    try {
      await toggleFn({ data: { appId: app.id, isBlocked: false, reason: null } });
      toast.success(`${app.name} desbloqueado`);
      await refresh();
    } catch (err) {
      toast.error("Erro", { description: String(err) });
    }
  }

  async function confirmBlock(app: AppRow) {
    try {
      await toggleFn({
        data: {
          appId: app.id,
          isBlocked: true,
          reason: reason.trim() || null,
        },
      });
      toast.success(`${app.name} bloqueado`);
      setBlocking(null);
      setReason("");
      await refresh();
    } catch (err) {
      toast.error("Erro", { description: String(err) });
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  async function handleSavePwd() {
    if (pwd.length < 4) {
      toast.error("Senha muito curta", { description: "Mínimo 4 caracteres." });
      return;
    }
    setSavingPwd(true);
    try {
      await setPwdFn({ data: { password: pwd } });
      toast.success("Senha atualizada");
    } catch (err) {
      toast.error("Erro ao salvar", { description: String(err) });
    } finally {
      setSavingPwd(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-white/60">
        Verificando acesso...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-black">
            TV<span style={{ color: "oklch(0.78 0.18 155)" }}>.</span>Apps
            <span className="ml-3 text-sm font-medium text-white/40">admin</span>
          </h1>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <p className="text-sm text-white/50 mb-6">
          Ligue/desligue cada app. Apps bloqueados aparecem como card neutro
          (cadeado) na TV, sem nome ou logo.
        </p>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3 mb-3">
            <KeyRound size={18} className="text-[oklch(0.78_0.18_155)]" />
            <div>
              <h2 className="font-bold">Senha de login do app TV</h2>
              <p className="text-xs text-white/50">
                Senha exigida ao abrir o launcher na TV Box.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPwd ? "text" : "password"}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                disabled={!pwdLoaded}
                placeholder={pwdLoaded ? "" : "Carregando..."}
                maxLength={50}
                className="w-full h-10 rounded-lg border border-white/10 bg-black/30 px-3 pr-10 text-white outline-none focus:border-[oklch(0.78_0.18_155)] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                aria-label={showPwd ? "Ocultar" : "Mostrar"}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={handleSavePwd}
              disabled={!pwdLoaded || savingPwd}
              className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.18_155)] px-4 py-2 text-sm font-bold text-black hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {savingPwd ? "..." : "Salvar"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-white/40 py-12 text-center">Carregando...</div>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                editing={editing === app.id}
                blocking={blocking === app.id}
                reason={reason}
                onReasonChange={setReason}
                onEditStart={() => setEditing(app.id)}
                onEditCancel={() => setEditing(null)}
                onEditSave={async (patch) => {
                  try {
                    await updateFn({ data: { appId: app.id, ...patch } });
                    toast.success("Atualizado");
                    setEditing(null);
                    await refresh();
                  } catch (err) {
                    toast.error("Erro", { description: String(err) });
                  }
                }}
                onToggle={(v) => handleToggle(app, v)}
                onConfirmBlock={() => confirmBlock(app)}
                onCancelBlock={() => {
                  setBlocking(null);
                  setReason("");
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AppCard({
  app,
  editing,
  blocking,
  reason,
  onReasonChange,
  onEditStart,
  onEditCancel,
  onEditSave,
  onToggle,
  onConfirmBlock,
  onCancelBlock,
}: {
  app: AppRow;
  editing: boolean;
  blocking: boolean;
  reason: string;
  onReasonChange: (s: string) => void;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: (patch: {
    name: string;
    description: string | null;
    apk_url: string | null;
    icon_url: string | null;
    display_order: number;
    is_active: boolean;
  }) => void;
  onToggle: (v: boolean) => void;
  onConfirmBlock: () => void;
  onCancelBlock: () => void;
}) {
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description ?? "");
  const [apkUrl, setApkUrl] = useState(app.apk_url ?? "");
  const [iconUrl, setIconUrl] = useState(app.icon_url ?? "");
  const [displayOrder, setDisplayOrder] = useState(app.display_order);
  const [isActive, setIsActive] = useState(app.is_active);
  const [uploading, setUploading] = useState(false);

  async function handleIconUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Arquivo inválido", { description: "Envie uma imagem PNG/JPG." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande", { description: "Máximo 2 MB." });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${app.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("app-icons")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("app-icons").getPublicUrl(path);
      setIconUrl(data.publicUrl);
      toast.success("Ícone enviado. Clique em Salvar para aplicar.");
    } catch (err) {
      toast.error("Falha no upload", { description: String(err) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        app.is_blocked
          ? "border-red-500/30 bg-red-500/5"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {app.icon_url ? (
            <img
              src={app.icon_url}
              alt={app.name}
              className="h-14 w-14 rounded-xl object-cover bg-white/5"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-white/10 flex items-center justify-center text-white/40">
              ▣
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold truncate">{app.name}</h3>
              {app.is_blocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                  <Lock size={12} /> BLOQUEADO
                </span>
              )}
            </div>
            <p className="text-sm text-white/50 truncate">
              {app.description || app.package_name}
            </p>
            {app.is_blocked && app.block_reason && (
              <p className="mt-1 text-xs text-red-400/80">
                Motivo: {app.block_reason}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!editing && (
            <>
              <Switch
                checked={!app.is_blocked}
                onChange={(v) => onToggle(!v)}
              />
              <button
                onClick={onEditStart}
                className="rounded-lg border border-white/10 p-2 text-white/60 hover:bg-white/5"
                aria-label="Editar"
              >
                <Pencil size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {blocking && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
            Motivo do bloqueio (opcional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder='Ex: "Em manutenção" (deixe vazio se quiser)'
            maxLength={200}
            className="w-full h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-red-400"
            autoFocus
          />
          <div className="mt-3 flex gap-2 justify-end">
            <button
              onClick={onCancelBlock}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirmBlock}
              className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600"
            >
              Bloquear
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <Field label="Nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Descrição">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="URL do APK">
            <input
              value={apkUrl}
              onChange={(e) => setApkUrl(e.target.value)}
              className="input"
              placeholder="https://..."
            />
          </Field>
          <Field label="URL do ícone (PNG 512×512)">
            <div className="flex gap-2 items-start">
              {iconUrl && (
                <img
                  src={iconUrl}
                  alt="preview"
                  className="h-10 w-10 rounded-lg object-cover bg-white/5 shrink-0"
                />
              )}
              <input
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                className="input"
                placeholder="https://... ou envie um arquivo"
              />
              <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 h-10 text-sm text-white/70 hover:bg-white/5 cursor-pointer shrink-0">
                <Upload size={14} />
                {uploading ? "..." : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleIconUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ordem">
              <input
                type="number"
                value={displayOrder}
                onChange={(e) =>
                  setDisplayOrder(parseInt(e.target.value) || 0)
                }
                className="input"
              />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 h-10">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="text-sm text-white/70">
                  Ativo (visível na TV)
                </span>
              </label>
            </Field>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onEditCancel}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
            >
              <X size={16} /> Cancelar
            </button>
            <button
              onClick={() =>
                onEditSave({
                  name,
                  description: description || null,
                  apk_url: apkUrl || null,
                  icon_url: iconUrl || null,
                  display_order: displayOrder,
                  is_active: isActive,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.18_155)] px-3 py-2 text-sm font-bold text-black hover:scale-[1.02]"
            >
              <Save size={16} /> Salvar
            </button>
          </div>
          <style>{`.input{width:100%;height:2.5rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);padding:0 .75rem;color:white;outline:none}.input:focus{border-color:oklch(0.78 0.18 155)}`}</style>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
        checked ? "bg-[oklch(0.78_0.18_155)]" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}