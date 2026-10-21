/**
 * Calificaciones del personal clave · FORMACIÓN ACADÉMICA (Art. 72.3.b, C.2.1).
 *
 * Puede exigirse a VARIOS puestos —un ingeniero, un especialista…—, cada uno con
 * su grado o título. Por eso es una LISTA, no un texto suelto, y en el
 * requerimiento sale como un cuadro. El texto de cada requisito se compone con el
 * grado y el puesto de su fila.
 *
 * Se guarda serializado en una sola columna, con parse/format reversibles, igual
 * que el cuadro del personal clave o «otras penalidades».
 *
 * Aviso del propio formato: como requisito de calificación solo cabe exigir el
 * GRADO o el TÍTULO, no cursos, diplomados ni especializaciones.
 */

/**
 * Cómo se acredita la formación académica del personal clave, texto literal de
 * las bases estándar de servicios. Es fijo: acompaña al cuadro de formación.
 */
export const ACREDITACION_FORMACION_ACADEMICA = [
  "El postor debe señalar los nombres y apellidos, documento de identidad, el nombre de la universidad o institución educativa que expidió el grado de título profesional, y el grado o título profesional obtenido en el Anexo N° 19, adjuntando en su oferta copia del grado de bachiller o título profesional. En caso se acredite estudios en el extranjero del personal clave, debe presentarse, adicionalmente, copia simple de la revalidación o reconocimiento del grado o título ante la SUNEDU.",
  "Los evaluadores o la DEC, según corresponda, verifican los grados o títulos profesionales en el Registro Nacional de Grados Académicos y Títulos Profesionales de la Superintendencia Nacional de Educación Superior Universitaria – SUNEDU, a través del siguiente link: https://enlinea.sunedu.gob.pe/ o en el Registro Nacional de Certificados, Grados y Títulos del Ministerio de Educación, a través del siguiente link: https://titulosinstitutos.minedu.gob.pe/ según corresponda.",
].join("\n\n");

const HUECO_GRADO =
  "CONSIGNAR EL GRADO DE BACHILLER O TÍTULO PROFESIONAL REQUERIDO, CONSIDERANDO LOS NIVELES " +
  "ESTABLECIDOS POR LA NORMATIVA EN LA MATERIA";
const HUECO_PUESTO =
  "CONSIGNAR EL PERSONAL CLAVE REQUERIDO PARA EJECUTAR LA PRESTACIÓN OBJETO DE LA CONVOCATORIA " +
  "DEL CUAL DEBE ACREDITARSE ESTE REQUISITO";

const CONECTOR = " del personal clave requerido como ";

export type FilaFormacion = {
  /**
   * Actividad. Se copia del cuadro de «Experiencia del personal clave» —es el
   * mismo personal—, así que aquí no se escribe: se hereda por fila.
   */
  actividad: string;
  /** Grado de bachiller o título profesional requerido. */
  grado: string;
  /** Puesto del personal clave del que debe acreditarse. */
  puesto: string;
};

/** Una fila vacía. */
export const FILA_FORMACION_VACIA: FilaFormacion = { actividad: "", grado: "", puesto: "" };

function hueco(valor: string, textoOriginal: string): string {
  return valor.trim() || `[${textoOriginal}]`;
}

/** El texto del requisito de UNA fila: «{grado} del personal clave requerido como {puesto}.». */
export function componerRequisitoFormacion(f: Partial<FilaFormacion>): string {
  return `${hueco(f.grado ?? "", HUECO_GRADO)}${CONECTOR}${hueco(f.puesto ?? "", HUECO_PUESTO)}.`;
}

// Etiquetas explícitas: son textos libres que pueden traer guiones o puntos, y
// así la línea se sigue leyendo si alguien abre la columna a mano.
const LINEA = /^\s*\d+\.\s*Actividad:\s*(.*?)\s*·\s*Grado:\s*(.*?)\s*·\s*Puesto:\s*(.*?)\s*$/;

function algoEscrito(f: FilaFormacion): boolean {
  return Boolean(f.actividad.trim() || f.grado.trim() || f.puesto.trim());
}

export function parseFilasFormacion(texto: string | null | undefined): FilaFormacion[] {
  if (!texto) return [];
  const salida: FilaFormacion[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(LINEA);
    if (!m) continue;
    const fila = { actividad: m[1].trim(), grado: m[2].trim(), puesto: m[3].trim() };
    if (algoEscrito(fila)) salida.push(fila);
  }
  return salida;
}

/** Operación inversa de `parseFilasFormacion`. El par debe seguir siendo reversible. */
export function formatFilasFormacion(filas: FilaFormacion[]): string {
  const utiles = filas.filter(algoEscrito);
  if (utiles.length === 0) return "";
  const g = (v: string) => v.trim() || "[POR DEFINIR]";
  return utiles
    .map((f, k) => `${k + 1}. Actividad: ${g(f.actividad)} · Grado: ${g(f.grado)} · Puesto: ${g(f.puesto)}`)
    .join("\n");
}

/**
 * Filas a medio declarar: falta el grado o el puesto.
 *
 * La actividad NO cuenta como «empezada»: viene heredada del cuadro de
 * experiencia, así que una fila con solo la actividad puesta aún no se ha
 * tocado. Si contara, todas las filas heredadas saldrían marcadas al aparecer.
 */
export function formacionIncompletas(filas: FilaFormacion[]): number[] {
  return filas
    .map((f, i) => {
      const empezado = f.grado.trim() || f.puesto.trim();
      const lleno = f.grado.trim() && f.puesto.trim();
      return empezado && !lleno ? i + 1 : 0;
    })
    .filter((n) => n > 0);
}
