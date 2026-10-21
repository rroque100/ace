/**
 * Rango de cuantía de la "Licitación Pública abreviada para bienes".
 *
 * La modalidad abreviada depende de la cuantía, pero el umbral NO está en la
 * norma publicada (los Arts. 93-95 remiten a una tabla web); es un dato anual que
 * la entidad registra en Configuración. Este módulo solo clasifica una cuantía
 * contra ese rango —igual que `umbral-contrato-menor.ts` hace con las 8 UIT—, sin
 * decidir por el usuario.
 *
 * Sirve para los requerimientos por relación de ítems: un ítem cuya cuantía cae
 * en esta banda "corresponde a una LP abreviada de bienes", y por eso el
 * requisito de experiencia del postor se redacta por ítem.
 */

export type RangoLpAbreviada = {
  /** Cuantía mínima de la banda (soles), o `null` si no está registrada. */
  min: number | null;
  /** Cuantía máxima de la banda (soles), o `null` si no está registrada. */
  max: number | null;
};

/** ¿Está el rango completo (ambos extremos numéricos y coherentes)? */
export function rangoLpAbreviadaConfigurado(rango: RangoLpAbreviada | null | undefined): boolean {
  if (!rango) return false;
  const { min, max } = rango;
  return (
    typeof min === "number" &&
    Number.isFinite(min) &&
    typeof max === "number" &&
    Number.isFinite(max) &&
    max >= min
  );
}

/**
 * ¿La cuantía cae en la banda de la LP abreviada para bienes?
 *
 * Devuelve `null` cuando el rango no está configurado —"no se sabe", distinto de
 * "no cae"—, mismo criterio que el resto de umbrales anuales.
 */
export function enRangoLpAbreviadaBienes(
  cuantia: number | null | undefined,
  rango: RangoLpAbreviada | null | undefined,
): boolean | null {
  if (!rangoLpAbreviadaConfigurado(rango)) return null;
  if (typeof cuantia !== "number" || !Number.isFinite(cuantia)) return false;
  return cuantia >= rango!.min! && cuantia <= rango!.max!;
}
