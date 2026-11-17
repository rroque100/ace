// Glosario de siglas del curso: el examen las da por sabidas y el alumno que llega del régimen anterior confunde
// varias (OECE por OSCE, Pladicop por SEACE, TCP por Tribunal de Contrataciones del Estado).
//
// REGLA: la base es la lista del Art. 3.1 del Reglamento, copiada tal cual (texto al 09.01.2026). Las siglas que el
// curso usa y la norma no recoge en esa lista llevan el artículo donde la norma las define o, si ni siquiera eso,
// `fuente: null`: son abreviaturas del curso y la página lo dice. El test exige que toda sigla que aparezca en el
// contenido de las clases esté aquí, para que una clase nueva no meta una sigla sin explicar.
// Módulo puro: sin red ni base de datos.
import type { BaseLegal } from "./tipos";

export type Sigla = { sigla: string; significado: string; fuente: BaseLegal | null };

const reg = (articulo: string): BaseLegal => ({ norma: "Reglamento", articulo });
const ley = (articulo: string): BaseLegal => ({ norma: "Ley 32069", articulo });

// Reglamento, Art. 3.1. Se omiten «Entidades contratantes», «Ley» y «Reglamento»: son referencias, no siglas.
const ART_3_1: Array<[string, string]> = [
  ["API", "Asociación para la innovación"],
  ["ASISTE", "Servicio de Asistencia Técnica Especializada en Gestión de Proyectos"],
  ["CCLC", "Constancia de Capacidad Libre de Contratación"],
  ["CMN", "Cuadro Multianual de Necesidades"],
  ["CPI", "Compra Pública de Innovación"],
  ["CPP", "Compra Pública Precomercial"],
  ["DGA", "Dirección General de Abastecimiento del Ministerio de Economía y Finanzas"],
  ["DGPMI", "Dirección General de Programación Multianual de Inversiones"],
  ["DEC", "Dependencia encargada de las contrataciones"],
  ["FUP", "Ficha única de proveedor"],
  ["INEI", "Instituto Nacional de Estadística e Informática"],
  ["IOARR", "Inversiones de optimización, ampliación marginal, reposición y rehabilitación"],
  ["I+D", "Investigación y desarrollo"],
  ["I+D+i", "Investigación, desarrollo e innovación"],
  ["INDECOPI", "Instituto Nacional de Defensa de la Competencia y de la Protección de la Propiedad Intelectual"],
  ["JPRD", "Junta de Prevención y Resolución de Disputas"],
  ["LPAG", "Ley 27444, Ley del Procedimiento Administrativo General"],
  ["MEF", "Ministerio de Economía y Finanzas"],
  ["OECE", "Organismo Especializado para las Contrataciones Públicas Eficientes"],
  ["PAC del CMN", "Plan anual de contrataciones del Cuadro Multianual de Necesidades"],
  ["Pladicop", "Plataforma Digital para las Contrataciones Públicas"],
  ["Perú Compras", "Central de Compras Públicas"],
  ["PMBSO", "Programación Multianual de Bienes, Servicios y Obras"],
  ["REC", "Registro de entidades contratantes"],
  ["REGAJU", "Registro de Instituciones Arbitrales y Centros de Administración de Juntas de Prevención y Resolución de Disputas"],
  ["RNP", "Registro Nacional de Proveedores"],
  ["RENIEC", "Registro Nacional de Identificación y Estado Civil"],
  ["SEACE", "Sistema Electrónico de Contrataciones del Estado"],
  ["SBS", "Superintendencia de Banca, Seguros y Administradoras Privadas de Fondos de Pensiones"],
  ["SUNARP", "Superintendencia Nacional de los Registros Públicos"],
  ["SUNAT", "Superintendencia Nacional de Aduanas y de Administración Tributaria"],
  ["SNPMGI", "Sistema Nacional de Programación Multianual y Gestión de Inversiones"],
  ["ST PAS", "Secretarías Técnicas del procedimiento administrativo sancionador del Tribunal de Contrataciones Públicas"],
  ["TCP", "Tribunal de Contrataciones Públicas"],
  ["TUPA", "Texto Único de Procedimientos Administrativos"],
  ["UIT", "Unidad Impositiva Tributaria"],
];

// Siglas que el curso usa y no están en el Art. 3.1: con el artículo que las define, o null si son solo del curso.
const OTRAS: Sigla[] = [
  { sigla: "PAC", significado: "Plan anual de contrataciones; el Reglamento lo nombra «PAC del CMN»", fuente: reg("3") },
  { sigla: "MDA", significado: "Mecanismos diferenciados de adquisición", fuente: ley("44") },
  { sigla: "OCI", significado: "Órgano de Control Institucional", fuente: reg("77") },
  { sigla: "PNP", significado: "Policía Nacional del Perú", fuente: reg("100") },
  { sigla: "REMYPE", significado: "Registro de la Micro y Pequeña Empresa", fuente: reg("306") },
  { sigla: "AGA", significado: "Autoridad de la gestión administrativa de la entidad contratante", fuente: null },
  { sigla: "MYPE", significado: "Micro y pequeña empresa", fuente: null },
  { sigla: "ETO", significado: "Expediente técnico de obra", fuente: null },
  { sigla: "LPA", significado: "Licitación pública abreviada", fuente: null },
  { sigla: "INEN", significado: "Instituto Nacional de Enfermedades Neoplásicas", fuente: ley("44") },
];

export const GLOSARIO: readonly Sigla[] = [
  ...ART_3_1.map(([sigla, significado]) => ({ sigla, significado, fuente: reg("3") })),
  ...OTRAS,
].sort((a, b) => a.sigla.localeCompare(b.sigla, "es", { sensitivity: "base" }));

export const buscarSigla = (sigla: string): Sigla | null =>
  GLOSARIO.find((s) => s.sigla.toLowerCase() === sigla.toLowerCase()) ?? null;
