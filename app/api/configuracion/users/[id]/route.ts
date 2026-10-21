import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  APP_ROLES,
  type AppRole,
  areasForRole,
} from "@/lib/permisos-contratacion";
import {
  esIdSeguro,
  getSupabaseAdminClient,
  supabaseRest,
  writeAuditLog,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userRoleSchema = z.enum(
  APP_ROLES.map((role) => role.value) as [AppRole, ...AppRole[]],
);

const updateUserSchema = z.object({
  entity: z.string().trim().max(180).optional().or(z.literal("")),
  esJefe: z.boolean().optional(),
  oficinaId: z.string().uuid().optional().or(z.literal("")).or(z.null()),
  role: userRoleSchema,
  // Datos personales del perfil (opcionales; para documentos oficiales).
  nombreCompleto: z.string().trim().max(160).optional().or(z.literal("")),
  dni: z.string().trim().max(20).optional().or(z.literal("")),
  cargo: z.string().trim().max(160).optional().or(z.literal("")),
  gradoAcademico: z.string().trim().max(120).optional().or(z.literal("")),
});

function profileMetadata(role: AppRole, entity?: string | null) {
  return {
    entity: entity || null,
    permissionVersion: "ace-role-matrix-v1",
    permissions: areasForRole(role),
    role,
    updatedAt: new Date().toISOString(),
  };
}

// PATCH /api/configuracion/users/[id]
// Body: { role, entity? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Falta el id del usuario" }, { status: 400 });
  }
  // El id se interpola en el filtro de `profiles`: se exige forma de UUID.
  if (!esIdSeguro(id)) {
    return NextResponse.json({ error: "Id de usuario inválido" }, { status: 400 });
  }
  const payload = updateUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: "Datos invalidos", details: payload.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const data = payload.data;
    // Se lee antes para saber si el DNI REALMENTE cambia: hay perfiles
    // institucionales (p. ej. "alcaldia") que comparten un DNI placeholder
    // como "00000000", y con eso el chequeo de unicidad de abajo bloqueaba
    // guardar CUALQUIER otro campo (oficina, jefe...) de esos usuarios aunque
    // no tocaran el DNI, porque encontraba la fila de otro perfil con el
    // mismo valor.
    const currentProfile = await supabaseRest<{ role: string; dni: string | null }[]>(
      `profiles?id=eq.${encodeURIComponent(id)}&select=role,dni`,
    ).catch(() => [] as { role: string; dni: string | null }[]);
    // Si se cambia el DNI, verificar que no pertenezca ya a otro perfil.
    if (data.dni && data.dni !== currentProfile?.[0]?.dni) {
      const existing = await supabaseRest<{ id: string }[]>(
        `profiles?dni=eq.${encodeURIComponent(data.dni)}&id=neq.${encodeURIComponent(id)}&select=id&limit=1`,
      ).catch(() => []);
      if (existing.length > 0) {
        return NextResponse.json(
          { error: `El DNI "${data.dni}" ya está registrado para otro usuario` },
          { status: 409 },
        );
      }
    }
    // Bloquear auto-downgrade: el admin no puede quitarse su propio rol.
    if (id === auth.user.id && data.role !== "admin") {
      return NextResponse.json(
        { error: "No puedes cambiar tu propio rol de administrador. Pide a otro admin que lo haga." },
        { status: 400 },
      );
    }
    // Validar ultimo admin: si el objetivo es admin y se cambia a no-admin,
    // debe quedar al menos otro admin.
    if (currentProfile?.[0]?.role === "admin" && data.role !== "admin") {
      const admins = await supabaseRest<{ id: string }[]>(
        `profiles?role=eq.admin&select=id`,
      ).catch(() => [] as { id: string }[]);
      if ((admins?.length ?? 0) <= 1) {
        return NextResponse.json(
          { error: "No puedes quitar el rol de administrador al ultimo administrador del sistema" },
          { status: 400 },
        );
      }
    }
    const oficinaId = data.oficinaId || null;
    const entity = data.entity || null;
    const metadata = profileMetadata(data.role, entity);
    const supabase = await getSupabaseAdminClient();
    // El rol vive en DOS sitios: la metadata de Auth y la fila de `profiles`. Se
    // escriben en secuencia, así que si el segundo falla quedaban discrepando sin
    // que nadie se enterara (la sesión leería un rol y la app otro). Se guarda la
    // metadata anterior para poder deshacer el primer paso.
    const { data: authPrevio } = await supabase.auth.admin.getUserById(id);
    const metadataPrevia = authPrevio?.user?.user_metadata ?? {};
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(id, {
      user_metadata: metadata,
    });
    if (updateAuthError) throw new Error(updateAuthError.message);
    // En una edición, un campo vacío es una decisión (borrarlo), así que se
    // escribe null en vez de omitirse. `?? null` convierte "" en null.
    const limpio = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
    const profilePatch: Record<string, unknown> = {
      entity,
      metadata,
      role: data.role,
      oficina_id: oficinaId,
      es_jefe: Boolean(data.esJefe),
      nombre_completo: limpio(data.nombreCompleto),
      dni: limpio(data.dni),
      cargo: limpio(data.cargo),
      grado_academico: limpio(data.gradoAcademico),
    };
    // Si alguna columna aun no existe (SQL pendiente), reintenta sin ellas.
    // Y si aun asi no se puede guardar el perfil, se DESHACE el cambio en Auth:
    // es preferible que la edicion falle entera a dejar los dos sitios en
    // desacuerdo sobre el rol de una persona.
    try {
      await supabaseRest(`profiles?id=eq.${id}`, {
        body: JSON.stringify(profilePatch),
        method: "PATCH",
      }).catch((err) => {
        if (err instanceof Error && /oficina_id|es_jefe|nombre_completo|dni|cargo|grado_academico/i.test(err.message)) {
          const { oficina_id: _o, es_jefe: _j, nombre_completo: _n, dni: _d, cargo: _c, grado_academico: _g, ...rest } =
            profilePatch;
          return supabaseRest(`profiles?id=eq.${id}`, {
            body: JSON.stringify(rest),
            method: "PATCH",
          });
        }
        throw err;
      });
    } catch (err) {
      await supabase.auth.admin
        .updateUserById(id, { user_metadata: metadataPrevia })
        .catch(() => undefined);
      const detalle = err instanceof Error ? err.message : String(err);
      throw new Error(
        `No se pudo guardar el perfil, asi que se revirtio el rol en Auth y nada cambio. ${detalle}`,
      );
    }
    await writeAuditLog({
      action: "settings.user.update",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        targetUserId: id,
        entity,
        esJefe: Boolean(data.esJefe),
        oficinaId,
        role: data.role,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityId: id,
      entityType: "profile",
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar usuario" },
      { status: 500 },
    );
  }
}
