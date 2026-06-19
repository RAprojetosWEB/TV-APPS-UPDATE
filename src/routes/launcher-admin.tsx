import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/launcher-admin")({
  component: LauncherAdminLayout,
  head: () => ({ meta: [{ title: "Painel de Aparelhos" }] }),
});

function LauncherAdminLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const isPublicPage =
    pathname === "/launcher-admin/login" ||
    pathname === "/launcher-admin/registro" ||
    pathname === "/launcher-admin/resetar-senha" ||
    pathname === "/launcher-admin/nova-senha";

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user ?? null;
      setEmail(user?.email ?? null);
      if (!user && !isPublicPage) {
        navigate({ to: "/launcher-admin/login" });
      }
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      if (!session?.user && !isPublicPage) {
        navigate({ to: "/launcher-admin/login" });
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [isPublicPage, navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/launcher-admin/login" });
  }

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <Outlet />
      </div>
    );
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-neutral-400">Carregando…</div>
      </div>
    );
  }

  const linkBase =
    "px-4 py-2 rounded-lg text-sm font-medium transition-colors";
  const linkActive = "bg-neutral-800 text-white";
  const linkIdle = "text-neutral-400 hover:text-white hover:bg-neutral-900";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-950/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            <Link to="/launcher-admin" className="text-base sm:text-lg font-bold tracking-tight truncate">
              Painel de Aparelhos
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/apps-admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 text-sm"
              >
                <span className="text-xs">Painel de Apps</span>
              </Link>
              <button
                onClick={handleLogout}
                className="sm:hidden px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-sm shrink-0"
              >
                Sair
              </button>
            </div>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <Link
              to="/launcher-admin"
              activeOptions={{ exact: true }}
              className={linkIdle + " " + linkBase + " shrink-0"}
              activeProps={{ className: `${linkBase} ${linkActive} shrink-0` }}
            >
              Dashboard
            </Link>
            <Link
              to="/launcher-admin/novo"
              className={linkIdle + " " + linkBase + " shrink-0"}
              activeProps={{ className: `${linkBase} ${linkActive} shrink-0` }}
            >
              Cadastrar
            </Link>
            <Link
              to="/launcher-admin/novos"
              className={linkIdle + " " + linkBase + " shrink-0"}
              activeProps={{ className: `${linkBase} ${linkActive} shrink-0` }}
            >
              Novos Aparelhos
            </Link>
          </nav>
          <div className="hidden sm:flex items-center gap-3 text-sm">
            <span className="text-neutral-500 hidden md:inline truncate max-w-[160px]">{email}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}