import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { esIdSeguro, getSupabaseAdminClient, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const estadoSchema = z.object({ activo: z.boolean() });

// 100 años: el equivalente a "para siempre" que acepta `ban_duration` de
// Supabase Auth (no admite "infinite"). "none" desbanea.
const BAN_PERMANENTE = "876000h";

// PATCH /api/configuracion/users/[id]/estado
// Body: { activo: boolean }
//
// Inactivar NO es eliminar: la ficha (profiles) se conserva —historial,
// auditoría, documentos firmados a su nombre— pero la cuenta deja de poder
// iniciar sesión. El bloqueo real lo hace Supabase Auth (`ban_duration`), no
// la columna `profiles.activo`: esa columna es solo para que la lista de
// usuarios muestre el estado sin tener que consultar Auth por cada fila.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  if (!esIdSeguro(id)) {
    return NextResponse.json({ error: "Id de usuario inválido" }, { status: 400 });
  }

  const payload = estadoSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { activo } = payload.data;

  try {
    if (id === auth.user.id && !activo) {
      return NextResponse.json({ error: "No puedes inactivar tu propia cuenta" }, { status: 400 });
    }

    const targetProfile = await supabaseRest<Array<{ id: string; role: string; email: string | null }>>(
      `profiles?id=eq.${id}&select=id,role,email`,
    ).catch(() => []);
    const target = targetProfile[0];
    if (!target) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Último admin: no puede quedar el sistema sin ningún admin ACTIVO capaz
    // de revertir el bloqueo o gestionar el resto de cuentas.
    if (target.role === "admin" && !activo) {
      const adminsActivos = await supabaseRest<Array<{ id: string }>>(
        `profiles?role=eq.admin&activo=eq.true&select=id`,
      ).catch(() => []);
      if (adminsActivos.length <= 1) {
        return NextResponse.json(
          { error: "No puedes inactivar al último administrador activo del sistema" },
          { status: 400 },
        );
      }
    }

    const supabase = await getSupabaseAdminClient();
    const { error: authError } = await supabase.auth.admin.updateUserById(id, {
      ban_duration: activo ? "none" : BAN_PERMANENTE,
    });
    if (authError) throw new Error(authError.message);

    await supabaseRest(`profiles?id=eq.${id}`, {
      body: JSON.stringify({ activo }),
      method: "PATCH",
    });

    await writeAuditLog({
      action: activo ? "settings.user.activate" : "settings.user.deactivate",
      actorReference: auth.user.email ?? auth.user.id,
      details: {
        targetUserId: id,
        targetEmail: target.email,
        user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
      },
      entityId: id,
      entityType: "profile",
    });

    return NextResponse.json({ activo });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el estado" },
      { status: 500 },
    );
  }
}
