/**
 * Apartado f) del requerimiento: OTRAS penalidades, además de la de mora.
 *
 * El modelo del OECE trae un cuadro de tres columnas —supuesto de aplicación,
 * forma de cálculo y procedimiento de verificación— y dos advertencias que no
 * son decorativas:
 *
 *   Art. 119.1 — el contrato establece la penalidad por mora Y otras penalidades
 *                ante el incumplimiento injustificado.
 *   Art. 119.2 — la suma de TODAS (mora incluida) no puede exceder el 10% del
 *                monto vigente del contrato o, de ser el caso, del ítem.
 *
 * Y el propio modelo añade una condición de fondo: las otras penalidades las
 * propone el área usuaria y se validan en la estrategia de contratación; deben
 * ser objetivas, razonables, congruentes y proporcionales con el objeto, sin
 * afectar el equilibrio económico financiero del contrato.
 *
 * Es OPCIONAL: un requerimiento sin otras penalidades es válido, y por eso sin
 * filas no se compone nada. Si se dejara el párrafo introductorio suelto, el
 * documento anunciaría un cuadro que no existe.
 *
 * Se guarda en la misma columna de texto que ya existía. El editor compone al
 * escribir y vuelve a leer al abrir, igual que el cuadro de instituciones
 * arbitrales: sin migración y exportable tal cual al Word.
 */

export type OtraPenalidad = {
  /** Supuesto de aplicación: qué incumplimiento la activa. */
  supuesto: string;
  /** Forma de cálculo: cómo se cuantifica. */
  calculo: string;
  /** Procedimiento de verificación: cómo se acredita que ocurrió. */
  verificacion: string;
};

const INTRO = "Adicionalmente a la penalidad por mora, se aplican las siguientes penalidades:";

/** Art. 119.2, literal. No se deja a criterio de quien redacta. */
export const TOPE_PENALIDADES =
  "La suma de la aplicación de las penalidades por mora y otras penalidades no debe exceder " +
  "el 10% del monto vigente del contrato o, de ser el caso, del ítem correspondiente " +
  "(Art. 119.2 del Reglamento).";

// Etiquetas explícitas en vez de un separador suelto: son tres campos, un texto
// libre puede traer guiones, y así la línea sigue leyéndose en el Word.
const LINEA = /^\s*\d+\.\s*Supuesto:\s*(.+?)\s*·\s*Cálculo:\s*(.*?)\s*·\s*Verificación:\s*(.*?)\s*$/;

export function parseOtrasPenalidades(texto: string | null | undefined): OtraPenalidad[] {
  if (!texto) return [];
  const salida: OtraPenalidad[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(LINEA);
    if (!m) continue;
    const supuesto = m[1].trim();
    if (supuesto) salida.push({ calculo: m[2].trim(), supuesto, verificacion: m[3].trim() });
  }
  return salida;
}

/**
 * Texto que acompañaba al apartado, sin el cuadro ni las frases fijas.
 *
 * Aquí vive lo que el modelo exige precisar y no cabe en el cuadro: el plazo y
 * la forma en que se notifica al contratista el supuesto incurrido para que
 * remita sus descargos, y el plazo en que la entidad los evalúa y decide.
 */
export function textoLibrePenalidades(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .split(/\r?\n/)
    .filter((l) => !LINEA.test(l))
    .filter((l) => l.trim() !== INTRO && l.trim() !== TOPE_PENALIDADES)
    .join("\n")
    .trim();
}

/** Operación inversa de `parseOtrasPenalidades`. El par debe seguir siendo reversible. */
export function componerOtrasPenalidades(filas: OtraPenalidad[], textoLibre = ""): string {
  const utiles = filas.filter((f) => f.supuesto.trim());
  const libre = textoLibre.trim();

  // Sin supuestos no hay apartado: es opcional y no debe anunciarse un cuadro
  // vacío. Si hay texto libre, se conserva solo.
  if (utiles.length === 0) return libre;

  const partes = [INTRO, ""];
  utiles.forEach((f, k) => {
    partes.push(
      `${k + 1}. Supuesto: ${f.supuesto.trim()} · Cálculo: ${f.calculo.trim() || "[POR DEFINIR]"} · ` +
        `Verificación: ${f.verificacion.trim() || "[POR DEFINIR]"}`,
    );
  });
  partes.push("", TOPE_PENALIDADES);
  if (libre) partes.push("", libre);
  return partes.join("\n");
}

/**
 * Filas a medio declarar: tienen supuesto pero les falta cálculo o verificación.
 *
 * No bloquea —el apartado es opcional—, pero una penalidad sin forma de cálculo
 * no se puede aplicar, y sin procedimiento de verificación no se puede acreditar.
 */
export function penalidadesIncompletas(filas: OtraPenalidad[]): number[] {
  return filas
    .map((f, i) => (f.supuesto.trim() && !(f.calculo.trim() && f.verificacion.trim()) ? i + 1 : 0))
    .filter((n) => n > 0);
}
