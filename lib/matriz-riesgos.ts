// Del contenido del campo «Gestión de riesgos» (Art. 44.3), la VISTA PREVIA
// muestra solo la MATRIZ —desde el encabezado «MATRIZ DE GESTIÓN DE RIESGOS»—,
// no el párrafo de sustento introductorio que el copiloto redacta antes. Esa
// prosa pertenece al campo (y al Word), pero en una vista que se titula «vista
// previa de la matriz» solo estorba.

const ENCABEZADO_MATRIZ = /MATRIZ DE GESTI[ÓO]N DE RIESGOS/i;

export const COLUMNAS_MATRIZ = [
  "Categoría", "Identificación del riesgo", "Evaluación P × I", "Asignación",
  "Mitigación", "Penalidad", "Sustento TDR", "Sustento normativo",
  "Indicador", "Evidencia", "Acción pendiente", "Responsable de seguimiento",
] as const;

const celdas = (linea: string) => linea.trim().slice(1, -1).split("|").map((celda) => celda.trim());

export function filasMatriz(texto: string) {
  const lineas = texto.split(/\r?\n/);
  const encabezado = lineas.findIndex((linea) =>
    celdas(linea).map((celda) => celda.toLowerCase()).join("|") === COLUMNAS_MATRIZ.join("|").toLowerCase(),
  );
  if (encabezado < 0 || !/^\s*\|(?:\s*:?-+:?\s*\|){12}\s*$/.test(lineas[encabezado + 1] ?? "")) return [];
  const filas: Array<{ indice: number; valores: string[] }> = [];
  for (let indice = encabezado + 2; /^\s*\|/.test(lineas[indice] ?? ""); indice++) {
    filas.push({ indice, valores: celdas(lineas[indice]) });
  }
  return filas;
}

export function adjuntoFuenteMatriz(texto: string): string | undefined {
  return texto.match(/^Identificador del adjunto:\s*([\da-f-]{36})\s*$/im)?.[1];
}

export function actualizarSeguimientoMatriz(texto: string, indice: number, columna: number, valor: string): string {
  const fila = filasMatriz(texto).find((item) => item.indice === indice);
  if (!fila || fila.valores.length !== COLUMNAS_MATRIZ.length || columna < 8 || columna > 11) return texto;
  const lineas = texto.split(/\r?\n/);
  fila.valores[columna] = valor.replace(/[|\r\n]/g, " ") || "—";
  lineas[indice] = `| ${fila.valores.join(" | ")} |`;
  return lineas.join("\n");
}

export function revisarMatrizGenerada(texto: string, cantidadFuentes: number, textoAdjunto: string): string[] {
  const filas = filasMatriz(texto);
  if (!filas.length) return ["Falta la tabla de riesgos con las columnas requeridas."];
  const normalizar = (texto: string) => texto.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const adjunto = normalizar(textoAdjunto);
  return filas.flatMap(({ valores }, indice) => {
    const errores: string[] = [];
    if (valores.length !== COLUMNAS_MATRIZ.length || valores.some((valor) => !valor || valor === "—")) {
      errores.push("hay columnas vacías o mal formadas");
    }
    if (!/^P[1-3]\s*×\s*I[1-3](?!\d)/i.test(valores[2] ?? "")) errores.push("P e I deben estar entre 1 y 3");
    const norma = valores[7] ?? "";
    const referencias = [...norma.matchAll(/\[F(\d+)\]/g)];
    if (!referencias.length || referencias.some(([, numero]) => Number(numero) < 1 || Number(numero) > cantidadFuentes)) {
      errores.push("falta una referencia válida al RAG");
    }
    const citaTdr = valores[6]?.match(/[«“"]([^»”"]{12,})[»”"]/)?.[1];
    if (!citaTdr || !adjunto.includes(normalizar(citaTdr))) errores.push("la cita del adjunto no pudo comprobarse");
    const penalidad = valores[5] ?? "";
    if (!/^(?:por verificar|no aplica)\.?$/i.test(penalidad)) {
      const obligacion = penalidad.match(/^Supuesto: .+ · Obligación: .*[«“"]([^»”"]{12,})[»”"].* · Evidencia: .+$/i)?.[1];
      if (!obligacion || !adjunto.includes(normalizar(obligacion))) {
        errores.push("la penalidad requiere supuesto, cita de la obligación en el adjunto y evidencia");
      }
    }
    return errores.length ? [`Fila ${indice + 1}: ${errores.join(", ")}.`] : [];
  });
}

/** Normaliza la exposición de las filas redactadas con la escala propuesta. */
export function calcularExposicionMatriz(texto: string): string {
  return texto.replace(
    /^(\|[^|\n]*\|[^|\n]*\|\s*)P\s*([1-3])\s*×\s*I\s*([1-3])(?!\d)[^|\n]*(?=\|)/gim,
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
