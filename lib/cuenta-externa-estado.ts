// Lo que una persona externa necesita saber de su propia cuenta sin pedírselo al administrador: cuánta IA le queda este mes y
// cuándo termina su acceso. Antes solo lo sabía al toparse con el error. Módulo puro (sin red ni base de datos): la barra
// lateral y los avisos pintan lo que este módulo decide, y los umbrales quedan cubiertos por tests.

const DIA_MS = 86_400_000;

/** A partir de qué porcentaje se avisa de que la cuota se acaba. */
export const UMBRAL_IA_ALTO = 80;
/** Con cuántos días o menos se avisa de que el acceso está por terminar. */
export const DIAS_AVISO_VIGENCIA = 7;

export type NivelIA = "sin_tope" | "normal" | "alto" | "agotado";
export type NivelVigencia = "sin_fin" | "normal" | "por_vencer";

export type EstadoCuentaExterna = {
  /** Tokens permitidos al mes; null = sin tope. */
  cuota: number | null;
  usados: number;
  /** 0–100 si hay tope; null si no. */
  porcentajeIA: number | null;
  nivelIA: NivelIA;
  /** Fin del acceso (ms desde 1970); null si no caduca. */
  vigenteHasta: number | null;
  /** Días que faltan, contando el día en curso como uno; null si no caduca. */
  diasRestantes: number | null;
  nivelVigencia: NivelVigencia;
};

export function estadoCuentaExterna(entrada: { cuota: number | null; usados: number; vigenteHasta: number | null; ahora: number }): EstadoCuentaExterna {
  const usados = Number.isFinite(entrada.usados) && entrada.usados > 0 ? Math.floor(entrada.usados) : 0;
  const cuota = entrada.cuota;
  let porcentajeIA: number | null = null;
  let nivelIA: NivelIA = "sin_tope";
  if (cuota !== null) {
    // Cuota 0 significa «sin IA»: está agotada desde el primer día, no «0 de 0 = 0 %».
    porcentajeIA = cuota === 0 ? 100 : Math.min(100, Math.floor((usados / cuota) * 100));
    nivelIA = usados >= cuota ? "agotado" : porcentajeIA >= UMBRAL_IA_ALTO ? "alto" : "normal";
  }
  const vigenteHasta = entrada.vigenteHasta;
  const diasRestantes = vigenteHasta === null ? null : Math.max(0, Math.ceil((vigenteHasta - entrada.ahora) / DIA_MS));
  const nivelVigencia: NivelVigencia = diasRestantes === null ? "sin_fin" : diasRestantes <= DIAS_AVISO_VIGENCIA ? "por_vencer" : "normal";
  return { cuota, usados, porcentajeIA, nivelIA, vigenteHasta, diasRestantes, nivelVigencia };
}

/** «hoy», «mañana» o «en 5 días». */
export function textoDias(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}

/** Fecha corta y estable para mostrar el fin del acceso («2 nov 2026»), en la hora de Lima. */
export function fechaFin(ms: number): string {
  return new Date(ms).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Lima" }).replace(/\./g, "");
}
