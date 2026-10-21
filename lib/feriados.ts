// Feriados y días no laborables oficiales del Perú, registrados en Configuración.
//
// Se usan para calcular las fechas del cronograma (o) de la estrategia: los
// días hábiles omiten sábados, domingos y estas fechas. Se guardan en
// entity_settings.feriados como jsonb.

export type Feriado = { fecha: string; nombre: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza y valida la lista guardada (descarta lo que no tenga fecha ISO). */
export function parseFeriados(value: unknown): Feriado[] {
  if (!Array.isArray(value)) return [];
  const vistos = new Set<string>();
  const out: Feriado[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const fecha = String((item as Record<string, unknown>).fecha ?? "").trim();
    if (!ISO.test(fecha) || vistos.has(fecha)) continue;
    vistos.add(fecha);
    out.push({ fecha, nombre: String((item as Record<string, unknown>).nombre ?? "").trim() });
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Conjunto de fechas ISO para el cálculo de días hábiles. */
export function setDeFeriados(feriados: Feriado[]): Set<string> {
  return new Set(feriados.map((f) => f.fecha));
}

/**
 * Feriados nacionales de FECHA FIJA del Perú (no varían de año a año). Son un
 * punto de partida para sembrar Configuración; la entidad debe COMPLETAR los
 * variables (Semana Santa: Jueves y Viernes Santo) y cualquier día no laborable
 * declarado por decreto, que cambian cada año.
 */
const FIJOS: ReadonlyArray<{ md: string; nombre: string }> = [
  { md: "01-01", nombre: "Año Nuevo" },
  { md: "05-01", nombre: "Día del Trabajo" },
  { md: "06-29", nombre: "San Pedro y San Pablo" },
  { md: "07-28", nombre: "Fiestas Patrias" },
  { md: "07-29", nombre: "Fiestas Patrias" },
  { md: "08-06", nombre: "Batalla de Junín" },
  { md: "08-30", nombre: "Santa Rosa de Lima" },
  { md: "10-08", nombre: "Combate de Angamos" },
  { md: "11-01", nombre: "Todos los Santos" },
  { md: "12-08", nombre: "Inmaculada Concepción" },
  { md: "12-09", nombre: "Batalla de Ayacucho" },
  { md: "12-25", nombre: "Navidad" },
];

/** Feriados nacionales de fecha fija para un año dado. */
export function feriadosNacionalesFijos(anio: number): Feriado[] {
  return FIJOS.map((f) => ({ fecha: `${anio}-${f.md}`, nombre: f.nombre }));
}
