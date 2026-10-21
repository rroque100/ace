// Exportación de los formatos oficiales de la FASE 1 (Actuaciones Preparatorias)
// a Excel, rellenando las plantillas .xlsx del MEF/OECE (preservan el formato).
//
// Plantillas en lib/plantillas-f1/. Se cargan con exceljs, se escriben las celdas
// con los datos capturados en los pasos (jsonb `hitos[code].data`) y el expediente,
// y se devuelve el buffer .xlsx listo para descargar.

import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { clasificarSegmentacion, NIVEL_ORDEN, type ObjetoSegmentacion } from "./actuaciones-preparatorias";
import {
  citasDeNivel,
  cuantiaDeA5,
  FUENTES_ANEXO1,
  HERRAMIENTAS_ANEXO1,
  leerProveedores,
  NO_CORRESPONDE,
  tipoDeNivel,
} from "./anexo1-interaccion";
import { prefijoDesignacion, soloNumeroDesignacion } from "./designacion-evaluadores";
import {
  CELDA_CLASIFICACION_SEGMENTACION,
  CELDA_CUI,
  CELDA_TIPO_PROCEDIMIENTO,
  ETIQUETAS_ESTRATEGIA,
  ETIQUETAS_EXTRA,
  SUSTENTOS_ESTRATEGIA,
  CELDA_FICHA_ESTANDARIZACION,
  CELDA_FINANCIAMIENTO,
  CELDA_OTRAS_VARIABLES,
  fuenteFinanciamientoDeTexto,
  CELDA_MODALIDAD_PAGO,
  NORMA_MODALIDAD_PAGO,
  CELDA_TIPO_EVALUADOR,
  type ActividadCronograma,
  CELDA_SISTEMA_ENTREGA,
  NORMA_SISTEMA_ENTREGA,
  ADELANTOS_FILAS,
  leerAdelantos,
  sustentoAdelantos,
  CELDA_AGRUPAR,
  sustentoNormativoAgrupacion,
  CELDA_MODALIDAD_EFICIENTE,
  OTRAS_VARIABLES_CAMPOS,
  capitalizarProceso,
  labelProcedimiento,
  modificaProcedimientoDelPac,
  SI_NO_MODIFICA_PAC,
  type FactorEvaluacion,
  type PuntoNoNegociable,
  FILAS_FACTORES,
  FILAS_REQUISITOS,
  COL_CRONOGRAMA,
  CRONOGRAMA_SEGUN_BASES,
  esActividadSegunBases,
  ETAPAS_ROL,
  FILA_ROLES_INICIO,
  FILAS_CRONOGRAMA,
  FILAS_ROLES_PLANTILLA,
  leerFilas,
  nomenclaturaConNumero,
  nomenclaturaDelFormato,
  type RolEstrategia,
  type MapaCasillas,
  SI_NO_ESTANDARIZADO,
  SI_NO_ESTRATEGIA,
} from "./estrategia-formato";
import { numeroALetras } from "./numero-a-letras";
import { cuiDeCadenaFuncional } from "./pedido-compra-import";
import { regimenDe } from "./regimen-seleccion";
import {
  parseRequisitos,
  repartirRequisitos,
  tipoArt72DeNombre,
  TIPOS_REQUISITO_ART72,
  type EstadoRequisito,
  type TipoRequisitoArt72,
} from "./requisitos-calificacion";
import { requisitosDeProcedimiento, textoRequisitoObligatorio } from "./requisitos-por-procedimiento";
import {
  tienePrecalificacion,
  PROCESO_CONCURSO_ARQUITECTONICO,
  PROCESO_EXPERTOS_GERENTES_PROYECTO,
} from "./procesos-seleccion";
import type { HitosMap } from "./procurement-fases";
import { objectTypeLabel, processTypeLabel } from "./legal-taxonomy";
import { familiaProcedimiento } from "./aplicabilidad-fases";

export type FormatoF1 = "estrategia" | "anexo1" | "anexo2" | "anexo3" | "bases_checklist";

/**
 * Datos de la Necesidad vinculada al expediente.
 *
 * El Anexo N° 1 no tiene encabezado de identificación: sin esto el formato sale
 * anónimo y no se sabe de qué contratación es. La denominación, el área usuaria
 * y el valor estimado viven en la Necesidad, no en el expediente.
 */
export type NecesidadExport = {
  nombre: string | null;
  area_usuaria: string | null;
  monto_estimado: number | null;
  tipo_objeto: string | null;
  // Para el Formato de Estrategia (A4): la ficha ya trae estos datos y el
  // formato salía en blanco porque nadie los leía.
  fuente_financiamiento?: string | null;
  formula_reajuste?: string | null;
  /** CUI (act_proy del SIGA) y la cadena que lo lleva en su 4.º segmento. */
  cui?: string | null;
  cadena_funcional?: string | null;
  verificacion_ficha_tecnica?: string | null;
  /** N° de meta presupuestal de la necesidad (va a C7 del Anexo N° 2). */
  meta_presupuestal?: string | null;
  /** Fecha requerida (fecha del pedido) de la necesidad (va a H7 del Anexo N° 2). */
  fecha_requerida?: string | null;
  /** Descripción detallada (EETT/TDR) de la necesidad. */
  descripcion_detallada?: string | null;
  /** Descripción de catálogo de la necesidad (va a B30 del Anexo N° 2). */
  descripcion_catalogo?: string | null;
  /** Clasificador de gasto de la necesidad (va a H41 del Anexo N° 2). */
  clasificador_gasto?: string | null;
  /**
   * Resumen / descripción de la necesidad. En las importadas del SIGA contiene
   * el N° de pedido de compra ("…SIGA N° 001838"): es el documento con el que
   * se remite el requerimiento (D20 del Anexo N° 2).
   */
  summary?: string | null;
  /** Fecha de recepción por la DEC (I20 del Anexo N° 2). */
  fecha_remision_dec?: string | null;
  /** Fecha de la 2ª versión del requerimiento (D21 del Anexo N° 2). */
  fecha_version_dos?: string | null;
  /** Fecha de la "n" versión del requerimiento (D23 del Anexo N° 2). */
  fecha_version_n?: string | null;
  /**
   * Especialidad y subespecialidad de la obra o consultoría de obra (Art. 72.3.b
   * / 157). Van a la sección "Para el caso de obras y consultoría de obras" del
   * Anexo N° 2 (D25/D26). Solo aplican a obras/consultoría de obra.
   */
  especialidad?: string | null;
  subespecialidad?: string | null;
};

export type ProcesoExport = {
  nomenclature: string;
  object_type: string;
  procedure_type: string | null;
  amount: number | null;
  valor_estimado?: number | null;
  entity: string | null;
};

const PLANTILLAS: Record<FormatoF1, { archivo: string; hoja: number; nombre: string }> = {
  estrategia: { archivo: "estrategia-contratacion.xlsx", hoja: 0, nombre: "Formato-Estrategia-Contratacion" },
  // Un archivo por anexo, cada uno con SU única hoja.
  //
  // Antes los dos salían de un mismo libro de dos hojas y se devolvía el libro
  // entero: al descargar el Anexo N° 1 te llevabas también la hoja del Anexo
  // N° 2 (y al revés), con el otro formato en blanco. Son documentos distintos
  // del expediente y cada uno se remite por separado.
  anexo1: { archivo: "anexo-1.xlsx", hoja: 0, nombre: "Anexo-1-Interaccion-Mercado" },
  anexo2: { archivo: "anexo-2.xlsx", hoja: 0, nombre: "Anexo-2-Aprobacion-Expediente" },
  anexo3: { archivo: "", hoja: 0, nombre: "Anexo-3-Segmentacion" },
  bases_checklist: { archivo: "", hoja: 0, nombre: "Checklist-Bases" },
};

// Escribe un valor respetando celdas combinadas (escribe en la celda maestra).
const NUM_COL = (letras: string) => [...letras].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

/**
 * Desarma toda combinación que solape las columnas `c1..c2` de una fila.
 *
 * `duplicateRow` no copia las combinaciones de la fila insertada Y ADEMÁS deja
 * el modelo de merges DESINCRONIZADO: los rangos de debajo del punto de
 * inserción NO se desplazan, así que quedan "fantasmas" apuntando a filas que
 * ahora son otras. Consecuencia: la celda dice `isMerged=false` pero
 * `mergeCells` falla con "Cannot merge already merged cells", y la fila se
 * queda sin combinar y descuadrada.
 *
 * Por eso NO basta con mirar `cell.master`: hay que barrer la LISTA de merges y
 * deshacer cualquier rango que pise el objetivo. Solo se tocan los que solapan
 * en fila y columna, de modo que la combinación del rótulo de fase (columna B,
 * vertical) sobrevive cuando se recompone C..J.
 */
function desarmarMerge(ws: ExcelJS.Worksheet, fila: number, c1: number, c2: number) {
  const merges: string[] = (ws as unknown as { model?: { merges?: string[] } }).model?.merges ?? [];
  // Copia: `unMergeCells` muta la lista mientras se itera.
  for (const rango of [...merges]) {
    const [ini, fin] = rango.split(":");
    const p1 = ini?.match(/([A-Z]+)(\d+)/);
    const p2 = fin?.match(/([A-Z]+)(\d+)/);
    if (!p1 || !p2) continue;
    const [mc1, mr1, mc2, mr2] = [NUM_COL(p1[1]), Number(p1[2]), NUM_COL(p2[1]), Number(p2[2])];
    const solapaFila = mr1 <= fila && mr2 >= fila;
    const solapaColumna = mc1 <= c2 && mc2 >= c1;
    if (solapaFila && solapaColumna) {
      try {
        ws.unMergeCells(rango);
      } catch {
        /* ya no estaba combinada */
      }
    }
  }
}

/** Combina un rango de una fila; si aun así choca, la fila queda sin combinar. */
function armarMerge(ws: ExcelJS.Worksheet, fila: number, c1: number, c2: number) {
  try {
    ws.mergeCells(fila, c1, fila, c2);
  } catch {
    /* se queda sin combinar */
  }
}

function setCell(ws: ExcelJS.Worksheet, addr: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  const cell = ws.getCell(addr);
  const target = cell.isMerged ? cell.master : cell;
  target.value = value as ExcelJS.CellValue;
}

/** Fuente base de una celda (para conservar tipografía al escribir richText). */
function fuenteBaseDe(cell: ExcelJS.Cell): Partial<ExcelJS.Font> {
  if (cell.font && (cell.font.name || cell.font.size)) return { ...cell.font };
  const v = cell.value;
  if (v && typeof v === "object" && "richText" in v) {
    const f = (v as ExcelJS.CellRichTextValue).richText.find((r) => r.font)?.font;
    if (f) return { ...f };
  }
  return { name: "Arial", size: 16 };
}

/**
 * Convierte un sustento por párrafos en richText con el RÓTULO de cada párrafo en
 * negrita. El rótulo es el segmento inicial hasta el primer ":" (p. ej.
 * "Especialización Técnica:", "Eficiencia Operativa:", "Facultad Consultiva:").
 * Cada run conserva la fuente base para no cambiar tamaño ni tipografía.
 */
function conRotulosEnNegrita(texto: string, base: Partial<ExcelJS.Font>): ExcelJS.CellRichTextValue {
  const runs: { text: string; font?: Partial<ExcelJS.Font> }[] = [];
  texto.split("\n").forEach((linea, i) => {
    if (i > 0) runs.push({ text: "\n", font: { ...base } });
    const m = linea.match(/^([^:\n]{1,60}:)(.*)$/);
    if (m) {
      runs.push({ text: m[1], font: { ...base, bold: true } });
      if (m[2]) runs.push({ text: m[2], font: { ...base } });
    } else if (linea) {
      runs.push({ text: linea, font: { ...base } });
    }
  });
  return { richText: runs };
}

/**
 * Marca una casilla con la (X) del formato, centrada.
 *
 * La plantilla no trae alineación homogénea en las celdas de marca: unas están
 * centradas en vertical y otras no tienen alineación ninguna, así que la X caía
 * pegada a la izquierda y abajo. Se fija aquí para que todas salgan iguales.
 */
function mark(ws: ExcelJS.Worksheet, addr: string) {
  setCell(ws, addr, "X");
  const cell = ws.getCell(addr);
  const target = cell.isMerged ? cell.master : cell;
  target.alignment = { ...target.alignment, horizontal: "center", vertical: "middle" };
}

function str(data: Record<string, unknown> | null | undefined, key: string): string {
  const v = data?.[key];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function bool(data: Record<string, unknown> | null | undefined, key: string): boolean {
  return Boolean(data?.[key]);
}

function siNo(data: Record<string, unknown> | null | undefined, key: string): string {
  return bool(data, key) ? "SÍ" : "NO";
}

function hoy(): string {
  return new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Una fecha ISO "2026-04-22" a "22/04/2026". Vacío si no es una fecha ISO. */
function fechaISOaCorta(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * La denominación sola, sin el código del expediente delante.
 *
 * `procurement_processes.nomenclature` se compone como "REQ-2026-0019 — <nombre>"
 * (ver `nomenclaturaExpediente`). El Anexo N° 2 pide en C4 solo la DENOMINACIÓN,
 * así que se quita el código y su separador " — ". Se corta por el PRIMER
 * em-dash: si el nombre llevara otro, se conserva entero. Sin separador (no hay
 * código) se devuelve tal cual.
 */
function denominacionSinCodigo(nomenclature: string): string {
  const m = nomenclature.match(/^[^—]*—\s*/);
  return (m ? nomenclature.slice(m[0].length) : nomenclature).trim();
}

/** Activa el ajuste de línea en una celda (respeta las combinadas). */
function ajustarTexto(ws: ExcelJS.Worksheet, addr: string): void {
  const cell = ws.getCell(addr);
  const target = cell.isMerged ? cell.master : cell;
  target.alignment = { ...target.alignment, wrapText: true };
}

/**
 * Centra TODAS las celdas con contenido (horizontal y vertical), conservando el
 * ajuste de línea donde ya está puesto. Es lo que pide la entidad para el formato
 * de aprobación del expediente: todo el contenido centrado en su celda.
 */
function centrarTodo(ws: ExcelJS.Worksheet): void {
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.alignment = { ...cell.alignment, horizontal: "center", vertical: "middle" };
    });
  });
}

/** Formato de moneda en soles ("S/ 1,234.56"), el mismo que trae la plantilla. */
const FORMATO_SOLES = '"S/" #,##0.00;[Red]-"S/" #,##0.00';
function formatoSoles(ws: ExcelJS.Worksheet, addr: string): void {
  const cell = ws.getCell(addr);
  const target = cell.isMerged ? cell.master : cell;
  target.numFmt = FORMATO_SOLES;
}


// ===== Formato de Estrategia · utilidades =====

/** Marca la casilla que corresponde al valor de un select de A4. */
function marcarDeSelect(ws: ExcelJS.Worksheet, mapa: MapaCasillas, valor: string) {
  const celda = mapa[valor];
  if (celda) mark(ws, celda);
}


/**
 * Añade filas a un bloque de la plantilla conservando el formato.
 *
 * `duplicateRow` copia estilos y desplaza hacia abajo TODO lo que hay debajo,
 * contenido incluido. Lo que NO ajusta es la combinación vertical de la
 * etiqueta de la izquierda ("Fase de selección:" ocupa B135:B137), así que hay
 * que rehacerla o las filas nuevas quedan fuera del bloque.
 */
function ampliarBloque(
  ws: ExcelJS.Worksheet,
  ultimaFila: number,
  extra: number,
  merge?: { col: string; desde: number },
) {
  if (extra <= 0) return;
  ws.duplicateRow(ultimaFila, extra, true);
  if (!merge) return;
  recombinarRotuloFase(ws, merge.col, merge.desde, ultimaFila + extra);
}

/**
 * Recombina el rótulo vertical de una fase (p. ej. "Fase de selección:", columna
 * B) sobre el rango `desde..hasta`, limpiando el texto propagado en las filas
 * que no son la primera y desarmando cualquier combinación que lo pise antes.
 *
 * Separado de `ampliarBloque` porque un bloque puede necesitar este arreglo
 * SIN haber insertado filas él mismo: `volcarCronogramaYRoles` escribe de abajo
 * hacia arriba (roles → ejecución → selección) para que cada inserción posterior
 * no invalide el CONTENIDO ya escrito debajo —eso `duplicateRow` sí lo desplaza
 * bien—. Pero el rótulo de EJECUCIÓN se recombina en su propio paso, ANTES de
 * que el paso de SELECCIÓN (que va encima) inserte filas; esa inserción posterior
 * desplaza el contenido de ejecución hacia abajo pero deja su merge ya rehecho
 * DESINCRONIZADO —el mismo síntoma que describe `desarmarMerge`, aquí sobre un
 * merge que ya se había recompuesto antes de que la inserción de arriba lo
 * rompiera—, así que hay que repetir la recombinación sobre la posición FINAL.
 */
function recombinarRotuloFase(ws: ExcelJS.Worksheet, col: string, desde: number, hasta: number) {
  // El rótulo de la fase va SOLO en la primera fila del bloque: se limpia el
  // resto para que no se repita ni arrastre un valor propagado por duplicateRow.
  for (let r = desde + 1; r <= hasta; r++) {
    const cell = ws.getCell(`${col}${r}`);
    // `cell.unmerge()` directo, no `ws.unMergeCells(cell.master.address)`: ese
    // busca el merge en el diccionario interno de ExcelJS indexado por la
    // celda maestra, y `duplicateRow` puede borrar esa entrada SIN liberar a
    // la celda esclava —queda con `isMerged=true` sin que la API pública la
    // encuentre—. `unmerge()` resetea la celda misma, sin pasar por ahí.
    if (cell.isMerged) cell.unmerge();
    // `setCell` ignora "" (no pisa rótulos), así que se borra con null directo.
    ws.getCell(`${col}${r}`).value = null;
  }
  // Recombinar el rótulo en TODO el bloque (p. ej. B135:B142 cuando la selección
  // tiene 8 actividades). Antes hay que desarmar CUALQUIER combinación que
  // solape la columna del rótulo dentro del bloque. NO basta con `isMerged`:
  // `duplicateRow` deja el modelo de merges DESINCRONIZADO —quedan fantasmas
  // apuntando a filas que ahora son otras—, y en esos `isMerged` devuelve false
  // pero `mergeCells` igual falla con "Cannot merge already merged cells". Por
  // eso se barre la LISTA de merges (igual que `desarmarMerge`) y se deshace
  // todo lo que pise la columna en las filas del bloque; lo que filaCronograma
  // vuelva a necesitar (C..J) lo recompone después.
  const colRotulo = NUM_COL(col);
  const lista: string[] = (ws as unknown as { model?: { merges?: string[] } }).model?.merges ?? [];
  for (const rango of [...lista]) {
    const [ini, fin] = rango.split(":");
    const p1 = ini?.match(/([A-Z]+)(\d+)/);
    const p2 = fin?.match(/([A-Z]+)(\d+)/);
    if (!p1 || !p2) continue;
    const [mc1, mr1, mc2, mr2] = [NUM_COL(p1[1]), Number(p1[2]), NUM_COL(p2[1]), Number(p2[2])];
    const tocaColumna = mc1 <= colRotulo && mc2 >= colRotulo;
    const tocaFilas = mr1 <= hasta && mr2 >= desde;
    if (tocaColumna && tocaFilas) {
      try {
        ws.unMergeCells(rango);
      } catch {
        /* ya no estaba combinada */
      }
    }
  }
  try {
    ws.mergeCells(`${col}${desde}:${col}${hasta}`);
  } catch {
    /* se queda sin combinar */
  }
}

/** Un rango a recomponer, en filas RELATIVAS a un ancla. */
type RectanguloRelativo = { dr1: number; c1: number; dr2: number; c2: number };

/**
 * Recompone una lista de combinaciones ESTÁTICAS de la plantilla (q, r, s, t,
 * obras, III), cada una expresada en filas relativas a `filaAncla`. Mismo
 * síntoma que `recombinarRotuloFase` pero para bloques con más de una
 * combinación por sección, algunas horizontales y otras verticales: se limpia
 * cada celda que no sea la ancla del rango (el texto propagado/repetido por
 * `duplicateRow`), se desarma lo que pise cada fila y se recombina el
 * rectángulo completo.
 *
 * `filaAncla` sale de ARITMÉTICA (fila de la plantilla + desplazamiento
 * acumulado), no de buscar el rótulo por texto: con inserciones grandes
 * (varias filas de rol, por ejemplo) el propio texto puede aparecer en la
 * fila equivocada —se comprobó con datos reales—, así que localizar por texto
 * dejó de ser fiable para estos bloques.
 *
 * Las coordenadas relativas salen de leer los merges reales de la plantilla
 * en blanco (`lib/plantillas-f1/estrategia-contratacion.xlsx`), no de
 * contarlas a ojo: un error de fila aquí mezclaría el contenido de dos
 * preguntas distintas.
 */
function recombinarBloqueDesdeAncla(ws: ExcelJS.Worksheet, filaAncla: number, rects: readonly RectanguloRelativo[]) {
  for (const { dr1, c1, dr2, c2 } of rects) {
    const r1 = filaAncla + dr1;
    const r2 = filaAncla + dr2;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r === r1 && c === c1) continue;
        const cell = ws.getCell(r, c);
        // `ws.unMergeCells(cell.master.address)` NO alcanza aquí: busca el
        // merge en el diccionario interno de ExcelJS indexado por la celda
        // maestra (`_merges`), y `duplicateRow` puede borrar esa entrada SIN
        // liberar a las celdas esclavas — quedan con `isMerged=true` sin que
        // la API pública las encuentre (comprobado: la maestra decía
        // `isMerged=false` y las esclavas `isMerged=true`, apuntándole,
        // y aun así `mergeCells` fallaba con "ya combinada"). `cell.unmerge()`
        // resetea la celda misma, sin pasar por ese diccionario.
        if (cell.isMerged) cell.unmerge();
        cell.value = null;
      }
      desarmarMerge(ws, r, c1, c2);
    }
    try {
      const col = (n: number) => String.fromCharCode(64 + n); // solo hasta J (10): una letra alcanza
      ws.mergeCells(`${col(c1)}${r1}:${col(c2)}${r2}`);
    } catch {
      /* se queda sin combinar */
    }
  }
}

// Coordenadas de h), i), j), k), l), m) y n), relativas a la fila de su
// título (dr1=0, esa misma fila). Ver el comentario de
// `recombinarBloqueDesdeAncla`.
//
// Están ENTRE f)/g) (Requisitos/Factores, insertan filas) y o) (Cronograma,
// inserta más abajo): les llega el desplazamiento de f)/g) pero NO el de o)/p),
// así que se reparan con su propia aritmética (`corrimiento + corrimientoFactores`
// en `llenarEstrategia`), separada de la de q)/r)/s)/t)/obras/"III." (que sí
// cargan con los cuatro). Mismo síntoma confirmado por el usuario en producción
// que el de la sección de obras: con una tabla de Requisitos de calificación
// ampliada (más de 2 obligatorios o de 3 facultativos — algo habitual, el
// Art. 72.4 suele exigir más de dos), estos bloques quedaban sin reparar.
const RECTS_H: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "h) Modalidad de pago:"
  { dr1: 1, c1: 2, dr2: 7, c2: 2 }, // label vertical B61:B67
  { dr1: 1, c1: 3, dr2: 1, c2: 10 }, // "Marcar con una (X)…"
  { dr1: 2, c1: 3, dr2: 2, c2: 5 },
  { dr1: 2, c1: 7, dr2: 2, c2: 9 },
  { dr1: 3, c1: 3, dr2: 3, c2: 5 },
  { dr1: 3, c1: 7, dr2: 3, c2: 9 },
  { dr1: 4, c1: 3, dr2: 4, c2: 5 },
  { dr1: 4, c1: 7, dr2: 4, c2: 9 },
  { dr1: 5, c1: 3, dr2: 5, c2: 5 },
  { dr1: 5, c1: 7, dr2: 5, c2: 9 },
  { dr1: 6, c1: 3, dr2: 6, c2: 5 },
  { dr1: 6, c1: 7, dr2: 6, c2: 9 },
  { dr1: 7, c1: 3, dr2: 7, c2: 5 },
  { dr1: 7, c1: 7, dr2: 7, c2: 10 },
  { dr1: 8, c1: 2, dr2: 8, c2: 10 }, // "(*) Nota: Estas modalidades…"
  { dr1: 9, c1: 2, dr2: 9, c2: 10 }, // sustento: rótulo
  { dr1: 10, c1: 2, dr2: 10, c2: 10 }, // sustento: valor
];
const RECTS_I: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "i) Sistema de entrega:"
  { dr1: 1, c1: 2, dr2: 4, c2: 2 }, // label vertical, bienes/servicios
  { dr1: 1, c1: 3, dr2: 1, c2: 10 }, // "Marcar con una (X)…"
  { dr1: 2, c1: 3, dr2: 2, c2: 5 },
  { dr1: 2, c1: 7, dr2: 2, c2: 9 },
  { dr1: 3, c1: 3, dr2: 3, c2: 5 },
  { dr1: 3, c1: 7, dr2: 3, c2: 9 },
  { dr1: 4, c1: 3, dr2: 4, c2: 5 },
  { dr1: 4, c1: 7, dr2: 4, c2: 9 },
  { dr1: 5, c1: 2, dr2: 8, c2: 2 }, // label vertical, obras
  { dr1: 5, c1: 3, dr2: 5, c2: 10 }, // "Marcar con una (X)…"
  { dr1: 6, c1: 3, dr2: 6, c2: 5 },
  { dr1: 6, c1: 7, dr2: 6, c2: 9 },
  { dr1: 7, c1: 3, dr2: 7, c2: 5 },
  { dr1: 7, c1: 7, dr2: 7, c2: 9 },
  { dr1: 8, c1: 3, dr2: 8, c2: 5 },
  { dr1: 8, c1: 7, dr2: 8, c2: 9 },
  { dr1: 10, c1: 2, dr2: 10, c2: 10 }, // sustento: rótulo
  { dr1: 11, c1: 2, dr2: 11, c2: 10 }, // sustento: valor
  { dr1: 12, c1: 2, dr2: 12, c2: 10 }, // "(*)Uso sujeto a implementación progresiva…"
];
const RECTS_J: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "j) Puntos no negociables…"
  { dr1: 1, c1: 3, dr2: 1, c2: 10 }, // valor de los puntos no negociables
  { dr1: 2, c1: 3, dr2: 2, c2: 10 }, // sustento
  { dr1: 3, c1: 2, dr2: 3, c2: 10 }, // "(*) Esta variable se analiza…"
];
const RECTS_K: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "k) Fuente de financiamiento…"
  { dr1: 1, c1: 2, dr2: 4, c2: 2 }, // label vertical
  { dr1: 1, c1: 3, dr2: 1, c2: 10 }, // "Marcar con una (X)…"
  { dr1: 2, c1: 3, dr2: 2, c2: 5 },
  { dr1: 2, c1: 7, dr2: 2, c2: 9 },
  { dr1: 3, c1: 3, dr2: 3, c2: 5 },
  { dr1: 3, c1: 7, dr2: 3, c2: 9 },
  { dr1: 4, c1: 3, dr2: 4, c2: 5 },
  { dr1: 4, c1: 7, dr2: 4, c2: 9 },
  { dr1: 5, c1: 2, dr2: 5, c2: 4 }, // "Señalar si la cuantía…" (label, B:D)
  { dr1: 5, c1: 9, dr2: 5, c2: 10 }, // columna derecha en blanco
  { dr1: 6, c1: 2, dr2: 6, c2: 10 }, // sustento: rótulo
  { dr1: 7, c1: 2, dr2: 7, c2: 10 }, // sustento: valor
];
const RECTS_L: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "l) Garantías y adelantos:"
  { dr1: 1, c1: 2, dr2: 2, c2: 4 }, // "…fiel cumplimiento conforme a la normativa:" (B:D)
  { dr1: 1, c1: 5, dr2: 1, c2: 8 }, // "Marcar con una (X)…"
  { dr1: 1, c1: 9, dr2: 6, c2: 10 }, // columna derecha en blanco (abarca las 3 preguntas)
  { dr1: 3, c1: 2, dr2: 4, c2: 4 }, // "…fiel cumplimiento por prestaciones accesorias:"
  { dr1: 3, c1: 5, dr2: 3, c2: 8 }, // "Marcar con una (X)…"
  { dr1: 5, c1: 2, dr2: 6, c2: 4 }, // "…garantía por adelantos directos:"
  { dr1: 5, c1: 5, dr2: 5, c2: 8 }, // "Marcar con una (X)…"
  { dr1: 7, c1: 2, dr2: 7, c2: 3 }, // "Seleccionar el tipo de adelanto:"
  { dr1: 7, c1: 5, dr2: 7, c2: 8 }, // "Mecanismo de garantía a utilizar:"
  { dr1: 7, c1: 9, dr2: 7, c2: 10 }, // "Ingresar el porcentaje del adelanto:"
  { dr1: 8, c1: 2, dr2: 8, c2: 3 }, // "Adelanto directo:"
  { dr1: 8, c1: 5, dr2: 8, c2: 8 },
  { dr1: 8, c1: 9, dr2: 8, c2: 10 },
  { dr1: 9, c1: 2, dr2: 9, c2: 3 }, // "Adelanto para materiales…"
  { dr1: 9, c1: 5, dr2: 9, c2: 8 },
  { dr1: 9, c1: 9, dr2: 9, c2: 10 },
  { dr1: 10, c1: 2, dr2: 10, c2: 3 }, // "Adelanto por avance(*):"
  { dr1: 10, c1: 5, dr2: 10, c2: 8 },
  { dr1: 10, c1: 9, dr2: 10, c2: 10 },
  { dr1: 11, c1: 2, dr2: 11, c2: 10 }, // sustento: rótulo
  { dr1: 12, c1: 2, dr2: 12, c2: 10 }, // sustento: valor
  { dr1: 13, c1: 2, dr2: 13, c2: 10 }, // "(*) Solo se utilizan en el caso de ejecución de obras…"
];
const RECTS_M: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "m) Análisis del consumo histórico…"
  { dr1: 1, c1: 2, dr2: 1, c2: 4 }, // "Señalar si se contrató anteriormente…" (B:D)
  { dr1: 1, c1: 9, dr2: 1, c2: 10 }, // columna derecha en blanco
  { dr1: 2, c1: 2, dr2: 2, c2: 10 }, // sustento: valor
];
const RECTS_N: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "n) Verificación del tipo de interacción…"
  { dr1: 1, c1: 2, dr2: 7, c2: 2 }, // label vertical B120:B126
  { dr1: 1, c1: 5, dr2: 1, c2: 6 }, // "Tipo de interacción mínimo…"
  { dr1: 1, c1: 7, dr2: 1, c2: 10 }, // "Registrar la interacción que corresponda…"
  { dr1: 2, c1: 5, dr2: 2, c2: 6 }, // "Indagación básica"
  { dr1: 2, c1: 7, dr2: 7, c2: 10 }, // valor (G121, escrito en `llenarEstrategia`)
  { dr1: 3, c1: 5, dr2: 3, c2: 6 },
  { dr1: 4, c1: 5, dr2: 4, c2: 6 },
  { dr1: 5, c1: 5, dr2: 5, c2: 6 },
  { dr1: 6, c1: 5, dr2: 6, c2: 6 },
  { dr1: 7, c1: 5, dr2: 7, c2: 6 },
  { dr1: 8, c1: 2, dr2: 8, c2: 10 }, // "NOTA: La interacción con el mercado…"
  { dr1: 9, c1: 2, dr2: 9, c2: 10 }, // sustento: rótulo
  { dr1: 10, c1: 2, dr2: 10, c2: 10 }, // sustento: valor
];

// Coordenadas de q), r), s), t) y III), relativas a la fila de su título
// (dr1=0, esa misma fila). Ver el comentario de `recombinarBloqueDesdeAncla`.
const RECTS_Q: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "q) Evaluación…"
  { dr1: 1, c1: 2, dr2: 4, c2: 2 }, // B:B, label vertical
  { dr1: 1, c1: 3, dr2: 1, c2: 10 }, // "Marcar con una (X)…"
  { dr1: 2, c1: 3, dr2: 4, c2: 5 }, // "Contratación por paquete:"
  { dr1: 2, c1: 6, dr2: 4, c2: 6 }, // checkbox de paquete
  { dr1: 2, c1: 7, dr2: 2, c2: 9 }, // "…relación de ítems:"
  { dr1: 3, c1: 7, dr2: 3, c2: 9 }, // "…relación de lotes:"
  { dr1: 4, c1: 7, dr2: 4, c2: 9 }, // "…relación de tramos:"
  { dr1: 5, c1: 2, dr2: 5, c2: 10 }, // sustento: rótulo
  { dr1: 6, c1: 2, dr2: 6, c2: 10 }, // sustento: valor
];
const RECTS_R: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "r) Verificación…"
  { dr1: 1, c1: 2, dr2: 5, c2: 4 }, // label vertical
  { dr1: 1, c1: 5, dr2: 1, c2: 8 }, // "Marcar con una (X)…"
  { dr1: 1, c1: 9, dr2: 5, c2: 10 }, // columna derecha en blanco
  { dr1: 3, c1: 5, dr2: 3, c2: 8 }, // respuesta SÍ/NO
  { dr1: 4, c1: 5, dr2: 4, c2: 7 }, // "De haber indicado SI…"
  { dr1: 5, c1: 5, dr2: 5, c2: 7 }, // "Ficha técnica:" / "…homologación:"
];
// s) es tres filas simples (título, sustento, NOTA), todas B:J.
const RECTS_S: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "s) Identificación…"
  { dr1: 1, c1: 2, dr2: 1, c2: 10 }, // sustento
  { dr1: 2, c1: 2, dr2: 2, c2: 10 }, // NOTA
];
const RECTS_T: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "t) Otras variables…"
  { dr1: 1, c1: 2, dr2: 9, c2: 2 }, // label vertical, 1er bloque
  { dr1: 1, c1: 3, dr2: 1, c2: 10 },
  { dr1: 2, c1: 3, dr2: 2, c2: 10 },
  { dr1: 3, c1: 3, dr2: 3, c2: 5 },
  { dr1: 3, c1: 7, dr2: 3, c2: 9 },
  { dr1: 4, c1: 3, dr2: 4, c2: 5 },
  { dr1: 4, c1: 7, dr2: 4, c2: 9 },
  { dr1: 5, c1: 3, dr2: 5, c2: 5 },
  { dr1: 5, c1: 7, dr2: 5, c2: 9 },
  { dr1: 6, c1: 3, dr2: 6, c2: 5 },
  { dr1: 6, c1: 7, dr2: 6, c2: 9 },
  { dr1: 7, c1: 3, dr2: 7, c2: 10 },
  { dr1: 8, c1: 3, dr2: 8, c2: 5 },
  { dr1: 8, c1: 7, dr2: 8, c2: 9 },
  { dr1: 9, c1: 3, dr2: 9, c2: 5 },
  { dr1: 10, c1: 2, dr2: 10, c2: 10 }, // "[Insertar la(s) variable(s)…]"
  { dr1: 11, c1: 2, dr2: 11, c2: 10 }, // "Aspecto para la presentación de ofertas:"
  { dr1: 13, c1: 2, dr2: 17, c2: 2 }, // label vertical, 2º bloque
  { dr1: 13, c1: 3, dr2: 13, c2: 10 },
  { dr1: 14, c1: 3, dr2: 14, c2: 5 },
  { dr1: 14, c1: 7, dr2: 14, c2: 9 },
  { dr1: 15, c1: 3, dr2: 15, c2: 5 },
  { dr1: 15, c1: 7, dr2: 15, c2: 9 },
  { dr1: 16, c1: 3, dr2: 16, c2: 5 },
  { dr1: 16, c1: 7, dr2: 16, c2: 9 },
  { dr1: 17, c1: 3, dr2: 17, c2: 5 },
  { dr1: 17, c1: 7, dr2: 17, c2: 9 },
  { dr1: 18, c1: 2, dr2: 18, c2: 10 }, // "NO CORRESPONDE."
  { dr1: 19, c1: 2, dr2: 19, c2: 10 }, // "[...]"
];
const RECTS_III: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // título "III. OTRAS CONSIDERACIONES…"
  { dr1: 1, c1: 2, dr2: 2, c2: 4 }, // "Señalar si la cuantía…"
  { dr1: 1, c1: 5, dr2: 1, c2: 8 }, // "Marcar con una (X)…"
  { dr1: 1, c1: 9, dr2: 2, c2: 10 }, // columna derecha en blanco
  { dr1: 3, c1: 2, dr2: 3, c2: 10 }, // "Si seleccionó SÍ…"
  { dr1: 4, c1: 2, dr2: 4, c2: 10 }, // sustento
  { dr1: 7, c1: 2, dr2: 8, c2: 2 }, // "Fecha de elaboración:"
  { dr1: 7, c1: 3, dr2: 8, c2: 3 }, // valor de la fecha
];

// Los 10 bloques de "II. SOLO PARA OBRAS" (Art. 154.1) que quedan por debajo
// del cronograma/roles. No son un simple rótulo vertical de una columna —cada
// uno tiene su propia mezcla de sub-merges, distinta de las de q)/r)/t)—, así
// que cada uno lleva su propia tabla en vez de compartir una genérica.
//
// a) Tipo de contrato, b) BIM, d) Ejecución rápida, e) Terreno y h) Estructura
// de costos (más el título "II." en sí) faltaban aquí: solo c), f), g) e i)
// tenían tabla. Confirmado en producción con datos reales (expediente con
// cronograma/roles ampliados, consultoría de obra): a partir de la fila del
// título "II." —justo donde arranca "a) Tipo de contrato"— las celdas salían
// desincronizadas (repetidas por columna) en vez de combinadas, exactamente el
// mismo síntoma que ya se reparaba para c)/f)/g)/i) pero sin reparación propia.
// Los rangos vienen de leer los merges REALES de
// lib/plantillas-f1/estrategia-contratacion.xlsx (filas 191-242), no de ojo.
const RECTS_OBRAS_TITULO: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "II. SOLO PARA OBRAS Y CONSULTORÍA DE OBRAS…"
];
const RECTS_OBRAS_TIPO_CONTRATO: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Tipo de contrato" (sub-título)
  { dr1: 1, c1: 7, dr2: 1, c2: 10 }, // columna derecha en blanco junto a SI/NO
  { dr1: 2, c1: 2, dr2: 2, c2: 10 }, // "De haber seleccionado SI, elegir el tipo…"
  { dr1: 3, c1: 2, dr2: 3, c2: 3 }, // "Señalar el tipo de contrato…" (label, B:C)
  { dr1: 3, c1: 4, dr2: 3, c2: 10 }, // valor/desplegable del tipo de contrato
  { dr1: 4, c1: 2, dr2: 4, c2: 10 }, // "Sustento de la elección del tipo de contrato:"
  { dr1: 5, c1: 2, dr2: 5, c2: 10 }, // sustento: valor (obra_a_tipo_contrato)
  { dr1: 6, c1: 2, dr2: 6, c2: 10 }, // "(*)Uso sujeto a aprobación de pilotos…"
];
const RECTS_OBRAS_BIM: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Necesidad de emplear la metodología BIM" (sub-título)
  { dr1: 1, c1: 2, dr2: 1, c2: 6 }, // pregunta + SI/NO (label, B:F)
  { dr1: 2, c1: 2, dr2: 2, c2: 10 }, // "Sustento de la necesidad de emplear…"
  { dr1: 3, c1: 2, dr2: 3, c2: 10 }, // sustento: valor (obra_b_bim)
];
const RECTS_OBRAS_FAST_TRACK: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Posibilidad de ejecutar la obra mediante…" (sub-título)
  { dr1: 1, c1: 2, dr2: 1, c2: 6 }, // pregunta + SI/NO (label, B:F)
  { dr1: 2, c1: 2, dr2: 2, c2: 10 }, // "Sustento para ejecutar la obra mediante…"
  { dr1: 3, c1: 2, dr2: 3, c2: 10 }, // sustento: valor (obra_d_fast_track)
  { dr1: 4, c1: 2, dr2: 4, c2: 10 }, // "NOTA: Solo se puede usar ejecución rápida…"
];
const RECTS_OBRAS_TERRENO: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Sustento de la disponibilidad física del terreno…"
  { dr1: 1, c1: 2, dr2: 1, c2: 10 }, // "Sustento para la disponibilidad física…"
  { dr1: 2, c1: 2, dr2: 2, c2: 10 }, // sustento: valor (obra_e_terreno)
  { dr1: 3, c1: 2, dr2: 3, c2: 10 }, // "NOTA: En el caso de usar el sistema solo…"
];
const RECTS_OBRAS_ESTRUCTURA_COSTOS: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Estructura de costos, que puede ser actu…" (sub-título)
  { dr1: 1, c1: 2, dr2: 1, c2: 6 }, // pregunta + SI/NO (label, B:F)
  { dr1: 2, c1: 2, dr2: 2, c2: 10 }, // "Sustento de la actualización de la estru…"
  { dr1: 3, c1: 2, dr2: 3, c2: 10 }, // sustento: valor (obra_h_estructura_costos)
  { dr1: 4, c1: 2, dr2: 4, c2: 10 }, // "NOTA: Este sustento solo se utiliza en e…"
];
const RECTS_OBRAS_INCENTIVOS: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Propuesta de incentivos por beneficios…" (sub-título)
  { dr1: 1, c1: 2, dr2: 2, c2: 3 }, // "Cumplimiento anticipado…" (label, B:C)
  { dr1: 1, c1: 4, dr2: 1, c2: 7 },
  { dr1: 1, c1: 8, dr2: 4, c2: 10 },
  { dr1: 3, c1: 2, dr2: 3, c2: 3 },
  { dr1: 4, c1: 2, dr2: 4, c2: 3 },
  { dr1: 5, c1: 2, dr2: 5, c2: 10 }, // sustento: rótulo
  { dr1: 6, c1: 2, dr2: 6, c2: 10 }, // sustento: valor
];
const RECTS_OBRAS_LICENCIAS: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Plan para la obtención de las licencias…" (sub-título)
  { dr1: 1, c1: 2, dr2: 4, c2: 6 }, // "…licencias, autorizaciones…" (label, B:F, 4 filas)
  { dr1: 1, c1: 7, dr2: 1, c2: 10 },
  { dr1: 3, c1: 7, dr2: 3, c2: 10 },
  { dr1: 5, c1: 2, dr2: 5, c2: 10 }, // sustento: rótulo
  { dr1: 6, c1: 2, dr2: 6, c2: 10 }, // sustento: valor
];
const RECTS_OBRAS_RESPONSABLE: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Determinación del responsable de la elaboración…" (sub-título)
  { dr1: 1, c1: 2, dr2: 2, c2: 4 }, // "Señalar el responsable:" (label, B:D)
  { dr1: 1, c1: 5, dr2: 1, c2: 10 },
  { dr1: 3, c1: 2, dr2: 3, c2: 10 }, // sustento: rótulo
  { dr1: 4, c1: 2, dr2: 4, c2: 10 }, // sustento: valor
];
const RECTS_OBRAS_METODOLOGIAS: readonly RectanguloRelativo[] = [
  { dr1: 0, c1: 2, dr2: 0, c2: 10 }, // "Metodologías colaborativas que contribuyen…" (sub-título)
  { dr1: 1, c1: 2, dr2: 2, c2: 6 }, // "…metodologías colaborativas…" (label, B:F, 2 filas)
  { dr1: 1, c1: 7, dr2: 1, c2: 10 },
  { dr1: 3, c1: 7, dr2: 3, c2: 9 },
  { dr1: 4, c1: 2, dr2: 4, c2: 10 }, // sustento: rótulo
  { dr1: 5, c1: 2, dr2: 5, c2: 10 }, // sustento: valor
];

/**
 * Fecha del cronograma en dd/mm/aaaa.
 *
 * Deja pasar el texto libre a propósito: el formato firmado usa "SEGÚN BASES"
 * en la ejecución contractual, que no tiene fecha cierta.
 */
function fechaCronograma(v: string | undefined): string {
  if (!v?.trim()) return "";
  // Puede venir como "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm": se imprime la fecha y, si
  // trae hora, se añade "dd/mm/aaaa HH:mm".
  const [fecha, hora] = v.trim().split("T");
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v.trim();
  const corta = d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return hora ? `${corta} ${hora.slice(0, 5)}` : corta;
}

/**
 * Escribe una actividad en su fila (C actividad, G inicio, I fin). En la fase de
 * ejecución contractual (`segunBases`) las dos columnas de fecha llevan "SEGÚN
 * BASES": no se fija fecha cierta en la estrategia.
 */
function filaCronograma(
  ws: ExcelJS.Worksheet,
  fila: number,
  a: ActividadCronograma,
  segunBases = false,
) {
  // La actividad ocupa C:F y cada fecha G:H / I:J, como en las filas impresas.
  // Se desarma lo que estorbe (combinaciones fantasma de duplicateRow), se
  // limpia el texto propagado de la plantilla ("[...]") y se recompone: así la
  // fila insertada queda alineada con la cabecera Fase | Actividad | Inicio | Fin.
  desarmarMerge(ws, fila, 3, 10); // C..J
  // `setCell` ignora "" (no pisa rótulos), así que para BORRAR se escribe null.
  for (const col of ["D", "E", "F", "H", "J"]) ws.getCell(`${col}${fila}`).value = null;
  setCell(ws, `${COL_CRONOGRAMA.actividad}${fila}`, a.actividad ?? "");
  setCell(ws, `${COL_CRONOGRAMA.inicio}${fila}`, segunBases ? CRONOGRAMA_SEGUN_BASES : fechaCronograma(a.inicio));
  setCell(ws, `${COL_CRONOGRAMA.fin}${fila}`, segunBases ? CRONOGRAMA_SEGUN_BASES : fechaCronograma(a.fin));
  armarMerge(ws, fila, 3, 6); // C:F actividad
  armarMerge(ws, fila, 7, 8); // G:H inicio
  armarMerge(ws, fila, 9, 10); // I:J fin
}

/**
 * o) Cronograma y p) Roles (Art. 46.1.o y 46.1.p).
 *
 * Las dos son tablas y la plantilla se queda corta: trae 3 filas de selección,
 * 3 de ejecución y 2 de roles, mientras que el formato firmado por la entidad
 * tiene 6, 3 y 5. Así que se insertan filas.
 *
 * El ORDEN es lo único delicado: se rellena de ABAJO hacia ARRIBA (roles →
 * ejecución → selección). Insertar filas desplaza todo lo de debajo, contenido
 * incluido, así que escribiendo primero lo de abajo cada inserción posterior lo
 * arrastra intacto y ninguna dirección se invalida a mitad del proceso.
 */
function volcarCronogramaYRoles(ws: ExcelJS.Worksheet, a4: Record<string, unknown>): number {
  const items = leerFilas<ActividadCronograma>(a4.cronograma_items);
  const roles = leerFilas<RolEstrategia>(a4.roles_items);
  const de = (f: string) => items.filter((i) => i.fase === f);
  // Cuántas filas EXTRA metió cada bloque (0 si no insertó ninguna): la suma es
  // el desplazamiento acumulado que sufre TODO lo que queda por debajo de p)
  // roles —q), r), s), t), la sección de obras y "III."—. Lo devuelve la
  // función para que quien repare esos bloques use ARITMÉTICA (plantilla +
  // desplazamiento) en vez de buscarlos por texto: con inserciones grandes el
  // propio texto puede aparecer desincronizado (ver `alinearRotulosApartados`).
  const extraRoles = roles.length > 0 ? Math.max(0, roles.length - FILAS_ROLES_PLANTILLA) : 0;

  // 1) Roles (el bloque más bajo).
  if (roles.length > 0) {
    ampliarBloque(ws, FILA_ROLES_INICIO + FILAS_ROLES_PLANTILLA - 1, roles.length - FILAS_ROLES_PLANTILLA);
    roles.forEach((r, i) => {
      const fila = FILA_ROLES_INICIO + i;
      // El rol ocupa B:E y la etapa F:J. Igual que en el cronograma, las filas
      // insertadas pierden la combinación: se desarma, se limpia lo propagado y
      // se recompone para que queden alineadas con la cabecera Rol | Etapa.
      desarmarMerge(ws, fila, 2, 10); // B..J
      for (const col of ["C", "D", "E", "G", "H", "I", "J"]) ws.getCell(`${col}${fila}`).value = null;
      setCell(ws, `B${fila}`, r.rol ?? "");
      const etapa = ETAPAS_ROL.find((e) => e.value === r.etapa);
      setCell(ws, `F${fila}`, etapa?.label ?? r.etapa ?? "");
      armarMerge(ws, fila, 2, 5); // B:E rol y responsabilidad
      armarMerge(ws, fila, 6, 10); // F:J etapa
    });
  }

  // 2) Ejecución contractual.
  const ejecucion = de("ejecucion");
  const filasEje = FILAS_CRONOGRAMA.ejecucion;
  const extraEjecucion = ejecucion.length > 0 ? Math.max(0, ejecucion.length - filasEje.length) : 0;
  if (ejecucion.length > 0) {
    ampliarBloque(ws, filasEje[filasEje.length - 1], ejecucion.length - filasEje.length, {
      col: "B",
      desde: filasEje[0],
    });
    // "SEGÚN BASES" SOLO en la actividad "Ejecución contractual" (su plazo lo
    // fijan las bases); el resto de la fase (presentación de requisitos,
    // suscripción del contrato) sí lleva sus fechas.
    ejecucion.forEach((a, i) => filaCronograma(ws, filasEje[0] + i, a, esActividadSegunBases(a.actividad)));
    // Filas de plantilla sobrantes (menos actividades que filas): se limpia su
    // placeholder ("[Insertar…]" / "[...]") para que no salga en el documento.
    for (let i = ejecucion.length; i < filasEje.length; i++) {
      for (const col of ["C", "D", "E", "F"]) ws.getCell(`${col}${filasEje[i]}`).value = null;
    }
  }

  // 3) Selección.
  const seleccion = de("seleccion");
  const filasSel = FILAS_CRONOGRAMA.seleccion;
  const extraSeleccion = seleccion.length > 0 ? Math.max(0, seleccion.length - filasSel.length) : 0;
  if (seleccion.length > 0) {
    ampliarBloque(ws, filasSel[filasSel.length - 1], seleccion.length - filasSel.length, {
      col: "B",
      desde: filasSel[0],
    });
    seleccion.forEach((a, i) => filaCronograma(ws, filasSel[0] + i, a));
    for (let i = seleccion.length; i < filasSel.length; i++) {
      for (const col of ["C", "D", "E", "F"]) ws.getCell(`${col}${filasSel[i]}`).value = null;
    }
  }

  // El rótulo "Fase de ejecución contractual:" (recombinado arriba, en el paso
  // 2, sobre su posición de ENTONCES) queda desincronizado en cuanto CUALQUIER
  // inserción posterior lo desplaza —selección aquí mismo, y más abajo también
  // f)/g) (que insertan MÁS ARRIBA y por eso corren al final de
  // `llenarEstrategia`)—. Repararlo aquí solo cubriría el desplazamiento de
  // selección y quedaría roto otra vez si f)/g) insertan algo: por eso NO se
  // repite aquí; `alinearRotulosApartados` lo localiza por TEXTO después de que
  // TODAS las inserciones (o, p, f, g) ya ocurrieron, igual que ya hace con
  // p)/q)/r).

  // 4) Actuaciones preparatorias: sus dos actividades vienen impresas en la
  // plantilla, así que solo se ponen las fechas.
  de("preparatorias")
    .slice(0, FILAS_CRONOGRAMA.preparatorias.length)
    .forEach((a, i) => {
      const fila = FILAS_CRONOGRAMA.preparatorias[i];
      setCell(ws, `${COL_CRONOGRAMA.inicio}${fila}`, fechaCronograma(a.inicio));
      setCell(ws, `${COL_CRONOGRAMA.fin}${fila}`, fechaCronograma(a.fin));
    });

  return extraRoles + extraEjecucion + extraSeleccion;
}

// Fila de cada título/bloque EN LA PLANTILLA EN BLANCO (sin ninguna
// inserción todavía) — ver el comentario de `recombinarBloqueDesdeAncla`.
//
// h) a n) van ANTES del cronograma: solo cargan con el desplazamiento de f)/g)
// (ver `BLOQUES_FG` y su uso en `llenarEstrategia`), no con el de o)/p).
const FILA_PLANTILLA_H = 60;
const FILA_PLANTILLA_I = 72;
const FILA_PLANTILLA_J = 86;
const FILA_PLANTILLA_K = 91;
const FILA_PLANTILLA_L = 100;
const FILA_PLANTILLA_M = 115;
const FILA_PLANTILLA_N = 119;
const BLOQUES_FG: ReadonlyArray<{ fila: number; rects: readonly RectanguloRelativo[] }> = [
  { fila: FILA_PLANTILLA_H, rects: RECTS_H },
  { fila: FILA_PLANTILLA_I, rects: RECTS_I },
  { fila: FILA_PLANTILLA_J, rects: RECTS_J },
  { fila: FILA_PLANTILLA_K, rects: RECTS_K },
  { fila: FILA_PLANTILLA_L, rects: RECTS_L },
  { fila: FILA_PLANTILLA_M, rects: RECTS_M },
  { fila: FILA_PLANTILLA_N, rects: RECTS_N },
];
const FILA_PLANTILLA_Q = 150;
const FILA_PLANTILLA_R = 158;
const FILA_PLANTILLA_S = 165;
const FILA_PLANTILLA_T = 169;
const FILA_PLANTILLA_III = 251;
// Fila de cada bloque de "II. SOLO PARA OBRAS" EN LA PLANTILLA, con su tabla
// de combinaciones (`RECTS_OBRAS_*`, arriba). No los crea el código: vienen
// combinados así en la plantilla, y quedan igual de expuestos a la
// desincronización que los de arriba.
const BLOQUES_OBRAS: ReadonlyArray<{ fila: number; rects: readonly RectanguloRelativo[] }> = [
  { fila: 191, rects: RECTS_OBRAS_TITULO },
  { fila: 192, rects: RECTS_OBRAS_TIPO_CONTRATO },
  { fila: 200, rects: RECTS_OBRAS_BIM },
  { fila: 205, rects: RECTS_OBRAS_INCENTIVOS },
  { fila: 213, rects: RECTS_OBRAS_FAST_TRACK },
  { fila: 219, rects: RECTS_OBRAS_TERRENO },
  { fila: 224, rects: RECTS_OBRAS_LICENCIAS },
  { fila: 232, rects: RECTS_OBRAS_RESPONSABLE },
  { fila: 238, rects: RECTS_OBRAS_ESTRUCTURA_COSTOS },
  { fila: 244, rects: RECTS_OBRAS_METODOLOGIAS },
];

/**
 * Repara p) roles, el cronograma de EJECUCIÓN + su NOTA, q), r), s), t), los
 * rótulos de "II. SOLO PARA OBRAS" y "III.": son los bloques que quedan por
 * debajo de alguna inserción de fila (o, p, f o g) y por eso `duplicateRow`
 * puede dejar su combinación desincronizada — la celda dice `isMerged=false`
 * (o queda repetida por columna) aunque el archivo final, guardado y
 * releído, sí la tenga bien. También alinea a la IZQUIERDA y pone en NEGRITA
 * (hasta el primer ":") los rótulos de tabla y de sustento de p)/q)/r), que
 * vienen centrados y sin negrita en la plantilla.
 *
 * `desplazamiento` es la suma de filas EXTRA que metieron o), p), f) y g)
 * juntas (ver `llenarEstrategia`): p) roles y el cronograma se localizan por
 * TEXTO (funciona incluso con inserciones grandes, comprobado con datos
 * reales), pero q)/r)/s)/t)/obras/"III." se localizan por ARITMÉTICA — fila
 * de la plantilla en blanco + `desplazamiento` —, no por texto: con una
 * inserción grande (muchos roles, por ejemplo) el propio texto puede aparecer
 * en la fila equivocada, y buscarlo dejó de ser fiable.
 */
function alinearRotulosApartados(ws: ExcelJS.Worksheet, desplazamiento: number): void {
  const norm = (r: number) => textoDeCelda(ws.getCell(`B${r}`)).replace(/\s+/g, " ").trim();
  const alaIzquierda = (r: number) => {
    const cell = ws.getCell(`B${r}`);
    const target = cell.isMerged ? cell.master : cell;
    target.alignment = { ...target.alignment, horizontal: "left" };
    // El rótulo hasta ":" en negrita (si la celda tiene uno). Un rótulo entero
    // "…:" queda todo en negrita; una celda sin ":" (un valor) se deja como está.
    const texto = textoDeCelda(target);
    if (/^[^:\n]{1,80}:/.test(texto)) target.value = conRotulosEnNegrita(texto, target.font ?? {});
  };

  // Rótulos a localizar por texto (primera aparición = celda maestra de su merge).
  const ROTULO_ROL = "Rol y responsabilidad:";
  const ROTULO_ROL_SUSTENTO = "Sustento para la asignación de roles y responsabilidades:";
  // "Fase de ejecución contractual:" (o) es EL ÚNICO rótulo del cronograma que
  // este paso repara: su span NO es fijo (depende de cuántas actividades tenga
  // esa fase), así que se calcula hasta la fila de la NOTA fija que lo cierra,
  // en vez de recibir un número de filas como los de abajo.
  const ROTULO_EJECUCION = "Fase de ejecución contractual:";
  const ROTULO_NOTA_CRONOGRAMA =
    "NOTA: El cronograma estimado del proceso de contratación debe considerar las actividades de acuerdo al tipo de procedimiento y al objeto contractual de la contratación.";
  const fila: Record<string, number> = {};
  for (let r = 1; r <= ws.rowCount; r++) {
    const t = norm(r);
    if (!(t in fila) && (t === ROTULO_ROL || t === ROTULO_ROL_SUSTENTO || t === ROTULO_EJECUCION || t === ROTULO_NOTA_CRONOGRAMA)) {
      fila[t] = r;
    }
  }
  if (fila[ROTULO_EJECUCION] != null && fila[ROTULO_NOTA_CRONOGRAMA] != null) {
    const desde = fila[ROTULO_EJECUCION];
    const hasta = fila[ROTULO_NOTA_CRONOGRAMA] - 1;
    recombinarRotuloFase(ws, "B", desde, hasta);
    // No basta con el rótulo (columna B): las combinaciones POR FILA de cada
    // actividad de ejecución (C:F actividad, G:H inicio, I:J fin), armadas en
    // `filaCronograma` durante el paso 2 de `volcarCronogramaYRoles`, quedan
    // IGUAL de desincronizadas que el rótulo por la inserción de selección —
    // se comprobó con datos reales: el rótulo salía bien pero cada celda de la
    // fila aparecía repetida en vez de combinada. Se rearman aquí, en la
    // posición FINAL, igual que el rótulo.
    for (let r = desde; r <= hasta; r++) {
      desarmarMerge(ws, r, 3, 10); // C..J
      armarMerge(ws, r, 3, 6); // C:F actividad
      armarMerge(ws, r, 7, 8); // G:H inicio
      armarMerge(ws, r, 9, 10); // I:J fin
    }
    // La fila de la NOTA misma (B:J, una sola fila, todo el ancho de la tabla)
    // es TAMBIÉN una combinación de la plantilla que queda por debajo de la
    // inserción de selección: mismo síntoma, celda por columna en vez de una
    // combinada. `recombinarRotuloFase` es para combinaciones VERTICALES (una
    // columna, varias filas) y esta es HORIZONTAL (una fila, varias columnas),
    // así que se rearma directo con desarmarMerge/armarMerge, como una fila
    // más de `filaCronograma` pero de B a J en vez de por bloques.
    const filaNota = fila[ROTULO_NOTA_CRONOGRAMA];
    desarmarMerge(ws, filaNota, 2, 10); // B..J
    armarMerge(ws, filaNota, 2, 10);
  }

  // p) Roles: el título, los dos rótulos, las filas de rol de en medio y el
  // valor del sustento. A diferencia de ejecución/q)/r)/s)/t), este bloque
  // nunca recibía recomposición de merges — solo `alaIzquierda`, que asume que
  // el merge sigue intacto. Confirmado en producción con datos reales:
  // `duplicateRow` lo deja partido en 9 celdas repetidas por columna, igual
  // que los demás bloques. Se repara aquí, por texto, con el mismo patrón
  // robusto de `cell.unmerge()` directo que usa `recombinarBloqueDesdeAncla`
  // (ver su comentario): `desarmarMerge`/`ws.unMergeCells` solos no alcanzan.
  const repararFilaAncho = (r: number, c1: number, c2: number) => {
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      if (cell.isMerged) cell.unmerge();
      if (c !== c1) cell.value = null;
    }
    desarmarMerge(ws, r, c1, c2);
    armarMerge(ws, r, c1, c2);
  };
  const rH = fila[ROTULO_ROL];
  const rS = fila[ROTULO_ROL_SUSTENTO];
  if (rH != null && rS != null) {
    repararFilaAncho(rH - 1, 2, 10); // título "p) Los roles y responsabilidades…"
    for (let r = rH; r < rS; r++) {
      repararFilaAncho(r, 2, 5); // B:E rol / rótulo "Rol y responsabilidad:"
      repararFilaAncho(r, 6, 10); // F:J etapa / rótulo "Etapa de la fase de selección:"
    }
    repararFilaAncho(rS, 2, 10); // rótulo del sustento
    repararFilaAncho(rS + 1, 2, 10); // valor del sustento
  }
  if (rH != null) alaIzquierda(rH);
  if (rS != null) {
    alaIzquierda(rS);
    alaIzquierda(rS + 1); // valor del sustento
  }
  if (rH != null && rS != null) {
    for (let r = rH + 1; r < rS; r++) alaIzquierda(r); // filas de rol
  }

  // q), r), s), t), obras y "III.": aritmética, no texto (ver el comentario
  // de la función). `alaIzquierda` en los rótulos que la plantilla trae
  // centrados; los que ya vienen a la izquierda (títulos "q) …:", "r) …:") no
  // necesitan el retoque, solo la recomposición del merge.
  const anclaQ = FILA_PLANTILLA_Q + desplazamiento;
  recombinarBloqueDesdeAncla(ws, anclaQ, RECTS_Q);
  alaIzquierda(anclaQ + 1); // "Seleccionar el tipo de agrupación de prestaciones:"
  alaIzquierda(anclaQ + 5); // sustento: rótulo
  alaIzquierda(anclaQ + 6); // sustento: valor

  const anclaR = FILA_PLANTILLA_R + desplazamiento;
  recombinarBloqueDesdeAncla(ws, anclaR, RECTS_R);
  alaIzquierda(anclaR + 1); // "Señalar si el requerimiento se encuentra estandarizado:"

  recombinarBloqueDesdeAncla(ws, FILA_PLANTILLA_S + desplazamiento, RECTS_S);
  recombinarBloqueDesdeAncla(ws, FILA_PLANTILLA_T + desplazamiento, RECTS_T);
  recombinarBloqueDesdeAncla(ws, FILA_PLANTILLA_III + desplazamiento, RECTS_III);
  for (const { fila: filaObra, rects } of BLOQUES_OBRAS) {
    recombinarBloqueDesdeAncla(ws, filaObra + desplazamiento, rects);
  }
}


/**
 * f) Requisitos de calificación (Art. 46.1.f).
 *
 * La OBLIGATORIEDAD la fija la matriz de las bases estándar (Art. 72.4,
 * `requisitosDeProcedimiento`), no el marcado manual: la norma manda qué es
 * obligatorio según el procedimiento. Los FACULTATIVOS sí son elección de la DEC
 * y salen de lo que registró (con su sustento). El formato los pide fila a fila.
 */
function volcarRequisitos(
  ws: ExcelJS.Worksheet,
  raw: string,
  matriz: Record<TipoRequisitoArt72, EstadoRequisito>,
  precalif: boolean,
) {
  const parsed = parseRequisitos(raw);
  const facultativos = parsed.facultativos;
  // Obligatorios: los que fija la matriz, en el orden del Art. 72.3. Cada uno con
  // el DETALLE que registró la DEC (para que la previa coincida con el frontend)
  // más su nota de obligatoriedad. La experiencia del postor cae en el 2.º renglón
  // (B45) en licitación/concurso/comparación.
  const detallePorTipo = repartirRequisitos(parsed).porTipo;
  const obligatorios = TIPOS_REQUISITO_ART72.filter((t) => matriz[t.key] === "obligatorio").map((t) =>
    textoRequisitoObligatorio(t.key, detallePorTipo.get(t.key)?.detalle ?? ""),
  );
  // Facultativos: los que marcó la DEC, salvo (a) el que la matriz ya vuelve
  // obligatorio —para no duplicarlo— y (b) la capacidad económica cuando no hay
  // precalificación, que es la única etapa donde ese requisito aplica.
  const facult = facultativos.filter((req) => {
    const tipo = tipoArt72DeNombre(req.nombre);
    if (tipo && matriz[tipo] === "obligatorio") return false;
    if (!precalif && tipo === "capacidad_economica") return false;
    return true;
  });

  const o = FILAS_REQUISITOS.obligatorios;
  ampliarBloque(ws, o.desde + o.cuantas - 1, obligatorios.length - o.cuantas);
  obligatorios.forEach((nombre, i) => setCell(ws, `${o.colNombre}${o.desde + i}`, nombre));

  // Los facultativos van más abajo, así que se escriben ANTES de ampliar los
  // obligatorios… pero ampliarBloque ya los habrá desplazado. Se recalcula el
  // desplazamiento en vez de asumirlo.
  const corrimiento = Math.max(0, obligatorios.length - o.cuantas);
  const f = FILAS_REQUISITOS.facultativos;
  const desdeF = f.desde + corrimiento;
  ampliarBloque(ws, desdeF + f.cuantas - 1, facult.length - f.cuantas);
  facult.forEach((req, i) => {
    setCell(ws, `${f.colNombre}${desdeF + i}`, req.nombre);
    setCell(ws, `${f.colSustento}${desdeF + i}`, req.sustento);
  });
  // Los facultativos son OPCIONALES: si la DEC no incluye ninguno (o menos que
  // las filas de la plantilla), esas filas no deben salir con el marcador
  // "[Insertar nombre…]" literal. Se limpian; en la primera, si no hay ninguno,
  // se deja constancia de que no se establecen (Art. 72.4: son elección de la DEC).
  // `setCell` ignora la cadena vacía (no pisaría el marcador), así que se vacía
  // la celda directamente.
  const limpiar = (addr: string) => {
    const c = ws.getCell(addr);
    (c.isMerged ? c.master : c).value = null;
  };
  for (let i = facult.length; i < f.cuantas; i++) {
    if (i === 0) setCell(ws, `${f.colNombre}${desdeF + i}`, "No se establecen requisitos de calificación facultativos.");
    else limpiar(`${f.colNombre}${desdeF + i}`);
    limpiar(`${f.colSustento}${desdeF + i}`);
  }
  return corrimiento + Math.max(0, facult.length - f.cuantas);
}

/**
 * g) Factores de evaluación (Art. 46.1.g): tabla nombre + sustento.
 *
 * Devuelve cuántas filas EXTRA metió (0 si no insertó ninguna), para sumarla
 * al desplazamiento total que arrastran q), r), s), t), la sección de obras y
 * "III." — ver `volcarCronogramaYRoles` y `recombinarBloquesFinales`.
 */
function volcarFactores(ws: ExcelJS.Worksheet, a4: Record<string, unknown>, corrimiento: number): number {
  const factores = leerFilas<FactorEvaluacion>(a4.factores_items);
  const desde = FILAS_FACTORES.desde + corrimiento;
  // Sin factores propuestos (p. ej. subasta inversa o comparación de precios, que
  // van por menor monto sin factores técnicos, Art. 74.3): en vez de dejar los
  // marcadores "[Insertar…]" —que en el formato firmado se leen como un olvido—,
  // se escribe NO CORRESPONDE en la primera fila (nombre y sustento) y se OCULTAN
  // las otras dos filas de plantilla, para que el apartado quede resuelto explícito.
  if (factores.length === 0) {
    setCell(ws, `${FILAS_FACTORES.colNombre}${desde}`, "NO CORRESPONDE");
    setCell(ws, `${FILAS_FACTORES.colSustento}${desde}`, "NO CORRESPONDE");
    for (let i = 1; i < FILAS_FACTORES.cuantas; i += 1) ws.getRow(desde + i).hidden = true;
    return 0;
  }
  // Un factor por fila desde la 56: el 1.º en la 56, el 2.º en la 57, etc. Si hay
  // MÁS que las 3 filas de plantilla, `ampliarBloque` inserta las que falten.
  ampliarBloque(ws, desde + FILAS_FACTORES.cuantas - 1, factores.length - FILAS_FACTORES.cuantas);
  factores.forEach((f, i) => {
    setCell(ws, `${FILAS_FACTORES.colNombre}${desde + i}`, f.nombre ?? "");
    setCell(ws, `${FILAS_FACTORES.colSustento}${desde + i}`, f.sustento ?? "");
  });
  // Si hay MENOS factores que las 3 filas de plantilla (1 o 2), se ocultan las
  // sobrantes para no dejarlas con el marcador "[Insertar…]".
  for (let i = factores.length; i < FILAS_FACTORES.cuantas; i += 1) ws.getRow(desde + i).hidden = true;
  return Math.max(0, factores.length - FILAS_FACTORES.cuantas);
}

/**
 * j) Puntos no negociables (Art. 46.1.j): tabla de dos columnas. Los PUNTOS van
 * a la celda C87 ("Puntos no negociables") y sus SUSTENTOS a C88 ("Sustento:"),
 * numerados cuando hay más de uno para que ambas columnas se correspondan.
 */
function volcarPuntosNoNegociables(ws: ExcelJS.Worksheet, value: unknown) {
  // Compatibilidad: un valor de texto heredado (j) era textarea) se vuelca como
  // un único punto sin sustento.
  const base =
    typeof value === "string" && value.trim()
      ? [{ punto: value.trim() } as PuntoNoNegociable]
      : leerFilas<PuntoNoNegociable>(value);
  const filas = base.filter((p) => (p.punto ?? "").trim() || (p.sustento ?? "").trim());
  if (filas.length === 0) return;
  const columna = (get: (p: PuntoNoNegociable) => string | undefined) =>
    filas.map((p, i) => `${filas.length > 1 ? `${i + 1}. ` : ""}${(get(p) ?? "").trim()}`).join("\n");
  setCell(ws, "C87", columna((p) => p.punto));
  setCell(ws, "C88", columna((p) => p.sustento));
}

// ===== Formato de Estrategia de Contratación =====
function llenarEstrategia(
  ws: ExcelJS.Worksheet,
  proceso: ProcesoExport,
  hitos: HitosMap,
  necesidad?: NecesidadExport | null,
  usuarioDescarga?: string | null,
) {
  const a4 = hitos.A4?.data ?? {};
  const a2 = hitos.A2?.data ?? {};
  const a1 = hitos.A1?.data ?? {};
  const a3 = hitos.A3?.data ?? {};
  const a5 = hitos.A5?.data ?? {};
  // Objeto de la estrategia (obra vs bien/servicio), de la fuente más fiable:
  // la necesidad, luego el expediente, luego la segmentación. Se usa para la
  // casilla II) y para ocultar el bloque de obras (Art. 154).
  const objetoEstrategia = (necesidad?.tipo_objeto || proceso.object_type || String(a2.objeto ?? "")).toLowerCase();

  // Texto impreso en la plantilla EN BLANCO (ws aún sin rellenar). Sirve para que
  // el ajuste de alturas distinga un RÓTULO estático —que no debe crecer más de lo
  // que el formato oficial ya le reservó, o lo INFLA— de una celda con DATOS del
  // usuario (o el "NO CORRESPONDE." que reemplaza al marcador), que sí puede crecer
  // para no cortar el texto. Se compara por TEXTO, no por dirección, porque el
  // cronograma inserta filas y desplazaría cualquier índice.
  const textosPlantilla = new Set<string>();
  for (let r = 1; r <= ws.rowCount; r += 1) {
    for (let c = 1; c <= 11; c += 1) {
      const t = textoDeCelda(ws.getCell(r, c)).replace(/\s+/g, " ").trim();
      if (t) textosPlantilla.add(t);
    }
  }

  // Cada variable a)–t): su sustento va en la celda "[Insertar sustento…]".

  // b) El análisis del no competitivo (B13). Si en b) se respondió que NO se
  // sustenta el no competitivo, es una contratación COMPETITIVA: el análisis no
  // aplica → "NO CORRESPONDE.", aunque hubiera quedado texto residual en el campo.
  // Si se respondió SÍ (o está sin responder), va el análisis; vacío → la limpieza
  // pone "NO CORRESPONDE." de todos modos.
  setCell(
    ws,
    "B13",
    str(a4, "si_sustenta_no_competitivo") === "no" ? NO_CORRESPONDE : str(a4, "var_b_no_competitivo"),
  );
  // b) El documento del área usuaria/ATE que sustenta el no competitivo lo registra
  // A1 (documento_causal_art_55); A4 solo lo analiza, por eso no hay campo suyo en
  // A4. Se traslada a E10, pero SOLO si hay causal del Art. 55: en un competitivo
  // b) no aplica y la celda sale "NO CORRESPONDE.", igual que el formulario de A1
  // (mismo criterio que su `noCorrespondeSalvoQue`). Así un documento residual de
  // una prueba no se cuela cuando la contratación es competitiva.
  const documentoNoCompetitivo = str(a1, "causal_art_55") ? str(a1, "documento_causal_art_55") : "";
  setCell(ws, "E10", documentoNoCompetitivo || NO_CORRESPONDE);
  setCell(ws, "B33", str(a4, "var_d_modalidad_eficiente"));
  // e) Perfil del evaluador: los rótulos de cada párrafo ("Especialización
  // Técnica:", "Eficiencia Operativa:", "Facultad Consultiva:", y los del comité/
  // jurado) van en NEGRITA. Se escribe como richText conservando la fuente de la
  // plantilla; si está vacío se deja el marcador para que la limpieza ponga "NO
  // CORRESPONDE.".
  const perfilEvaluador = str(a4, "var_e_perfil_evaluador");
  if (perfilEvaluador) {
    const b40 = ws.getCell("B40");
    b40.value = conRotulosEnNegrita(perfilEvaluador, fuenteBaseDe(b40));
  }
  // B70 es la celda "[Insertar sustento de la elección de la modalidad de pago]".
  // Consigna la NORMATIVA de la modalidad seleccionada (Art. 130 bienes/servicios,
  // Art. 286 contingencia). El sustento de A4 ya suele traerla (se auto-carga al
  // elegir la modalidad), así que solo se antepone cuando NO la incluye ya, para
  // no duplicarla. La modalidad en sí se marca aparte en su casilla (F62..F67).
  const normaPago = NORMA_MODALIDAD_PAGO[str(a4, "var_h_modalidad_pago")] ?? "";
  const sustentoPago = str(a4, "var_h_sustento_pago");
  setCell(
    ws,
    "B70",
    normaPago && sustentoPago.includes(normaPago)
      ? sustentoPago
      : [normaPago, sustentoPago].filter(Boolean).join("\n"),
  );
  // B83 es "[Insertar sustento de la elección del sistema de entrega]". Igual que
  // B70: lleva la NORMATIVA del sistema seleccionado (Art. 129 bienes/servicios,
  // Art. 158 obras) y, si la DEC la editó/amplió, su texto — sin duplicar la norma
  // cuando el sustento ya la trae (se auto-carga al elegir el sistema en A4). El
  // sistema en sí se marca aparte en su casilla (F74..J81). Antes B83 recibía el
  // VALOR CRUDO del select ("llave_en_mano"), que salía literal en el formato.
  const normaEntrega = NORMA_SISTEMA_ENTREGA[str(a4, "var_i_sistema_entrega")] ?? "";
  const sustentoEntrega = str(a4, "var_i_sustento_entrega");
  setCell(
    ws,
    "B83",
    normaEntrega && sustentoEntrega.includes(normaEntrega)
      ? sustentoEntrega
      : [normaEntrega, sustentoEntrega].filter(Boolean).join("\n"),
  );
  volcarPuntosNoNegociables(ws, a4.var_j_puntos_no_negociables);
  // k) La cuantía se ACTUALIZA en la interacción con el mercado (A5, Art. 47.1).
  // Si A4 no escribió su propio sustento, se cae al de A5: la cifra y su porqué ya
  // están ahí, y re-preguntarlos invita a que A4 y A8 digan cifras distintas del
  // mismo hecho.
  setCell(ws, "B98", str(a4, "var_k_financiamiento_cuantia") || str(a5, "resultado_cuantia"));
  // l) Sustento de la aplicación de adelantos (B112): se DERIVA de la tabla de
  // adelantos (los marcados, con su mecanismo y %); si no hay ninguno, cae a la
  // propuesta del área usuaria sembrada en A4 (ya no hay campo de texto propio) y,
  // en última instancia, a "NO CORRESPONDE" por la limpieza de la plantilla.
  setCell(
    ws,
    "B112",
    sustentoAdelantos(a4.adelantos_items, /obra/.test(objetoEstrategia)) || str(a4, "var_l_garantias_adelantos"),
  );
  setCell(ws, "B117", str(a4, "var_m_consumo_historico"));
  // n) El sustento de B129 justifica SOLO la elección de un nivel de interacción
  // MÁS AVANZADO que el mínimo que fijó la segmentación de A2 (numeral 127.2, tal
  // como reza su rótulo en B128). Si NO se subió de nivel, no corresponde: se
  // escribe «NO CORRESPONDE» en vez de arrastrar un sustento que afirmaría una
  // decisión que no se tomó. El nivel ELEGIDO es `a5.nivel` (el radio), igual que
  // en la verificación de n) que ve el usuario. Va aquí (antes de las inserciones
  // de f)/g)) para que la celda viaje con su fila al sitio final.
  const nivelElegidoN = typeof a5.nivel === "string" ? a5.nivel : "";
  const nivelMinimoN = hitos.A2
    ? clasificarSegmentacion({
        objeto: a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
        cuantiaAlta: Boolean(a2.cuantiaAlta),
        condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
        criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
        centralizada: Boolean(a2.centralizada),
        esIoarr: Boolean(a2.esIoarr),
      }).nivel
    : null;
  const ordenNivel = NIVEL_ORDEN as readonly string[];
  const nivelMasAvanzadoN =
    !!nivelElegidoN && !!nivelMinimoN && ordenNivel.indexOf(nivelElegidoN) > ordenNivel.indexOf(nivelMinimoN);
  setCell(ws, "B129", nivelMasAvanzadoN ? str(a4, "var_n_tipo_interaccion") : "NO CORRESPONDE");
  setCell(ws, "B148", str(a4, "var_p_roles"));
  // q) Sustento de la agrupación (B156→B162 tras las inserciones). Si la DEC no
  // escribió texto propio pero marcó una casilla (paquete/ítems/lotes/tramos), cae
  // al sustento normativo del mecanismo elegido (Art. 52); sin casilla, la limpieza
  // de la plantilla deja "NO CORRESPONDE".
  setCell(ws, "B156", str(a4, "var_q_agrupar") || sustentoNormativoAgrupacion(str(a4, "agrupacion_tipo")));
  setCell(ws, "B166", str(a4, "var_s_objetivo"));
  setCell(ws, "B179", str(a4, "var_t_otras"));

  // Variables adicionales de obras y consultoría de obras (sustentos).
  setCell(ws, "B197", str(a4, "obra_a_tipo_contrato"));
  setCell(ws, "B203", str(a4, "obra_b_bim"));
  setCell(ws, "B211", str(a4, "obra_c_incentivos"));
  setCell(ws, "B216", str(a4, "obra_d_fast_track"));
  setCell(ws, "B221", str(a4, "obra_e_terreno"));
  setCell(ws, "B230", str(a4, "obra_f_licencias"));
  setCell(ws, "B236", str(a4, "obra_g_expediente_tecnico"));
  setCell(ws, "B241", str(a4, "obra_h_estructura_costos"));
  // i) Metodologías colaborativas (Art. 154.1.i). B249 es su celda de sustento;
  // nadie la escribía, así que el marcador "[Insertar sustento…]" de la plantilla
  // salía literal en TODOS los formatos exportados.
  setCell(ws, "B249", str(a4, "obra_i_metodologias_colaborativas"));

  // ===== Casillas (X) del formato =====
  //
  // `llenarEstrategia` no marcaba NI UNA: solo escribía los sustentos de texto
  // libre, así que el Formato de Estrategia salía con todo el cuerpo en blanco
  // por mucho que estuviera relleno en A4.
  marcarDeSelect(ws, CELDA_TIPO_EVALUADOR, str(a4, "var_e_tipo_evaluador"));
  marcarDeSelect(ws, CELDA_MODALIDAD_PAGO, str(a4, "var_h_modalidad_pago"));
  // d) Modalidad eficiente elegida, q) agrupación de prestaciones.
  marcarDeSelect(ws, CELDA_MODALIDAD_EFICIENTE, str(a4, "modalidad_eficiente_tipo"));
  marcarDeSelect(ws, CELDA_AGRUPAR, str(a4, "agrupacion_tipo"));

  // t) Otras variables: cada checkbox de A4 marca su casilla.
  for (const v of OTRAS_VARIABLES_CAMPOS) {
    if (a4[v.campo]) mark(ws, v.celda);
  }

  // l) Tabla de adelantos: tres filas fijas (marcar / mecanismo / %). Se lee del
  // campo consolidado `adelantos_items`; el respaldo a los campos planos cubre
  // cualquier expediente antiguo anterior al editor de tabla. Las filas sin marcar
  // no se tocan y salen "NO CORRESPONDE" por la limpieza de la plantilla.
  const adelantos = leerAdelantos(a4.adelantos_items);
  const esObras = /obra/.test(objetoEstrategia);
  for (const fila of ADELANTOS_FILAS) {
    // El adelanto para materiales y el de por avance solo se usan en obras (nota (*)
    // del formato): fuera de obras no aplican aunque un dato viejo lo trajera.
    const soloObrasFuera = fila.soloObras && !esObras;
    const row = adelantos.find((r) => r.prefijo === fila.prefijo);
    const marcada = !soloObrasFuera && (row ? Boolean(row.marcar) : Boolean(a4[fila.prefijo]));
    if (marcada) {
      mark(ws, fila.marcar);
      setCell(ws, fila.mecanismo, String(row?.mecanismo ?? str(a4, `${fila.prefijo}_mecanismo`)));
      setCell(ws, fila.porcentaje, String(row?.pct ?? str(a4, `${fila.prefijo}_pct`)));
    } else {
      // Fila sin marcar (o solo-obras fuera de obras): se escribe "NO CORRESPONDE"
      // en mecanismo y %, para que el documento firmado NO conserve el marcador
      // "[Insertar mecanismo de garantía]" / "[Insertar % de adelanto]" de la
      // plantilla. La casilla "Marcar (X)" se deja vacía.
      setCell(ws, fila.mecanismo, "NO CORRESPONDE");
      setCell(ws, fila.porcentaje, "NO CORRESPONDE");
    }
  }

  // a) ¿Se modifica el procedimiento del PAC? No se pregunta: se DEDUCE
  // comparando lo programado (A1) con lo que la DEC determinó (A4). Con dos
  // procedimientos distintos delante, marcar "NO" a mano sería un error que
  // nadie vería.
  //
  // Se compara el proceso ESPECÍFICO de A4 (var_a_proceso, con su submodalidad),
  // no el genérico, para que un cambio de submodalidad cuente como modificación
  // (la comparación normaliza objeto y formato). Fallback al genérico en
  // expedientes antiguos sin var_a_proceso.
  const modificaPac = modificaProcedimientoDelPac(
    str(a1, "procedimiento_pac"),
    str(a4, "var_a_proceso") || str(a4, "var_a_procedimiento"),
    a1.en_pac !== false,
  );
  if (modificaPac === true) {
    mark(ws, SI_NO_MODIFICA_PAC.si);
    // B7 es "[Insertar sustento del CAMBIO del tipo de procedimiento]", y el
    // formato lo condiciona: "Si seleccionó SÍ, registrar el sustento…".
    setCell(ws, "B7", str(a4, "var_a_sustento_cambio"));
  } else if (modificaPac === false) {
    mark(ws, SI_NO_MODIFICA_PAC.no);
    // Sin cambio no hay nada que sustentar: el bucle de más abajo pondría
    // "NO CORRESPONDE." de todos modos, pero se fija aquí para que no dependa
    // de que el campo esté vacío — con "NO" marcado, un sustento del cambio
    // contradiría la propia casilla.
    setCell(ws, "B7", NO_CORRESPONDE);
  }

  // Los SÍ/NO. En el formato firmado por la entidad están TODOS marcados.
  for (const [campo, celdas] of Object.entries(SI_NO_ESTRATEGIA)) {
    const v = str(a4, `si_${campo}`);
    if (v === "si") mark(ws, celdas.si);
    else if (v === "no") mark(ws, celdas.no);
    // Sin valor no se marca nada: "sin analizar" no es "no".
  }
  // k) Si A4 no respondió si la cuantía se actualizó, pero A5 SÍ determinó una
  // cuantía (interacción con el mercado, Art. 47.1), se marca "SÍ": es un hecho de
  // A5, no una casilla que la DEC deba re-responder.
  if (!str(a4, "si_cuantia_actualizada") && cuantiaDeA5(a5) != null) {
    mark(ws, SI_NO_ESTRATEGIA.cuantia_actualizada.si);
  }
  // II) ¿La cuantía es punto de referencia para las ofertas? Es una lista tasada
  // (Art. 48.2 Ley). Dos señales, ambas verificadas verbatim contra el Reglamento:
  //
  // 1) El PROCEDIMIENTO de a) (var_a_proceso, el mismo catálogo de los Arts.
  //    93/94/95) ya lo implica por sí solo en dos casos: expertos y gerentes de
  //    proyecto (Art. 134.1, oferta fija al 100%) y el Concurso de Proyectos
  //    Arquitectónicos (el Art. 135.1 lo restringe a consultoría de obra "solo
  //    diseño"/"formulación y diseño" u obra "diseño y construcción" —los mismos
  //    sistemas del punto 2—, así que aplica aunque i) no se haya llenado aún).
  // 2) El SISTEMA DE ENTREGA de i), para obra/consultoría de obra en general:
  //    "solo construcción" (Art. 165), "diseño y construcción" y su variante con
  //    operación y mantenimiento (Art. 166.1/166.2 —el rubro ejecución de obra
  //    queda fijo al 100%, que es el punto de referencia; el de diseño se EVALÚA
  //    sobre 100 puntos, no lleva piso—), y consultoría de obra "solo formulación
  //    o solo diseño" (Art. 166.4, mínimo 90%).
  //
  // El resto → NO —incluidos gestión al riesgo/de agencia y entrega integrada
  // (Art. 166.3: reglas GENERALES de evaluación, no este mecanismo) y la
  // comparación de precios, que se evalúa por MENOR MONTO (Art. 98), no contra
  // una referencia—. El caso del Art. 133 (servicios de operación/mantenimiento
  // con diseño YA definido —no es lo mismo que el sistema de entrega "diseño de
  // la operación y mantenimiento", que describe el alcance del contrato, no si
  // la entidad ya tiene ese diseño hecho—) comparte procedimiento del catálogo
  // con consultorías que NO llevan el mecanismo ("Concurso Público para
  // consultorías y servicios de mantenimiento vial" cubre los tres), así que no
  // es detectable sin ambigüedad y queda para marcarlo a mano. Si la DEC ya
  // respondió, manda (el bucle de arriba ya marcó su casilla). Se marca aquí,
  // antes de que el cronograma inserte filas, para que el "X" se desplace con
  // su fila.
  const PROCEDIMIENTOS_CUANTIA_REFERENCIA = new Set([PROCESO_EXPERTOS_GERENTES_PROYECTO, PROCESO_CONCURSO_ARQUITECTONICO]);
  const SISTEMAS_ENTREGA_CUANTIA_REFERENCIA = new Set([
    "solo_construccion",
    "diseno_construccion",
    "diseno_construccion_operacion_mantenimiento",
    "solo_formulacion_o_diseno",
  ]);
  if (!str(a4, "si_cuantia_referencia")) {
    const procParaCuantiaRef = str(a4, "var_a_proceso") || str(a4, "var_a_procedimiento");
    const esCuantiaReferencia =
      PROCEDIMIENTOS_CUANTIA_REFERENCIA.has(procParaCuantiaRef) ||
      (/obra/.test(objetoEstrategia) && SISTEMAS_ENTREGA_CUANTIA_REFERENCIA.has(str(a4, "var_i_sistema_entrega")));
    mark(ws, esCuantiaReferencia ? SI_NO_ESTRATEGIA.cuantia_referencia.si : SI_NO_ESTRATEGIA.cuantia_referencia.no);
  }

  // a) Cabecera con el tipo de procedimiento y su nomenclatura, como en el
  // formato real ("a) Tipo … : LICITACION PUBLICA ABREVIADA N° 42-2026-…").
  // El procedimiento lo DETERMINA la DEC en la estrategia (Art. 46.1.a): manda
  // el de A4. El del expediente es el respaldo para expedientes antiguos, y su
  // taxonomía es la de la Ley 30225 —trae figuras derogadas—, así que no puede
  // ser la fuente principal.
  // a) muestra el proceso ESPECÍFICO de la ficha (var_a_proceso, p. ej.
  // "Licitación Pública para bienes"); si un expediente antiguo no lo tiene, se cae
  // al genérico del Art. 54 y, en último término, al tipo del expediente.
  const tipoProc = capitalizarProceso(
    str(a4, "var_a_proceso") ||
      labelProcedimiento(str(a4, "var_a_procedimiento")) ||
      (proceso.procedure_type ? processTypeLabel(proceso.procedure_type) : null),
  );
  if (tipoProc) {
    // La referencia del PAC la conoce A1 (Programación), y es lo que el
    // formato pregunta justo debajo ("¿se modifica el procedimiento registrado
    // en el PAC?"). Sin ella, quien lee el documento no sabe contra qué se
    // compara.
    const refPac = str(a1, "referencia_pac");
    // La nomenclatura sale de A4 (con su clave heredada) y, si no hay, del
    // expediente — salvo que ahí lo que haya sea el título de la necesidad.
    // El formato imprime "TIPO N° número": la nomenclatura de A4 es "solo el
    // número", así que se le antepone "N° " (sin duplicarlo si ya lo trae).
    const nomenclatura = nomenclaturaConNumero(nomenclaturaDelFormato(a4, proceso.nomenclature, necesidad?.nombre));
    setCell(
      ws,
      CELDA_TIPO_PROCEDIMIENTO,
      `a) Tipo de procedimiento de selección y su modalidad: ${tipoProc.toUpperCase()}` +
        `${nomenclatura ? ` ${nomenclatura}` : ""}` +
        `${refPac ? ` (PAC: ${refPac})` : ""}`,
    );
  }

  // b) En un procedimiento COMPETITIVO —la regla general (Art. 54.3)— la
  // variable b) no aplica: no hay un "no competitivo" cuyo uso haya que
  // sustentar. Si la DEC no marcó ya la casilla a mano, se marca "NO" sola,
  // igual que se DEDUCE la de a): dejarla en blanco haría leer "sin analizar"
  // donde en realidad es "no corresponde", y su análisis (B13) ya sale
  // "NO CORRESPONDE." por la limpieza. El régimen se toma de la causal del
  // Art. 55 acreditada en A1 (que manda) y, en su defecto, del tipo de proceso
  // de la ficha; si nada lo declara no competitivo, es competitivo.
  const esNoCompetitivo = familiaProcedimiento(tipoProc, str(a1, "causal_art_55")) === "no_competitivo";
  if (!str(a4, "si_sustenta_no_competitivo") && !esNoCompetitivo) {
    mark(ws, SI_NO_ESTRATEGIA.sustenta_no_competitivo.no);
  }

  // c) Código Único de Inversión (Art. 46.1.c).
  //
  // Tres fuentes, en orden: lo que la DEC escribió en A4, el `cui` de la ficha
  // EN VIVO, y el 4.º segmento de la cadena funcional del SIGA.
  //
  // La ficha se lee en vivo y no solo por la precarga porque esta solo corre AL
  // DERIVAR: un expediente ya derivado no vería nunca el CUI aunque se
  // registrara después en la necesidad.
  //
  // Antes se rescataba del texto de `var_c_viabilidad` con una expresión y
  // salía el NOMBRE de la tarea ("186 MEJORAMIENTO Y AMPLIACION…") donde el
  // formato pide el número. Adivinar un código a partir de texto libre no era
  // una solución: era el error.
  const cui =
    str(a4, "cui") ||
    necesidad?.cui?.trim() ||
    cuiDeCadenaFuncional(necesidad?.cadena_funcional) ||
    "";
  // La celda C19 pide ÚNICAMENTE el CUI (el número). La DECLARACIÓN de viabilidad
  // (var_c_viabilidad: N° y fecha, aprobación del IOARR…) NO va aquí: el formato
  // no tiene celda para ese texto —la viabilidad se expresa con la casilla SÍ/NO
  // de al lado (E19 "¿es viable…?" → G19/I19)— y anexarlo arrastraba el NOMBRE del
  // proyecto ("MEJORAMIENTO Y AMPLIACIÓN…") a un campo que pide solo el número.
  setCell(ws, CELDA_CUI, cui);

  // Y si hay CUI, la contratación ES una inversión: es un hecho de la ficha, no
  // una opinión. Sin marcarlo, el formato imprimiría el CUI con la casilla c)
  // en blanco — o las dos en blanco, que significa "sin analizar".
  if (cui && !str(a4, "si_es_inversion")) mark(ws, SI_NO_ESTRATEGIA.es_inversion.si);

  // r) Fichas de estandarización: se marca la que mencione el texto.
  const estandarizado = str(a4, "var_r_estandarizado").toLowerCase();
  if (estandarizado.includes("homologaci")) mark(ws, CELDA_FICHA_ESTANDARIZACION.ficha_homologacion);
  if (estandarizado.includes("técnica") || estandarizado.includes("tecnica")) {
    mark(ws, CELDA_FICHA_ESTANDARIZACION.ficha_tecnica);
  }

  // n) Clasificación de la segmentación (Art. 46.1.n).
  //
  // No se pide en A4: LA DETERMINA A2. El 46.1.n solo manda "verificar" el
  // tipo de interacción que aquella determinó, así que pedirla otra vez sería
  // invitar a que los dos documentos se contradigan.
  if (hitos.A2) {
    const segN = clasificarSegmentacion({
      objeto: a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
      cuantiaAlta: Boolean(a2.cuantiaAlta),
      condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
      criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
      centralizada: Boolean(a2.centralizada),
      esIoarr: Boolean(a2.esIoarr),
    });
    const celdaClas = CELDA_CLASIFICACION_SEGMENTACION[segN.categoria];
    if (celdaClas) mark(ws, celdaClas);
  }

  // "NO CORRESPONDE" en cada sustento que no aplica.
  //
  // El formato firmado por la entidad NO deja el marcador "[Insertar sustento…]"
  // ni la celda en blanco: escribe "NO CORRESPONDE". Dejar el marcador delata
  // un documento a medio llenar, y una celda vacía no dice si se analizó.
  for (const { celda } of SUSTENTOS_ESTRATEGIA) {
    const actual = leerTexto(ws, celda).trim();
    if (!actual || actual.startsWith("[Insertar") || actual.startsWith("[…") || actual === "[...]") {
      setCell(ws, celda, NO_CORRESPONDE);
    }
  }

  // ===== Lo que ya está tecleado en la ficha y en A1/A3 =====
  //
  // El formato salía en blanco en estas casillas aunque el dato existiera: la
  // exportación de A4 no consultaba la Necesidad ni una vez.

  // k) Tipo de fuente de financiamiento (Art. 46.1.k). La ficha lo guarda como
  // texto libre; se marca solo si se reconoce, y si no, la vista previa lo
  // delata. El campo de A4 manda sobre la ficha.
  const fuente =
    str(a4, "fuente_financiamiento") || fuenteFinanciamientoDeTexto(necesidad?.fuente_financiamiento);
  if (fuente) marcarDeSelect(ws, CELDA_FINANCIAMIENTO, fuente);

  // t) Fórmula de reajuste: la declara el área usuaria en el requerimiento
  // (Art. 44.2), así que si la ficha la trae, la variable aplica.
  if (necesidad?.formula_reajuste?.trim() || str(a3, "formula_reajuste")) {
    mark(ws, CELDA_OTRAS_VARIABLES.formula_reajuste);
  }

  // r) La ficha técnica la verifica el área usuaria y A3 la hereda: A4 no
  // vuelve a preguntarlo. Un hecho, un dueño. Se declara con "si"/"no" (o el
  // booleano de datos antiguos).
  const estandarizadoSi = a3.estandarizado === true || a3.estandarizado === "si" || necesidad?.verificacion_ficha_tecnica;
  const estandarizadoNo = a3.estandarizado === false || a3.estandarizado === "no";
  if (estandarizadoSi) {
    mark(ws, SI_NO_ESTANDARIZADO.si);
    mark(ws, CELDA_FICHA_ESTANDARIZACION.ficha_tecnica);
  } else if (estandarizadoNo) {
    mark(ws, SI_NO_ESTANDARIZADO.no);
  }

  // i) Sistema de entrega (Art. 46.1.i). SOLO lo que la DEC eligió en A4.
  //
  // Nada de heredarlo de la propuesta de A3: el 44.2 lo pone en boca del área
  // usuaria, pero la estrategia es la DECISIÓN de la DEC (Art. 72.1). Marcar la
  // casilla con la propuesta haría que el documento afirme una decisión que
  // nadie tomó — y con la firma del responsable al pie. La propuesta se ofrece
  // en la UI de A4 con un botón para adoptarla, igual que los requisitos y la
  // modalidad de pago.
  marcarDeSelect(ws, CELDA_SISTEMA_ENTREGA, str(a4, "var_i_sistema_entrega"));

  // Fecha de elaboración del formato (celda C258 de la plantilla). Honra la
  // `fecha_elaboracion` que la DEC editó en el paso (su ayuda promete "Se imprime
  // al pie… es editable") y solo cae a la fecha de hoy cuando está vacía —mismo
  // criterio que el Anexo N° 2 (A8)—. Va AQUÍ, antes de las inserciones de f), g),
  // o) y p): esas insertan filas MÁS ARRIBA y desplazan C258 hacia abajo. Escrita
  // antes, la fecha viaja con su fila hasta su sitio final; escrita después (como
  // estaba) caía en la dirección fija C258, que para entonces ya era otra fila, y
  // la casilla real de la fecha se quedaba con el marcador "[Insertar fecha…]".
  setCell(ws, "C258", fechaISOaCorta(str(a4, "fecha_elaboracion")) || hoy());

  // Trazabilidad de quién generó el documento: no viene en la plantilla oficial
  // (termina en la fila 259, la de la fecha), así que se agrega una fila nueva
  // justo debajo —fila 260 en la plantilla en blanco—, escrita AQUÍ por la misma
  // razón que la fecha de arriba: si se escribiera al final, para entonces las
  // inserciones de f)/g)/o)/p) ya habrían desplazado esta fila a otra dirección.
  if (usuarioDescarga) {
    setCell(ws, "B260", `Elaborado por: ${usuarioDescarga}`);
    ws.getCell("B260").font = { bold: true };
  }

  // o) y p) AL FINAL: insertan filas y desplazan todo lo de debajo. Hacerlo
  // antes invalidaría las direcciones fijas de q), r), s), t) y las de obras.
  // El número que devuelve es cuánto desplazó TODO lo que queda por debajo de
  // p) roles (q, r, s, t, obras, "III."): se necesita más abajo para reparar
  // esos bloques con aritmética, no por texto (ver `alinearRotulosApartados`).
  const corrimientoCronograma = volcarCronogramaYRoles(ws, a4);

  // f) y g) también insertan filas, y están MÁS ARRIBA que el cronograma: por
  // eso van al final del todo, cuando ya nadie depende de las direcciones de
  // abajo. `volcarRequisitos` devuelve cuántas filas metió, que es lo que
  // desplaza a g) — y ambos números TAMBIÉN desplazan q) en adelante, porque
  // f)/g) están más arriba que el cronograma.
  //
  // La obligatoriedad de cada requisito la fija la matriz de las bases estándar
  // (Art. 72.4) según el procedimiento; la capacidad económica solo aparece si el
  // procedimiento tiene precalificación.
  const procParaReq = str(a4, "var_a_proceso") || str(a4, "var_a_procedimiento");
  const precalif = tienePrecalificacion(procParaReq);
  const matrizRequisitos = requisitosDeProcedimiento(procParaReq, str(a1, "causal_art_55"), precalif);
  const corrimiento = volcarRequisitos(
    ws,
    str(a4, "var_f_requisitos_calificacion"),
    matrizRequisitos,
    precalif,
  );
  const corrimientoFactores = volcarFactores(ws, a4, corrimiento);

  // h) a n) están ENTRE f)/g) y el cronograma: cargan con el desplazamiento de
  // f)/g) (`corrimiento + corrimientoFactores`), pero NO con el de o)/p) —esos
  // insertan más abajo y no mueven nada por encima de sí mismos—. Confirmado
  // por el usuario en producción con la Tabla de requisitos de calificación
  // ampliada (Art. 72.4 suele exigir más de los 2 obligatorios / 3 facultativos
  // que trae la plantilla en blanco): sin esta reparación, estos 7 bloques
  // quedaban con el mismo síntoma que la sección de obras.
  const desplazamientoFG = corrimiento + corrimientoFactores;
  for (const { fila: filaFg, rects } of BLOQUES_FG) {
    recombinarBloqueDesdeAncla(ws, filaFg + desplazamientoFG, rects);
  }

  // p) roles, el cronograma de EJECUCIÓN y su NOTA: por texto (localizan bien
  // incluso con varias inserciones encima, comprobado con datos reales). q),
  // r), s), t), la sección de obras y "III." en cambio se reparan por
  // ARITMÉTICA (plantilla + desplazamiento total) — ver el comentario de
  // `alinearRotulosApartados`: buscarlos por texto dejó de ser fiable cuando la
  // inserción de arriba es grande, porque el propio texto puede aparecer
  // desincronizado.
  alinearRotulosApartados(ws, corrimientoCronograma + corrimiento + corrimientoFactores);

  // n) Nivel de interacción según la segmentación (paso A2).
  if (hitos.A2) {
    const seg = clasificarSegmentacion({
      objeto: a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
      cuantiaAlta: Boolean(a2.cuantiaAlta),
      condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
      criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
      centralizada: Boolean(a2.centralizada),
      esIoarr: Boolean(a2.esIoarr),
    });
    setCell(ws, "G121", seg.nivelLabel);
  }

  // Lo último: ya está todo escrito y las filas insertadas por f), g), o) y p)
  // están en su sitio, así que cada fila puede medirse contra su texto final.
  ajustarAltosAlContenido(ws, textosPlantilla);

  // Ocultar el bloque "II. SOLO PARA OBRAS Y CONSULTORÍA DE OBRAS" (Art. 154)
  // cuando el objeto NO es obra ni consultoría de obra: en un bien/servicio (p. ej.
  // una licitación pública abreviada para bienes) esas nueve variables no aplican y
  // solo alargan el formato. Se localiza por su RÓTULO, no por número de fila,
  // porque f)/g)/o)/p) insertan filas y desplazan los índices. Va desde el
  // encabezado "II. SOLO PARA OBRAS…" hasta justo antes de "III. OTRAS
  // CONSIDERACIONES", que sí aplica a todo objeto (cuantía de referencia y fecha).
  if (!/obra/.test(objetoEstrategia)) {
    const filaDe = (frag: string) => {
      for (let r = 1; r <= ws.rowCount; r += 1) {
        for (let c = 1; c <= 3; c += 1) {
          if (textoDeCelda(ws.getCell(r, c)).replace(/\s+/g, " ").toUpperCase().includes(frag)) return r;
        }
      }
      return -1;
    };
    const ini = filaDe("SOLO PARA OBRAS Y CONSULTOR");
    const fin = filaDe("III. OTRAS CONSIDERACIONES");
    if (ini > 0 && fin > ini) {
      for (let r = ini; r < fin; r += 1) ws.getRow(r).hidden = true;
    }
  }
}

// ===== Anexo N° 1 · Interacción con el mercado =====

// El objeto contractual lo nombran distinto los dos módulos: la Necesidad usa
// "consultoria_obra" (como el Art. 44) y el expediente, "consultoria".
const ANEXO1_OBJETO_CELDA: Record<string, string> = {
  bien: "D24",
  bienes: "D24",
  servicio: "F24",
  servicios: "F24",
  obra: "H24",
  obras: "H24",
  consultoria: "J24",
  consultoria_obra: "J24",
};

/**
 * Encabezado de identificación del sustento.
 *
 * El Anexo N° 1 oficial no tiene bloque de identificación: es un formulario
 * suelto de marcas y dos sustentos. Sin esto sale anónimo y no se sabe a qué
 * contratación pertenece, así que la identificación se antepone al sustento,
 * que es el único texto libre del formato.
 */
function cabeceraAnexo1(proceso: ProcesoExport, necesidad: NecesidadExport | null | undefined): string {
  const denominacion = necesidad?.nombre?.trim() || proceso.nomenclature?.trim() || "";
  const monto = necesidad?.monto_estimado ?? proceso.valor_estimado ?? proceso.amount ?? null;
  const partes = [
    denominacion ? `Contratación: ${denominacion}` : "",
    necesidad?.area_usuaria?.trim() ? `Área usuaria: ${necesidad.area_usuaria.trim()}` : "",
    proceso.entity?.trim() ? `Entidad: ${proceso.entity.trim()}` : "",
    typeof monto === "number" && monto > 0
      ? `Cuantía de la contratación: S/ ${monto.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "",
  ].filter(Boolean);
  return partes.join(" · ");
}

function soles(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Caracteres que caben en una línea del sustento (celdas B:J combinadas).
//
// La unidad de ancho de Excel es ~1 carácter de la fuente por defecto, y los
// anchos de B a J de la plantilla suman 149,6. Se deja margen porque el texto
// va en mayúsculas y con números, más anchos que la media.
const SUSTENTO_CHARS_POR_LINEA = 135;
// Alto de una línea a 11 pt (la fuente de la plantilla), en puntos.
const SUSTENTO_ALTO_LINEA = 14.5;
// Tope duro de Excel para el alto de fila. Pasarse no da error: lo ignora.
const EXCEL_ALTO_MAXIMO = 409;

/**
 * Ajusta el alto de la fila del sustento para que se lea todo el texto.
 *
 * Excel NO autoajusta el alto de una fila cuyo contenido está en celdas
 * combinadas —y B12/B26 lo están—, así que hay que calcularlo. Además la
 * plantilla trae esas celdas SIN `wrapText`: sin activarlo el texto no parte de
 * línea y solo se ve el principio por muy alta que sea la fila.
 */
function ajustarAltoSustento(ws: ExcelJS.Worksheet, addr: string, texto: string) {
  const cell = ws.getCell(addr);
  const target = cell.isMerged ? cell.master : cell;
  target.alignment = { ...target.alignment, horizontal: "left", vertical: "top", wrapText: true };

  const lineas = texto
    .split("\n")
    .reduce((n, parrafo) => n + Math.max(1, Math.ceil(parrafo.length / SUSTENTO_CHARS_POR_LINEA)), 0);
  // `cell.row` viene tipado como string en exceljs, aunque sea el número.
  const fila = ws.getRow(Number(target.row));
  const calculado = lineas * SUSTENTO_ALTO_LINEA + 6;
  // Nunca encoger por debajo de lo que traía la plantilla.
  fila.height = Math.min(Math.max(calculado, fila.height ?? 0), EXCEL_ALTO_MAXIMO);
}

/**
 * Ajusta el alto de UNA fila del Anexo N° 2 a su texto: activa `wrapText` y
 * calcula las líneas con el ancho REAL del rango combinado `c1..c2`.
 *
 * El Anexo N° 2 no pasa por `ajustarAltosAlContenido` (que barre toda la hoja),
 * así que sus celdas de texto largo —denominación (C4), alcance (C19),
 * descripción del ítem (B30)— se cortaban: la fila conservaba el alto fijo de la
 * plantilla. Nunca encoge por debajo de lo que traía la plantilla.
 */
function ajustarAltoFilaAnexo2(ws: ExcelJS.Worksheet, addr: string, c1: number, c2: number) {
  const cell = ws.getCell(addr);
  const target = cell.isMerged ? cell.master : cell;
  target.alignment = { ...target.alignment, wrapText: true };
  const texto = textoDeCelda(target);
  if (!texto.trim()) return;
  const cuerpo = target.font?.size ?? 11;
  const lineas = lineasEn(texto, anchoDe(ws, c1, c2), cuerpo);
  const fila = ws.getRow(Number(target.row));
  fila.height = Math.min(Math.max(fila.height ?? 0, altoDe(lineas, cuerpo)), EXCEL_ALTO_MAXIMO);
}

// ===== Ajuste del alto de cada fila al texto que lleva =====
//
// El problema: la plantilla dimensiona cada fila para SU texto de instrucción
// ("[Insertar sustento del uso de una modalidad de contratación pública
// eficiente]", ~90 pt a Arial 16). Escribamos encima o no, la fila conserva ese
// alto: "NO CORRESPONDE." ocupaba 91 pt —cuatro líneas de aire— y hay 34 filas
// con más de 25 pt de sobra. El formato salía en 8 páginas.
//
// Los números de abajo salen de MEDIR la plantilla, no de suponer.

/**
 * Caracteres que caben por cada unidad de ancho de Excel, con la fuente a 11 pt.
 * Calibrado con el Anexo N° 1: B..J suman 149,6 unidades y ahí caben ~135
 * caracteres (149,6 × 0,9). Para otro cuerpo se escala inversamente: el texto a
 * 16 pt ocupa 16/11 de ancho por carácter.
 *
 * El 0,9 ya lleva margen dentro: la plantilla escribe en mayúsculas y con
 * números, más anchos que la media, y de ahí sale la constante del Anexo N° 1.
 * Quien decide dónde parte la línea es Excel con las métricas reales de la
 * fuente, así que este cálculo es una aproximación: por eso el redondeo de
 * `lineasEn` va siempre hacia arriba y cada fila lleva su margen vertical.
 */
const CHARS_POR_UNIDAD_11PT = 0.9;

/**
 * Densidad para el autoajuste del FORMATO DE ESTRATEGIA, más conservadora (0,8).
 *
 * Sus columnas B..J son bastante más anchas que las del Anexo N° 1 (≈184 unidades
 * frente a 149,6), pero Excel parte la línea antes de lo que ese ancho sugiere:
 * medido, un sustento de q) de ~420 caracteres a 16 pt ocupa 5 líneas reales, y
 * con 0,9 salían 4 —el texto se cortaba—. Bajar a 0,8 hace que el estimador cuente
 * esa quinta línea. Es propio de esta plantilla: el Anexo N° 1 y el N° 2 conservan
 * su 0,9 calibrado.
 */
const CHARS_POR_UNIDAD_ESTRATEGIA = 0.8;

/** Alto de línea ≈ 1,32 × el cuerpo de la fuente (16 pt → ~21 pt). */
const FACTOR_INTERLINEA = 1.32;

/**
 * Aire entre el texto y la línea de la fila, a cada lado. Con la alineación
 * vertical centrada, el alto sobrante se reparte arriba y abajo, así que ningún
 * registro queda pegado a su borde.
 */
const MARGEN_VERTICAL = 4;

/** Por debajo de esto una fila deja de leerse como fila (es el mínimo de la plantilla). */
const ALTO_MINIMO_FILA = 18.75;

/** Texto de una celda, venga como cadena o como texto enriquecido. */
function textoDeCelda(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (typeof v === "string") return v;
  // 36 celdas de la plantilla son richText —entre ellas la fila más alta de
  // todas—, así que ignorarlas dejaba sin ajustar justo lo que más sobra.
  if (v && typeof v === "object" && "richText" in (v as object)) {
    return ((v as { richText: { text?: string }[] }).richText ?? []).map((t) => t.text ?? "").join("");
  }
  return "";
}

type Rango = [c1: number, r1: number, c2: number, r2: number];

/**
 * Índice de las combinaciones por su celda maestra.
 *
 * Se reconstruye por BARRIDO de las relaciones master/cubierta VIVAS de exceljs
 * (`cell.master`), NO de `ws.model.merges`. Ese modelo lo deja OBSOLETO
 * `duplicateRow`: tras insertar filas (f/g/o/p), las combinaciones de todo lo que
 * queda debajo siguen registradas en su posición ANTERIOR. Con el índice viejo,
 * `altoNecesario` no reconocía que un sustento largo ocupa B..J y lo medía contra
 * UNA columna estrecha → estimaba decenas de líneas y disparaba el alto al tope de
 * Excel (409 pt). Es el mismo criterio que la vista previa, que ya usa `cell.master`.
 *
 * El barrido es O(filas × columnas) pero con lecturas de celda O(1); en esta
 * plantilla es despreciable frente a generar el .xlsx.
 */
function indiceDeMerges(ws: ExcelJS.Worksheet): Map<string, Rango> {
  // Las combinaciones del formato llegan hasta J; se deja margen por si el
  // cronograma trae alguna más ancha. El barrido para en cuanto la celda deja de
  // pertenecer a la combinación, así que el tope solo acota un runaway.
  const COL_TOPE = 26;
  const indice = new Map<string, Rango>();
  for (let r = 1; r <= ws.rowCount; r += 1) {
    for (let c = 1; c <= COL_TOPE; c += 1) {
      const cell = ws.getCell(r, c);
      // Solo las ANCLAS: las cubiertas apuntan a su master y se saltan.
      if (!cell.isMerged || !cell.master || cell.master.address !== cell.address) continue;
      let c2 = c;
      while (c2 < COL_TOPE) {
        const vecina = ws.getCell(r, c2 + 1);
        if (vecina.isMerged && vecina.master?.address === cell.address) c2 += 1;
        else break;
      }
      let r2 = r;
      while (r2 < ws.rowCount) {
        const abajo = ws.getCell(r2 + 1, c);
        if (abajo.isMerged && abajo.master?.address === cell.address) r2 += 1;
        else break;
      }
      indice.set(cell.address, [c, r, c2, r2]);
    }
  }
  return indice;
}

/** Alto de un texto de `lineas` líneas al cuerpo dado, con su margen. */
const altoDe = (lineas: number, cuerpo: number) => lineas * cuerpo * FACTOR_INTERLINEA + MARGEN_VERTICAL * 2;

/** Líneas que ocupa un texto dentro de un ancho dado (unidades de Excel). */
function lineasEn(texto: string, ancho: number, cuerpo: number, densidad = CHARS_POR_UNIDAD_11PT): number {
  const charsPorLinea = Math.max(8, ancho * densidad * (11 / cuerpo));
  return texto.split("\n").reduce((n, parrafo) => n + Math.max(1, Math.ceil(parrafo.length / charsPorLinea)), 0);
}

function anchoDe(ws: ExcelJS.Worksheet, c1: number, c2: number): number {
  let ancho = 0;
  for (let c = c1; c <= c2; c += 1) ancho += ws.getColumn(c).width ?? 8.43;
  return ancho;
}

/**
 * Alto que necesita el texto de una fila, sin contar las combinaciones
 * verticales (esas reparten su texto entre varias filas y se comprueban aparte).
 * `null` = la fila no lleva texto medible, así que no se toca.
 */
function altoNecesario(ws: ExcelJS.Worksheet, fila: number, merges: Map<string, Rango>): number | null {
  let alto: number | null = null;
  ws.getRow(fila).eachCell({ includeEmpty: false }, (cell) => {
    if (cell.isMerged && cell.master.address !== cell.address) return; // celda cubierta
    const texto = textoDeCelda(cell);
    if (!texto.trim()) return;

    const rango = merges.get(cell.address);
    if (rango && rango[3] !== rango[1]) return; // combinación vertical: fase 2

    const cuerpo = cell.font?.size ?? 11;
    // Una celda SIN combinar y SIN ajuste de línea se desborda sobre las vecinas
    // vacías: Excel la pinta en UNA línea. Forzarle el ajuste la haría partir y
    // dispararía el alto de la fila —justo lo contrario de lo que buscamos—, así
    // que solo se mide con ancho la que ya parte líneas.
    const parte = Boolean(rango) || cell.alignment?.wrapText === true;
    const lineas = parte
      ? lineasEn(texto, anchoDe(ws, rango ? rango[0] : Number(cell.col), rango ? rango[2] : Number(cell.col)), cuerpo, CHARS_POR_UNIDAD_ESTRATEGIA)
      : texto.split("\n").length;
    alto = Math.max(alto ?? 0, altoDe(lineas, cuerpo));
  });
  return alto;
}

/**
 * Reparte el alto de las combinaciones VERTICALES: si tras encoger sus filas el
 * rótulo ya no cabe, se devuelve lo justo. Sin esto, el rótulo de fase del
 * cronograma ("PREPARATORIAS", combinado en vertical sobre sus filas) podría
 * quedarse sin sitio.
 */
function respetarMergesVerticales(ws: ExcelJS.Worksheet, merges: Map<string, Rango>) {
  for (const [ini, [c1, r1, c2, r2]] of merges) {
    if (r2 <= r1) continue;

    const master = ws.getCell(ini);
    const texto = textoDeCelda(master);
    if (!texto.trim()) continue;
    const cuerpo = master.font?.size ?? 11;
    const necesita = altoDe(lineasEn(texto, anchoDe(ws, c1, c2), cuerpo, CHARS_POR_UNIDAD_ESTRATEGIA), cuerpo);

    let actual = 0;
    for (let r = r1; r <= r2; r += 1) actual += ws.getRow(r).height ?? ALTO_MINIMO_FILA;
    if (actual >= necesita) continue;
    // Reparte lo que falta a partes iguales entre sus filas.
    const extra = (necesita - actual) / (r2 - r1 + 1);
    for (let r = r1; r <= r2; r += 1) {
      const row = ws.getRow(r);
      row.height = Math.min((row.height ?? ALTO_MINIMO_FILA) + extra, EXCEL_ALTO_MAXIMO);
    }
  }
}

/**
 * Ajusta cada fila al alto que pide su texto, con un margen arriba y abajo.
 *
 * En las DOS direcciones: crece con el contenido y ENCOGE cuando sobra, para que
 * cada fila mida lo que su texto necesita y no el hueco que la plantilla reservaba
 * para el marcador "[Insertar sustento…]" (así una fila con "NO CORRESPONDE."
 * queda en ~22 pt y un sustento largo crece hasta caber). El suelo es solo el
 * mínimo legible; el alto se estima por líneas (texto ÷ ancho de la celda) con un
 * margen, de modo que el texto largo no se corta.
 *
 * Se centra en vertical para que el aire sobrante se reparta arriba y abajo en
 * vez de amontonarse a un lado —la propia plantilla ya centra así sus filas de
 * instrucción—, y se activa `wrapText` SOLO donde el texto ya vive dentro de su
 * celda: forzarlo en una celda que se desborda sobre las vecinas la haría partir
 * y la fila crecería.
 *
 * Las filas sin texto medible se dejan como están: son la estructura del
 * formato y no nos toca redimensionarlas.
 */
function ajustarAltosAlContenido(ws: ExcelJS.Worksheet, textosPlantilla?: Set<string>) {
  const merges = indiceDeMerges(ws);
  for (let fila = 1; fila <= ws.rowCount; fila += 1) {
    // Alto que la plantilla oficial reservó para esta fila (aún intacto: el
    // relleno escribe valores, no alturas, y esto corre al final).
    const original = ws.getRow(fila).height ?? ALTO_MINIMO_FILA;
    const necesita = altoNecesario(ws, fila, merges);
    if (necesita == null) continue;
    // ¿La fila trae DATOS del usuario (algún texto que no es rótulo de la
    // plantilla)? Solo esas pueden crecer por encima de lo que el oficial reservó;
    // un rótulo estático se capa a su alto de plantilla para no inflarlo.
    let esData = textosPlantilla == null;
    ws.getRow(fila).eachCell({ includeEmpty: false }, (cell) => {
      if (cell.isMerged && cell.master.address !== cell.address) return;
      const texto = textoDeCelda(cell);
      if (!texto.trim()) return;
      if (textosPlantilla && !textosPlantilla.has(texto.replace(/\s+/g, " ").trim())) esData = true;
      const rango = merges.get(cell.address);
      if (rango && rango[3] !== rango[1]) return; // vertical: no es de esta fila
      // `middle` PISA lo que traiga la plantilla, y es deliberado: sus celdas de
      // sustento venían con `top` porque la fila era muy alta y el texto tenía
      // que empezar arriba. Ajustada al contenido, `top` dejaría todo el margen
      // debajo y el texto pegado al borde de arriba.
      cell.alignment = { ...cell.alignment, vertical: "middle", wrapText: Boolean(rango) || cell.alignment?.wrapText };
    });
    // Cada fila se ajusta a SU contenido: crece con el texto y ENCOGE cuando
    // sobra. El suelo es el mínimo legible; el techo, para un RÓTULO estático, es
    // el alto que la plantilla oficial ya le dio (así no se infla más que el
    // formato firmado); para una celda con DATOS, el máximo de Excel (así un
    // sustento largo no se corta). Una caja con "NO CORRESPONDE." es dato: encoge.
    const techo = esData ? EXCEL_ALTO_MAXIMO : Math.min(original, EXCEL_ALTO_MAXIMO);
    ws.getRow(fila).height = Math.min(Math.max(ALTO_MINIMO_FILA, necesita), techo);
  }
  respetarMergesVerticales(ws, merges);
}

/**
 * Párrafo que ata la interacción a la segmentación (A2).
 *
 * El Art. 46.1.n manda "verificar el tipo de interacción determinado en la
 * segmentación", así que el sustento debe decir de dónde sale el nivel: sin
 * esto, la elección de consulta o indagación parece arbitraria.
 */
function narrativaSegmentacion(
  hitos: HitosMap,
  necesidad: NecesidadExport | null | undefined,
  proceso: ProcesoExport,
): string {
  if (!hitos.A2) return "";
  const a2 = hitos.A2.data ?? {};
  const seg = clasificarSegmentacion({
    objeto: a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
    cuantiaAlta: Boolean(a2.cuantiaAlta),
    condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
    criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
    centralizada: Boolean(a2.centralizada),
    esIoarr: Boolean(a2.esIoarr),
  });
  const denominacion = necesidad?.nombre?.trim() || proceso.nomenclature?.trim() || "la contratación";
  return (
    `De acuerdo a la segmentación realizada para "${denominacion}", se ha determinado una cuantía ` +
    `${seg.cuantiaAlta ? "alta" : "baja"} y un nivel de riesgo ${seg.riesgoAlto ? "alto" : "bajo"}, ` +
    `por lo que la clasificación es ${seg.categoriaLabel.toUpperCase()}. El tipo de interacción con el ` +
    `mercado determinado es: ${seg.nivelLabel.toUpperCase()}.`
  );
}

/**
 * Párrafo de los proveedores consultados: a quién, con qué documento y por
 * cuánto. Vale para los dos tipos de interacción, porque en la consulta (Art.
 * 49) y en la indagación avanzada (Art. 48.2: "solicitar información a los
 * potenciales proveedores") se cotiza igual; solo cambia cómo se nombra la
 * gestión, así que el encabezado sigue al tipo para no citar el artículo de la
 * otra sección.
 */
function narrativaConsulta(
  a5: Record<string, unknown>,
  necesidad: NecesidadExport | null | undefined,
  tipo: "indagacion" | "consulta_mercado" | null,
): string {
  const proveedores = leerProveedores(a5.proveedores);
  if (proveedores.length === 0) return "";
  const objeto = necesidad?.nombre?.trim() || "";
  // Una frase por proveedor: a quién, con qué documento y por cuánto. Es la
  // forma del Anexo firmado, y con varias propuestas sustenta la cuantía.
  const lineas = proveedores.map((prov) => {
    const quien = [prov.razonSocial?.trim(), prov.ruc?.trim() ? `RUC ${prov.ruc.trim()}` : ""]
      .filter(Boolean)
      .join(", ");
    const monto = Number(prov.monto);
    return [
      `- ${quien || "Proveedor consultado"}`,
      prov.documento?.trim() ? `, mediante ${prov.documento.trim()}` : "",
      prov.fecha?.trim() ? ` (${fechaCorta(prov.fecha)})` : "",
      Number.isFinite(monto) && monto > 0
        ? `: propuesta económica de ${soles(monto)}.`
        : ".",
    ].join("");
  });
  const objetoTexto = objeto ? `, cuyo objeto de contratación es "${objeto}"` : "";
  const encabezado =
    tipo === "indagacion"
      ? `Solicitud de información a los potenciales proveedores (Art. 48.2)${objetoTexto}. Se solicitó información a ${proveedores.length} proveedor(es):`
      : `Información de consulta al mercado${objetoTexto}. Se consultó a ${proveedores.length} proveedor(es):`;
  return [encabezado, ...lineas].join("\n");
}

/**
 * Difusión del requerimiento (Art. 51), para el sustento de la CONSULTA.
 *
 * La difusión es una herramienta de consulta al mercado (Art. 50.1.a). Son DOS
 * actos con DOS actas —la absolución de consultas (Art. 51.3) y, si se realizó,
 * la reunión de confirmación y/o aclaración que dirige la DEC (Art. 51.4-51.5)—
 * y la maneja la Pladicop; aquí solo se REFERENCIAN (N°, fecha y resumen), tal
 * como se registraron en A5. Si no se marcó la difusión, no se escribe nada.
 */
function narrativaDifusion(a5: Record<string, unknown>): string {
  if (!a5.herr_difusion) return "";
  const acta = str(a5, "difusion_acta_numero");
  const fecha = str(a5, "difusion_acta_fecha");
  const resumen = str(a5, "difusion_consultas_resumen");
  const ref = [acta ? `el ${acta}` : "un acta", fecha ? `del ${fechaCorta(fecha)}` : ""]
    .filter(Boolean)
    .join(" ");
  const base = `Difusión del requerimiento (Art. 51): las consultas y/o comentarios técnicos se absolvieron mediante ${ref}, publicada en la Pladicop.`;
  const conResumen = resumen ? `${base} ${resumen}` : base;

  // Reunión de confirmación y/o aclaración (Art. 51.4-51.5): un segundo acto,
  // opcional en el formulario porque no siempre se llega a realizar, pero con
  // su PROPIA acta cuando sí ocurre — no es la misma que la de la absolución.
  const actaReunion = str(a5, "difusion_reunion_acta_numero");
  const fechaReunion = str(a5, "difusion_reunion_acta_fecha");
  if (!actaReunion && !fechaReunion) return conResumen;
  const refReunion = [actaReunion ? `el ${actaReunion}` : "un acta", fechaReunion ? `del ${fechaCorta(fechaReunion)}` : ""]
    .filter(Boolean)
    .join(" ");
  return `${conResumen} Reunión de confirmación y/o aclaración (Art. 51.4-51.5): dirigida por la DEC, con ${refReunion}, publicada en la Pladicop.`;
}

/** dd/mm/aaaa a partir de un ISO de <input type="date">. */
function fechaCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * DETERMINACIÓN DE LA CUANTÍA, con el monto en letras.
 *
 * El Art. 47.1 pone "actualizar la cuantía de la contratación considerada en el
 * PAC del CMN" entre los fines de la interacción, y el documento real de la
 * entidad cierra el sustento con este bloque.
 */
function determinacionCuantia(
  a5: Record<string, unknown>,
  necesidad: NecesidadExport | null | undefined,
): string {
  // Misma cuantía que se escribe en el expediente al guardar A5: si el anexo y
  // la columna `valor_estimado` se calcularan por separado, acabarían diciendo
  // cifras distintas del mismo hecho.
  const monto = cuantiaDeA5(a5);
  if (monto == null) return "";
  const objeto = necesidad?.nombre?.trim() || "la contratación";
  const sustento = str(a5, "resultado_cuantia");
  return (
    `DETERMINACIÓN DE LA CUANTÍA DE LA CONTRATACIÓN: ` +
    `${sustento || `Se consideró el precio obtenido de la interacción con el mercado realizada por la entidad para ${objeto}.`} ` +
    `En consecuencia, la cuantía de la contratación total asciende a la suma de ${soles(monto)} ` +
    `(${numeroALetras(monto.toFixed(2))}).`
  );
}

/**
 * Pie del Anexo: fecha de elaboración y firma del responsable de la DEC.
 *
 * La plantilla oficial termina en la fila 26 (el sustento) y no trae ni fecha
 * ni firma, pero el Anexo que la entidad firma sí los lleva. Se añaden debajo
 * para no desplazar ni una celda del formato de arriba.
 */
function pieAnexo1(ws: ExcelJS.Worksheet, a5: Record<string, unknown>, responsableDescarga?: string | null) {
  const fecha = str(a5, "fecha_elaboracion");
  setCell(ws, "B28", "Fecha de elaboración:");
  setCell(ws, "D28", fecha ? new Date(`${fecha}T00:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : hoy());

  // El responsable de la DEC es quien DESCARGA el Anexo: ya no se teclea en A5,
  // sale del usuario en sesión. Si esa cuenta no tiene nombre (cuentas de rol del
  // seed), se respeta cualquier valor heredado que el expediente tuviera guardado.
  const responsable = (responsableDescarga ?? "").trim() || str(a5, "responsable_dec");
  if (responsable) setCell(ws, "B32", responsable);
  setCell(ws, "B33", "Firma del responsable de la DEC");
  ws.getCell("B33").alignment = { horizontal: "center" };
  ws.getCell("B28").font = { bold: true };
  // Trazabilidad de quién generó el documento (distinto de la firma de arriba:
  // esa es un rótulo institucional: "Firma del responsable de la DEC"; esta es
  // el registro literal de quién lo descargó, con nombre y apellido).
  if (responsable) {
    setCell(ws, "B35", `Elaborado por: ${responsable}`);
    ws.getCell("B35").font = { bold: true };
  }
}

function llenarAnexo1(
  ws: ExcelJS.Worksheet,
  proceso: ProcesoExport,
  hitos: HitosMap,
  necesidad?: NecesidadExport | null,
  responsableDescarga?: string | null,
) {
  const a5 = hitos.A5?.data ?? {};
  const nivel = str(a5, "nivel");

  // El nivel es la ÚNICA fuente del tipo. Antes había también un select
  // "tipo_interaccion" independiente, y con Tipo=consulta + Nivel=indagación
  // se marcaban las DOS casillas y se rellenaban las DOS secciones: el Anexo
  // afirmaba una indagación y una consulta a la vez.
  const tipo = tipoDeNivel(nivel);
  const esIndagacion = tipo === "indagacion";
  const esConsulta = tipo === "consulta_mercado";
  if (esIndagacion) mark(ws, "D3");
  if (esConsulta) mark(ws, "J3");

  const nivelCell: Record<string, string> = {
    indagacion_basica: "F8",
    indagacion_avanzada: "J8",
    consulta_mercado_basica: "F16",
    consulta_mercado_avanzada: "J16",
  };
  if (nivelCell[nivel]) mark(ws, nivelCell[nivel]);

  // El objeto lo manda la Necesidad, que es donde el área usuaria lo declara
  // (Art. 44.2). El del expediente es el respaldo para expedientes sin vínculo.
  const objeto = necesidad?.tipo_objeto?.trim() || proceso.object_type;
  if (ANEXO1_OBJETO_CELDA[objeto]) mark(ws, ANEXO1_OBJETO_CELDA[objeto]);

  // Casillas de fuentes (Art. 48.2) y herramientas (Art. 50.1).
  //
  // Antes NINGUNA se marcaba: A5 guardaba las dos como textarea libre y una
  // textarea no puede rellenar una casilla. El Anexo salía con todo el bloque
  // en blanco por muy bien redactado que estuviera el campo.
  const fuentesMarcadas: string[] = [];
  for (const f of FUENTES_ANEXO1) {
    if (!a5[f.key]) continue;
    mark(ws, f.celda);
    const detalle = "detalleCelda" in f && f.detalleCelda ? str(a5, "fuente_otras_detalle") : "";
    if (detalle && "detalleCelda" in f && f.detalleCelda) {
      setCell(ws, f.detalleCelda, `Otras: ${detalle}`);
    }
    fuentesMarcadas.push(detalle ? `${f.label} (${detalle})` : f.label);
  }
  const herramientasMarcadas: string[] = [];
  for (const h of HERRAMIENTAS_ANEXO1) {
    if (!a5[h.key]) continue;
    mark(ws, h.celda);
    if ("detalleCelda" in h && h.detalleCelda) {
      const detalle = str(a5, `${h.key}_detalle`);
      if (detalle) setCell(ws, h.detalleCelda, detalle);
      herramientasMarcadas.push(detalle ? `${h.label} (${detalle})` : h.label);
      continue;
    }
    // Reuniones sin acta (a diferencia de la difusión, el Art. 50.1.b no exige
    // una): fecha + resumen de lo tratado, para que la etiqueta no salga pelada
    // sin ningún sustento real de lo que se hizo. Difusión y solicitud de
    // información no tienen estos campos —la primera tiene su propio flujo de
    // actas (Art. 51); la segunda, la tabla de proveedores— así que aquí quedan
    // sin fecha/resumen y se pushea solo la etiqueta, como antes.
    const fecha = str(a5, `${h.key}_fecha`);
    const resumen = str(a5, `${h.key}_resumen`);
    herramientasMarcadas.push(`${h.label}${fecha ? ` (${fechaCorta(fecha)})` : ""}${resumen ? `: ${resumen}` : ""}`);
  }

  // Conclusiones de la interacción (Art. 47.1: perfeccionar el requerimiento,
  // medir competencia y riesgo de frustración, actualizar la cuantía).
  //
  // Antes esto leía `resultado`, una clave que A5 nunca tuvo: los campos son
  // `resultado_perfeccionamiento`, `_competencia`, `_riesgos` y `_cuantia`. El
  // sustento salía con las fuentes y sin una sola conclusión.
  const conclusiones = [
    str(a5, "resultado_perfeccionamiento")
      ? `Perfeccionamiento del requerimiento: ${str(a5, "resultado_perfeccionamiento")}`
      : "",
    str(a5, "resultado_competencia") ? `Competencia del mercado: ${str(a5, "resultado_competencia")}` : "",
    str(a5, "resultado_riesgos") ? `Riesgos identificados: ${str(a5, "resultado_riesgos")}` : "",
  ].filter(Boolean);

  const cabecera = cabeceraAnexo1(proceso, necesidad);
  // El sustento legal es opcional en A5 (el campo puede quedar en blanco). Si no
  // se registró, se cae al texto de la norma que corresponde al nivel —Art. 48 en
  // la indagación, Arts. 49-50 en la consulta— para que B12/B26 nunca salgan sin
  // su base legal.
  const citas = str(a5, "sustento_citas") || citasDeNivel(nivel) || "";
  const segmentacion = narrativaSegmentacion(hitos, necesidad, proceso);
  // Los proveedores cotizados van al sustento del tipo realizado: en la consulta
  // (Art. 49) y también en la indagación avanzada (Art. 48.2). Solo se escribe el
  // bloque del tipo activo, así que el encabezado se ata al `tipo` de la sección.
  const consulta = narrativaConsulta(a5, necesidad, tipo);
  const cuantia = determinacionCuantia(a5, necesidad);
  // Fecha(s) de la interacción: el Anexo pregunta "cuándo se realizaron las
  // actividades"; el campo existía en A5 pero no salía a ninguna parte.
  const fechaInteraccion = str(a5, "interaccion_fecha");
  const fechaInteraccionTexto = fechaInteraccion
    ? `Fecha(s) de la interacción con el mercado: ${fechaCorta(fechaInteraccion)}.`
    : "";
  // Difusión del requerimiento (Art. 51): si se usó, el acta de absolución es
  // OBLIGATORIA (51.3). El N°, la fecha y el resumen se registraban en A5 y no
  // llegaban al Anexo. Solo aplica a la consulta (la difusión es su herramienta).
  const difusion = narrativaDifusion(a5);

  // Cada sustento pertenece a su sección: B12 a la INDAGACIÓN y B26 a la
  // CONSULTA AL MERCADO. Y la sección que no se realizó lleva "NO
  // CORRESPONDE." — no el marcador "[INSERTAR EL SUSTENTO…]" de la plantilla,
  // que delata un formato a medio llenar.
  const fuentesTexto =
    fuentesMarcadas.length > 0 ? `Fuentes de información analizadas: ${fuentesMarcadas.join("; ")}.` : "";
  // Las herramientas van en su propia línea y no dentro del párrafo de la
  // consulta: si no se registró empresa ni documento, ese párrafo se omite y
  // las herramientas marcadas se quedaban sin documentar en el sustento.
  const herramientasTexto =
    herramientasMarcadas.length > 0
      ? `Herramienta(s) de consulta al mercado utilizada(s): ${herramientasMarcadas.join("; ")}.`
      : "";
  // La cuantía va en los dos bloques: el Art. 47.1 pone "actualizar la cuantía
  // de la contratación" entre los fines de la interacción, sea del tipo que sea.
  const bloqueIndagacion = [cabecera, citas, segmentacion, fechaInteraccionTexto, fuentesTexto, consulta, ...conclusiones, cuantia]
    .filter(Boolean)
    .join("\n");
  const bloqueConsulta = [cabecera, citas, segmentacion, fechaInteraccionTexto, herramientasTexto, difusion, consulta, ...conclusiones, cuantia]
    .filter(Boolean)
    .join("\n");

  const textoIndagacion = esIndagacion ? bloqueIndagacion : NO_CORRESPONDE;
  const textoConsulta = esConsulta ? bloqueConsulta : NO_CORRESPONDE;
  setCell(ws, "B12", textoIndagacion);
  setCell(ws, "B26", textoConsulta);
  // El alto se calcula: Excel no autoajusta filas con celdas combinadas.
  ajustarAltoSustento(ws, "B12", textoIndagacion);
  ajustarAltoSustento(ws, "B26", textoConsulta);

  // Pie: fecha de elaboración y firma del responsable de la DEC. No vienen en
  // la plantilla, pero el Anexo firmado de la entidad los lleva.
  pieAnexo1(ws, a5, responsableDescarga);
}

/**
 * Deja en "-" toda celda que conserve un marcador "[...]" de la plantilla sin
 * rellenar (p. ej. "[Insertar número]", "[SI/NO]", "[Insertar fecha]"). El
 * documento firmado no debe llevar instrucciones de plantilla; un guion deja
 * constancia de que ahí NO hubo dato. Se corre al FINAL, cuando lo que se iba a
 * llenar ya está: solo tocan las celdas que quedaron con el marcador (los datos
 * escritos no llevan corchetes), nunca las etiquetas ni las casillas (X).
 */
function marcadoresAGuion(ws: ExcelJS.Worksheet): void {
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (/^\s*\[[^\]]*\]\s*$/.test(textoDeCelda(cell))) {
        const target = cell.isMerged ? cell.master : cell;
        target.value = "-";
      }
    });
  });
}

// ===== Anexo N° 2 · Aprobación del expediente de contratación =====
function llenarAnexo2(
  ws: ExcelJS.Worksheet,
  proceso: ProcesoExport,
  hitos: HitosMap,
  necesidad?: NecesidadExport | null,
  usuarioDescarga?: string | null,
) {
  const a1 = hitos.A1?.data ?? {};
  const a2 = hitos.A2?.data ?? {};
  const a3 = hitos.A3?.data ?? {};
  const a4 = hitos.A4?.data ?? {}; // A4 · Estrategia (nomenclatura del procedimiento)
  const a5 = hitos.A5?.data ?? {}; // A5 · Interacción con el mercado (cuantía actualizada)
  const aEvaluadores = hitos.A6?.data ?? {}; // A6 · Designación de evaluadores
  const aCcp = hitos.A7?.data ?? {}; // A7 · Certificación de crédito presupuestario
  const a8 = hitos.A8?.data ?? {};

  // I. Datos generales
  // C4 es la DENOMINACIÓN del requerimiento (Art. 44.1). La fuente propia es el
  // `nombre` de la necesidad; solo si no hay necesidad se recorta del
  // `nomenclature` del expediente —que a veces trae una nomenclatura de
  // procedimiento real ("CP N° 001-2026"), y esa NO es la denominación—.
  setCell(ws, "C4", (necesidad?.nombre ?? "").trim() || denominacionSinCodigo(proceso.nomenclature));
  // C5: nombre del área usuaria, de la necesidad del expediente.
  setCell(ws, "C5", necesidad?.area_usuaria ?? "");
  setCell(ws, "C6", siNo(a1, "en_pac"));
  setCell(ws, "F6", str(a1, "referencia_pac"));
  // C7: N° de meta presupuestal, de la necesidad del expediente (Meta
  // presupuestal de la ficha). La CCP de A7 tiene su propia meta; esta es la del
  // requerimiento.
  setCell(ws, "C7", necesidad?.meta_presupuestal ?? "");
  // H7: fecha requerida (fecha del pedido) de la necesidad, en dd/mm/aaaa.
  setCell(ws, "H7", fechaISOaCorta(necesidad?.fecha_requerida));
  setCell(ws, "I6", objectTypeLabel(proceso.object_type));
  setCell(ws, "H8", hoy());
  // Procedimiento competitivo o no (fila 10): se marca con (X) la casilla que
  // corresponde. F10 es la casilla del COMPETITIVO (tras la etiqueta C10:E10) y
  // J10 la del NO competitivo (tras G10:I10). H10 NO es una casilla: está dentro
  // de la etiqueta "no competitivo". El régimen lo determina A1 (sin causal del
  // Art. 55 → competitivo, la regla general del Art. 54.3), que es lo que la
  // estrategia (A4) desarrolla al elegir su procedimiento.
  if (regimenDe(hitos) === "competitivo") mark(ws, "F10");
  else mark(ws, "J10");
  // C11: tipo de procedimiento y su nomenclatura (a) de A4). La etiqueta pide el
  // tipo; se le añade la nomenclatura para identificar el procedimiento.
  //
  // El TIPO lo fija la Estrategia (A4 `var_a_procedimiento`): el campo del
  // expediente (`procedure_type`) suele venir vacío hasta la convocatoria, y por
  // eso antes C11 salía solo con el número. Se prioriza A4 y se cae al expediente.
  const tipoProc = capitalizarProceso(
    str(a4, "var_a_proceso") ||
      labelProcedimiento(str(a4, "var_a_procedimiento")) ||
      processTypeLabel(proceso.procedure_type) ||
      proceso.procedure_type ||
      "",
  );
  // La nomenclatura sale del MISMO helper que la Estrategia: no duplica el "N° "
  // si el valor ya lo trae, y cae al `nomenclature` del expediente cuando A4 no
  // tiene la suya —salvo que ahí lo que haya sea el título de la necesidad—. Antes
  // aquí se pegaba "N° " a mano y solo se leía A4, así que un valor con "N°" salía
  // doble y un expediente sin nomenclatura en A4 se quedaba sin número.
  const nomenclaturaProc = nomenclaturaConNumero(
    nomenclaturaDelFormato(a4, proceso.nomenclature, necesidad?.nombre),
  );
  setCell(ws, "C11", `${tipoProc}${nomenclaturaProc ? ` ${nomenclaturaProc}` : ""}`.trim());
  // Celdas con texto largo: además del ajuste de línea, la fila crece para que se
  // vea el texto entero (el Anexo N° 2 no pasa por el auto-alto de toda la hoja).
  ajustarAltoFilaAnexo2(ws, "C4", 3, 10); // denominación del requerimiento (C4:J4)
  ajustarTexto(ws, "C11"); // tipo + nomenclatura (wrapText basta: cabe en su alto)
  // C19 se ajusta más abajo, tras escribir su valor (aquí aún tiene el
  // placeholder de la plantilla).

  // Clasificación de la segmentación (paso A2).
  if (hitos.A2) {
    const seg = clasificarSegmentacion({
      objeto: a2.objeto === "obras_consultoria_obras" ? "obras_consultoria_obras" : "bienes_servicios",
      cuantiaAlta: Boolean(a2.cuantiaAlta),
      condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
      criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
      centralizada: Boolean(a2.centralizada),
      esIoarr: Boolean(a2.esIoarr),
    });
    const segCell: Record<string, string> = {
      rutinaria: "F13",
      operacional: "F14",
      critico: "F15",
      estrategico: "F16",
      contratacion_basica: "J13",
      contratacion_avanzada: "J14",
    };
    if (segCell[seg.categoria]) mark(ws, segCell[seg.categoria]);
  }

  // II. Datos del requerimiento
  setCell(ws, "C19", str(a3, "descripcion"));
  ajustarAltoFilaAnexo2(ws, "C19", 3, 10); // alcance de la contratación (C19:J19)
  // Datos de mejora del requerimiento (fila 20): el documento con el que el área
  // usuaria remite el requerimiento (D20: el pedido de compra SIGA, que vive en
  // el Resumen/descripción de la necesidad) y la fecha en que la DEC lo recibe
  // (I20: celda de valor de la etiqueta "Fecha de recepción por la DEC" en
  // G20:H20). Ambos vienen de la Necesidad de origen.
  setCell(ws, "D20", necesidad?.summary ?? "");
  // I20: "Fecha de recepción por la DEC" (valor de la etiqueta G20:H20).
  setCell(ws, "I20", fechaISOaCorta(necesidad?.fecha_remision_dec));
  // Fechas de las versiones del requerimiento en el ciclo de no objeción: 2ª
  // versión en D21, "n" (última) versión en D23. De la Necesidad de origen.
  setCell(ws, "D21", fechaISOaCorta(necesidad?.fecha_version_dos));
  setCell(ws, "D23", fechaISOaCorta(necesidad?.fecha_version_n));
  // El resultado de la no objeción (A3) marca la ÚLTIMA versión registrada: su
  // casilla SÍ está en H, la NO en J. Si hay "n" versión, es su bloque (fila
  // 24); si no, el de la 2ª versión (fila 22). SÍ = otorgada, NO = objetado.
  const noObjecion = str(a3, "no_objecion");
  const filaNoObj = necesidad?.fecha_version_n ? 24 : 22;
  if (noObjecion === "otorgada") mark(ws, `H${filaNoObj}`);
  else if (noObjecion === "objetado") mark(ws, `J${filaNoObj}`);

  // "Para el caso de obras y consultoría de obras registrar lo siguiente:" (filas
  // 25-27 del formato oficial): especialidad (D25), subespecialidad (D26) y
  // tipología (D27), Art. 72.3.b / 157. Solo aplica a obras/consultoría de obra;
  // en bienes/servicios no se escribe y la limpieza final (marcadoresAGuion) deja
  // "-". La tipología aún no tiene campo propio en la necesidad, así que sale "-".
  const objetoNec = necesidad?.tipo_objeto ?? "";
  if (objetoNec === "obras" || objetoNec === "consultoria_obra") {
    setCell(ws, "D25", necesidad?.especialidad ?? "");
    setCell(ws, "D26", necesidad?.subespecialidad ?? "");
  }

  // III. Cuantía de la contratación
  // "¿La cuantía es punto de referencia?" (fila 30-31): se marca (X) en F31 si
  // SÍ y en H31 si NO, según lo respondido en la Estrategia (A4,
  // `si_cuantia_referencia` = si/no). Mismas casillas que el Formato de
  // Estrategia usa para esta misma variable II).
  const cuantiaRef = str(a4, "si_cuantia_referencia");
  if (cuantiaRef === "si") mark(ws, "F31");
  else if (cuantiaRef === "no") mark(ws, "H31");
  // Cuantía de la contratación (E33/E35): la BASE es la "Cuantía actualizada" de
  // A5 (Art. 53.1); si el expediente es antiguo y no la trae, el valor estimado.
  const monto = cuantiaDeA5(a5) ?? proceso.valor_estimado ?? proceso.amount ?? null;
  // B30: descripción del ítem = descripción de catálogo de la necesidad. Si
  // falta, se recurre a la descripción detallada (EETT/TDR), luego a la
  // denominación y por último al alcance de A3, para no dejar la celda vacía.
  // Fuera del `if` del monto: la descripción existe aunque no la cuantía.
  setCell(
    ws,
    "B33",
    necesidad?.descripcion_catalogo?.trim() ||
      necesidad?.descripcion_detallada?.trim() ||
      necesidad?.nombre?.trim() ||
      str(a3, "descripcion"),
  );
  ajustarAltoFilaAnexo2(ws, "B33", 2, 4); // descripción del ítem (B30:D30)
  if (monto != null) {
    setCell(ws, "E33", monto);
    setCell(ws, "E35", monto);
    // E30 ya trae el formato S/ de la plantilla; E32 (total) no, así que salía
    // como número pelado. Se le pone el mismo formato de soles.
    formatoSoles(ws, "E35");
  }

  // IV. Designación de evaluadores (paso A6)
  const tipoEval = str(aEvaluadores, "tipo_evaluador");
  const docDesig = str(aEvaluadores, "documento_designacion");
  const evalRow: Record<string, { x: string; doc: string }> = {
    oficial_compra: { x: "F39", doc: "G39" },
    comite: { x: "F40", doc: "G40" },
    jurado: { x: "F41", doc: "G41" },
  };
  if (evalRow[tipoEval]) {
    mark(ws, evalRow[tipoEval].x);
    // La celda pide "tipo de documento y número". Se antepone el tipo según el
    // evaluador: oficial de compra → "Memorándum N° "; comité/jurado → "INFORME
    // N° " (el documento de designación varía con el tipo). Antes salía solo el número.
    setCell(
      ws,
      evalRow[tipoEval].doc,
      docDesig ? `${prefijoDesignacion(tipoEval)}${soloNumeroDesignacion(docDesig)}` : "",
    );
  }

  // V. Certificación de crédito presupuestario y/o previsión (paso A7)
  // H41 = clasificador de gasto (etiqueta F41), de la necesidad del expediente.
  setCell(ws, "H44", necesidad?.clasificador_gasto ?? "");
  // La fecha (D42/D43 = "Fecha:") es la FECHA DE EMISIÓN del documento (A7), en
  // dd/mm/aaaa.
  const a7r = aCcp as Record<string, unknown>;
  const tipoA7 = str(aCcp, "tipo");
  if (tipoA7 === "ambas") {
    // La ejecución cruza años fiscales: la CCP (año en curso) va en las filas
    // 41/42 y la previsión (años siguientes) en las 43/44.
    setCell(ws, "C44", str(aCcp, "numero_ccp"));
    setCell(ws, "E44", str(aCcp, "meta_presupuestal"));
    setCell(ws, "C45", a7r.monto_ccp ?? "");
    setCell(ws, "E45", fechaISOaCorta(str(aCcp, "fecha_ccp")));
    setCell(ws, "C46", str(aCcp, "numero_prevision"));
    setCell(ws, "E46", fechaISOaCorta(str(aCcp, "fecha_prevision")));
    setCell(ws, "C47", a7r.monto_prevision ?? ""); // Monto 1 (D44 "Año 1")
    setCell(ws, "E47", a7r.vigencia ?? "");
  } else {
    const fechaCcp = fechaISOaCorta(str(aCcp, "fecha"));
    if (tipoA7 === "prevision") {
      setCell(ws, "C46", str(aCcp, "numero"));
      setCell(ws, "E46", fechaCcp);
      setCell(ws, "C47", a7r.monto ?? ""); // Monto 1
      setCell(ws, "E47", a7r.vigencia ?? ""); // Año 1
    } else {
      setCell(ws, "C44", str(aCcp, "numero"));
      setCell(ws, "E44", str(aCcp, "meta_presupuestal"));
      setCell(ws, "C45", a7r.monto ?? "");
      setCell(ws, "E45", fechaCcp);
    }
  }

  // VI. Otra documentación (Art. 54.2.g). El literal g) del expediente se captura
  // en A8 (req_otros) y va a la primera fila libre de la sección (B48:J48, luego
  // B49, B50). Sin esto, el dato se registraba pero no salía en el Anexo.
  const otros = str(a8, "req_otros");
  if (otros) {
    setCell(ws, "B51", otros);
    ajustarTexto(ws, "B51");
  }

  // Fecha de aprobación (paso A8). El valor va en C52 (B52 es la etiqueta
  // "FECHA DE LA APROBACIÓN:"), formateada dd/mm/aaaa. Si no se registró, hoy.
  setCell(ws, "C55", fechaISOaCorta(str(a8, "fecha_aprobacion")) || hoy());

  // Pie de firma, centrado al final de la hoja: la aprobación del expediente la
  // firma la autoridad de gestión administrativa o su delegado. Se deja una fila
  // en blanco encima (57-58) como espacio para la firma. No está en la plantilla
  // oficial; la pide la entidad. El centrado lo aplica `centrarTodo`.
  setCell(ws, "B59", "Firma de la autoridad de gestión administrativa o de a quien se hubiera delegado para firma.");
  ws.mergeCells("B59:J59");
  ajustarAltoFilaAnexo2(ws, "B59", 2, 10);

  // Trazabilidad de quién generó el documento (no es quien firma, arriba): una
  // fila nueva debajo, con una fila en blanco de separación (60).
  if (usuarioDescarga) {
    setCell(ws, "B61", `Elaborado por: ${usuarioDescarga}`);
    ws.mergeCells("B61:J61");
    ws.getCell("B61").font = { bold: true };
  }

  // Las celdas que se quedaron con el marcador "[...]" (sin dato) salen con "-",
  // no con la instrucción de la plantilla.
  marcadoresAGuion(ws);
  // La entidad pide TODO el contenido centrado (horizontal y vertical) en el
  // formato de aprobación del expediente. Se hace al final para que ni la cirugía
  // de filas ni el resto de escrituras lo dejen a medias.
  centrarTodo(ws);
  // Página A4, márgenes normales. Ajuste a UNA sola página A LO ANCHO; a lo alto
  // crece las páginas que haga falta (fitToHeight: 0 = sin límite vertical), para
  // no achicar el contenido al forzarlo todo en una hoja.
  ws.pageSetup = {
    ...ws.pageSetup,
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    // Centra el bloque en la página ("Centrar en la página" de Excel), tanto en
    // horizontal como en vertical, para que no salga pegado a la izquierda ni arriba.
    horizontalCentered: true,
    verticalCentered: true,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  };
}

// ===== Anexo N° 3 · Ejercicio práctico de segmentación =====
function generarAnexo3(proceso: ProcesoExport, hitos: HitosMap): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Segmentación");

  const a2 = hitos.A2?.data ?? {};

  ws.columns = [
    { header: "Campo", width: 35 },
    { header: "Valor", width: 50 },
  ];

  const rows: [string, string][] = [
    ["Expediente", proceso.nomenclature],
    ["Entidad", proceso.entity ?? ""],
    ["Objeto de contratación", objectTypeLabel(proceso.object_type)],
    ["Fecha de generación", hoy()],
    ["", ""],
    ["DATOS DE SEGMENTACIÓN", ""],
    ["Tipo de objeto", str(a2, "objeto") === "obras_consultoria_obras" ? "Obras / Consultoría de obras" : "Bienes / Servicios"],
  ];

  if (str(a2, "objeto") === "bienes_servicios") {
    rows.push(
      ["Cuantía alta (>10% PAC)", siNo(a2, "cuantiaAlta")],
      ["Condiciones de alto riesgo", Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]).join(", ") : ""],
    );
  } else {
    rows.push(
      ["Criterios de contratación básica cumplidos", Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]).join(", ") : ""],
    );
  }

  const segResult = a2.objeto
    ? clasificarSegmentacion({
        objeto: a2.objeto as ObjetoSegmentacion,
        cuantiaAlta: Boolean(a2.cuantiaAlta),
        condicionesRiesgo: Array.isArray(a2.condicionesRiesgo) ? (a2.condicionesRiesgo as string[]) : [],
        criteriosBasica: Array.isArray(a2.criteriosBasica) ? (a2.criteriosBasica as string[]) : [],
        centralizada: Boolean(a2.centralizada),
        esIoarr: Boolean(a2.esIoarr),
      })
    : null;

  if (segResult) {
    rows.push(
      ["Categoría", segResult.categoriaLabel],
      ["Nivel mínimo de interacción", segResult.nivelLabel],
      ["Requisito", segResult.nivelRequisito],
    );
  }

  rows.push(
    ["", ""],
    ["NOTAS Y CRONOGRAMA", ""],
  );

  if (Array.isArray(a2.cronogramaItems)) {
    (a2.cronogramaItems as Array<{ area: string; fecha: string }>).forEach((item, i) => {
      rows.push([`Cronograma: Área usuaria ${i + 1}`, `${item.area} - ${item.fecha}`]);
    });
  }

  rows.forEach(([a, b]) => {
    ws.addRow([a, b]);
  });

  // Estilo: negritas en la columna A.
  ws.eachRow((row) => {
    const cell = row.getCell(1);
    if (cell.value && typeof cell.value === "string" && cell.value === cell.value.toUpperCase()) {
      cell.font = { bold: true, size: 11 };
    }
  });

  return wb;
}

// ===== Checklist de Bases (A9) =====
// Quién elabora las bases (A9): oficial de compra / comité / DEC (si hay jurado).
const ELABORADO_POR_BASES: Record<string, string> = {
  oficial_compra: "Oficial de compra",
  comite: "Comité de selección",
  dec: "DEC (jurado)",
};

type FilaChecklist = { celdas: string[]; negrita?: boolean; esSeccion?: boolean };

/**
 * Filas del Checklist de Bases (A9), COMPARTIDAS por la descarga
 * (`generarChecklistBases`) y la vista previa (`previewChecklistBases`): así
 * la previa no puede decir una cosa y el .xlsx otra — mismo principio que
 * `previewHoja` para los formatos con plantilla.
 *
 * Cada casilla `contiene_*`/`factores_evaluacion_definidos` de A9 es required
 * y se registra: antes "Factores de evaluación" salía siempre en blanco (A9
 * no tenía un campo propio para eso, ver el fix del 2026-09-01).
 */
function filasChecklistBases(
  proceso: ProcesoExport,
  hitos: HitosMap,
  usuarioDescarga?: string | null,
): FilaChecklist[] {
  const a9 = hitos.A9?.data ?? {};
  const elaboradoPor = ELABORADO_POR_BASES[str(a9, "elaborado_por")] ?? str(a9, "elaborado_por");

  const filas: FilaChecklist[] = [
    { celdas: ["CHECKLIST DE BASES - PROCEDIMIENTO DE SELECCIÓN", "", ""], esSeccion: true, negrita: true },
    { celdas: ["Expediente", proceso.nomenclature] },
    { celdas: ["Entidad", proceso.entity ?? ""] },
    { celdas: ["Tipo de procedimiento", str(a9, "tipo_procedimiento") || (proceso.procedure_type ?? "")] },
    { celdas: ["Elaborado por", elaboradoPor] },
    { celdas: ["Fecha de generación", hoy()] },
    { celdas: [""] },
    { celdas: ["Requisito", "Cumple", "Detalle"], negrita: true },
    { celdas: ["Uso de bases estándar vigentes", siNo(a9, "usa_bases_estandar"), str(a9, "version_bases_estandar")] },
    { celdas: ["Requerimiento incluido según estructura del Capítulo III", siNo(a9, "contiene_requerimiento"), ""] },
    { celdas: ["Documentos para presentación de ofertas definidos", siNo(a9, "contiene_documentos_oferta"), ""] },
    {
      celdas: ["Condiciones para la ejecución contractual establecidas", siNo(a9, "contiene_condiciones_contractuales"), ""],
    },
    { celdas: ["Factores de evaluación definidos en bases", siNo(a9, "factores_evaluacion_definidos"), ""] },
    { celdas: ["Publicación en SEACE/PLADICOP", siNo(a9, "publicada_seace"), fechaISOaCorta(str(a9, "fecha_publicacion"))] },
    { celdas: [""] },
    { celdas: ["Observaciones", str(a9, "observaciones")] },
  ];

  if (usuarioDescarga) {
    filas.push({ celdas: [""] }, { celdas: [`Elaborado por: ${usuarioDescarga}`] });
  }

  return filas;
}

function generarChecklistBases(proceso: ProcesoExport, hitos: HitosMap, usuarioDescarga?: string | null): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Checklist Bases");

  // Solo anchos, SIN `header:` — con `header` exceljs escribe su propia fila
  // de encabezado en la 1, duplicando la que ya trae `filasChecklistBases`
  // (que además es la misma que usa la vista previa: con `header` aquí, la
  // previa —que no pasa por `ws.columns`— dejaría de coincidir con el .xlsx).
  ws.columns = [{ width: 50 }, { width: 15 }, { width: 40 }];

  for (const fila of filasChecklistBases(proceso, hitos, usuarioDescarga)) {
    ws.addRow(fila.celdas);
  }

  return wb;
}

// Genera el .xlsx del formato solicitado y devuelve el buffer.
/**
 * Vista previa del Anexo N° 1 para revisar ANTES de descargar.
 *
 * Devuelve lo mismo que se escribiría en el .xlsx, leyendo del mismo
 * `llenarAnexo1`: si la previa saliera de otro código, podría mentir sobre lo
 * que acabas descargando.
 */
/**
 * Texto plano de una celda, para las vistas previas.
 *
 * No vale `String(cell.value)`: las plantillas traen celdas con texto
 * enriquecido, y ahí `value` es un objeto `{richText: [...]}` que se imprime
 * como "[object Object]". Y `cell.text` peta cuando una celda combinada tiene
 * el valor a null, así que se compone a mano.
 */
function leerTexto(ws: ExcelJS.Worksheet, addr: string): string {
  const cell = ws.getCell(addr);
  const target = cell.isMerged ? cell.master : cell;
  const v = target.value;
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v && Array.isArray(v.richText)) {
    return v.richText.map((t: { text?: string }) => t.text ?? "").join("");
  }
  if (typeof v === "object" && "text" in v && typeof v.text === "string") return v.text;
  return String(v);
}

/** Una celda de la vista previa, ya resuelta (combinaciones incluidas). */
export type CeldaPreview = {
  celda: string;
  texto: string;
  colspan: number;
  rowspan: number;
  /** La (X) de una casilla del formato. */
  marca: boolean;
  negrita: boolean;
  /** Lo escribe ACE (vs. el rótulo impreso de la plantilla). */
  relleno: boolean;
  /** Alineación horizontal de la plantilla, para que la previa la respete. */
  alineacion?: "left" | "center" | "right";
  /** Barra de sección (rótulo en negrita a todo lo ancho): se sombrea. */
  esSeccion?: boolean;
};

/**
 * Vista previa de la HOJA tal y como se exporta.
 *
 * Renderiza la misma hoja que se descarga —celdas, combinaciones y todo—, no un
 * resumen paralelo: revisar aquí es revisar el archivo. Un listado de marcas
 * decía QUÉ se marca, pero no dejaba ver el formato ni pillar una casilla
 * puesta en la fila de al lado.
 */
export async function previewHoja(
  formato: "estrategia" | "anexo1" | "anexo2",
  input: { proceso: ProcesoExport; hitos: HitosMap; necesidad?: NecesidadExport | null; responsable?: string | null },
): Promise<{ titulo: string; filas: CeldaPreview[][]; anchos: number[] }> {
  const meta = PLANTILLAS[formato];
  const ruta = path.join(process.cwd(), "lib", "plantillas-f1", meta.archivo);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(ruta)) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];

  // La plantilla EN BLANCO, para saber qué texto es rótulo impreso y qué lo
  // pone ACE. Sin esto no se distingue lo tuyo de lo que ya venía.
  const wbBase = new ExcelJS.Workbook();
  await wbBase.xlsx.load((await readFile(ruta)) as unknown as ArrayBuffer);
  const wsBase = wbBase.worksheets[0];
  // El Anexo N° 2 usa columnas hasta la I/J igual que los demás; se barre B..J
  // (2..10) en los tres. Si algún formato creciera a la derecha, este es el
  // único número que habría que subir.
  const COL_MAX = 10;
  const original = new Map<string, string>();
  for (let r = 1; r <= wsBase.rowCount; r++) {
    for (let c = 2; c <= COL_MAX; c++) {
      original.set(`${r}:${c}`, leerTexto(wsBase, wsBase.getCell(r, c).address));
    }
  }

  // Cada formato se llena con SU MISMA función de exportación, así la previa no
  // puede decir una cosa y el .xlsx otra.
  if (formato === "estrategia") llenarEstrategia(ws, input.proceso, input.hitos, input.necesidad, input.responsable);
  else if (formato === "anexo1") llenarAnexo1(ws, input.proceso, input.hitos, input.necesidad, input.responsable);
  else llenarAnexo2(ws, input.proceso, input.hitos, input.necesidad, input.responsable);

  // Ida y vuelta por el .xlsx real ANTES de leer combinaciones: tras una cadena
  // de `unMergeCells`/`mergeCells` (como la que repara el rótulo de EJECUCIÓN en
  // `recombinarRotuloFase` cuando SELECCIÓN insertó filas encima), el `cell.master`
  // EN MEMORIA de la fila intermedia puede quedar desincronizado aunque el propio
  // `mergeCells` se ejecutó bien — se comprobó comparando este `ws` en vivo contra
  // uno releído del buffer ya escrito: el releído SÍ tenía el merge correcto y el
  // vivo no. Guardar y recargar es exactamente lo que hace `generarExcelF1`, así
  // que la previa termina viendo el mismo estado que el archivo descargado.
  const wsFinal = await (async () => {
    const buf = await wb.xlsx.writeBuffer();
    const wbFinal = new ExcelJS.Workbook();
    await wbFinal.xlsx.load(buf as unknown as ArrayBuffer);
    return wbFinal.worksheets[0];
  })();

  // Las combinaciones se resuelven con `cell.master`/`cell.isMerged` —que exceljs
  // mantiene al día tras insertar filas Y tras el guardado/recarga de arriba—,
  // NO con `model.merges` (que `duplicateRow` deja OBSOLETO: daba spans falsos
  // que descuadraban la grilla,
  // p. ej. filas del cronograma con más de 9 columnas). La celda ancla se pinta
  // con su colspan/rowspan; las cubiertas se saltan.
  //
  // El colspan/rowspan se calcula por BARRIDO de las celdas cubiertas (mismo
  // master), acotado a las columnas B..J que se pintan: así una combinación que
  // se extiende más allá de J no desborda la tabla.
  const cubierta = (cell: ExcelJS.Cell) =>
    cell.isMerged && cell.master ? cell.master.address !== cell.address : false;

  const filas: CeldaPreview[][] = [];
  // Índice de la última fila con texto: las filas en blanco INTERMEDIAS son los
  // espaciadores de la plantilla (dan la estructura del formato) y se conservan;
  // las del FINAL se recortan para no arrastrar una cola vacía.
  let ultimaConTexto = -1;
  for (let r = 1; r <= wsFinal.rowCount; r++) {
    // Las filas que el llenado OCULTA (p. ej. el bloque "II. SOLO PARA OBRAS…"
    // cuando el objeto no es obra) tampoco deben verse en la vista previa: la
    // previa tiene que reflejar lo que se exporta, no más.
    if (wsFinal.getRow(r).hidden) continue;
    const fila: CeldaPreview[] = [];
    for (let c = 2; c <= 10; c++) {
      const cell = wsFinal.getCell(r, c);
      if (cubierta(cell)) continue;
      const clave = `${r}:${c}`;
      const texto = leerTexto(wsFinal, cell.address);
      let colspan = 1;
      for (let cc = c + 1; cc <= 10; cc++) {
        const vecina = wsFinal.getCell(r, cc);
        if (vecina.isMerged && vecina.master?.address === cell.address) colspan += 1;
        else break;
      }
      let rowspan = 1;
      for (let rr = r + 1; rr <= wsFinal.rowCount; rr++) {
        const vecina = wsFinal.getCell(rr, c);
        if (vecina.isMerged && vecina.master?.address === cell.address) rowspan += 1;
        else break;
      }
      const alin = cell.alignment?.horizontal;
      const negrita = Boolean(cell.font?.bold);
      fila.push({
        alineacion: alin === "center" || alin === "centerContinuous" ? "center" : alin === "right" ? "right" : "left",
        celda: cell.address,
        colspan,
        // Barra de sección: rótulo en negrita a todo lo ancho de la tabla (B..J).
        esSeccion: negrita && colspan === 9,
        marca: texto.trim() === "X",
        negrita,
        relleno: texto.trim() !== "" && texto !== original.get(clave),
        rowspan,
        texto,
      });
    }
    // Una fila SIN celdas (toda cubierta por combinaciones verticales) no se pinta;
    // una fila con celdas pero sin texto es un espaciador y sí se conserva.
    if (fila.length === 0) continue;
    filas.push(fila);
    if (fila.some((x) => x.texto.trim())) ultimaConTexto = filas.length - 1;
  }
  // Recorta la cola de filas en blanco (deja las intermedias).
  filas.length = ultimaConTexto + 1;
  // Anchos de las columnas B..J (los del Excel) para que la vista previa respete
  // las proporciones del formato y no reparta el ancho a partes iguales.
  const anchos: number[] = [];
  for (let c = 2; c <= 10; c++) anchos.push(wsFinal.getColumn(c).width ?? 10);
  const titulos: Record<typeof formato, string> = {
    anexo1: "Anexo N° 1 · Interacción con el mercado",
    anexo2: "Anexo N° 2 · Aprobación del expediente de contratación",
    estrategia: "Formato de Estrategia de Contratación",
  };
  return { anchos, filas, titulo: titulos[formato] };
}

/**
 * Vista previa del Checklist de Bases (A9).
 *
 * A diferencia de estrategia/anexo1/anexo2 (formatos con plantilla .xlsx,
 * donde la previa se arma leyendo el archivo relleno), el checklist se
 * construye en código (`filasChecklistBases`), así que aquí no hace falta
 * cargar ni diferenciar un archivo base: se reusa la MISMA lista de filas que
 * escribe `generarChecklistBases`, para que la previa no pueda divergir de lo
 * que se descarga.
 */
export function previewChecklistBases(input: {
  proceso: ProcesoExport;
  hitos: HitosMap;
  responsable?: string | null;
}): { titulo: string; filas: CeldaPreview[][]; anchos: number[] } {
  const filasDatos = filasChecklistBases(input.proceso, input.hitos, input.responsable);
  const filas: CeldaPreview[][] = filasDatos.map((fila) =>
    fila.celdas.map((texto, c) => ({
      celda: `${String.fromCharCode(65 + c)}`,
      colspan: 1,
      esSeccion: fila.esSeccion ?? false,
      marca: false,
      negrita: fila.negrita ?? false,
      relleno: true,
      rowspan: 1,
      texto,
    })),
  );
  return { anchos: [50, 15, 40], filas, titulo: "Checklist de Bases" };
}

/**
 * Vista previa del Formato de Estrategia (A4).
 *
 * Igual que la del Anexo N° 1: sale de `llenarEstrategia`, el mismo código que
 * escribe el .xlsx. En un formato de ~60 casillas es donde más falta hace ver
 * qué se marcaría antes de descargar.
 */
export async function previewEstrategia(input: {
  proceso: ProcesoExport;
  hitos: HitosMap;
  necesidad?: NecesidadExport | null;
  responsable?: string | null;
}): Promise<{
  marcas: { celda: string; etiqueta: string }[];
  sustentos: { titulo: string; texto: string }[];
  sinResponder: string[];
}> {
  const ruta = path.join(process.cwd(), "lib", "plantillas-f1", PLANTILLAS.estrategia.archivo);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(ruta)) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  llenarEstrategia(ws, input.proceso, input.hitos, input.necesidad, input.responsable);

  const leer = (addr: string) => leerTexto(ws, addr);

  // Orden por la letra de la variable (a→t) para que la lista de casillas se lea
  // igual que el formato y que los sustentos. Sale de un mapa cell→etiqueta, así
  // que sin ordenar aparecería en orden de celda (l, m, n, c, c, d…). Las que no
  // llevan letra a–t (p. ej. "II)") van al final. Estable dentro de cada letra.
  const ordenLetra = (etiqueta: string): number => {
    const m = etiqueta.match(/^([a-z])\)/i);
    return m ? m[1].toLowerCase().charCodeAt(0) - 96 : 99;
  };
  const marcas = Object.entries({ ...ETIQUETAS_ESTRATEGIA, ...ETIQUETAS_EXTRA })
    .filter(([celda]) => leer(celda).trim() === "X")
    .map(([celda, etiqueta]) => ({ celda, etiqueta }))
    .sort((a, b) => ordenLetra(a.etiqueta) - ordenLetra(b.etiqueta));

  const sustentos = SUSTENTOS_ESTRATEGIA.map(({ celda, titulo }) => ({
    texto: leer(celda),
    titulo,
  })).filter((s) => s.texto.trim() && !s.texto.startsWith("[Insertar"));

  // Los SÍ/NO que nadie respondió. En el formato firmado están TODOS marcados,
  // y dejarlos en blanco no dice "no": dice "sin analizar". Es lo que una vista
  // previa tiene que delatar, porque en el Excel no se nota.
  const a4 = input.hitos.A4?.data ?? {};
  const sinResponder = Object.entries(SI_NO_ESTRATEGIA)
    .filter(([campo]) => !str(a4, `si_${campo}`))
    .map(([, celdas]) => ETIQUETAS_ESTRATEGIA[celdas.si]?.replace(/: SÍ$/, "") ?? celdas.si);

  // a) no se pregunta: se deduce comparando A1 con A4. Pero si falta cualquiera
  // de los dos, no se marca NADA y en el Excel eso no se nota. Avisar aquí es
  // el único sitio donde se ve antes de firmar.
  const a1 = input.hitos.A1?.data ?? {};
  if (a1.en_pac === false) {
    // No programada: no hay procedimiento en el PAC que modificar. Resuelto.
  } else if (!str(a1, "procedimiento_pac")) {
    sinResponder.push(
      "a) Modifica el procedimiento del PAC — falta “Procedimiento registrado en el PAC” en A1 (Programación)",
    );
  } else if (!str(a4, "var_a_procedimiento")) {
    sinResponder.push("a) Modifica el procedimiento del PAC — falta el tipo de procedimiento en este paso");
  }

  return { marcas, sinResponder, sustentos };
}

export async function previewAnexo1(input: {
  proceso: ProcesoExport;
  hitos: HitosMap;
  necesidad?: NecesidadExport | null;
  responsable?: string | null;
}): Promise<{
  marcas: { celda: string; etiqueta: string }[];
  sustentoIndagacion: string;
  sustentoConsulta: string;
  fecha: string;
  responsable: string;
}> {
  const ruta = path.join(process.cwd(), "lib", "plantillas-f1", PLANTILLAS.anexo1.archivo);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await readFile(ruta)) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  llenarAnexo1(ws, input.proceso, input.hitos, input.necesidad, input.responsable);

  const leer = (addr: string) => leerTexto(ws, addr);

  // Etiqueta de cada casilla marcada, tal y como la nombra el formato.
  const ETIQUETAS: Record<string, string> = {
    D3: "Tipo: Indagación",
    J3: "Tipo: Consulta al mercado",
    F8: "Indagación básica",
    J8: "Indagación avanzada",
    F16: "Consulta al mercado básica",
    J16: "Consulta al mercado avanzada",
    D24: "Objeto: Bien",
    F24: "Objeto: Servicio",
    H24: "Objeto: Obra",
    J24: "Objeto: Consultoría de obra",
    ...Object.fromEntries(FUENTES_ANEXO1.map((f) => [f.celda, `Fuente: ${f.label}`])),
    ...Object.fromEntries(HERRAMIENTAS_ANEXO1.map((h) => [h.celda, `Herramienta: ${h.label}`])),
  };
  const marcas = Object.entries(ETIQUETAS)
    .filter(([celda]) => leer(celda) === "X")
    .map(([celda, etiqueta]) => ({ celda, etiqueta }));

  return {
    fecha: leer("D28"),
    marcas,
    responsable: leer("B32"),
    sustentoConsulta: leer("B26"),
    sustentoIndagacion: leer("B12"),
  };
}

export async function generarExcelF1(
  formato: FormatoF1,
  input: { proceso: ProcesoExport; hitos: HitosMap; necesidad?: NecesidadExport | null; responsable?: string | null },
): Promise<{ buffer: Uint8Array; filename: string }> {
  if (formato === "anexo3") {
    const wb = generarAnexo3(input.proceso, input.hitos);
    const out = await wb.xlsx.writeBuffer();
    const safeNom = input.proceso.nomenclature.replace(/[^\w\-]+/g, "_").slice(0, 40);
    return { buffer: new Uint8Array(out as ArrayBuffer), filename: `Anexo-3-Segmentacion-${safeNom}.xlsx` };
  }
  if (formato === "bases_checklist") {
    const wb = generarChecklistBases(input.proceso, input.hitos, input.responsable);
    const out = await wb.xlsx.writeBuffer();
    const safeNom = input.proceso.nomenclature.replace(/[^\w\-]+/g, "_").slice(0, 40);
    return { buffer: new Uint8Array(out as ArrayBuffer), filename: `Checklist-Bases-${safeNom}.xlsx` };
  }

  const meta = PLANTILLAS[formato];
  const rutaPlantilla = path.join(process.cwd(), "lib", "plantillas-f1", meta.archivo);
  const contenido = await readFile(rutaPlantilla);

  const wb = new ExcelJS.Workbook();
  // exceljs acepta un Buffer/ArrayBuffer en runtime; el cast evita el desajuste
  // de tipos con NonSharedBuffer de los @types/node recientes.
  await wb.xlsx.load(contenido as unknown as ArrayBuffer);
  const ws = wb.worksheets[meta.hoja];
  if (!ws) {
    throw new Error(`La plantilla ${meta.archivo} no tiene la hoja ${meta.hoja}.`);
  }

  if (formato === "estrategia") llenarEstrategia(ws, input.proceso, input.hitos, input.necesidad, input.responsable);
  else if (formato === "anexo1") llenarAnexo1(ws, input.proceso, input.hitos, input.necesidad, input.responsable);
  else llenarAnexo2(ws, input.proceso, input.hitos, input.necesidad, input.responsable);

  const out = await wb.xlsx.writeBuffer();
  const safeNom = input.proceso.nomenclature.replace(/[^\w\-]+/g, "_").slice(0, 40);
  return { buffer: new Uint8Array(out as ArrayBuffer), filename: `${meta.nombre}-${safeNom}.xlsx` };
}
