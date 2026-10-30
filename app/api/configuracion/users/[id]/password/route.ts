import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { esIdSeguro, getSupabaseAdminClient, supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Contraseña temporal, con el mismo formato que la del alta y el seed. */
function temporaryPassword() {
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  return `Ace-${token}!9`;
}

const PASSWORD_MINIMO = 8;

// POST /api/configuracion/users/[id]/password
//
// Restablece la contraseña de un usuario y devuelve la nueva para entregársela.
// Es la única salida cuando alguien la olvida: las cuentas usan correos
// @ace.local que NO reciben el email de recuperación de Supabase, así que sin
// esto un usuario bloqueado —incluido un administrador— se quedaba fuera del
// sistema para siempre.
//
// El cuerpo es OPCIONAL: sin `password` (o vacío) se genera una temporal, como
// antes — es lo que dispara el botón "Restablecer contraseña". Con `password`,
// el administrador fija el valor exacto que quiere — botón "Asignar
// contraseña" — para los casos en que la temporal aleatoria no sirve (p. ej.
// dictarla por teléfono).
//
// La contraseña no se guarda en ninguna tabla ni en la auditoría: vive en Auth y
// se muestra UNA vez en pantalla.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  if (!esIdSeguro(id)) {
    return NextResponse.json({ error: "Id de usuario inválido" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}) as { password?: unknown });
  const elegida = typeof body?.password === "string" ? body.password.trim() : "";
  if (elegida && elegida.length < PASSWORD_MINIMO) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${PASSWORD_MINIMO} caracteres.` },
      { status: 400 },
    );
  }

  try {
    const [perfil] = await supabaseRest<Array<{ id: string; email: string | null }>>(
      `profiles?id=eq.${id}&select=id,email`,
    ).catch(() => []);

    const supabase = await getSupabaseAdminClient();
    const password = elegida || temporaryPassword();
    // Una cuenta EXTERNA a la que el administrador le fija o le genera la contraseña vuelve a quedar con una temporal: la conoce
    // él, así que en su próximo ingreso se le obliga a elegir la suya (ver lib/modulos-acceso.ts). Auth fusiona `app_metadata`:
    // solo se enciende este aviso, los módulos y la vigencia se conservan. Al personal de la entidad no se le toca.
    const { data: existente } = await supabase.auth.admin.getUserById(id);
    const esExterno = existente?.user?.app_metadata?.tipo === "externo";
    const { data, error } = await supabase.auth.admin.updateUserById(id, {
      password,
      ...(esExterno ? { app_metadata: { cambiar_password: true } } : {}),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const usuario = data.user?.email ?? perfil?.email ?? "";

    await writeAuditLog({
      action: "settings.user.password_reset",
      actorReference: auth.user.email ?? auth.user.id,
      // Se registra QUIÉN restableció a quién y si la fijó a mano, nunca la
      // contraseña en sí.
      details: { usuario, asignadaManualmente: Boolean(elegida) },
      entityId: id,
      entityType: "usuario",
      module: "configuracion",
    });

    return NextResponse.json({ ok: true, usuario, password, deberaCambiarla: esExterno });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo restablecer la contraseña" },
      { status: 500 },
    );
  }
}
