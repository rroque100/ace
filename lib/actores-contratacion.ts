// Actores internos de la entidad contratante segun la Ley N.° 32069 (Ley
// General de Contrataciones Publicas) y su Reglamento (D.S. N.° 009-2025-EF).
//
// Este catalogo es el modelo de DOMINIO (quien hace que en cada fase). No es lo
// mismo que el rol de login/permisos del sistema (lib/auth.ts): un usuario con
// cuenta puede representar a uno de estos actores. Aqui solo describimos la
// estructura funcional de responsabilidades para guiar la instruccion del
// expediente fase por fase.

export type ActorId =
  | "titular"
  | "aga"
  | "area_usuaria"
  | "ate"
  | "dec"
  | "oficial_compra"
  | "comite"
  | "jurado";

export type MacroFase =
  | "planificacion"
  | "actuaciones_preparatorias"
  | "seleccion"
  | "ejecucion_contractual";

export const MACRO_FASES: Array<{ id: MacroFase; label: string }> = [
  { id: "planificacion", label: "Planificación" },
  { id: "actuaciones_preparatorias", label: "Actuaciones preparatorias" },
  { id: "seleccion", label: "Selección" },
  { id: "ejecucion_contractual", label: "Ejecución contractual" },
];

const MACRO_FASE_LABELS = new Map(MACRO_FASES.map((item) => [item.id, item.label]));

export function macroFaseLabel(id: MacroFase): string {
  return MACRO_FASE_LABELS.get(id) ?? id;
}

export type ActorDefinicion = {
  id: ActorId;
  label: string;
  sigla: string;
  descripcion: string;
  // Resumen de la participacion del actor en cada macro-fase. `null` = no
  // interviene en esa macro-fase.
  participacion: Record<MacroFase, string | null>;
};

export const ACTORES: ActorDefinicion[] = [
  {
    id: "titular",
    label: "Titular de la Entidad",
    sigla: "Titular",
    descripcion:
      "Máxima autoridad institucional. Dirige y supervisa el sistema de contrataciones; aprueba actuaciones no delegables y puede delegar facultades.",
    participacion: {
      planificacion: "Supervisa",
      actuaciones_preparatorias: "Aprueba (no delegable)",
      seleccion: "Supervisa la legalidad",
      ejecucion_contractual: "Resuelve su competencia",
    },
  },
  {
    id: "aga",
    label: "Autoridad de Gestión Administrativa",
    sigla: "AGA",
    descripcion:
      "Figura creada por la Ley 32069. Dirige operativamente la gestión de contrataciones de la entidad.",
    participacion: {
      planificacion: "Dirige la programación",
      actuaciones_preparatorias: "Aprueba el expediente",
      seleccion: "Designa comités y supervisa",
      ejecucion_contractual: "Supervisa la gestión",
    },
  },
  {
    id: "area_usuaria",
    label: "Área Usuaria",
    sigla: "Área usuaria",
    descripcion:
      "Conoce la necesidad pública. Formula el requerimiento (ET/TDR/expediente técnico), define condiciones y emite la conformidad.",
    participacion: {
      planificacion: "Define la necesidad",
      actuaciones_preparatorias: "Formula ET / TDR",
      seleccion: "Soporte técnico",
      ejecucion_contractual: "Emite conformidad",
    },
  },
  {
    id: "ate",
    label: "Área Técnica Estratégica",
    sigla: "ATE",
    descripcion:
      "Innovación de la Ley 32069. Actúa como área usuaria especializada cuando la contratación exige conocimientos técnicos complejos (equipamiento biomédico, sistemas, obras especializadas).",
    participacion: {
      planificacion: "Especializa el requerimiento",
      actuaciones_preparatorias: "Especializa ET / TDR",
      seleccion: "Soporte técnico",
      ejecucion_contractual: "Supervisa técnicamente",
    },
  },
  {
    id: "dec",
    label: "Dependencia Encargada de las Contrataciones",
    sigla: "DEC",
    descripcion:
      "Órgano especializado (antes OEC). Organiza, conduce y administra los procedimientos: interacción con el mercado, cuantía de la contratación, bases, expediente de contratación y administración del contrato.",
    participacion: {
      planificacion: "Programa las contrataciones",
      actuaciones_preparatorias: "Conduce y gestiona el expediente",
      seleccion: "Administra y da soporte",
      ejecucion_contractual: "Administra el contrato",
    },
  },
  {
    id: "oficial_compra",
    label: "Oficial de Compra",
    sigla: "Oficial de Compra",
    descripcion:
      "Figura nueva de la Ley 32069. Funcionario de la DEC responsable de la fase de selección; sus funciones se limitan a dicha fase.",
    participacion: {
      planificacion: null,
      actuaciones_preparatorias: null,
      seleccion: "Conduce la selección",
      ejecucion_contractual: null,
    },
  },
  {
    id: "comite",
    label: "Comité de selección",
    sigla: "Comité",
    descripcion:
      "Órgano colegiado (por lo general tres integrantes; al menos uno de la DEC y otro con experiencia técnica). Absuelve consultas, integra bases, evalúa, califica y otorga la buena pro.",
    participacion: {
      planificacion: null,
      actuaciones_preparatorias: "Puede apoyar",
      seleccion: "Evalúa y otorga la buena pro",
      ejecucion_contractual: null,
    },
  },
  {
    id: "jurado",
    label: "Jurado",
    sigla: "Jurado",
    descripcion:
      "Interviene en contrataciones específicas que requieren evaluación especializada; evalúa propuestas y emite resultados técnicos.",
    participacion: {
      planificacion: null,
      actuaciones_preparatorias: null,
      seleccion: "Evalúa propuestas",
      ejecucion_contractual: null,
    },
  },
];

const ACTOR_MAP = new Map(ACTORES.map((actor) => [actor.id, actor]));

export function actor(id: ActorId): ActorDefinicion {
  const found = ACTOR_MAP.get(id);
  if (!found) {
    throw new Error(`Actor desconocido: ${id}`);
  }
  return found;
}

export function actorLabel(id: ActorId): string {
  return ACTOR_MAP.get(id)?.label ?? id;
}

export function actorSigla(id: ActorId): string {
  return ACTOR_MAP.get(id)?.sigla ?? id;
}
