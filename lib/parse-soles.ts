/**
 * Parsea un monto en formato de soles peruanos a número.
 *
 * Formato peruano: comas = miles, punto = decimales.
 *   "S/ 1,250,000.50" -> 1250000.50
 *   "1250,50"         -> 1250.50  (coma como decimal si no hay punto)
 *   "12,500"          -> 12500    (coma como miles)
 *
 * Retorna 0 si el string está vacío o no contiene dígitos.
 */
export function parseSoles(formatted: string): number {
  const cleaned = formatted.replace(/[^\d.,]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let digits: string;
  if (hasComma && hasDot) {
    digits = cleaned.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      digits = parts[0] + "." + parts[1];
    } else {
      digits = cleaned.replace(/,/g, "");
    }
  } else {
    digits = cleaned;
  }
  return digits ? parseFloat(digits) || 0 : 0;
}
