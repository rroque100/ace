import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { APP_ROLES, type AppRole, areasForRole } from "@/lib/permisos-contratacion";
import { esIdSeguro, getSupabaseAdminClient, supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import {
  correoDeUsuario,
  esUsuarioValido,
  USUARIO_LONGITUD,
  usuarioDeCorreo,
} from "@/lib/usuario-credencial";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userRoleSchema = z.enum(
  APP_ROLES.map((role) => role.value) as [AppRole, ...AppRole[]],
);

// Datos personales del perfil: opcionales, para no bloquear el alta de usuario
// —se pueden completar luego—, pero acotados porque acaban en documentos que se
// firman. El DNI admite hasta 20 (DNI peruano son 8, el carné de extranjería y
// otros documentos son más largos).
const datosPersonalesSchema = {
  nombreCompleto: z.string().trim().max(160).optional().or(z.literal("")),
  dni: z.string().trim().max(20).optional().or(z.literal("")),
  cargo: z.string().trim().max(160).optional().or(z.literal("")),
  gradoAcademico: z.string().trim().max(120).optional().or(z.literal("")),
};

const createUserSchema = z.object({
  // El identificador es el usuario de ocho dígitos; el correo se DERIVA de él.
  // Aceptarlo desde fuera permitiría crear una cuenta con un correo que no
  // corresponde a su usuario, y luego nadie sabría con qué se entra a ella.
  usuario: z
    .string()
    .trim()
    .refine(esUsuarioValido, `El usuario debe tener ${USUARIO_LONGITUD} dígitos`),
  entity: z.string().trim().max(180).optional().or(z.literal("")),
  esJefe: z.boolean().optional(),
  oficinaId: z.string().uuid().optional().or(z.literal("")),
  password: z.string().min(8).max(120).optional().or(z.literal("")),
  role: userRoleSchema,
  ...datosPersonalesSchema,
});

type ProfileRow = {
  created_at: string | null;
  email: string | null;
  entity: string | null;
  es_jefe?: boolean | null;
  id: string;
  metadata?: Record<string, unknown> | null;
  oficina_id?: string | null;
  nombre_completo?: string | null;
  dni?: string | null;
  cargo?: string | null;
  grado_academico?: string | null;
  role: string;
  activo?: boolean | null;
};

function temporaryPassword() {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  return `Ace-${token}!9`;
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
  const supabase = await getSupabaseAdminClient();
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user: { email?: string | null }) => user.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

type DatosPersonales = {
  nombreCompleto?: string;
  dni?: string;
  cargo?: string;
  gradoAcademico?: string;
};

/** Columnas de datos personales, solo las que traen valor (para no pisar con null). */
function columnasDatosPersonales(d: DatosPersonales): Record<string, string> {
  const out: Record<string, string> = {};
  if (d.nombreCompleto?.trim()) out.nombre_completo = d.nombreCompleto.trim();
  if (d.dni?.trim()) out.dni = d.dni.trim();
  if (d.cargo?.trim()) out.cargo = d.cargo.trim();
  if (d.gradoAcademico?.trim()) out.grado_academico = d.gradoAcademico.trim();
  return out;
}

async function upsertProfile(input: {
  email: string;
  entity?: string | null;
  esJefe?: boolean;
  oficinaId?: string | null;
  role: AppRole;
  userId: string;
  datos?: DatosPersonales;
}) {
  const body: Record<string, unknown> = {
    email: input.email,
    entity: input.entity || null,
    id: input.userId,
    metadata: profileMetadata(input.role, input.entity),
    role: input.role,
    oficina_id: input.oficinaId || null,
    es_jefe: Boolean(input.esJefe),
    ...columnasDatosPersonales(input.datos ?? {}),
  };
  const post = (payload: Record<string, unknown>) =>
    supabaseRest("profiles?on_conflict=id", {
      body: JSON.stringify(payload),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      method: "POST",
    });
  // Si alguna columna aun no existe (SQL pendiente), reintenta sin ellas para no
  // bloquear la gestion de usuarios. El mensaje de PostgREST nombra la columna.
  await post(body).catch((err) => {
    if (err instanceof Error && /oficina_id|es_jefe|nombre_completo|dni|cargo|grado_academico/i.test(err.message)) {
      const { oficina_id: _o, es_jefe: _j, nombre_completo: _n, dni: _d, cargo: _c, grado_academico: _g, ...rest } =
        body;
      return post(rest);
    }
    throw err;
  });
}

async function createOrLinkUser(input: {
  email: string;
  entity?: string | null;
  esJefe?: boolean;
  oficinaId?: string | null;
  password: string;
  role: AppRole;
  datos?: DatosPersonales;
}) {
  const supabase = await getSupabaseAdminClient();
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
      esJefe: input.esJefe,
      oficinaId: input.oficinaId || null,
      role: input.role,
      userId: data.user.id,
      datos: input.datos,
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
    esJefe: input.esJefe,
    oficinaId: input.oficinaId || null,
    role: input.role,
    userId: existing.id,
    datos: input.datos,
  });
  return { status: "linked" as const, userId: existing.id };
}

function permissionsForRole(role: AppRole) {
  return areasForRole(role);
}

function shapeUser(profile: ProfileRow) {
  const parsedRole = userRoleSchema.safeParse(profile.role);
  return {
    createdAt: profile.created_at,
    // Ausente en instalaciones sin la migración de la columna: true (activo).
    activo: profile.activo ?? true,
    email: profile.email,
    // Null en las cuentas anteriores a la autenticación por usuario y en las de
    // rol del seed: la interfaz las sigue mostrando por su correo.
    usuario: usuarioDeCorreo(profile.email),
    entity: profile.entity ?? "",
    esJefe: Boolean(profile.es_jefe),
    id: profile.id,
    oficinaId: profile.oficina_id ?? null,
    nombreCompleto: profile.nombre_completo ?? "",
    dni: profile.dni ?? "",
    cargo: profile.cargo ?? "",
    gradoAcademico: profile.grado_academico ?? "",
    permissions: Array.isArray(profile.metadata?.permissions)
      ? profile.metadata.permissions
      : permissionsForRole(parsedRole.success ? (profile.role as AppRole) : "consulta"),
    role: profile.role,
  };
}

// GET /api/configuracion/users?limit=200&offset=0
// Lista perfiles de usuario con paginacion.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    const params = new URL(request.url).searchParams;
    const limit = Math.min(500, Math.max(1, parseInt(params.get("limit") ?? "200", 10) || 200));
    const offset = Math.max(0, parseInt(params.get("offset") ?? "0", 10) || 0);
    // Con fallback si las columnas nuevas aun no existen (SQL pendiente).
    const selectCompleto =
      "id,email,role,entity,oficina_id,es_jefe,nombre_completo,dni,cargo,grado_academico,activo,metadata,created_at";
    const [profileRows, totalRows] = await Promise.all([
      supabaseRest<ProfileRow[]>(
        `profiles?select=${selectCompleto}&order=created_at.desc&limit=${limit}&offset=${offset}`,
      ).catch(() =>
        supabaseRest<ProfileRow[]>(
          `profiles?select=id,email,role,entity,metadata,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`,
        ).catch(() => []),
      ),
      supabaseRest<{ count: number }[]>(
        `profiles?select=nothing&count=exact`,
      ).catch(() => [{ count: 0 }]),
    ]);
    return NextResponse.json({
      users: profileRows.map(shapeUser),
      total: totalRows?.[0]?.count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo listar usuarios" },
      { status: 500 },
    );
  }
}

// POST /api/configuracion/users
// Body: { usuario, role, entity?, password? }
// Crea o vincula un usuario y devuelve credenciales si fue creado.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const payload = createUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: payload.error.flatten() },
      { status: 400 },
    );
  }
  try {
    // Si el DNI se escribió explícitamente y es distinto del usuario (que es el
    // DNI por defecto), verificar que no pertenezca ya a otro perfil.
    if (payload.data.dni && payload.data.dni !== payload.data.usuario) {
      const existing = await supabaseRest<{ id: string }[]>(
        `profiles?dni=eq.${encodeURIComponent(payload.data.dni)}&select=id&limit=1`,
      ).catch(() => []);
      if (existing.length > 0) {
        return NextResponse.json(
          { error: `El DNI "${payload.data.dni}" ya está registrado para otro usuario` },
          { status: 409 },
        );
      }
    }
    const password = payload.data.password || temporaryPassword();
    const oficinaId = payload.data.oficinaId || null;
    const email = correoDeUsuario(payload.data.usuario);
    const result = await createOrLinkUser({
      email,
      entity: payload.data.entity || null,
      esJefe: payload.data.esJefe,
      oficinaId,
      password,
      role: payload.data.role,
      datos: {
        nombreCompleto: payload.data.nombreCompleto || undefined,
        // El usuario ES el DNI. Sembrarlo evita que la ficha del firmante quede
        // sin documento por no haberlo escrito dos veces.
        dni: payload.data.dni || payload.data.usuario,
        cargo: payload.data.cargo || undefined,
        gradoAcademico: payload.data.gradoAcademico || undefined,
      },
    });
    const responseBody: {
      status: "created" | "linked";
      usuario: string;
      email: string;
      role: AppRole;
      password?: string;
    } = {
      status: result.status,
      usuario: payload.data.usuario,
      email,
      role: payload.data.role,
    };
    if (result.status === "created") {
      responseBody.password = password;
    }
    await writeAuditLog({
      action: "settings.user.create",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        status: result.status,
        usuario: payload.data.usuario,
        role: payload.data.role,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityId: result.userId,
      entityType: "profile",
    });
    return NextResponse.json(responseBody, { status: result.status === "created" ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear usuario" },
      { status: 500 },
    );
  }
}

// DELETE /api/configuracion/users?userId=X
// Quita acceso al usuario (lo elimina de Auth y de profiles).
// No permite eliminarse a si mismo.
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Falta userId" }, { status: 400 });
  }
  // El id se interpola en el filtro de `profiles`: se exige forma de UUID.
  if (!esIdSeguro(userId)) {
    return NextResponse.json({ error: "Id de usuario inválido" }, { status: 400 });
  }
  try {
    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario activo" },
        { status: 400 },
      );
    }
    // Validar ultimo admin: si el objetivo es admin, debe quedar al menos otro.
    const targetProfile = await supabaseRest<ProfileRow[]>(
      `profiles?id=eq.${encodeURIComponent(userId)}&select=id,role`,
    ).catch(() => [] as ProfileRow[]);
    if (targetProfile?.[0]?.role === "admin") {
      const admins = await supabaseRest<ProfileRow[]>(
        `profiles?role=eq.admin&select=id`,
      ).catch(() => [] as ProfileRow[]);
      if ((admins?.length ?? 0) <= 1) {
        return NextResponse.json(
          { error: "No puedes eliminar al ultimo administrador del sistema" },
          { status: 400 },
        );
      }
    }
    const supabase = await getSupabaseAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    // El acceso ya está revocado (la cuenta de Auth no existe). Si la fila de
    // `profiles` no se puede borrar, NO se silencia: el usuario seguiría
    // apareciendo en la lista como si existiera. Se reintenta una vez y, si aun
    // así falla, se avisa para que se pueda repetir la operación.
    let perfilBorrado = true;
    try {
      await supabaseRest(`profiles?id=eq.${userId}`, { method: "DELETE" });
    } catch {
      perfilBorrado = await supabaseRest(`profiles?id=eq.${userId}`, { method: "DELETE" })
        .then(() => true)
        .catch(() => false);
    }
    await writeAuditLog({
      action: "settings.user.delete",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        targetUserId: userId,
        perfilBorrado,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityId: userId,
      entityType: "profile",
    });
    return NextResponse.json({
      deleted: true,
      perfilBorrado,
      ...(perfilBorrado
        ? {}
        : {
            aviso:
              "Se revocó el acceso, pero la ficha del usuario no se pudo borrar y seguirá apareciendo en la lista. Vuelve a eliminarlo para limpiarla.",
          }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar" },
      { status: 500 },
    );
  }
}
