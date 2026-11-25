// Del contenido del campo «Gestión de riesgos» (Art. 44.3), la VISTA PREVIA
// muestra solo la MATRIZ —desde el encabezado «MATRIZ DE GESTIÓN DE RIESGOS»—,
// no el párrafo de sustento introductorio que el copiloto redacta antes. Esa
// prosa pertenece al campo (y al Word), pero en una vista que se titula «vista
// previa de la matriz» solo estorba.

const ENCABEZADO_MATRIZ = /MATRIZ DE GESTI[ÓO]N DE RIESGOS/i;

/** Normaliza la exposición de las filas redactadas con la escala propuesta. */
export function calcularExposicionMatriz(texto: string): string {
  return texto.replace(
    /^(\|[^|\n]*\|[^|\n]*\|\s*)P\s*([1-3])\s*×\s*I\s*([1-3])[^|\n]*(?=\|)/gm,
    (_celda, prefijo: string, p: string, i: string) => {
      const valor = Number(p) * Number(i);
      const nivel = valor <= 2 ? "Baja" : valor <= 4 ? "Media" : "Alta";
      return `${prefijo}P${p} × I${i} = ${valor} · ${nivel} `;
    },
  );
}

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
