// Arquitectura funcional de la plataforma de contrataciones (Ley 32069 /
// D.S. 009-2025-EF): los 10 modulos y el ciclo de vida unico del expediente
// electronico (Necesidad -> ... -> Archivo).
//
// Es el "backbone" BPMN del producto: cada modulo y cada etapa declara su
// responsable (actor de dominio), sus insumos de entrada y los artefactos que
// genera (Word/Excel/PDF). El resto de la app (UI del expediente, generadores
// de plantillas, formularios dinamicos) se cuelga de este modelo.

import type { ActorId, MacroFase } from "./actores-contratacion";

export type FormatoArtefacto = "pdf" | "word" | "excel";

export type ArtefactoModulo = { nombre: string; formato: FormatoArtefacto[] };

// Documento requerido por una etapa del ciclo. Es la fuente unica que consume el
// motor de instruccion (lib/expediente-instruccion.ts) para evaluar completitud.
export type DocumentoRequerido = {
  // value de PROCESS_DOC_KINDS (lib/legal-taxonomy.ts)
  kind: string;
  label: string;
  obligatorio: boolean;
  // Palabras clave para distinguir actas/informes que comparten `kind`
  // (p. ej. "acta de admisión" vs "acta de buena pro"). Se buscan en el titulo.
  tituloIncluye?: string[];
  // Si es true, el requisito tambien se da por cumplido cuando existe al menos
  // una evaluacion de oferta registrada (matriz de evaluacion).
  satisfechoPorEvaluacion?: boolean;
};

// ===== Catalogo de los 10 modulos =====

// El modulo 2 (Configuracion) lo opera el administrador del sistema, que es un
// rol de login, no un actor de dominio; por eso se admite "admin" ademas de los
// actores de la Ley.
export type UsuarioModulo = ActorId | "admin";

export type ModuloDefinicion = {
  numero: number;
  label: string;
  descripcion: string;
  usuarios: UsuarioModulo[];
  // Modulos 9 y 10 son transversales (aplican a todas las fases).
  transversal: boolean;
};

export const MODULOS: ModuloDefinicion[] = [
  {
    numero: 1,
    label: "Gestión de Necesidades",
    descripcion: "Registro de la necesidad pública: ficha, código único, requerimiento y TDR/ET.",
    usuarios: ["area_usuaria", "ate"],
    transversal: false,
  },
  {
    numero: 2,
    label: "Configuración del Tipo de Contratación",
    descripcion: "Catálogo Ley 32069: bienes, servicios, obras y consultoría de obra.",
    usuarios: ["admin"],
    transversal: false,
  },
  {
    numero: 3,
    label: "Actuaciones Preparatorias",
    descripcion: "Recepción y validación del requerimiento, interacción con el mercado, cuantía de la contratación y estrategia.",
    usuarios: ["dec"],
    transversal: false,
  },
  {
    numero: 4,
    label: "Expediente de Contratación",
    descripcion: "Consolidación del expediente y generación de la plantilla para aprobación.",
    usuarios: ["dec"],
    transversal: false,
  },
  {
    numero: 5,
    label: "Aprobación AGA",
    descripcion: "Revisión, aprobación con firma digital, observación o rechazo del expediente.",
    usuarios: ["aga"],
    transversal: false,
  },
  {
    numero: 6,
    label: "Procedimiento de Selección",
    descripcion: "Convocatoria, consultas, integración, ofertas, evaluación y buena pro.",
    usuarios: ["oficial_compra", "comite", "jurado"],
    transversal: false,
  },
  {
    numero: 7,
    label: "Contrato",
    descripcion: "Generación del contrato con variables (proveedor, monto, plazo, garantías).",
    usuarios: ["dec"],
    transversal: false,
  },
  {
    numero: 8,
    label: "Ejecución Contractual",
    descripcion: "Orden de inicio, conformidades, penalidades, adicionales, ampliaciones y liquidación.",
    usuarios: ["area_usuaria", "dec"],
    transversal: false,
  },
  {
    numero: 9,
    label: "Gestión Documental Electrónica",
    descripcion: "Carga y OCR de documentos (PDF/Excel/Word/imágenes) en cada fase, con lectura de número, fecha y firmantes.",
    usuarios: ["dec", "area_usuaria"],
    transversal: true,
  },
  {
    numero: 10,
    label: "Formularios Dinámicos",
    descripcion: "Exportación de cada etapa a Excel, Word y PDF listos para firmar, imprimir y archivar.",
    usuarios: ["dec"],
    transversal: true,
  },
];

const MODULO_MAP = new Map(MODULOS.map((modulo) => [modulo.numero, modulo]));

export function modulo(numero: number): ModuloDefinicion | undefined {
  return MODULO_MAP.get(numero);
}

// ===== Ciclo de vida unico del expediente (Flujo General de Estados) =====

export type EtapaCiclo = {
  id: string;
  orden: number;
  label: string;
  // Modulo principal que opera esta etapa.
  modulo: number;
  // Macro-fase del procedimiento (Ley 32069) a la que pertenece la etapa.
  macroFase: MacroFase;
  responsables: ActorId[];
  // Actores que apoyan la etapa ademas de los responsables (no se repiten).
  participantes: ActorId[];
  descripcion: string;
  // Insumos esperados para la etapa.
  entradas: string[];
  // Artefactos que la etapa genera (modulos 7 y 10).
  salidas: ArtefactoModulo[];
  // Documentos requeridos para instruir/foliar la etapa (motor de instruccion).
  documentos: DocumentoRequerido[];
  // Estado(s) de procurement_processes.status que corresponden a esta etapa.
  estados: string[];
};

export const CICLO_CONTRATACION: EtapaCiclo[] = [
  {
    id: "necesidad",
    orden: 1,
    label: "Necesidad",
    modulo: 1,
    macroFase: "planificacion",
    responsables: ["area_usuaria", "ate"],
    participantes: ["dec"],
    descripcion: "El área usuaria (o ATE) registra la necesidad y formula el requerimiento.",
    entradas: ["Requerimiento firmado (PDF)", "TDR / ET / Expediente técnico", "Memoria descriptiva", "Informe de necesidad"],
    // El entregable de esta etapa es el REQUERIMIENTO del Art. 44, con la
    // estructura del Capítulo III de las bases estándar (EETT para bienes, TDR
    // para servicios) — es lo que integra el expediente por el Art. 54.2.a.
    //
    // Antes figuraba aquí una "Ficha de Necesidad" en PDF. Se retiró junto con
    // su exportador: era una consolidación interna de la herramienta, no un
    // formato exigido por la Ley 32069 ni por su Reglamento, y anunciarla como
    // salida del ciclo daba a entender que había que emitirla.
    salidas: [{ nombre: "Requerimiento (EETT / TDR)", formato: ["word", "pdf"] }],
    documentos: [
      { kind: "requerimiento", label: "Requerimiento del área usuaria", obligatorio: true },
      { kind: "tdr", label: "Términos de referencia (servicios/consultoría)", obligatorio: false },
      { kind: "ee_tt", label: "Especificaciones técnicas (bienes/obras)", obligatorio: false },
    ],
    estados: ["en_preparacion"],
  },
  {
    id: "actuaciones_preparatorias",
    orden: 2,
    label: "Actuaciones preparatorias",
    modulo: 3,
    macroFase: "actuaciones_preparatorias",
    responsables: ["dec"],
    participantes: ["aga", "area_usuaria", "ate"],
    descripcion: "La DEC recepciona y valida el requerimiento, interactúa con el mercado y determina la cuantía de la contratación y la estrategia.",
    entradas: ["Requerimiento recepcionado", "Certificación presupuestal", "Cuadro de necesidades"],
    salidas: [
      { nombre: "Estudio de Mercado", formato: ["excel"] },
      { nombre: "Informe de cuantía de la contratación", formato: ["pdf"] },
      { nombre: "Informe técnico de estrategia", formato: ["word", "pdf"] },
    ],
    documentos: [
      {
        kind: "informe",
        label: "Informe de cuantía de la contratación / indagación de mercado",
        obligatorio: false,
        tituloIncluye: ["valor", "mercado", "indagacion", "estimado", "referencial"],
      },
    ],
    estados: ["en_preparacion"],
  },
  {
    id: "expediente",
    orden: 3,
    label: "Expediente de contratación",
    modulo: 4,
    macroFase: "actuaciones_preparatorias",
    responsables: ["dec"],
    participantes: ["aga"],
    descripcion: "La DEC consolida el expediente y genera la plantilla para la aprobación.",
    entradas: ["Informe de mercado", "Certificación presupuestal", "TDR / ET", "Persistencia de necesidad"],
    salidas: [{ nombre: "Expediente de Contratación", formato: ["word", "pdf"] }],
    documentos: [
      {
        kind: "informe",
        label: "Expediente de contratación consolidado",
        obligatorio: false,
        tituloIncluye: ["expediente", "consolidad"],
      },
    ],
    estados: ["en_preparacion"],
  },
  {
    id: "aprobacion_aga",
    orden: 4,
    label: "Aprobación AGA",
    modulo: 5,
    macroFase: "actuaciones_preparatorias",
    responsables: ["aga"],
    participantes: ["dec", "titular"],
    descripcion: "La AGA revisa y aprueba (con firma digital), observa o rechaza el expediente.",
    entradas: ["Expediente de contratación"],
    salidas: [{ nombre: "Resolución de aprobación (firma digital)", formato: ["pdf"] }],
    documentos: [
      {
        kind: "acta",
        label: "Resolución / acta de aprobación del expediente",
        obligatorio: false,
        tituloIncluye: ["aprobacion", "aprobado", "resolucion"],
      },
    ],
    estados: ["en_preparacion"],
  },
  {
    id: "seleccion",
    orden: 5,
    label: "Selección",
    modulo: 6,
    macroFase: "seleccion",
    responsables: ["oficial_compra", "comite", "jurado"],
    participantes: ["area_usuaria"],
    descripcion: "Convocatoria, consultas y observaciones, integración de bases y presentación de ofertas.",
    entradas: ["Expediente aprobado"],
    salidas: [
      { nombre: "Bases", formato: ["pdf", "word"] },
      { nombre: "Cronograma", formato: ["excel", "pdf"] },
      { nombre: "Pliego de Absoluciones", formato: ["pdf"] },
      { nombre: "Bases Integradas", formato: ["pdf", "word"] },
    ],
    documentos: [
      { kind: "bases", label: "Bases del procedimiento", obligatorio: true },
      {
        kind: "acta",
        label: "Pliego/acta de absolución de consultas y observaciones",
        obligatorio: false,
        tituloIncluye: ["consulta", "observacion", "absolucion", "pliego"],
      },
      { kind: "bases_integradas", label: "Bases integradas", obligatorio: true },
      { kind: "oferta", label: "Oferta(s) de postor", obligatorio: true },
    ],
    estados: ["en_evaluacion"],
  },
  {
    id: "buena_pro",
    orden: 6,
    label: "Buena pro",
    modulo: 6,
    macroFase: "seleccion",
    responsables: ["comite", "jurado"],
    participantes: ["oficial_compra"],
    descripcion: "El comité evalúa y califica las ofertas y otorga la buena pro (o declara desierto).",
    entradas: ["Oferta técnica", "Oferta económica"],
    salidas: [
      { nombre: "Acta de Evaluación", formato: ["pdf"] },
      { nombre: "Cuadro Comparativo", formato: ["excel"] },
      { nombre: "Acta de Otorgamiento de Buena Pro", formato: ["pdf"] },
    ],
    documentos: [
      {
        kind: "acta",
        label: "Acta de admisión / evaluación / calificación",
        obligatorio: true,
        tituloIncluye: ["admision", "evaluacion", "calificacion"],
        satisfechoPorEvaluacion: true,
      },
      {
        kind: "acta",
        label: "Acta de otorgamiento de la buena pro (o de desierto)",
        obligatorio: true,
        tituloIncluye: ["buena pro", "buenapro", "desierto", "otorgamiento", "adjudicacion"],
      },
    ],
    estados: ["otorgado", "desierto"],
  },
  {
    id: "contrato",
    orden: 7,
    label: "Contrato",
    modulo: 7,
    macroFase: "ejecucion_contractual",
    responsables: ["dec"],
    participantes: ["area_usuaria", "aga"],
    descripcion: "La DEC genera y suscribe el contrato con el proveedor (variables: monto, plazo, garantías).",
    entradas: ["Buena pro consentida", "Garantías del postor adjudicado"],
    salidas: [{ nombre: "Contrato", formato: ["word", "pdf"] }],
    documentos: [
      { kind: "contrato", label: "Contrato suscrito", obligatorio: true },
      {
        kind: "carta",
        label: "Garantía de fiel cumplimiento (carta fianza)",
        obligatorio: false,
        tituloIncluye: ["garantia", "fianza", "fiel cumplimiento"],
      },
    ],
    estados: ["otorgado"],
  },
  {
    id: "ejecucion",
    orden: 8,
    label: "Ejecución",
    modulo: 8,
    macroFase: "ejecucion_contractual",
    responsables: ["area_usuaria", "dec"],
    participantes: [],
    descripcion: "Orden de inicio y ejecución de la prestación contratada.",
    entradas: ["Contrato suscrito"],
    salidas: [{ nombre: "Orden de Inicio", formato: ["pdf"] }],
    documentos: [
      {
        kind: "acta",
        label: "Orden de inicio de la prestación",
        obligatorio: false,
        tituloIncluye: ["orden", "inicio"],
      },
    ],
    estados: ["en_ejecucion"],
  },
  {
    id: "conformidad",
    orden: 9,
    label: "Conformidad",
    modulo: 8,
    macroFase: "ejecucion_contractual",
    responsables: ["area_usuaria"],
    participantes: ["dec", "ate"],
    descripcion: "El área usuaria verifica el cumplimiento y emite conformidad; registra penalidades, adicionales o ampliaciones.",
    entradas: ["Prestación ejecutada"],
    salidas: [
      { nombre: "Conformidad", formato: ["pdf"] },
      { nombre: "Informe de Penalidad", formato: ["pdf"] },
      { nombre: "Informe de Adicionales / Ampliaciones", formato: ["pdf"] },
    ],
    documentos: [
      {
        kind: "acta",
        label: "Conformidad de la prestación",
        obligatorio: false,
        tituloIncluye: ["conformidad"],
      },
    ],
    estados: ["en_ejecucion"],
  },
  {
    id: "liquidacion",
    orden: 10,
    label: "Liquidación",
    modulo: 8,
    macroFase: "ejecucion_contractual",
    responsables: ["dec"],
    participantes: ["area_usuaria"],
    descripcion: "La DEC liquida el contrato y deja constancia en acta/informe.",
    entradas: ["Conformidad"],
    salidas: [{ nombre: "Acta / Informe de Liquidación", formato: ["pdf", "word"] }],
    documentos: [
      {
        kind: "acta",
        label: "Acta / informe de liquidación del contrato",
        obligatorio: false,
        tituloIncluye: ["liquidacion"],
      },
    ],
    estados: ["cerrado"],
  },
  {
    id: "archivo",
    orden: 11,
    label: "Archivo digital",
    modulo: 9,
    macroFase: "ejecucion_contractual",
    responsables: ["dec"],
    participantes: [],
    descripcion: "Cierre y archivo del expediente electrónico único de la contratación.",
    entradas: ["Expediente completo"],
    salidas: [{ nombre: "Expediente electrónico único", formato: ["pdf"] }],
    documentos: [],
    estados: ["cerrado"],
  },
];

const PRIMERA_ETAPA = CICLO_CONTRATACION[0];

// Tras la migracion de estados, procurement_processes.status YA coincide con el
// id de la etapa del ciclo. Se conserva el mapeo de los estados historicos
// (en_preparacion/...) y de "desierto" para compatibilidad.
const ESTADO_A_ETAPA: Record<string, string> = {
  desierto: "buena_pro",
  en_preparacion: "actuaciones_preparatorias",
  en_evaluacion: "seleccion",
  otorgado: "buena_pro",
  en_ejecucion: "ejecucion",
  cerrado: "archivo",
};

export function etapaActualDelProceso(status?: string | null): EtapaCiclo {
  if (!status) {
    return PRIMERA_ETAPA;
  }
  const direct = CICLO_CONTRATACION.find((etapa) => etapa.id === status);
  if (direct) {
    return direct;
  }
  const mapped = ESTADO_A_ETAPA[status];
  return CICLO_CONTRATACION.find((etapa) => etapa.id === mapped) ?? PRIMERA_ETAPA;
}

export function etapaPorId(id: string): EtapaCiclo | undefined {
  return CICLO_CONTRATACION.find((etapa) => etapa.id === id);
}
