import { NextResponse } from "next/server";
import { z } from "zod";
import { idsDeRutaInvalidos, requireAdmin } from "@/lib/auth";
import { crearCuentaExterna, cuentasPorDni, descripcionCuenta, esFaltaSql, SQL_SOLICITUDES_PENDIENTE } from "@/lib/externos-cuenta";
import { LISTA_MODULOS_EXTERNOS } from "@/lib/modulos-acceso";
import { mensajeBienvenida } from "@/lib/solicitud-acceso";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const moduloSchema = z.enum(LISTA_MODULOS_EXTERNOS as [string, ...string[]]);

const cuerpoSchema = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("aprobar"),
    // El administrador decide lo que se concede: puede ser distinto de lo que la persona pidió.
    modulos: z.array(moduloSchema).min(1, "Elige al menos un módulo").max(LISTA_MODULOS_EXTERNOS.length),
    vigenteHasta: z.string().trim().refine((valor) => Number.isFinite(Date.parse(valor)), "La fecha de fin no es válida").refine((valor) => Date.parse(valor) > Date.now(), "La fecha de fin debe ser futura").nullish().or(z.literal("")),
    cuotaIAMensual: z.number().int().min(0).max(1_000_000_000).nullish(),
  }),
  z.object({
    accion: z.literal("rechazar"),
    motivo: z.string().trim().max(300, "El motivo es demasiado largo (máximo 300 caracteres)").optional().or(z.literal("")),
  }),
]);

type Solicitud = { id: string; nombre: string; dni: string; correo: string; celular: string | null; estado: string };

// Se «reclama» la solicitud antes de crear nada: el PATCH condicionado a `estado=pendiente` lo gana un solo administrador,
// así que dos clics a la vez (o dos administradores) no crean dos cuentas ni resuelven dos veces la misma solicitud.
async function reclamar(id: string, estado: "aprobada" | "rechazada", quien: string, motivoRechazo?: string | null) {
  const filas = await supabaseRest<Solicitud[]>(`solicitudes_acceso?id=eq.${id}&estado=eq.pendiente`, {
    method: "PATCH",
    body: JSON.stringify({ estado, resuelta_por: quien, resuelta_en: new Date().toISOString(), ...(motivoRechazo !== undefined ? { motivo_rechazo: motivoRechazo } : {}) }),
  });
  return filas[0] ?? null;
}

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await contexto.params;
  const malo = idsDeRutaInvalidos(id);
  if (malo) return malo;
  const cuerpo = cuerpoSchema.safeParse(await request.json().catch(() => null));
  if (!cuerpo.success) return NextResponse.json({ error: cuerpo.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const datos = cuerpo.data;
  const quien = { email: auth.user.email, id: auth.user.id, role: auth.user.role };

  try {
    if (datos.accion === "rechazar") {
      const fila = await reclamar(id, "rechazada", auth.user.id, datos.motivo || null);
      if (!fila) return NextResponse.json({ error: "Esa solicitud ya fue resuelta o no existe." }, { status: 409 });
      await writeAuditLog({ action: "settings.externo.solicitud.rechazar", details: { dni: fila.dni, motivo: datos.motivo || null }, entityId: id, entityType: "solicitud_acceso", user: quien });
      return NextResponse.json({ ok: true });
    }

    // Antes de reclamarla: si el DNI ya tiene cuenta no hay nada que crear, y la solicitud debe seguir pendiente tal cual.
    const [previa] = await supabaseRest<Array<{ dni: string; estado: string }>>(`solicitudes_acceso?id=eq.${id}&select=dni,estado`);
    if (!previa || previa.estado !== "pendiente") return NextResponse.json({ error: "Esa solicitud ya fue resuelta o no existe." }, { status: 409 });
    const existente = (await cuentasPorDni([previa.dni])).get(previa.dni);
    if (existente) {
      return NextResponse.json(
        { error: `El DNI ${previa.dni} ya tiene ${descripcionCuenta(existente)}. No se puede crear otra cuenta con el mismo DNI: rechaza la solicitud o edita la cuenta existente.`, codigo: "dni_con_cuenta" },
        { status: 409 },
      );
    }

    const fila = await reclamar(id, "aprobada", auth.user.id);
    if (!fila) return NextResponse.json({ error: "Esa solicitud ya fue resuelta o no existe." }, { status: 409 });

    const cuenta = await crearCuentaExterna({
      usuario: fila.dni,
      nombreCompleto: fila.nombre,
      modulos: datos.modulos,
      vigenteHasta: datos.vigenteHasta || null,
      cuotaIAMensual: datos.cuotaIAMensual ?? null,
    });
    if (!cuenta.ok) {
      // No se pudo crear la cuenta (p. ej. ya existía una con ese DNI): la solicitud vuelve a la bandeja para decidir otra cosa.
      await supabaseRest(`solicitudes_acceso?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ estado: "pendiente", resuelta_por: null, resuelta_en: null }) })
        .catch((errorRevertir) => console.error("[solicitudes] no se pudo devolver la solicitud a pendiente", errorRevertir));
      return NextResponse.json({ error: cuenta.error, ...(cuenta.sqlPendiente ? { sqlPendiente: true } : {}) }, { status: cuenta.status });
    }
    await supabaseRest(`solicitudes_acceso?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ usuario_id: cuenta.id }) });
    await writeAuditLog({
      action: "settings.externo.solicitud.aprobar",
      details: { dni: fila.dni, modulos: cuenta.credencial.modulos, vigenteHasta: cuenta.credencial.vigente_hasta, cuotaIAMensual: cuenta.credencial.cuota_ia_mensual },
      entityId: cuenta.id,
      entityType: "user",
      user: quien,
    });
    // La contraseña temporal se muestra UNA vez, aquí: no queda guardada en ninguna parte. El texto para la persona se arma con ella.
    return NextResponse.json({
      ok: true,
      id: cuenta.id,
      usuario: cuenta.usuario,
      passwordTemporal: cuenta.contrasena,
      correo: fila.correo,
      celular: fila.celular,
      mensaje: mensajeBienvenida({
        nombre: fila.nombre,
        usuario: cuenta.usuario,
        passwordTemporal: cuenta.contrasena,
        urlLogin: `${new URL(request.url).origin}/login`,
        modulos: cuenta.credencial.modulos,
        vigenteHasta: cuenta.credencial.vigente_hasta,
      }),
    });
  } catch (error) {
    if (esFaltaSql(error)) return NextResponse.json({ error: SQL_SOLICITUDES_PENDIENTE, sqlPendiente: true }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo resolver la solicitud" }, { status: 500 });
  }
}
