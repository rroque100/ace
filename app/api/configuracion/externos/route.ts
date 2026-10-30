import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { esUsuarioValido, USUARIO_LONGITUD, usuarioDeCorreo } from "@/lib/usuario-credencial";
import { LISTA_MODULOS_EXTERNOS } from "@/lib/modulos-acceso";
import { crearCuentaExterna, esFaltaSql, SQL_PENDIENTE } from "@/lib/externos-cuenta";
import { resumirConsumo, type FilaUsoIA } from "@/lib/auditoria-resumen";
import { inicioDeMes } from "@/lib/uso-ia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cuentas EXTERNAS (asesores, alumnos): las crea y administra solo el administrador. Entran únicamente a los módulos que
// se les habilitan aquí, con una vigencia y una cuota mensual de IA, y su actividad queda auditada (ver
// lib/modulos-acceso.ts y docs/supabase/usuarios-externos.sql).

const moduloSchema = z.enum(LISTA_MODULOS_EXTERNOS as [string, ...string[]]);

const finDeVigencia = z
  .string()
  .trim()
  .refine((valor) => Number.isFinite(Date.parse(valor)), "La fecha de fin no es válida")
  .refine((valor) => Date.parse(valor) > Date.now(), "La fecha de fin debe ser futura");

const crearSchema = z.object({
  usuario: z.string().trim().refine(esUsuarioValido, `El usuario debe tener ${USUARIO_LONGITUD} dígitos`),
  nombreCompleto: z.string().trim().max(160).optional().or(z.literal("")),
  password: z.string().min(8).max(120).optional().or(z.literal("")),
  modulos: z.array(moduloSchema).min(1, "Elige al menos un módulo").max(LISTA_MODULOS_EXTERNOS.length),
  vigenteHasta: finDeVigencia.nullish().or(z.literal("")),
  // Tokens de IA por mes (entrada + salida). Vacío = sin tope; 0 = sin IA.
  cuotaIAMensual: z.number().int().min(0).max(1_000_000_000).nullish(),
});

type PerfilExterno = {
  id: string;
  email: string | null;
  nombre_completo: string | null;
  activo?: boolean | null;
  modulos: string[] | null;
  vigente_hasta: string | null;
  cuota_ia_mensual: number | null;
  created_at: string | null;
};

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  try {
    let perfiles: PerfilExterno[];
    try {
      perfiles = await supabaseRest<PerfilExterno[]>("profiles?tipo=eq.externo&select=id,email,nombre_completo,activo,modulos,vigente_hasta,cuota_ia_mensual,created_at&order=created_at.desc&limit=500");
    } catch (error) {
      if (esFaltaSql(error)) return NextResponse.json({ sqlPendiente: true, aviso: SQL_PENDIENTE, externos: [] });
      throw error;
    }
    const ids = perfiles.map((perfil) => perfil.id);
    let consumo = new Map<string, ReturnType<typeof resumirConsumo>["usuarios"][number]>();
    const ultimo = new Map<string, { ip: string | null; en: string }>();
    if (ids.length) {
      const lista = ids.join(",");
      try {
        const filas = await supabaseRest<FilaUsoIA[]>(`uso_ia?usuario_id=in.(${lista})&creado_en=gte.${encodeURIComponent(inicioDeMes(Date.now()))}&select=usuario_id,modulo,operacion,tokens_entrada,tokens_salida,costo_estimado,estimado&limit=20000`);
        consumo = new Map(resumirConsumo(filas).usuarios.map((u) => [u.usuarioId, u]));
        const eventos = await supabaseRest<Array<{ usuario_id: string; ip: string | null; creado_en: string }>>(`acceso_eventos?usuario_id=in.(${lista})&select=usuario_id,ip,creado_en&order=creado_en.desc&limit=2000`);
        for (const evento of eventos) if (!ultimo.has(evento.usuario_id)) ultimo.set(evento.usuario_id, { ip: evento.ip, en: evento.creado_en });
      } catch (error) {
        if (!esFaltaSql(error)) throw error;
      }
    }
    return NextResponse.json({
      sqlPendiente: false,
      externos: perfiles.map((perfil) => ({
        id: perfil.id,
        usuario: usuarioDeCorreo(perfil.email) ?? perfil.email,
        nombre: perfil.nombre_completo,
        activo: perfil.activo !== false,
        modulos: perfil.modulos ?? [],
        vigenteHasta: perfil.vigente_hasta,
        cuotaIAMensual: perfil.cuota_ia_mensual,
        creadoEn: perfil.created_at,
        consumoMes: consumo.get(perfil.id) ?? { usuarioId: perfil.id, llamadas: 0, tokens: 0, costo: 0, modulos: [] },
        ultimoAcceso: ultimo.get(perfil.id) ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer la lista de usuarios externos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const cuerpo = crearSchema.safeParse(await request.json().catch(() => null));
  if (!cuerpo.success) return NextResponse.json({ error: cuerpo.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const datos = cuerpo.data;

  const cuenta = await crearCuentaExterna({
    usuario: datos.usuario,
    nombreCompleto: datos.nombreCompleto,
    password: datos.password,
    modulos: datos.modulos,
    vigenteHasta: datos.vigenteHasta,
    cuotaIAMensual: datos.cuotaIAMensual,
  });
  if (!cuenta.ok) return NextResponse.json({ error: cuenta.error, ...(cuenta.sqlPendiente ? { sqlPendiente: true } : {}) }, { status: cuenta.status });
  await writeAuditLog({
    action: "settings.externo.create",
    details: { modulos: cuenta.credencial.modulos, vigenteHasta: cuenta.credencial.vigente_hasta, cuotaIAMensual: cuenta.credencial.cuota_ia_mensual },
    entityId: cuenta.id,
    entityType: "user",
    user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
  });
  // La contraseña temporal se muestra UNA vez, aquí: no queda guardada en ninguna parte.
  return NextResponse.json({ id: cuenta.id, usuario: cuenta.usuario, passwordTemporal: cuenta.generada ? cuenta.contrasena : null }, { status: 201 });
}
