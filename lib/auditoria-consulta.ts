// Filtros de la consulta de auditoría de cuentas externas.
//
// Todo lo que llega del cliente (ids, IP, fechas) se VALIDA antes de pegarlo en un filtro de PostgREST: un valor sin
// validar con un `&` dentro permite añadir filtros propios, y bajo la clave de servicio eso salta la RLS (ver
// `esIdSeguro` en lib/supabase-server.ts). Módulo puro: devuelve el texto del filtro o el motivo del rechazo.

import { LISTA_MODULOS_EXTERNOS } from "./modulos-acceso";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IP = /^[0-9a-fA-F:.]{3,45}$/;

export type ParametrosAuditoria = {
  usuarioId?: string | null;
  modulo?: string | null;
  ip?: string | null;
  desde?: string | null;
  hasta?: string | null;
  limite?: string | null;
  pagina?: string | null;
};

export type ConsultaAuditoria = { ok: true; filtro: string; limite: number; desde: number; hastaMs: number; desdeMs: number } | { ok: false; error: string };

const DIA = 86_400_000;

function fecha(valor: string | null | undefined, porDefecto: number): number | null {
  if (!valor) return porDefecto;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
}

/** Valida los filtros y arma el texto para PostgREST sobre `acceso_eventos`. Por defecto, los últimos 30 días. */
export function consultaEventos(parametros: ParametrosAuditoria, ahora: number): ConsultaAuditoria {
  const partes: string[] = [];
  if (parametros.usuarioId) {
    if (!UUID.test(parametros.usuarioId)) return { ok: false, error: "El identificador de usuario no es válido." };
    partes.push(`usuario_id=eq.${parametros.usuarioId}`);
  }
  if (parametros.modulo) {
    if (!(LISTA_MODULOS_EXTERNOS as string[]).includes(parametros.modulo)) return { ok: false, error: "El módulo no es válido." };
    partes.push(`modulo=eq.${parametros.modulo}`);
  }
  if (parametros.ip) {
    if (!IP.test(parametros.ip)) return { ok: false, error: "La IP no es válida." };
    partes.push(`ip=eq.${encodeURIComponent(parametros.ip)}`);
  }
  const desdeMs = fecha(parametros.desde, ahora - 30 * DIA);
  const hastaMs = fecha(parametros.hasta, ahora);
  if (desdeMs === null || hastaMs === null) return { ok: false, error: "Las fechas no son válidas." };
  if (desdeMs > hastaMs) return { ok: false, error: "La fecha de inicio es posterior a la de fin." };
  // Un rango de más de un año no se consulta de una vez: la retención es de 12 meses y la tabla crece sin parar.
  if (hastaMs - desdeMs > 366 * DIA) return { ok: false, error: "El rango no puede superar un año." };
  partes.push(`creado_en=gte.${encodeURIComponent(new Date(desdeMs).toISOString())}`, `creado_en=lte.${encodeURIComponent(new Date(hastaMs).toISOString())}`);
  const limite = Math.min(500, Math.max(1, Number.parseInt(parametros.limite ?? "100", 10) || 100));
  const pagina = Math.max(0, Number.parseInt(parametros.pagina ?? "0", 10) || 0);
  return { ok: true, filtro: partes.join("&"), limite, desde: pagina * limite, desdeMs, hastaMs };
}

/** Los mismos filtros para `uso_ia` (sin IP: esa tabla no la guarda). */
export function consultaConsumo(parametros: ParametrosAuditoria, ahora: number): { ok: true; filtro: string } | { ok: false; error: string } {
  const eventos = consultaEventos({ ...parametros, ip: null }, ahora);
  if (!eventos.ok) return eventos;
  return { ok: true, filtro: eventos.filtro };
}
