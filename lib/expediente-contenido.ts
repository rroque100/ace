// Contenido del expediente de contratación (Art. 54.2 y 54.3 del Reglamento).
//
// Esto NO es una regla de negocio inventada: el Art. 54.2 enumera literal por
// literal lo que el expediente contiene, y cada literal es el producto de un
// paso. Es decir, la norma escribe el grafo de dependencias de la Fase 1, y A8
// no es "el paso 8": es el paso que recoge A1, A3, A4, A5, A6 y A7.
//
//   54.3  → la necesidad prevista en el CMN               → A1
//   54.2.a → el requerimiento final, indicando si está
//            estandarizado                                → A3
//   54.2.b → la compatibilización, CUANDO CORRESPONDA     → no comprobable
//   54.2.c → la estrategia, que incluye la interacción
//            con el mercado realizada, SEGÚN CORRESPONDA  → A4 (+ A5)
//   54.2.d → la cuantía de la contratación                → A5 (Art. 47.1)
//   54.2.e → el documento de designación de evaluadores   → A6
//   54.2.f → la CCP y/o la previsión presupuestal         → A7
//   54.2.g → otra documentación necesaria                 → no comprobable
//
// Los literales con "de corresponder" / "según corresponda" no se exigen a
// ciegas: si el paso está marcado como "no aplica", eso es una decisión tomada y
// se respeta. Convertir un "según corresponda" en obligatorio sería inventarse
// una exigencia que la norma no hace.

import {
  CATEGORIA_SEGMENTACION_META,
  type CategoriaSegmentacion,
  clasificarSegmentacion,
  esProgramada,
  interaccionAlcanzaNivel,
  NIVEL_INTERACCION_META,
  nivelAlcanzadoA5,
  type ObjetoSegmentacion,
  type SegmentacionInput,
  type SegmentacionResultado,
} from "./actuaciones-preparatorias";
import type { HitosMap, HitoStatus } from "./procurement-fases";
import { calcularParametrosSegmentacion, soles } from "./segmentacion-parametros";

export type LiteralExpediente = {
  /** El literal exacto: "54.2.a", "54.3". Se enseña para que se pueda verificar. */
  literal: string;
  etiqueta: string;
  /** ¿Está en el expediente? */
  cumple: boolean;
  /** Qué falta, cuando no cumple. */
  detalle?: string;
  /** Paso que lo produce. */
  paso?: string;
  /** El paso se declaró no aplicable, y la norma lo permite aquí. */
  noAplica?: boolean;
};

/**
 * Monto que respalda la contratación según A7 (Art. 54.2.f). Con "ambas" —la
 * ejecución cruza años fiscales— la cobertura es la SUMA de la CCP (año en
 * curso) y la previsión (años siguientes); con un solo documento, su monto.
 */
export function montoA7(a7: Record<string, unknown>): number {
  if (a7.tipo === "ambas") {
    return (Number(a7.monto_ccp) || 0) + (Number(a7.monto_prevision) || 0);
  }
  return Number(a7.monto);
}

export const estado = (hitos: HitosMap, code: string): HitoStatus => hitos[code]?.status ?? "pendiente";
export const hecho = (hitos: HitosMap, code: string) => estado(hitos, code) === "hecho";
const noAplica = (hitos: HitosMap, code: string) => estado(hitos, code) === "na";

/** Segmentaciones en las que la matriz de riesgos (Art. 44.3) es requisito del expediente. */
const CATEGORIAS_MATRIZ_OBLIGATORIA: ReadonlySet<CategoriaSegmentacion> = new Set([
  "estrategico",
  "contratacion_avanzada",
]);

/**
 * Resultado de la segmentación del expediente reconstruido desde el paso A2, o
 * `null` si A2 aún no se ha rellenado. Lleva la categoría (para la matriz del
 * 44.3) y el nivel de interacción exigido (para el mínimo de A5).
 *
 * No se persiste: se recalcula al vuelo, igual que la torre de control
 * (`fase-panel.tsx`) y el informe de segmentación. Se reconstruye a mano en vez
 * de castear el JSONB para no confiar en la forma de datos antiguos.
 */
function segmentacionInput(hitos: HitosMap): SegmentacionInput | null {
  const a2 = hitos.A2?.data as Record<string, unknown> | undefined;
  if (!a2 || Object.keys(a2).length === 0) return null;
  const objeto: ObjetoSegmentacion =
    a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios";
  return {
    objeto,
    cuantiaAlta: Boolean(a2.cuantiaAlta),
    condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
    criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
    centralizada: Boolean(a2.centralizada),
    esIoarr: Boolean(a2.esIoarr),
  };
}

function resultadoSegmentacion(hitos: HitosMap): SegmentacionResultado | null {
  const input = segmentacionInput(hitos);
  return input ? clasificarSegmentacion(input) : null;
}

/**
 * Lo que el Art. 54.2 exige que contenga el expediente, contrastado con lo que
 * hay. `valorEstimado` es la cuantía del 54.2.d: la fija A5 (Art. 47.1) y se
 * guarda en el expediente.
 */
export function contenidoExpediente(
  hitos: HitosMap,
  valorEstimado: number | null,
  pacBienesServicios: number | null = null,
): LiteralExpediente[] {
  const items: LiteralExpediente[] = [];

  // 54.3: sin CMN no se puede aprobar. No es un literal del contenido, pero es
  // la condición para aprobarlo, así que se comprueba aquí.
  const a1 = (hitos.A1?.data ?? {}) as Record<string, unknown>;
  items.push({
    literal: "54.3",
    etiqueta: "La necesidad consta en el CMN",
    cumple: a1.en_cmn === true,
    detalle:
      a1.en_cmn === true
        ? undefined
        : "Para aprobar un expediente la necesidad debe estar prevista en el CMN aprobado del año fiscal o su modificatoria. Regístralo en A1.",
    paso: "A1",
  });

  const a3 = (hitos.A3?.data ?? {}) as Record<string, unknown>;
  // "indicando si se encuentra estandarizado": el 54.2.a pide las DOS cosas: el
  // requerimiento cerrado Y la declaración. Se declara con el select Sí/NO
  // ("si"/"no"); se acepta también el booleano de datos antiguos.
  const est = a3.estandarizado;
  const declaraEstandarizado = est === "si" || est === "no" || typeof est === "boolean";
  items.push({
    literal: "54.2.a",
    etiqueta: "Requerimiento final, indicando si está estandarizado",
    cumple: hecho(hitos, "A3") && declaraEstandarizado,
    detalle: !hecho(hitos, "A3")
      ? "El requerimiento (A3) todavía no está cerrado."
      : declaraEstandarizado
        ? undefined
        : "Falta declarar en A3 si el requerimiento está estandarizado: el 54.2.a lo pide expresamente.",
    paso: "A3",
  });

  // Art. 44.3: la matriz de gestión de riesgos y su asignación a las partes son
  // requisito del expediente cuando la segmentación (A2) es Estratégico o
  // Contratación Avanzada. En los demás cuadrantes —y mientras A2 no esté
  // segmentado— no se exige: el riesgo se gestiona en ejecución (Art. 66, 125.1,
  // 153.2). La categoría se deriva de A2, no de la ficha, porque solo ahí se
  // conoce (depende de la cuantía que fija A5).
  const seg = resultadoSegmentacion(hitos);
  const categoria = seg?.categoria ?? null;
  const matrizObligatoria = categoria !== null && CATEGORIAS_MATRIZ_OBLIGATORIA.has(categoria);
  // Señal en A3: el campo dedicado de asignación (Art. 44.3), que la ficha siembra
  // desde `gestion_riesgos` para TODO objeto; o —de respaldo, para expedientes
  // derivados antes de ese cambio— la matriz que quedó en `condiciones_obra`.
  const asignacion = typeof a3.riesgos_asignacion === "string" ? a3.riesgos_asignacion.trim() : "";
  const condObra = typeof a3.condiciones_obra === "string" ? a3.condiciones_obra : "";
  const hayMatriz = asignacion.length > 0 || /gesti[óo]n de riesgos/i.test(condObra);
  const detalleMatriz =
    matrizObligatoria && !hayMatriz && categoria
      ? `Por tratarse de una contratación de categoría «${CATEGORIA_SEGMENTACION_META[categoria].label}», la matriz de gestión de riesgos y su asignación a las partes son obligatorias (Art. 44.3): complétalas en A3.`
      : undefined;
  items.push({
    literal: "44.3",
    etiqueta: "Matriz de gestión de riesgos y su asignación",
    cumple: !matrizObligatoria || hayMatriz,
    noAplica: !matrizObligatoria,
    detalle: detalleMatriz,
    paso: "A3",
  });

  items.push({
    literal: "54.2.c",
    etiqueta: "Estrategia de contratación",
    cumple: hecho(hitos, "A4"),
    detalle: hecho(hitos, "A4") ? undefined : "La estrategia (A4) todavía no está cerrada.",
    paso: "A4",
  });

  // "…que incluye la interacción con el mercado realizada, SEGÚN CORRESPONDA".
  // El Art. 101.1 excluye la interacción en los no competitivos: si A5 está
  // marcado "no aplica", eso es lo que corresponde.
  const a5Na = noAplica(hitos, "A5");
  items.push({
    literal: "54.2.c",
    etiqueta: "Interacción con el mercado realizada",
    cumple: hecho(hitos, "A5") || a5Na,
    noAplica: a5Na,
    detalle: hecho(hitos, "A5") || a5Na ? undefined : "La interacción con el mercado (A5) todavía no está cerrada.",
    paso: "A5",
  });

  // El nivel de interacción REALMENTE ejecutado en A5 debe alcanzar, como
  // mínimo, el que determina la segmentación (A2): no basta con que A5 esté
  // cerrado. El Art. 46.1.n manda que la estrategia confirme que la interacción
  // "alcanza como mínimo el nivel determinado en la segmentación"; el 48.3 lo
  // mide por nº de fuentes y el 49.2 por nº de herramientas. Marcar una sola
  // casilla cuando la categoría exige avanzada (2+) deja la interacción por
  // debajo de lo debido, y el resto del checklist no lo veía —solo comprobaba
  // que A5 estuviera cerrado—.
  //
  // Solo se exige cuando A2 está segmentado, A5 cerrado y la interacción no es
  // "no aplica" (los no competitivos del Art. 101.1 no interactúan: a5Na).
  const a5Data = (hitos.A5?.data ?? {}) as Record<string, unknown>;
  const nivelExigible = seg !== null && hecho(hitos, "A5") && !a5Na;
  const nivelSuficiente = !nivelExigible || interaccionAlcanzaNivel(a5Data, seg!.nivel);
  const nivelReal = nivelAlcanzadoA5(a5Data);
  items.push({
    literal: "46.1.n",
    etiqueta: "Nivel de interacción con el mercado suficiente (mínimo de A2)",
    cumple: nivelSuficiente,
    noAplica: !nivelExigible,
    detalle:
      nivelExigible && !nivelSuficiente && seg
        ? `La interacción ejecutada en A5 (${nivelReal ? NIVEL_INTERACCION_META[nivelReal].label : "sin fuentes ni herramientas marcadas"}) no alcanza el nivel que exige la segmentación (A2): ${seg.nivelLabel}. ${seg.nivelRequisito} Marca en A5 las fuentes (Art. 48.3) o herramientas (Art. 49.2) que correspondan.`
        : undefined,
    paso: "A5",
  });

  items.push({
    literal: "54.2.d",
    etiqueta: "Cuantía de la contratación",
    cumple: valorEstimado != null && valorEstimado > 0,
    detalle:
      valorEstimado != null && valorEstimado > 0
        ? undefined
        : "El expediente no tiene cuantía. La fija la interacción con el mercado (Art. 47.1): regístrala en A5.",
    paso: "A5",
  });

  const a6Na = noAplica(hitos, "A6");
  items.push({
    literal: "54.2.e",
    etiqueta: "Designación de evaluadores",
    cumple: hecho(hitos, "A6") || a6Na,
    noAplica: a6Na,
    detalle: hecho(hitos, "A6") || a6Na ? undefined : "Falta designar al evaluador (A6). Sin él, nadie puede elaborar las bases (Art. 55.1).",
    paso: "A6",
  });

  const a7 = (hitos.A7?.data ?? {}) as Record<string, unknown>;
  const montoCcp = montoA7(a7);
  const tieneMonto = Number.isFinite(montoCcp) && montoCcp > 0;
  // La certificación no basta con que exista: debe CUBRIR el valor estimado
  // (Art. 53: el crédito presupuestario respalda la contratación). La cobertura
  // solo se exige cuando ya hay cuantía —si falta, la bloquea el 54.2.d—; con
  // ejecución plurianual, `montoA7` ya suma CCP + previsión (tipo «ambas»). El
  // margen de medio céntimo evita falsos negativos por redondeo.
  const cuantia = valorEstimado != null && valorEstimado > 0 ? valorEstimado : null;
  const cubre = cuantia == null || montoCcp + 0.005 >= cuantia;
  items.push({
    literal: "54.2.f",
    etiqueta: "Certificación de crédito presupuestario o previsión",
    cumple: tieneMonto && cubre,
    detalle: !tieneMonto
      ? "Falta la certificación presupuestal o la previsión (A7)."
      : !cubre
        ? `La certificación de A7 (${soles(montoCcp)}) no cubre la cuantía de la contratación (${soles(cuantia!)}). El Art. 53 exige que el crédito presupuestario respalde la contratación; si la ejecución cruza años fiscales, usa CCP + previsión (tipo «ambas»).`
        : undefined,
    paso: "A7",
  });

  // Coherencia A2 ↔ A5 (GAP): la cuantía real de la interacción no puede
  // reclasificar la categoría con la que se segmentó. Si lo hace, la
  // segmentación registrada —y el nivel de interacción que exigió— ya no
  // corresponden, así que el expediente es incoherente y no debe aprobarse.
  //
  // Solo se comprueba en bienes/servicios (las obras no tienen línea de corte
  // por cuantía, Art. 153) y cuando hay PAC y cuantía para operar; en el resto
  // no aplica (no bloquea).
  const segInput = segmentacionInput(hitos);
  const params =
    segInput && segInput.objeto === "bienes_servicios" && cuantia != null
      ? calcularParametrosSegmentacion({
          pacBienesServicios,
          programada: esProgramada(a1),
          valorEstimado: cuantia,
        })
      : null;
  const registrada = segInput && params ? clasificarSegmentacion(segInput) : null;
  const real =
    segInput && params ? clasificarSegmentacion({ ...segInput, cuantiaAlta: params.cuantiaAlta }) : null;
  const reclasifica = registrada != null && real != null && real.categoria !== registrada.categoria;
  items.push({
    literal: "125.2",
    etiqueta: "Segmentación coherente con la cuantía real (A2 ↔ A5)",
    cumple: !reclasifica,
    noAplica: params == null,
    detalle:
      reclasifica && registrada && real
        ? `Con la cuantía real de A5 (${soles(cuantia!)}) la segmentación pasa de ${registrada.categoriaLabel} a ${real.categoriaLabel}, que exige ${real.nivelLabel.toLowerCase()}. Actualiza A2 (segmentación) y A5 (interacción) antes de aprobar el expediente.`
        : undefined,
    paso: "A2",
  });

  return items;
}

/** Lo que impide aprobar el expediente. Vacío = se puede aprobar. */
export function faltaParaAprobar(
  hitos: HitosMap,
  valorEstimado: number | null,
  pacBienesServicios: number | null = null,
): LiteralExpediente[] {
  return contenidoExpediente(hitos, valorEstimado, pacBienesServicios).filter((i) => !i.cumple);
}

export function puedeAprobarExpediente(
  hitos: HitosMap,
  valorEstimado: number | null,
  pacBienesServicios: number | null = null,
): boolean {
  return faltaParaAprobar(hitos, valorEstimado, pacBienesServicios).length === 0;
}
