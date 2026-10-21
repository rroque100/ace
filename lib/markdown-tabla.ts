// Parser puro de tablas Markdown embebidas en texto (la matriz de riesgos del
// Art. 44.3 va como tabla con pipes). Vivía en `requerimiento-docx.ts`, pero ese
// fichero importa la librería `docx`; sacándolo aquí lo reutiliza también un
// componente CLIENTE (el editor de «Otras penalidades») sin arrastrar `docx` al
// bundle del navegador, y queda un solo parser de pipes.

/** Un segmento de un párrafo de campo: texto, viñeta o tabla Markdown. */
export type SegmentoParrafo =
  | { tipo: "tabla"; filas: string[][] }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "vineta"; texto: string };

/** ¿La línea es el separador de una tabla Markdown («|---|:--:|»)? */
function esSeparadorTablaMd(linea: string): boolean {
  const t = linea.trim();
  return t.includes("|") && t.includes("-") && /^\|?[\s:|-]+\|?$/.test(t);
}

/** ¿La línea parece una fila de tabla Markdown (tiene al menos un «|»)? */
function esFilaTablaMd(linea: string): boolean {
  return linea.includes("|");
}

/** Celdas de una fila Markdown: «| a | b |» → ["a","b"]. */
function celdasFilaMd(linea: string): string[] {
  let t = linea.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

/**
 * Parte el texto en segmentos: párrafos, viñetas y TABLAS Markdown. Una tabla es
 * una fila «| … |» seguida de una separadora «|---|»; el resto sigue como párrafo
 * o viñeta. Un pipe suelto en prosa NO es tabla (hace falta la separadora).
 */
export function segmentarParrafoMd(valor: string): SegmentoParrafo[] {
  const lineas = valor.split(/\r?\n/);
  const out: SegmentoParrafo[] = [];
  let i = 0;
  while (i < lineas.length) {
    const actual = lineas[i];
    if (esFilaTablaMd(actual) && esSeparadorTablaMd(lineas[i + 1] ?? "")) {
      const filas: string[][] = [celdasFilaMd(actual)];
      i += 2; // cabecera + separador
      while (i < lineas.length && lineas[i].trim() && esFilaTablaMd(lineas[i]) && !esSeparadorTablaMd(lineas[i])) {
        filas.push(celdasFilaMd(lineas[i]));
        i += 1;
      }
      out.push({ tipo: "tabla", filas });
      continue;
    }
    const limpio = actual.trim();
    if (limpio) {
      out.push(
        /^[-•*]\s+/.test(limpio)
          ? { tipo: "vineta", texto: limpio.replace(/^[-•*]\s+/, "") }
          : { tipo: "parrafo", texto: limpio },
      );
    }
    i += 1;
  }
  return out;
}
