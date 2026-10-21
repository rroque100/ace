// Del contenido del campo «Gestión de riesgos» (Art. 44.3), la VISTA PREVIA
// muestra solo la MATRIZ —desde el encabezado «MATRIZ DE GESTIÓN DE RIESGOS»—,
// no el párrafo de sustento introductorio que el copiloto redacta antes. Esa
// prosa pertenece al campo (y al Word), pero en una vista que se titula «vista
// previa de la matriz» solo estorba.

const ENCABEZADO_MATRIZ = /MATRIZ DE GESTI[ÓO]N DE RIESGOS/i;

/**
 * Devuelve el texto desde el encabezado «MATRIZ DE GESTIÓN DE RIESGOS» (incluido).
 *
 * Si el encabezado no aparece —una matriz escrita a mano sin él, u otro
 * contenido— devuelve el texto completo: sin referencia no se puede recortar, y
 * mostrarlo entero es mejor que dejar la vista en blanco.
 */
export function desdeMatrizRiesgos(texto: string | null | undefined): string {
  const t = texto ?? "";
  const m = t.match(ENCABEZADO_MATRIZ);
  return m && m.index !== undefined ? t.slice(m.index) : t;
}
