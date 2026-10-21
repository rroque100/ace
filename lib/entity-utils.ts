// Normalización de entidades para comparación robusta entre
// expedientes_archivo.oficina (texto libre) y profiles.entity.

export function normalizeEntity(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function entitiesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeEntity(a);
  const nb = normalizeEntity(b);
  return na !== "" && nb !== "" && na === nb;
}

// El nombre de oficina es texto libre ("Oficina de Abastecimiento", "Unidad de
// Logística", "Sub Gerencia de Adquisiciones"...), así que se identifica por
// palabra clave, no por coincidencia exacta. Mismo criterio que
// `buscarOficina` en lib/solicitud-certificacion-data.ts.
const TERMINOS_ABASTECIMIENTO = ["abastecimiento", "logistica", "adquisicion"];

/**
 * ¿La oficina del usuario es la de Abastecimiento (DEC)?
 *
 * Vive en un módulo puro (sin `next/headers` ni Supabase) para poder llamarse
 * tanto desde el servidor (lib/auth.ts) como desde el middleware de sesión
 * (lib/supabase/middleware.ts), que corre en el runtime edge.
 */
export function esOficinaAbastecimiento(entity: string | null | undefined): boolean {
  const oficina = normalizeEntity(entity);
  return TERMINOS_ABASTECIMIENTO.some((termino) => oficina.includes(termino));
}
