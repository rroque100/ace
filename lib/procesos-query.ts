// Construcción de la consulta PostgREST del listado de expedientes.
//
// Mismo patrón que lib/necesidades-query.ts, y por la misma razón: es una
// función pura para que un test pueda mirar la cadena que sale. Los fallos de
// sintaxis de PostgREST no dan error —el parámetro mal formado se ignora y la
// consulta devuelve 200 con la lista entera—, así que no se detectan mirando la
// pantalla ni los logs.
//
// Dos reglas que costaron encontrarse y conviene no volver a discutir:
//
//   · Los filtros de primer nivel van `columna=eq.valor`, con IGUAL. Escribirlos
//     `columna.eq.valor` los convierte en un parámetro sin valor que el servidor
//     descarta en silencio.
//   · El valor NO se entrecomilla. Las comillas no se despojan en un filtro
//     simple: pasan a formar parte del literal y la comparación no encuentra
//     nada. Entrecomillar solo aplica dentro de `in.(…)` y de `or=(…)`.

import { FASES } from "./procurement-fases";

export type FiltrosProcesos = {
  search?: string;
  /** Estado concreto del ciclo de vida (`procurement_processes.status`). */
  status?: string;
  /** Fase completa: "F1" | "F2" | "F3". Agrupa varios estados. */
  fase?: string;
  objectType?: string;
  procedureType?: string;
  /** Área usuaria, que vive en la necesidad de origen. */
  oficina?: string;
  /** Meta presupuestal, que también vive en la necesidad. */
  meta?: string;
  limit: number;
  offset: number;
};

/**
 * Columnas del expediente y de su necesidad de origen.
 *
 * `necesidades(...)` sale como ARRAY porque PostgREST resuelve la relación por
 * `necesidades.process_id`, que es uno-a-muchos. En la práctica hay una sola,
 * pero el tipo tiene que reflejar lo que llega.
 */
export const PROCESO_LIST_SELECT =
  "id,nomenclature,object_type,procedure_type,amount,valor_estimado,entity,status," +
  "necesidad_id,hitos,created_at,updated_at";

const EMBED_NECESIDAD = "necesidades(codigo,area_usuaria,meta_presupuestal,fecha_requerida)";

/** Estados que componen una fase, según el catálogo único de `procurement-fases`. */
export function estadosDeFase(faseId: string): string[] {
  return FASES.find((f) => f.id === faseId)?.statuses ?? [];
}

/** Ver la nota de `limpiarBusqueda` en necesidades-query: mismos delimitadores. */
export function limpiarBusqueda(valor: string): string {
  return (valor ?? "").replace(/[(),"\\]/g, " ").replace(/\s+/g, " ").trim();
}

function igual(columna: string, valor: string): string {
  return `${columna}=eq.${encodeURIComponent(valor)}`;
}

export function construirQueryProcesos(f: FiltrosProcesos): string {
  const oficina = f.oficina?.trim() ?? "";
  const meta = f.meta?.trim() ?? "";
  // `!inner` convierte el embebido en un INNER JOIN, que es lo que hace que
  // filtrar por una columna de la necesidad descarte expedientes en vez de
  // devolverlos con el embebido vacío. Solo cuando se filtra por ella: forzarlo
  // siempre escondería los expedientes que aún no tienen necesidad enlazada.
  const filtraPorNecesidad = Boolean(oficina || meta);
  const embed = filtraPorNecesidad ? EMBED_NECESIDAD.replace("(", "!inner(") : EMBED_NECESIDAD;

  const partes = [
    `select=${PROCESO_LIST_SELECT},${embed}`,
    "order=updated_at.desc",
    `limit=${f.limit}`,
    `offset=${f.offset}`,
  ];

  const search = limpiarBusqueda(f.search ?? "");
  if (search) {
    const literal = search.replace(/[%_\\]/g, (m) => `\\${m}`);
    const patron = encodeURIComponent(`*${literal}*`);
    partes.push(`or=(nomenclature.ilike.${patron},entity.ilike.${patron})`);
  }

  // El estado concreto manda sobre la fase: si alguien eligió "Buena pro", pedir
  // además los otros estados de la Fase 2 le devolvería lo que no pidió.
  if (f.status?.trim()) {
    partes.push(igual("status", f.status.trim()));
  } else if (f.fase?.trim()) {
    const estados = estadosDeFase(f.fase.trim());
    // `in.(…)` SÍ lleva los valores entrecomillados: ahí la coma es delimitador.
    if (estados.length > 0) {
      const lista = estados.map((e) => `"${e}"`).join(",");
      partes.push(`status=in.${encodeURIComponent(`(${lista})`)}`);
    }
  }

  if (f.objectType?.trim()) partes.push(igual("object_type", f.objectType.trim()));
  if (f.procedureType?.trim()) partes.push(igual("procedure_type", f.procedureType.trim()));
  if (oficina) partes.push(igual("necesidades.area_usuaria", oficina));
  if (meta) partes.push(igual("necesidades.meta_presupuestal", meta));

  return partes.join("&");
}
