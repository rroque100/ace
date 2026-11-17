// Mapa compacto tema del examen → clase que lo enseña, para enlazar desde el simulador SIN importar el catálogo
// completo (el catálogo arrastra el texto de todas las clases al bundle del cliente; esto son unas decenas de filas).
// Generado una vez desde lib/cursos/certificacion-oece.ts y amarrado por tests/cursos-clases-tema.test.ts.
// Módulo puro: sin red ni base de datos.

export type ClaseDeTema = { tema: string; slug: string; titulo: string };

/** Filas (tema, clase) en orden del curso: la primera coincidencia es la clase que corresponde estudiar primero. */
export const CLASES_TEMA: readonly ClaseDeTema[] = [
  { tema: "1.7", slug: "actores-involucrados", titulo: "Actores involucrados" },
  { tema: "1.6", slug: "plan-anual-contrataciones", titulo: "Plan anual de contrataciones" },
  { tema: "1.5", slug: "plan-anual-contrataciones", titulo: "Plan anual de contrataciones" },
  { tema: "1.2", slug: "segmentacion-contrataciones", titulo: "Segmentación de contrataciones" },
  { tema: "1.2", slug: "actos-preparatorios", titulo: "Actos preparatorios" },
  { tema: "1.2", slug: "requerimiento-contenido", titulo: "El requerimiento: contenido, límites y no objeción" },
  { tema: "1.2", slug: "interaccion-mercado-cuantia", titulo: "Interacción con el mercado y cuantía de la contratación" },
  { tema: "1.2", slug: "estrategia-agrupamiento-fraccionamiento", titulo: "Estrategia de contratación, agrupamiento y fraccionamiento" },
  { tema: "1.1", slug: "expediente-contratacion", titulo: "Expediente de contratación" },
  { tema: "1.3", slug: "evaluadores", titulo: "Evaluadores" },
  { tema: "1.4", slug: "bases-anuncio-pladicop-preparatorias", titulo: "Bases estándar, anuncio y Pladicop en las actuaciones preparatorias" },
  { tema: "1.8", slug: "bases-anuncio-pladicop-preparatorias", titulo: "Bases estándar, anuncio y Pladicop en las actuaciones preparatorias" },
  { tema: "2.1", slug: "procedimientos-seleccion", titulo: "Procedimientos de selección" },
  { tema: "2.2", slug: "procedimientos-seleccion", titulo: "Procedimientos de selección" },
  { tema: "2.1", slug: "modalidades-contratacion-eficiente", titulo: "Modalidades de la contratación pública eficiente" },
  { tema: "2.6", slug: "pladicop-seleccion", titulo: "Pladicop en la selección: participantes, cronograma y acceso a la información" },
  { tema: "2.3", slug: "evaluacion-ofertas-desempate", titulo: "Evaluación de ofertas y desempate" },
  { tema: "2.2", slug: "plazos-buena-pro-seleccion", titulo: "Plazos, consentimiento y pérdida de la buena pro" },
  { tema: "2.4", slug: "plazos-buena-pro-seleccion", titulo: "Plazos, consentimiento y pérdida de la buena pro" },
  { tema: "2.5", slug: "plazos-buena-pro-seleccion", titulo: "Plazos, consentimiento y pérdida de la buena pro" },
  { tema: "2.7", slug: "recurso-apelacion", titulo: "Recurso de apelación" },
  { tema: "2.8", slug: "recurso-apelacion", titulo: "Recurso de apelación" },
  { tema: "2.8", slug: "apelacion-tramite-resolucion", titulo: "Trámite y resolución de la apelación" },
  { tema: "2.9", slug: "perfeccionamiento-contrato", titulo: "Perfeccionamiento del contrato" },
  { tema: "2.10", slug: "perfeccionamiento-contrato", titulo: "Perfeccionamiento del contrato" },
  { tema: "3.1", slug: "inicio-plazo-vigencia-contrato", titulo: "Inicio del plazo de ejecución y vigencia del contrato" },
  { tema: "3.6", slug: "inicio-plazo-vigencia-contrato", titulo: "Inicio del plazo de ejecución y vigencia del contrato" },
  { tema: "3.2", slug: "modificaciones-contrato", titulo: "Modificaciones al contrato" },
  { tema: "3.2", slug: "modificaciones-procedimiento", titulo: "Modificaciones en bienes y servicios: trámite" },
  { tema: "3.3", slug: "garantias", titulo: "Garantías" },
  { tema: "3.9", slug: "adelantos-penalidades-subcontratacion", titulo: "Adelantos, penalidades y subcontratación" },
  { tema: "3.3", slug: "adelantos-penalidades-subcontratacion", titulo: "Adelantos, penalidades y subcontratación" },
  { tema: "3.4", slug: "recepcion-conformidad-bienes-servicios", titulo: "Recepción y conformidad de bienes y servicios" },
  { tema: "3.3", slug: "resolucion-nulidad-contrato", titulo: "Resolución y nulidad de contrato" },
  { tema: "3.5", slug: "resolucion-controversias", titulo: "Mecanismos de resolución de controversias" },
  { tema: "3.7", slug: "obra-expediente-residente-supervision", titulo: "Obra I: expediente técnico, residente, supervisión y gerente de proyecto" },
  { tema: "3.8", slug: "obra-expediente-residente-supervision", titulo: "Obra I: expediente técnico, residente, supervisión y gerente de proyecto" },
  { tema: "3.10", slug: "suspension-reprogramacion-obra", titulo: "Suspensión, reprogramación y control de la obra" },
  { tema: "3.10", slug: "intervencion-economica", titulo: "Intervención económica" },
  { tema: "3.11", slug: "obra-valorizacion-recepcion-liquidacion", titulo: "Obra II: valorización, recepción y liquidación" },
  { tema: "3.12", slug: "contratos-estandarizados-internacionales", titulo: "Contratos estandarizados de uso internacional" },
];

/** La clase sugerida para un tema del temario (p. ej. «2.8»), o null si ninguna lo enseña. */
export function claseParaTema(tema: string): ClaseDeTema | null {
  return CLASES_TEMA.find((f) => f.tema === tema) ?? null;
}
