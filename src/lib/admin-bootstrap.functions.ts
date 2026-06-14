import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const firstAdminInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

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

export const createFirstAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => firstAdminInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error("Já existe um administrador. Use a tela Entrar.");
    }

    const email = data.email.trim().toLowerCase();
    let userId: string | undefined;

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });

    if (created.error) {
      const message = created.error.message.toLowerCase();
      const alreadyExists =
        message.includes("already") || message.includes("registered") || message.includes("exists");

      if (!alreadyExists) throw new Error(created.error.message);

      const perPage = 1000;
      for (let page = 1; page <= 10 && !userId; page += 1) {
        const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        if (listError) throw new Error(listError.message);

        const found = usersPage.users.find(
          (user) => user.email?.toLowerCase() === email,
        );
        userId = found?.id;
        if (usersPage.users.length < perPage) break;
      }

      if (!userId) {
        throw new Error("Este email já existe, mas não foi possível localizar a conta.");
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (updateError) throw new Error(updateError.message);
    } else {
      userId = created.data.user?.id;
    }

    if (!userId) throw new Error("Não foi possível preparar a conta admin.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    if (roleError) throw new Error(roleError.message);

    return { ok: true } as const;
  });