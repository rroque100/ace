// Registro de lo que hace cada cuenta externa: desde qué IP entra, qué páginas abre y qué acciones realiza.
//
// Escribe en `acceso_eventos` (ver docs/supabase/usuarios-externos.sql) con la clave de servicio. Nunca debe romper
// la solicitud que audita: si la tabla aún no existe o la base falla, se avisa UNA vez en el log del servidor y se
// sigue. A diferencia de `catch { }` a secas, el aviso dice qué falta, para que no parezca que se audita cuando no.
//
// Solo se guarda la RUTA, nunca la query: puede llevar el texto de una pregunta o un identificador sensible.

import { supabaseRest } from "@/lib/supabase-server";

export type EventoAcceso = {
  usuarioId: string;
  usuario?: string | null;
  modulo?: string | null;
  accion: string;
  ruta?: string | null;
  metodo?: string | null;
  estado?: number | null;
  ip: string;
  userAgent?: string | null;
};

const recortar = (valor: string | null | undefined, max: number) => (valor ? valor.slice(0, max) : null);

let avisado = false;

/** Fila lista para insertar: textos acotados para que una cabecera enorme no llene la tabla. */
export function filaDeEvento(evento: EventoAcceso) {
  return {
    usuario_id: evento.usuarioId,
    usuario: recortar(evento.usuario, 120),
    modulo: recortar(evento.modulo, 40),
    accion: evento.accion.slice(0, 200),
    ruta: recortar(evento.ruta, 300),
    metodo: recortar(evento.metodo, 10),
    estado: typeof evento.estado === "number" ? evento.estado : null,
    ip: recortar(evento.ip, 45),
    user_agent: recortar(evento.userAgent, 300),
  };
}

export async function registrarEventoAcceso(evento: EventoAcceso): Promise<void> {
  try {
    await supabaseRest("acceso_eventos", { method: "POST", body: JSON.stringify(filaDeEvento(evento)) });
  } catch (error) {
    if (avisado) return;
    avisado = true;
    const motivo = error instanceof Error ? error.message.replace(/\s+/g, " ").slice(0, 200) : String(error);
    console.error(`[auditoria-externos] no se pudo registrar el evento; ¿falta ejecutar docs/supabase/usuarios-externos.sql? (${motivo})`);
  }
}
