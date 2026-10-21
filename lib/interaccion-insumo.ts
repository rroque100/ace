// Insumo de la Interacción con el mercado (A5) hacia la Estrategia (A4).
//
// El Art. 47.1 dice que la interacción "sirve de insumo y forma parte de la
// estrategia de contratación", y el Art. 46.1 que la estrategia se analiza
// "considerando la información OBTENIDA en la interacción con el mercado". El
// Art. 48.1 lo repite: la indagación se hace "a fin de que dicha información
// sea considerada en la estrategia de contratación".
//
// La Guía lo deja aún más claro al desglosar cómo se elabora la estrategia:
//   1. Identificar variables clave del requerimiento.
//   2. Determinar insumos necesarios.
//   3. Recopilar información (INCLUYE INTERACCIÓN CON EL MERCADO).
//   4. Analizar y sustentar las variables.
//   5. Elaborar el formato de estrategia de contratación.
//
// Es decir: la interacción es el paso 3 DENTRO de la estrategia, no un paso
// posterior. Por eso A4 sigue mostrándose antes (es el paraguas, y así lo
// numeran el Reglamento y la Guía) pero no puede CERRARSE sin A5, y los
// resultados de A5 se ofrecen junto a las variables que los consumen.

import {
  clasificarSegmentacion,
  NIVEL_INTERACCION_META,
  NIVEL_ORDEN,
  type NivelInteraccion,
} from "./actuaciones-preparatorias";
import type { HitoStatus } from "./procurement-fases";

/**
 * n) Sustento normativo de la verificación del tipo de interacción (Art. 46.1.n).
 *
 * Se siembra en el campo n) como punto de partida editable. Tras la cita del
 * fundamento, resume —cada uno con su artículo— la categorización del objeto
 * (segmentación, paso A2) y el nivel de interacción, y cierra con el nivel
 * efectivamente realizado (paso A5). Los valores concretos VARÍAN según lo que
 * traigan A2 y A5; si aún no están, deja el hueco señalado. No reproduce el
 * articulado textualmente (parafrasea con la referencia); la DEC lo completa.
 */
export function sustentoNormativoN(
  a2Data: Record<string, unknown> | null | undefined,
  a5Data: Record<string, unknown> | null | undefined,
): string {
  const a2 = a2Data ?? null;
  const a5 = a5Data ?? {};

  const esObra = a2?.objeto === "obras_consultoria_obras";
  const artSegmentacion = esObra
    ? "artículos 42 y 153 del Reglamento"
    : "artículos 42 y 125 del Reglamento";

  const seg = a2
    ? clasificarSegmentacion({
        objeto: a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
        cuantiaAlta: Boolean(a2.cuantiaAlta),
        condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
        criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
        centralizada: Boolean(a2.centralizada),
      })
    : null;

  const nivelReal = typeof a5.nivel === "string" ? (a5.nivel as NivelInteraccion) : undefined;

  // B129 (numeral 127.2) sustenta SOLO la elección de un nivel de interacción MÁS
  // avanzado que el mínimo de la segmentación. Si el nivel realizado NO supera ese
  // mínimo, no corresponde —y el export escribe «NO CORRESPONDE» ignorando este
  // campo—, así que el punto de partida del frontend debe decir lo mismo, no un
  // sustento largo que no se va a usar.
  if (seg && nivelReal && NIVEL_ORDEN.indexOf(nivelReal) <= NIVEL_ORDEN.indexOf(seg.nivel)) {
    return "NO CORRESPONDE";
  }

  const catLinea = seg
    ? `- Categorización del objeto de la contratación (segmentación): ${seg.categoriaLabel}. Fundamento: ${artSegmentacion}.`
    : `- Categorización del objeto de la contratación (segmentación): [pendiente de registrar en el paso A2 · Segmentación]. Fundamento: ${artSegmentacion}.`;
  const nivelMinLinea = seg
    ? `- Nivel de interacción con el mercado determinado por la segmentación: ${seg.nivelLabel} (${seg.nivelRequisito}). Fundamento: artículos 48 al 50 del Reglamento.`
    : "- Nivel de interacción con el mercado determinado por la segmentación: [pendiente]. Fundamento: artículos 48 al 50 del Reglamento.";

  const metaReal = nivelReal ? NIVEL_INTERACCION_META[nivelReal] : undefined;
  const realizadoLinea = metaReal
    ? `Se realizó: ${metaReal.label}.`
    : "Se realizó: [registrar el nivel de interacción efectivamente ejecutado en el paso A5].";

  return [
    "De conformidad con el artículo 46.1.n del Reglamento de la Ley N° 32069, la estrategia de contratación verifica el tipo de interacción con el mercado realizada, confirmando que alcanza como mínimo el nivel determinado en la segmentación (paso A2), conforme al artículo 47 de la Ley N° 32069 y a los artículos 47 al 50 de su Reglamento.",
    "La categorización del objeto de la contratación y el nivel de interacción con el mercado se sustentan en lo siguiente:",
    catLinea,
    nivelMinLinea,
    realizadoLinea,
  ].join("\n\n");
}

/** Variables del Art. 46.1 que se sustentan con lo que produce la interacción. */
export const INSUMOS_A5_PARA_A4: ReadonlyArray<{ a4: string; label: string }> = [
  { a4: "var_k_financiamiento_cuantia", label: "actualización de la cuantía" },
  { a4: "var_n_tipo_interaccion", label: "tipo y nivel de interacción" },
  { a4: "var_s_objetivo", label: "riesgos y competencia del mercado" },
];

function texto(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Monto en soles, con el formato del resto de la Fase 1. */
function soles(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Resume lo capturado en A5 para cada variable de A4 que lo consume.
 *
 * Devuelve solo las entradas con contenido real: una variable sin insumo no
 * debe mostrar un aviso vacío, porque entonces el aviso deja de significar
 * nada y se ignora.
 */
export function insumosDeInteraccion(a5: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};

  // k) Fuente de financiamiento y actualización de la cuantía (Art. 46.1.k).
  const monto = soles(a5.cuantia_actualizada);
  const sustentoCuantia = texto(a5, "resultado_cuantia");
  const k = [monto ? `Cuantía actualizada: ${monto}` : "", sustentoCuantia].filter(Boolean).join(". ");
  if (k) out.var_k_financiamiento_cuantia = k;

  // n) Verificación del tipo de interacción con el mercado (Art. 46.1.n).
  const nivel = texto(a5, "nivel") as NivelInteraccion;
  const meta = NIVEL_INTERACCION_META[nivel];
  const fuentes = texto(a5, "fuentes");
  const herramientas = texto(a5, "herramientas");
  const n = [
    meta ? `Se realizó: ${meta.label}.` : "",
    fuentes ? `Fuentes: ${fuentes}` : "",
    herramientas ? `Herramientas: ${herramientas}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (n) out.var_n_tipo_interaccion = n;

  // s) Lo que afecta o impulsa el objetivo, incluida la gestión de riesgos
  // (Art. 46.1.s). La interacción mide "el riesgo de la frustración del
  // procedimiento de selección" y la competencia efectiva (Art. 47.1).
  const riesgos = texto(a5, "resultado_riesgos");
  const competencia = texto(a5, "resultado_competencia");
  const s = [
    riesgos ? `Riesgos detectados en el mercado: ${riesgos}` : "",
    competencia ? `Competencia: ${competencia}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  if (s) out.var_s_objetivo = s;

  return out;
}

/**
 * ¿Puede cerrarse la estrategia (A4)?
 *
 * No es que A4 vaya después de A5: es que su paso 4 (analizar y sustentar) y su
 * paso 5 (elaborar el formato) consumen el paso 3 (la interacción). Cerrar A4
 * con A5 pendiente equivale a sustentar las variables con información que aún
 * no se ha recogido.
 *
 * Solo bloquea el cierre, no la edición: el Art. 46.2 dice que la estrategia
 * "puede variarse hasta antes de la aprobación del expediente", así que ir
 * redactándola en paralelo a la interacción es exactamente lo previsto.
 */
// `na` es un cierre legítimo: el Art. 101.1 excluye la interacción con el
// mercado en los procedimientos de selección NO COMPETITIVOS, y tampoco se
// realiza en contratos menores ni en catálogos electrónicos de acuerdo marco.
export function puedeCerrarEstrategia(statusA5: HitoStatus | undefined): boolean {
  return statusA5 === "hecho" || statusA5 === "na";
}
