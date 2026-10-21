// Parámetros de segmentación por cuantía (Art. 125.1 y 125.2 del Reglamento).
//
// La cuantía NO es una apreciación del usuario: es una operación aritmética
// contra el PAC vigente. Es de ALTA cuantía cuando el valor estimado supera el
// 10% del monto total de bienes y servicios contemplado en el PAC (Art. 125.2).
//
// La base del 10% NO es solo el PAC inicial. La Guía de Actuaciones
// Preparatorias lo dice expresamente:
//
//   "En caso la DEC reciba más de un requerimiento no programado en el PAC
//    respecto de los cuales deba realizar la segmentación, para determinar la
//    alta cuantía no solo suma las contrataciones programadas en el PAC (el
//    cual en este caso incluye las contrataciones no programadas que ya fueron
//    convocadas) y el monto de la contratación que está segmentando."
//
// De ahí que la base sean tres sumandos más la contratación evaluada:
//
//   Σ programadas del PAC
//   + Σ no programadas ya CONVOCADAS   (ya integran el PAC vigente)
//   + Σ otras no programadas a segmentar en el mismo acto
//   + la contratación evaluada, solo si NO está programada
//     (si lo está, su monto ya está en el PAC y se contaría dos veces)
//
// Omitir sumandos deja la base corta, la línea de corte baja, y clasifica como
// ALTA una contratación que en realidad es BAJA.
//
// Solo aplica a bienes y servicios (incluidas consultorías en general). Las
// obras y consultorías de obra se clasifican por los criterios concurrentes del
// Art. 153, sin línea de corte por cuantía.

/** Porcentaje del monto total del PAC que define la línea de corte. */
export const PORCENTAJE_LINEA_CORTE = 0.1;

export type ParametrosSegmentacionInput = {
  /**
   * Monto del PAC aprobado para bienes y servicios (dato anual de
   * Configuración). Según la Guía comprende bienes, servicios, procedimientos
   * de selección no competitivos y contrataciones por CEAM del PAC.
   */
  pacBienesServicios: number | null | undefined;
  /**
   * Σ de contrataciones NO programadas ya CONVOCADAS. Integran el PAC vigente
   * aunque no estén en el PAC inicial, así que suman a la base.
   */
  noProgramadasConvocadas?: number | null;
  /**
   * Σ de OTRAS no programadas que se segmentan en el mismo acto. Normalmente NO
   * incluye la que se evalúa (esa se suma aparte, como "Esta contratación").
   * Excepción: con `contratacionEnOtras` la entidad decide registrar la propia
   * contratación DENTRO de este monto, y entonces no se suma por separado.
   */
  otrasNoProgramadasASegmentar?: number | null;
  /** Valor estimado de la contratación a segmentar. */
  valorEstimado: number | null | undefined;
  /** true si la contratación ya está incluida en el PAC del ejercicio. */
  programada: boolean;
  /**
   * La propia contratación ya está incluida dentro de `otrasNoProgramadasASegmentar`
   * (por decisión de la entidad), así que NO se suma aparte como "Esta
   * contratación". Evita el doble conteo cuando su valor se registra en ese campo.
   */
  contratacionEnOtras?: boolean;
};

export type ParametrosSegmentacion = {
  /** PAC de bienes y servicios aprobado (monto inicial). */
  montoInicialPac: number;
  /** Σ de no programadas ya convocadas que integran el PAC vigente. */
  noProgramadasConvocadas: number;
  /** Σ de otras no programadas segmentadas en el mismo acto. */
  otrasNoProgramadasASegmentar: number;
  /** Monto de la contratación evaluada que se suma: 0 si ya está programada. */
  nuevaContratacion: number;
  /** Suma de todos los sumandos anteriores: base del 10%. */
  montoActualizado: number;
  /** 10% del monto actualizado. */
  lineaCorte: number;
  /** Peso del valor estimado sobre el monto actualizado, en porcentaje. */
  porcentaje: number;
  /** true si el valor estimado supera la línea de corte. */
  cuantiaAlta: boolean;
  /** Valor estimado de la contratación evaluada. */
  valorEstimado: number;
};

function redondear2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Monto opcional a número: ausente, negativo o no numérico ⇒ 0. */
function sumando(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Calcula la línea de corte y la cuantía de una contratación de bienes y
 * servicios. Devuelve `null` cuando faltan datos para operar (PAC no
 * registrado en Configuración o contratación sin valor estimado): en ese caso
 * la cuantía debe determinarse manualmente.
 */
export function calcularParametrosSegmentacion(
  input: ParametrosSegmentacionInput,
): ParametrosSegmentacion | null {
  const pac = Number(input.pacBienesServicios);
  const valor = Number(input.valorEstimado);
  if (!Number.isFinite(pac) || pac <= 0) return null;
  if (!Number.isFinite(valor) || valor <= 0) return null;

  const noProgramadasConvocadas = sumando(input.noProgramadasConvocadas);
  const otrasNoProgramadasASegmentar = sumando(input.otrasNoProgramadasASegmentar);
  // La contratación evaluada se suma como sumando propio SALVO que ya esté
  // considerada en la base: porque está programada (ya en el PAC) o porque la
  // entidad la registró dentro de "otras no programadas" (`contratacionEnOtras`).
  // En ambos casos sumarla otra vez la contaría dos veces.
  const nuevaContratacion = input.programada || input.contratacionEnOtras ? 0 : valor;

  const montoActualizado = redondear2(
    pac + noProgramadasConvocadas + otrasNoProgramadasASegmentar + nuevaContratacion,
  );
  const lineaCorte = redondear2(montoActualizado * PORCENTAJE_LINEA_CORTE);

  return {
    montoInicialPac: redondear2(pac),
    noProgramadasConvocadas: redondear2(noProgramadasConvocadas),
    otrasNoProgramadasASegmentar: redondear2(otrasNoProgramadasASegmentar),
    nuevaContratacion: redondear2(nuevaContratacion),
    montoActualizado,
    lineaCorte,
    porcentaje: redondear2((valor / montoActualizado) * 100),
    // "No supera el 10%" ⇒ baja cuantía. Igualar la línea NO la supera.
    cuantiaAlta: redondear2(valor) > lineaCorte,
    valorEstimado: redondear2(valor),
  };
}

/**
 * ¿La cuantía de A2 quedó SIN DETERMINAR? Cierto solo para bienes/servicios
 * cuando NO hay cálculo automático posible —falta el PAC o el valor estimado,
 * las mismas condiciones con que `calcularParametrosSegmentacion` devuelve
 * null— y el usuario TAMPOCO eligió alta/baja a mano (`cuantiaAlta` undefined).
 *
 * En ese estado la categoría se asume "baja" pero no es firme: de la cuantía
 * depende Rutinaria/Crítico (baja) vs Operacional/Estratégico (alta). Lo usan el
 * formulario (para avisar) y el panel (para impedir cerrar A2 en ese estado), de
 * modo que ambos apliquen exactamente la misma regla.
 */
export function cuantiaSegmentacionSinDeterminar(input: {
  objeto?: string;
  cuantiaAlta?: boolean;
  pacBienesServicios?: number | null;
  valorEstimado?: number | null;
}): boolean {
  if ((input.objeto ?? "bienes_servicios") !== "bienes_servicios") return false;
  const pac = Number(input.pacBienesServicios);
  const valor = Number(input.valorEstimado);
  const hayCalculo = Number.isFinite(pac) && pac > 0 && Number.isFinite(valor) && valor > 0;
  return !hayCalculo && input.cuantiaAlta === undefined;
}

/** Formatea un monto como "S/ 1,287,639.70". */
export function soles(value: number): string {
  return `S/ ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
