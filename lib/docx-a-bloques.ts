// Lee un .docx ya generado y lo devuelve como párrafos (y tablas) con formato.
//
// ── Por qué extraer del archivo y no componer aparte ──────────────────────────
//
// Para la vista previa de A6 (los tres documentos de designación de evaluadores)
// la fidelidad tiene que ser total: son formatos que se firman. La forma más
// segura de garantizarla es que la previa SEA el archivo —no una segunda
// composición que podría desviarse—, así que se genera el .docx con el mismo
// `buildEvaluadorDoc` que la descarga y se lee de vuelta.
//
// Se lee el XML de `word/document.xml`, que es lo que Word abre. Un .docx es un
// ZIP; se descomprime con `jszip`, la misma librería que `docx` usa para
// escribirlo (declarada como dependencia directa para no depender de un árbol
// transitivo en runtime).

import JSZip from "jszip";

/** Fragmento con su énfasis, tal como está en el documento. */
export type FragmentoDocx = {
  texto: string;
  negrita: boolean;
  cursiva: boolean;
  subrayado: boolean;
};

export type ParrafoDocx = {
  /** "left" | "center" | "right" | "both" (justificado), o "" si no se declara. */
  alineacion: string;
  fragmentos: FragmentoDocx[];
};

export type TablaDocx = {
  /** Cada fila es una lista de celdas; cada celda, sus párrafos (casi siempre uno). */
  filas: { cabecera: boolean; celdas: ParrafoDocx[][] }[];
};

/** Un bloque del cuerpo del documento, en el orden en que aparece. */
export type BloqueDocx = { tipo: "parrafo"; parrafo: ParrafoDocx } | { tipo: "tabla"; tabla: TablaDocx };

/** Quita las etiquetas XML de un fragmento y decodifica las entidades básicas. */
function limpiar(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Un `<w:r>` (run) → fragmento con su formato.
 *
 * El texto puede venir en varios `<w:t>` y llevar `<w:tab/>` o `<w:br/>` en
 * medio, que se traducen a una tabulación y un salto de línea para que la previa
 * respete la maqueta del documento.
 */
function leerRun(runXml: string): FragmentoDocx {
  const props = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  let texto = "";
  for (const m of runXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)) {
    if (m[0].startsWith("<w:tab")) texto += "\t";
    else if (m[0].startsWith("<w:br")) texto += "\n";
    else texto += limpiar(m[1] ?? "");
  }
  return {
    // `<w:b/>` marca negrita; `<w:b w:val="false"/>` la desmarca.
    cursiva: /<w:i\s*\/>|<w:i\s+w:val="(?:true|1|on)"/.test(props),
    negrita: /<w:b\s*\/>|<w:b\s+w:val="(?:true|1|on)"/.test(props),
    subrayado: /<w:u\b/.test(props) && !/<w:u\s+w:val="none"/.test(props),
    texto,
  };
}

/**
 * `<w:p>…</w:p>` (o autocerrado) → párrafo con formato.
 *
 * Un encabezado de sección (`heading()` en los compositores, `HeadingLevel.*`
 * de la librería `docx`) no lleva `<w:b/>` en sus runs: la negrita la aporta el
 * ESTILO del párrafo (`<w:pStyle w:val="Heading2"/>`), definido en
 * `word/styles.xml`, no el run. Sin esto, un título de sección salía sin
 * negrita en la previa aunque en Word sí la tuviera.
 */
function leerParrafo(bloque: string): ParrafoDocx {
  const alineacion = bloque.match(/<w:jc\s+w:val="([^"]+)"/)?.[1] ?? "";
  const esEncabezado = /<w:pStyle\s+w:val="Heading\d"/.test(bloque);
  const fragmentos: FragmentoDocx[] = [];
  for (const r of bloque.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)) {
    const frag = leerRun(r[0]);
    if (frag.texto) fragmentos.push(esEncabezado ? { ...frag, negrita: true } : frag);
  }
  return { alineacion, fragmentos };
}

/**
 * `<w:tbl>…</w:tbl>` → tabla con sus filas y celdas.
 *
 * Sin esto, una matriz (riesgo, cronograma) se leía como una secuencia de
 * párrafos sueltos —los `<w:p>` de cada celda, uno tras otro, sin más—: el
 * texto llegaba pero la cuadrícula desaparecía por completo.
 */
function leerTabla(bloque: string): TablaDocx {
  const filas: TablaDocx["filas"] = [];
  for (const tr of bloque.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)) {
    const filaXml = tr[0];
    const cabecera = /<w:tblHeader\s*\/>|<w:tblHeader\s+w:val="(?:true|1|on)"/.test(filaXml);
    const celdas: ParrafoDocx[][] = [];
    for (const tc of filaXml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)) {
      const celdaXml = tc[0];
      const parrafos: ParrafoDocx[] = [];
      for (const p of celdaXml.matchAll(/<w:p\b[^>]*\/>|<w:p\b[\s\S]*?<\/w:p>/g)) {
        parrafos.push(leerParrafo(p[0]));
      }
      celdas.push(parrafos);
    }
    filas.push({ cabecera, celdas });
  }
  return { filas };
}

/**
 * `.docx` (buffer) → lista de párrafos con formato.
 *
 * Los párrafos vacíos se conservan: en estos formatos el espaciado en blanco
 * (líneas de firma, separaciones) es parte de la maqueta, no ruido.
 *
 * No entiende tablas (las aplana a sus párrafos internos, sin la cuadrícula):
 * sirve para los documentos de A6, que no llevan ninguna. Para documentos con
 * tablas, usar `leerDocxBloques`.
 */
export async function leerDocx(buffer: Buffer | Uint8Array): Promise<ParrafoDocx[]> {
  const bloques = await leerDocxBloques(buffer);
  const parrafos: ParrafoDocx[] = [];
  for (const b of bloques) {
    if (b.tipo === "parrafo") parrafos.push(b.parrafo);
    else for (const fila of b.tabla.filas) for (const celda of fila.celdas) parrafos.push(...celda);
  }
  return parrafos;
}

/**
 * `.docx` (buffer) → bloques en el orden del documento, con las tablas intactas.
 *
 * El cuerpo del documento solo anida párrafos y tablas a su nivel superior, así
 * que un único recorrido secuencial con alternancia basta: al llegar a un
 * `<w:tbl>` el patrón lo consume ENTERO (con sus `<w:p>` internos incluidos)
 * antes de que el regex pueda intentar matchear esos párrafos por separado, así
 * que nunca se cuentan dos veces.
 */
export async function leerDocxBloques(buffer: Buffer | Uint8Array): Promise<BloqueDocx[]> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";

  const bloques: BloqueDocx[] = [];
  for (const m of xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[^>]*\/>|<w:p\b[\s\S]*?<\/w:p>/g)) {
    const bloque = m[0];
    if (bloque.startsWith("<w:tbl")) bloques.push({ tipo: "tabla", tabla: leerTabla(bloque) });
    else bloques.push({ tipo: "parrafo", parrafo: leerParrafo(bloque) });
  }

  // El pie de página ("Elaborado por") vive en un XML aparte
  // (`word/footerN.xml`), no en `word/document.xml`: sin esto, la previa
  // dejaba de enseñarlo por completo en cuanto se movía del cuerpo al pie.
  const footers = Object.keys(zip.files)
    .filter((name) => /^word\/footer\d+\.xml$/.test(name))
    .sort();
  for (const name of footers) {
    const footerXml = (await zip.file(name)?.async("string")) ?? "";
    const parrafosFooter: ParrafoDocx[] = [];
    for (const p of footerXml.matchAll(/<w:p\b[^>]*\/>|<w:p\b[\s\S]*?<\/w:p>/g)) {
      const parrafo = leerParrafo(p[0]);
      if (parrafo.fragmentos.length > 0) parrafosFooter.push(parrafo);
    }
    if (parrafosFooter.length > 0) {
      // Un párrafo vacío como separador: en la hoja de la previa no hay línea
      // divisoria de página que marque dónde empieza el pie.
      bloques.push({ tipo: "parrafo", parrafo: { alineacion: "", fragmentos: [] } });
      for (const parrafo of parrafosFooter) bloques.push({ tipo: "parrafo", parrafo });
    }
  }

  return bloques;
}
