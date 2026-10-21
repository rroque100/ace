import { camposExigidosDeterministas } from "./modelo-apartados";
import { z } from "zod";
import { type LegalSource, searchLegalSources } from "./legal-chat";
import { getOpenAIClient, legalAnswerModel } from "./openai-server";
import { LIMITES_TEXTO } from "./necesidades";
import { pdfsModeloDeProceso } from "./procesos-seleccion";
import { GUIA_SECCION_NOMBRE, type GuiaItem, REQUERIMIENTO_GUIA } from "./requerimiento-guia";
import { TIPOS_REQUISITO_ART72 } from "./requisitos-calificacion";
import { filtroEettTdr } from "./eett-tdr-documento";
import { getSupabaseServerConfig, supabaseRest, supabaseUserRest } from "./supabase-server";
import { tiposDelModeloComoLista } from "@/lib/requisitos-del-modelo";
import type { TipoRequisitoArt72 } from "@/lib/requisitos-calificacion";

// Copiloto del Requerimiento (Módulo Necesidades).
//
// Ayuda al área usuaria a REDACTAR y REVISAR el requerimiento (Art. 44 del
// Reglamento) del tipo de proceso elegido. Se apoya en DOS fuentes ancladas:
//   1. La guía determinista extraída de los PDFs de bases estándar
//      (lib/requerimiento-guia.ts) — las advertencias/notas del tipo.
//   2. La Ley N.° 32069 y su Reglamento REALES, recuperados del corpus indexado
//      con el mismo motor de búsqueda del chat legal (searchLegalSources): así
//      el copiloto cita artículos que existen, no inventados.
// La IA razona sobre ambas, pero no las contradice ni fabrica datos.

const campoSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  valor: z.string().max(20000).default(""),
});

// El campo a redactar lleva ADEMÁS su base legal (artículo que lo sustenta) y su
// sección, para que el copiloto ancle la recuperación del RAG y la redacción al
// artículo exacto de la Ley N.° 32069 / su Reglamento.
const campoObjetivoSchema = campoSchema.extend({
  baseLegal: z.string().trim().max(400).default(""),
  seccion: z.string().trim().max(120).default(""),
  // Molde del campo derivado del artículo (p. ej. la estructura tripartita del
  // Art. 44.1 para la finalidad): estructura a respetar y ejemplo de estilo. Es
  // lo que hace que "fundaméntate en la norma" se traduzca en la FORMA correcta,
  // no solo en el principio.
  plantilla: z.string().trim().max(1500).default(""),
  ejemplo: z.string().trim().max(1500).default(""),
});

export const copilotoRequestSchema = z.object({
  accion: z.enum(["redactar", "revisar", "chat"]),
  tipoProcesoSeleccion: z.string().max(200).default(""),
  tipoObjeto: z.string().max(80).default(""),
  // Necesidad asociada al requerimiento (para recuperar su TDR/EETT).
  necesidadId: z.string().max(40).optional(),
  // Campo concreto a redactar (acción "redactar").
  campoObjetivo: campoObjetivoSchema.optional(),
  // Pregunta libre (acción "chat").
  pregunta: z.string().trim().max(2000).optional(),
  // Campos ya rellenos, como contexto para redactar/revisar con coherencia.
  camposLlenos: z.array(campoSchema).max(120).default([]),
  // Campos OBLIGATORIOS aún vacíos (etiquetas), para que revisar priorice.
  faltantes: z.array(z.string().trim().max(200)).max(80).default([]),
  // Historial breve para dar continuidad al chat.
  historial: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(12)
    .default([]),
});

export type CopilotoRequest = z.infer<typeof copilotoRequestSchema>;
/** Fuente normativa citable que se envía al panel (chip). */
/**
 * Fuente citable que se envía al panel (chip).
 *
 * Lleva `documentId` y `rol` para que el chip pueda ABRIRSE, no solo leerse: con
 * ellos el panel enlaza la norma a /normas?documentId=...&article=... —que ya
 * acepta esos dos parametros y salta al articulo— y el PDF-modelo a su descarga.
 * Antes se descartaban aqui, y el usuario veia «Art. 44» sin manera de
 * comprobarlo, que es justo lo que una cita tiene que permitir.
 */
export type CopilotoFuente = {
  citation: string;
  article: string | null;
  documentType: string;
  documentId: string;
  rol: "modelo" | "norma";
};
export type CopilotoEvent =
  | { type: "fuentes"; fuentes: CopilotoFuente[] }
  /** La búsqueda vectorial no respondió: lo que se cite viene del respaldo léxico. */
  | { type: "aviso"; aviso: "busqueda-degradada" }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
// `rol` distingue el MODELO de requerimiento de la entidad (formato a seguir) de
// la NORMA (Ley/Reglamento, que se cita por artículo). Se renderizan en bloques
// de contexto distintos para no pedirle al modelo que "cite" el PDF-modelo.
type Fuente = CopilotoFuente & { excerpt: string };

/** Aplana la guía del tipo a texto por sección, para el contexto del modelo. */
function guiaTexto(tipo: string): string {
  const items = REQUERIMIENTO_GUIA[tipo] ?? [];
  if (items.length === 0) {
    return "No hay guía específica registrada para este tipo de proceso.";
  }

  const porSeccion = new Map<string, GuiaItem[]>();
  for (const item of items) {
    const arr = porSeccion.get(item.seccion) ?? [];
    arr.push(item);
    porSeccion.set(item.seccion, arr);
  }

  const partes: string[] = [];
  for (const [sec, arr] of porSeccion) {
    const nombre = GUIA_SECCION_NOMBRE[sec] ?? sec;
    const lineas = arr.map(
      (g) =>
        `- [${g.tipo === "advertencia" ? "ADVERTENCIA" : "NOTA"}]${
          g.etiqueta ? ` (${g.etiqueta})` : ""
        } ${g.texto}`,
    );
    partes.push(`### ${nombre}\n${lineas.join("\n")}`);
  }
  return partes.join("\n\n");
}

function camposTexto(campos: CopilotoRequest["camposLlenos"]): string {
  const conValor = campos.filter((c) => c.valor.trim() !== "");
  if (conValor.length === 0) {
    return "(El requerimiento aún no tiene campos rellenados.)";
  }
  return conValor.map((c) => `- ${c.label}: ${c.valor.trim()}`).join("\n");
}

/** Bloque del MODELO de requerimiento de la entidad (formato a seguir). */
function modeloTexto(fuentes: Fuente[], tipoProceso: string): string {
  const modelo = fuentes.filter((f) => f.rol === "modelo");
  if (modelo.length === 0) return "";
  const lineas = modelo.map((f, i) => `[M${i + 1}] ${f.excerpt}`);
  return [
    "",
    `MODELO DE REQUERIMIENTO DE TU ENTIDAD para «${tipoProceso || "el procedimiento elegido"}» (formato oficial a seguir):`,
    "Fragmentos del PDF-modelo que la unidad de abastecimiento cargó para ESTE procedimiento. Sigue su ESTRUCTURA, apartados, orden y estilo de redacción. NO cites sus páginas ni lo trates como norma: es la plantilla propia de la entidad.",
    ...lineas,
  ].join("\n");
}

/** Bloque de NORMA (Ley/Reglamento) — se cita por artículo. */
function fuentesTexto(fuentes: Fuente[]): string {
  const normas = fuentes.filter((f) => f.rol === "norma");
  if (normas.length === 0) return "";
  const lineas = normas.map(
    (f, i) => `[F${i + 1}] ${f.citation}${f.article ? ` (Art. ${f.article})` : ""}: ${f.excerpt}`,
  );
  return [
    "",
    "FUENTES NORMATIVAS RECUPERADAS (Ley N.° 32069 y su Reglamento — fundamenta con ellas):",
    ...lineas,
    "",
    "Cuando una indicación se apoye en la norma, cítala como «Art. X del Reglamento» (o de la Ley) usando SOLO artículos que aparezcan en estas fuentes. No inventes números de artículo ni atribuyas contenido a normas del régimen anterior (Ley 30225, D.S. 344-2018-EF).",
  ].join("\n");
}

const SISTEMA = [
  "Eres el copiloto de contratación pública del sistema ACE, experto en la Ley N.° 32069",
  "de Contrataciones Públicas del Perú y su Reglamento (D.S. 009-2025-EF, modificado por el",
  "D.S. 001-2026-EF). Asistes al ÁREA USUARIA en elaborar el REQUERIMIENTO (Art. 44 del",
  "Reglamento) del tipo de procedimiento de selección elegido.",
  "",
  "Reglas de trabajo:",
  "- Escribes en español formal-técnico, claro y conciso, listo para pegar en el documento oficial.",
  "- Te fundamentas en la Ley N.° 32069 y su Reglamento: usa las FUENTES NORMATIVAS recuperadas",
  "  para sustentar tus indicaciones y cita el artículo cuando corresponda.",
  "- Cuando se te entregue un MODELO DE REQUERIMIENTO DE LA ENTIDAD, ese es el formato oficial:",
  "  sigue su estructura, apartados y estilo de redacción para que el resultado sea consistente",
  "  con los documentos propios de la entidad. El modelo manda en la FORMA; la norma, en el FONDO.",
  "- Te ciñes ESTRICTAMENTE a las ADVERTENCIAS (obligaciones/prohibiciones) y NOTAS (recomendaciones)",
  "  de la guía oficial del tipo que se te entrega. Nunca las contradices ni las omites cuando aplican.",
  "- No inventas datos concretos (montos, plazos, fechas, nombres, cantidades). Si faltan, usa",
  "  marcadores [ENTRE CORCHETES] para que el usuario los complete.",
  "- No describes por marca, fabricante, tipo de producto ni procedencia; describes por desempeño",
  "  y funcionalidad (Art. 44.6).",
  "- Cuando redactes un campo, devuelve SOLO el texto propuesto para ese campo, sin encabezados",
  "  ni comentarios alrededor.",
  "- Cuando revises, sé específico: nombra el campo y la advertencia/nota o el artículo que aplica.",
  "- Si una duda excede las fuentes y la guía entregadas, dilo y sugiere consultar el Chat legal del sistema.",
].join("\n");

function contextoBase(input: CopilotoRequest, fuentes: Fuente[] = [], tdrChunks: string[] = []): string {
  const tdrBloque = tdrChunks.length > 0
    ? [
        "",
        "CONTENIDO DEL TDR (Extraído del PDF de Términos de Referencia de esta necesidad; léelo completo para redactar la matriz de riesgos):",
        tdrChunks.map((c, i) => `[TDR ${i + 1}] ${c}`).join("\n\n"),
      ].join("\n")
    : "";
  return [
    `Tipo de contratación (objeto): ${input.tipoObjeto || "no especificado"}`,
    `Tipo de procedimiento de selección: ${input.tipoProcesoSeleccion || "no especificado"}`,
    "",
    "GUÍA OFICIAL DEL TIPO (extraída de las bases estándar; anclaje obligatorio):",
    guiaTexto(input.tipoProcesoSeleccion),
    modeloTexto(fuentes, input.tipoProcesoSeleccion),
    "",
    "CONTENIDO ACTUAL DEL REQUERIMIENTO:",
    camposTexto(input.camposLlenos),
    input.faltantes.length > 0
      ? `\nCAMPOS OBLIGATORIOS AÚN VACÍOS: ${input.faltantes.join(", ")}.`
      : "",
    fuentesTexto(fuentes),
    tdrBloque,
  ].join("\n");
}

export function construirMensajesCopiloto(
  input: CopilotoRequest,
  fuentes: Fuente[] = [],
  tdrChunks: string[] = [],
): ChatMessage[] {
  const mensajes: ChatMessage[] = [
    { role: "system", content: SISTEMA },
    { role: "system", content: contextoBase(input, fuentes, tdrChunks) },
  ];

  if (input.accion === "redactar" && input.campoObjetivo) {
    const c = input.campoObjetivo;
    const esRiesgos = c.key === "gestionRiesgos";
    mensajes.push({
      role: "user",
      content: [
        `Redacta el contenido del campo «${c.label}»${c.seccion ? ` (sección ${c.seccion})` : ""} del requerimiento.`,
        c.baseLegal
          ? `Base legal del campo: ${c.baseLegal}. Fundaméntate en ese artículo de la Ley N.° 32069 o su Reglamento usando las FUENTES NORMATIVAS recuperadas; si el artículo aparece, cítalo.`
          : "",
        c.plantilla
          ? `ESTRUCTURA OBLIGATORIA (respeta el orden y todas sus partes; rellena los [corchetes] con los datos YA REGISTRADOS de esta necesidad —CONTENIDO ACTUAL DEL REQUERIMIENTO—, y deja en [corchetes] solo lo que no conste):\n${c.plantilla}`
          : "",
        c.ejemplo
          ? `Ejemplo de referencia del estilo y nivel de detalle esperados (NO lo copies literal; adáptalo a esta necesidad):\n${c.ejemplo}`
          : "",
        ...(esRiesgos
          ? [
              "",
              "INSTRUCCIONES ESPECÍFICAS PARA LA MATRIZ DE RIESGOS:",
              "Basándote en el CONTENIDO DEL TDR (términos de referencia) de arriba, en el tipo de contratación y procedimiento de selección, y en la Ley N.° 32069 y su Reglamento (Art. 44.3):",
              "",
              "Contenido de la Matriz: Debe incluir de forma obligatoria:",
              "Identificación de riesgos: Técnicos, ambientales, financieros, de seguridad, sociales, entre otros.",
              "Análisis cualitativo y cuantitativo: Estimación de la probabilidad de ocurrencia e impacto en el cronograma, presupuesto y calidad.",
              "Asignación del riesgo: Se asigna a la parte (Entidad o Contratista) que esté en mejor capacidad de gestionarlo y mitigarlo.",
              "Estrategias de respuesta: Acciones preventivas y correctivas debidamente justificadas.",
              "",
              "NO redactes ningún párrafo de sustento ni introducción. La salida EMPIEZA directamente con el encabezado «MATRIZ DE GESTIÓN DE RIESGOS» y a continuación la tabla Markdown con pipes (|). Nada antes del encabezado.",
              "",
              "Encabezado (texto suelto, sin tabla):",
              "MATRIZ DE GESTIÓN DE RIESGOS",
              "Nombre de la contratación: [del TDR]",
              "Proyecto: CUI [CUI de la necesidad si existe, si no: No aplica]",
              "Área usuaria: [del área usuaria]",
              "Marco Legal: Ley N.° 32069 y su Reglamento",
              "",
              "Estructura de la tabla:",
              "Categoría del Riesgo | Identificación del Riesgo | Análisis Cualitativo y Cuantitativo (Probabilidad / Impacto / Exposición) | Asignación del Riesgo (Responsable) | Estrategia de Respuesta / Mitigación | Relación con Penalidades",
              "",
              "Categorías a cubrir (al menos una por categoría; puede haber varias en la más relevante, hasta el total indicado más abajo):",
              "1. Técnico / Ejecución — ej: deficiencias técnicas, errores de expediente, calidad de materiales o ejecución.",
              "2. Financiero / Procura — ej: desabastecimiento de materiales, fluctuación de precios, problemas con proveedores.",
              "3. Administrativo / Legal — ej: demora en licencias o permisos, problemas documentarios, incumplimientos normativos.",
              "4. Seguridad y Salud — ej: accidentes laborales, falta de EPP, incumplimiento de normas de seguridad.",
              "5. Ambiental / Social — ej: hallazgos arqueológicos, contaminación, conflictos sociales, condiciones climáticas adversas.",
              "",
              "Reglas para cada celda:",
              "- Asignación: el riesgo se asigna a la parte que tenga mayor control sobre el evento (Entidad o Contratista).",
              "- Análisis Cualitativo y Cuantitativo: estimar probabilidad (Baja/Media/Alta) e impacto (Bajo/Medio/Alto/Crítico) en cronograma, presupuesto y calidad, y expresar la exposición resultante (Probabilidad × Impacto: Bajo/Medio/Alto/Muy alto). SOLO si el TDR aporta una cifra concreta, cítala tal cual; NO inventes porcentajes ni montos —si no hay dato, quédate en el nivel cualitativo.",
              "- Estrategia: acciones preventivas y correctivas específicas para el servicio del TDR, no genéricas.",
              "- Relación con Penalidades: indicar si corresponde multa, penalidad por mora, otras penalidades o si no aplica.",
              "OBJETIVIDAD: los riesgos deben expresarse en función del desempeño y la finalidad pública.",
              "",
              "Formato de la tabla Markdown (ejemplo):",
              "",
              "| Categoría del Riesgo | Identificación del Riesgo | Análisis Cualitativo y Cuantitativo | Asignación | Estrategia de Respuesta / Mitigación | Relación con Penalidades |",
              "|---|---|---|---|---|---|",
              "| Técnico / Ejecución | Deficiencias en el expediente técnico | Probabilidad: Media · Impacto: Alto (retrasos en el cronograma) · Exposición: Alta | Entidad | Revisión obligatoria del expediente por el contratista en etapa inicial | No aplica penalidad por ser error de la Entidad |",
              "",
              "Identifica entre 5 y 8 riesgos específicos del servicio descrito en el TDR (técnicos, ambientales, financieros, de seguridad, sociales, plazos, calidad, etc.). No uses riesgos genéricos. Cada riesgo debe corresponder a una característica real del servicio documentado en el TDR.",
              "",
              "Formato de salida:",
              "- Empieza con el encabezado «MATRIZ DE GESTIÓN DE RIESGOS» (texto suelto) y sus líneas de nombre/CUI/área/marco legal.",
              "- A continuación, la tabla de matriz de riesgos (con las columnas indicadas).",
              "- SIN párrafo de sustento, comentarios ni encabezados adicionales fuera del formato especificado.",
            ].join("\n")
          : ""),
        "Ajústate a la ESTRUCTURA legal de arriba en el FONDO y al estilo del MODELO DE REQUERIMIENTO de la entidad en la FORMA, si se te entregó.",
        c.valor.trim()
          ? `Texto actual (mejóralo o complétalo, no lo empeores):\n${c.valor.trim()}`
          : "El campo está vacío.",
        "Devuelve SOLO el texto propuesto para ese campo, sin encabezados ni comentarios.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return mensajes;
  }

  if (input.accion === "revisar") {
    mensajes.push({
      role: "user",
      content: [
        "Revisa el requerimiento actual frente a la guía oficial del tipo y a la Ley N.° 32069 y su Reglamento, y devuelve, en viñetas:",
        "1) Incumplimientos o riesgos frente a las ADVERTENCIAS de la guía o a la norma (cita el campo y el artículo).",
        "2) Campos obligatorios/importantes vacíos o débiles que conviene completar.",
        "3) Sugerencias concretas de mejora o texto sugerido.",
        "Sé breve y accionable. Si el requerimiento está conforme en un punto, no lo menciones.",
      ].join("\n"),
    });
    return mensajes;
  }

  // chat: continuidad con historial + pregunta libre.
  for (const h of input.historial) {
    mensajes.push({ role: h.role, content: h.content });
  }
  mensajes.push({
    role: "user",
    content: input.pregunta?.trim() || "¿Cómo puedo mejorar este requerimiento?",
  });
  return mensajes;
}

/** Extrae el número de artículo de una base legal ("Art. 44.1 Reglamento…" → "44.1"). */
function articuloDe(baseLegal: string | undefined | null): string | null {
  if (!baseLegal) return null;
  const m =
    baseLegal.match(/\bart[íi]culo\s+([0-9]+(?:\.[0-9]+)*[a-z]?)/i) ??
    baseLegal.match(/\bart\.?\s*([0-9]+(?:\.[0-9]+)*[a-z]?)/i);
  return m ? m[1] : null;
}

/** Consulta al corpus normativo, adaptada a la acción. Ancla a la Ley N.° 32069
 *  y su Reglamento, y —al redactar un campo— al artículo que lo sustenta. */
function consultaRAG(input: CopilotoRequest): string {
  const base = `Ley 32069 y su Reglamento · contratación pública · requerimiento ${input.tipoObjeto} ${input.tipoProcesoSeleccion}`.trim();
  if (input.accion === "redactar" && input.campoObjetivo) {
    const art = articuloDe(input.campoObjetivo.baseLegal);
    const artTxt = art ? `artículo ${art} del Reglamento. ` : "";
    return `${input.campoObjetivo.label} en el requerimiento de contratación. ${artTxt}${base}`;
  }
  if (input.accion === "chat" && input.pregunta && input.pregunta.trim().length >= 5) {
    return input.pregunta.trim();
  }
  return `requisitos del requerimiento, finalidad pública, condiciones de contratación y requisitos de calificación. ${base}`;
}

/**
 * Descarta los modelos cuyo objeto declarado no es el de la necesidad.
 *
 * Solo descarta cuando el modelo LO DECLARA: los que no lo tienen siguen
 * compitiendo, que es como quedaron los subidos antes de que existiera el campo.
 * Y si el filtro dejara la lista vacía, se devuelve la original: es preferible un
 * modelo de otro objeto que ninguno.
 */
export function filtrarModelosPorObjeto<T extends { metadata?: Record<string, unknown> | null }>(
  modelos: T[],
  tipoObjeto?: string | null,
): T[] {
  const objeto = (tipoObjeto ?? "").trim();
  if (!objeto) return modelos;
  const encajan = modelos.filter((m) => {
    const suyo = typeof m.metadata?.objeto === "string" ? m.metadata.objeto.trim() : "";
    return !suyo || suyo === objeto;
  });
  return encajan.length > 0 ? encajan : modelos;
}

/**
 * Modelos de requerimiento indexados para el procedimiento elegido.
 *
 * Devuelve TODOS los que le corresponden, no uno. La tipología del Reglamento es
 * más gruesa que las plantillas de la entidad: el «Concurso Público abreviado»
 * del Art. 94 es un único procedimiento y la entidad tiene cuatro modelos para
 * él (servicios, consultoría en general, consultoría de obra y mantenimiento
 * vial). Quedarse con el más reciente le daba al copiloto la plantilla
 * equivocada tres de cada cuatro veces; anclando en el conjunto, es el ranking
 * del RAG el que elige con la propia necesidad como consulta.
 *
 * Se descartan antes los modelos cuyo objeto declarado no encaja con el de la
 * necesidad, que es la parte que no conviene dejar al ranking: una plantilla de
 * consultoría de obra no debe competir por un servicio en general.
 *
 * Si varias entidades subieron el mismo modelo, prefiere los de la entidad del
 * usuario. Lista vacía si no hay modelo o no está indexado.
 */
export async function resolverModelosDocIds(
  tipoProceso: string,
  entity?: string | null,
  tipoObjeto?: string | null,
): Promise<string[]> {
  const comun =
    `&document_type=eq.bases_integradas&metadata->>kind=eq.modelo_requerimiento` +
    `&status=eq.indexed&select=id,source_entity,metadata&order=created_at.desc`;
  try {
    // Primero por el VÍNCULO explícito que lleva el documento. Antes solo se
    // buscaba por nombre de fichero exacto: renombrar el PDF o volver a subirlo
    // con otro nombre dejaba al copiloto sin modelo, y como el fallo devuelve
    // `null` igual que "no hay modelo", no había forma de notarlo.
    type Fila = { id: string; source_entity: string | null; metadata: Record<string, unknown> };
    let rows = await supabaseRest<Fila[]>(
      `documents?metadata->>procesoSeleccion=eq.${encodeURIComponent(tipoProceso)}${comun}`,
    );

    // Sin vínculo, se cae al nombre del catálogo: es como quedaron los modelos
    // subidos antes de que existiera el campo, y los que alguien suba sin
    // asignarles procedimiento.
    if (rows.length === 0) {
      // Un procedimiento puede tener VARIOS modelos base: la tipología del
      // Reglamento es más gruesa que las plantillas (el «Concurso Público para
      // consultorías y servicios de mantenimiento vial» del Art. 94 tiene tres).
      const pdfs = pdfsModeloDeProceso(tipoProceso);
      if (pdfs.length === 0) return [];
      const lista = pdfs.map((f) => `"${f.replace(/"/g, '\\"')}"`).join(",");
      rows = await supabaseRest<Fila[]>(
        `documents?file_name=in.(${encodeURIComponent(lista)})${comun}`,
      );
    }
    if (rows.length === 0) return [];

    rows = filtrarModelosPorObjeto(rows, tipoObjeto);

    if (entity) {
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      const propios = rows.filter((r) => r.source_entity && norm(r.source_entity) === norm(entity));
      if (propios.length > 0) return propios.map((r) => r.id);
    }
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

/**
 * El modelo PRINCIPAL del procedimiento: el primero del conjunto ya filtrado por
 * objeto y por entidad. Lo usan las funciones que leen un documento ENTERO
 * (comparar contra el modelo oficial, cachear los campos exigidos), donde no
 * cabe un conjunto. Con el filtro por objeto ya no es "el más reciente y suerte".
 */
async function resolverModeloDocId(
  tipoProceso: string,
  entity?: string | null,
  tipoObjeto?: string | null,
): Promise<string | null> {
  const ids = await resolverModelosDocIds(tipoProceso, entity, tipoObjeto);
  return ids[0] ?? null;
}

/**
 * MODELO de requerimiento de la entidad, anclado por documento: recupera SOLO los
 * fragmentos de los PDF-modelo del procedimiento elegido, ordenados por
 * relevancia a la consulta. Es la relación DIRECTA procedimiento → modelo.
 * Degrada en silencio.
 */
async function recuperarModelo(input: CopilotoRequest, entity?: string | null): Promise<Fuente[]> {
  const documentIds = await resolverModelosDocIds(
    input.tipoProcesoSeleccion,
    entity,
    input.tipoObjeto,
  );
  if (documentIds.length === 0) return [];
  try {
    const { sources } = await searchLegalSources({
      query: consultaRAG(input),
      // Con varios modelos hace falta más margen para que el ranking pueda
      // preferir los del que de verdad corresponde y no repartir uno por PDF.
      topK: Math.max(4, documentIds.length * 3),
      filters: { documentIds },
    });
    return sources.slice(0, 3).map((s: LegalSource) => ({
      citation: s.citation,
      article: s.article,
      documentType: s.documentType,
      documentId: s.documentId,
      excerpt: s.excerpt.slice(0, 700),
      rol: "modelo" as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Documentos del REGIMEN DE CONTRATACION, resueltos por su numero.
 *
 * El corpus tambien indexa la Ley 27444 (Procedimiento Administrativo General),
 * que son 241 articulos —mas del doble que los 100 de la Ley 32069— y que como
 * `document_type` es tambien "ley". Filtrar por tipo, que es lo que se hacia,
 * la dejaba competir de tu a tu: el copiloto acababa citando notificaciones,
 * publicacion de actos y TUPA como fundamento de un requerimiento.
 *
 * Se resuelven por `documentNumber` y no por UUID porque los identificadores
 * cambian en cada instalacion. Si la consulta falla se devuelve `null`, que el
 * llamador distingue de "lista vacia": sin filtro es mejor buscar en todo el
 * corpus que no buscar.
 */
const REGIMEN_CONTRATACION = ["32069", "009-2025-EF", "0001-2026-EF/54.01", "0006-2026-EF/54.01"];
let cacheRegimen: string[] | null = null;

async function documentosDelRegimen(): Promise<string[] | null> {
  if (cacheRegimen) return cacheRegimen;
  try {
    type Fila = { id: string; document_type: string; metadata: Record<string, unknown> };
    const rows = await supabaseRest<Fila[]>(
      "documents?status=eq.indexed&select=id,document_type,metadata",
    );
    const ids = rows
      .filter((r) => {
        const num = String((r.metadata as { documentNumber?: unknown })?.documentNumber ?? "").trim();
        // Las opiniones de la DTN/OECE interpretan ESTE regimen, asi que entran
        // aunque su numeracion no siga el patron de las normas.
        return REGIMEN_CONTRATACION.includes(num) || r.document_type === "opinion";
      })
      .map((r) => r.id);
    if (ids.length === 0) return null;
    cacheRegimen = ids;
    return ids;
  } catch {
    return null;
  }
}

/**
 * Puntuacion minima para presentar una fuente como «fundamento normativo».
 *
 * Sin umbral, la busqueda devolvia SIEMPRE sus cuatro primeros resultados por
 * flojo que fuera el parecido, y el panel los mostraba como si sustentaran el
 * texto. Es peor que no citar nada: invita a confiar en una referencia que no
 * dice lo que se afirma.
 */
const PUNTUACION_MINIMA = 0.35;

/** Recupera fuentes NORMATIVAS del regimen de contratacion.
 *  Si la busqueda FALLA (lanza), NO se calla: se marca `degradada` para que el
 *  copiloto avise «verifica cada articulo». Antes el catch devolvia
 *  `degradada: false` con cero fuentes, asi que el modelo redactaba citando
 *  articulos de memoria y el panel no mostraba ninguna advertencia —una cifra o
 *  un «Art. X» inventado salia con aspecto de fundamento real. */
async function recuperarNormativa(
  input: CopilotoRequest,
): Promise<{ fuentes: Fuente[]; degradada: boolean }> {
  try {
    const documentIds = await documentosDelRegimen();
    const { semanticaCaida, sources } = await searchLegalSources({
      query: consultaRAG(input),
      topK: 8,
      ...(documentIds ? { filters: { documentIds } } : {}),
    });
    const normativas = new Set(["ley", "reglamento", "directiva", "opinion", "resolucion"]);
    const fuentes = sources
      .filter((s: LegalSource) => normativas.has(s.documentType))
      .filter((s: LegalSource) => s.score >= PUNTUACION_MINIMA)
      .slice(0, 4)
      .map((s: LegalSource) => ({
        citation: s.citation,
        article: s.article,
        documentType: s.documentType,
        documentId: s.documentId,
        excerpt: s.excerpt.slice(0, 500),
        rol: "norma" as const,
      }));
    return { degradada: semanticaCaida, fuentes };
  } catch {
    // Un fallo de la busqueda ES una degradacion: sin fuentes y, si no se avisa,
    // el texto sale citando de memoria. Se senala para que el panel lo advierta.
    return { degradada: true, fuentes: [] };
  }
}

/** Fuentes del copiloto: MODELO de la entidad (primero, formato a seguir) +
 *  NORMA (fundamento). Se recuperan en paralelo. */
async function recuperarFuentes(
  input: CopilotoRequest,
  entity?: string | null,
): Promise<{ fuentes: Fuente[]; degradada: boolean }> {
  const [modelo, normativa] = await Promise.all([
    recuperarModelo(input, entity),
    recuperarNormativa(input),
  ]);
  return { degradada: normativa.degradada, fuentes: [...modelo, ...normativa.fuentes] };
}

export async function* streamCopiloto(
  input: CopilotoRequest,
  options?: { entity?: string | null },
): AsyncGenerator<CopilotoEvent> {
  const { degradada, fuentes } = await recuperarFuentes(input, options?.entity);

  // Recupera los chunks del TDR/EETT para la matriz de riesgos.
  let tdrChunks: string[] = [];
  if (input.accion === "redactar" && input.campoObjetivo?.key === "gestionRiesgos" && input.necesidadId) {
    try {
      getSupabaseServerConfig();
      const [doc] = await supabaseRest<Array<{ id: string }>>(
        `documents?${filtroEettTdr(input.necesidadId)}&select=id&limit=1`,
      );
      if (doc) {
        const chunks = await supabaseRest<Array<{ content: string; chunk_index: number }>>(
          `document_chunks?document_id=eq.${doc.id}&select=content,chunk_index&order=chunk_index.asc&limit=30`,
        );
        tdrChunks = chunks.map((c) => c.content);
      }
    } catch {
      tdrChunks = [];
    }
  }

  // Se avisa ANTES de las fuentes: si la búsqueda vectorial no respondió, lo que
  // venga detrás sale del respaldo léxico y el usuario tiene que saberlo antes de
  // leerlo, no después.
  if (degradada) {
    yield { type: "aviso", aviso: "busqueda-degradada" };
  }
  if (fuentes.length > 0) {
    yield {
      type: "fuentes",
      fuentes: fuentes.map((f) => ({
        citation: f.citation,
        article: f.article,
        documentType: f.documentType,
        documentId: f.documentId,
        rol: f.rol,
      })),
    };
  }

  const client = getOpenAIClient();
  // Matriz de riesgos: necesita más tokens (tabla de 6 columnas × 5-8 filas).
  const esMatrizRiesgos = input.accion === "redactar" && input.campoObjetivo?.key === "gestionRiesgos";
  const stream = await client.responses.create({
    input: construirMensajesCopiloto(input, fuentes, tdrChunks),
    max_output_tokens: esMatrizRiesgos ? 3000 : input.accion === "revisar" ? 1300 : 1200,
    model: legalAnswerModel,
    stream: true,
    temperature: 0.3,
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield { type: "delta", text: event.delta };
    }
  }
  yield { type: "done" };
}

// ---------------------------------------------------------------------------
// Autocompletado de la ficha DESDE EL MODELO del proceso elegido.
//
// A diferencia del streaming conversacional, esto devuelve una propuesta
// ESTRUCTURADA (JSON) campo→valor + la lista de campos que el requerimiento del
// proceso EXIGE, para que la ficha marque esos campos. Se ancla al PDF-modelo
// del proceso (misma relación directa que el copiloto) + la norma.
// ---------------------------------------------------------------------------

const completarCampoSchema = z.object({
  api: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  seccion: z.string().trim().max(120).default(""),
  baseLegal: z.string().trim().max(400).default(""),
  obligatorio: z.boolean().default(false),
  // Estructura del campo derivada de su artículo (p. ej. la tripartita del
  // Art. 44.1 para la finalidad). Cuando existe, la propuesta debe seguirla.
  plantilla: z.string().trim().max(1500).default(""),
});

export const completarModeloRequestSchema = z.object({
  tipoProcesoSeleccion: z.string().max(200).default(""),
  tipoObjeto: z.string().max(80).default(""),
  // Campos aplicables al proceso/objeto que el copiloto puede proponer.
  camposObjetivo: z.array(completarCampoSchema).min(1).max(120),
  // Campos ya rellenos (contexto para coherencia; no se re-proponen a la fuerza).
  camposLlenos: z.array(campoSchema).max(120).default([]),
});

export type CompletarModeloRequest = z.infer<typeof completarModeloRequestSchema>;
export type CompletarModeloResult = {
  /** Propuesta campo(api)→texto listo para pegar. Solo campos con sustento. */
  campos: Record<string, string>;
  /** api de los campos que ESTE proceso exige (para marcarlos en la ficha). */
  exigidos: string[];
  /** true si se encontró el PDF-modelo del proceso (formato de la entidad). */
  usoModelo: boolean;
};

/** Extrae el primer objeto JSON de una respuesta del modelo (tolera fences). */
/** Repara un JSON TRUNCADO (cierra cadenas/corchetes abiertos, quita colas
 *  incompletas) para salvar los elementos completos de un array cortado. */
function repararJson(s: string): string {
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  let out = "";
  for (const ch of s) {
    out += ch;
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inStr) out += '"';
  // Quita una clave sin valor colgante ("...": ) o una coma final.
  out = out.replace(/,?\s*"[^"]*"\s*:\s*$/, "").replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i];
  return out;
}

function parseJsonObjeto(raw: string): Record<string, unknown> {
  const sinFence = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const ini = sinFence.indexOf("{");
  if (ini === -1) return {};
  const fin = sinFence.lastIndexOf("}");
  if (fin > ini) {
    try {
      return JSON.parse(sinFence.slice(ini, fin + 1));
    } catch {
      /* JSON incompleto/roto → se intenta reparar abajo */
    }
  }
  // Salvavidas: reparar un JSON truncado (p. ej. salida cortada por max_tokens).
  try {
    return JSON.parse(repararJson(sinFence.slice(ini)));
  } catch {
    return {};
  }
}

const COMPLETAR_SISTEMA = [
  "Eres el copiloto de contratación pública del sistema ACE (Ley N.° 32069 y su Reglamento).",
  "Tu tarea: PROPONER el contenido de los campos del REQUERIMIENTO (Art. 44) del procedimiento de",
  "selección indicado, apoyándote en el MODELO DE REQUERIMIENTO de la entidad (su formato oficial)",
  "y en la norma. Devuelves EXCLUSIVAMENTE un objeto JSON, sin texto alrededor, con esta forma:",
  '{ "campos": { "<api>": "<texto propuesto>" }, "exigidos": ["<api>", ...] }',
  "",
  "Reglas:",
  "- «campos»: incluye SOLO los campos para los que puedas redactar algo útil a partir del modelo,",
  "  la guía o la buena práctica general. Redacta en español formal-técnico, listo para pegar.",
  "- NO inventes datos concretos (montos, plazos, fechas, cantidades, nombres). Donde falten, usa",
  "  marcadores [ENTRE CORCHETES] para que el usuario los complete. Si un campo no tiene sustento",
  "  alguno, OMÍTELO (no lo incluyas en «campos»).",
  "- Describe por desempeño y funcionalidad; nunca por marca, fabricante ni procedencia (Art. 44.6).",
  "- Cuando un campo objetivo traiga «estructura obligatoria», el texto propuesto DEBE seguir esa",
  "  estructura y su orden: es la FORMA que exige su artículo (p. ej. la finalidad pública, Art. 44.1:",
  "  necesidad → finalidad pública → valor por dinero). Rellena sus [corchetes] con los CAMPOS YA",
  "  RELLENOS y deja en [corchetes] lo que no conste.",
  "- «exigidos»: lista de api de los campos que ESTE procedimiento EXIGE según su modelo/bases",
  "  (obligatorios para este tipo de proceso), aunque no los hayas redactado.",
  "- Usa SOLO las api que aparezcan en la lista de campos objetivo. No inventes claves.",
].join("\n");

// Variante para la ESTRATEGIA de contratación (Art. 46), no el requerimiento. La
// estrategia es un ANÁLISIS que fundamenta cada decisión, no una afirmación
// suelta: el prompt lo pide explícito. El resto del contrato (JSON, api, no
// inventar datos) es idéntico.
const COMPLETAR_SISTEMA_ESTRATEGIA = [
  "Eres el copiloto de contratación pública del sistema ACE (Ley N.° 32069 y su Reglamento).",
  "Tu tarea: PROPONER el contenido de las variables de la ESTRATEGIA DE CONTRATACIÓN (Art. 46) del",
  "procedimiento de selección indicado, apoyándote en las BASES/MODELO de la entidad y en la norma.",
  "Devuelves EXCLUSIVAMENTE un objeto JSON, sin texto alrededor, con esta forma:",
  '{ "campos": { "<api>": "<texto propuesto>" }, "exigidos": ["<api>", ...] }',
  "",
  "Reglas:",
  "- «campos»: incluye SOLO las variables para las que puedas redactar un ANÁLISIS o SUSTENTO útil.",
  "  La estrategia FUNDAMENTA cada decisión (Art. 46.1): explica el porqué apoyándote en el",
  "  requerimiento y en la interacción con el mercado. Redacta en español formal-técnico.",
  "- NO inventes datos concretos (montos, plazos, fechas, nombres). Donde falten, usa marcadores",
  "  [ENTRE CORCHETES]. Si una variable no tiene sustento alguno, OMÍTELA.",
  "- «exigidos»: api de las variables que ESTE procedimiento exige según su modelo/bases.",
  "- Usa SOLO las api que aparezcan en la lista de campos objetivo. No inventes claves.",
].join("\n");

/**
 * Genera una propuesta estructurada campo→valor para la ficha, anclada al
 * PDF-modelo del proceso elegido. Degrada con lo que tenga: si no hay modelo,
 * usa guía + norma; si el modelo IA no devuelve JSON válido, retorna vacío.
 */
export async function completarDesdeModelo(
  input: CompletarModeloRequest,
  options?: { entity?: string | null; perfil?: "requerimiento" | "estrategia" },
): Promise<CompletarModeloResult> {
  // Por defecto redacta el REQUERIMIENTO (lo que usa la ficha); con perfil
  // "estrategia" cambia el prompt, la consulta y la etiqueta del modelo hacia el
  // Art. 46 (lo que usa A4 del expediente). El resto del flujo es idéntico.
  const esEstrategia = options?.perfil === "estrategia";
  const query = esEstrategia
    ? `Ley 32069 y su Reglamento · estrategia de contratación ${input.tipoObjeto} ${input.tipoProcesoSeleccion} ` +
      "tipo de procedimiento, evaluadores, factores de evaluación, modalidad de pago, interacción con el mercado"
    : `Ley 32069 y su Reglamento · requerimiento de contratación ${input.tipoObjeto} ${input.tipoProcesoSeleccion} ` +
      "finalidad pública, condiciones de contratación, términos de referencia y requisitos de calificación";

  const docIds = await resolverModelosDocIds(input.tipoProcesoSeleccion, options?.entity, input.tipoObjeto);
  const [modeloRes, normaRes] = await Promise.all([
    docIds.length > 0
      ? searchLegalSources({ query, topK: Math.max(6, docIds.length * 3), filters: { documentIds: docIds } })
          .then((r) => r.sources)
          .catch(() => [] as LegalSource[])
      : Promise.resolve([] as LegalSource[]),
    searchLegalSources({ query, topK: 6 })
      .then((r) => r.sources.filter((s) => ["ley", "reglamento", "directiva"].includes(s.documentType)))
      .catch(() => [] as LegalSource[]),
  ]);

  const modeloTxt = modeloRes.slice(0, 6).map((s, i) => `[M${i + 1}] ${s.excerpt.slice(0, 900)}`).join("\n");
  const normaTxt = normaRes
    .slice(0, 4)
    .map((s, i) => `[F${i + 1}] ${s.citation}${s.article ? ` (Art. ${s.article})` : ""}: ${s.excerpt.slice(0, 400)}`)
    .join("\n");

  const camposLista = input.camposObjetivo
    .map(
      (c) =>
        `- api="${c.api}" · "${c.label}"${c.seccion ? ` [${c.seccion}]` : ""}${c.obligatorio ? " (obligatorio)" : ""}` +
        `${c.baseLegal ? ` · base legal: ${c.baseLegal}` : ""}` +
        `${c.plantilla ? `\n    · estructura obligatoria (sigue su orden; rellena los [corchetes] con los CAMPOS YA RELLENOS): ${c.plantilla}` : ""}`,
    )
    .join("\n");
  const llenosTxt =
    input.camposLlenos
      .filter((c) => c.valor.trim())
      .map((c) => `- ${c.label}: ${c.valor.trim().slice(0, 300)}`)
      .join("\n") || "(ninguno)";

  const user = [
    `Tipo de contratación (objeto): ${input.tipoObjeto || "no especificado"}`,
    `Procedimiento de selección: ${input.tipoProcesoSeleccion || "no especificado"}`,
    "",
    "GUÍA OFICIAL DEL TIPO (anclaje obligatorio):",
    guiaTexto(input.tipoProcesoSeleccion),
    "",
    modeloTxt
      ? `${esEstrategia ? "BASES/MODELO DE LA ENTIDAD" : "MODELO DE REQUERIMIENTO DE LA ENTIDAD"} (formato a seguir):\n${modeloTxt}`
      : `${esEstrategia ? "BASES/MODELO DE LA ENTIDAD" : "MODELO DE REQUERIMIENTO DE LA ENTIDAD"}: no disponible; apóyate en la guía y la norma.`,
    "",
    normaTxt ? `FUENTES NORMATIVAS:\n${normaTxt}` : "",
    "",
    "CAMPOS YA RELLENOS (para coherencia):",
    llenosTxt,
    "",
    "CAMPOS OBJETIVO (propón valor para los que tengan sustento; usa estas api exactas):",
    camposLista,
  ].join("\n");

  const client = getOpenAIClient();
  const resp = await client.responses.create({
    input: [
      { role: "system", content: esEstrategia ? COMPLETAR_SISTEMA_ESTRATEGIA : COMPLETAR_SISTEMA },
      { role: "user", content: user },
    ],
    max_output_tokens: 5000,
    model: legalAnswerModel,
    temperature: 0.2,
  });

  const parsed = parseJsonObjeto(resp.output_text ?? "");
  const apiSet = new Set(input.camposObjetivo.map((c) => c.api));
  const campos: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.campos ?? {})) {
    if (!apiSet.has(k) || typeof v !== "string") continue;
    const texto = v.trim();
    if (!texto) continue;
    // Capado al tope del schema del campo: evita que el PATCH de "Aplicar" rebote
    // con 400 por un texto más largo que su columna.
    const limite = LIMITES_TEXTO[k];
    campos[k] = limite && texto.length > limite ? texto.slice(0, limite) : texto;
  }
  const exigidos = Array.isArray(parsed.exigidos)
    ? Array.from(new Set(parsed.exigidos.filter((k): k is string => typeof k === "string" && apiSet.has(k))))
    : [];

  return { campos, exigidos, usoModelo: modeloRes.length > 0 };
}

// ---------------------------------------------------------------------------
// Revisión del EETT/TDR (1.ª versión del área usuaria) contra el modelo OECE.
// ---------------------------------------------------------------------------

export const revisarEettTdrRequestSchema = z.object({
  tipoProcesoSeleccion: z.string().max(200).default(""),
  tipoObjeto: z.string().max(80).default(""),
  tipo: z.enum(["eett", "tdr"]).default("tdr"),
  // Contenido actual del EETT/TDR (texto plano del editor).
  contenido: z.string().max(60000).default(""),
  // Documento a revisar: si viene, la revisión se PERSISTE en su metadata para
  // no volver a gastar tokens al reabrir el modal.
  docId: z.string().trim().optional(),
});
export type RevisarEettTdrRequest = z.infer<typeof revisarEettTdrRequestSchema>;
export type EettTdrHallazgo = {
  /** cumple: ya está bien · falta: no está y debe estar · corregir: está pero mal. */
  tipo: "cumple" | "falta" | "corregir";
  /** Página del EETT/TDR donde está el apartado (de los marcadores === PÁGINA N ===). */
  pagina: string;
  /** Numeral y rótulo EXACTOS del apartado en el EETT/TDR (o dónde debería ir). */
  ubicacion: string;
  /** Cómo está actualmente (o qué se observa). Para «falta»: que no está. */
  observacion: string;
  /** Qué debería decir / cómo corregirlo, en breve. Vacío cuando «cumple». */
  deberiaDecir: string;
  /**
   * PROPUESTA CORRECTA: la redacción completa y formal de ese apartado, lista
   * para pegar en el EETT/TDR, fundamentada en la Ley 32069 / Reglamento. Vacío
   * cuando «cumple».
   */
  propuesta: string;
  /** Por qué: apartado del modelo oficial o artículo de la Ley/Reglamento. */
  justificacion: string;
};
export type RevisarEettTdrResult = {
  resumen: string;
  hallazgos: EettTdrHallazgo[];
  usoModelo: boolean;
  /** Conteo de conformidad por tipo (para la cabecera de la revisión). */
  conteo: { cumple: number; falta: number; corregir: number };
  /** Veredicto: apto para pasar a la siguiente fase, o requiere subsanación. */
  veredicto: "apto" | "requiere_subsanacion";
};

const REVISAR_SISTEMA = [
  "Eres un ESPECIALISTA SÉNIOR en contrataciones del Estado del Perú (perfil OECE), con dominio",
  "experto de la Ley N.° 32069 (Ley General de Contrataciones Públicas) y su Reglamento",
  "(D.S. 009-2025-EF y su modificatoria D.S. 001-2026-EF). Revisas, con rigor técnico-legal, las",
  "ESPECIFICACIONES TÉCNICAS (bienes) o los TÉRMINOS DE REFERENCIA (servicios) que propone el ÁREA",
  "USUARIA, contrastándolos apartado por apartado con: (1) el MODELO DE REQUERIMIENTO oficial del",
  "OECE del procedimiento elegido, y (2) la Ley N.° 32069 y su Reglamento (FUENTES NORMATIVAS).",
  "Actúas como quien VISA el requerimiento antes de que llegue a la DEC: exhaustivo, concreto y",
  "fundamentado, sin condescendencia y sin inventar.",
  "",
  "OBJETIVO: que el EETT/TDR quede ACORDE AL ESQUEMA del MODELO OFICIAL del OECE (mismos apartados,",
  "orden y contenido mínimo) y a la Ley N.° 32069 y su Reglamento. Este requerimiento es de la fase",
  "de ACTUACIONES PREPARATORIAS y es la BASE de las fases siguientes (estrategia de contratación,",
  "expediente, bases): todo defecto que dejes pasar aquí se arrastra aguas abajo. Por eso la revisión",
  "debe dejar el requerimiento listo para avanzar.",
  "",
  "METODOLOGÍA (recórrela en orden y no te saltes apartados):",
  "1. Finalidad pública y necesidad (Art. 44.1): ¿está declarada y es coherente con el objeto?",
  "2. Objeto y descripción (Art. 44.10, 126.1): ¿el bien/servicio está descrito por DESEMPEÑO y",
  "   FUNCIONALIDAD, con características verificables, cantidades y unidades?",
  "3. Prohibición de direccionamiento (Art. 44.6): ¿hay marca, fabricante, patente, procedencia,",
  "   o requisitos desproporcionados/innecesarios que limiten la concurrencia? Señálalos.",
  "4. Condiciones de contratación (Art. 44.2): plazo y lugar de entrega/prestación, modalidad de",
  "   pago, sistema de entrega, garantías, adelantos, penalidades (Art. 161), reajustes — según",
  "   corresponda al objeto.",
  "5. Requisitos de calificación del postor (Art. 72.3): capacidad legal, experiencia del postor,",
  "   capacidad técnica/profesional (personal clave), de corresponder — ¿son razonables y proporcionales?",
  "6. Coherencia con el MODELO OFICIAL del proceso: apartados exigidos que falten o estén mal.",
  "7. CLÁUSULAS ESTÁNDAR del modelo: verifica que estén y bien: (a) en «Experiencia del postor», la",
  "   cláusula de MICRO Y PEQUEÑA EMPRESA (MYPE) — experiencia hasta el 25% de la cuantía; si falta,",
  "   márcalo; (b) en «Condiciones de contratación», los literales en orden correcto (…c. Recepción",
  "   y conformidad, d. Forma de pago, e. Adelanto directo, f. Lugar de entrega…) y bien numerados.",
  "",
  "El EETT/TDR viene con MARCADORES DE PÁGINA («=== PÁGINA N ===») y con NUMERACIÓN en formato",
  "cabecera (1., 2., 3.1, 3.2, A., B., literales…). Recorre el documento APARTADO POR APARTADO y,",
  "para CADA numeral del MODELO OFICIAL, comprueba si está presente, completo y correcto en el",
  "EETT/TDR. La revisión debe ser DETALLADA y PROFUNDA, no superficial.",
  "",
  "Devuelves EXCLUSIVAMENTE un objeto JSON, sin texto alrededor, con esta forma:",
  '{ "resumen": "…", "hallazgos": [ { "tipo": "cumple|falta|corregir", "pagina": "…", "ubicacion": "…",',
  '  "observacion": "…", "deberiaDecir": "…", "propuesta": "…", "justificacion": "…" } ] }',
  "",
  "«resumen»: dictamen profesional breve (2-4 frases): estado general del documento, riesgos",
  "principales y si es apto o requiere subsanación antes de remitir a la DEC.",
  "",
  "Cada hallazgo es PRECISO y se ancla al texto del área usuaria:",
  '- «tipo»: EXACTAMENTE uno de "cumple", "falta" o "corregir" (no uses sinónimos como "omisión").',
  "- «pagina»: el número de PÁGINA donde está el apartado, tomado del marcador «=== PÁGINA N ===»",
  "  más cercano (p. ej. «3»). Si el apartado FALTA, pon «—».",
  "- «ubicacion»: el NUMERAL y rótulo EXACTOS del EETT/TDR tal como están numerados en el documento",
  "  (p. ej. «Numeral 3.3 CONDICIONES DE CONTRATACIÓN, literal A. MODALIDAD DE PAGO», «Numeral 1.",
  "  FINALIDAD PÚBLICA», «Ítem 3.2»). Copia el número y el título como aparecen. Si el apartado NO",
  "  existe en el documento, indica el numeral donde DEBERÍA ir según el modelo oficial (p. ej.",
  "  «Debería estar en el numeral 3.5 REQUISITOS DE CALIFICACIÓN»).",
  "- «observacion»: cómo está AHORA, citando textualmente lo que dice cuando sea relevante. Para",
  "  «cumple» reconoce qué está bien; para «corregir» nombra el defecto; para «falta» indica la ausencia.",
  "- «deberiaDecir»: en BREVE, qué debe corregirse o incluirse (la indicación). Vacío solo si «cumple».",
  "- «propuesta»: la PROPUESTA CORRECTA — el TEXTO COMPLETO y bien redactado de ese apartado, con",
  "  nivel de documento oficial, LISTO PARA PEGAR en el EETT/TDR. Formúlalo tú conforme al MODELO",
  "  OFICIAL y a la Ley N.° 32069 / su Reglamento; describe por desempeño y funcionalidad (Art. 44.6);",
  "  usa [ENTRE CORCHETES] para datos propios de la entidad (montos, plazos, cantidades). Debe ser",
  "  redacción real usable, no una instrucción. Vacío solo si «cumple».",
  "- «justificacion»: el fundamento — ARTÍCULO exacto de la Ley N.° 32069 o su Reglamento y/o el",
  "  apartado del MODELO OFICIAL que lo exige. Obligatorio en TODOS los hallazgos; cita SOLO artículos",
  "  que aparezcan en las FUENTES NORMATIVAS o en el modelo (no inventes numeración).",
  "",
  "Reglas: sé exhaustivo (un hallazgo por cada apartado relevante, no resumas varios en uno);",
  "prioriza lo que impide o pone en riesgo la contratación; no inventes contenido ni artículos; si",
  "el texto es escaso o ilegible (escaneo sin OCR), decláralo en el resumen y revisa lo legible.",
  "ANTES de marcar «falta», BUSCA el dato en TODO el documento (todos los numerales y literales A, B,",
  "C, D, E, F…, incluso con otro rótulo): p. ej. el lugar de entrega suele ir en un literal de las",
  "condiciones. Si el apartado SÍ está pero mal formulado, incompleto o mal ubicado, márcalo",
  "«corregir» (no «falta») e indica en «observacion» cómo está y en qué numeral/literal aparece.",
  "Reserva «falta» solo para lo que realmente NO aparece en ninguna parte del documento.",
].join("\n");

/** Checklist normativo mínimo del EETT/TDR, diferenciado por objeto, como apoyo. */
function checklistEettTdr(tipo: "eett" | "tdr"): string {
  if (tipo === "eett") {
    return [
      "CHECKLIST EETT (bienes) — apartados que la norma/modelo esperan (verifica cada uno):",
      "- Finalidad pública (Art. 44.1).",
      "- Descripción y características técnicas del bien por desempeño/funcionalidad (Art. 126.1), sin marca (Art. 44.6).",
      "- Cantidad y unidad de medida.",
      "- Condiciones de contratación (Art. 44.2): plazo y lugar de entrega, modalidad/forma de pago, embalaje/rotulado,",
      "  garantía comercial, prestaciones accesorias (instalación, capacitación, mantenimiento) de corresponder.",
      "- Penalidad por mora y otras penalidades (Art. 161); reajuste, adelantos (de corresponder).",
      "- Requisitos de calificación del postor (Art. 72.3): capacidad legal, experiencia del postor.",
    ].join("\n");
  }
  return [
    "CHECKLIST TDR (servicios) — apartados que la norma/modelo esperan (verifica cada uno):",
    "- Finalidad pública y antecedentes (Art. 44.1).",
    "- Objetivos (general y específicos) y alcance/descripción del servicio (actividades y entregables) (Art. 126.1),",
    "  por desempeño/funcionalidad, sin direccionamiento (Art. 44.6).",
    "- Plazo de ejecución y lugar de prestación (Art. 44.2).",
    "- Modalidad/forma de pago, sistema de contratación, garantías, adelantos, reajuste (de corresponder).",
    "- Penalidad por mora y otras penalidades (Art. 161); confidencialidad y propiedad intelectual (de corresponder).",
    "- Requisitos de calificación (Art. 72.3): capacidad legal, experiencia del postor, personal clave y su experiencia.",
  ].join("\n");
}

/**
 * Compila el requerimiento GUARDADO en la ficha como texto tipo EETT/TDR. Es el
 * respaldo cuando el PDF subido es un ESCANEO sin texto legible (OCR falla): así
 * la revisión/generación tiene contenido real que analizar, en vez de vacío.
 */
export async function contenidoRequerimientoDesdeNecesidad(accessToken: string, id: string): Promise<string> {
  try {
    const rows = await supabaseUserRest<Array<Record<string, unknown>>>(
      accessToken,
      `necesidades?id=eq.${id}&limit=1&select=finalidad_publica,especialidad,subespecialidad,descripcion_catalogo,` +
        `descripcion_detallada,cantidad,unidad_medida,frecuencia,alcance,condiciones_ejecucion,plazo_ejecucion,` +
        `modalidad_pago,sistema_entrega,garantias,penalidad_mora,adelanto_directo,formula_reajuste,` +
        `recepcion_conformidad,subcontratacion,requisitos_calificacion,` +
        `departamento,provincia,distrito,lugar_entrega,meta_presupuestal,fuente_financiamiento,monto_estimado,` +
        `moneda,fecha_requerida`,
    );
    const n = rows[0];
    if (!n) return "";
    const linea = (label: string, v: unknown) => {
      const s = v == null ? "" : String(v).trim();
      return s ? `${label}: ${s}` : "";
    };
    return [
      linea("Finalidad pública", n.finalidad_publica),
      linea("Especialidad", n.especialidad),
      linea("Subespecialidad", n.subespecialidad),
      linea("Descripción de catálogo", n.descripcion_catalogo),
      linea("Descripción / características técnicas (TDR/EETT)", n.descripcion_detallada),
      linea("Cantidad", n.cantidad),
      linea("Unidad de medida", n.unidad_medida),
      linea("Frecuencia", n.frecuencia),
      linea("Alcance", n.alcance),
      linea("Condiciones de ejecución", n.condiciones_ejecucion),
      linea("Plazo de ejecución (días)", n.plazo_ejecucion),
      linea("Modalidad de pago", n.modalidad_pago),
      linea("Sistema de entrega", n.sistema_entrega),
      linea("Garantías", n.garantias),
      linea("Penalidad por mora", n.penalidad_mora),
      linea("Adelanto directo", n.adelanto_directo),
      linea("Fórmula de reajuste", n.formula_reajuste),
      linea("Recepción y conformidad", n.recepcion_conformidad),
      linea("Subcontratación", n.subcontratacion),
      linea("Requisitos de calificación", n.requisitos_calificacion),
      // Lugar de entrega / prestación (el «literal F» que faltaba en el respaldo).
      linea("Departamento", n.departamento),
      linea("Provincia", n.provincia),
      linea("Distrito", n.distrito),
      linea("Lugar de entrega / prestación", n.lugar_entrega),
      linea("Meta presupuestal", n.meta_presupuestal),
      linea("Fuente de financiamiento", n.fuente_financiamiento),
      linea("Monto estimado", n.monto_estimado),
      linea("Moneda", n.moneda),
      linea("Fecha requerida", n.fecha_requerida),
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

/** Monto estimado de la necesidad (cuantía) para cálculos que dependan de ella. */
export async function montoEstimadoNecesidad(accessToken: string, id: string): Promise<number | undefined> {
  try {
    const rows = await supabaseUserRest<Array<{ monto_estimado: unknown }>>(
      accessToken,
      `necesidades?id=eq.${id}&limit=1&select=monto_estimado`,
    );
    const v = Number(rows[0]?.monto_estimado);
    return Number.isFinite(v) && v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Bloque de contexto con la cuantía y el 25% (para la cláusula MYPE, etc.). */
function bloqueCuantia(monto?: number): string {
  if (!monto || monto <= 0) {
    return "CUANTÍA / MONTO ESTIMADO: no especificado. Donde un importe dependa de la cuantía (p. ej. experiencia MYPE = 25%), deja el marcador [25% DE LA CUANTÍA].";
  }
  const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    `CUANTÍA / MONTO ESTIMADO de la contratación: S/ ${fmt(monto)}. ` +
    `Para importes que dependan de la cuantía, usa este dato. En particular, la experiencia del ` +
    `postor MICRO Y PEQUEÑA EMPRESA (MYPE) es HASTA el 25% de la cuantía = S/ ${fmt(monto * 0.25)} ` +
    `(no la superes); la experiencia general del postor no supera 3× la cuantía = S/ ${fmt(monto * 3)}.`
  );
}

/**
 * Cláusulas estándar OBLIGATORIAS del formato OECE que la generación debe incluir
 * SÍ o SÍ (aunque el modelo/borrador no las traiga explícitas): el orden de
 * literales de condiciones, la FORMA DE PAGO completa, y la cláusula MYPE de
 * experiencia. Con [MARCADORES] para los datos propios de la entidad.
 */
function clausulasObligatorias(tipo: "eett" | "tdr", monto?: number): string {
  const objeto = tipo === "eett" ? "bienes" : "servicios";
  const fmt = (n: number) => n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const veinticinco = monto && monto > 0 ? `S/ ${fmt(monto * 0.25)}` : "[MONTO ≤ 25% DE LA CUANTÍA]";
  return [
    "CLÁUSULAS OBLIGATORIAS — inclúyelas SÍ o SÍ en su literal/apartado correspondiente, adaptando los",
    "[MARCADORES]; si el borrador ya las trae con detalle propio (nombres, almacén, responsables),",
    "CONSÉRVALO tal cual. NO las omitas ni resumas:",
    "",
    "· CONDICIONES DE CONTRATACIÓN — literales EN ESTE ORDEN: «a. Modalidad de pago», «b. Sistema de",
    "  entrega», «c. Recepción y conformidad», «d. FORMA DE PAGO», «e. Adelanto directo», «f. Lugar de",
    "  entrega» (renumera consecutivo; d. FORMA DE PAGO SIEMPRE va entre c. y e.).",
    "",
    "· d. FORMA DE PAGO (obligatoria):",
    "  «El pago se realiza de conformidad con el artículo 67 de la Ley N.° 32069. La Entidad contratante",
    "  paga las contraprestaciones pactadas dentro de los diez (10) días hábiles siguientes de otorgada la",
    "  conformidad por el área usuaria, y es prorrogable, previa justificación de la demora, por cinco (05)",
    "  días hábiles. En caso de consorcio, el pago se realiza, a quien corresponda, según lo indicado en el",
    "  contrato de consorcio. La Entidad realiza el pago en [ÚNICO PAGO / PAGOS PARCIALES]. Para el pago, la",
    "  Entidad debe contar con: documento de recepción y verificación del [almacén/área], documento de",
    "  conformidad suscrito por [responsable(s)], y el comprobante de pago.»",
    "",
    "· b. EXPERIENCIA DEL POSTOR — tras el requisito general, INCLUYE la cláusula MYPE:",
    `  «En el caso de postores que declaren en el Anexo N° 1 tener la condición de micro y pequeña empresa, se`,
    `  acredita una experiencia de ${veinticinco} [EXPRESAR EN NÚMEROS Y LETRAS], por la venta de ${objeto}`,
    `  iguales o similares al objeto de la convocatoria, durante los diez (10) años anteriores a la fecha de`,
    `  presentación de ofertas, que se computarán desde la conformidad o emisión del comprobante de pago,`,
    `  según corresponda. En el caso de consorcios, todos los integrantes deben contar con la condición de`,
    `  micro y pequeña empresa.» Y añade: «Se consideran ${objeto} similares: [CONSIGNAR].»`,
  ].join("\n");
}

/**
 * Trae el MODELO OFICIAL OECE COMPLETO (todos sus chunks en orden) del RAG, para
 * una comparación apartado-por-apartado profunda (mejor que un top-K semántico
 * parcial). Los PDF-modelo son pequeños (3–43 chunks); se capa por seguridad.
 */
async function modeloOeceCompleto(docId: string, maxChars = 16000): Promise<string> {
  try {
    const chunks = await supabaseRest<Array<{ chunk_index: number; content: string }>>(
      `document_chunks?document_id=eq.${docId}&select=chunk_index,content&order=chunk_index.asc`,
    );
    let out = "";
    for (const c of chunks) {
      if (out.length >= maxChars) break;
      out += `${c.content ?? ""}\n`;
    }
    return out.slice(0, maxChars).trim();
  } catch {
    return "";
  }
}

/**
 * Revisa el EETT/TDR contra el modelo OECE del proceso + norma. Ancla el modelo
 * por documentId (misma relación directa que el copiloto). Devuelve hallazgos
 * estructurados para el panel de revisión del modal.
 */
export async function revisarEettTdr(
  input: RevisarEettTdrRequest,
  options?: { entity?: string | null; montoEstimado?: number },
): Promise<RevisarEettTdrResult> {
  const objetoTxt = input.tipo === "eett" ? "especificaciones técnicas (bienes)" : "términos de referencia (servicios)";
  const query =
    `Ley 32069 y su Reglamento · ${objetoTxt} · requerimiento ${input.tipoObjeto} ${input.tipoProcesoSeleccion} · ` +
    "finalidad pública Art. 44, características por desempeño y funcionalidad Art. 126.1, prohibición de marca Art. 44.6, " +
    "condiciones de contratación Art. 44.2, requisitos de calificación Art. 72.3, penalidades Art. 161";

  const docId = await resolverModeloDocId(input.tipoProcesoSeleccion, options?.entity, input.tipoObjeto);
  const [modeloCompleto, normaRes] = await Promise.all([
    docId ? modeloOeceCompleto(docId) : Promise.resolve(""),
    searchLegalSources({ query, topK: 12 })
      .then((r) => r.sources.filter((s) => ["ley", "reglamento", "directiva"].includes(s.documentType)))
      .catch(() => [] as LegalSource[]),
  ]);

  // Modelo OFICIAL completo (todos sus apartados) para la comparación profunda.
  const modeloTxt = modeloCompleto;
  const normaTxt = normaRes
    .slice(0, 7)
    .map((s, i) => `[F${i + 1}] ${s.citation}${s.article ? ` (Art. ${s.article})` : ""}: ${s.excerpt.slice(0, 500)}`)
    .join("\n");

  const user = [
    `Procedimiento de selección: ${input.tipoProcesoSeleccion || "no especificado"}`,
    `Documento a revisar: ${input.tipo === "eett" ? "Especificaciones Técnicas (EETT)" : "Términos de Referencia (TDR)"}`,
    "",
    bloqueCuantia(options?.montoEstimado),
    "",
    checklistEettTdr(input.tipo),
    "",
    "GUÍA OFICIAL DEL TIPO (advertencias y notas del formato):",
    guiaTexto(input.tipoProcesoSeleccion),
    "",
    modeloTxt
      ? `MODELO DE REQUERIMIENTO OFICIAL (OECE) — formato a cumplir:\n${modeloTxt}`
      : "MODELO OFICIAL: no disponible; revisa contra la guía y la norma.",
    "",
    normaTxt
      ? `FUENTES NORMATIVAS (Ley N.° 32069 y su Reglamento — cita SOLO estos artículos):\n${normaTxt}`
      : "",
    "",
    "EETT/TDR PROPUESTO POR EL ÁREA USUARIA (a revisar apartado por apartado):",
    input.contenido.trim() ? input.contenido.trim().slice(0, 24000) : "(vacío)",
  ].join("\n");

  const client = getOpenAIClient();
  const resp = await client.responses.create({
    input: [
      { role: "system", content: REVISAR_SISTEMA },
      { role: "user", content: user },
    ],
    max_output_tokens: 8000,
    model: legalAnswerModel,
    temperature: 0.15,
  });

  const parsed = parseJsonObjeto(resp.output_text ?? "") as {
    resumen?: unknown;
    hallazgos?: unknown;
  };
  const resumen = typeof parsed.resumen === "string" ? parsed.resumen.trim() : "";
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const hallazgos: EettTdrHallazgo[] = Array.isArray(parsed.hallazgos)
    ? parsed.hallazgos
        .filter((h): h is Record<string, unknown> => Boolean(h) && typeof h === "object")
        .map((h): EettTdrHallazgo => {
          // Mapeo tolerante a sinónimos. "falta" SOLO cuando el apartado no está
          // en ninguna parte (falta/omisión/ausente/no incluye); lo demás
          // (observación, mejora, impreciso…) es "corregir" (está pero mal), no
          // "falta". Por defecto "corregir", nunca "falta", para no marcar como
          // ausente algo que sí está.
          const t = String(h.tipo ?? "").toLowerCase();
          const tipo: EettTdrHallazgo["tipo"] = t.includes("cumpl")
            ? "cumple"
            : /\bfalt|omisi|ausen|no (est|inclu|figura|consign)/.test(t)
              ? "falta"
              : "corregir";
          return {
            tipo,
            pagina: str(h.pagina, 20),
            ubicacion: str(h.ubicacion, 300),
            observacion: str(h.observacion, 1500),
            deberiaDecir: str(h.deberiaDecir, 1200),
            propuesta: str(h.propuesta, 3000),
            justificacion: str(h.justificacion, 1200),
          };
        })
        .filter((h) => h.observacion || h.deberiaDecir || h.propuesta || h.ubicacion)
        .slice(0, 40)
    : [];

  const conteo = {
    cumple: hallazgos.filter((h) => h.tipo === "cumple").length,
    falta: hallazgos.filter((h) => h.tipo === "falta").length,
    corregir: hallazgos.filter((h) => h.tipo === "corregir").length,
  };
  // Apto para pasar a las siguientes fases de actuaciones preparatorias solo si
  // no quedan apartados por incluir (falta) ni por corregir.
  const veredicto: RevisarEettTdrResult["veredicto"] =
    conteo.falta === 0 && conteo.corregir === 0 ? "apto" : "requiere_subsanacion";

  return { resumen, hallazgos, usoModelo: Boolean(modeloTxt), conteo, veredicto };
}

// ---------------------------------------------------------------------------
// Generación de una propuesta CORRECTA de EETT/TDR a partir del borrador subido.
// ---------------------------------------------------------------------------

export type GenerarEettTdrResult = { contenido: string; usoModelo: boolean };

const GENERAR_SISTEMA = [
  "Eres un ESPECIALISTA SÉNIOR en contrataciones del Estado del Perú (perfil OECE), experto en la",
  "Ley N.° 32069 y su Reglamento (D.S. 009-2025-EF, mod. D.S. 001-2026-EF).",
  "Generas una propuesta COMPLETA y CORRECTA de ESPECIFICACIONES TÉCNICAS (bienes) o TÉRMINOS DE",
  "REFERENCIA (servicios), tomando como BASE el borrador que subió el área usuaria y AJUSTÁNDOLO al",
  "MODELO DE REQUERIMIENTO oficial del OECE para el procedimiento elegido, y a la norma (Art. 126.1,",
  "Art. 44). Corriges lo incorrecto, completas lo que falta y respetas lo que ya está bien.",
  "",
  "Formato de salida (Markdown, sin explicaciones fuera del documento):",
  "- Usa «## » para los títulos de apartado (los del modelo oficial, con su numeral) y «### » para subapartados.",
  "- Usa «- » para VIÑETAS y «1. », «2. »… para listas NUMERADAS cuando corresponda.",
  "- Usa TABLAS Markdown para cuadros (ítems, cantidades, cronogramas, requisitos, personal clave):",
  "  fila de encabezado, LUEGO un separador CORTO exacto «|---|---|---|» (una sola raya de guiones por",
  "  columna, NUNCA una línea larga de guiones), y luego las filas de datos. Ej.:",
  "  | Ítem | Cantidad | Unidad | Descripción |",
  "  |---|---|---|---|",
  "  | 1 | [CANT] | UNIDAD | [DESCRIPCIÓN] |",
  "- Para una imagen/fotografía/plano/esquema que deba ir, inserta en su propia línea un placeholder",
  "  «[IMAGEN: breve descripción de lo que va]» (se convierte en un CUADRO para pegar la imagen real).",
  "  No generes la imagen; solo el cuadro.",
  "- Documento LISTO PARA IMPRIMIR: apartados bien separados, tablas y cuadros donde aporten claridad.",
  "- Devuelve SOLO el documento propuesto, listo para pegar. No añadas comentarios ni notas del asistente.",
  "",
  "Reglas de contenido:",
  "- DOCUMENTO COMPLETO: reproduce TODOS los apartados del MODELO OFICIAL, en su MISMO ORDEN y con su",
  "  numeración EXACTA (numerales 1., 2., 3.1, 3.2… y LITERALES a., b., c., d., e., f.… o A., B., C.…",
  "  tal como los usa el modelo). Respeta la secuencia de literales del modelo: p. ej. si el esquema",
  "  lleva «…c. RECEPCIÓN Y CONFORMIDAD, d. FORMA DE PAGO, e. ADELANTO DIRECTO…», incluye FORMA DE PAGO",
  "  como literal ANTES de ADELANTO DIRECTO y renumera los literales de forma consecutiva y correcta.",
  "  No omitas ningún apartado del esquema; si un apartado no aplica, inclúyelo con «No aplica» y por",
  "  qué. El resultado debe poder firmarse tal cual.",
  "- REDACCIÓN PROFESIONAL: terminología técnica propia del objeto y del tipo de contratación, tono",
  "  formal, redacción coherente, ortografía y gramática CORRECTAS. Cita los artículos de la Ley N.°",
  "  32069 y su Reglamento donde el modelo lo hace.",
  "- RÉGIMEN VIGENTE: la norma aplicable es la Ley N.° 32069 (Ley General de Contrataciones Públicas)",
  "  y su Reglamento (D.S. 009-2025-EF, mod. D.S. 001-2026-EF). NUNCA cites la Ley N.° 30225 ni el",
  "  D.S. 344-2018-EF (régimen DEROGADO): serían un error grave. Ante la duda, di «Ley N.° 32069».",
  "- REPRODUCE FIELMENTE las cláusulas estándar del MODELO OFICIAL, sin resumirlas ni omitirlas. En",
  "  particular:",
  "  · Condiciones de contratación con sus LITERALES en orden (…c. RECEPCIÓN Y CONFORMIDAD, d. FORMA",
  "    DE PAGO, e. ADELANTO DIRECTO, f. LUGAR DE ENTREGA…), renumerando consecutivo.",
  "  · «b. EXPERIENCIA DEL POSTOR EN LA ESPECIALIDAD»: tras el requisito general, INCLUYE SIEMPRE la",
  "    cláusula de MICRO Y PEQUEÑA EMPRESA (MYPE): «En el caso de postores que declaren en el Anexo",
  "    N° 1 tener la condición de micro y pequeña empresa, se acredita una experiencia de [MONTO EN",
  "    NÚMEROS Y LETRAS, que NO supera el 25% de la cuantía], por la venta de bienes iguales o",
  "    similares… durante los diez (10) años anteriores a la presentación de ofertas…; en consorcios,",
  "    todos los integrantes deben ser MYPE» y «Se consideran bienes similares: [CONSIGNAR]». Calcula",
  "    el 25% con la CUANTÍA dada arriba.",
  "- FORMATO: usa **negrita** para los rótulos de apartado y datos clave, *cursiva* para citas o notas,",
  "  y __subrayado__ donde convenga resaltar. No abuses del resaltado.",
  "- Cada apartado con su contenido redactado (no solo el título): finalidad, descripción y",
  "  características técnicas, condiciones de contratación (plazo, lugar, pago, entrega, garantías,",
  "  penalidades, adelantos, reajuste), entregables/actividades (TDR), y requisitos de calificación",
  "  (Art. 72.3), según corresponda al tipo y al objeto.",
  "- Describe por DESEMPEÑO y FUNCIONALIDAD; nunca por marca, fabricante ni procedencia (Art. 44.6).",
  "- NO inventes datos concretos (montos, plazos, cantidades, fechas, nombres): usa marcadores",
  "  [ENTRE CORCHETES] para que el área usuaria los complete.",
  "- CONSERVA TODAS las cláusulas válidas del BORRADOR del área usuaria con su detalle específico",
  "  (p. ej. FORMA DE PAGO con su plazo, único pago y la documentación exacta: recepción del almacén,",
  "  conformidad del Residente/Supervisor, comprobante). Reubícalas en el literal y orden correctos; SOLO",
  "  corrige lo que contradiga la norma o el modelo. NUNCA elimines una cláusula válida del borrador.",
  "- Incluye SIEMPRE las CLÁUSULAS OBLIGATORIAS que se te entregan (FORMA DE PAGO, cláusula MYPE de",
  "  experiencia, orden de literales), aunque el modelo o el borrador no las traigan explícitas.",
].join("\n");

/**
 * Genera texto largo tolerando el TOPE DE SALIDA del proveedor.
 *
 * Aunque se pida `max_output_tokens` alto, el proveedor (p. ej. glm-4.5-flash)
 * corta la respuesta a su propio límite: un requerimiento completo se cortaba a
 * media propuesta (p. ej. en «C.1 Experiencia del personal clave», sin llegar a
 * «D. Participación en consorcio»). Aquí, si la respuesta viene TRUNCADA
 * (finish_reason «length» o status «incomplete»), se pide continuar EXACTAMENTE
 * desde donde se quedó y se concatena, hasta que el modelo termina solo o se
 * alcanza el tope de rondas.
 */
async function generarConContinuacion(
  system: string,
  user: string,
  maxRondas = 5,
): Promise<string> {
  const client = getOpenAIClient();
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  let full = "";
  for (let ronda = 0; ronda < maxRondas; ronda += 1) {
    const resp = (await client.responses.create({
      input: messages,
      max_output_tokens: 16000,
      model: legalAnswerModel,
      temperature: 0.25,
    })) as {
      output_text?: string;
      status?: string;
      raw?: { choices?: Array<{ finish_reason?: string }> };
    };
    const trozo = resp.output_text ?? "";
    if (!trozo.trim()) break;
    full += trozo;

    const finish = resp.raw?.choices?.[0]?.finish_reason;
    const truncado = finish === "length" || resp.status === "incomplete";
    if (!truncado) break;

    // Se acumula lo emitido como turno del asistente para que la continuación
    // sepa qué ya escribió, y se pide seguir sin repetir ni cerrar.
    messages.push({ role: "assistant", content: trozo });
    messages.push({
      role: "user",
      content:
        "Continúa el documento EXACTAMENTE desde donde te quedaste (sin repetir nada de lo ya escrito, " +
        "sin preámbulo ni resumen), manteniendo el mismo formato Markdown, la numeración y los literales.",
    });
  }
  return full.trim();
}

/**
 * Genera una propuesta completa de EETT/TDR anclada al modelo OECE del proceso.
 * Toma el contenido del borrador (texto del PDF subido / editor) y lo reescribe
 * conforme al formato oficial. Devuelve Markdown simple.
 */
export async function generarEettTdr(
  input: RevisarEettTdrRequest,
  options?: { entity?: string | null; montoEstimado?: number },
): Promise<GenerarEettTdrResult> {
  const objetoTxt = input.tipo === "eett" ? "especificaciones técnicas (bienes)" : "términos de referencia (servicios)";
  const query =
    `Ley 32069 y su Reglamento · ${objetoTxt} · requerimiento ${input.tipoObjeto} ${input.tipoProcesoSeleccion} · ` +
    "estructura y apartados del formato oficial, finalidad Art. 44, características por desempeño Art. 126.1, " +
    "condiciones Art. 44.2, requisitos de calificación Art. 72.3, penalidades Art. 161";

  const docId = await resolverModeloDocId(input.tipoProcesoSeleccion, options?.entity, input.tipoObjeto);
  const [modeloCompleto, normaRes] = await Promise.all([
    // Para GENERAR se necesita el modelo de requerimiento ENTERO (no un recorte):
    // si el modelo se trunca, la IA no ve los apartados finales y la propuesta
    // sale incompleta. 120 000 cubre incluso el modelo de obras (~111k); estos
    // modelos tienen contexto de sobra (128k-1M tokens).
    docId ? modeloOeceCompleto(docId, 120000) : Promise.resolve(""),
    searchLegalSources({ query, topK: 6 })
      .then((r) => r.sources.filter((s) => ["ley", "reglamento", "directiva"].includes(s.documentType)))
      .catch(() => [] as LegalSource[]),
  ]);

  const modeloTxt = modeloCompleto;
  const normaTxt = normaRes
    .slice(0, 4)
    .map((s, i) => `[F${i + 1}] ${s.citation}${s.article ? ` (Art. ${s.article})` : ""}: ${s.excerpt.slice(0, 400)}`)
    .join("\n");

  const user = [
    `Procedimiento de selección: ${input.tipoProcesoSeleccion || "no especificado"}`,
    `Documento a generar: ${input.tipo === "eett" ? "Especificaciones Técnicas (EETT)" : "Términos de Referencia (TDR)"}`,
    "",
    bloqueCuantia(options?.montoEstimado),
    "",
    clausulasObligatorias(input.tipo, options?.montoEstimado),
    "",
    "GUÍA OFICIAL DEL TIPO (anclaje):",
    guiaTexto(input.tipoProcesoSeleccion),
    "",
    modeloTxt
      ? `MODELO DE REQUERIMIENTO OFICIAL (OECE) — estructura y contenido a seguir:\n${modeloTxt}`
      : "MODELO OFICIAL: no disponible; genera según la guía y la norma.",
    "",
    normaTxt ? `FUENTES NORMATIVAS:\n${normaTxt}` : "",
    "",
    "BORRADOR DEL ÁREA USUARIA (base a corregir/completar):",
    input.contenido.trim() ? input.contenido.trim().slice(0, 24000) : "(vacío: genera la estructura base a completar)",
  ].join("\n");

  const contenido = await generarConContinuacion(GENERAR_SISTEMA, user);
  return { contenido, usoModelo: Boolean(modeloTxt) };
}

// ---------------------------------------------------------------------------
// Traslado de la propuesta IA a la ficha de necesidad.
//
// La propuesta redacta apartado por apartado lo que la ficha guarda en columnas
// (finalidad, condiciones de contratación, requisitos del 72.3…). Hasta ahora
// solo viajaba el cuerpo del EETT/TDR a `descripcion_detallada` y el resto se
// quedaba como prosa dentro de ese campo, con lo que la ficha —y el expediente
// que se siembra desde ella— nacía a medias.
//
// Esta extracción NO escribe nada: devuelve la propuesta campo a campo para que
// el usuario le dé el visto bueno antes de trasladarla. Es deliberado: el
// traslado PISA lo que el área usuaria ya escribió, y eso no puede decidirlo un
// modelo.
// ---------------------------------------------------------------------------

export const trasladarFichaRequestSchema = z.object({
  tipo: z.enum(["eett", "tdr"]).default("tdr"),
  tipoObjeto: z.string().max(80).default(""),
  tipoProcesoSeleccion: z.string().max(200).default(""),
  /** Propuesta ya generada (Markdown) de la que se extraen los campos. */
  contenido: z.string().trim().min(40).max(120000),
  /** Campos de la ficha aplicables al proceso/objeto, con su sección. */
  camposObjetivo: z.array(completarCampoSchema).min(1).max(140),
});
export type TrasladarFichaRequest = z.infer<typeof trasladarFichaRequestSchema>;
export type TrasladarFichaResult = {
  /** api → valor extraído LITERALMENTE de la propuesta. Solo lo que aparece. */
  campos: Record<string, string>;
};

/** Un valor que es solo un marcador de relleno no es un dato: no se traslada. */
export function esMarcador(valor: string): boolean {
  const v = valor.trim();
  if (!v) return true;
  // "[CONSIGNAR EL PLAZO]", "[COMPLETAR]", "[…]" — con o sin texto alrededor.
  const sinMarcadores = v.replace(/\[[^\]]*\]/g, "").replace(/[\s.,;:—-]/g, "");
  return sinMarcadores.length === 0;
}

const TRASLADAR_SISTEMA = [
  "Eres un especialista en contrataciones del Estado peruano (Ley N.° 32069 y su Reglamento).",
  "Tu tarea es MAPEAR una propuesta de EETT/TDR ya redactada a los campos de la ficha de necesidad.",
  "",
  "REGLAS INNEGOCIABLES:",
  "- EXTRAE, NO REDACTES. Cada valor debe salir del texto de la propuesta, respetando su redacción.",
  "  Puedes recortar el fragmento que corresponde al campo y quitar el rótulo del apartado, nada más.",
  "- Si un campo NO está tratado en la propuesta, OMÍTELO. No inventes ni deduzcas.",
  "- Si lo único que hay es un marcador tipo [CONSIGNAR ...] o [COMPLETAR], OMITE el campo:",
  "  un marcador no es un dato y trasladarlo ensucia la ficha.",
  "- Usa SOLO las claves api de la lista de campos. No inventes claves.",
  "- Para campos numéricos (cantidad, plazo en días) devuelve SOLO el número, sin unidades.",
  "- No incluyas encabezados Markdown (##) ni viñetas del documento en el valor.",
  "",
  'Devuelve SOLO un objeto JSON: {"campos": {"<api>": "<valor>"}}',
].join("\n");

/**
 * Extrae de la propuesta generada los valores que corresponden a cada campo de
 * la ficha. Devuelve solo lo que la propuesta trata de verdad; el usuario
 * decide después qué se traslada.
 */
export async function extraerCamposDePropuesta(
  input: TrasladarFichaRequest,
): Promise<TrasladarFichaResult> {
  const camposLista = input.camposObjetivo
    .map((c) => `- api="${c.api}" · "${c.label}"${c.seccion ? ` [${c.seccion}]` : ""}`)
    .join("\n");

  // Los requisitos de calificación no son texto libre: el editor de la ficha los
  // reparte entre los CINCO tipos del Art. 72.3 (lista cerrada) reconociendo su
  // etiqueta exacta. Si la IA devuelve prosa, el editor la guarda como "otros" y
  // ningún tipo queda marcado: el campo se ve lleno pero sin registrar.
  const pideRequisitos = input.camposObjetivo.some((c) => c.api === "requisitosCalificacion");
  const formatoRequisitos = pideRequisitos
    ? [
        "",
        'FORMATO OBLIGATORIO de "requisitosCalificacion" (si lo extraes):',
        "",
        "  El campo NO es texto libre: alimenta un editor donde cada tipo del Art. 72.3 tiene un estado",
        "  (No aplica / Obligatorio / Facultativo) y dos casillas: «¿Qué se exige exactamente?» y",
        "  «¿Con qué se acredita?». El formato de abajo es lo que ese editor sabe leer.",
        "",
        "  Estructura, con las cabeceras EXACTAS y en este orden:",
        "    OBLIGATORIOS:",
        "    - <Etiqueta EXACTA del tipo>: <qué se exige> — Acredita: <con qué se acredita>",
        "    FACULTATIVOS:",
        "    - <Etiqueta EXACTA del tipo>: <qué se exige> — Acredita: <con qué se acredita> — Sustento: <por qué se exige>",
        "",
        "  Las ÚNICAS etiquetas admitidas son estas cinco (lista cerrada del Art. 72.3):",
        ...TIPOS_REQUISITO_ART72.map((t) => `    · ${t.label}`),
        "",
        "  Reglas:",
        "  - Cada tipo va en UNA sola línea, bajo la cabecera que le corresponda según la propuesta:",
        "    si la presenta como exigencia mínima → OBLIGATORIOS; si la presenta como adicional,",
        '    opcional o "de corresponder" → FACULTATIVOS.',
        '  - Si la propuesta dice que un tipo NO APLICA, o simplemente no lo trata, OMÍTELO por completo:',
        '    los tipos ausentes quedan en «No aplica», que es justo lo que se quiere decir.',
        "  - «— Acredita:» separa QUÉ se exige de CÓMO se prueba (guion largo —, no guion corto).",
        "    Si la propuesta no dice cómo se acredita, omite ese segmento; no te lo inventes.",
        "  - «— Sustento:» solo en los FACULTATIVOS, y solo si la propuesta explica por qué se exigen.",
        "  - Si no hay ningún requisito facultativo, no escribas la cabecera FACULTATIVOS.",
        "  - No inventes tipos ni cambies su redacción: cualquier otra etiqueta hace que el campo",
        "    no se registre y acabe en el cajón de «heredados».",
      ].join("\n")
    : "";

  const user = [
    `Documento: ${input.tipo === "eett" ? "Especificaciones Técnicas (EETT)" : "Términos de Referencia (TDR)"}`,
    `Objeto: ${input.tipoObjeto || "no especificado"} · Procedimiento: ${input.tipoProcesoSeleccion || "no especificado"}`,
    "",
    "CAMPOS DE LA FICHA (usa exactamente estas api):",
    camposLista,
    formatoRequisitos,
    "",
    "PROPUESTA DE LA QUE DEBES EXTRAER:",
    input.contenido.slice(0, 60000),
  ].join("\n");

  const client = getOpenAIClient();
  const resp = await client.responses.create({
    input: [
      { role: "system", content: TRASLADAR_SISTEMA },
      { role: "user", content: user },
    ],
    max_output_tokens: 8000,
    model: legalAnswerModel,
    // Extracción literal: la creatividad aquí solo puede inventar datos.
    temperature: 0,
  });

  const parsed = parseJsonObjeto(resp.output_text ?? "");
  const apiSet = new Set(input.camposObjetivo.map((c) => c.api));
  const campos: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.campos ?? {})) {
    if (!apiSet.has(k)) continue;
    const texto = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
    if (!texto || esMarcador(texto)) continue;
    // Capado al tope del schema: evita que el PATCH del traslado rebote con 400
    // por un texto más largo que su columna.
    const limite = LIMITES_TEXTO[k];
    campos[k] = limite && texto.length > limite ? texto.slice(0, limite) : texto;
  }
  return { campos };
}

// ---------------------------------------------------------------------------
// Campos que EXIGE el modelo de requerimiento del proceso elegido.
//
// La ficha tiene ~70 campos y ningún procedimiento los pide todos: una Subasta
// Inversa sobre ficha técnica no necesita lo mismo que una Licitación de obras.
// Mostrarlos todos obliga al área usuaria a decidir campo por campo si le toca,
// que es justo lo que el modelo oficial ya responde.
//
// La respuesta se CACHEA en la metadata del propio PDF-modelo, por objeto: es
// una propiedad del modelo, no de cada necesidad. Así se paga una vez por
// proceso y la reutilizan todas las necesidades de la entidad.
// ---------------------------------------------------------------------------

export const camposExigidosRequestSchema = z.object({
  tipoProcesoSeleccion: z.string().trim().min(1).max(200),
  tipoObjeto: z.string().trim().max(80).default(""),
  camposObjetivo: z.array(completarCampoSchema).min(1).max(140),
});
export type CamposExigidosRequest = z.infer<typeof camposExigidosRequestSchema>;
export type CamposExigidosResult = {
  /** api de los campos que este procedimiento exige según su modelo. */
  exigidos: string[];
  /** true si salió del modelo oficial; false si no hay modelo cargado. */
  usoModelo: boolean;
  /** true si se sirvió de la caché (no gastó tokens). */
  cacheado: boolean;
  /**
   * Tipos del Art. 72.3 que el modelo declara como apartado.
   *
   * NO se cachea con los campos: sale del mismo texto y sale gratis, mientras
   * que la caché de `exigidos` viene de antes de que esto existiera. Recalcularlo
   * evita tener que invalidar entradas ya guardadas.
   */
  requisitos: TipoRequisitoArt72[];
};

/**
 * Huella corta y estable del catálogo de campos que se le pasa al modelo.
 *
 * No pretende ser criptográfica: solo tiene que cambiar cuando cambia el
 * conjunto de `api`, para invalidar la caché. Se ordena antes para que el mismo
 * conjunto en otro orden dé la misma huella.
 */
export function huellaCatalogo(campos: Array<{ api: string }>): string {
  const texto = campos.map((c) => c.api).sort().join(",");
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) {
    h = (h * 31 + texto.charCodeAt(i)) | 0;
  }
  return `${campos.length}-${(h >>> 0).toString(36)}`;
}

export async function camposExigidosDelModelo(
  input: CamposExigidosRequest,
  options?: { entity?: string | null },
): Promise<CamposExigidosResult> {
  const docId = await resolverModeloDocId(input.tipoProcesoSeleccion, options?.entity, input.tipoObjeto);
  if (!docId) return { cacheado: false, exigidos: [], requisitos: [], usoModelo: false };

  // La clave incluye una HUELLA del catálogo de campos, no solo el objeto. La
  // lista la deriva la IA leyendo el modelo contra los campos que existían ese
  // día; al añadir, quitar o renombrar campos, la lista guardada deja de
  // corresponder y no había forma de saberlo: se devolvía igual. Con la huella,
  // un catálogo distinto es una clave distinta y se recalcula solo.
  const claveObjeto = `${input.tipoObjeto || "sin_objeto"}:${huellaCatalogo(input.camposObjetivo)}`;

  // 1. Caché en la metadata del modelo. Se paga una vez por proceso y objeto.
  try {
    const docs = await supabaseRest<Array<{ id: string; metadata: Record<string, unknown> | null }>>(
      `documents?id=eq.${docId}&select=id,metadata`,
    );
    const cache = (docs[0]?.metadata?.camposExigidos ?? {}) as Record<string, string[]>;
    const guardado = cache[claveObjeto];
    if (Array.isArray(guardado) && guardado.length > 0) {
      // Los requisitos se leen del texto aunque los campos vengan de la caché:
      // cuesta un recorrido de expresiones regulares y evita invalidar las
      // entradas guardadas antes de que este dato existiera.
      const texto = await modeloOeceCompleto(docId, Number.MAX_SAFE_INTEGER);
      return {
        cacheado: true,
        exigidos: guardado,
        requisitos: tiposDelModeloComoLista(texto),
        usoModelo: true,
      };
    }
  } catch {
    /* sin caché se recalcula */
  }

  // 2. Se leen los APARTADOS del modelo, de forma DETERMINISTA.
  //
  //    Esto lo derivaba una IA leyendo el documento entero. Dentro de una misma
  //    tanda respondia igual, pero entre tandas cambiaba mucho: para el mismo
  //    modelo y el mismo objeto se vieron listas de 12, 14 y 21 campos. Una ficha
  //    que enseña unos campos u otros segun el dia no es utilizable, y encima el
  //    resultado quedaba cacheado sin que nadie pudiera revisarlo.
  //
  //    Ahora se detectan los titulos de los apartados y se traducen a campos con
  //    una tabla legible y probada (lib/modelo-apartados.ts). Si falta un
  //    apartado se ve y se corrige; antes solo cambiaba el resultado.
  //    Se lee el modelo ENTERO. El tope de 16 000 caracteres existe porque el
  //    texto iba a la IA, que cobra por contexto; un escaneo con expresiones
  //    regulares no tiene ese coste. Con el tope puesto, el modelo de Licitación
  //    Pública de Obras —110 172 caracteres— se leía al 15 % y perdía ocho
  //    apartados que viven en la segunda mitad del documento.
  const modelo = await modeloOeceCompleto(docId, Number.MAX_SAFE_INTEGER);
  if (!modelo.trim()) return { cacheado: false, exigidos: [], requisitos: [], usoModelo: false };

  const disponibles = new Set(input.camposObjetivo.map((c) => c.api));
  const exigidos = camposExigidosDeterministas(modelo, disponibles);


  // 3. Persistir para las siguientes necesidades del mismo proceso.
  if (exigidos.length > 0) {
    try {
      const docs = await supabaseRest<Array<{ id: string; metadata: Record<string, unknown> | null }>>(
        `documents?id=eq.${docId}&select=id,metadata`,
      );
      const meta = docs[0]?.metadata ?? {};
      const cache = { ...((meta.camposExigidos ?? {}) as Record<string, string[]>), [claveObjeto]: exigidos };
      await supabaseRest(`documents?id=eq.${docId}`, {
        body: JSON.stringify({ metadata: { ...meta, camposExigidos: cache } }),
        method: "PATCH",
      });
    } catch {
      /* la lista ya se devuelve aunque no se cachee */
    }
  }

  return { cacheado: false, exigidos, requisitos: tiposDelModeloComoLista(modelo), usoModelo: true };
}
