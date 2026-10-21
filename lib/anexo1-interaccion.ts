// Listas cerradas del ANEXO N° 1 · Formato de interacción con el mercado.
//
// Las fuentes (Art. 48.2) y las herramientas (Art. 50.1) NO son texto libre: el
// Anexo N° 1 las trae como casillas a marcar con una (X). Mientras A5 las
// guardó como textarea, el formato salía con TODAS las casillas en blanco por
// muy bien redactado que estuviera el campo.
//
// Cada entrada lleva la celda exacta de la plantilla (lib/plantillas-f1/
// anexo-1.xlsx, byte a byte "6. MATERIAL - ANEXO-1.xlsx").

/** dd/mm/aaaa a partir de un ISO de <input type="date">. Mismo formato que fase1-export.ts. */
function fechaCortaLocal(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Fuentes de información para la indagación (Art. 48.2). */
export const FUENTES_ANEXO1 = [
  {
    celda: "F9",
    key: "fuente_historica",
    label: "Información histórica de la entidad contratante",
    ayuda: "Procedimientos de selección y contratos suscritos previamente de igual o similar objeto. Preferentemente de los tres últimos ejercicios presupuestales.",
  },
  {
    celda: "J9",
    key: "fuente_pladicop",
    label: "Información de otras entidades obtenidas de la Pladicop",
    ayuda: "SEACE, RNP, Catálogos Electrónicos, etc.",
  },
  {
    celda: "F10",
    detalleCelda: "C10",
    key: "fuente_otras",
    label: "Otras",
    ayuda: "Otras fuentes que se estimen pertinentes según la estrategia de contratación.",
  },
] as const;

/** Herramientas de consulta al mercado (Art. 50.1). */
export const HERRAMIENTAS_ANEXO1 = [
  { celda: "F17", clase: "Escritas", key: "herr_difusion", label: "Difusión del requerimiento" },
  { celda: "F18", clase: "Escritas", key: "herr_solicitud", label: "Solicitud de información a los proveedores" },
  { celda: "F19", clase: "Escritas", detalleCelda: "E19", key: "herr_escrita_otro", label: "Otro (escrita)" },
  { celda: "J17", clase: "Reuniones uno a muchos", key: "herr_reuniones_informativas", label: "Reuniones informativas" },
  { celda: "J18", clase: "Reuniones uno a muchos", key: "herr_talleres", label: "Talleres con la industria" },
  { celda: "J19", clase: "Reuniones uno a muchos", key: "herr_eventos_proveedores", label: "Eventos de exposición de proveedores" },
  { celda: "J20", clase: "Reuniones uno a muchos", key: "herr_eventos_entidad", label: "Eventos de exposición de la entidad contratante" },
  { celda: "J21", clase: "Reuniones uno a muchos", detalleCelda: "I21", key: "herr_reunion_otros", label: "Otros (reuniones uno a muchos)" },
  { celda: "J22", clase: "Reuniones individuales", key: "herr_reuniones_individuales", label: "Reuniones individuales" },
] as const;

/**
 * Sustento legal de la INDAGACIÓN, literal del Reglamento (Arts. 48.1 a 48.3).
 *
 * Va precargado y editable en A5: es texto de norma —no cambia entre
 * expedientes— pero la DEC puede ajustarlo antes de exportar.
 *
 * OJO: solo vale si la interacción fue una indagación. La consulta al mercado se
 * regula en los Arts. 49 y 50 y tiene su propio texto (CITAS_ART_49_50): el
 * criterio de básica/avanzada es DISTINTO —fuentes de información aquí,
 * herramientas allí— así que citar el 48 en una consulta sustenta la sección con
 * el artículo de otra cosa.
 */
export const CITAS_ART_48 = [
  "48.1. La indagación se basa en el análisis de datos e investigación de condiciones competitivas del mercado con relación al requerimiento, a fin de que dicha información sea considerada en la estrategia de contratación.",
  "48.2. Para la indagación se pueden emplear las siguientes fuentes de información: i) información histórica de la entidad contratante, que incluye procedimientos de selección y contratos suscritos previamente de igual o similar objeto; ii) información de procedimientos de selección y contratos suscritos por otras entidades contratantes, obtenidas de la Pladicop; y, iii) otras que se estimen pertinentes según la estrategia de contratación. Las fuentes de información referidas, de forma preferente corresponden a los tres últimos ejercicios presupuestales. Asimismo, se puede solicitar información a los potenciales proveedores del rubro del objeto de la convocatoria.",
  "48.3. La indagación puede ser básica o avanzada. Para la indagación básica se utilizan como mínimo una fuente de información, mientras que para la indagación avanzada se utilizan dos o más fuentes.",
].join("\n");

/**
 * Sustento legal de la CONSULTA AL MERCADO, literal del Reglamento (Arts. 49.1,
 * 49.2 y 50.1).
 *
 * Faltaba: A5 precargaba siempre el Art. 48 (indagación) fuera cual fuera el
 * tipo elegido, así que un Anexo N° 1 de consulta al mercado salía sustentando
 * su sección con el artículo de la indagación —y con el criterio equivocado:
 * el 48.3 cuenta FUENTES y el 49.2 cuenta HERRAMIENTAS.
 */
export const CITAS_ART_49_50 = [
  "49.1. Mediante la consulta al mercado, se propicia el intercambio de información de manera abierta y transparente con los proveedores.",
  "49.2. La consulta al mercado puede ser básica o avanzada. En el caso de la consulta al mercado básica, se emplea una sola herramienta de interacción, sea escrita o reuniones, mientras que para la avanzada se utilizan dos o más herramientas de la misma o distinta clasificación.",
  "50.1. Las herramientas de las consultas al mercado tienen la siguiente clasificación: a) Escrita: se utiliza para obtener retroalimentación de varios proveedores, como la difusión del requerimiento conforme a lo dispuesto en el artículo 51 o solicitudes de información a los proveedores, entre otros. b) Reuniones: b.1 Uno a muchos: se utiliza para comunicar aspectos clave de la contratación a varios proveedores o a la industria, como reuniones informativas, talleres con la industria o eventos de exposición de proveedores o de proyectos de la entidad contratante, entre otros. Esta herramienta puede emplearse para atender varios requerimientos. b.2 Uno a uno: se utiliza para obtener información detallada de una manera directa con el proveedor a través de reuniones individuales.",
].join("\n");

/**
 * El sustento legal que corresponde al nivel elegido en A5. La cita SIGUE al
 * tipo de interacción; no es un texto fijo.
 */
export function citasDeNivel(nivel: string): string | null {
  const tipo = tipoDeNivel(nivel);
  if (tipo === "indagacion") return CITAS_ART_48;
  if (tipo === "consulta_mercado") return CITAS_ART_49_50;
  return null;
}

/**
 * ¿El sustento cargado es el del OTRO tipo de interacción? Pasa cuando se
 * siembra el texto y después se cambia el nivel: el campo se queda citando el
 * artículo que ya no toca. Solo se afirma cuando el texto es exactamente uno de
 * los dos precargados — si la DEC lo redactó a mano, no hay nada que reprochar.
 */
export function citasSonDeOtroTipo(sustento: string, nivel: string): boolean {
  const esperadas = citasDeNivel(nivel);
  if (!esperadas) return false;
  const actual = (sustento ?? "").trim();
  if (!actual || actual === esperadas.trim()) return false;
  return actual === CITAS_ART_48.trim() || actual === CITAS_ART_49_50.trim();
}

/**
 * Texto de la sección que no se realizó.
 *
 * El Anexo trae un marcador "[INSERTAR EL SUSTENTO…]" en los dos sustentos. El
 * documento real de la entidad NO lo deja puesto ni lo borra: escribe "NO
 * CORRESPONDE." — dejar el marcador delata un formato a medio llenar.
 */
export const NO_CORRESPONDE = "NO CORRESPONDE.";

/**
 * Tipo de interacción DEDUCIDO del nivel.
 *
 * El nivel ya lo lleva dentro ("consulta_mercado_basica" es una consulta), así
 * que un select aparte de "Tipo de interacción" solo servía para contradecirlo:
 * con Tipo=consulta y Nivel=indagación básica, el Anexo salía con las DOS
 * casillas marcadas y las DOS secciones rellenas, afirmando que se hizo una
 * indagación y una consulta. Una decisión, un campo.
 */
export function tipoDeNivel(nivel: string): "indagacion" | "consulta_mercado" | null {
  if (nivel.startsWith("indagacion")) return "indagacion";
  if (nivel.startsWith("consulta_mercado")) return "consulta_mercado";
  return null;
}

/** Proveedor consultado en el mercado (Art. 49). Sustenta la cuantía. */
export type ProveedorConsultado = {
  ruc?: string;
  razonSocial?: string;
  documento?: string;
  fecha?: string;
  monto?: number;
};

export function leerProveedores(value: unknown): ProveedorConsultado[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is ProveedorConsultado => typeof p === "object" && p !== null);
}

/**
 * Cuantía a partir de las propuestas recibidas.
 *
 * `menor` por defecto: es el criterio del valor por dinero (Art. 27 de la Ley)
 * y el que usa el Anexo firmado de la entidad, que toma el precio obtenido de
 * la consulta. `promedio` queda disponible porque con varias propuestas
 * dispersas la entidad puede sustentar la media.
 */
export function cuantiaDeProveedores(
  proveedores: ProveedorConsultado[],
  criterio: string,
): number | null {
  const montos = proveedores
    .map((p) => Number(p.monto))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (montos.length === 0) return null;
  if (criterio === "promedio") {
    return Math.round((montos.reduce((a, b) => a + b, 0) / montos.length) * 100) / 100;
  }
  return Math.min(...montos);
}

/**
 * Cuantía de la contratación que resulta de la interacción con el mercado (A5).
 *
 * Es EL valor estimado del expediente: el Art. 47.1 pone "actualizar la cuantía
 * de la contratación considerada en el PAC del CMN" entre los fines de la
 * interacción. De aquí salen la línea de corte de A2 (Art. 125.2), la cuantía
 * que imprime el Formato 1 y la comparación contra la certificación de A7.
 *
 * La cuantía actualizada a mano manda sobre la tabla: si alguien la corrigió,
 * es porque conoce algo que la tabla no dice.
 */
/** Frase base del sustento de k) (la cuantía se actualizó). Es también la firma que
 * el seeding de A4 usa para reconocer una precarga NUESTRA y refrescarla. */
export const INTRO_CUANTIA_ACTUALIZADA =
  "La cuantía de la contratación se actualizó como resultado de la interacción con el mercado (Art. 47.1)";

/**
 * k) Sustento de la ACTUALIZACIÓN de la cuantía (Art. 46.1.k) precargado a partir
 * de lo que se marcó en A5, que es de donde salió el nuevo monto. Se usa cuando en
 * A4 se responde que la cuantía se actualizó (SÍ):
 *   - INDAGACIÓN → enumera "Fuente: <etiqueta>" por cada FUENTE marcada (Art. 48.2).
 *   - CONSULTA   → enumera "Herramienta: <etiqueta>" por cada HERRAMIENTA marcada (Art. 50.1).
 * En ambos casos, la opción "Otra(s)" añade su detalle si lo hay. Si A5 aún no tiene
 * casillas marcadas, devuelve SOLO la frase base (así k) = SÍ nunca queda sin
 * sustento). Devuelve "" únicamente cuando no hay datos de A5 en absoluto. Es una
 * redacción base, editable.
 */
export function sustentoCuantiaActualizada(a5: Record<string, unknown> | null | undefined): string {
  if (!a5) return "";
  const fuentes: string[] = [];
  for (const f of FUENTES_ANEXO1) {
    if (!a5[f.key]) continue;
    if (f.key === "fuente_otras") {
      const detalle = typeof a5.fuente_otras_detalle === "string" ? a5.fuente_otras_detalle.trim() : "";
      fuentes.push(detalle ? `Fuente: ${f.label} (${detalle})` : `Fuente: ${f.label}`);
    } else {
      fuentes.push(`Fuente: ${f.label}`);
    }
  }
  const herramientas: string[] = [];
  for (const h of HERRAMIENTAS_ANEXO1) {
    if (!a5[h.key]) continue;
    if ("detalleCelda" in h) {
      const bruto = a5[`${h.key}_detalle`];
      const detalle = typeof bruto === "string" ? bruto.trim() : "";
      herramientas.push(detalle ? `Herramienta: ${h.label} (${detalle})` : `Herramienta: ${h.label}`);
      continue;
    }
    // Reuniones sin acta (Art. 50.1.b no exige una, a diferencia de la difusión,
    // Art. 51): fecha + resumen de lo tratado, para que la línea no salga pelada
    // sin ningún sustento real de lo que se hizo.
    const fecha = typeof a5[`${h.key}_fecha`] === "string" ? (a5[`${h.key}_fecha`] as string).trim() : "";
    const resumen = typeof a5[`${h.key}_resumen`] === "string" ? (a5[`${h.key}_resumen`] as string).trim() : "";
    herramientas.push(`Herramienta: ${h.label}${fecha ? ` (${fechaCortaLocal(fecha)})` : ""}${resumen ? `: ${resumen}` : ""}`);
  }
  const lineas = [...fuentes, ...herramientas];
  // Sin casillas marcadas en A5: solo la frase base. No se queda vacío, para que k)
  // = SÍ siempre traiga su sustento (la DEC lo completa con las fuentes a mano).
  if (lineas.length === 0) return `${INTRO_CUANTIA_ACTUALIZADA}.`;
  // El "sobre la base de …" se ajusta a lo que realmente se usó (indagación vs
  // consulta), para que la frase no hable de fuentes cuando fueron herramientas.
  const base =
    fuentes.length > 0 && herramientas.length > 0
      ? "las fuentes de información y herramientas de consulta al mercado consideradas"
      : herramientas.length > 0
        ? "las herramientas de consulta al mercado utilizadas"
        : "las fuentes de información consideradas";
  return (
    `${INTRO_CUANTIA_ACTUALIZADA}, sobre la base de ${base}:\n` + lineas.map((l) => `- ${l}`).join("\n")
  );
}

export function cuantiaDeA5(a5: Record<string, unknown> | null | undefined): number | null {
  if (!a5) return null;
  const actualizada = Number(a5.cuantia_actualizada);
  if (Number.isFinite(actualizada) && actualizada > 0) return actualizada;
  const criterio = typeof a5.criterio_cuantia === "string" ? a5.criterio_cuantia : "";
  return cuantiaDeProveedores(leerProveedores(a5.proveedores), criterio);
}

/**
 * Documento de origen del requerimiento, extraído del Resumen de la Necesidad.
 *
 * La ficha guarda cosas como "Importado del pedido de compra SIGA N° 001838":
 * ese pedido es el documento REAL de la entidad con el que se consultó al
 * mercado, y es lo que el Anexo N° 1 cita en su sustento. El código REQ-2026-…
 * no sirve: es el identificador interno de ACE, no un documento.
 *
 * Se sugiere al añadir un proveedor, no se impone: puede haberse consultado con
 * otro documento. Devuelve "" si el resumen no menciona ninguno — inventar un
 * número de documento en un formato que se firma sería mucho peor que dejarlo
 * vacío.
 */
export function pedidoDeResumen(summary: string | null | undefined): string {
  if (!summary) return "";
  // "pedido de compra SIGA N° 001838", "pedido SIGA 1838-2026", "PECOSA N° 12"…
  const m = summary.match(/\b(pedido|pecosa|orden de compra|requerimiento siga)\b[^\n.;]*/i);
  if (!m) return "";
  return m[0].trim().replace(/[\s,]+$/, "").toUpperCase();
}
