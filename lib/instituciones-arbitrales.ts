/**
 * Apartado i) del requerimiento: solución de controversias contractuales.
 *
 * El modelo del OECE trae un párrafo fijo y, debajo, un cuadro donde la entidad
 * DESIGNA las instituciones arbitrales entre las que el postor ganador elegirá
 * una para administrar el arbitraje (Reglamento Art. 331.2: el arbitraje
 * institucional se inicia con la solicitud a «la Institución Arbitral elegida»).
 *
 * El dato se guarda en la MISMA columna de texto que ya existía, no en una tabla
 * nueva: el editor lo compone al escribir y lo vuelve a leer al abrir, igual que
 * hace el editor de requisitos de calificación. Así el apartado sigue siendo un
 * texto que se exporta tal cual al Word, y no hace falta migrar nada.
 *
 * El texto del apartado (párrafo de conciliación/arbitraje + encabezado de la
 * lista + condiciones adicionales) es EDITABLE y vive completo en el campo; un
 * botón «Insertar texto estándar» carga la versión oficial (`TEXTO_ESTANDAR_
 * CONTROVERSIAS`). El compositor solo le añade la tabla de instituciones al final.
 * Antes el párrafo iba fijo y no editable y lo añadía el compositor; se movió al
 * campo para que la entidad pueda ajustarlo y para no duplicarlo.
 */

export type InstitucionArbitral = { nombre: string; ruc: string };

export const PARRAFO_CONTROVERSIAS =
  "Las controversias que surjan entre las partes durante la ejecución del contrato se " +
  "resuelven mediante conciliación, cuando se haya pactado, y arbitraje (Arts. 330 y 331 " +
  "del Reglamento).";

const ENCABEZADO_LISTA =
  "Para el caso de arbitraje, el postor ganador de la buena pro selecciona una de las " +
  "siguientes Instituciones Arbitrales para administrarlo, de conformidad con el artículo 332 " +
  "del Reglamento:";

/**
 * Texto ESTÁNDAR del apartado (párrafo de conciliación/arbitraje + encabezado de
 * la lista). Es lo que inserta el botón «Insertar texto estándar» del editor en
 * el campo editable; antes iba fijo y no editable, y el compositor lo añadía
 * solo. Ahora vive como texto editable y el compositor solo le añade la tabla.
 */
export const TEXTO_ESTANDAR_CONTROVERSIAS = `${PARRAFO_CONTROVERSIAS}\n\n${ENCABEZADO_LISTA}`;

// El cuadro de instituciones va al FINAL del apartado, como TABLA Markdown (se
// exporta como tabla nativa en el Word). Cabecera y separador fijos.
const HEADER_TABLA = "| N.º | Institución arbitral | RUC |";
const SEP_TABLA = "|---|---|---|";
// Fila de datos: «| 1 | NOMBRE | RUC |». La 1.ª celda es un número, así que ni la
// cabecera ni el separador la matchean. El RUC admite el corchete [POR CONSIGNAR].
const FILA_TABLA = /^\s*\|\s*\d+\s*\|\s*(.+?)\s*\|\s*([^|]*?)\s*\|\s*$/;
// Compat con el formato anterior «1. NOMBRE — RUC 20112273922».
const LINEA_ANTIGUA = /^\s*\d+\.\s*(.+?)\s+—\s*RUC\s*([\d\s-]{8,})\s*$/;
// Separador Markdown de tabla («|---|:--:|»), para no confundirlo con texto libre.
const SEPARADOR_MD = /^\s*\|?[\s:|-]+\|?\s*$/;

/** ¿La línea es parte del cuadro de instituciones (fila, cabecera o separador)? */
function esFilaCuadro(l: string): boolean {
  return FILA_TABLA.test(l) || l.trim() === HEADER_TABLA || (l.includes("|") && SEPARADOR_MD.test(l));
}

export function parseInstituciones(texto: string): InstitucionArbitral[] {
  if (!texto) return [];
  const salida: InstitucionArbitral[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(LINEA_ANTIGUA) ?? linea.match(FILA_TABLA);
    if (!m) continue;
    const nombre = m[1].trim();
    const ruc = m[2].replace(/\D/g, "");
    if (nombre) salida.push({ nombre, ruc });
  }
  return salida;
}

// El texto del apartado (párrafo + encabezado + condiciones) es ahora EDITABLE y
// vive completo en el campo; el compositor solo le añade la tabla. Así que el
// "texto libre" es todo lo que NO es una fila del cuadro de instituciones.
export function textoLibreControversias(texto: string): string {
  if (!texto) return "";
  return texto
    .split(/\r?\n/)
    .filter((l) => !LINEA_ANTIGUA.test(l) && !esFilaCuadro(l))
    .join("\n")
    .trim();
}

export function componerControversias(instituciones: InstitucionArbitral[], textoLibre = ""): string {
  const utiles = instituciones.filter((i) => i.nombre.trim());
  const bloques: string[] = [];
  const libre = textoLibre.trim();
  if (libre) bloques.push(libre);
  if (utiles.length > 0) {
    const filas = utiles.map((i, k) => {
      const ruc = i.ruc.replace(/\D/g, "");
      return `| ${k + 1} | ${i.nombre.trim()} | ${ruc || "[POR CONSIGNAR]"} |`;
    });
    bloques.push([HEADER_TABLA, SEP_TABLA, ...filas].join("\n"));
  }
  return bloques.join("\n\n");
}

export function faltaDesignarInstitucion(texto: string): boolean {
  return parseInstituciones(texto).length === 0;
}

// Umbrales de la JPRD (Art. 346): obligatoria en obras desde S/ 10M, facultativa
// entre S/ 5M y S/ 10M, y no cabe por debajo de S/ 5M.
const JPRD_OBLIGATORIA = 10_000_000;
const JPRD_MINIMO = 5_000_000;

export function avisoJPRD(objeto: string, monto: number | null): string | null {
  const m = typeof monto === "number" && Number.isFinite(monto) ? monto : null;
  if (objeto === "obras") {
    if (m !== null && m >= JPRD_OBLIGATORIA) {
      return "Por ser una obra de S/ 10 000 000 o más, la JPRD es OBLIGATORIA (Art. 346.1): la entidad propone de 2 a 5 centros de administración inscritos en el REGAJU. Se determina en la estrategia de contratación.";
    }
    if (m !== null && m >= JPRD_MINIMO) {
      return "En obras entre S/ 5 000 000 y S/ 10 000 000 la JPRD es facultativa (Art. 346.1); no cabe por debajo de S/ 5 000 000. Se determina en la estrategia de contratación.";
    }
    if (m === null) {
      return "Si la obra alcanza S/ 10 000 000 o más, la JPRD es obligatoria (Art. 346.1); se determina en la estrategia de contratación.";
    }
    return null; // obra por debajo de S/ 5M: no cabe JPRD.
  }
  // Suministros (bienes/servicios): la JPRD es facultativa si supera S/ 10M.
  if ((objeto === "bienes" || objeto === "servicios") && m !== null && m > JPRD_OBLIGATORIA) {
    return "En suministros que superan S/ 10 000 000 la JPRD es facultativa (Art. 346.2); se determina en la estrategia de contratación.";
  }
  return null;
}
