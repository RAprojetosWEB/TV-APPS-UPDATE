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
  uploadAppIcon,
  uploadLauncherApk,
  uploadLauncherRaw,
} from "@/lib/admin.functions";
import { toast } from "sonner";

async function fileToBase64(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
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
  const createFn = useServerFn(createApp);
  const deleteFn = useServerFn(deleteApp);
  const duplicateFn = useServerFn(duplicateApp);
  const reorderFn = useServerFn(reorderApps);

  const [pwd, setPwd] = useState("");
  const [pwdLoaded, setPwdLoaded] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const [showNewForm, setShowNewForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  async function handleCreate(payload: {
    name: string;
    package_name: string;
    description?: string;
    apk_url?: string;
    icon_url?: string;
  }) {
    try {
      await createFn({ data: payload });
      toast.success("App criado");
      setShowNewForm(false);
      await refresh();
    } catch (err) {
      toast.error("Erro ao criar", { description: String(err) });
    }
  }

  async function handleDelete(app: AppRow) {
    if (!confirm(`Excluir "${app.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteFn({ data: { appId: app.id } });
      toast.success("Excluído");
      await refresh();
    } catch (err) {
      toast.error("Erro ao excluir", { description: String(err) });
    }
  }

  async function handleDuplicate(app: AppRow) {
    try {
      await duplicateFn({ data: { appId: app.id } });
      toast.success("Duplicado");
      await refresh();
    } catch (err) {
      toast.error("Erro ao duplicar", { description: String(err) });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = apps.findIndex((a) => a.id === active.id);
    const newIndex = apps.findIndex((a) => a.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(apps, oldIndex, newIndex);
    setApps(reordered); // otimista
    try {
      await reorderFn({ data: { orderedIds: reordered.map((a) => a.id) } });
    } catch (err) {
      toast.error("Erro ao reordenar", { description: String(err) });
      await refresh();
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
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
                Apps do catálogo ({apps.length})
              </h2>
              <button
                onClick={() => setShowNewForm((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.18_155)] px-3 py-2 text-sm font-bold text-black hover:scale-[1.02]"
              >
                <Plus size={16} /> Novo app
              </button>
            </div>

            {showNewForm && (
              <NewAppForm onCancel={() => setShowNewForm(false)} onCreate={handleCreate} />
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={apps.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {apps.map((app) => (
                    <SortableAppCard
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
                      onDelete={() => handleDelete(app)}
                      onDuplicate={() => handleDuplicate(app)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <OtaSection />
          </>
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
  onDelete,
  onDuplicate,
  dragHandle,
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
  onDelete: () => void;
  onDuplicate: () => void;
  dragHandle?: React.ReactNode;
}) {
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description ?? "");
  const [apkUrl, setApkUrl] = useState(app.apk_url ?? "");
  const [iconUrl, setIconUrl] = useState(app.icon_url ?? "");
  const [displayOrder, setDisplayOrder] = useState(app.display_order);
  const [isActive, setIsActive] = useState(app.is_active);
  const [uploading, setUploading] = useState(false);
  const uploadIconFn = useServerFn(uploadAppIcon);

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
      const fileBase64 = await fileToBase64(file);
      const { publicUrl } = await uploadIconFn({
        data: { appId: app.id, fileBase64, ext, contentType: file.type },
      });
      setIconUrl(publicUrl);
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
          {dragHandle}
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
              <button
                onClick={onDuplicate}
                className="rounded-lg border border-white/10 p-2 text-white/60 hover:bg-white/5"
                aria-label="Duplicar"
                title="Duplicar"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={onDelete}
                className="rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10"
                aria-label="Excluir"
                title="Excluir"
              >
                <Trash2 size={16} />
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

function SortableAppCard(
  props: React.ComponentProps<typeof AppCard> & { app: AppRow },
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.app.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const handle = (
    <button
      ref={setNodeRef as never}
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing text-white/30 hover:text-white/70 -ml-1"
      aria-label="Reordenar"
      title="Arraste para reordenar"
    >
      <GripVertical size={18} />
    </button>
  );
  // wrapper for transform; handle wires its own ref
  return (
    <div ref={setNodeRef} style={style}>
      <AppCard {...props} dragHandle={handle} />
    </div>
  );
}

function NewAppForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (p: {
    name: string;
    package_name: string;
    description?: string;
    apk_url?: string;
    icon_url?: string;
  }) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [pkg, setPkg] = useState("");
  const [desc, setDesc] = useState("");
  const [apkUrl, setApkUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");

  return (
    <div className="mb-4 rounded-2xl border border-[oklch(0.78_0.18_155)]/40 bg-[oklch(0.78_0.18_155)]/5 p-5 space-y-3">
      <h3 className="font-bold flex items-center gap-2">
        <Plus size={16} /> Novo app
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Ex: AlphaPlay"
          />
        </Field>
        <Field label="Package name *">
          <input
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
            className="input"
            placeholder="com.exemplo.app"
          />
        </Field>
      </div>
      <Field label="Descrição">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} className="input" />
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
        <input
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          className="input"
          placeholder="https://..."
        />
      </Field>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          <X size={16} /> Cancelar
        </button>
        <button
          onClick={() => {
            if (!name.trim() || !pkg.trim()) {
              toast.error("Nome e package são obrigatórios");
              return;
            }
            onCreate({
              name: name.trim(),
              package_name: pkg.trim(),
              description: desc.trim() || undefined,
              apk_url: apkUrl.trim() || undefined,
              icon_url: iconUrl.trim() || undefined,
            });
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.18_155)] px-3 py-2 text-sm font-bold text-black hover:scale-[1.02]"
        >
          <Save size={16} /> Criar
        </button>
      </div>
      <style>{`.input{width:100%;height:2.5rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);padding:0 .75rem;color:white;outline:none}.input:focus{border-color:oklch(0.78 0.18 155)}`}</style>
    </div>
  );
}

function OtaSection() {
  return <OtaSectionInner />;
}

function RawUploadButton({
  onUpload,
  busy,
}: {
  onUpload: (apk: File, json: File) => Promise<void>;
  busy: boolean;
}) {
  const [apk, setApk] = useState<File | null>(null);
  const [json, setJson] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 disabled:opacity-50"
      >
        <Upload size={16} /> Upload direto
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur">
          <div className="text-xs uppercase tracking-wider text-white/50 mb-2">
            Upload direto (sem form)
          </div>
          <p className="text-[11px] text-white/40 mb-3">
            Envia o APK e o <code>update.json</code> direto pro Storage,
            substituindo o atual. Não preenche histórico.
          </p>
          <label className="block text-[11px] text-white/60 mb-1">APK</label>
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(e) => setApk(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-white/70 mb-3"
          />
          <label className="block text-[11px] text-white/60 mb-1">update.json</label>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => setJson(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-white/70 mb-3"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
            >
              Fechar
            </button>
            <button
              disabled={!apk || !json || busy}
              onClick={async () => {
                if (!apk || !json) return;
                await onUpload(apk, json);
                setApk(null);
                setJson(null);
                setOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.18_155)] px-3 py-1.5 text-xs font-bold text-black hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              <Upload size={14} /> {busy ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OtaSectionInner() {
  const listFn = useServerFn(listLauncherVersions);
  const publishFn = useServerFn(publishLauncherVersion);
  const setLatestFn = useServerFn(setLatestLauncherVersion);
  const deleteFn = useServerFn(deleteLauncherVersion);

  const [versions, setVersions] = useState<LauncherVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rawUploading, setRawUploading] = useState(false);

  async function handleRawUpload(apk: File, json: File) {
    setRawUploading(true);
    try {
      const apkPath = `releases/${apk.name}`;
      const upApk = await supabase.storage
        .from("tvapps-updates")
        .upload(apkPath, apk, { upsert: true, contentType: "application/vnd.android.package-archive" });
      if (upApk.error) throw upApk.error;

      const upJson = await supabase.storage
        .from("tvapps-updates")
        .upload("update.json", json, { upsert: true, contentType: "application/json" });
      if (upJson.error) throw upJson.error;

      toast.success("Upload concluído", {
        description: `APK e update.json enviados para o Storage.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro no upload direto", { description: msg });
    } finally {
      setRawUploading(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const { versions } = await listFn();
      setVersions(versions as LauncherVersion[]);
    } catch (err) {
      toast.error("Erro ao listar versões", { description: String(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latest = versions.find((v) => v.is_latest) ?? null;

  return (
    <section className="mt-10 pt-8 border-t border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package size={18} className="text-[oklch(0.78_0.18_155)]" /> OTA do launcher
          </h2>
          <p className="text-xs text-white/50">
            Suba novas versões do APK do launcher. A TV verifica
            <code className="mx-1 text-white/70">update.json</code> e baixa
            automaticamente quando há versão nova.
          </p>
        </div>
        <div className="flex gap-2">
          <RawUploadButton onUpload={handleRawUpload} busy={rawUploading} />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.18_155)] px-3 py-2 text-sm font-bold text-black hover:scale-[1.02]"
          >
            <Upload size={16} /> Nova versão
          </button>
        </div>
      </div>

      {latest && (
        <div className="mb-4 rounded-xl border border-[oklch(0.78_0.18_155)]/30 bg-[oklch(0.78_0.18_155)]/5 p-4">
          <div className="text-xs uppercase tracking-wider text-white/50">
            Versão atual (publicada)
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-xl font-black">{latest.version_name}</span>
            <span className="text-sm text-white/50">code {latest.version_code}</span>
            {latest.apk_url && (
              <a
                href={latest.apk_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[oklch(0.78_0.18_155)] hover:underline"
              >
                Abrir APK
              </a>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <PublishVersionForm
          onCancel={() => setShowForm(false)}
          onPublish={async (payload) => {
            try {
              await publishFn({ data: payload });
              toast.success("Versão publicada");
              setShowForm(false);
              await load();
            } catch (err) {
              toast.error("Falha ao publicar", { description: String(err) });
            }
          }}
        />
      )}

      <div className="mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50 mb-3">
          Histórico
        </h3>
        {loading ? (
          <div className="text-white/40 py-6 text-center text-sm">Carregando...</div>
        ) : versions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
            Nenhuma versão publicada ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{v.version_name}</span>
                    <span className="text-xs text-white/40">code {v.version_code}</span>
                    {v.is_latest && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.78_0.18_155)]/20 px-2 py-0.5 text-xs font-semibold text-[oklch(0.78_0.18_155)]">
                        <CheckCircle2 size={12} /> ATUAL
                      </span>
                    )}
                    <span className="text-xs text-white/40">
                      {new Date(v.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {v.changelog && (
                    <p className="mt-1 text-sm text-white/60 whitespace-pre-wrap">
                      {v.changelog}
                    </p>
                  )}
                  {v.apk_url && (
                    <a
                      href={v.apk_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-[oklch(0.78_0.18_155)] hover:underline"
                    >
                      Baixar APK
                    </a>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {!v.is_latest && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Marcar ${v.version_name} como atual? Todas as TVs vão atualizar para esta versão.`))
                          return;
                        try {
                          await setLatestFn({ data: { versionId: v.id } });
                          toast.success("Versão atual atualizada");
                          await load();
                        } catch (err) {
                          toast.error("Erro", { description: String(err) });
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/70 hover:bg-white/5"
                      title="Marcar como atual"
                    >
                      <RotateCcw size={14} /> Tornar atual
                    </button>
                  )}
                  {!v.is_latest && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Excluir versão ${v.version_name}?`)) return;
                        try {
                          await deleteFn({ data: { versionId: v.id } });
                          toast.success("Excluída");
                          await load();
                        } catch (err) {
                          toast.error("Erro", { description: String(err) });
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PublishVersionForm({
  onCancel,
  onPublish,
}: {
  onCancel: () => void;
  onPublish: (p: {
    versionName: string;
    versionCode: number;
    changelog?: string;
    apkStoragePath: string;
    apkSizeMb?: number;
  }) => void | Promise<void>;
}) {
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleSubmit() {
    if (!versionName.trim() || !versionCode.trim() || !file) {
      toast.error("Preencha versionName, versionCode e selecione o APK.");
      return;
    }
    const codeNum = parseInt(versionCode, 10);
    if (!codeNum || codeNum < 1) {
      toast.error("versionCode inválido");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".apk")) {
      toast.error("Arquivo deve ser .apk");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const path = `releases/${codeNum}.apk`;
      const { error } = await supabase.storage
        .from("tvapps-updates")
        .upload(path, file, {
          upsert: true,
          contentType: "application/vnd.android.package-archive",
        });
      if (error) throw error;
      setProgress(100);
      await onPublish({
        versionName: versionName.trim(),
        versionCode: codeNum,
        changelog: changelog.trim() || undefined,
        apkStoragePath: path,
        apkSizeMb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
      });
    } catch (err) {
      toast.error("Falha no upload", { description: String(err) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[oklch(0.78_0.18_155)]/40 bg-[oklch(0.78_0.18_155)]/5 p-5 space-y-3">
      <h3 className="font-bold flex items-center gap-2">
        <Upload size={16} /> Publicar nova versão
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="versionName *">
          <input
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            className="input"
            placeholder="2.5.0"
          />
        </Field>
        <Field label="versionCode *">
          <input
            type="number"
            value={versionCode}
            onChange={(e) => setVersionCode(e.target.value)}
            className="input"
            placeholder="250"
          />
        </Field>
      </div>
      <Field label="Changelog (opcional)">
        <textarea
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          className="input"
          style={{ height: "auto", minHeight: 70, padding: "0.5rem 0.75rem" }}
          rows={3}
          placeholder="O que mudou nesta versão?"
        />
      </Field>
      <Field label="Arquivo APK *">
        <input
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-2 file:text-white/80 file:cursor-pointer hover:file:bg-white/10"
        />
        {file && (
          <p className="mt-1 text-xs text-white/50">
            {file.name} — {(file.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        )}
      </Field>
      {uploading && (
        <div className="text-xs text-white/60">Enviando... {progress}%</div>
      )}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-50"
        >
          <X size={16} /> Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.78_0.18_155)] px-3 py-2 text-sm font-bold text-black hover:scale-[1.02] disabled:opacity-50"
        >
          <Upload size={16} /> {uploading ? "Enviando..." : "Publicar"}
        </button>
      </div>
      <style>{`.input{width:100%;height:2.5rem;border-radius:.5rem;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.3);padding:0 .75rem;color:white;outline:none}.input:focus{border-color:oklch(0.78 0.18 155)}`}</style>
    </div>
  );
}