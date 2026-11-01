// Rellena el .docx oficial de las Bases (lib/bases-docx-plantilla.ts) con los
// datos ya registrados en A1-A8, SIN tocar nada más: se preserva el número de
// páginas, la tipografía, negritas, viñetas, la Proforma del Contrato y los
// Anexos del formato del OECE. Solo se sustituyen los marcadores "[...]" que
// tienen un dato claro en el expediente; el resto de "[...]" se deja tal cual,
// igual que la plantilla en blanco (no se inventa contenido).
//
// Cómo: los .docx del OECE parten cada palabra del marcador en un <w:r>
// distinto (kerning de justificación), así que "[CONSIGNAR EL AÑO FISCAL]"
// nunca aparece como una cadena contigua en el XML. `fusionarRuns` reagrupa los
// <w:r> adyacentes de igual formato (ignorando <w:spacing>, que es invisible),
// dejando el marcador en un solo <w:t> sobre el que ya se puede hacer un
// reemplazo textual. No se fusionan runs con formato realmente distinto (una
// palabra en negrita entre texto normal), así que no se pierde ningún énfasis.

import JSZip from "jszip";
import type { HitosMap } from "./procurement-fases";
import { OPCIONES_MODALIDAD_PAGO, OPCIONES_SISTEMA_ENTREGA } from "./opciones-contratacion";

export type Sustitucion = {
  /** Etiqueta lógica; varias entradas pueden compartirla (mismo dato, distinto marcador). */
  clave: string;
  /** Debe casar el marcador completo, corchetes incluidos, dentro de un <w:t>. Global. */
  buscar: RegExp;
  /** Texto de reemplazo ya listo para incrustar dentro de <w:t> (escapado, saltos → <w:br/>). */
  valor: string;
};

// --- normalización de runs -------------------------------------------------

const RPR = String.raw`(?:<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr>|<w:rPr\/>)`;
// `<w:lastRenderedPageBreak/>` es solo la caché de dónde Word paginó por
// última vez; puede aparecer entre <w:rPr> y <w:t> y Word la regenera sola, así
// que se tolera al casar el run y se descarta al fusionar.
const RUN = String.raw`<w:r(?:\s[^>]*)?>(${RPR})?(?:<w:lastRenderedPageBreak\/>)?<w:t((?:\s[^>]*)?)>([^<]*)<\/w:t><\/w:r>`;
const RUN_G = new RegExp(RUN, "g");
const SEQ_G = new RegExp(`(?:${RUN}){2,}`, "g");

function normalizarRpr(rpr: string): string {
  if (!rpr || rpr === "<w:rPr/>") return "";
  return rpr
    .replace(/<w:spacing\b[^>]*\/>/g, "")
    .replace(/<w:position\b[^>]*\/>/g, "")
    .replace(/^<w:rPr>\s*<\/w:rPr>$/, "");
}

/** Reagrupa <w:r> de texto adyacentes con el mismo formato (spacing aparte). */
export function fusionarRuns(xml: string): string {
  return xml.replace(SEQ_G, (bloque) => {
    const runs = [...bloque.matchAll(RUN_G)].map((m) => ({ rpr: m[1] ?? "", texto: m[3] ?? "" }));
    const grupos: { rpr: string; texto: string }[] = [];
    for (const r of runs) {
      const clave = normalizarRpr(r.rpr);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && normalizarRpr(ultimo.rpr) === clave) ultimo.texto += r.texto;
      else grupos.push({ rpr: r.rpr, texto: r.texto });
    }
    return grupos
      .map((g) => {
        const rpr = g.rpr && g.rpr !== "<w:rPr/>" ? g.rpr.replace(/<w:spacing\b[^>]*\/>/g, "") : "";
        const rprOut = rpr && !/^<w:rPr>\s*<\/w:rPr>$/.test(rpr) ? rpr : "";
        return `<w:r>${rprOut}<w:t xml:space="preserve">${g.texto}</w:t></w:r>`;
      })
      .join("");
  });
}

// Cose runs partidos DENTRO de un marcador: si un <w:t> abre "[" y no lo
// cierra, absorbe el texto del <w:r> siguiente (y descarta su formato y los
// bookmarks intermedios) hasta que el "]" aparezca. Solo actúa sobre tramos
// entre corchetes — el texto sin "[" abierto no se toca, así que ningún
// énfasis fuera de un marcador se pierde. Complementa a `fusionarRuns` para
// los marcadores que el OECE partió con formato heterogéneo (tablas de anexos).
const COSER =
  /(<w:t(?:\s[^>]*)?>[^<]*\[[^\]<]*)<\/w:t><\/w:r>(?:<w:bookmark(?:Start|End)[^>]*\/>|<w:proofErr[^>]*\/>|<w:lastRenderedPageBreak\/>)*<w:r(?:\s[^>]*)?>(?:<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr>|<w:rPr\/>)?(?:<w:lastRenderedPageBreak\/>)?<w:t(?:\s[^>]*)?>([^<]*<\/w:t>)/;

export function coserMarcadores(xml: string): string {
  let previo: string;
  let actual = xml;
  do {
    previo = actual;
    actual = actual.replace(COSER, "$1$2");
  } while (actual !== previo);
  return actual;
}

// --- valores --------------------------------------------------------------

function escaparXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texto plano → contenido de <w:t>, con los saltos de línea como <w:br/>. */
function valorXml(valor: string): string {
  return valor
    .trim()
    .split(/\r?\n/)
    .map((l) => escaparXml(l.trim()))
    .join('</w:t><w:br/><w:t xml:space="preserve">');
}

function t(hitos: HitosMap, hito: string, campo: string): string {
  const v = (hitos[hito]?.data ?? {})[campo];
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function etiqueta(opciones: { value: string; label: string }[], value: string): string {
  return opciones.find((o) => o.value === value)?.label ?? value;
}

// --- construcción de la lista de sustituciones ----------------------------

type DatosBases = {
  hitos: HitosMap;
  entidad: string;
  anioFiscal: string;
  /** `procurement_processes.nomenclature` — respaldo para la denominación. */
  nomenclaturaProceso: string;
};

/**
 * Marcadores que se pueden resolver desde A1-A8, con TODAS las variantes de
 * redacción del OECE por familia (bienes · obras · servicios · consultoría en
 * general y de obra · mantenimiento vial). Un marcador que no exista en la
 * plantilla concreta simplemente no casa y su "[...]" queda intacto — no se
 * inventa contenido.
 *
 * Los datos de A3/A4 no son específicos de un objeto (el "plazo de entrega" de
 * bienes es el mismo `plazo_dias` que el "plazo de prestación del servicio"),
 * así que un solo valor cubre varias redacciones. Cada `clave` puede tener
 * varios `buscar`; basta con que uno case.
 */
export function construirSustituciones(datos: DatosBases): Sustitucion[] {
  const { hitos, entidad, anioFiscal, nomenclaturaProceso } = datos;

  const nomenclatura = t(hitos, "A4", "var_a_nomenclatura") || nomenclaturaProceso;
  const denominacion =
    nomenclaturaProceso.includes("—") ? nomenclaturaProceso.split("—").slice(1).join("—").trim() : nomenclaturaProceso;

  const finalidad = t(hitos, "A3", "finalidad_publica");
  const descripcion = t(hitos, "A3", "descripcion");
  const lugar = t(hitos, "A3", "lugar_entrega");
  const plazoDias = t(hitos, "A3", "plazo_dias");
  const plazoUnidad = t(hitos, "A3", "plazo_unidad") === "habiles" ? "días hábiles" : "días calendario";
  const plazoTexto = plazoDias ? `${plazoDias} ${plazoUnidad}` : "";
  const cui = t(hitos, "A4", "cui");
  const formulaReajuste = t(hitos, "A3", "formula_reajuste");
  const otrasPenalidades = t(hitos, "A3", "otras_penalidades");
  const modalidadPago = t(hitos, "A4", "var_h_modalidad_pago");
  const sistemaEntrega = t(hitos, "A4", "var_i_sistema_entrega");

  const modalidadTexto = modalidadPago
    ? `modalidad de pago ${etiqueta(OPCIONES_MODALIDAD_PAGO, modalidadPago)}`
    : "";
  const sistemaTexto = sistemaEntrega
    ? `sistema de entrega de ${
        sistemaEntrega === "no_aplica" ? "No aplica" : etiqueta(OPCIONES_SISTEMA_ENTREGA, sistemaEntrega)
      }`
    : "";

  const subs: Sustitucion[] = [];
  const add = (clave: string, valor: string, ...buscar: RegExp[]) => {
    if (!valor.trim()) return;
    for (const b of buscar) subs.push({ clave, buscar: b, valor: valorXml(valor) });
  };

  // Portada, encabezado de todas las páginas, proforma y anexos.
  add(
    "entidad",
    entidad,
    /\[NOMBRE DE LA ENTIDAD CONTRATANTE\]/g,
    /\[CONSIGNAR (?:EL )?NOMBRE DE LA ENTIDAD(?: CONTRATANTE)?\]/g,
  );
  add(
    "nomenclatura",
    nomenclatura,
    /\[NOMENCLATURA DEL PROCEDIMIENTO DE SELECCIÓN\]/g,
    /\[CONSIGNAR (?:LA )?NOMENCLATURA DEL PROCEDIMIENTO(?: DE SELECCIÓN)?\]/g,
  );
  add(
    "denominacion",
    denominacion,
    /\[DENOMINACIÓN DE LA CONVOCATORIA\]/g,
    /\[CONSIGNAR LA DENOMINACIÓN DE LA CONVOCATORIA\]/g,
  );
  add("anioFiscal", anioFiscal, /\[CONSIGNAR EL AÑO FISCAL\]/g);

  // "El presente procedimiento de selección tiene por objeto la contratación
  // de [...]" — una redacción por familia.
  add(
    "objeto",
    denominacion,
    /\[CONSIGNAR LOS BIENES A CONTRATAR\]/g,
    /\[(?:CONSIGNAR|INDICAR) EL OBJETO DE LA CONTRATACIÓN\]/g,
    /\[DESCRIBIR:? [^\]]*A CONTRATAR[^\]]*\]/g,
    /\[CONSIGNAR (?:LA CONSULTORÍA DE OBRA|EL SERVICIO DE MANTENIMIENTO VIAL) A CONTRATAR\]/g,
  );
  // El marcador de obras pide el nombre de la obra, el proyecto Y el Código Único de Inversión: el CUI sale del paso A4
  // (el formato lo pide solo cuando la contratación es una inversión; sin CUI, va solo el nombre y el resto queda por completar).
  add(
    "objeto",
    cui ? `${denominacion} (CUI ${cui})` : denominacion,
    /\[CONSIGNAR NOMBRE DE LA OBRA A EJECUTAR[^\]]*\]/g,
  );

  // Capítulo III — Requerimiento / condiciones de contratación.
  add("finalidad", finalidad, /\[INDICAR LA FINALIDAD PÚBLICA DE LA CONTRATACIÓN\]/g);
  add("descripcion", descripcion, /\[INDICAR LA DESCRIPCIÓN GENERAL DEL REQUERIMIENTO[^\]]*\]/g);

  // Plazo: los marcadores sin unidad reciben "N días calendario"; el de obras
  // ya trae " días calendario" impreso a continuación, así que recibe solo "N".
  add(
    "plazo",
    plazoTexto,
    /\[CONSIGNAR EL PLAZO DE ENTREGA\]/g,
    /\[CONSIGNAR EL PLAZO DE PRESTACIÓN[^\]]*\]/g,
  );
  add("plazo", plazoDias, /\[CONSIGNAR EL PLAZO DE EJECUCIÓN DE ESTA PRESTACIÓN[^\]]*\]/g);

  add(
    "lugar",
    lugar,
    /\[INDICAR DIRECCIÓN EXACTA DEL LUGAR DE ENTREGA DE LOS BIENES[^\]]*\]/g,
    /\[INDICAR EL DETALLE DEL LUGAR O LOS LUGARES[^\]]*\]/g,
  );

  add(
    "modalidadPago",
    modalidadTexto,
    /modalidad de pago \[CONSIGNAR SEGÚN LO DETERMINADO EN LA ESTRATEGIA DE CONTRATACIÓN\]/g,
    /modalidad de pago de \[CONSIGNAR SEGÚN LO DETERMINADO EN LA ESTRATEGIA DE CONTRATACIÓN\]/g,
    /modalidad de \[CONSIGNAR LA MODALIDAD DE PAGO DETERMINADA EN LA ESTRATEGIA DE CONTRATACIÓN\]/g,
  );

  add(
    "sistemaEntrega",
    sistemaTexto,
    /sistema de entrega de \[(?:DE SER EL CASO, )?CONSIGNAR SISTEMA DE ENTREGA[^\]]*\]/g,
  );

  // Condiciones de la contratación que el área usuaria propone en A3 y que el marcador pide tal cual. «No aplica» también es una
  // respuesta válida en ambos: el marcador dice «DE SER EL CASO», y dejarlo sin tocar daría a entender que falta llenarlo.
  add(
    "formulaReajuste",
    formulaReajuste,
    /\[DE SER EL CASO, CONSIGNAR LAS F[ÓO]RMULAS DE REAJUSTE[^\]]*\]/g,
    /\[DE SER EL CASO, CONSIGNAR LA F[ÓO]RMULA Y EL PROCEDIMIENTO PARA EL REAJUSTE[^\]]*\]/g,
  );
  add("otrasPenalidades", otrasPenalidades, /\[INCLUIR OTRAS PENALIDADES, DE SER EL CASO\]/g);

  return subs;
}

// --- qué campos de los pasos llegan al Word y cuáles no ------------------------

/**
 * Campo de paso («A3.formula_reajuste») → clave de la sustitución que lo lleva al Word oficial. Es el contrato que vigila
 * tests/bases-docx-cobertura.test.ts: todo campo que una plantilla de `bases-plantillas.ts` enlaza con un paso tiene que estar
 * aquí o en `CAMPOS_HITO_SIN_MARCADOR`; no puede quedar un dato resuelto que nadie sabe si llega al documento.
 */
export const CAMPOS_HITO_EN_WORD: Record<string, string> = {
  "A3.finalidad_publica": "finalidad",
  "A3.descripcion": "descripcion",
  "A3.lugar_entrega": "lugar",
  "A3.plazo_dias": "plazo",
  "A3.formula_reajuste": "formulaReajuste",
  "A3.otras_penalidades": "otrasPenalidades",
  "A4.var_h_modalidad_pago": "modalidadPago",
  "A4.var_i_sistema_entrega": "sistemaEntrega",
  "A4.cui": "objeto",
};

/**
 * Campos que `resolverBases` resuelve pero NO se vuelcan al Word oficial, y por qué. No es una lista de pendientes olvidados:
 * cada motivo es una razón concreta por la que rellenarlo «a ojo» produciría un texto jurídico incorrecto. Quitar uno de aquí
 * exige decidir antes cómo se mapea (ver docs/superpowers/plans/2026-09-01-a9-elaboracion-bases.md).
 */
export const CAMPOS_HITO_SIN_MARCADOR: Record<string, string> = {
  "A3.penalidad_mora":
    "El Word oficial trae la fórmula de la penalidad por mora como texto fijo (Art. 163 del Reglamento), sin marcador que completar; el dato de A3 es la propuesta del área usuaria y no sustituye al texto del OECE.",
  "A3.subcontratacion":
    "El marcador solo pide las prestaciones esenciales que NO se pueden subcontratar, dentro de un párrafo fijo que ya dice «el contratista puede subcontratar hasta el 40 %». El campo de A3 mezcla si se admite, el porcentaje y las prestaciones, y con «No aplica» el párrafo se contradiría.",
  "A3.solucion_controversias":
    "El Word separa el mecanismo («se resuelven mediante [...]»), la institución arbitral y los centros de la JPRD en marcadores distintos; el campo de A3 es un solo texto con medios e instituciones juntos y no se puede dividir sin interpretarlo.",
  "A4.var_f_requisitos_calificacion":
    "Los requisitos son un dato estructurado (habilitación, facturación, experiencia, personal clave, equipamiento) y el Word los reparte en decenas de marcadores por tipo de procedimiento, con montos que dependen de la cuantía; hace falta un mapeo propio por tipo.",
  "A4.factores_items":
    "Los factores de evaluación van en tablas con puntajes y criterios propios de cada factor en el Word oficial; mapear la lista de A4 a esas tablas requiere definir primero cómo se corresponden los factores.",
};

// --- relleno del documento ----------------------------------------------

const PARTES_RELLENABLES = /^word\/(document|header\d+|footer\d+)\.xml$/;

export type ResultadoRelleno = {
  buffer: Buffer;
  /** Claves efectivamente sustituidas al menos una vez. */
  aplicadas: string[];
  /**
   * Claves con dato disponible cuyo marcador no aparece en esta plantilla.
   * Es informativo, NO un error: cada familia (bienes/obras/servicios/...) usa
   * un subconjunto distinto de marcadores.
   */
  sinCoincidencia: string[];
};

export async function rellenarBasesDocx(plantilla: Buffer, subs: Sustitucion[]): Promise<ResultadoRelleno> {
  const zip = await JSZip.loadAsync(plantilla);
  const aplicadas = new Set<string>();

  for (const nombre of Object.keys(zip.files)) {
    if (!PARTES_RELLENABLES.test(nombre)) continue;
    let xml = await zip.file(nombre)!.async("string");
    xml = coserMarcadores(fusionarRuns(xml));
    for (const s of subs) {
      xml = xml.replace(s.buscar, () => {
        aplicadas.add(s.clave);
        return s.valor;
      });
    }
    zip.file(nombre, xml);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const claves = new Set(subs.map((s) => s.clave));
  const sinCoincidencia = [...claves].filter((c) => !aplicadas.has(c));
  return { buffer, aplicadas: [...aplicadas], sinCoincidencia };
}
