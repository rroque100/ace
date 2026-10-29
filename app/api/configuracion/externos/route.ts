import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getSupabaseAdminClient, supabaseRest, writeAuditLog } from "@/lib/supabase-server";
import { correoDeUsuario, esUsuarioValido, USUARIO_LONGITUD, usuarioDeCorreo } from "@/lib/usuario-credencial";
import { LISTA_MODULOS_EXTERNOS, credencialParaGuardar } from "@/lib/modulos-acceso";
import { resumirConsumo, type FilaUsoIA } from "@/lib/auditoria-resumen";
import { inicioDeMes } from "@/lib/uso-ia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Cuentas EXTERNAS (asesores, alumnos): las crea y administra solo el administrador. Entran únicamente a los módulos que
// se les habilitan aquí, con una vigencia y una cuota mensual de IA, y su actividad queda auditada (ver
// lib/modulos-acceso.ts y docs/supabase/usuarios-externos.sql).

const SQL_PENDIENTE = "Falta ejecutar docs/supabase/usuarios-externos.sql en el SQL Editor de Supabase.";
const esFaltaSql = (error: unknown) => /42703|42P01|PGRST20[45]|does not exist|Could not find|schema cache/i.test(error instanceof Error ? error.message : String(error));

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

function contrasenaTemporal() {
  return `Ace-${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}!9`;
}

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

  // Antes de crear nada en Auth se comprueba que las columnas del perfil existen: crear la cuenta y fallar al reflejarla en
  // el perfil dejaría una cuenta huérfana que no aparece en la lista.
  try {
    await supabaseRest("profiles?select=tipo&limit=1");
  } catch (error) {
    if (esFaltaSql(error)) return NextResponse.json({ error: SQL_PENDIENTE, sqlPendiente: true }, { status: 409 });
    throw error;
  }

  const correo = correoDeUsuario(datos.usuario);
  const contrasena = datos.password || contrasenaTemporal();
  const credencial = credencialParaGuardar({ modulos: datos.modulos, vigenteHasta: datos.vigenteHasta || null, cuotaIAMensual: datos.cuotaIAMensual ?? null });
  const supabase = await getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: correo,
    email_confirm: true,
    password: contrasena,
    user_metadata: { role: "consulta" },
    // `app_metadata` solo lo escribe el servidor: la persona no puede ampliarse los módulos ni la vigencia.
    app_metadata: credencial,
  });
  if (error || !data.user) {
    const existe = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json({ error: existe ? "Ya existe una cuenta con ese usuario." : (error?.message ?? "No se pudo crear la cuenta") }, { status: existe ? 409 : 500 });
  }
  try {
    await supabaseRest(`profiles?id=eq.${data.user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        role: "consulta",
        tipo: "externo",
        modulos: credencial.modulos,
        vigente_hasta: credencial.vigente_hasta,
        cuota_ia_mensual: credencial.cuota_ia_mensual,
        nombre_completo: datos.nombreCompleto || null,
        dni: datos.usuario,
        entity: null,
        activo: true,
      }),
    });
  } catch (errorPerfil) {
    // Sin reflejo en el perfil la cuenta no se vería ni se podría administrar: se deshace en vez de dejarla a medias.
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    return NextResponse.json({ error: esFaltaSql(errorPerfil) ? SQL_PENDIENTE : "No se pudo registrar el perfil; la cuenta no se creó." }, { status: esFaltaSql(errorPerfil) ? 409 : 500 });
  }
  await writeAuditLog({
    action: "settings.externo.create",
    details: { modulos: credencial.modulos, vigenteHasta: credencial.vigente_hasta, cuotaIAMensual: credencial.cuota_ia_mensual },
    entityId: data.user.id,
    entityType: "user",
    user: { email: auth.user.email, id: auth.user.id, role: auth.user.role },
  });
  // La contraseña temporal se muestra UNA vez, aquí: no queda guardada en ninguna parte.
  return NextResponse.json({ id: data.user.id, usuario: datos.usuario, passwordTemporal: datos.password ? null : contrasena }, { status: 201 });
}
