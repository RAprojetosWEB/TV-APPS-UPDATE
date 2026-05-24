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
  uploadAppApk,
  uploadLauncherApk,
  uploadLauncherRaw,
  createBackup,
  restoreBackup,
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
  Download, ShieldCheck, AppWindow, ChevronDown, ChevronUp,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  latest_version?: {
    version_name: string;
    version_code: number;
    apk_size_mb: number | null;
    created_at: string;
  } | null;
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
      <div className="min-h-screen flex items-center justify-center text-[var(--admin-text-muted)]">
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--neon)] animate-pulse" />
          Verificando acesso…
        </div>
      </div>
    );
  }

  return (
    <AdminShell userEmail={undefined} onLogout={handleLogout}>
      <SectionHeader
        eyebrow="Acesso"
        title="Senha do launcher"
        subtitle="Senha exigida ao abrir o launcher na TV Box."
        icon={<KeyRound size={16} />}
      />
      <div className="admin-surface p-6 admin-anim-in">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type={showPwd ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              disabled={!pwdLoaded}
              placeholder={pwdLoaded ? "" : "Carregando…"}
              maxLength={50}
              className="admin-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 admin-icon-btn"
              style={{ width: 32, height: 32 }}
              aria-label={showPwd ? "Ocultar" : "Mostrar"}
            >
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            onClick={handleSavePwd}
            disabled={!pwdLoaded || savingPwd}
            className="admin-btn-primary"
          >
            <Save size={15} /> {savingPwd ? "Salvando…" : "Salvar senha"}
          </button>
        </div>
      </div>

      <SectionHeader
        eyebrow="Catálogo"
        title="Apps"
        subtitle="Ligue/desligue cada app. Apps bloqueados aparecem como card neutro (cadeado) na TV."
        icon={<AppWindow size={16} />}
        right={
          <div className="flex items-center gap-3">
            <span className="admin-pill admin-pill-muted">
              {apps.length} {apps.length === 1 ? "app" : "apps"}
            </span>
            <button
              onClick={() => setShowNewForm((v) => !v)}
              className="admin-btn-primary"
            >
              <Plus size={15} /> Novo app
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="admin-surface p-10 text-center text-sm text-[var(--admin-text-muted)]">
          Carregando catálogo…
        </div>
      ) : (
        <div className="space-y-3">
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
                {apps.map((app, i) => (
                  <SortableAppCard
                    key={app.id}
                    index={i}
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
        </div>
      )}
    </AdminShell>
  );
}

/* ============ Shell + Section primitives ============ */

function AdminShell({
  children,
  onLogout,
}: {
  children: React.ReactNode;
  userEmail?: string;
  onLogout: () => void;
}) {
  useEffect(() => {
    document.body.setAttribute("data-admin", "1");
    return () => {
      document.body.removeAttribute("data-admin");
    };
  }, []);

  return (
    <div className="min-h-screen text-[var(--admin-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--admin-border-soft)] bg-[oklch(0.14_0.025_265_/_0.7)] backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[15px] font-semibold tracking-tight">
              <span>TV</span>
              <span className="text-[var(--neon)]">.</span>
              <span>Apps</span>
            </div>
            <span className="admin-pill admin-pill-muted gap-1.5">
              <ShieldCheck size={11} /> admin
            </span>
          </div>
          <button onClick={onLogout} className="admin-btn-ghost">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">{children}</main>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-muted)] mb-2">
            {icon}
            <span>{eyebrow}</span>
          </div>
        )}
        <h2 className="text-xl font-semibold tracking-tight text-[var(--admin-text)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--admin-text-muted)] max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
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
  index = 0,
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
  index?: number;
}) {
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description ?? "");
  const [apkUrl, setApkUrl] = useState(app.apk_url ?? "");
  const [iconUrl, setIconUrl] = useState(app.icon_url ?? "");
  const [displayOrder, setDisplayOrder] = useState(app.display_order);
  const [isActive, setIsActive] = useState(app.is_active);
  const [uploading, setUploading] = useState(false);
  const uploadIconFn = useServerFn(uploadAppIcon);
  const uploadApkFn = useServerFn(uploadAppApk);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [apkProgress, setApkProgress] = useState(0);

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

  async function handleApkUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".apk")) {
      toast.error("Arquivo inválido", { description: "Envie um arquivo .apk" });
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      toast.error("APK muito grande", { description: "Máximo 150 MB." });
      return;
    }
    setUploadingApk(true);
    setApkProgress(0);
    try {
      // Lê o arquivo em chunks pra mostrar progresso
      setApkProgress(10);
      const fileBase64 = await fileToBase64(file);
      setApkProgress(50);
      const { publicUrl, versionName, versionCode } = await uploadApkFn({
        data: { appId: app.id, fileName: file.name, fileBase64 },
      });
      setApkProgress(100);
      setApkUrl(publicUrl);
      toast.success(
        `APK v${versionName} (code ${versionCode}) detectado. Clique em Salvar para aplicar.`,
      );
    } catch (err) {
      toast.error("Falha no upload do APK", { description: String(err) });
    } finally {
      setUploadingApk(false);
      setTimeout(() => setApkProgress(0), 1500);
    }
  }

  return (
    <div
      className={`admin-surface admin-surface-hover group p-5 ${
        app.is_blocked ? "!border-[oklch(0.68_0.22_25_/_0.3)]" : ""
      }`}
      style={{
        animation: `admin-fade-in-up 400ms var(--ease-out) both`,
        animationDelay: `${Math.min(index, 8) * 35}ms`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          {dragHandle}
          <div className="relative shrink-0">
            {app.icon_url ? (
              <img
                src={app.icon_url}
                alt={app.name}
                className="h-16 w-16 rounded-2xl object-cover ring-1 ring-[var(--admin-border)] shadow-[0_8px_20px_-8px_oklch(0_0_0_/_0.6)]"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[var(--admin-surface-2)] to-[var(--admin-surface-3)] ring-1 ring-[var(--admin-border)] flex items-center justify-center text-[var(--admin-text-subtle)]">
                <Package size={24} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[15px] font-semibold tracking-tight text-[var(--admin-text)] truncate">
                {app.name}
              </h3>
              {app.is_blocked && (
                <span className="admin-pill admin-pill-danger">
                  <Lock size={11} /> Bloqueado
                </span>
              )}
              {!app.is_active && !app.is_blocked && (
                <span className="admin-pill admin-pill-muted">Inativo</span>
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-[var(--admin-text-muted)] truncate">
              {app.description || (
                <span className="font-mono text-[12px] text-[var(--admin-text-subtle)]">
                  {app.package_name}
                </span>
              )}
            </p>
            {app.description && (
              <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-text-subtle)] truncate">
                {app.package_name}
              </p>
            )}
            {app.is_blocked && app.block_reason && (
              <p className="mt-1 text-xs text-[var(--danger)]/80">
                Motivo: {app.block_reason}
              </p>
            )}
            {app.latest_version && (
              <p className="mt-1 text-[11px] font-mono text-[var(--admin-text-subtle)]">
                v{app.latest_version.version_name} · code {app.latest_version.version_code}
                {app.latest_version.apk_size_mb != null && ` · ${app.latest_version.apk_size_mb} MB`}
                {` · ${new Date(app.latest_version.created_at).toLocaleDateString("pt-BR")}`}
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
              <div className="flex items-center rounded-xl border border-[var(--admin-border-soft)] bg-[oklch(0_0_0_/_0.2)] p-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={onEditStart}
                  className="admin-icon-btn"
                  style={{ width: 32, height: 32 }}
                  aria-label="Editar"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={onDuplicate}
                  className="admin-icon-btn"
                  style={{ width: 32, height: 32 }}
                  aria-label="Duplicar"
                  title="Duplicar"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={onDelete}
                  className="admin-icon-btn admin-icon-btn-danger"
                  style={{ width: 32, height: 32 }}
                  aria-label="Excluir"
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {blocking && (
        <div className="mt-5 rounded-xl border border-[oklch(0.68_0.22_25_/_0.25)] bg-[var(--danger-soft)] p-4 admin-anim-scale">
          <label className="admin-label !text-[var(--danger)]">
            Motivo do bloqueio (opcional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder='Ex: "Em manutenção"'
            maxLength={200}
            className="admin-input"
            autoFocus
          />
          <div className="mt-3 flex gap-2 justify-end">
            <button onClick={onCancelBlock} className="admin-btn-ghost">
              Cancelar
            </button>
            <button onClick={onConfirmBlock} className="admin-btn-danger">
              <Lock size={14} /> Bloquear
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-5 admin-surface-2 p-5 space-y-3 admin-anim-scale">
          <Field label="Nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
            />
          </Field>
          <Field label="Descrição">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="admin-input"
            />
          </Field>
          {app.latest_version && (
            <p className="text-[11px] text-[var(--admin-text-subtle)]">
              Versão atual:{" "}
              <span className="font-mono">v{app.latest_version.version_name}</span>{" "}
              (code {app.latest_version.version_code}). A versão do APK enviado é
              lida automaticamente e deve ter código maior.
            </p>
          )}
          <Field label="URL do APK">
            <div className="flex gap-2 items-start">
              <input
                value={apkUrl}
                onChange={(e) => setApkUrl(e.target.value)}
                className="admin-input"
                placeholder="https://... ou envie um arquivo"
              />
              <label className="admin-btn-ghost cursor-pointer shrink-0">
                <Upload size={14} />
                {uploadingApk ? `${apkProgress}%` : "Upload APK"}
                <input
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="hidden"
                  disabled={uploadingApk}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleApkUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {uploadingApk && (
              <div className="mt-2 h-1 w-full rounded-full bg-[var(--admin-surface-3)] overflow-hidden">
                <div
                  className="h-full bg-[var(--neon)] transition-all duration-300"
                  style={{ width: `${apkProgress}%` }}
                />
              </div>
            )}
            <p className="mt-1 text-[11px] text-[var(--admin-text-subtle)]">
              Hospedado no Lovable Cloud. Máx 150 MB.
            </p>
          </Field>
          <Field label="URL do ícone (PNG 512×512)">
            <div className="flex gap-2 items-start">
              {iconUrl && (
                <img
                  src={iconUrl}
                  alt="preview"
                  className="h-10 w-10 rounded-lg object-cover ring-1 ring-[var(--admin-border)] shrink-0"
                />
              )}
              <input
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                className="admin-input"
                placeholder="https://... ou envie um arquivo"
              />
              <label className="admin-btn-ghost cursor-pointer shrink-0">
                <Upload size={14} />
                {uploading ? "Enviando…" : "Upload"}
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
                className="admin-input"
              />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-3 h-10">
                <Switch checked={isActive} onChange={setIsActive} />
                <span className="text-sm text-[var(--admin-text-secondary)]">
                  Ativo (visível na TV)
                </span>
              </label>
            </Field>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onEditCancel} className="admin-btn-ghost">
              <X size={14} /> Cancelar
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
              className="admin-btn-primary"
            >
              <Save size={14} /> Salvar
            </button>
          </div>
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
      <label className="admin-label">{label}</label>
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
      data-checked={checked}
      className="admin-switch admin-focus-ring"
    />
  );
}

function SortableAppCard(
  props: React.ComponentProps<typeof AppCard> & { app: AppRow; index: number },
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.app.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };
  const handle = (
    <button
      ref={setNodeRef as never}
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing text-[var(--admin-text-subtle)] hover:text-[var(--admin-text)] transition-colors -ml-1"
      aria-label="Reordenar"
      title="Arraste para reordenar"
    >
      <GripVertical size={16} />
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
    <div className="admin-surface admin-surface-neon p-5 space-y-3 admin-anim-scale">
      <h3 className="text-[15px] font-semibold tracking-tight flex items-center gap-2 text-[var(--admin-text)]">
        <Plus size={16} /> Novo app
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="admin-input"
            placeholder="Ex: AlphaPlay"
          />
        </Field>
        <Field label="Package name *">
          <input
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
            className="admin-input"
            placeholder="com.exemplo.app"
          />
        </Field>
      </div>
      <Field label="Descrição">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} className="admin-input" />
      </Field>
      <Field label="URL do APK">
        <input
          value={apkUrl}
          onChange={(e) => setApkUrl(e.target.value)}
          className="admin-input"
          placeholder="https://..."
        />
      </Field>
      <Field label="URL do ícone (PNG 512×512)">
        <input
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          className="admin-input"
          placeholder="https://..."
        />
      </Field>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="admin-btn-ghost">
          <X size={14} /> Cancelar
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
          className="admin-btn-primary"
        >
          <Save size={14} /> Criar app
        </button>
      </div>
    </div>
  );
}

function OtaSection() {
  return <OtaSectionInner />;
}

function BackupButton() {
  const [busy, setBusy] = useState(false);
  const backupFn = useServerFn(createBackup);

  async function handleClick() {
    setBusy(true);
    try {
      toast.info("Gerando backup...", {
        description: "Pode demorar alguns segundos se houver muitos APKs.",
      });
      const { filename, base64, byteLength } = await backupFn();
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Backup baixado", {
        description: `${filename} (${(byteLength / 1024 / 1024).toFixed(2)} MB)`,
      });
    } catch (err) {
      toast.error("Falha no backup", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="admin-btn-ghost"
      title="Baixa banco + storage em um .zip"
    >
      <Download size={14} /> {busy ? "Gerando…" : "Backup"}
    </button>
  );
}

function RestoreButton() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [wipe, setWipe] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const restoreFn = useServerFn(restoreBackup);

  async function handleRestore() {
    if (!file) return;
    if (confirm !== "RESTAURAR") {
      toast.error("Digite RESTAURAR para confirmar");
      return;
    }
    setBusy(true);
    try {
      toast.info("Restaurando backup...", {
        description: "Não feche essa aba. Pode demorar alguns minutos.",
      });
      const b64 = await fileToBase64(file);
      const res = await restoreFn({ data: { zipBase64: b64, wipeStorage: wipe } });
      toast.success("Backup restaurado", {
        description: `Apps: ${res.restored.apps} · Versões: ${res.restored.app_versions} · Arquivos: ${Object.values(res.restored.storage).reduce((a, b) => a + b, 0)}`,
      });
      setOpen(false);
      setFile(null);
      setConfirm("");
      setWipe(false);
      // Recarrega a página pra refletir tudo
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error("Falha ao restaurar", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="admin-btn-ghost"
        title="Restaura banco + storage a partir de um .zip"
      >
        <RotateCcw size={14} /> Restaurar
      </button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="border-[var(--admin-border)] bg-[var(--admin-surface-1)] text-[var(--admin-text)] sm:max-w-md shadow-[var(--shadow-elev)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--admin-text)]">Restaurar backup</DialogTitle>
            <DialogDescription className="text-[var(--admin-text-muted)]">
              <strong className="text-[var(--danger)]">Atenção:</strong> isso{" "}
              <strong>apaga</strong> os apps, versões e configurações atuais
              e substitui pelos do arquivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="admin-label">Arquivo .zip do backup</label>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="restore-zip-input"
                  className="admin-btn-ghost cursor-pointer"
                >
                  <Upload size={14} /> Escolher .zip
                </label>
                <span className="text-xs text-[var(--admin-text-muted)] truncate">
                  {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : "Nenhum arquivo"}
                </span>
              </div>
              <input
                id="restore-zip-input"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-[var(--admin-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={wipe}
                onChange={(e) => setWipe(e.target.checked)}
                className="mt-0.5 accent-[var(--neon)]"
              />
              <span>
                Apagar TODOS os arquivos atuais do storage antes de restaurar
                (recomendado para restore limpo; sem isso, arquivos extras ficam).
              </span>
            </label>

            <div>
              <label className="admin-label">
                Para confirmar, digite{" "}
                <code className="text-[var(--danger)] font-mono">RESTAURAR</code>
              </label>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="admin-input"
              />
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setOpen(false)} disabled={busy} className="admin-btn-ghost">
              Cancelar
            </button>
            <button
              disabled={!file || confirm !== "RESTAURAR" || busy}
              onClick={handleRestore}
              className="admin-btn-danger"
            >
              <RotateCcw size={14} /> {busy ? "Restaurando…" : "Restaurar agora"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RawUploadButton({
  onUpload,
  busy,
}: {
  onUpload: (apk: File) => Promise<void>;
  busy: boolean;
}) {
  const [apk, setApk] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="admin-btn-ghost"
      >
        <Upload size={14} /> Upload direto
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[var(--admin-border)] bg-[var(--admin-surface-1)] text-[var(--admin-text)] sm:max-w-md shadow-[var(--shadow-elev)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--admin-text)]">Upload direto (sem form)</DialogTitle>
            <DialogDescription className="text-[var(--admin-text-muted)]">
              Envia o APK direto pro Storage e regenera o <code>update.json</code>
              automaticamente a partir da versão lida do AndroidManifest.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3">
              <label
                htmlFor="raw-apk-input"
                className="admin-btn-ghost cursor-pointer w-full justify-center py-3"
              >
                <Upload size={16} /> Escolher APK
              </label>
              <input
                id="raw-apk-input"
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.name.toLowerCase().endsWith(".apk")) setApk(f);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </div>

            <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-0)] divide-y divide-[var(--admin-border)]">
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${apk ? "bg-emerald-400" : "bg-[var(--admin-border)]"}`}
                  />
                  <span className="font-medium text-[var(--admin-text)]">APK</span>
                </span>
                <span className="truncate text-[var(--admin-text-muted)] max-w-[60%] text-right">
                  {apk ? apk.name : "—"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setOpen(false)} className="admin-btn-ghost">
              Fechar
            </button>
            <button
              disabled={!apk || busy}
              onClick={async () => {
                if (!apk) return;
                await onUpload(apk);
                setApk(null);
                setOpen(false);
              }}
              className="admin-btn-primary"
            >
              <Upload size={14} /> {busy ? "Enviando…" : "Enviar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OtaSectionInner() {
  const listFn = useServerFn(listLauncherVersions);
  const publishFn = useServerFn(publishLauncherVersion);
  const setLatestFn = useServerFn(setLatestLauncherVersion);
  const deleteFn = useServerFn(deleteLauncherVersion);
  const uploadRawFn = useServerFn(uploadLauncherRaw);

  const [versions, setVersions] = useState<LauncherVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rawUploading, setRawUploading] = useState(false);

  async function handleRawUpload(apk: File) {
    setRawUploading(true);
    try {
      // IMPORTANTE: o update.json gerado pelo Gradle aponta para
      // `app-release-latest.apk`. Por isso forçamos esse mesmo caminho
      // aqui, senão o app instala um APK antigo (o que estava em
      // app-release-latest.apk) e continua detectando "nova versão"
      // em loop, porque o manifesto e o APK ficam dessincronizados.
      const apkPath = "app-release-latest.apk";
      const apkB64 = await fileToBase64(apk);
      // Sobe o APK via uploadLauncherRaw: o servidor extrai versionName/
      // versionCode do AndroidManifest, insere em app_versions com
      // is_latest=true e regenera update.json automaticamente. O JSON
      // enviado pelo usuário é ignorado de propósito pra evitar
      // dessincronizar com o APK real.
      const result = await uploadRawFn({
        data: {
          path: apkPath,
          contentBase64: apkB64,
          contentType: "application/vnd.android.package-archive",
        },
      });

      await load();

      toast.success("Upload concluído", {
        description: `Versão ${result.versionName} (code ${result.versionCode}) publicada.`,
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
    <section className="pt-2">
      <div className="admin-divider mb-10" />

      <SectionHeader
        eyebrow="OTA do launcher"
        title="Versão atual"
        subtitle="A TV consulta update.json e baixa automaticamente quando há versão nova."
        icon={<Package size={16} />}
        right={
          <button onClick={() => setShowForm((v) => !v)} className="admin-btn-primary">
            <Upload size={14} /> Publicar versão
          </button>
        }
      />

      {latest ? (
        <div className="admin-surface admin-surface-neon p-6 admin-anim-in">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="admin-label !mb-1 !text-[var(--neon)]">Publicada</div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {latest.version_name}
                </span>
                <span className="font-mono text-xs text-[var(--admin-text-muted)]">
                  code {latest.version_code}
                </span>
              </div>
              {latest.changelog && (
                <p className="mt-2 text-sm text-[var(--admin-text-secondary)] whitespace-pre-wrap line-clamp-3 max-w-xl">
                  {latest.changelog}
                </p>
              )}
            </div>
            {latest.apk_url && (
              <a
                href={latest.apk_url}
                target="_blank"
                rel="noreferrer"
                className="admin-btn-ghost"
              >
                <Download size={14} /> Baixar APK
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="admin-surface p-6 text-sm text-[var(--admin-text-muted)]">
          Nenhuma versão publicada ainda.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <BackupButton />
        <RestoreButton />
        <RawUploadButton onUpload={handleRawUpload} busy={rawUploading} />
      </div>

      {showForm && (
        <div className="mt-6">
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
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-text-muted)]">
            Histórico
          </h3>
          <span className="text-[10px] text-[var(--admin-text-subtle)]">
            {versions.length} {versions.length === 1 ? "versão" : "versões"}
          </span>
        </div>
        {loading ? (
          <div className="text-[var(--admin-text-muted)] py-6 text-center text-sm">
            Carregando…
          </div>
        ) : versions.length === 0 ? (
          <div className="admin-surface p-8 text-center text-sm text-[var(--admin-text-muted)]">
            Nenhuma versão publicada ainda.
          </div>
        ) : (
          <div className="admin-surface overflow-hidden">
            {versions.map((v, i) => (
              <div
                key={v.id}
                className={`group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[oklch(1_0_0_/_0.03)] ${
                  i > 0 ? "border-t border-[var(--admin-border-soft)]" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      v.is_latest
                        ? "text-[var(--neon)] font-semibold"
                        : "text-[var(--admin-text-secondary)]"
                    }`}
                  >
                    {v.version_name}
                  </span>
                  {v.is_latest && (
                    <span className="admin-pill admin-pill-neon">
                      <CheckCircle2 size={11} /> Atual
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-[var(--admin-text-subtle)]">
                    code {v.version_code}
                  </span>
                  <span className="text-[11px] text-[var(--admin-text-subtle)] hidden md:inline">
                    · {new Date(v.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  {v.apk_size_mb && (
                    <span className="text-[11px] text-[var(--admin-text-subtle)] hidden md:inline">
                      · {v.apk_size_mb.toFixed(1)} MB
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  {v.apk_url && (
                    <a
                      href={v.apk_url}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-icon-btn"
                      style={{ width: 32, height: 32 }}
                      title="Baixar APK"
                    >
                      <Download size={13} />
                    </a>
                  )}
                  {!v.is_latest && (
                    <>
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Marcar ${v.version_name} como atual? Todas as TVs vão atualizar para esta versão.`,
                            )
                          )
                            return;
                          try {
                            await setLatestFn({ data: { versionId: v.id } });
                            toast.success("Versão atual atualizada");
                            await load();
                          } catch (err) {
                            toast.error("Erro", { description: String(err) });
                          }
                        }}
                        className="admin-icon-btn"
                        style={{ width: 32, height: 32 }}
                        title="Marcar como atual"
                      >
                        <RotateCcw size={13} />
                      </button>
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
                        className="admin-icon-btn admin-icon-btn-danger"
                        style={{ width: 32, height: 32 }}
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
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
    changelog?: string;
    apkStoragePath: string;
    apkSizeMb?: number;
  }) => void | Promise<void>;
}) {
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const uploadApkFn = useServerFn(uploadLauncherApk);

  async function handleSubmit() {
    if (!file) {
      toast.error("Selecione o APK.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".apk")) {
      toast.error("Arquivo deve ser .apk");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      // Path único por timestamp; a versão real vem do AndroidManifest no servidor.
      const path = `releases/${Date.now()}.apk`;
      const fileBase64 = await fileToBase64(file);
      await uploadApkFn({ data: { path, fileBase64 } });
      setProgress(100);
      await onPublish({
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
    <div className="admin-surface admin-surface-neon p-5 space-y-3 admin-anim-scale">
      <h3 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
        <Upload size={16} /> Publicar nova versão
      </h3>
      <p className="text-xs text-[var(--admin-text-muted)]">
        A versão (versionName / versionCode) é lida automaticamente do AndroidManifest do APK.
      </p>
      <Field label="Changelog (opcional)">
        <textarea
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          className="admin-input"
          rows={3}
          placeholder="O que mudou nesta versão?"
        />
      </Field>
      <Field label="Arquivo APK *">
        <input
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-[var(--admin-text-muted)] file:mr-3 file:rounded-lg file:border file:border-[var(--admin-border)] file:bg-[oklch(1_0_0_/_0.04)] file:px-3 file:py-2 file:text-[var(--admin-text-secondary)] file:cursor-pointer hover:file:bg-[oklch(1_0_0_/_0.08)] file:transition-colors"
        />
        {file && (
          <p className="mt-1.5 text-xs text-[var(--admin-text-muted)] font-mono">
            {file.name} — {(file.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        )}
      </Field>
      {uploading && (
        <div className="text-xs text-[var(--admin-text-muted)]">Enviando… {progress}%</div>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={uploading} className="admin-btn-ghost">
          <X size={14} /> Cancelar
        </button>
        <button onClick={handleSubmit} disabled={uploading} className="admin-btn-primary">
          <Upload size={14} /> {uploading ? "Enviando…" : "Publicar"}
        </button>
      </div>
    </div>
  );
}