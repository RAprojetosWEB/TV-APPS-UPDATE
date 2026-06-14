import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Atribui a role 'admin' ao usuário autenticado SOMENTE se ainda
 * não existir nenhum admin no sistema (bootstrap da primeira conta).
 * Após o primeiro admin existir, novos admins precisam ser criados
 * manualmente por um admin existente.
 */
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) throw new Error(countError.message);

    if ((count ?? 0) > 0) {
      // Já existe admin: verifica se o próprio usuário é admin
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      if (existing) return { ok: true, alreadyAdmin: true } as const;
      throw new Error(
        "Já existe um administrador. Peça para um admin existente liberar seu acesso.",
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });

    if (insertError) throw new Error(insertError.message);
    return { ok: true, alreadyAdmin: false } as const;
  });