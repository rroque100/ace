// Alta de una cuenta externa en Auth y en el espejo del perfil. La usan el alta manual del administrador
// (app/api/configuracion/externos) y la aprobación de una solicitud de acceso (…/externos/solicitudes/[id]), para que las
// dos creen la cuenta exactamente igual: mismos módulos, misma contraseña temporal y el mismo aviso de «elige la tuya».
//
// Solo servidor: usa la clave de servicio.

import { credencialParaGuardar } from "@/lib/modulos-acceso";
import { getSupabaseAdminClient, supabaseRest } from "@/lib/supabase-server";
import { correoDeUsuario } from "@/lib/usuario-credencial";

export const SQL_PENDIENTE = "Falta ejecutar docs/supabase/usuarios-externos.sql en el SQL Editor de Supabase.";
export const SQL_SOLICITUDES_PENDIENTE = "Falta ejecutar docs/supabase/solicitudes-acceso.sql en el SQL Editor de Supabase.";

/** Los errores de PostgREST/Postgres que significan «esa tabla o columna todavía no existe» (el SQL manual no se ha corrido). */
export const esFaltaSql = (error: unknown) =>
  /42703|42P01|PGRST20[45]|does not exist|Could not find|schema cache/i.test(error instanceof Error ? error.message : String(error));

export function contrasenaTemporal() {
  return `Ace-${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}!9`;
}

export type DatosCuentaExterna = {
  usuario: string;
  nombreCompleto?: string | null;
  /** Si el administrador la fija él mismo; si no, se genera una temporal. */
  password?: string | null;
  modulos: readonly string[];
  vigenteHasta?: string | null;
  cuotaIAMensual?: number | null;
};

export type ResultadoCuentaExterna =
  | { ok: true; id: string; usuario: string; credencial: ReturnType<typeof credencialParaGuardar>; contrasena: string; generada: boolean }
  | { ok: false; status: number; error: string; sqlPendiente?: boolean };

/**
 * Crea la cuenta y su espejo en `profiles`. La cuenta nace marcada para elegir contraseña propia en su primer ingreso
 * (`cambiar_password`): la que fijó o generó el administrador la conoce él, no debe quedar como la definitiva.
 */
export async function crearCuentaExterna(datos: DatosCuentaExterna): Promise<ResultadoCuentaExterna> {
  // Antes de crear nada en Auth se comprueba que las columnas del perfil existen: crear la cuenta y fallar al reflejarla en
  // el perfil dejaría una cuenta huérfana que no aparece en la lista.
  try {
    await supabaseRest("profiles?select=tipo&limit=1");
  } catch (error) {
    if (esFaltaSql(error)) return { ok: false, status: 409, error: SQL_PENDIENTE, sqlPendiente: true };
    throw error;
  }

  const correo = correoDeUsuario(datos.usuario);
  const generada = !datos.password;
  const contrasena = datos.password || contrasenaTemporal();
  const credencial = credencialParaGuardar({
    modulos: datos.modulos,
    vigenteHasta: datos.vigenteHasta || null,
    cuotaIAMensual: datos.cuotaIAMensual ?? null,
    cambiarPassword: true,
  });
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
    return { ok: false, status: existe ? 409 : 500, error: existe ? "Ya existe una cuenta con ese usuario." : (error?.message ?? "No se pudo crear la cuenta") };
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
    const faltaSql = esFaltaSql(errorPerfil);
    return { ok: false, status: faltaSql ? 409 : 500, error: faltaSql ? SQL_PENDIENTE : "No se pudo registrar el perfil; la cuenta no se creó.", ...(faltaSql ? { sqlPendiente: true } : {}) };
  }
  return { ok: true, id: data.user.id, usuario: datos.usuario, credencial, contrasena, generada };
}
