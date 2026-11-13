/**
 * Fórmulas que la extracción de texto de los PDF dejó planas. En el PDF la penalidad diaria por mora es una fracción
 * (0.10 × monto arriba, F × plazo abajo) y el texto indexado la trae en una línea sin la raya: «Penalidad diaria = 0.10 x monto
 * F x plazo». El modelo la copiaba tal cual y la respuesta del chat se leía como una multiplicación (medido en producción el
 * 2026-11-12: «¿cómo se calcula lo que se descuenta por 10 días de retraso?»). Algunas opiniones traen además palabras partidas
 * por el OCR («m onto», «p lazo»).
 *
 * Solo se reescribe esta forma exacta: no se reinterpreta ninguna otra fórmula. Las cifras no cambian, así que la comprobación
 * de citas (citation-faithfulness) las sigue encontrando.
 */
const PENALIDAD_DIARIA = /(Penalidad\s+[Dd]iaria\s*=\s*)(0[.,]10)\s*[x×]\s*m\s?onto\s+F\s*[x×]\s*p\s?lazo/g;

export function restaurarFormulas(texto: string): string {
  if (!texto || !/enalidad/.test(texto)) return texto;
  return texto.replace(PENALIDAD_DIARIA, (_, inicio: string, factor: string) => `${inicio}(${factor} x monto) / (F x plazo)`);
}
