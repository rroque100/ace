/**
 * Calificaciones del personal clave · CAPACITACION (Art. 72.3.b).
 *
 * Puede exigirse a VARIOS puestos, cada uno con sus horas y su materia. Por eso
 * es una LISTA, no un texto suelto, y en el requerimiento sale como un cuadro. El
 * texto de cada requisito se compone con las horas, la materia y el puesto de su
 * fila. Se guarda serializado en una sola columna, con parse/format reversibles,
 * igual que Formacion academica.
 *
 * Aviso del propio formato: la capacitacion se exige hasta un MAXIMO de 120 horas.
 */

/**
 * Como se acredita la capacitacion del personal clave, texto literal del formato
 * OECE (Concurso Publico de servicios). Las tres advertencias van en vinetas: el
 * Word convierte las lineas que empiezan por «- » en bullets.
 */
export const ACREDITACION_CAPACITACION = [
  "Se acredita con copia simple de [CONSIGNAR CONSTANCIAS, CERTIFICADOS U OTROS DOCUMENTOS, SEGÚN CORRESPONDA].",
  "",
  "Advertencia:",
  "- Las horas indicadas pueden ser lectivas, académicas y/o pedagógicas sin distinción entre estas.",
  "- Al evaluar la incorporación de este requisito, la entidad contratante debe sustentar que el tipo de capacitación seleccionado se encuentre vinculado con las actividades que va a desempeñar el personal clave.",
  "- Se podrá acreditar la capacitación mediante certificados de estudios de postgrado, considerando que cada crédito del curso que acredita la capacitación equivale a dieciséis horas, según la normativa de la materia.",
].join("\n");

const HUECO_HORAS = "CONSIGNAR LA CANTIDAD DE HORAS, HASTA UN MAXIMO DE 120";
const HUECO_MATERIA =
  "CONSIGNAR LA MATERIA O AREA DE CAPACITACION, LA CUAL DEBE ESTAR ESPECIFICAMENTE RELACIONADA CON " +
  "LAS ACTIVIDADES QUE REALIZARA EL PERSONAL CLAVE";
const HUECO_PUESTO =
  "CONSIGNAR EL PERSONAL CLAVE REQUERIDO PARA EJECUTAR LA PRESTACION OBJETO DE LA CONVOCATORIA " +
  "RESPECTO DEL CUAL SE DEBE ACREDITAR ESTE REQUISITO";

const CONECTOR = " del personal clave requerido como ";

export type FilaCapacitacion = {
  /** Actividad. Se hereda del cuadro de experiencia del personal clave. */
  actividad: string;
  /** Cantidad de horas de capacitacion (hasta 120). */
  horas: string;
  /** Materia o area de la capacitacion. */
  materia: string;
  /** Puesto del personal clave del que debe acreditarse. */
  puesto: string;
};

export const FILA_CAPACITACION_VACIA: FilaCapacitacion = { actividad: "", horas: "", materia: "", puesto: "" };

function hueco(valor: string, textoOriginal: string): string {
  return valor.trim() || `[${textoOriginal}]`;
}

/** El texto del requisito de UNA fila: «{horas} horas en {materia} del personal clave requerido como {puesto}.». */
export function componerRequisitoCapacitacion(f: Partial<FilaCapacitacion>): string {
  return `${hueco(f.horas ?? "", HUECO_HORAS)} horas en ${hueco(f.materia ?? "", HUECO_MATERIA)}${CONECTOR}${hueco(
    f.puesto ?? "",
    HUECO_PUESTO,
  )}.`;
}

// Etiquetas explicitas: son textos libres que pueden traer guiones o puntos, y
// asi la linea se sigue leyendo si alguien abre la columna a mano.
const LINEA =
  /^\s*\d+\.\s*Actividad:\s*(.*?)\s*·\s*Horas:\s*(.*?)\s*·\s*Materia:\s*(.*?)\s*·\s*Puesto:\s*(.*?)\s*$/;

function algoEscrito(f: FilaCapacitacion): boolean {
  return Boolean(f.actividad.trim() || f.horas.trim() || f.materia.trim() || f.puesto.trim());
}

export function parseFilasCapacitacion(texto: string | null | undefined): FilaCapacitacion[] {
  if (!texto) return [];
  // «[POR DEFINIR]» es el marcador que `formatFilasCapacitacion` deja en un hueco
  // al serializar: al LEER vuelve a ser vacio, para que no se muestre como si
  // fuera un dato —ni en el editor ni en el Word— y en su lugar salga el hueco
  // guia del formato OECE (que compone `componerRequisitoCapacitacion`).
  const dato = (v: string) => {
    const t = v.trim();
    return t === "[POR DEFINIR]" ? "" : t;
  };
  const salida: FilaCapacitacion[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(LINEA);
    if (!m) continue;
    const fila = { actividad: dato(m[1]), horas: dato(m[2]), materia: dato(m[3]), puesto: dato(m[4]) };
    if (algoEscrito(fila)) salida.push(fila);
  }
  return salida;
}

/** Operacion inversa de `parseFilasCapacitacion`. El par debe seguir siendo reversible. */
export function formatFilasCapacitacion(filas: FilaCapacitacion[]): string {
  const utiles = filas.filter(algoEscrito);
  if (utiles.length === 0) return "";
  const g = (v: string) => v.trim() || "[POR DEFINIR]";
  return utiles
    .map(
      (f, k) =>
        `${k + 1}. Actividad: ${g(f.actividad)} · Horas: ${g(f.horas)} · Materia: ${g(f.materia)} · Puesto: ${g(
          f.puesto,
        )}`,
    )
    .join("\n");
}

/**
 * Filas a medio declarar: falta horas, materia o puesto.
 *
 * La actividad NO cuenta como «empezada»: viene heredada del cuadro de
 * experiencia, así que una fila con solo la actividad puesta es una fila que aún
 * no se ha tocado, no una a medias. Si contara, TODAS las filas heredadas
 * saldrían marcadas nada más aparecer, antes de escribir nada.
 */
export function capacitacionIncompletas(filas: FilaCapacitacion[]): number[] {
  return filas
    .map((f, i) => {
      const empezado = f.horas.trim() || f.materia.trim() || f.puesto.trim();
      const lleno = f.horas.trim() && f.materia.trim() && f.puesto.trim();
      return empezado && !lleno ? i + 1 : 0;
    })
    .filter((n) => n > 0);
}

/** Filas cuyas horas superan el tope de 120 del formato. Alimenta el aviso suave. */
export function capacitacionExcedeHoras(filas: FilaCapacitacion[]): number[] {
  return filas
    .map((f, i) => {
      const n = Number(f.horas);
      return Number.isFinite(n) && n > 120 ? i + 1 : 0;
    })
    .filter((n) => n > 0);
}

/**
 * ¿La fila aporta un requisito de capacitacion?
 *
 * La actividad viene HEREDADA del cuadro de experiencia, asi que no cuenta: para
 * que haya requisito hace falta al menos horas, materia o puesto. El «[POR
 * DEFINIR]» que `formatFilasCapacitacion` deja en los huecos es un marcador, no
 * un dato, asi que tambien cuenta como vacio.
 */
function esRequisitoCapacitacion(f: FilaCapacitacion): boolean {
  // `parseFilasCapacitacion` ya normaliza «[POR DEFINIR]» a vacio, asi que basta
  // comprobar que haya contenido en horas, materia o puesto.
  return Boolean(f.horas.trim() || f.materia.trim() || f.puesto.trim());
}

/**
 * Filas que de verdad aportan un requisito, para el DOCUMENTO.
 *
 * Una fila heredada del cuadro de experiencia que solo lleva la actividad no es
 * un requisito de capacitacion: en el Word saldria como una fila entera de
 * huecos. Se descarta, y si no queda ninguna, el apartado no aparece.
 */
export function filasCapacitacionParaDocumento(texto: string | null | undefined): FilaCapacitacion[] {
  return parseFilasCapacitacion(texto).filter(esRequisitoCapacitacion);
}
