// Orden por recencia de las fuentes del chat.
//
// Regla de negocio: dentro de un mismo rango normativo (ley, reglamento,
// directiva…) se prefiere lo más reciente. La jerarquía sigue mandando: una
// opinión de 2026 no pasa por delante de una ley de 2024. Y la recencia no
// compra relevancia: solo desempata entre fuentes que ya responden igual de
// bien, por eso se compara por TRAMOS de calidad de evidencia y no por el valor
// exacto (que además se satura en 1,0). Así un fragmento reciente pero apenas
// relacionado no desplaza a uno antiguo que sí contiene la respuesta.
//
// De dónde sale «lo reciente». El campo `year` de los metadatos NO sirve solo:
// medido en producción, casi todo figura como 2026 (parece el año fiscal de la
// carga), incluso el Reglamento 009-2025-EF (2025) y la Ley 32069 (2024), y la
// Ley 27444 (de 2001) también como 2026. Se usan señales más fiables, por orden:
//  1. Leyes: el propio número. La numeración de las leyes peruanas es correlativa
//     en el tiempo (27444 < 30225 < 32069 < 32187).
//  2. El año que va dentro del número del documento (013-2025-OECE-CD,
//     002-2025/TCP, D000112-2026-OECE-DTN, 009-2025-EF): coincidía con la
//     realidad en los 56 documentos de esos tipos que lo traen, salvo donde
//     `year` estaba mal.
//  3. Como último recurso, `year` de los metadatos.
// Es una ordenación aproximada: no acredita vigencia ni derogación.

export type RecencySource = {
  documentType: string;
  documentNumber?: string | null;
  year?: number | null;
  evidenceQuality: number;
};

/** Año incrustado en un número de documento: «…-2025-…», «…/2024», «D000112-2026…». */
export function yearFromDocumentNumber(documentNumber: string | null | undefined): number | null {
  const match = (documentNumber ?? "").match(/(?:^|[^\d])(20\d{2})(?!\d)/);
  return match ? Number(match[1]) : null;
}

/**
 * Clave de recencia: número mayor = más reciente. Las leyes se ordenan entre sí
 * por su número (la escala solo se compara con otras leyes: la jerarquía las
 * separa de los demás tipos antes de llegar aquí).
 */
export function recencyKey(source: Omit<RecencySource, "evidenceQuality">): number | null {
  if (source.documentType === "ley") {
    const lawNumber = (source.documentNumber ?? "").match(/\d{3,6}/)?.[0];
    if (lawNumber) return Number(lawNumber);
  }
  return yearFromDocumentNumber(source.documentNumber) ?? source.year ?? null;
}

/** Tramo de calidad 0-10: las diferencias menores a ~0,1 se consideran empate. */
export function qualityBucket(quality: number): number {
  return Math.round(Math.min(1, Math.max(0, quality)) * 10);
}

/**
 * Comparador: mejor tramo de calidad primero; a igual tramo, lo más reciente
 * primero; sin clave de recencia, al final de su tramo. Devuelve 0 si empatan
 * (el llamador aplica su propio desempate).
 */
export function compareByQualityThenRecency(a: RecencySource, b: RecencySource): number {
  const bucketDelta = qualityBucket(b.evidenceQuality) - qualityBucket(a.evidenceQuality);
  if (bucketDelta !== 0) return bucketDelta;
  return (recencyKey(b) ?? 0) - (recencyKey(a) ?? 0);
}
