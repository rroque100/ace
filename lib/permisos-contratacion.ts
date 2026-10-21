// Modelo central de roles y permisos del sistema, alineado a los actores de la
// Ley N.° 32069 y su Reglamento (D.S. N.° 009-2025-EF).
//
// - AppRole: rol de login que se asigna a una persona (profiles.role en la BD).
// - Capability: accion concreta del expediente que un rol puede ejecutar.
// - APP_AREAS: matriz descriptiva (para el panel de administracion y la sesion).
//
// Es la unica fuente de verdad: auth.ts, las rutas del expediente, el catalogo
// de configuracion y el panel admin derivan de aqui.

export type AppRole =
  | "consulta"
  | "area_usuaria"
  | "ate"
  | "dec"
  | "oficial_compra"
  | "comite"
  | "jurado"
  | "legal"
  | "titular"
  | "aga"
  | "admin";

export const APP_ROLES: Array<{ value: AppRole; label: string; description: string }> = [
  {
    value: "consulta",
    label: "Consulta",
    description: "Consulta chat, búsqueda, normas, historial y guardados; no gestiona expedientes ni corpus.",
  },
  {
    value: "area_usuaria",
    label: "Área usuaria",
    description: "Formula el requerimiento (ET/TDR), da soporte técnico y emite conformidad de la prestación.",
  },
  {
    value: "ate",
    label: "Área técnica estratégica (ATE)",
    description: "Área usuaria especializada para contrataciones de alta complejidad técnica.",
  },
  {
    value: "dec",
    label: "DEC",
    description: "Dependencia encargada de las contrataciones: conduce y administra el expediente y el corpus.",
  },
  {
    value: "oficial_compra",
    label: "Oficial de Compra",
    description: "Funcionario de la DEC responsable de la fase de selección.",
  },
  {
    value: "comite",
    label: "Comité de selección",
    description: "Órgano colegiado que absuelve consultas, integra bases, evalúa, califica y otorga la buena pro.",
  },
  {
    value: "jurado",
    label: "Jurado",
    description: "Evalúa propuestas en contrataciones que requieren evaluación especializada.",
  },
  {
    value: "legal",
    label: "Legal",
    description: "Asesoría legal: revisa fundamento, riesgos, informes legales y perfeccionamiento contractual.",
  },
  {
    value: "titular",
    label: "Titular de la Entidad",
    description: "Máxima autoridad: dirige, supervisa y aprueba actuaciones no delegables.",
  },
  {
    value: "aga",
    label: "Autoridad de Gestión Administrativa (AGA)",
    description: "Dirige la gestión de contrataciones, aprueba el expediente y designa comités.",
  },
  {
    value: "admin",
    label: "Administrador",
    description: "Administra configuración, usuarios, monitoreo, auditoría y corpus completo.",
  },
];

const APP_ROLE_VALUES = APP_ROLES.map((role) => role.value);

const ROLE_LABELS = new Map(APP_ROLES.map((role) => [role.value, role.label]));

export function appRoleLabel(role: AppRole): string {
  return ROLE_LABELS.get(role) ?? role;
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLE_VALUES.includes(value as AppRole);
}

// ===== Capacidades (acciones concretas del expediente) =====

export type Capability =
  | "necesidad.manage" // registrar/editar necesidades y derivarlas a expediente (Modulo 1)
  | "expediente.manage" // crear, editar, cambiar estado y eliminar expedientes
  | "expediente.upload" // cargar/vincular documentos del expediente
  | "expediente.evaluate" // evaluar y calificar ofertas
  | "expediente.risks" // detectar riesgos del expediente
  | "expediente.draft" // generar documentos (actas/informes/plantillas)
  | "expediente.approve" // aprobar/observar/rechazar (Aprobacion AGA, Modulo 5)
  | "expediente.execute"; // actuaciones de ejecucion: conformidad, penalidades, liquidacion (Modulo 8)

export const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  consulta: [],
  area_usuaria: ["necesidad.manage", "expediente.upload", "expediente.execute"],
  ate: ["necesidad.manage", "expediente.upload"],
  dec: [
    "necesidad.manage",
    "expediente.manage",
    "expediente.upload",
    "expediente.evaluate",
    "expediente.risks",
    "expediente.draft",
    "expediente.execute",
  ],
  oficial_compra: ["expediente.upload", "expediente.evaluate", "expediente.draft"],
  comite: ["expediente.upload", "expediente.evaluate", "expediente.draft"],
  jurado: ["expediente.evaluate"],
  legal: ["expediente.risks", "expediente.draft"],
  titular: ["expediente.manage", "expediente.approve"],
  aga: ["expediente.manage", "expediente.upload", "expediente.approve"],
  admin: [
    "necesidad.manage",
    "expediente.manage",
    "expediente.upload",
    "expediente.evaluate",
    "expediente.risks",
    "expediente.draft",
    "expediente.approve",
    "expediente.execute",
  ],
};

/**
 * Roles que tienen una capacidad, con su nombre legible.
 *
 * Sirve para explicarle a alguien por qué NO ve un botón. La lista se deriva de
 * la matriz en vez de escribirse a mano: el aviso de "Necesidades" decía
 * "Área usuaria, ATE o DEC" y se había quedado corto —admin también puede—,
 * porque un texto fijo no se entera de que la matriz cambió.
 */
export function rolesConCapacidad(capacidad: Capability): string[] {
  return APP_ROLES.filter((rol) => ROLE_CAPABILITIES[rol.value].includes(capacidad)).map(
    (rol) => rol.label,
  );
}

export function capabilitiesForRole(role: AppRole): Capability[] {
  return ROLE_CAPABILITIES[role] ?? [];
}

export function roleHasCapability(role: AppRole, capability: Capability): boolean {
  return capabilitiesForRole(role).includes(capability);
}

// ===== Matriz descriptiva de áreas del sistema (panel admin + sesión) =====

export type AppArea = { area: string; scope: string; roles: AppRole[] };

// `admin` siempre tiene acceso, no hace falta listarlo en `roles`.
export const APP_AREAS: AppArea[] = [
  {
    area: "Consulta documental",
    scope: "Chat, búsqueda, normas, historial y guardados.",
    roles: ["consulta", "area_usuaria", "ate", "dec", "oficial_compra", "comite", "jurado", "legal", "titular", "aga"],
  },
  {
    area: "Necesidades",
    scope: "Registrar necesidades, formular el requerimiento y derivarlas a expediente (Módulo 1).",
    roles: ["area_usuaria", "ate", "dec"],
  },
  {
    area: "Expedientes",
    scope: "Instruir el expediente fase por fase: cargar documentos, evaluar, calificar y generar actos.",
    roles: ["area_usuaria", "ate", "dec", "oficial_compra", "comite", "jurado", "legal", "titular", "aga"],
  },
  {
    area: "Biblioteca documental",
    scope: "Subir, reindexar y eliminar documentos del corpus.",
    roles: ["dec"],
  },
  {
    area: "Análisis jurídico",
    scope: "Revisión legal, riesgos, informes y fundamento jurídico.",
    roles: ["legal", "dec"],
  },
  {
    area: "Validación de procedimientos",
    scope: "Validar procedencia y fuentes; verificación de corpus solo admin.",
    roles: ["consulta", "area_usuaria", "ate", "dec", "oficial_compra", "comite", "jurado", "legal", "titular", "aga"],
  },
  {
    area: "Evaluación IA",
    scope: "Banco de preguntas, corridas y feedback institucional.",
    roles: [],
  },
  {
    area: "Monitoreo y auditoría",
    scope: "Métricas, auditoría, integraciones y verificación operativa.",
    roles: [],
  },
  {
    area: "Configuración",
    scope: "Entidad, procesos, usuarios, roles y permisos.",
    roles: [],
  },
];

export function areasForRole(role: AppRole): Array<{ area: string; scope: string }> {
  return APP_AREAS.filter((item) => role === "admin" || item.roles.includes(role)).map((item) => ({
    area: item.area,
    scope: item.scope,
  }));
}
