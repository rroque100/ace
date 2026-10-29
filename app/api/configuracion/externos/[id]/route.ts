import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireAdmin } from "@/lib/auth";
import { getSupabaseAdminClient, supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { credencialParaGuardar, LISTA_MODULOS_EXTERNOS } from "@/lib/modulos-acceso";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const editarSchema = z.object({
  modulos: z.array(z.enum(LISTA_MODULOS_EXTERNOS as [string, ...string[]])).max(LISTA_MODULOS_EXTERNOS.length).optional(),
  // null = sin fecha de fin. Una fecha pasada es válida aquí: sirve para cortar el acceso de inmediato.
  vigenteHasta: z.string().trim().refine((valor) => Number.isFinite(Date.parse(valor)), "La fecha de fin no es válida").nullable().optional(),
  cuotaIAMensual: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  nombreCompleto: z.string().trim().max(160).optional(),
});

// Solo edita cuentas EXTERNAS. Que esta ruta pudiera tocar a una cuenta interna sería una vía para quitarle o cambiarle el
// acceso al personal de la entidad con una petición mal armada.
export async function PATCH(request: Request, contexto: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await contexto.params;
  const malo = idsDeRutaInvalidos(id);
  if (malo) return malo;
  const cuerpo = editarSchema.safeParse(await request.json().catch(() => null));
  if (!cuerpo.success) return NextResponse.json({ error: cuerpo.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });

  const [perfil] = await supabaseRest<Array<{ tipo: string; modulos: string[] | null; vigente_hasta: string | null; cuota_ia_mensual: number | null }>>(
    `profiles?id=eq.${id}&select=tipo,modulos,vigente_hasta,cuota_ia_mensual`,
  );
  if (!perfil || perfil.tipo !== "externo") return NextResponse.json({ error: "No es una cuenta externa." }, { status: 404 });

  const datos = cuerpo.data;
  const siguiente = credencialParaGuardar({
    modulos: datos.modulos ?? perfil.modulos ?? [],
    vigenteHasta: datos.vigenteHasta === undefined ? perfil.vigente_hasta : datos.vigenteHasta,
    cuotaIAMensual: datos.cuotaIAMensual === undefined ? perfil.cuota_ia_mensual : datos.cuotaIAMensual,
  });
  const supabase = await getSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(id, { app_metadata: siguiente });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseRest(`profiles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      modulos: siguiente.modulos,
      vigente_hasta: siguiente.vigente_hasta,
      cuota_ia_mensual: siguiente.cuota_ia_mensual,
      ...(datos.nombreCompleto !== undefined ? { nombre_completo: datos.nombreCompleto || null } : {}),
    }),
  });
  await writeAuditLog({
    action: "settings.externo.update",
    details: {
      antes: { modulos: perfil.modulos, vigenteHasta: perfil.vigente_hasta, cuotaIAMensual: perfil.cuota_ia_mensual },
      despues: { modulos: siguiente.modulos, vigenteHasta: siguiente.vigente_hasta, cuotaIAMensual: siguiente.cuota_ia_mensual },
    },
    entityId: id,
    entityType: "user",
    user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
  });
  // El token ya emitido conserva los módulos y la vigencia de cuando se creó hasta que se renueva (≤ 1 h). Para cortar el
  // acceso AL INSTANTE se usa «Desactivar», que bloquea la cuenta en Auth.
  return NextResponse.json({ ok: true, aplicaEn: "la próxima renovación de sesión (hasta 1 hora); para cortar ya, desactiva la cuenta" });
}
