import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { APP_ROLES, type AppRole, areasForRole } from "@/lib/permisos-contratacion";
import { getSupabaseServerConfig, supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userRoleSchema = z.enum(
  APP_ROLES.map((role) => role.value) as [AppRole, ...AppRole[]],
);

const seedSchema = z.object({
  entity: z.string().trim().max(180).optional().or(z.literal("")),
});

function adminClient() {
  const { serviceRoleKey, supabaseUrl } = getSupabaseServerConfig();
  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function temporaryPassword() {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  return `Ace-${token}!9`;
}

function profileEmailForRole(role: AppRole) {
  return `${role.replace("_", ".")}@ace.local`;
}

function profileMetadata(role: AppRole, entity?: string | null) {
  return {
    entity: entity || null,
    permissionVersion: "ace-role-matrix-v1",
    permissions: areasForRole(role),
    role,
    updatedAt: new Date().toISOString(),
  };
}

async function findAuthUserByEmail(email: string) {
  const supabase = adminClient();
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

async function upsertProfile(input: {
  email: string;
  entity?: string | null;
  role: AppRole;
  userId: string;
}) {
  await supabaseRest("profiles?on_conflict=id", {
    body: JSON.stringify({
      email: input.email,
      entity: input.entity || null,
      id: input.userId,
      metadata: profileMetadata(input.role, input.entity),
      role: input.role,
    }),
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    method: "POST",
  });
}

async function createOrLinkUser(input: {
  email: string;
  entity?: string | null;
  password: string;
  role: AppRole;
}) {
  const supabase = adminClient();
  const metadata = profileMetadata(input.role, input.entity);
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    password: input.password,
    user_metadata: metadata,
  });
  if (data.user && !error) {
    await upsertProfile({
      email: input.email,
      entity: input.entity || null,
      role: input.role,
      userId: data.user.id,
    });
    return { status: "created" as const, userId: data.user.id };
  }
  const alreadyExists =
    error?.message.toLowerCase().includes("already") ||
    error?.message.toLowerCase().includes("registered");
  if (!alreadyExists) throw new Error(error?.message ?? "No se pudo crear usuario");
  const existing = await findAuthUserByEmail(input.email);
  if (!existing) {
    throw new Error(
      "El correo ya existe en Auth, pero no se pudo localizar para vincularlo al perfil ACE.",
    );
  }
  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    user_metadata: metadata,
  });
  if (updateError) throw new Error(updateError.message);
  await upsertProfile({
    email: input.email,
    entity: input.entity || null,
    role: input.role,
    userId: existing.id,
  });
  return { status: "linked" as const, userId: existing.id };
}

// POST /api/configuracion/users/seed
// Body: { entity? }
// Crea (o vincula) un usuario por cada perfil del sistema.
// Devuelve las credenciales temporales de los usuarios NUEVOS.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const payload = seedSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: payload.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const created: Array<{ email: string; password: string; role: AppRole }> = [];
    const linked: Array<{ email: string; role: AppRole; userId: string }> = [];
    for (const role of userRoleSchema.options) {
      const email = profileEmailForRole(role);
      const password = temporaryPassword();
      const result = await createOrLinkUser({
        email,
        entity: payload.data.entity || null,
        password,
        role,
      });
      if (result.status === "created") {
        created.push({ email, password, role });
      } else {
        linked.push({ email, role, userId: result.userId });
      }
    }
    await writeAuditLog({
      action: "settings.user.seed_roles",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        created: created.map((item) => ({ email: item.email, role: item.role })),
        linked,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityType: "profile",
    });
    return NextResponse.json({ created, linked });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron crear usuarios base" },
      { status: 500 },
    );
  }
}
